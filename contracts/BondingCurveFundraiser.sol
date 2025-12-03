// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title BondingCurveFundraiser
 * @notice Linear bonding curve token sale with proper integral-based pricing
 * @dev Uses area under the curve formula: Cost = integral of P(s) from s0 to s1
 *      For linear curve P(s) = a*s + b, integral = a*(s1²-s0²)/2 + b*(s1-s0)
 * 
 * Security Features:
 * - Proper bonding curve math using integration
 * - Slippage protection on all trades
 * - Chainlink oracle staleness checks
 * - Reentrancy protection
 * - Pausable for emergencies
 * - Fee caps to prevent abuse
 */
contract BondingCurveFundraiser is Ownable, ReentrancyGuard, Pausable {
    
    // ============ Token Setup ============
    IERC20 public immutable projectToken;
    IERC20 public immutable usdc;
    uint8 public immutable usdcDecimals;
    uint8 public immutable projectTokenDecimals;
    
    // ============ Price Feeds (Chainlink) ============
    AggregatorV3Interface public immutable bnbPriceFeed;
    uint256 public constant ORACLE_STALENESS_THRESHOLD = 1 hours;
    
    // ============ Bonding Curve Parameters ============
    // Price formula: P(s) = SLOPE * s + BASE_PRICE
    // Where s = totalTokensSold (in whole tokens, scaled)
    uint256 public constant BASE_PRICE = 1e14;      // $0.0001 starting price (scaled to 18 decimals)
    uint256 public constant SLOPE = 1e10;           // Price increase per token sold
    uint256 public constant PRECISION = 1e18;       // 18 decimal precision
    uint256 public constant MAX_FEE_BPS = 1000;     // 10% max fee cap
    
    // ============ Contract State ============
    uint256 public totalTokensSold;        // In token wei (18 decimals)
    uint256 public totalUsdRaised;         // In USDC units (6 decimals)
    uint256 public totalFeesCollected;     // In USDC units (6 decimals)
    uint256 public buyFeeBps = 300;        // 3% buy fee
    uint256 public sellFeeBps = 300;       // 3% sell fee
    
    // ============ Tracking ============
    mapping(address => uint256) public userTokenBalance;
    mapping(address => uint256) public userUsdContributed;
    
    // ============ Events ============
    event TokensPurchased(
        address indexed buyer, 
        uint256 usdAmount, 
        uint256 tokensMinted, 
        uint256 avgPricePerToken,
        uint256 fee
    );
    event TokensSold(
        address indexed seller, 
        uint256 tokenAmount, 
        uint256 usdReceived, 
        uint256 avgPricePerToken,
        uint256 fee
    );
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    event FeesUpdated(uint256 buyFeeBps, uint256 sellFeeBps);
    
    // ============ Errors ============
    error ZeroAmount();
    error InsufficientBalance();
    error SlippageExceeded();
    error TransferFailed();
    error StaleOraclePrice();
    error InvalidOraclePrice();
    error FeeTooHigh();
    error InsufficientLiquidity();
    
    // ============ Constructor ============
    constructor(
        address _projectToken,
        address _usdc,
        address _bnbPriceFeed
    ) Ownable(msg.sender) {
        projectToken = IERC20(_projectToken);
        usdc = IERC20(_usdc);
        bnbPriceFeed = AggregatorV3Interface(_bnbPriceFeed);
        
        // Cache decimals for gas efficiency
        usdcDecimals = IERC20Metadata(_usdc).decimals();
        projectTokenDecimals = IERC20Metadata(_projectToken).decimals();
    }
    
    // ============ Bonding Curve Math ============
    
    /**
     * @notice Get current spot price per token in USD (18 decimals)
     * @dev P(s) = SLOPE * s + BASE_PRICE
     */
    function getCurrentPricePerToken() public view returns (uint256) {
        // s is in 18 decimals, we need to scale properly
        return BASE_PRICE + (totalTokensSold * SLOPE) / PRECISION;
    }
    
    /**
     * @notice Calculate cost to buy `tokenAmount` tokens using integral
     * @dev Cost = ∫P(s)ds from s0 to s1 = SLOPE*(s1²-s0²)/2 + BASE_PRICE*(s1-s0)
     * @param tokenAmount Amount of tokens to buy (in token wei)
     * @return cost Total cost in USD (18 decimals)
     */
    function calculatePurchaseCost(uint256 tokenAmount) public view returns (uint256 cost) {
        uint256 s0 = totalTokensSold;
        uint256 s1 = s0 + tokenAmount;
        
        // Area under linear curve: (SLOPE/2) * (s1² - s0²) + BASE_PRICE * (s1 - s0)
        // Simplify: (SLOPE/2) * (s1 + s0) * (s1 - s0) + BASE_PRICE * (s1 - s0)
        // Factor: (s1 - s0) * [(SLOPE/2) * (s1 + s0) + BASE_PRICE]
        
        uint256 deltaS = tokenAmount;
        uint256 avgPrice = (getCurrentPricePerToken() + getPriceAtSupply(s1)) / 2;
        
        cost = (deltaS * avgPrice) / PRECISION;
    }
    
    /**
     * @notice Calculate USD received for selling `tokenAmount` tokens
     * @param tokenAmount Amount of tokens to sell (in token wei)
     * @return proceeds Total proceeds in USD (18 decimals)
     */
    function calculateSaleProceeds(uint256 tokenAmount) public view returns (uint256 proceeds) {
        if (tokenAmount > totalTokensSold) revert InsufficientLiquidity();
        
        uint256 s0 = totalTokensSold;
        uint256 s1 = s0 - tokenAmount;
        
        // Same integral formula, but going backwards
        uint256 deltaS = tokenAmount;
        uint256 avgPrice = (getCurrentPricePerToken() + getPriceAtSupply(s1)) / 2;
        
        proceeds = (deltaS * avgPrice) / PRECISION;
    }
    
    /**
     * @notice Get price at a specific supply level
     * @param supply The supply level to check
     * @return price Price in USD (18 decimals)
     */
    function getPriceAtSupply(uint256 supply) public pure returns (uint256 price) {
        return BASE_PRICE + (supply * SLOPE) / PRECISION;
    }
    
    /**
     * @notice Calculate tokens receivable for a given USD amount
     * @param usdAmount Amount of USD (18 decimals)
     * @return tokenAmount Tokens to receive (in token wei)
     */
    function calculateTokensForUsd(uint256 usdAmount) public view returns (uint256 tokenAmount) {
        // Solve: cost = (SLOPE/2) * (s1² - s0²) + BASE_PRICE * (s1 - s0) for s1
        // This is a quadratic equation: (SLOPE/2)*s1² + BASE_PRICE*s1 - [cost + (SLOPE/2)*s0² + BASE_PRICE*s0] = 0
        
        uint256 s0 = totalTokensSold;
        uint256 a = SLOPE / 2;
        uint256 b = BASE_PRICE;
        uint256 c = usdAmount * PRECISION + a * s0 * s0 / PRECISION + b * s0;
        
        // Quadratic formula: s1 = (-b + sqrt(b² + 4ac)) / (2a)
        // Since a, b, c are all positive and we want s1 > s0, we use the positive root
        uint256 discriminant = b * b + 4 * a * c / PRECISION;
        uint256 sqrtDisc = sqrt(discriminant);
        
        uint256 s1 = (sqrtDisc - b) * PRECISION / (2 * a);
        
        if (s1 > s0) {
            tokenAmount = s1 - s0;
        }
    }
    
    // ============ Price Feeds ============
    
    /**
     * @notice Get BNB price in USD from Chainlink with staleness check
     * @return price BNB/USD price (18 decimals)
     */
    function getBnbPriceUsd() public view returns (uint256 price) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = bnbPriceFeed.latestRoundData();
        
        if (answer <= 0) revert InvalidOraclePrice();
        if (updatedAt < block.timestamp - ORACLE_STALENESS_THRESHOLD) revert StaleOraclePrice();
        if (answeredInRound < roundId) revert StaleOraclePrice();
        
        // Chainlink BNB/USD has 8 decimals, convert to 18
        price = uint256(answer) * 1e10;
    }
    
    /**
     * @notice Convert USD amount (18 decimals) to USDC units (6 decimals)
     */
    function toUsdcUnits(uint256 usdAmount18) internal view returns (uint256) {
        return usdAmount18 / (10 ** (18 - usdcDecimals));
    }
    
    /**
     * @notice Convert USDC units (6 decimals) to USD amount (18 decimals)
     */
    function fromUsdcUnits(uint256 usdcAmount) internal view returns (uint256) {
        return usdcAmount * (10 ** (18 - usdcDecimals));
    }
    
    // ============ Purchase Functions ============
    
    /**
     * @notice Buy tokens with USDC
     * @param usdcAmount Amount of USDC to spend
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     */
    function buyWithUsdc(uint256 usdcAmount, uint256 minTokensOut) external nonReentrant whenNotPaused {
        if (usdcAmount == 0) revert ZeroAmount();
        
        // Convert USDC to 18 decimal USD
        uint256 usdAmount = fromUsdcUnits(usdcAmount);
        
        // Calculate fee
        uint256 feeUsd = (usdAmount * buyFeeBps) / 10000;
        uint256 investedUsd = usdAmount - feeUsd;
        
        // Calculate tokens using integral math
        uint256 tokensMint = calculateTokensForUsd(investedUsd);
        
        if (tokensMint < minTokensOut) revert SlippageExceeded();
        if (tokensMint == 0) revert ZeroAmount();
        
        // Check contract has enough tokens
        if (projectToken.balanceOf(address(this)) < tokensMint) revert InsufficientLiquidity();
        
        // Transfer USDC from user
        if (!usdc.transferFrom(msg.sender, address(this), usdcAmount)) revert TransferFailed();
        
        // Update state BEFORE transfers (CEI pattern)
        totalTokensSold += tokensMint;
        totalUsdRaised += toUsdcUnits(investedUsd);
        totalFeesCollected += toUsdcUnits(feeUsd);
        userTokenBalance[msg.sender] += tokensMint;
        userUsdContributed[msg.sender] += usdcAmount;
        
        // Transfer tokens to user
        if (!projectToken.transfer(msg.sender, tokensMint)) revert TransferFailed();
        
        uint256 avgPrice = investedUsd * PRECISION / tokensMint;
        emit TokensPurchased(msg.sender, usdcAmount, tokensMint, avgPrice, toUsdcUnits(feeUsd));
    }
    
    /**
     * @notice Buy tokens with BNB
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     */
    function buyWithBnb(uint256 minTokensOut) external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        
        // Convert BNB to USD (18 decimals)
        uint256 bnbPrice = getBnbPriceUsd();
        uint256 usdAmount = (msg.value * bnbPrice) / PRECISION;
        
        // Calculate fee
        uint256 feeUsd = (usdAmount * buyFeeBps) / 10000;
        uint256 investedUsd = usdAmount - feeUsd;
        
        // Calculate tokens using integral math
        uint256 tokensMint = calculateTokensForUsd(investedUsd);
        
        if (tokensMint < minTokensOut) revert SlippageExceeded();
        if (tokensMint == 0) revert ZeroAmount();
        
        // Check contract has enough tokens
        if (projectToken.balanceOf(address(this)) < tokensMint) revert InsufficientLiquidity();
        
        // Update state BEFORE transfers (CEI pattern)
        totalTokensSold += tokensMint;
        totalUsdRaised += toUsdcUnits(investedUsd);
        totalFeesCollected += toUsdcUnits(feeUsd);
        userTokenBalance[msg.sender] += tokensMint;
        userUsdContributed[msg.sender] += toUsdcUnits(usdAmount);
        
        // Transfer tokens to user
        if (!projectToken.transfer(msg.sender, tokensMint)) revert TransferFailed();
        
        uint256 avgPrice = investedUsd * PRECISION / tokensMint;
        emit TokensPurchased(msg.sender, toUsdcUnits(usdAmount), tokensMint, avgPrice, toUsdcUnits(feeUsd));
    }
    
    // ============ Sell Function ============
    
    /**
     * @notice Sell tokens back to contract for USDC
     * @param tokenAmount Amount of tokens to sell
     * @param minUsdcOut Minimum USDC to receive (slippage protection)
     */
    function sellTokens(uint256 tokenAmount, uint256 minUsdcOut) external nonReentrant whenNotPaused {
        if (tokenAmount == 0) revert ZeroAmount();
        if (tokenAmount > totalTokensSold) revert InsufficientLiquidity();
        if (projectToken.balanceOf(msg.sender) < tokenAmount) revert InsufficientBalance();
        
        // Calculate proceeds using integral math
        uint256 grossProceeds = calculateSaleProceeds(tokenAmount);
        
        // Calculate fee
        uint256 feeUsd = (grossProceeds * sellFeeBps) / 10000;
        uint256 netProceeds = grossProceeds - feeUsd;
        uint256 usdcToReceive = toUsdcUnits(netProceeds);
        
        if (usdcToReceive < minUsdcOut) revert SlippageExceeded();
        if (usdc.balanceOf(address(this)) < usdcToReceive) revert InsufficientLiquidity();
        
        // Transfer tokens from user FIRST (CEI pattern)
        if (!projectToken.transferFrom(msg.sender, address(this), tokenAmount)) revert TransferFailed();
        
        // Update state
        totalTokensSold -= tokenAmount;
        if (userTokenBalance[msg.sender] >= tokenAmount) {
            userTokenBalance[msg.sender] -= tokenAmount;
        }
        totalFeesCollected += toUsdcUnits(feeUsd);
        
        // Transfer USDC to user
        if (!usdc.transfer(msg.sender, usdcToReceive)) revert TransferFailed();
        
        uint256 avgPrice = grossProceeds * PRECISION / tokenAmount;
        emit TokensSold(msg.sender, tokenAmount, usdcToReceive, avgPrice, toUsdcUnits(feeUsd));
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update buy and sell fees
     * @param _buyFeeBps New buy fee in basis points
     * @param _sellFeeBps New sell fee in basis points
     */
    function setFees(uint256 _buyFeeBps, uint256 _sellFeeBps) external onlyOwner {
        if (_buyFeeBps > MAX_FEE_BPS || _sellFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        buyFeeBps = _buyFeeBps;
        sellFeeBps = _sellFeeBps;
        emit FeesUpdated(_buyFeeBps, _sellFeeBps);
    }
    
    /**
     * @notice Withdraw collected fees (owner only)
     * @param amount Amount of USDC to withdraw
     */
    function withdrawFees(uint256 amount) external onlyOwner nonReentrant {
        if (amount > totalFeesCollected) revert InsufficientBalance();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientBalance();
        
        totalFeesCollected -= amount;
        if (!usdc.transfer(owner(), amount)) revert TransferFailed();
        
        emit FundsWithdrawn(owner(), amount);
    }
    
    /**
     * @notice Withdraw BNB (owner only)
     * @param amount Amount of BNB to withdraw
     */
    function withdrawBnb(uint256 amount) external onlyOwner nonReentrant {
        if (address(this).balance < amount) revert InsufficientBalance();
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit FundsWithdrawn(owner(), amount);
    }
    
    /**
     * @notice Pause contract in case of emergency
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get user's total contribution in USDC
     */
    function getUserContribution(address user) external view returns (uint256) {
        return userUsdContributed[user];
    }
    
    /**
     * @notice Get user's token balance tracked by contract
     */
    function getUserTokenBalance(address user) external view returns (uint256) {
        return userTokenBalance[user];
    }
    
    /**
     * @notice Get contract statistics
     */
    function getStats() external view returns (
        uint256 _totalTokensSold,
        uint256 _totalUsdRaised,
        uint256 _totalFeesCollected,
        uint256 _currentPrice,
        uint256 _bnbPrice
    ) {
        return (
            totalTokensSold,
            totalUsdRaised,
            totalFeesCollected,
            getCurrentPricePerToken(),
            getBnbPriceUsd()
        );
    }
    
    /**
     * @notice Preview buy with USDC
     */
    function previewBuyUsdc(uint256 usdcAmount) external view returns (
        uint256 tokensOut,
        uint256 fee,
        uint256 avgPrice
    ) {
        uint256 usdAmount = fromUsdcUnits(usdcAmount);
        fee = (usdAmount * buyFeeBps) / 10000;
        uint256 investedUsd = usdAmount - fee;
        tokensOut = calculateTokensForUsd(investedUsd);
        avgPrice = tokensOut > 0 ? investedUsd * PRECISION / tokensOut : 0;
        fee = toUsdcUnits(fee);
    }
    
    /**
     * @notice Preview sell tokens
     */
    function previewSell(uint256 tokenAmount) external view returns (
        uint256 usdcOut,
        uint256 fee,
        uint256 avgPrice
    ) {
        if (tokenAmount > totalTokensSold) return (0, 0, 0);
        
        uint256 grossProceeds = calculateSaleProceeds(tokenAmount);
        fee = (grossProceeds * sellFeeBps) / 10000;
        uint256 netProceeds = grossProceeds - fee;
        usdcOut = toUsdcUnits(netProceeds);
        avgPrice = grossProceeds * PRECISION / tokenAmount;
        fee = toUsdcUnits(fee);
    }
    
    // ============ Math Utilities ============
    
    /**
     * @notice Babylonian square root
     * @dev From Uniswap V2
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        if (x <= 3) return 1;
        
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
    
    // ============ Receive Function ============
    receive() external payable {}
}