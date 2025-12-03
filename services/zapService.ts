/**
 * Zap Service - Frontend integration for one-click deposits
 * Allows users to deposit ANY token into the vault
 */

import { ethers } from 'ethers';

// Contract ABIs (minimal)
const ZAP_ABI = [
  // Zap In
  'function zapInBNB(uint256 minVaultShares) external payable',
  'function zapIn(address inputToken, uint256 inputAmount, uint256 minVaultShares) external',
  'function zapInWithPath(address inputToken, uint256 inputAmount, address[] calldata path, uint256 minVaultShares) external',
  
  // Zap Into LP
  'function zapIntoLP(address inputToken, uint256 inputAmount, address lpToken, uint256 minLPTokens) external returns (uint256)',
  'function zapIntoLPBNB(address lpToken, uint256 minLPTokens) external payable returns (uint256)',
  
  // Zap Out
  'function zapOut(uint256 shares, address outputToken, uint256 minOutput) external returns (uint256)',
  
  // View
  'function previewZapIn(address inputToken, uint256 inputAmount) external view returns (uint256)',
  'function getVaultAsset() external view returns (address)',
  'function defaultSlippage() external view returns (uint256)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

// Contract addresses (update after deployment)
export const ZAP_ADDRESSES = {
  bscMainnet: '', // Deploy and fill
  bscTestnet: '', // Deploy and fill
};

// Common tokens on BSC
export const COMMON_TOKENS = {
  bscMainnet: {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  },
  bscTestnet: {
    WBNB: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    BUSD: '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee',
  },
};

// PancakeSwap Router addresses
export const ROUTER_ADDRESSES = {
  bscMainnet: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  bscTestnet: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
};

export interface ZapQuote {
  inputToken: string;
  inputAmount: string;
  expectedShares: string;
  expectedSharesFormatted: string;
  minShares: string;
  slippage: number;
  priceImpact: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
}

/**
 * Zap Service Class
 */
export class ZapService {
  private provider: ethers.Provider;
  private signer: ethers.Signer | null;
  private zapContract: ethers.Contract | null;
  private chainId: number;

  constructor(provider: ethers.Provider, chainId: number = 56) {
    this.provider = provider;
    this.signer = null;
    this.zapContract = null;
    this.chainId = chainId;
  }

  /**
   * Connect signer (wallet)
   */
  async connectSigner(signer: ethers.Signer) {
    this.signer = signer;
    const zapAddress = this.chainId === 56 ? ZAP_ADDRESSES.bscMainnet : ZAP_ADDRESSES.bscTestnet;
    
    if (zapAddress) {
      this.zapContract = new ethers.Contract(zapAddress, ZAP_ABI, signer);
    }
  }

  /**
   * Get quote for zapping in
   */
  async getZapInQuote(
    inputToken: string,
    inputAmount: string,
    slippageBps: number = 50 // 0.5%
  ): Promise<ZapQuote> {
    if (!this.zapContract) throw new Error('Zap contract not initialized');

    const inputAmountWei = ethers.parseUnits(inputAmount, 18); // Adjust decimals as needed
    
    // Get expected shares from contract
    const expectedShares = await this.zapContract.previewZapIn(inputToken, inputAmountWei);
    
    // Calculate min shares with slippage
    const minShares = expectedShares * BigInt(10000 - slippageBps) / BigInt(10000);
    
    return {
      inputToken,
      inputAmount,
      expectedShares: expectedShares.toString(),
      expectedSharesFormatted: ethers.formatUnits(expectedShares, 18),
      minShares: minShares.toString(),
      slippage: slippageBps / 100,
      priceImpact: 0, // Would need to calculate from reserves
    };
  }

  /**
   * Zap in with BNB
   */
  async zapInBNB(
    amountBNB: string,
    minShares: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.zapContract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const amountWei = ethers.parseEther(amountBNB);
    const minSharesWei = ethers.parseUnits(minShares, 18);

    const tx = await this.zapContract.zapInBNB(minSharesWei, {
      value: amountWei,
    });

    return tx;
  }

  /**
   * Zap in with any ERC20 token
   */
  async zapIn(
    inputToken: string,
    amount: string,
    minShares: string,
    decimals: number = 18
  ): Promise<ethers.TransactionResponse> {
    if (!this.zapContract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const amountWei = ethers.parseUnits(amount, decimals);
    const minSharesWei = ethers.parseUnits(minShares, 18);

    // Check and approve if needed
    await this.ensureApproval(inputToken, amountWei);

    const tx = await this.zapContract.zapIn(inputToken, amountWei, minSharesWei);
    return tx;
  }

  /**
   * Zap out to any token
   */
  async zapOut(
    shares: string,
    outputToken: string,
    minOutput: string,
    outputDecimals: number = 18
  ): Promise<ethers.TransactionResponse> {
    if (!this.zapContract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const sharesWei = ethers.parseUnits(shares, 18);
    const minOutputWei = ethers.parseUnits(minOutput, outputDecimals);

    // Need to approve vault shares to zap contract
    const vaultAddress = await this.getVaultAddress();
    await this.ensureApproval(vaultAddress, sharesWei);

    const tx = await this.zapContract.zapOut(sharesWei, outputToken, minOutputWei);
    return tx;
  }

  /**
   * Zap into LP position
   */
  async zapIntoLP(
    inputToken: string,
    amount: string,
    lpToken: string,
    minLP: string,
    inputDecimals: number = 18
  ): Promise<ethers.TransactionResponse> {
    if (!this.zapContract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const amountWei = ethers.parseUnits(amount, inputDecimals);
    const minLPWei = ethers.parseUnits(minLP, 18);

    await this.ensureApproval(inputToken, amountWei);

    const tx = await this.zapContract.zapIntoLP(inputToken, amountWei, lpToken, minLPWei);
    return tx;
  }

  /**
   * Get token info
   */
  async getTokenInfo(tokenAddress: string, userAddress: string): Promise<TokenInfo> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    
    const [symbol, decimals, balance] = await Promise.all([
      token.symbol(),
      token.decimals(),
      token.balanceOf(userAddress),
    ]);

    return {
      address: tokenAddress,
      symbol,
      decimals,
      balance: balance.toString(),
      balanceFormatted: ethers.formatUnits(balance, decimals),
    };
  }

  /**
   * Get user's BNB balance
   */
  async getBNBBalance(userAddress: string): Promise<string> {
    const balance = await this.provider.getBalance(userAddress);
    return ethers.formatEther(balance);
  }

  /**
   * Get vault asset address
   */
  async getVaultAddress(): Promise<string> {
    if (!this.zapContract) throw new Error('Zap contract not initialized');
    return await this.zapContract.getVaultAsset();
  }

  /**
   * Ensure token is approved for zap contract
   */
  private async ensureApproval(tokenAddress: string, amount: bigint): Promise<void> {
    if (!this.signer || !this.zapContract) return;

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const signerAddress = await this.signer.getAddress();
    const zapAddress = await this.zapContract.getAddress();

    const allowance = await token.allowance(signerAddress, zapAddress);

    if (allowance < amount) {
      console.log('Approving token...');
      const approveTx = await token.approve(zapAddress, ethers.MaxUint256);
      await approveTx.wait();
      console.log('Token approved');
    }
  }
}

/**
 * Helper: Calculate optimal swap amounts for LP
 * Uses the Babylonian method for optimal split
 */
export function calculateOptimalSwapAmount(
  reserveIn: bigint,
  amountIn: bigint
): bigint {
  // Optimal amount = (sqrt(reserveIn * (amountIn * 3988000 + reserveIn * 3988009)) - reserveIn * 1997) / 1994
  // This accounts for 0.3% swap fee
  const a = reserveIn * (amountIn * BigInt(3988000) + reserveIn * BigInt(3988009));
  const sqrtA = sqrt(a);
  return (sqrtA - reserveIn * BigInt(1997)) / BigInt(1994);
}

// Babylonian square root for BigInt
function sqrt(value: bigint): bigint {
  if (value < BigInt(0)) throw new Error('Square root of negative number');
  if (value === BigInt(0)) return BigInt(0);
  
  let z = value;
  let x = value / BigInt(2) + BigInt(1);
  
  while (x < z) {
    z = x;
    x = (value / x + x) / BigInt(2);
  }
  
  return z;
}

// Export singleton instance
let zapServiceInstance: ZapService | null = null;

export function getZapService(provider: ethers.Provider, chainId: number = 56): ZapService {
  if (!zapServiceInstance) {
    zapServiceInstance = new ZapService(provider, chainId);
  }
  return zapServiceInstance;
}

export default ZapService;
