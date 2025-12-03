// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============ OpenZeppelin Interfaces ============

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// ============ SafeERC20 Library ============

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        require(token.transfer(to, value), "SafeERC20: transfer failed");
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        require(token.transferFrom(from, to, value), "SafeERC20: transferFrom failed");
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        // Some tokens (like USDT) require allowance to be 0 before setting new value
        bytes memory approvalCall = abi.encodeWithSelector(token.approve.selector, spender, value);
        (bool success, bytes memory returndata) = address(token).call(approvalCall);
        if (!success || (returndata.length > 0 && !abi.decode(returndata, (bool)))) {
            // Try setting to 0 first, then to value
            (success,) = address(token).call(abi.encodeWithSelector(token.approve.selector, spender, 0));
            require(success, "SafeERC20: approve to zero failed");
            (success,) = address(token).call(approvalCall);
            require(success, "SafeERC20: approve failed");
        }
    }
}

// ============ IYieldAdapter Interface ============

interface IYieldAdapter {
    function asset() external view returns (IERC20);
    function adapterId() external view returns (bytes32);
    function totalUnderlying() external view returns (uint256);
    function pendingRewards() external view returns (uint256);
    function deposit(uint256 assets) external returns (uint256 deposited);
    function withdraw(uint256 assets, address to) external returns (uint256 withdrawn);
    function withdrawAll(address to) external returns (uint256 withdrawn);
    function harvest(address to) external returns (uint256 harvested);
    function estimatedAPY() external view returns (uint256);
}

// ============ Venus Protocol Interfaces ============

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

interface IVenusComptroller {
    function claimVenus(address holder) external;
    function claimVenus(address holder, address[] memory vTokens) external;
    function venusAccrued(address holder) external view returns (uint256);
}

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

// ============ VenusAdapter Contract ============

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
    IERC20 public immutable xvsToken;
    
    address public vault;
    address public owner;
    
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
     * @param xvs_ XVS token address
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
        
        IERC20(asset_).forceApprove(vToken_, type(uint256).max);
        
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
    
    function deposit(uint256 assets) external override onlyVault returns (uint256) {
        uint256 exchangeRate = vToken.exchangeRateStored();
        if (exchangeRate == 0) revert VenusMarketUnhealthy();
        
        asset.safeTransferFrom(msg.sender, address(this), assets);
        
        uint256 vTokensBefore = vToken.balanceOf(address(this));
        uint256 result = vToken.mint(assets);
        if (result != 0) revert VenusMintFailed();
        uint256 vTokensAfter = vToken.balanceOf(address(this));
        
        emit Deposited(assets, vTokensAfter - vTokensBefore);
        return assets;
    }
    
    function withdraw(uint256 assets, address to) external override onlyVault returns (uint256) {
        uint256 balanceBefore = asset.balanceOf(address(this));
        
        uint256 result = vToken.redeemUnderlying(assets);
        if (result != 0) revert VenusRedeemFailed();
        
        uint256 actualWithdrawn = asset.balanceOf(address(this)) - balanceBefore;
        asset.safeTransfer(to, actualWithdrawn);
        
        emit Withdrawn(assets, actualWithdrawn, to);
        return actualWithdrawn;
    }
    
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
    
    function harvest(address to) external override onlyVault returns (uint256) {
        address[] memory vTokens = new address[](1);
        vTokens[0] = address(vToken);
        comptroller.claimVenus(address(this), vTokens);
        
        uint256 xvsBalance = xvsToken.balanceOf(address(this));
        if (xvsBalance == 0) return 0;
        
        uint256[] memory expectedAmounts = router.getAmountsOut(xvsBalance, swapPath);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        uint256 minOut = (expectedOut * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            xvsBalance,
            minOut,
            swapPath,
            to,
            block.timestamp + 300
        );
        
        uint256 received = amounts[amounts.length - 1];
        
        emit Harvested(xvsBalance, received);
        return received;
    }
    
    // ============ View Functions ============
    
    function totalUnderlying() external view override returns (uint256) {
        uint256 vTokenBalance = vToken.balanceOf(address(this));
        if (vTokenBalance == 0) return 0;
        
        uint256 exchangeRate = vToken.exchangeRateStored();
        return (vTokenBalance * exchangeRate) / 1e18;
    }
    
    function pendingRewards() external view override returns (uint256) {
        return comptroller.venusAccrued(address(this));
    }
    
    function estimatedAPY() external view override returns (uint256) {
        uint256 supplyRatePerBlock = vToken.supplyRatePerBlock();
        uint256 blocksPerYear = 10_512_000;
        uint256 apyRaw = supplyRatePerBlock * blocksPerYear;
        return apyRaw / 1e14;
    }
    
    // ============ Admin ============
    
    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert InvalidAddress();
        address oldVault = vault;
        vault = newVault;
        emit VaultUpdated(oldVault, newVault);
    }
    
    function setSwapPath(address[] calldata newPath) external onlyOwner {
        swapPath = newPath;
        emit SwapPathUpdated(newPath);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
