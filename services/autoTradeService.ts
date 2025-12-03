/**
 * Auto Trade Service - Automated DeFi Trading Execution
 * 
 * This service handles automated trading actions including:
 * - Token swaps on PancakeSwap
 * - LP position management
 * - Take profit / Stop loss execution
 * - Rebalancing between protocols
 * 
 * IMPORTANT: This requires user approval for each transaction (wallet popup)
 * For fully automated (no popup) trading, you need:
 * - Session keys (ERC-4337)
 * - Gelato Web3 Functions
 * - OpenZeppelin Defender
 */

import { ethers } from 'ethers';
import { getEthereumObject } from './web3Service';

// ============ CONTRACT ABIS ============

const PANCAKE_ROUTER_ABI = [
  // Swap
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  // Liquidity
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
  'function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)',
  // View
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function factory() external view returns (address)',
  'function WETH() external view returns (address)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

const VENUS_VTOKEN_ABI = [
  'function mint(uint256 mintAmount) external returns (uint256)',
  'function redeem(uint256 redeemTokens) external returns (uint256)',
  'function redeemUnderlying(uint256 redeemAmount) external returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function balanceOfUnderlying(address owner) external returns (uint256)',
  'function exchangeRateCurrent() external returns (uint256)',
];

// ============ CONTRACT ADDRESSES ============

const ADDRESSES = {
  mainnet: {
    pancakeRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    // Venus vTokens
    vUSDT: '0xfD5840Cd36d94D7229439859C0112a4185BC0255',
    vUSDC: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8',
    vBNB: '0xA07c5b74C9B40447a954e1466938b865b6BBea36',
  },
  testnet: {
    pancakeRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
    WBNB: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    BUSD: '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee',
    YBOT: '0x5cBbBe32b2893DDCca439372F6AD120C848B2712',
  }
};

// ============ TYPES ============

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps: number; // 50 = 0.5%
  deadline?: number; // seconds from now
}

export interface SwapResult {
  txHash: string;
  amountIn: string;
  amountOut: string;
  path: string[];
}

export interface LiquidityParams {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  slippageBps: number;
}

export interface TradeCondition {
  type: 'price-above' | 'price-below' | 'apy-above' | 'apy-below' | 'pnl-above' | 'pnl-below';
  token?: string;
  threshold: number;
  action: TradeAction;
}

export interface TradeAction {
  type: 'swap' | 'add-liquidity' | 'remove-liquidity' | 'stake' | 'unstake' | 'deposit-venus' | 'withdraw-venus';
  params: Record<string, any>;
}

export interface AutoTradeConfig {
  enabled: boolean;
  conditions: TradeCondition[];
  maxSlippageBps: number;
  maxGasPrice: string; // in gwei
  requireApproval: boolean; // if true, shows popup; if false, needs session key
}

// ============ AUTO TRADE SERVICE ============

class AutoTradeService {
  private config: AutoTradeConfig;
  private isMainnet: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private onEvent: ((event: string, data: any) => void) | null = null;

  constructor() {
    this.config = {
      enabled: false,
      conditions: [],
      maxSlippageBps: 100, // 1%
      maxGasPrice: '10',
      requireApproval: true, // Always require wallet approval for safety
    };
  }

  // ============ CONFIGURATION ============

  setConfig(config: Partial<AutoTradeConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AutoTradeConfig {
    return { ...this.config };
  }

  subscribe(callback: (event: string, data: any) => void) {
    this.onEvent = callback;
  }

  private emit(event: string, data: any) {
    console.log(`[AutoTrade] ${event}:`, data);
    if (this.onEvent) this.onEvent(event, data);
  }

  // ============ NETWORK ============

  private async getAddresses() {
    const ethereum = getEthereumObject();
    if (!ethereum) throw new Error('Wallet not connected');
    
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    this.isMainnet = chainId === '0x38';
    
    return this.isMainnet ? ADDRESSES.mainnet : ADDRESSES.testnet;
  }

  // ============ SWAP EXECUTION ============

  /**
   * Get swap quote from PancakeSwap
   */
  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<{
    amountOut: string;
    path: string[];
    priceImpact: number;
  }> {
    const ethereum = getEthereumObject();
    if (!ethereum) throw new Error('Wallet not connected');

    const provider = new ethers.BrowserProvider(ethereum);
    const addresses = await this.getAddresses();
    
    const router = new ethers.Contract(addresses.pancakeRouter, PANCAKE_ROUTER_ABI, provider);
    const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, provider);
    const tokenOutContract = new ethers.Contract(tokenOut, ERC20_ABI, provider);
    
    const [decimalsIn, decimalsOut] = await Promise.all([
      tokenInContract.decimals(),
      tokenOutContract.decimals(),
    ]);
    
    const amountInWei = ethers.parseUnits(amountIn, decimalsIn);
    
    // Try direct path first, then via WBNB
    let path = [tokenIn, tokenOut];
    let amounts: bigint[];
    
    try {
      amounts = await router.getAmountsOut(amountInWei, path);
    } catch {
      // Try via WBNB
      path = [tokenIn, addresses.WBNB, tokenOut];
      amounts = await router.getAmountsOut(amountInWei, path);
    }
    
    const amountOut = ethers.formatUnits(amounts[amounts.length - 1], decimalsOut);
    
    return {
      amountOut,
      path,
      priceImpact: 0, // Would need reserves to calculate
    };
  }

  /**
   * Execute a token swap on PancakeSwap
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    this.emit('swap-started', params);
    
    const ethereum = getEthereumObject();
    if (!ethereum) throw new Error('Wallet not connected');

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    const addresses = await this.getAddresses();
    
    const router = new ethers.Contract(addresses.pancakeRouter, PANCAKE_ROUTER_ABI, signer);
    const tokenInContract = new ethers.Contract(params.tokenIn, ERC20_ABI, signer);
    
    const decimalsIn = await tokenInContract.decimals();
    const amountInWei = ethers.parseUnits(params.amountIn, decimalsIn);
    
    // Get quote
    const quote = await this.getSwapQuote(params.tokenIn, params.tokenOut, params.amountIn);
    
    // Calculate min amount out with slippage
    const tokenOutContract = new ethers.Contract(params.tokenOut, ERC20_ABI, provider);
    const decimalsOut = await tokenOutContract.decimals();
    const amountOutWei = ethers.parseUnits(quote.amountOut, decimalsOut);
    const minAmountOut = amountOutWei * BigInt(10000 - params.slippageBps) / BigInt(10000);
    
    // Check and approve
    const allowance = await tokenInContract.allowance(userAddress, addresses.pancakeRouter);
    if (allowance < amountInWei) {
      this.emit('approval-needed', { token: params.tokenIn, amount: params.amountIn });
      const approveTx = await tokenInContract.approve(addresses.pancakeRouter, ethers.MaxUint256);
      await approveTx.wait();
      this.emit('approval-confirmed', { token: params.tokenIn });
    }
    
    // Execute swap
    const deadline = Math.floor(Date.now() / 1000) + (params.deadline || 1200); // 20 min default
    
    const tx = await router.swapExactTokensForTokens(
      amountInWei,
      minAmountOut,
      quote.path,
      userAddress,
      deadline
    );
    
    this.emit('swap-pending', { txHash: tx.hash });
    const receipt = await tx.wait();
    
    const result: SwapResult = {
      txHash: tx.hash,
      amountIn: params.amountIn,
      amountOut: quote.amountOut,
      path: quote.path,
    };
    
    this.emit('swap-completed', result);
    return result;
  }

  /**
   * Swap BNB to Token
   */
  async swapBNBForToken(tokenOut: string, amountBNB: string, slippageBps: number = 50): Promise<SwapResult> {
    const ethereum = getEthereumObject();
    if (!ethereum) throw new Error('Wallet not connected');

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    const addresses = await this.getAddresses();
    
    const router = new ethers.Contract(addresses.pancakeRouter, PANCAKE_ROUTER_ABI, signer);
    const amountInWei = ethers.parseEther(amountBNB);
    
    // Get quote
    const path = [addresses.WBNB, tokenOut];
    const amounts = await router.getAmountsOut(amountInWei, path);
    const minAmountOut = amounts[1] * BigInt(10000 - slippageBps) / BigInt(10000);
    
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    
    const tx = await router.swapExactETHForTokens(
      minAmountOut,
      path,
      userAddress,
      deadline,
      { value: amountInWei }
    );
    
    await tx.wait();
    
    const tokenOutContract = new ethers.Contract(tokenOut, ERC20_ABI, provider);
    const decimalsOut = await tokenOutContract.decimals();
    
    return {
      txHash: tx.hash,
      amountIn: amountBNB,
      amountOut: ethers.formatUnits(amounts[1], decimalsOut),
      path,
    };
  }

  // ============ VENUS PROTOCOL ============

  /**
   * Deposit to Venus Protocol
   */
  async depositToVenus(vTokenAddress: string, underlyingToken: string, amount: string): Promise<string> {
    const ethereum = getEthereumObject();
    if (!ethereum) throw new Error('Wallet not connected');

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    
    const underlying = new ethers.Contract(underlyingToken, ERC20_ABI, signer);
    const vToken = new ethers.Contract(vTokenAddress, VENUS_VTOKEN_ABI, signer);
    
    const decimals = await underlying.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);
    
    // Approve
    const allowance = await underlying.allowance(userAddress, vTokenAddress);
    if (allowance < amountWei) {
      const approveTx = await underlying.approve(vTokenAddress, ethers.MaxUint256);
      await approveTx.wait();
    }
    
    // Mint vTokens
    const tx = await vToken.mint(amountWei);
    await tx.wait();
    
    this.emit('venus-deposit', { vToken: vTokenAddress, amount });
    return tx.hash;
  }

  /**
   * Withdraw from Venus Protocol
   */
  async withdrawFromVenus(vTokenAddress: string, amount: string): Promise<string> {
    const ethereum = getEthereumObject();
    if (!ethereum) throw new Error('Wallet not connected');

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    
    const vToken = new ethers.Contract(vTokenAddress, VENUS_VTOKEN_ABI, signer);
    
    // Redeem underlying amount
    const amountWei = ethers.parseUnits(amount, 18); // Most are 18 decimals
    const tx = await vToken.redeemUnderlying(amountWei);
    await tx.wait();
    
    this.emit('venus-withdraw', { vToken: vTokenAddress, amount });
    return tx.hash;
  }

  // ============ MONITORING & AUTOMATION ============

  /**
   * Start monitoring conditions
   */
  startMonitoring(intervalMs: number = 60000) {
    if (this.monitorInterval) return;
    
    this.emit('monitoring-started', { interval: intervalMs });
    
    this.monitorInterval = setInterval(async () => {
      await this.checkConditions();
    }, intervalMs);
    
    // Run immediately
    this.checkConditions();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.emit('monitoring-stopped', {});
    }
  }

  /**
   * Check all conditions and execute actions if met
   */
  private async checkConditions() {
    if (!this.config.enabled || this.config.conditions.length === 0) return;
    
    for (const condition of this.config.conditions) {
      try {
        const isMet = await this.evaluateCondition(condition);
        
        if (isMet) {
          this.emit('condition-met', { condition });
          
          if (this.config.requireApproval) {
            // Just emit event, UI will show approval dialog
            this.emit('action-pending', { condition, action: condition.action });
          } else {
            // Execute automatically (requires session key setup)
            await this.executeAction(condition.action);
          }
        }
      } catch (error) {
        this.emit('condition-error', { condition, error });
      }
    }
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(condition: TradeCondition): Promise<boolean> {
    // This would fetch live price/APY data and compare
    // For now, return false (placeholder)
    
    switch (condition.type) {
      case 'price-above':
      case 'price-below':
        // Fetch price from oracle or DEX
        return false;
        
      case 'apy-above':
      case 'apy-below':
        // Fetch APY from protocol
        return false;
        
      case 'pnl-above':
      case 'pnl-below':
        // Calculate P&L from positions
        return false;
        
      default:
        return false;
    }
  }

  /**
   * Execute a trade action
   */
  async executeAction(action: TradeAction): Promise<string> {
    this.emit('action-executing', action);
    
    switch (action.type) {
      case 'swap':
        const swapResult = await this.executeSwap(action.params as SwapParams);
        return swapResult.txHash;
        
      case 'deposit-venus':
        return await this.depositToVenus(
          action.params.vToken,
          action.params.underlying,
          action.params.amount
        );
        
      case 'withdraw-venus':
        return await this.withdrawFromVenus(
          action.params.vToken,
          action.params.amount
        );
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // ============ TAKE PROFIT / STOP LOSS ============

  /**
   * Set up take profit condition
   */
  addTakeProfit(token: string, targetPriceUSD: number, action: TradeAction) {
    this.config.conditions.push({
      type: 'price-above',
      token,
      threshold: targetPriceUSD,
      action,
    });
    this.emit('take-profit-set', { token, target: targetPriceUSD });
  }

  /**
   * Set up stop loss condition
   */
  addStopLoss(token: string, stopPriceUSD: number, action: TradeAction) {
    this.config.conditions.push({
      type: 'price-below',
      token,
      threshold: stopPriceUSD,
      action,
    });
    this.emit('stop-loss-set', { token, stop: stopPriceUSD });
  }

  /**
   * Set up APY rebalance condition
   */
  addAPYRebalance(currentProtocol: string, minAPY: number, action: TradeAction) {
    this.config.conditions.push({
      type: 'apy-below',
      token: currentProtocol,
      threshold: minAPY,
      action,
    });
    this.emit('apy-rebalance-set', { protocol: currentProtocol, minAPY });
  }
}

// Export singleton
export const autoTradeService = new AutoTradeService();
export default AutoTradeService;
