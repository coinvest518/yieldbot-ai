// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IYieldAdapter} from "./IYieldAdapter.sol";

/**
 * @title IPancakePair
 * @notice Interface for PancakeSwap LP tokens
 */
interface IPancakePair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/**
 * @title IMasterChefV2
 * @notice Interface for PancakeSwap MasterChef V2 farming
 */
interface IMasterChefV2 {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function emergencyWithdraw(uint256 _pid) external;
    function pendingCake(uint256 _pid, address _user) external view returns (uint256);
    function userInfo(uint256 _pid, address _user) external view returns (uint256 amount, uint256 rewardDebt);
    function poolInfo(uint256 _pid) external view returns (
        uint256 accCakePerShare,
        uint256 lastRewardBlock,
        uint256 allocPoint,
        uint256 totalBoostedShare,
        bool isRegular
    );
    function lpToken(uint256 _pid) external view returns (address);
}

/**
 * @title IPancakeRouter
 * @notice Interface for PancakeSwap router
 */
interface IPancakeRouter {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
    
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
 * @title PancakeSwapAdapter
 * @notice Adapter for PancakeSwap LP farming on BSC
 * @dev Provides liquidity to a pair, stakes LP in MasterChef, earns CAKE rewards
 * 
 * Note: This adapter handles single-asset deposits by:
 * 1. Swapping half to the paired token
 * 2. Adding liquidity
 * 3. Staking LP in MasterChef
 * 
 * Security: ReentrancyGuard, Pausable, slippage protection, deadline checks
 */
contract PancakeSwapAdapter is IYieldAdapter, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    bytes32 public constant override adapterId = keccak256("PANCAKESWAP_FARM");
    
    /// @notice Slippage tolerance: 5% (500 basis points)
    uint256 public constant SLIPPAGE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Default deadline extension (5 minutes)
    uint256 public constant DEADLINE_EXTENSION = 300;
    
    // ============ Immutables ============
    
    // Protocol addresses - set in constructor
    address public immutable cakeToken;
    address public immutable wbnbToken;
    address public immutable pancakeRouter;
    
    IERC20 public immutable override asset;       // The deposit token (e.g., USDT)
    IERC20 public immutable pairedToken;          // The paired token in LP (e.g., WBNB)
    IPancakePair public immutable lpToken;        // The LP token
    IMasterChefV2 public immutable masterChef;
    IPancakeRouter public immutable router;
    uint256 public immutable poolId;              // MasterChef pool ID
    
    // ============ State ============
    
    address public vault;
    address public owner;
    
    // Track deposited value in asset terms
    uint256 public depositedAssetValue;
    
    // ============ Events ============
    
    event Deposited(uint256 assetAmount, uint256 lpReceived, uint256 pairedSwapped);
    event Withdrawn(uint256 lpAmount, uint256 assetReturned, address indexed to);
    event Harvested(uint256 cakeAmount, uint256 assetReceived, address indexed to);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event EmergencyWithdraw(uint256 lpAmount);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    
    // ============ Errors ============
    
    error OnlyVault();
    error OnlyOwner();
    error InsufficientLiquidity();
    error ZeroAmount();
    error ZeroAddress();
    error SlippageExceeded();
    error SwapFailed();
    
    // ============ Constructor ============
    
    /**
     * @param asset_ The deposit token address (e.g., USDT)
     * @param pairedToken_ The paired token in LP (e.g., WBNB)
     * @param lpToken_ The LP token address
     * @param masterChef_ MasterChef V2 address
     * @param poolId_ Pool ID in MasterChef
     * @param vault_ Vault address that can call this adapter
     * @param cakeToken_ CAKE token address
     * @param wbnbToken_ WBNB token address
     * @param routerAddr PancakeSwap router address
     */
    constructor(
        address asset_,
        address pairedToken_,
        address lpToken_,
        address masterChef_,
        uint256 poolId_,
        address vault_,
        address cakeToken_,
        address wbnbToken_,
        address routerAddr
    ) {
        asset = IERC20(asset_);
        pairedToken = IERC20(pairedToken_);
        lpToken = IPancakePair(lpToken_);
        masterChef = IMasterChefV2(masterChef_);
        router = IPancakeRouter(routerAddr);
        poolId = poolId_;
        vault = vault_;
        owner = msg.sender;
        
        // Store protocol addresses
        cakeToken = cakeToken_;
        wbnbToken = wbnbToken_;
        pancakeRouter = routerAddr;
        
        // Approve router for swaps and liquidity
        IERC20(asset_).forceApprove(routerAddr, type(uint256).max);
        IERC20(pairedToken_).forceApprove(routerAddr, type(uint256).max);
        IERC20(lpToken_).approve(routerAddr, type(uint256).max);
        
        // Approve masterchef for staking
        IERC20(lpToken_).approve(masterChef_, type(uint256).max);
        
        // Approve CAKE for swapping rewards
        IERC20(cakeToken_).forceApprove(routerAddr, type(uint256).max);
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
     * @notice Deposit assets: swap half to paired token, add liquidity, stake LP
     * @dev Includes slippage protection and deadline
     */
    function deposit(uint256 assets) external override onlyVault nonReentrant whenNotPaused returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        
        asset.safeTransferFrom(msg.sender, address(this), assets);
        
        // Swap half to paired token
        uint256 halfAssets = assets / 2;
        address[] memory path = new address[](2);
        path[0] = address(asset);
        path[1] = address(pairedToken);
        
        // Calculate minimum output with slippage protection
        uint256[] memory expectedAmounts = router.getAmountsOut(halfAssets, path);
        uint256 minPairedOut = (expectedAmounts[1] * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            halfAssets,
            minPairedOut,
            path,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );
        uint256 pairedAmount = amounts[1];
        
        // Add liquidity with slippage protection
        uint256 assetForLP = assets - halfAssets;
        uint256 minAssetLP = (assetForLP * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        uint256 minPairedLP = (pairedAmount * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        
        (,, uint256 lpReceived) = router.addLiquidity(
            address(asset),
            address(pairedToken),
            assetForLP,
            pairedAmount,
            minAssetLP,
            minPairedLP,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );
        
        // Stake LP in MasterChef
        masterChef.deposit(poolId, lpReceived);
        
        depositedAssetValue += assets;
        
        emit Deposited(assets, lpReceived, pairedAmount);
        return assets;
    }
    
    /**
     * @notice Withdraw: unstake LP, remove liquidity, swap paired token back to asset
     * @dev Includes slippage protection
     */
    function withdraw(uint256 assets, address to) external override onlyVault nonReentrant whenNotPaused returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        
        // Calculate LP amount to withdraw based on proportion
        (uint256 stakedLP,) = masterChef.userInfo(poolId, address(this));
        if (stakedLP == 0) return 0;
        
        uint256 lpToWithdraw = (stakedLP * assets) / depositedAssetValue;
        if (lpToWithdraw > stakedLP) lpToWithdraw = stakedLP;
        
        // Unstake LP (also claims CAKE rewards)
        masterChef.withdraw(poolId, lpToWithdraw);
        
        // Get expected amounts from removing liquidity
        (uint112 reserve0, uint112 reserve1,) = lpToken.getReserves();
        uint256 totalLP = lpToken.totalSupply();
        uint256 expectedAsset;
        uint256 expectedPaired;
        
        if (lpToken.token0() == address(asset)) {
            expectedAsset = (uint256(reserve0) * lpToWithdraw) / totalLP;
            expectedPaired = (uint256(reserve1) * lpToWithdraw) / totalLP;
        } else {
            expectedAsset = (uint256(reserve1) * lpToWithdraw) / totalLP;
            expectedPaired = (uint256(reserve0) * lpToWithdraw) / totalLP;
        }
        
        uint256 minAssetOut = (expectedAsset * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        uint256 minPairedOut = (expectedPaired * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        
        // Remove liquidity
        (uint256 assetAmount, uint256 pairedAmount) = router.removeLiquidity(
            address(asset),
            address(pairedToken),
            lpToWithdraw,
            minAssetOut,
            minPairedOut,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );
        
        // Swap paired token back to asset with slippage protection
        if (pairedAmount > 0) {
            address[] memory path = new address[](2);
            path[0] = address(pairedToken);
            path[1] = address(asset);
            
            uint256[] memory expectedSwap = router.getAmountsOut(pairedAmount, path);
            uint256 minSwapOut = (expectedSwap[1] * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
            
            uint256[] memory amounts = router.swapExactTokensForTokens(
                pairedAmount,
                minSwapOut,
                path,
                address(this),
                block.timestamp + DEADLINE_EXTENSION
            );
            assetAmount += amounts[1];
        }
        
        // Update tracking
        if (assets > depositedAssetValue) {
            depositedAssetValue = 0;
        } else {
            depositedAssetValue -= assets;
        }
        
        // Transfer to recipient
        asset.safeTransfer(to, assetAmount);
        
        emit Withdrawn(lpToWithdraw, assetAmount, to);
        return assetAmount;
    }
    
    /**
     * @notice Withdraw all: unstake all LP, remove all liquidity
     * @dev Emergency function with slippage protection
     */
    function withdrawAll(address to) external override onlyVault nonReentrant returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        
        (uint256 stakedLP,) = masterChef.userInfo(poolId, address(this));
        if (stakedLP == 0) return 0;
        
        // Unstake all LP
        masterChef.withdraw(poolId, stakedLP);
        
        // Remove all liquidity
        uint256 lpBalance = lpToken.balanceOf(address(this));
        
        // Get expected amounts
        (uint112 reserve0, uint112 reserve1,) = lpToken.getReserves();
        uint256 totalLP = lpToken.totalSupply();
        uint256 expectedAsset;
        uint256 expectedPaired;
        
        if (lpToken.token0() == address(asset)) {
            expectedAsset = (uint256(reserve0) * lpBalance) / totalLP;
            expectedPaired = (uint256(reserve1) * lpBalance) / totalLP;
        } else {
            expectedAsset = (uint256(reserve1) * lpBalance) / totalLP;
            expectedPaired = (uint256(reserve0) * lpBalance) / totalLP;
        }
        
        uint256 minAssetOut = (expectedAsset * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        uint256 minPairedOut = (expectedPaired * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        
        (uint256 assetAmount, uint256 pairedAmount) = router.removeLiquidity(
            address(asset),
            address(pairedToken),
            lpBalance,
            minAssetOut,
            minPairedOut,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );
        
        // Swap paired token back to asset
        if (pairedAmount > 0) {
            address[] memory path = new address[](2);
            path[0] = address(pairedToken);
            path[1] = address(asset);
            
            uint256[] memory expectedSwap = router.getAmountsOut(pairedAmount, path);
            uint256 minSwapOut = (expectedSwap[1] * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
            
            uint256[] memory amounts = router.swapExactTokensForTokens(
                pairedAmount,
                minSwapOut,
                path,
                address(this),
                block.timestamp + DEADLINE_EXTENSION
            );
            assetAmount += amounts[1];
        }
        
        depositedAssetValue = 0;
        
        asset.safeTransfer(to, assetAmount);
        
        emit Withdrawn(stakedLP, assetAmount, to);
        return assetAmount;
    }
    
    /**
     * @notice Harvest CAKE rewards, swap to asset, return to vault
     * @dev Swaps through WBNB for better liquidity
     */
    function harvest(address to) external override onlyVault nonReentrant whenNotPaused returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        
        // Deposit 0 to claim pending CAKE
        masterChef.deposit(poolId, 0);
        
        uint256 cakeBalance = IERC20(cakeToken).balanceOf(address(this));
        if (cakeBalance == 0) return 0;
        
        // Swap CAKE to asset via WBNB with slippage protection
        address[] memory path = new address[](3);
        path[0] = cakeToken;
        path[1] = wbnbToken;
        path[2] = address(asset);
        
        uint256[] memory expectedAmounts = router.getAmountsOut(cakeBalance, path);
        uint256 minOut = (expectedAmounts[2] * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            cakeBalance,
            minOut,
            path,
            to,
            block.timestamp + DEADLINE_EXTENSION
        );
        
        uint256 received = amounts[amounts.length - 1];
        
        emit Harvested(cakeBalance, received, to);
        return received;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get total underlying value in asset terms
     */
    function totalUnderlying() external view override returns (uint256) {
        (uint256 stakedLP,) = masterChef.userInfo(poolId, address(this));
        if (stakedLP == 0) return 0;
        
        // Get reserves and calculate share value
        (uint112 reserve0, uint112 reserve1,) = lpToken.getReserves();
        uint256 totalLP = lpToken.totalSupply();
        
        // Our share of reserves
        uint256 share0 = (uint256(reserve0) * stakedLP) / totalLP;
        uint256 share1 = (uint256(reserve1) * stakedLP) / totalLP;
        
        // Determine which is asset, convert other to asset value
        address token0 = lpToken.token0();
        uint256 assetValue;
        
        if (token0 == address(asset)) {
            // token0 is asset, token1 is paired
            assetValue = share0;
            // Estimate paired token value in asset terms using reserves ratio
            if (reserve0 > 0) {
                assetValue += (share1 * reserve0) / reserve1;
            }
        } else {
            // token1 is asset, token0 is paired
            assetValue = share1;
            if (reserve1 > 0) {
                assetValue += (share0 * reserve1) / reserve0;
            }
        }
        
        return assetValue;
    }
    
    /**
     * @notice Get pending CAKE rewards
     */
    function pendingRewards() external view override returns (uint256) {
        return masterChef.pendingCake(poolId, address(this));
    }
    
    /**
     * @notice Estimated APY from CAKE farming
     * @dev Returns APY in basis points - this is a rough estimate
     */
    function estimatedAPY() external pure override returns (uint256) {
        // PancakeSwap farms typically yield 15-40% APY
        // This is a placeholder - real implementation would calculate from emissions
        return 2000; // 20% APY estimate
    }
    
    // ============ Admin ============
    
    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert ZeroAddress();
        address oldVault = vault;
        vault = newVault;
        emit VaultUpdated(oldVault, newVault);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw() external onlyOwner {
        (uint256 stakedLP,) = masterChef.userInfo(poolId, address(this));
        masterChef.emergencyWithdraw(poolId);
        emit EmergencyWithdraw(stakedLP);
    }
    
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }
}
