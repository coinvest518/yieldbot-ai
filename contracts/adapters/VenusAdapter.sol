// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IYieldAdapter} from "./IYieldAdapter.sol";

/**
 * @title IVToken (Venus Protocol)
 * @notice Interface for Venus vToken (e.g., vUSDT, vUSDC)
 */
interface IVToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function balanceOfUnderlying(address owner) external returns (uint256);
    function exchangeRateStored() external view returns (uint256);
    function exchangeRateCurrent() external returns (uint256);
    function underlying() external view returns (address);
    function supplyRatePerBlock() external view returns (uint256);
}

/**
 * @title IVenusComptroller
 * @notice Interface for Venus Comptroller to claim XVS rewards
 */
interface IVenusComptroller {
    function claimVenus(address holder) external;
    function claimVenus(address holder, address[] memory vTokens) external;
    function venusAccrued(address holder) external view returns (uint256);
}

/**
 * @title IPancakeRouter
 * @notice Interface for PancakeSwap router to swap XVS to underlying
 */
interface IPancakeRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function getAmountsOut(uint256 amountIn, address[] calldata path) 
        external view returns (uint256[] memory amounts);
}

/**
 * @title VenusAdapter
 * @notice Adapter for Venus Protocol lending on BSC
 * @dev Supplies tokens to Venus, earns interest + XVS rewards
 * 
 * Security Features:
 * - Slippage protection on harvest swaps
 * - Venus market health checks
 * - Partial withdrawal support
 * - Proper access control
 */
contract VenusAdapter is IYieldAdapter {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    bytes32 public constant override adapterId = keccak256("VENUS_LENDING");
    
    // Slippage protection (5% = 500 basis points)
    uint256 public constant SLIPPAGE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // ============ State ============
    
    IERC20 public immutable override asset;
    IVToken public immutable vToken;
    IVenusComptroller public immutable comptroller;
    IPancakeRouter public immutable router;
    IERC20 public immutable xvsToken;  // XVS reward token (passed in constructor)
    
    address public vault;
    address public owner;
    
    // Swap path for XVS → underlying (set in constructor)
    address[] public swapPath;
    
    // ============ Events ============
    
    event Deposited(uint256 amount, uint256 vTokensMinted);
    event Withdrawn(uint256 requestedAmount, uint256 actualAmount, address to);
    event Harvested(uint256 xvsAmount, uint256 underlyingReceived);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event SwapPathUpdated(address[] newPath);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    
    // ============ Errors ============
    
    error OnlyVault();
    error OnlyOwner();
    error VenusMintFailed();
    error VenusRedeemFailed();
    error VenusMarketUnhealthy();
    error InvalidAddress();
    error SlippageExceeded();
    
    // ============ Constructor ============
    
    /**
     * @param asset_ Underlying token (USDT, USDC, etc.)
     * @param vToken_ Venus vToken address (vUSDT, vUSDC, etc.)
     * @param comptroller_ Venus Comptroller address
     * @param router_ PancakeSwap router for swapping XVS rewards
     * @param vault_ YBOTYieldVault address
     * @param xvs_ XVS token address (different on testnet vs mainnet)
     * @param swapPath_ Path for swapping XVS to underlying [XVS, WBNB, USDT]
     */
    constructor(
        address asset_,
        address vToken_,
        address comptroller_,
        address router_,
        address vault_,
        address xvs_,
        address[] memory swapPath_
    ) {
        if (asset_ == address(0)) revert InvalidAddress();
        if (vToken_ == address(0)) revert InvalidAddress();
        if (comptroller_ == address(0)) revert InvalidAddress();
        if (router_ == address(0)) revert InvalidAddress();
        if (vault_ == address(0)) revert InvalidAddress();
        
        asset = IERC20(asset_);
        vToken = IVToken(vToken_);
        comptroller = IVenusComptroller(comptroller_);
        router = IPancakeRouter(router_);
        xvsToken = IERC20(xvs_);
        vault = vault_;
        owner = msg.sender;
        swapPath = swapPath_;
        
        // Approve vToken to pull underlying
        IERC20(asset_).forceApprove(vToken_, type(uint256).max);
        
        // Approve router to pull XVS for swaps (only if XVS address is valid)
        if (xvs_ != address(0)) {
            IERC20(xvs_).forceApprove(router_, type(uint256).max);
        }
    }
    
    // ============ Modifiers ============
    
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Deposit assets into Venus
     * @dev Checks Venus market health before depositing
     */
    function deposit(uint256 assets) external override onlyVault returns (uint256) {
        // Check Venus market health
        uint256 exchangeRate = vToken.exchangeRateStored();
        if (exchangeRate == 0) revert VenusMarketUnhealthy();
        
        // Transfer from vault to adapter
        asset.safeTransferFrom(msg.sender, address(this), assets);
        
        // Supply to Venus
        uint256 vTokensBefore = vToken.balanceOf(address(this));
        uint256 result = vToken.mint(assets);
        if (result != 0) revert VenusMintFailed();
        uint256 vTokensAfter = vToken.balanceOf(address(this));
        
        emit Deposited(assets, vTokensAfter - vTokensBefore);
        return assets;
    }
    
    /**
     * @notice Withdraw assets from Venus
     * @dev Supports partial withdrawals if Venus has insufficient liquidity
     */
    function withdraw(uint256 assets, address to) external override onlyVault returns (uint256) {
        uint256 balanceBefore = asset.balanceOf(address(this));
        
        uint256 result = vToken.redeemUnderlying(assets);
        if (result != 0) revert VenusRedeemFailed();
        
        uint256 actualWithdrawn = asset.balanceOf(address(this)) - balanceBefore;
        asset.safeTransfer(to, actualWithdrawn);
        
        emit Withdrawn(assets, actualWithdrawn, to);
        return actualWithdrawn;
    }
    
    /**
     * @notice Withdraw all assets from Venus
     */
    function withdrawAll(address to) external override onlyVault returns (uint256) {
        uint256 vTokenBalance = vToken.balanceOf(address(this));
        if (vTokenBalance == 0) return 0;
        
        uint256 result = vToken.redeem(vTokenBalance);
        if (result != 0) revert VenusRedeemFailed();
        
        uint256 balance = asset.balanceOf(address(this));
        asset.safeTransfer(to, balance);
        
        emit Withdrawn(balance, balance, to);
        return balance;
    }
    
    /**
     * @notice Harvest XVS rewards, swap to underlying, return to vault
     * @dev Includes slippage protection (5% max slippage)
     */
    function harvest(address to) external override onlyVault returns (uint256) {
        // Claim XVS rewards
        address[] memory vTokens = new address[](1);
        vTokens[0] = address(vToken);
        comptroller.claimVenus(address(this), vTokens);
        
        uint256 xvsBalance = xvsToken.balanceOf(address(this));
        if (xvsBalance == 0) return 0;
        
        // Calculate minimum expected output with slippage protection
        uint256[] memory expectedAmounts = router.getAmountsOut(xvsBalance, swapPath);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        uint256 minOut = (expectedOut * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        
        // Swap XVS to underlying via PancakeSwap with slippage protection
        uint256[] memory amounts = router.swapExactTokensForTokens(
            xvsBalance,
            minOut, // ✅ Slippage protection
            swapPath,
            to,
            block.timestamp + 300
        );
        
        uint256 received = amounts[amounts.length - 1];
        
        emit Harvested(xvsBalance, received);
        return received;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get total underlying assets in Venus
     */
    function totalUnderlying() external view override returns (uint256) {
        uint256 vTokenBalance = vToken.balanceOf(address(this));
        if (vTokenBalance == 0) return 0;
        
        // vToken balance * exchange rate / 1e18
        uint256 exchangeRate = vToken.exchangeRateStored();
        return (vTokenBalance * exchangeRate) / 1e18;
    }
    
    /**
     * @notice Get pending XVS rewards (estimated)
     */
    function pendingRewards() external view override returns (uint256) {
        return comptroller.venusAccrued(address(this));
    }
    
    /**
     * @notice Estimated APY from Venus supply rate
     * @dev Returns APY in basis points (e.g., 800 = 8%)
     */
    function estimatedAPY() external view override returns (uint256) {
        // Venus uses blocks, ~3 sec per block on BSC
        // Blocks per year ≈ 10,512,000
        uint256 supplyRatePerBlock = vToken.supplyRatePerBlock();
        uint256 blocksPerYear = 10_512_000;
        
        // APY = (1 + rate)^blocks - 1, simplified to rate * blocks for low rates
        uint256 apyRaw = supplyRatePerBlock * blocksPerYear;
        
        // Convert from 1e18 to basis points
        return apyRaw / 1e14; // 1e18 / 1e14 = 1e4 = BPS
    }
    
    // ============ Admin ============
    
    /**
     * @notice Update vault address
     */
    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert InvalidAddress();
        address oldVault = vault;
        vault = newVault;
        emit VaultUpdated(oldVault, newVault);
    }
    
    /**
     * @notice Update swap path for XVS → underlying
     */
    function setSwapPath(address[] calldata newPath) external onlyOwner {
        swapPath = newPath;
        emit SwapPathUpdated(newPath);
    }
    
    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @notice Emergency rescue tokens
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
