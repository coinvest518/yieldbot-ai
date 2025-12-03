// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title YBOTStaking
 * @notice Stake YBOT tokens to earn compounding YBOT rewards
 * @dev Supports multiple lock tiers with different APY rates
 * 
 * Security Features:
 * - Compounding rewards (rewards added to principal on claim)
 * - Early unstake penalty applies to REWARDS only (not principal)
 * - APY capped at 100% to prevent reward pool drain
 * - Penalty bounded (1%-50%)
 * - Pausable for emergencies
 * - Reentrancy protection
 */
contract YBOTStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    
    IERC20 public immutable ybotToken;
    
    // Staking tiers (lock duration => APY in basis points)
    // 10000 = 100% APY
    uint256 public constant TIER_FLEXIBLE = 0;      // No lock
    uint256 public constant TIER_7_DAYS = 7 days;
    uint256 public constant TIER_30_DAYS = 30 days;
    uint256 public constant TIER_90_DAYS = 90 days;
    
    // APY rates in basis points (100 = 1%)
    mapping(uint256 => uint256) public tierAPY;
    
    // Early unstake penalty (basis points) - applied to REWARDS only
    uint256 public earlyUnstakePenalty = 1000; // 10%
    
    // Bounds for APY and penalty
    uint256 public constant MAX_APY = 10000;        // 100% max APY
    uint256 public constant MIN_PENALTY = 100;      // 1% min penalty
    uint256 public constant MAX_PENALTY = 5000;     // 50% max penalty
    
    // Minimum stake amount
    uint256 public minStakeAmount = 10 * 1e18; // 10 YBOT
    
    // Total staked across all users
    uint256 public totalStaked;
    
    // Total rewards distributed
    uint256 public totalRewardsDistributed;
    
    // Reward pool (funded by owner)
    uint256 public rewardPool;
    
    // User stakes - includes compounded rewards in amount
    struct Stake {
        uint256 amount;           // Current staked amount (includes compounded rewards)
        uint256 startTime;        // Original stake start time
        uint256 lockDuration;     // Lock duration
        uint256 lastClaimTime;    // Last reward claim time
        uint256 totalRewardsClaimed; // Total rewards claimed from this stake
        bool active;              // Is stake active
    }
    
    // User address => stake ID => Stake
    mapping(address => mapping(uint256 => Stake)) public userStakes;
    mapping(address => uint256) public userStakeCount;
    mapping(address => uint256) public userTotalStaked;
    
    // ============ Events ============
    
    event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 lockDuration, uint256 apy);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 principalAmount, uint256 rewardAmount, uint256 penaltyAmount, bool wasEarlyUnstake);
    event RewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 rewardAmount, uint256 newStakeAmount);
    event RewardPoolFunded(address indexed funder, uint256 amount);
    event TierAPYUpdated(uint256 indexed tier, uint256 newAPY);
    event EarlyPenaltyUpdated(uint256 newPenalty);
    event MinStakeAmountUpdated(uint256 newMin);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    
    // ============ Errors ============
    
    error InvalidAmount();
    error InvalidTier();
    error StakeNotFound();
    error StakeNotActive();
    error InsufficientRewardPool();
    error TransferFailed();
    error InvalidAPY();
    error InvalidPenalty();
    error NoRewardsToClaim();
    error ExceedsRewardPool();
    
    // ============ Constructor ============
    
    constructor(address _ybotToken, address _owner) Ownable(_owner) {
        require(_ybotToken != address(0), "Invalid token address");
        ybotToken = IERC20(_ybotToken);
        
        // Set default APY rates
        tierAPY[TIER_FLEXIBLE] = 500;   // 5% APY - No lock
        tierAPY[TIER_7_DAYS] = 1200;    // 12% APY - 7 day lock
        tierAPY[TIER_30_DAYS] = 2500;   // 25% APY - 30 day lock
        tierAPY[TIER_90_DAYS] = 5000;   // 50% APY - 90 day lock
    }
    
    // ============ Staking Functions ============
    
    /**
     * @notice Stake YBOT tokens
     * @param amount Amount of YBOT to stake
     * @param lockDuration Lock duration (0, 7 days, 30 days, or 90 days)
     */
    function stake(uint256 amount, uint256 lockDuration) external nonReentrant whenNotPaused {
        if (amount < minStakeAmount) revert InvalidAmount();
        if (!isValidTier(lockDuration)) revert InvalidTier();
        
        // Transfer tokens from user
        ybotToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create stake
        uint256 stakeId = userStakeCount[msg.sender];
        uint256 apy = tierAPY[lockDuration];
        
        userStakes[msg.sender][stakeId] = Stake({
            amount: amount,
            startTime: block.timestamp,
            lockDuration: lockDuration,
            lastClaimTime: block.timestamp,
            totalRewardsClaimed: 0,
            active: true
        });
        
        userStakeCount[msg.sender]++;
        userTotalStaked[msg.sender] += amount;
        totalStaked += amount;
        
        emit Staked(msg.sender, stakeId, amount, lockDuration, apy);
    }
    
    /**
     * @notice Unstake tokens and claim all accumulated rewards
     * @param stakeId The stake ID to unstake
     */
    function unstake(uint256 stakeId) external nonReentrant whenNotPaused {
        // Bounds check - prevent accessing non-existent stakes
        if (stakeId >= userStakeCount[msg.sender]) revert StakeNotFound();
        
        Stake storage userStake = userStakes[msg.sender][stakeId];
        if (!userStake.active) revert StakeNotActive();
        
        uint256 principalAmount = userStake.amount;
        uint256 reward = calculateReward(msg.sender, stakeId);
        uint256 penalty = 0;
        
        // Check if early unstake (before lock period ends)
        bool isEarly = block.timestamp < userStake.startTime + userStake.lockDuration;
        
        if (isEarly && userStake.lockDuration > 0) {
            // Apply early unstake penalty to REWARDS only (not principal)
            // User still gets their principal back, just reduced rewards
            penalty = (reward * earlyUnstakePenalty) / 10000;
            reward -= penalty;
        }
        
        // Cap reward at available pool
        if (reward > rewardPool) {
            reward = rewardPool;
        }
        
        // Update state BEFORE transfers (CEI pattern)
        userStake.active = false;
        userTotalStaked[msg.sender] -= principalAmount;
        totalStaked -= principalAmount;
        
        if (reward > 0) {
            rewardPool -= reward;
            userStake.totalRewardsClaimed += reward;
            totalRewardsDistributed += reward;
        }
        
        // Penalty goes back to reward pool
        if (penalty > 0) {
            rewardPool += penalty;
        }
        
        // Transfer principal back to user (always full amount)
        ybotToken.safeTransfer(msg.sender, principalAmount);
        
        // Transfer rewards (if any)
        if (reward > 0) {
            ybotToken.safeTransfer(msg.sender, reward);
        }
        
        emit Unstaked(msg.sender, stakeId, principalAmount, reward, penalty, isEarly);
    }
    
    /**
     * @notice Claim rewards and compound them into stake
     * @dev Rewards are added to stake amount for compounding effect
     * @param stakeId The stake ID to claim rewards from
     */
    function claimRewards(uint256 stakeId) external nonReentrant whenNotPaused {
        // Bounds check
        if (stakeId >= userStakeCount[msg.sender]) revert StakeNotFound();
        
        Stake storage userStake = userStakes[msg.sender][stakeId];
        if (!userStake.active) revert StakeNotActive();
        
        uint256 reward = calculateReward(msg.sender, stakeId);
        if (reward == 0) revert NoRewardsToClaim();
        if (reward > rewardPool) revert ExceedsRewardPool();
        
        // COMPOUNDING: Add rewards to stake amount
        // This means future rewards are calculated on (principal + previous rewards)
        userStake.amount += reward;
        userStake.lastClaimTime = block.timestamp;
        userStake.totalRewardsClaimed += reward;
        
        // Update totals
        userTotalStaked[msg.sender] += reward;
        totalStaked += reward;
        rewardPool -= reward;
        totalRewardsDistributed += reward;
        
        // Transfer rewards to user
        ybotToken.safeTransfer(msg.sender, reward);
        
        emit RewardsClaimed(msg.sender, stakeId, reward, userStake.amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Calculate pending rewards for a stake
     * @dev Uses compounded amount (includes previously claimed rewards)
     */
    function calculateReward(address user, uint256 stakeId) public view returns (uint256) {
        if (stakeId >= userStakeCount[user]) return 0;
        
        Stake memory userStake = userStakes[user][stakeId];
        if (!userStake.active) return 0;
        
        uint256 stakingDuration = block.timestamp - userStake.lastClaimTime;
        uint256 apy = tierAPY[userStake.lockDuration];
        
        // reward = (compounded_amount * APY * duration) / (365 days * 10000)
        // userStake.amount includes previously compounded rewards
        uint256 reward = (userStake.amount * apy * stakingDuration) / (365 days * 10000);
        
        return reward;
    }
    
    /**
     * @notice Get all stakes for a user
     */
    function getUserStakes(address user) external view returns (
        uint256[] memory ids,
        uint256[] memory amounts,
        uint256[] memory startTimes,
        uint256[] memory lockDurations,
        uint256[] memory pendingRewards,
        uint256[] memory totalRewardsClaimed,
        bool[] memory activeStatus
    ) {
        uint256 count = userStakeCount[user];
        
        ids = new uint256[](count);
        amounts = new uint256[](count);
        startTimes = new uint256[](count);
        lockDurations = new uint256[](count);
        pendingRewards = new uint256[](count);
        totalRewardsClaimed = new uint256[](count);
        activeStatus = new bool[](count);
        
        for (uint256 i = 0; i < count; i++) {
            Stake memory s = userStakes[user][i];
            ids[i] = i;
            amounts[i] = s.amount;
            startTimes[i] = s.startTime;
            lockDurations[i] = s.lockDuration;
            pendingRewards[i] = calculateReward(user, i);
            totalRewardsClaimed[i] = s.totalRewardsClaimed;
            activeStatus[i] = s.active;
        }
    }
    
    /**
     * @notice Get staking stats
     */
    function getStakingStats() external view returns (
        uint256 _totalStaked,
        uint256 _rewardPool,
        uint256 _totalRewardsDistributed,
        uint256 _flexibleAPY,
        uint256 _7dayAPY,
        uint256 _30dayAPY,
        uint256 _90dayAPY
    ) {
        return (
            totalStaked,
            rewardPool,
            totalRewardsDistributed,
            tierAPY[TIER_FLEXIBLE],
            tierAPY[TIER_7_DAYS],
            tierAPY[TIER_30_DAYS],
            tierAPY[TIER_90_DAYS]
        );
    }
    
    /**
     * @notice Check if lock duration is valid
     */
    function isValidTier(uint256 duration) public pure returns (bool) {
        return duration == TIER_FLEXIBLE || 
               duration == TIER_7_DAYS || 
               duration == TIER_30_DAYS || 
               duration == TIER_90_DAYS;
    }
    
    /**
     * @notice Get time remaining until unlock
     */
    function getTimeUntilUnlock(address user, uint256 stakeId) external view returns (uint256) {
        if (stakeId >= userStakeCount[user]) return 0;
        
        Stake memory userStake = userStakes[user][stakeId];
        if (!userStake.active) return 0;
        
        uint256 unlockTime = userStake.startTime + userStake.lockDuration;
        if (block.timestamp >= unlockTime) return 0;
        
        return unlockTime - block.timestamp;
    }
    
    /**
     * @notice Get user's total active stake
     */
    function getUserTotalStaked(address user) external view returns (uint256) {
        return userTotalStaked[user];
    }
    
    /**
     * @notice Get user's stake count
     */
    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakeCount[user];
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Fund the reward pool
     * @param amount Amount to add to reward pool
     */
    function fundRewardPool(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        ybotToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(msg.sender, amount);
    }
    
    /**
     * @notice Update APY for a tier (only owner)
     * @param tier Tier constant (TIER_FLEXIBLE, TIER_7_DAYS, etc.)
     * @param newAPY New APY in basis points (max 10000 = 100%)
     */
    function setTierAPY(uint256 tier, uint256 newAPY) external onlyOwner {
        if (!isValidTier(tier)) revert InvalidTier();
        if (newAPY > MAX_APY) revert InvalidAPY();
        
        tierAPY[tier] = newAPY;
        emit TierAPYUpdated(tier, newAPY);
    }
    
    /**
     * @notice Update early unstake penalty (only owner)
     * @param newPenalty New penalty in basis points (100-5000 = 1%-50%)
     */
    function setEarlyUnstakePenalty(uint256 newPenalty) external onlyOwner {
        if (newPenalty < MIN_PENALTY || newPenalty > MAX_PENALTY) revert InvalidPenalty();
        
        earlyUnstakePenalty = newPenalty;
        emit EarlyPenaltyUpdated(newPenalty);
    }
    
    /**
     * @notice Update minimum stake amount (only owner)
     * @param newMin New minimum stake amount
     */
    function setMinStakeAmount(uint256 newMin) external onlyOwner {
        if (newMin == 0) revert InvalidAmount();
        
        minStakeAmount = newMin;
        emit MinStakeAmountUpdated(newMin);
    }
    
    /**
     * @notice Pause contract in case of emergency
     */
    function pauseContract() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }
    
    /**
     * @notice Unpause contract
     */
    function unpauseContract() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }
    
    /**
     * @notice Emergency withdraw from reward pool (only owner)
     * @param amount Amount to withdraw
     */
    function emergencyWithdrawRewards(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (amount > rewardPool) revert ExceedsRewardPool();
        
        rewardPool -= amount;
        ybotToken.safeTransfer(owner(), amount);
        
        emit EmergencyWithdraw(owner(), amount);
    }
}
