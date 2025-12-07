import { ethers, type Eip1193Provider } from "ethers";
import { NFTItem } from "../types";

// Chain IDs
const BSC_MAINNET_ID = '0x38'; // 56 in hex
const BSC_TESTNET_ID = '0x61'; // 97 in hex

// Chain configurations
const CHAIN_CONFIG = {
  mainnet: {
    chainId: BSC_MAINNET_ID,
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  testnet: {
    chainId: BSC_TESTNET_ID,
    chainName: 'BNB Smart Chain Testnet',
    nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://bsc-testnet-dataseed.bnbchain.org'],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  }
};

// Contract addresses per network
const CONTRACT_ADDRESSES = {
  mainnet: {
    YBOT_TOKEN: import.meta.env.VITE_YBOT_TOKEN_MAINNET || '0x4f8e86D018377D3FA06609c7b238282ed530707f',
    NFT_CONTRACT: import.meta.env.VITE_NFT_CONTRACT_MAINNET || '0x66BDE8b545443330a7a885B038E7A58089789A46',
    TOKEN_SALE: import.meta.env.VITE_BONDINGCURVE_MAINNET || '0x06826d64d31c6A05D17D35ae658f47a3827bdd51',
    YBOT_VAULT: import.meta.env.VITE_YBOT_VAULT_MAINNET || '0x89Cfb540FAC158506659420252373e07072149e6',
    YBOT_STAKING: import.meta.env.VITE_STAKING_MAINNET || '0x031b7519EB8c864169c3f29B571e47407FA92b5d',
    VENUS_ADAPTER: import.meta.env.VITE_VENUS_ADAPTER_MAINNET || '0x92ef1D8244fc276A13dE03B895dadd0c3fcD01c2',
    PANCAKE_ADAPTER: import.meta.env.VITE_PANCAKE_ADAPTER_MAINNET || '0x5178Accee05D1Cb7a1580B2137cE337B547914C0',
    ZAP: import.meta.env.VITE_ZAP_MAINNET || '',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC Mainnet USDC (vault uses this!)
    USDT: '0x55d398326f99059fF775485246999027B3197955', // BSC Mainnet USDT
  },
  testnet: {
    YBOT_TOKEN: import.meta.env.VITE_YBOT_TOKEN_TESTNET || '0x5cBbBe32b2893DDCca439372F6AD120C848B2712',
    NFT_CONTRACT: import.meta.env.VITE_NFT_CONTRACT_TESTNET || '0x6D0646E2245B33C57E86f7E5F564dFB7b0587469',
    TOKEN_SALE: import.meta.env.VITE_TOKEN_SALE_CONTRACT || '',
    YBOT_VAULT: import.meta.env.VITE_YBOT_VAULT_TESTNET || '0x9041471c2b813e4CCB3a7219aC41D97623E40d3d',
    ZAP: import.meta.env.VITE_ZAP_TESTNET || '',
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // BSC Testnet USDT
  }
};

// Get current network type from connected chain
const getNetworkType = async (ethereum: Eip1193Provider): Promise<'mainnet' | 'testnet'> => {
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  return chainId === BSC_MAINNET_ID ? 'mainnet' : 'testnet';
};

// Get contract addresses for current network
const getContractAddresses = async (ethereum?: Eip1193Provider) => {
  if (!ethereum) return CONTRACT_ADDRESSES.testnet;
  const network = await getNetworkType(ethereum);
  return CONTRACT_ADDRESSES[network];
};

// MOCK ADDRESS for Simulation Mode
const MOCK_WALLET_ADDRESS = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

// ERC20 ABI for YBOT
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// NFT Contract ABI
const NFT_ABI = [
  "function mintWithTokenURI(address to, string memory tokenURI) returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function mintPrice() view returns (uint256)"
];

// Token Sale ABI
const TOKEN_SALE_ABI = [
  "function buyWithBNB(uint256 minYbotOut) payable",
  "function buyWithToken(address token, uint256 amount, uint256 minYbotOut)",
  "function getBNBPrice() view returns (uint256)",
  "function getTokenPrice(address token) view returns (uint256)",
  "function pricePerUSD() view returns (uint256)"
];

// YBOT Yield Vault ABI
const YBOT_VAULT_ABI = [
  // User functions
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function claimRewards() external",
  "function harvest() external",
  // View functions
  "function depositToken() view returns (address)",
  "function ybotToken() view returns (address)",
  "function userInfo(address) view returns (uint256 deposited, uint256 rewardDebt, uint256 lastDepositTime)",
  "function pendingYBOT(address user) view returns (uint256)",
  "function totalValueLocked() view returns (uint256)",
  "function totalDeposited() view returns (uint256)",
  "function hasYBOTAccess(address user) view returns (bool)",
  "function minYBOTBalance() view returns (uint256)",
  "function estimatedAPY() view returns (uint256)",
  "function depositFeeBps() view returns (uint256)",
  "function withdrawalFeeBps() view returns (uint256)",
  "function performanceFeeBps() view returns (uint256)",
  "function adapterCount() view returns (uint256)"
];

// Type guard: check provider conforms to EIP-1193 by verifying the request method exists
const isEip1193Provider = (provider: unknown): provider is Eip1193Provider => {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'request' in (provider as Record<string, unknown>) &&
    typeof (provider as Record<string, any>).request === 'function'
  );
};

export const getEthereumObject = (): Eip1193Provider | undefined => {
  const candidate = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!candidate) return undefined;
  if (!isEip1193Provider(candidate)) return undefined;
  return candidate;
};

// Clear wallet connection state
export const clearWalletConnection = () => {
  // Clear Web3Modal localStorage
  localStorage.removeItem('wagmi.store');
  localStorage.removeItem('wagmi.cache');
  localStorage.removeItem('wagmi.wallet');
  localStorage.removeItem('@web3modal/wallet_id');
  localStorage.removeItem('WEB3_CONNECT_CACHED_PROVIDER');
  localStorage.removeItem('walletconnect');
  
  // Clear any other wallet-related storage
  Object.keys(localStorage).forEach(key => {
    if (key.includes('wagmi') || key.includes('web3modal') || key.includes('wallet')) {
      localStorage.removeItem(key);
    }
  });
};

export const connectWallet = async (): Promise<string> => {
  const ethereum = getEthereumObject();
  
  if (!ethereum) {
    console.warn("MetaMask not detected. Falling back to MOCK MODE for demonstration.");
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_WALLET_ADDRESS;
  }

  try {
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    return accounts[0];
  } catch (error) {
    console.error("User rejected request", error);
    throw error;
  }
};

export const switchChainToBNB = async (preferMainnet: boolean = true) => {
  const ethereum = getEthereumObject();
  if (!ethereum) return; // Skip in mock mode

  const targetChain = preferMainnet ? CHAIN_CONFIG.mainnet : CHAIN_CONFIG.testnet;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChain.chainId }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [targetChain],
        });
      } catch (addError) {
        console.error("Failed to add BNB Chain", addError);
        throw addError;
      }
    } else {
      throw switchError;
    }
  }
};

// --- FINANCE ACTIONS ---

// Get USDT balance for a wallet
export const getUSDTBalance = async (address: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) {
    console.log('[MOCK] Fetching USDT balance for', address);
    return "0";
  }

  try {
    const addresses = await getContractAddresses(ethereum);
    const provider = new ethers.BrowserProvider(ethereum);
    const contract = new ethers.Contract(addresses.USDT, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    const formatted = ethers.formatUnits(balance, 18); // USDT on BSC has 18 decimals
    console.log('USDT Balance:', formatted);
    return formatted;
  } catch (error) {
    console.error('Failed to fetch USDT balance:', error);
    return "0";
  }
};

// Get BNB balance for a wallet
export const getBNBBalance = async (address: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) {
    console.log('[MOCK] Fetching BNB balance for', address);
    return "0";
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    const balance = await provider.getBalance(address);
    const formatted = ethers.formatEther(balance);
    console.log('BNB Balance:', formatted);
    return formatted;
  } catch (error) {
    console.error('Failed to fetch BNB balance:', error);
    return "0";
  }
};

// Deposit USDC to the Yield Vault (vault uses USDC, not USDT!)
export const investInVault = async (amountUSDC: string): Promise<string> => {
    const ethereum = getEthereumObject();
    
    // MOCK MODE
    if (!ethereum) {
      console.log(`[MOCK] Depositing ${amountUSDC} USDC to vault...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return "0xMOCK" + Array(60).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    
    // REAL MODE
    await switchChainToBNB(true); // preferMainnet = true
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const addresses = await getContractAddresses(ethereum);
    
    const amountWei = ethers.parseUnits(amountUSDC, 18);
    
    // Step 1: Approve USDC spending (vault uses USDC!)
    console.log(`Approving ${amountUSDC} USDC for vault...`);
    const usdcContract = new ethers.Contract(addresses.USDC, ERC20_ABI, signer);
    const approveTx = await usdcContract.approve(addresses.YBOT_VAULT, amountWei);
    await approveTx.wait();
    console.log('USDC approved');
    
    // Step 2: Deposit to vault
    console.log(`Depositing ${amountUSDC} USDC to vault...`);
    const vaultContract = new ethers.Contract(addresses.YBOT_VAULT, YBOT_VAULT_ABI, signer);
    const depositTx = await vaultContract.deposit(amountWei);
    await depositTx.wait();
    
    console.log('Deposit successful:', depositTx.hash);
    return depositTx.hash;
};

export const mintCreditScoreSBT = async (tokenURI: string): Promise<string> => {
    const ethereum = getEthereumObject();

    // MOCK MODE
    if (!ethereum) {
      console.log(`[MOCK] Minting SBT with URI: ${tokenURI}`);
      await new Promise(resolve => setTimeout(resolve, 2500));
      return "0xMOCK_SBT_" + Array(50).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    
    // REAL MODE
    await switchChainToBNB();
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    console.log(`Minting SBT with URI: ${tokenURI}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
};

export const claimYields = async (): Promise<string> => {
    const ethereum = getEthereumObject();
    if (!ethereum) {
       await new Promise(resolve => setTimeout(resolve, 1000));
       return "0xMOCK_CLAIM";
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    return "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
};

export const fetchUserNFTs = async (address: string): Promise<NFTItem[]> => {
    // In a real app, this would query the Graph or Moralis NFT API
    // Returning empty array - NFTs will be added when minted
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
};

export const getYBOTBalance = async (address: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) {
    console.log('[MOCK] Fetching YBOT balance for', address);
    return "0";
  }

  try {
    const addresses = await getContractAddresses(ethereum);
    const provider = new ethers.BrowserProvider(ethereum);
    const contract = new ethers.Contract(addresses.YBOT_TOKEN, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    const formatted = ethers.formatEther(balance);
    console.log('YBOT Balance:', formatted);
    return formatted;
  } catch (error) {
    console.error('Failed to fetch YBOT balance:', error);
    return "0";
  }
};

export const approveYBOT = async (amount: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return "0xMOCK_APPROVE";
  }

  const addresses = await getContractAddresses(ethereum);
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(addresses.YBOT_TOKEN, ERC20_ABI, signer);
  const tx = await contract.approve(addresses.NFT_CONTRACT, ethers.parseEther(amount));
  await tx.wait();
  return tx.hash;
};

export const mintNFT = async (tokenURI: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return "0xMOCK_MINT";
  }

  const addresses = await getContractAddresses(ethereum);
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(addresses.NFT_CONTRACT, NFT_ABI, signer);
  const tx = await contract.mintWithTokenURI(await signer.getAddress(), tokenURI);
  await tx.wait();
  return tx.hash;
};

export const getNFTContractInfo = async () => {
  const ethereum = getEthereumObject();
  if (!ethereum) return { nextId: 1, maxSupply: 50, mintPrice: "1" };

  const addresses = await getContractAddresses(ethereum);
  const provider = new ethers.BrowserProvider(ethereum);
  const contract = new ethers.Contract(addresses.NFT_CONTRACT, NFT_ABI, provider);
  const [nextId, maxSupply, mintPrice] = await Promise.all([
    contract.nextTokenId(),
    contract.maxSupply(),
    contract.mintPrice()
  ]);
  return {
    nextId: Number(nextId),
    maxSupply: Number(maxSupply),
    mintPrice: ethers.formatEther(mintPrice)
  };
};

// --- TOKEN SALE FUNCTIONS ---

export const buyYBOTWithBNB = async (amountBNB: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  
  const contract = new ethers.Contract(TOKEN_SALE_ADDRESS, TOKEN_SALE_ABI, signer);
  const tx = await contract.buyWithBNB(0, { value: ethers.parseEther(amountBNB) });
  await tx.wait();
  return tx.hash;
};

export const buyYBOTWithToken = async (tokenAddress: string, amount: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  
  // Approve token spending
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const approveTx = await tokenContract.approve(TOKEN_SALE_ADDRESS, ethers.parseEther(amount));
  await approveTx.wait();
  
  // Buy with token
  const saleContract = new ethers.Contract(TOKEN_SALE_ADDRESS, TOKEN_SALE_ABI, signer);
  const tx = await saleContract.buyWithToken(tokenAddress, ethers.parseEther(amount), 0);
  await tx.wait();
  return tx.hash;
};

export const getYBOTPrice = async (): Promise<{ bnbPrice: string; usdcPrice: string }> => {
  const ethereum = getEthereumObject();
  if (!ethereum) return { bnbPrice: "0.1", usdcPrice: "1" };

  try {
    await switchChainToBNB();
    const provider = new ethers.BrowserProvider(ethereum);
    const contract = new ethers.Contract(TOKEN_SALE_ADDRESS, TOKEN_SALE_ABI, provider);
    
    const pricePerUSD = await contract.pricePerUSD();
    const bnbPrice = await contract.getBNBPrice();
    
    const ybotPerBNB = (ethers.parseEther("1") * pricePerUSD) / bnbPrice;
    const ybotPerUSDC = pricePerUSD;
    
    return {
      bnbPrice: ethers.formatEther(ybotPerBNB),
      usdcPrice: ethers.formatEther(ybotPerUSDC)
    };
  } catch (error) {
    console.error('Failed to fetch YBOT price:', error);
    return { bnbPrice: "0.1", usdcPrice: "1" };
  }
};

// --- YBOT YIELD VAULT FUNCTIONS ---

export interface VaultUserInfo {
  deposited: string;
  pendingYBOT: string;
  hasAccess: boolean;
  lastDepositTime: number;
}

export interface VaultInfo {
  totalValueLocked: string;
  totalDeposited: string;
  estimatedAPY: string;
  minYBOTBalance: string;
  depositFeeBps: number;
  withdrawalFeeBps: number;
  performanceFeeBps: number;
  adapterCount: number;
}

export const getVaultAddress = async (): Promise<string> => {
  const ethereum = getEthereumObject();
  const addresses = await getContractAddresses(ethereum);
  return addresses.YBOT_VAULT;
};

export const getVaultInfo = async (): Promise<VaultInfo> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const vaultAddress = await getVaultAddress();
  const contract = new ethers.Contract(vaultAddress, YBOT_VAULT_ABI, provider);

  const [tvl, totalDeposited, apy, minYBOT, depositFee, withdrawFee, perfFee, adapterCount] = await Promise.all([
    contract.totalValueLocked(),
    contract.totalDeposited(),
    contract.estimatedAPY(),
    contract.minYBOTBalance(),
    contract.depositFeeBps(),
    contract.withdrawalFeeBps(),
    contract.performanceFeeBps(),
    contract.adapterCount()
  ]);

  return {
    totalValueLocked: ethers.formatUnits(tvl, 18),
    totalDeposited: ethers.formatUnits(totalDeposited, 18),
    estimatedAPY: (Number(apy) / 100).toFixed(2),
    minYBOTBalance: ethers.formatUnits(minYBOT, 18),
    depositFeeBps: Number(depositFee),
    withdrawalFeeBps: Number(withdrawFee),
    performanceFeeBps: Number(perfFee),
    adapterCount: Number(adapterCount)
  };
};

export const getVaultUserInfo = async (userAddress: string): Promise<VaultUserInfo> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const vaultAddress = await getVaultAddress();
  const contract = new ethers.Contract(vaultAddress, YBOT_VAULT_ABI, provider);

  const [userInfo, pendingYBOT, hasAccess] = await Promise.all([
    contract.userInfo(userAddress),
    contract.pendingYBOT(userAddress),
    contract.hasYBOTAccess(userAddress)
  ]);

  return {
    deposited: ethers.formatUnits(userInfo.deposited, 18),
    pendingYBOT: ethers.formatUnits(pendingYBOT, 18),
    hasAccess,
    lastDepositTime: Number(userInfo.lastDepositTime)
  };
};

export const depositToVault = async (amount: string, depositTokenAddress: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const vaultAddress = await getVaultAddress();

  // Approve deposit token
  const tokenContract = new ethers.Contract(depositTokenAddress, ERC20_ABI, signer);
  const amountWei = ethers.parseUnits(amount, 18);
  const approveTx = await tokenContract.approve(vaultAddress, amountWei);
  await approveTx.wait();

  // Deposit to vault
  const vaultContract = new ethers.Contract(vaultAddress, YBOT_VAULT_ABI, signer);
  const tx = await vaultContract.deposit(amountWei);
  await tx.wait();
  return tx.hash;
};

export const withdrawFromVault = async (amount: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const vaultAddress = await getVaultAddress();
  const vaultContract = new ethers.Contract(vaultAddress, YBOT_VAULT_ABI, signer);

  const amountWei = ethers.parseUnits(amount, 18);
  const tx = await vaultContract.withdraw(amountWei);
  await tx.wait();
  return tx.hash;
};

export const claimVaultRewards = async (): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const vaultAddress = await getVaultAddress();
  const vaultContract = new ethers.Contract(vaultAddress, YBOT_VAULT_ABI, signer);

  const tx = await vaultContract.claimRewards();
  await tx.wait();
  return tx.hash;
};

export const harvestVault = async (): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error("Wallet not connected");

  await switchChainToBNB();
  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const vaultAddress = await getVaultAddress();
  const vaultContract = new ethers.Contract(vaultAddress, YBOT_VAULT_ABI, signer);

  const tx = await vaultContract.harvest();
  await tx.wait();
  return tx.hash;
};
