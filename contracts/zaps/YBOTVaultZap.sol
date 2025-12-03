// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YBOTVaultZap
 * @notice Zap contract allowing users to deposit ANY token and have it automatically:
 *         1. Swapped to required tokens (e.g., USDT for Venus)
 *         2. Or split 50/50 for LP positions
 *         3. Deposited into the vault
 *         All in a single transaction!
 * 
 * @dev This implements the "Zap In" pattern used by Beefy Finance and others
 */

// ==================== INTERFACES ====================

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

interface IYBOTYieldVault {
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256);
    function asset() external view returns (address);
    function previewDeposit(uint256 assets) external view returns (uint256);
}

interface IPancakeRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
    
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
    
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
}

interface IPancakeFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

interface IPancakePair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

/**
 * @title YBOTVaultZap
 * @notice One-click deposits into YBOT Yield Vault from ANY token
 */
contract YBOTVaultZap is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ==================== STATE ====================
    
    IPancakeRouter public immutable router;
    address public immutable WBNB;
    IYBOTYieldVault public vault;
    
    uint256 public constant MINIMUM_AMOUNT = 1000; // Minimum input to prevent dust
    uint256 public constant SLIPPAGE_DENOMINATOR = 10000;
    uint256 public defaultSlippage = 50; // 0.5% default slippage
    
    // Supported input tokens for direct swaps
    mapping(address => bool) public supportedTokens;
    
    // Custom swap paths for tokens
    mapping(address => address[]) public customPaths;

    // ==================== EVENTS ====================
    
    event ZapIn(
        address indexed user,
        address indexed inputToken,
        uint256 inputAmount,
        uint256 vaultSharesReceived
    );
    
    event ZapOut(
        address indexed user,
        address indexed outputToken,
        uint256 sharesRedeemed,
        uint256 outputAmount
    );
    
    event ZapIntoLP(
        address indexed user,
        address indexed inputToken,
        address lpToken,
        uint256 inputAmount,
        uint256 lpReceived
    );

    // ==================== CONSTRUCTOR ====================
    
    constructor(
        address _router,
        address _vault
    ) Ownable(msg.sender) {
        router = IPancakeRouter(_router);
        WBNB = router.WETH();
        vault = IYBOTYieldVault(_vault);
        
        // Pre-approve vault asset to vault
        address asset = vault.asset();
        IERC20(asset).approve(address(vault), type(uint256).max);
    }

    // ==================== ZAP IN FUNCTIONS ====================

    /**
     * @notice Zap in with native BNB
     * @param minVaultShares Minimum shares to receive (slippage protection)
     */
    function zapInBNB(uint256 minVaultShares) external payable nonReentrant {
        require(msg.value >= MINIMUM_AMOUNT, "Amount too small");
        
        // Wrap BNB to WBNB
        IWETH(WBNB).deposit{value: msg.value}();
        
        // Swap and deposit
        uint256 shares = _swapAndDeposit(WBNB, msg.value, minVaultShares);
        
        emit ZapIn(msg.sender, address(0), msg.value, shares);
    }

    /**
     * @notice Zap in with any ERC20 token
     * @param inputToken Token to deposit
     * @param inputAmount Amount of token to deposit
     * @param minVaultShares Minimum shares to receive (slippage protection)
     */
    function zapIn(
        address inputToken,
        uint256 inputAmount,
        uint256 minVaultShares
    ) external nonReentrant {
        require(inputAmount >= MINIMUM_AMOUNT, "Amount too small");
        
        // Transfer tokens from user
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);
        
        // Swap and deposit
        uint256 shares = _swapAndDeposit(inputToken, inputAmount, minVaultShares);
        
        emit ZapIn(msg.sender, inputToken, inputAmount, shares);
    }

    /**
     * @notice Zap in with custom swap path
     * @param inputToken Token to deposit
     * @param inputAmount Amount of token
     * @param path Custom swap path (must end with vault asset)
     * @param minVaultShares Minimum shares to receive
     */
    function zapInWithPath(
        address inputToken,
        uint256 inputAmount,
        address[] calldata path,
        uint256 minVaultShares
    ) external nonReentrant {
        require(inputAmount >= MINIMUM_AMOUNT, "Amount too small");
        require(path[path.length - 1] == vault.asset(), "Path must end with vault asset");
        
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);
        
        // Approve router
        _approveIfNeeded(inputToken, address(router), inputAmount);
        
        // Swap using provided path
        uint256[] memory amounts = router.swapExactTokensForTokens(
            inputAmount,
            0, // Will check min shares later
            path,
            address(this),
            block.timestamp
        );
        
        uint256 assetAmount = amounts[amounts.length - 1];
        
        // Deposit to vault
        uint256 shares = vault.deposit(assetAmount, msg.sender);
        require(shares >= minVaultShares, "Slippage too high");
        
        emit ZapIn(msg.sender, inputToken, inputAmount, shares);
    }

    // ==================== ZAP INTO LP ====================

    /**
     * @notice Zap any token into an LP position
     * @dev Splits input 50/50, swaps to both LP tokens, adds liquidity
     * @param inputToken Token to use
     * @param inputAmount Amount of input token
     * @param lpToken Target LP pair address
     * @param minLPTokens Minimum LP tokens to receive
     */
    function zapIntoLP(
        address inputToken,
        uint256 inputAmount,
        address lpToken,
        uint256 minLPTokens
    ) external nonReentrant returns (uint256 lpReceived) {
        require(inputAmount >= MINIMUM_AMOUNT, "Amount too small");
        
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);
        
        lpReceived = _zapIntoLP(inputToken, inputAmount, lpToken);
        require(lpReceived >= minLPTokens, "Slippage too high");
        
        // Transfer LP tokens to user
        IERC20(lpToken).safeTransfer(msg.sender, lpReceived);
        
        emit ZapIntoLP(msg.sender, inputToken, lpToken, inputAmount, lpReceived);
    }

    /**
     * @notice Zap BNB into an LP position
     */
    function zapIntoLPBNB(
        address lpToken,
        uint256 minLPTokens
    ) external payable nonReentrant returns (uint256 lpReceived) {
        require(msg.value >= MINIMUM_AMOUNT, "Amount too small");
        
        // Wrap BNB
        IWETH(WBNB).deposit{value: msg.value}();
        
        lpReceived = _zapIntoLP(WBNB, msg.value, lpToken);
        require(lpReceived >= minLPTokens, "Slippage too high");
        
        IERC20(lpToken).safeTransfer(msg.sender, lpReceived);
        
        emit ZapIntoLP(msg.sender, address(0), lpToken, msg.value, lpReceived);
    }

    // ==================== ZAP OUT FUNCTIONS ====================

    /**
     * @notice Zap out vault shares to any token
     * @param shares Vault shares to redeem
     * @param outputToken Desired output token
     * @param minOutput Minimum output amount
     */
    function zapOut(
        uint256 shares,
        address outputToken,
        uint256 minOutput
    ) external nonReentrant returns (uint256 outputAmount) {
        // Transfer vault shares from user
        IERC20(address(vault)).safeTransferFrom(msg.sender, address(this), shares);
        
        // Withdraw from vault
        address asset = vault.asset();
        uint256 assetAmount = vault.withdraw(shares, address(this), address(this));
        
        // If output is the vault asset, just transfer
        if (outputToken == asset) {
            outputAmount = assetAmount;
        } else {
            // Swap to desired token
            outputAmount = _swap(asset, outputToken, assetAmount);
        }
        
        require(outputAmount >= minOutput, "Slippage too high");
        
        // Transfer to user
        if (outputToken == address(0)) {
            // Unwrap to BNB
            IWETH(WBNB).withdraw(outputAmount);
            (bool success, ) = msg.sender.call{value: outputAmount}("");
            require(success, "BNB transfer failed");
        } else {
            IERC20(outputToken).safeTransfer(msg.sender, outputAmount);
        }
        
        emit ZapOut(msg.sender, outputToken, shares, outputAmount);
    }

    // ==================== INTERNAL FUNCTIONS ====================

    /**
     * @notice Swap input token to vault asset and deposit
     */
    function _swapAndDeposit(
        address inputToken,
        uint256 inputAmount,
        uint256 minShares
    ) internal returns (uint256 shares) {
        address asset = vault.asset();
        uint256 assetAmount;
        
        if (inputToken == asset) {
            // No swap needed
            assetAmount = inputAmount;
        } else {
            // Swap to vault asset
            assetAmount = _swap(inputToken, asset, inputAmount);
        }
        
        // Deposit to vault
        shares = vault.deposit(assetAmount, msg.sender);
        require(shares >= minShares, "Slippage too high");
    }

    /**
     * @notice Internal swap function
     */
    function _swap(
        address from,
        address to,
        uint256 amount
    ) internal returns (uint256 outputAmount) {
        if (from == to) return amount;
        
        // Approve router
        _approveIfNeeded(from, address(router), amount);
        
        // Build swap path
        address[] memory path = _getSwapPath(from, to);
        
        // Calculate minimum output with slippage
        uint256[] memory amountsOut = router.getAmountsOut(amount, path);
        uint256 expectedOut = amountsOut[amountsOut.length - 1];
        uint256 minOut = expectedOut * (SLIPPAGE_DENOMINATOR - defaultSlippage) / SLIPPAGE_DENOMINATOR;
        
        // Execute swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amount,
            minOut,
            path,
            address(this),
            block.timestamp
        );
        
        outputAmount = amounts[amounts.length - 1];
    }

    /**
     * @notice Internal function to zap into LP
     */
    function _zapIntoLP(
        address inputToken,
        uint256 inputAmount,
        address lpToken
    ) internal returns (uint256 lpReceived) {
        IPancakePair pair = IPancakePair(lpToken);
        address token0 = pair.token0();
        address token1 = pair.token1();
        
        // Split input 50/50
        uint256 halfInput = inputAmount / 2;
        
        // Swap first half to token0 (if needed)
        uint256 amount0;
        if (inputToken == token0) {
            amount0 = halfInput;
        } else {
            amount0 = _swap(inputToken, token0, halfInput);
        }
        
        // Swap second half to token1 (if needed)
        uint256 amount1;
        if (inputToken == token1) {
            amount1 = inputAmount - halfInput; // Use remaining to avoid dust
        } else {
            amount1 = _swap(inputToken, token1, inputAmount - halfInput);
        }
        
        // Approve tokens for router
        _approveIfNeeded(token0, address(router), amount0);
        _approveIfNeeded(token1, address(router), amount1);
        
        // Add liquidity
        (,, lpReceived) = router.addLiquidity(
            token0,
            token1,
            amount0,
            amount1,
            1, // Accept any amount (slippage checked at end)
            1,
            address(this),
            block.timestamp
        );
        
        // Return any leftover tokens to user
        _returnLeftovers(token0);
        _returnLeftovers(token1);
    }

    /**
     * @notice Get optimal swap path between two tokens
     */
    function _getSwapPath(address from, address to) internal view returns (address[] memory path) {
        // Check for custom path first
        if (customPaths[from].length > 0 && customPaths[from][customPaths[from].length - 1] == to) {
            return customPaths[from];
        }
        
        // Check if direct pair exists
        address factory = router.factory();
        address directPair = IPancakeFactory(factory).getPair(from, to);
        
        if (directPair != address(0)) {
            // Direct swap
            path = new address[](2);
            path[0] = from;
            path[1] = to;
        } else {
            // Route through WBNB
            path = new address[](3);
            path[0] = from;
            path[1] = WBNB;
            path[2] = to;
        }
    }

    /**
     * @notice Approve token if needed
     */
    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        if (IERC20(token).allowance(address(this), spender) < amount) {
            IERC20(token).approve(spender, type(uint256).max);
        }
    }

    /**
     * @notice Return any leftover tokens to sender
     */
    function _returnLeftovers(address token) internal {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(msg.sender, balance);
        }
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Preview how many vault shares you'd get for an input amount
     * @param inputToken Token to deposit
     * @param inputAmount Amount to deposit
     */
    function previewZapIn(
        address inputToken,
        uint256 inputAmount
    ) external view returns (uint256 expectedShares) {
        address asset = vault.asset();
        
        if (inputToken == asset) {
            return vault.previewDeposit(inputAmount);
        }
        
        // Get swap path
        address[] memory path = _getSwapPath(inputToken, asset);
        
        // Get expected output
        uint256[] memory amountsOut = router.getAmountsOut(inputAmount, path);
        uint256 assetAmount = amountsOut[amountsOut.length - 1];
        
        // Apply slippage
        assetAmount = assetAmount * (SLIPPAGE_DENOMINATOR - defaultSlippage) / SLIPPAGE_DENOMINATOR;
        
        // Preview vault deposit
        expectedShares = vault.previewDeposit(assetAmount);
    }

    /**
     * @notice Get the vault's underlying asset
     */
    function getVaultAsset() external view returns (address) {
        return vault.asset();
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Set custom swap path for a token
     */
    function setCustomPath(address token, address[] calldata path) external onlyOwner {
        customPaths[token] = path;
    }

    /**
     * @notice Set default slippage (in basis points, e.g., 50 = 0.5%)
     */
    function setDefaultSlippage(uint256 _slippage) external onlyOwner {
        require(_slippage <= 1000, "Slippage too high"); // Max 10%
        defaultSlippage = _slippage;
    }

    /**
     * @notice Update vault address
     */
    function setVault(address _vault) external onlyOwner {
        vault = IYBOTYieldVault(_vault);
        address asset = vault.asset();
        IERC20(asset).approve(address(vault), type(uint256).max);
    }

    /**
     * @notice Rescue stuck tokens
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Rescue stuck BNB
     */
    function rescueBNB() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "BNB transfer failed");
    }

    // Allow receiving BNB
    receive() external payable {}
}
