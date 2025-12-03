
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============ Interfaces ============

/**
 * @dev Interface of the ERC-20 standard as defined in the EIP.
 */
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @dev Interface for the optional metadata functions from the ERC-20 standard.
 */
interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

/**
 * @title IYieldAdapter
 * @notice Interface for yield adapter contracts (Venus, PancakeSwap, Beefy, etc.)
 */
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

/**
 * @title IYBOTToken
 * @notice Interface for YBOT token with mint capability
 */
interface IYBOTToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function decimals() external view returns (uint8);
}

// ============ OpenZeppelin Imports (Abstract Contracts) ============

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable is Context {
    address private _owner;
    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) revert OwnableUnauthorizedAccount(_msgSender());
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) revert ReentrancyGuardReentrantCall();
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

abstract contract Pausable is Context {
    bool private _paused;
    event Paused(address account);
    event Unpaused(address account);
    error EnforcedPause();
    error ExpectedPause();

    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    modifier whenPaused() {
        _requirePaused();
        _;
    }

    function paused() public view virtual returns (bool) {
        return _paused;
    }

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

// ============ SafeERC20 Library ============

library SafeERC20 {
    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function trySafeTransfer(IERC20 token, address to, uint256 value) internal returns (bool) {
        return _callOptionalReturnBool(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function trySafeTransferFrom(IERC20 token, address from, address to, uint256 value) internal returns (bool) {
        return _callOptionalReturnBool(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
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
        (bool success, bytes memory result) = address(token).call(data);
        if (!success || (result.length > 0 && !abi.decode(result, (bool)))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory result) = address(token).call(data);
        return success && (result.length == 0 || abi.decode(result, (bool)));
    }
}

// ============ Main Contract ============

/**
 * @title YBOTYieldVault
 * @notice Multi-protocol yield vault with YBOT token gating and YBOT rewards
 */
contract YBOTYieldVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_ADAPTERS = 10;
    uint256 public constant MIN_DEPOSIT_USD = 10; // $10 minimum deposit

    // ============ State Variables ============
    IERC20 public immutable depositToken;
    IYBOTToken public immutable ybotToken;
    uint8 public immutable depositTokenDecimals;

    uint256 public minYBOTBalance;
    uint256 public depositFeeBps;
    uint256 public withdrawalFeeBps;
    uint256 public performanceFeeBps;
    address public feeCollector;
    uint256 public ybotRewardRate;

    IYieldAdapter[] public adapters;
    mapping(bytes32 => uint256) public adapterIndex;
    uint256[] public allocationBps;

    struct UserInfo {
        uint256 deposited;
        uint256 rewardDebt;
        uint256 lastDepositTime;
    }
    mapping(address => UserInfo) public userInfo;

    uint256 public totalDeposited;
    uint256 public accYBOTPerShare;
    uint256 public lastHarvestTime;

    // ============ Events ============
    event Deposited(address indexed user, uint256 amount, uint256 fee);
    event Withdrawn(address indexed user, uint256 amount, uint256 fee);
    event YBOTRewarded(address indexed user, uint256 ybotAmount);
    event Harvested(uint256 totalYield, uint256 performanceFee, uint256 ybotMinted);
    event AdapterAdded(bytes32 indexed adapterId, address adapter, uint256 allocationBps);
    event AdapterRemoved(bytes32 indexed adapterId);
    event AllocationUpdated(uint256[] newAllocations);
    event MinYBOTBalanceUpdated(uint256 oldMin, uint256 newMin);

    // ============ Errors ============
    error InsufficientYBOTBalance(uint256 required, uint256 actual);
    error BelowMinimumDeposit(uint256 minimum, uint256 actual);
    error InsufficientBalance();
    error InvalidAllocation();
    error AdapterNotFound();
    error TooManyAdapters();
    error InvalidAddress();
    error ZeroAddress();
    error WithdrawalTooSoon();

    // ============ Constructor ============
    constructor(
        address depositToken_,
        address ybotToken_,
        address owner_,
        address feeCollector_,
        uint256 minYBOTBalance_,
        uint256 ybotRewardRate_,
        uint256 depositFeeBps_,
        uint256 withdrawalFeeBps_,
        uint256 performanceFeeBps_
    ) Ownable(owner_) {
        if (depositToken_ == address(0) || ybotToken_ == address(0) || feeCollector_ == address(0)) {
            revert ZeroAddress();
        }

        depositToken = IERC20(depositToken_);
        ybotToken = IYBOTToken(ybotToken_);
        depositTokenDecimals = IERC20Metadata(depositToken_).decimals();

        feeCollector = feeCollector_;
        minYBOTBalance = minYBOTBalance_;
        ybotRewardRate = ybotRewardRate_;

        depositFeeBps = depositFeeBps_;
        withdrawalFeeBps = withdrawalFeeBps_;
        performanceFeeBps = performanceFeeBps_;

        lastHarvestTime = block.timestamp;
    }

    // ============ Modifiers ============
    modifier requireYBOTGate() {
        if (ybotToken.balanceOf(msg.sender) < minYBOTBalance) {
            revert InsufficientYBOTBalance(minYBOTBalance, ybotToken.balanceOf(msg.sender));
        }
        _;
    }

    // ============ User Functions ============
    function deposit(uint256 amount) external nonReentrant whenNotPaused requireYBOTGate {
        uint256 minDeposit = MIN_DEPOSIT_USD * (10 ** depositTokenDecimals);
        if (amount < minDeposit) revert BelowMinimumDeposit(minDeposit, amount);

        _harvestUserRewards(msg.sender);

        uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;

        depositToken.safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) depositToken.safeTransfer(feeCollector, fee);

        UserInfo storage user = userInfo[msg.sender];
        user.deposited += netAmount;
        user.lastDepositTime = block.timestamp;
        user.rewardDebt = (user.deposited * accYBOTPerShare) / 1e18;

        totalDeposited += netAmount;
        _distributeToAdapters(netAmount);

        emit Deposited(msg.sender, amount, fee);
    }

    function withdraw(uint256 amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        if (user.deposited < amount) revert InsufficientBalance();

        _harvestUserRewards(msg.sender);

        uint256 fee = (amount * withdrawalFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;

        user.deposited -= amount;
        user.rewardDebt = (user.deposited * accYBOTPerShare) / 1e18;

        totalDeposited -= amount;
        _withdrawFromAdapters(amount);

        if (fee > 0) depositToken.safeTransfer(feeCollector, fee);
        depositToken.safeTransfer(msg.sender, netAmount);

        emit Withdrawn(msg.sender, amount, fee);
    }

    function claimRewards() external nonReentrant {
        _harvestUserRewards(msg.sender);
    }

    function pendingYBOT(address user_) external view returns (uint256) {
        UserInfo storage user = userInfo[user_];
        return user.deposited == 0 ? 0 : (user.deposited * accYBOTPerShare) / 1e18 - user.rewardDebt;
    }

    // ============ Harvest Functions ============
    function harvest() external nonReentrant {
        if (totalDeposited == 0) return;

        uint256 totalYield;
        for (uint256 i = 0; i < adapters.length; i++) {
            totalYield += adapters[i].harvest(address(this));
        }

        if (totalYield == 0) return;

        uint256 performanceFee = (totalYield * performanceFeeBps) / BPS_DENOMINATOR;
        uint256 netYield = totalYield - performanceFee;

        if (performanceFee > 0) depositToken.safeTransfer(feeCollector, performanceFee);

        uint256 ybotToMint = (netYield * ybotRewardRate * (10 ** ybotToken.decimals())) / (10 ** depositTokenDecimals);
        if (ybotToMint > 0) {
            accYBOTPerShare += (ybotToMint * 1e18) / totalDeposited;
            ybotToken.mint(address(this), ybotToMint);
        }

        _distributeToAdapters(netYield);
        lastHarvestTime = block.timestamp;

        emit Harvested(totalYield, performanceFee, ybotToMint);
    }

    function _harvestUserRewards(address user_) internal {
        UserInfo storage user = userInfo[user_];
        if (user.deposited == 0) return;

        uint256 pending = (user.deposited * accYBOTPerShare) / 1e18 - user.rewardDebt;
        if (pending == 0) return;

        uint256 ybotBalance = ybotToken.balanceOf(address(this));
        uint256 toTransfer = pending > ybotBalance ? ybotBalance : pending;

        if (toTransfer > 0) {
            ybotToken.transfer(user_, toTransfer);
            emit YBOTRewarded(user_, toTransfer);
        }

        user.rewardDebt = (user.deposited * accYBOTPerShare) / 1e18;
    }

    // ============ Internal Adapter Functions ============
    function _distributeToAdapters(uint256 amount) internal {
        for (uint256 i = 0; i < adapters.length; i++) {
            uint256 adapterAmount = (amount * allocationBps[i]) / BPS_DENOMINATOR;
            if (adapterAmount > 0) adapters[i].deposit(adapterAmount);
        }
    }

    function _withdrawFromAdapters(uint256 amount) internal {
        for (uint256 i = 0; i < adapters.length; i++) {
            uint256 adapterAmount = (amount * allocationBps[i]) / BPS_DENOMINATOR;
            if (adapterAmount > 0) adapters[i].withdraw(adapterAmount, address(this));
        }
    }

    // ============ View Functions ============
    function totalValueLocked() external view returns (uint256) {
        uint256 total = depositToken.balanceOf(address(this));
        for (uint256 i = 0; i < adapters.length; i++) {
            total += adapters[i].totalUnderlying();
        }
        return total;
    }

    function adapterCount() external view returns (uint256) {
        return adapters.length;
    }

    function getAdapters() external view returns (IYieldAdapter[] memory) {
        return adapters;
    }

    function getAllocations() external view returns (uint256[] memory) {
        return allocationBps;
    }

    function hasYBOTAccess(address user_) external view returns (bool) {
        return ybotToken.balanceOf(user_) >= minYBOTBalance;
    }

    function estimatedAPY() external view returns (uint256) {
        if (adapters.length == 0) return 0;

        uint256 weightedAPY;
        for (uint256 i = 0; i < adapters.length; i++) {
            weightedAPY += adapters[i].estimatedAPY() * allocationBps[i];
        }
        return weightedAPY / BPS_DENOMINATOR;
    }

    // ============ Admin Functions ============
    function addAdapter(IYieldAdapter adapter_, uint256 allocationBps_) external onlyOwner {
        if (adapters.length >= MAX_ADAPTERS) revert TooManyAdapters();
        if (address(adapter_.asset()) != address(depositToken)) revert InvalidAddress();

        bytes32 id = adapter_.adapterId();
        if (adapterIndex[id] != 0) revert InvalidAddress();

        adapters.push(adapter_);
        allocationBps.push(allocationBps_);
        adapterIndex[id] = adapters.length;

        depositToken.forceApprove(address(adapter_), type(uint256).max);
        emit AdapterAdded(id, address(adapter_), allocationBps_);
    }

    function removeAdapter(bytes32 adapterId_) external onlyOwner nonReentrant {
        uint256 idx = adapterIndex[adapterId_];
        if (idx == 0) revert AdapterNotFound();
        idx--;

        adapters[idx].withdrawAll(address(this));
        depositToken.forceApprove(address(adapters[idx]), 0);

        uint256 lastIdx = adapters.length - 1;
        if (idx != lastIdx) {
            adapters[idx] = adapters[lastIdx];
            allocationBps[idx] = allocationBps[lastIdx];
            adapterIndex[adapters[idx].adapterId()] = idx + 1;
        }

        adapters.pop();
        allocationBps.pop();
        delete adapterIndex[adapterId_];

        emit AdapterRemoved(adapterId_);
    }

    function updateAllocations(uint256[] calldata newAllocations) external onlyOwner {
        if (newAllocations.length != adapters.length) revert InvalidAllocation();

        uint256 total;
        for (uint256 i = 0; i < newAllocations.length; i++) {
            total += newAllocations[i];
            allocationBps[i] = newAllocations[i];
        }

        if (total != BPS_DENOMINATOR) revert InvalidAllocation();
        emit AllocationUpdated(newAllocations);
    }

    function rebalance() external onlyOwner nonReentrant {
        for (uint256 i = 0; i < adapters.length; i++) {
            adapters[i].withdrawAll(address(this));
        }

        uint256 balance = depositToken.balanceOf(address(this));
        _distributeToAdapters(balance);
    }

    function setMinYBOTBalance(uint256 newMin) external onlyOwner {
        emit MinYBOTBalanceUpdated(minYBOTBalance, newMin);
        minYBOTBalance = newMin;
    }

    function setYBOTRewardRate(uint256 newRate) external onlyOwner {
        ybotRewardRate = newRate;
    }

    function setFees(uint256 depositBps, uint256 withdrawBps, uint256 performanceBps) external onlyOwner {
        require(depositBps <= 500 && withdrawBps <= 500 && performanceBps <= 2000, "Fee caps exceeded");
        depositFeeBps = depositBps;
        withdrawalFeeBps = withdrawBps;
        performanceFeeBps = performanceBps;
    }

    function setFeeCollector(address collector) external onlyOwner {
        if (collector == address(0)) revert ZeroAddress();
        feeCollector = collector;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdrawAll() external onlyOwner nonReentrant {
        for (uint256 i = 0; i < adapters.length; i++) {
            try adapters[i].withdrawAll(address(this)) {} catch {}
        }
    }
}