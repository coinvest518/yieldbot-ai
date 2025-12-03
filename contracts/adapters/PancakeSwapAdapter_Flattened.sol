// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============ OpenZeppelin Interfaces ============

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IERC20Permit {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

// ============ OpenZeppelin SafeERC20 ============

library Address {
    error AddressInsufficientBalance(address account);
    error AddressEmptyCode(address target);
    error FailedInnerCall();

    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) revert AddressInsufficientBalance(address(this));
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert FailedInnerCall();
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) revert AddressInsufficientBalance(address(this));
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(address target, bool success, bytes memory returndata) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            if (returndata.length == 0 && target.code.length == 0) revert AddressEmptyCode(target);
            return returndata;
        }
    }

    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) _revert(returndata);
        return returndata;
    }

    function _revert(bytes memory returndata) private pure {
        if (returndata.length > 0) {
            assembly { let returndata_size := mload(returndata) revert(add(32, returndata), returndata_size) }
        } else {
            revert FailedInnerCall();
        }
    }
}

library SafeERC20 {
    using Address for address;

    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) revert SafeERC20FailedOperation(address(token));
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory returndata) = address(token).call(data);
        return success && (returndata.length == 0 || abi.decode(returndata, (bool))) && address(token).code.length > 0;
    }
}

// ============ OpenZeppelin ReentrancyGuard ============

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() { _status = NOT_ENTERED; }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) revert ReentrancyGuardReentrantCall();
        _status = ENTERED;
    }

    function _nonReentrantAfter() private { _status = NOT_ENTERED; }

    function _reentrancyGuardEntered() internal view returns (bool) { return _status == ENTERED; }
}

// ============ OpenZeppelin Context ============

abstract contract Context {
    function _msgSender() internal view virtual returns (address) { return msg.sender; }
    function _msgData() internal view virtual returns (bytes calldata) { return msg.data; }
    function _contextSuffixLength() internal view virtual returns (uint256) { return 0; }
}

// ============ OpenZeppelin Pausable ============

abstract contract Pausable is Context {
    bool private _paused;

    event Paused(address account);
    event Unpaused(address account);

    error EnforcedPause();
    error ExpectedPause();

    constructor() { _paused = false; }

    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    modifier whenPaused() {
        _requirePaused();
        _;
    }

    function paused() public view virtual returns (bool) { return _paused; }

    function _requireNotPaused() internal view virtual {
        if (paused()) revert EnforcedPause();
    }

    function _requirePaused() internal view virtual {
        if (!paused()) revert ExpectedPause();
    }

    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

// ============ IYieldAdapter Interface ============

interface IYieldAdapter {
    function adapterId() external view returns (bytes32);
    function asset() external view returns (IERC20);
    function deposit(uint256 assets) external returns (uint256);
    function withdraw(uint256 assets, address to) external returns (uint256);
    function withdrawAll(address to) external returns (uint256);
    function harvest(address to) external returns (uint256);
    function totalUnderlying() external view returns (uint256);
    function pendingRewards() external view returns (uint256);
    function estimatedAPY() external view returns (uint256);
}

// ============ PancakeSwap Interfaces ============

interface IPancakePair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

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

// ============ PancakeSwapAdapter Contract ============

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
    
    address public immutable cakeToken;
    address public immutable wbnbToken;
    address public immutable pancakeRouter;
    
    IERC20 public immutable override asset;
    IERC20 public immutable pairedToken;
    IPancakePair public immutable lpToken;
    IMasterChefV2 public immutable masterChef;
    IPancakeRouter public immutable router;
    uint256 public immutable poolId;
    
    // ============ State ============
    
    address public vault;
    address public owner;
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
        
        cakeToken = cakeToken_;
        wbnbToken = wbnbToken_;
        pancakeRouter = routerAddr;
        
        IERC20(asset_).forceApprove(routerAddr, type(uint256).max);
        IERC20(pairedToken_).forceApprove(routerAddr, type(uint256).max);
        IERC20(lpToken_).approve(routerAddr, type(uint256).max);
        IERC20(lpToken_).approve(masterChef_, type(uint256).max);
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
    
    function deposit(uint256 assets) external override onlyVault nonReentrant whenNotPaused returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        
        asset.safeTransferFrom(msg.sender, address(this), assets);
        
        uint256 halfAssets = assets / 2;
        address[] memory path = new address[](2);
        path[0] = address(asset);
        path[1] = address(pairedToken);
        
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
        
        masterChef.deposit(poolId, lpReceived);
        depositedAssetValue += assets;
        
        emit Deposited(assets, lpReceived, pairedAmount);
        return assets;
    }
    
    function withdraw(uint256 assets, address to) external override onlyVault nonReentrant whenNotPaused returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        
        (uint256 stakedLP,) = masterChef.userInfo(poolId, address(this));
        if (stakedLP == 0) return 0;
        
        uint256 lpToWithdraw = (stakedLP * assets) / depositedAssetValue;
        if (lpToWithdraw > stakedLP) lpToWithdraw = stakedLP;
        
        masterChef.withdraw(poolId, lpToWithdraw);
        
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
        
        (uint256 assetAmount, uint256 pairedAmount) = router.removeLiquidity(
            address(asset),
            address(pairedToken),
            lpToWithdraw,
            minAssetOut,
            minPairedOut,
            address(this),
            block.timestamp + DEADLINE_EXTENSION
        );
        
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
        
        if (assets > depositedAssetValue) {
            depositedAssetValue = 0;
        } else {
            depositedAssetValue -= assets;
        }
        
        asset.safeTransfer(to, assetAmount);
        emit Withdrawn(lpToWithdraw, assetAmount, to);
        return assetAmount;
    }
    
    function withdrawAll(address to) external override onlyVault nonReentrant returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        
        (uint256 stakedLP,) = masterChef.userInfo(poolId, address(this));
        if (stakedLP == 0) return 0;
        
        masterChef.withdraw(poolId, stakedLP);
        uint256 lpBalance = lpToken.balanceOf(address(this));
        
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
    
    function harvest(address to) external override onlyVault nonReentrant whenNotPaused returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        
        masterChef.deposit(poolId, 0);
        uint256 cakeBalance = IERC20(cakeToken).balanceOf(address(this));
        if (cakeBalance == 0) return 0;
        
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
    
    function totalUnderlying() external view override returns (uint256) {
        (uint256 stakedLP,) = masterChef.userInfo(poolId, address(this));
        if (stakedLP == 0) return 0;
        
        (uint112 reserve0, uint112 reserve1,) = lpToken.getReserves();
        uint256 totalLP = lpToken.totalSupply();
        
        uint256 share0 = (uint256(reserve0) * stakedLP) / totalLP;
        uint256 share1 = (uint256(reserve1) * stakedLP) / totalLP;
        
        address token0 = lpToken.token0();
        uint256 assetValue;
        
        if (token0 == address(asset)) {
            assetValue = share0;
            if (reserve0 > 0) {
                assetValue += (share1 * reserve0) / reserve1;
            }
        } else {
            assetValue = share1;
            if (reserve1 > 0) {
                assetValue += (share0 * reserve1) / reserve0;
            }
        }
        
        return assetValue;
    }
    
    function pendingRewards() external view override returns (uint256) {
        return masterChef.pendingCake(poolId, address(this));
    }
    
    function estimatedAPY() external pure override returns (uint256) {
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
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    
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
