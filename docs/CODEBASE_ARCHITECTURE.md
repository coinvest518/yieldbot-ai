# YBOT Finance - Complete Codebase Architecture

## 🎯 Project Overview

**YBOT Finance** is an AI-powered DeFi yield aggregator platform on BSC (Binance Smart Chain) with ElizaOS agent integration. It combines:
- Multi-protocol yield farming (Venus, PancakeSwap, Beefy)
- NFT-based credit scoring system
- Soulbound tokens (SBT) for credit tiers
- AI agents for automated trading
- Smart wallet integration (Alchemy Account Abstraction)

---

## 📊 Architecture Layers

### 1. **Frontend Layer** (React + TypeScript + Vite)

#### Key Components:
- **App.tsx** - Main router with 4 pages:
  - `/` - Home (Hero, Dashboard, Yield Strategies)
  - `/ai-agents` - AI Agent Dashboard
  - `/fundraiser` - Token Sale (Bonding Curve)
  - `/staking` - Staking Page

#### UI Components:
- `Dashboard.tsx` - User finance overview
- `YieldStrategyDashboard.tsx` - Live yield data from protocols
- `AgentDashboard.tsx` - AI trading interface
- `SmartWalletPanel.tsx` - Alchemy smart wallet
- `EmbeddedWalletPanel.tsx` - Embedded wallet UI
- `LiveTicker.tsx` - Real-time price ticker
- `Gallery.tsx` - NFT gallery display

#### State Management:
- **wagmi** - Web3 wallet connection
- **@reown/appkit** - Web3Modal for wallet selection
- **@tanstack/react-query** - Data fetching & caching

---

### 2. **Smart Contracts Layer** (Solidity on BSC)

#### Core Contracts:

##### **YBOTYieldVault.sol** (Main Vault)
```
Purpose: Multi-protocol yield aggregator
Features:
  - Accepts USDC deposits
  - Routes capital to multiple adapters (Venus, PancakeSwap)
  - Mints YBOT rewards to depositors
  - Requires minimum YBOT balance for access (token gating)
  - Charges deposit/withdrawal/performance fees

Key Functions:
  - deposit(amount) - Deposit USDC, get YBOT rewards
  - withdraw(amount) - Withdraw USDC + claim rewards
  - claimRewards() - Claim pending YBOT
  - harvest() - Harvest from all adapters, mint YBOT
  - addAdapter() - Add new yield protocol
  - rebalance() - Rebalance capital across adapters

State Variables:
  - depositToken: USDC (0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d)
  - ybotToken: YBOT token (mints rewards)
  - adapters: Array of yield adapters
  - allocationBps: Capital allocation % per adapter
  - userInfo: Tracks deposits & rewards per user
  - accYBOTPerShare: Accumulated rewards per share
```

##### **VenusAdapter.sol** (Venus Protocol Integration)
```
Purpose: Lend assets to Venus Protocol
Flow:
  1. Receive USDC from vault
  2. Supply to Venus (get vUSDT in return)
  3. Earn interest + XVS rewards
  4. Harvest: Claim XVS → Swap to USDC → Return to vault

Key Functions:
  - deposit(amount) - Supply to Venus
  - withdraw(amount, to) - Redeem from Venus
  - harvest(to) - Claim XVS, swap to USDC
  - totalUnderlying() - Get total USDC value
  - estimatedAPY() - Calculate APY from supply rate

Security:
  - Slippage protection (5% max)
  - Venus market health checks
  - Reentrancy guard
```

##### **PancakeSwapAdapter.sol** (PancakeSwap LP Farming)
```
Purpose: Provide liquidity to PancakeSwap, farm CAKE
Flow:
  1. Receive USDC from vault
  2. Swap 50% USDC → WBNB
  3. Add liquidity (USDC-WBNB pair)
  4. Stake LP in MasterChef V2
  5. Earn CAKE rewards
  6. Harvest: Claim CAKE → Swap to USDC → Return to vault

Key Functions:
  - deposit(amount) - Swap, add liquidity, stake
  - withdraw(amount, to) - Unstake, remove liquidity, swap back
  - harvest(to) - Claim CAKE, swap to USDC
  - totalUnderlying() - Calculate LP value in USDC

Security:
  - Slippage protection (5%)
  - Deadline checks (5 min)
  - Pausable for emergencies
  - Reentrancy guard
```

##### **NFTNinja.sol** (Credit Score NFTs)
```
Purpose: Mint NFTs representing credit tiers
Tiers: Iron, Bronze, Silver, Gold, Platinum
Features:
  - Soulbound (non-transferable)
  - Metadata stored on Pinata IPFS
  - Tier-based access to vault
```

##### **YBOTStaking.sol** (Staking Contract)
```
Purpose: Stake YBOT tokens, earn rewards
Features:
  - Lock YBOT for rewards
  - Claim rewards periodically
```

##### **BondingCurveFundraiser.sol** (Token Sale)
```
Purpose: Bonding curve for YBOT token sale
Features:
  - Buy YBOT with BNB or USDC
  - Price increases with supply
  - Liquidity pool integration
```

---

### 3. **Backend Services Layer** (TypeScript)

#### Key Services:

##### **web3Service.ts** - Web3 Integration
```
Responsibilities:
  - Wallet connection (MetaMask, WalletConnect)
  - Chain switching (BSC Mainnet/Testnet)
  - Contract interactions via ethers.js
  - Mock mode for demo (no wallet required)

Key Functions:
  - connectWallet() - Connect MetaMask
  - switchChainToBNB() - Switch to BSC
  - investInVault(amount) - Deposit USDC to vault
  - getYBOTBalance(address) - Fetch YBOT balance
  - mintNFT(tokenURI) - Mint credit score NFT
  - getVaultInfo() - Fetch vault stats
  - depositToVault() - Deposit to vault
  - claimVaultRewards() - Claim YBOT rewards

Contract Addresses (from .env):
  Mainnet:
    - YBOT_TOKEN: 0x4f8e86D018377D3FA06609c7b238282ed530707f
    - YBOT_VAULT: 0x89Cfb540FAC158506659420252373e07072149e6
    - NFT_CONTRACT: 0x66BDE8b545443330a7a885B038E7A58089789A46
    - VENUS_ADAPTER: 0x92ef1D8244fc276A13dE03B895dadd0c3fcD01c2
    - PANCAKE_ADAPTER: 0x5178Accee05D1Cb7a1580B2137cE337B547914C0
    - USDC: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
    - USDT: 0x55d398326f99059fF775485246999027B3197955
```

##### **yieldService.ts** - Yield Calculation & Strategy
```
Responsibilities:
  - Fetch live yield data from protocols
  - Calculate potential yields
  - Recommend strategies based on risk

Strategies:
  1. Safe Lending (Venus)
     - APY: 2-6%
     - Risk: Low
     - Protocol: Venus Protocol
  
  2. Stablecoin LP (PancakeSwap)
     - APY: 8-20%
     - Risk: Medium
     - Protocols: PancakeSwap V3, Beefy
  
  3. Volatile LP (PancakeSwap)
     - APY: 25-200%
     - Risk: High
     - Protocols: PancakeSwap V3, Beefy

Key Functions:
  - fetchLiveYieldData() - Get all strategies
  - getTopPoolsForStrategy() - Get top pools
  - calculatePotentialYield() - Calculate returns
  - fetchLiveVaultStats() - Get vault stats
```

##### **protocolDataService.ts** - Protocol Data Aggregation
```
Responsibilities:
  - Fetch Venus market data (on-chain)
  - Fetch DefiLlama yields (API)
  - Fetch Beefy vaults (API)
  - Aggregate and categorize

Data Sources:
  1. Venus Protocol (On-Chain)
     - Endpoint: BSC RPC
     - Contracts: vUSDT, vUSDC, vBNB, vBTC, vETH
     - Data: Supply APY, borrow APY, liquidity
  
  2. DefiLlama (API)
     - Endpoint: https://yields.llama.fi/pools
     - Data: APY, TVL, volume for all protocols
  
  3. Beefy Finance (API)
     - Endpoint: https://api.beefy.finance/
     - Data: Vault APY, TVL, assets

Key Functions:
  - fetchVenusMarkets() - Get Venus data
  - fetchDefiLlamaYields() - Get DefiLlama data
  - fetchBeefyVaults() - Get Beefy data
  - fetchAllYieldStrategies() - Aggregate all
  - calculateEstimatedYield() - Calculate returns
```

##### **aiAgentService.ts** - ElizaOS AI Integration
```
Responsibilities:
  - Initialize ElizaOS agent
  - Process user queries
  - Execute trading decisions
  - Manage agent memory

Features:
  - Google Gemini integration
  - Natural language processing
  - Automated trading recommendations
  - Portfolio analysis
```

##### **pinataService.ts** - IPFS Storage
```
Responsibilities:
  - Upload NFT metadata to Pinata
  - Upload generated images
  - Manage IPFS hashes

Key Functions:
  - pinMetadata() - Pin JSON metadata
  - pinImage() - Pin image file
  - getPinataUrl() - Get IPFS URL
```

##### **moralisService.ts** - Blockchain Data
```
Responsibilities:
  - Fetch wallet balances
  - Track transactions
  - Monitor NFT transfers
  - Set up webhooks for events

Key Functions:
  - getWalletBalance() - Get token balance
  - getNFTs() - Get user NFTs
  - setupWebhook() - Monitor events
```

##### **smartWalletService.ts** - Alchemy Account Abstraction
```
Responsibilities:
  - Create smart wallets
  - Execute bundled transactions
  - Manage session keys
  - Enable gasless transactions

Features:
  - Account abstraction
  - Session keys for AI trading
  - Bundled operations
```

---

### 4. **Data Flow Diagrams**

#### User Deposit Flow:
```
User (Frontend)
    ↓
connectWallet() [web3Service]
    ↓
Switch to BSC [switchChainToBNB]
    ↓
Approve USDC [ERC20.approve]
    ↓
depositToVault(amount) [web3Service]
    ↓
YBOTYieldVault.deposit() [Smart Contract]
    ├→ Charge deposit fee (0.5%)
    ├→ Distribute to adapters:
    │   ├→ VenusAdapter (50%)
    │   └→ PancakeSwapAdapter (50%)
    └→ Mint YBOT rewards
    ↓
User receives:
  - Vault deposit receipt
  - Pending YBOT rewards
  - Access to vault features
```

#### Harvest & Reward Flow:
```
Vault.harvest() [Called by keeper/user]
    ↓
For each adapter:
    ├→ VenusAdapter.harvest()
    │   ├→ Claim XVS rewards
    │   ├→ Swap XVS → USDC (via PancakeSwap)
    │   └→ Return USDC to vault
    │
    └→ PancakeSwapAdapter.harvest()
        ├→ Claim CAKE rewards
        ├→ Swap CAKE → USDC (via PancakeSwap)
        └→ Return USDC to vault
    ↓
Vault receives total yield
    ├→ Charge performance fee (10%)
    ├→ Calculate YBOT to mint (yield * reward rate)
    ├→ Mint YBOT tokens
    └→ Update accYBOTPerShare
    ↓
User.claimRewards()
    ├→ Calculate pending YBOT
    └→ Transfer YBOT to user
```

#### Yield Strategy Selection Flow:
```
User selects strategy (Frontend)
    ↓
fetchLiveYieldData() [yieldService]
    ↓
Fetch from multiple sources:
    ├→ Venus Protocol (on-chain)
    ├→ DefiLlama API
    └→ Beefy Finance API
    ↓
Categorize into 3 strategies:
    ├→ Safe Lending (Venus)
    ├→ Stablecoin LP (PancakeSwap)
    └→ Volatile LP (PancakeSwap)
    ↓
Display top pools with:
    - Protocol name
    - APY
    - TVL
    - Risk level
    ↓
User selects pool
    ↓
Vault routes capital to corresponding adapter
```

---

## 🔗 On-Chain Connections

### BSC Mainnet Contracts:

| Contract | Address | Purpose |
|----------|---------|---------|
| YBOT Token | 0x4f8e86D018377D3FA06609c7b238282ed530707f | Governance & rewards |
| YBOT Vault | 0x89Cfb540FAC158506659420252373e07072149e6 | Main yield aggregator |
| NFT Contract | 0x66BDE8b545443330a7a885B038E7A58089789A46 | Credit score NFTs |
| Venus Adapter | 0x92ef1D8244fc276A13dE03B895dadd0c3fcD01c2 | Venus integration |
| PancakeSwap Adapter | 0x5178Accee05D1Cb7a1580B2137cE337B547914C0 | PancakeSwap integration |
| Staking Contract | 0x031b7519EB8c864169c3f29B571e47407FA92b5d | YBOT staking |
| Bonding Curve | 0x06826d64d31c6A05D17D35ae658f47a3827bdd51 | Token sale |

### External Protocol Contracts:

| Protocol | Contract | Purpose |
|----------|----------|---------|
| Venus | 0xfD36E2c2a6789Db23113685031d7F16329158384 | Comptroller |
| Venus | 0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63 | XVS Token |
| Venus | 0xfD5840Cd36d94D7229439859C0112a4185BC0255 | vUSDT |
| Venus | 0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8 | vUSDC |
| PancakeSwap | 0x10ED43C718714eb63d5aA57B78f6c768417B050c | Router V2 |
| PancakeSwap | 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506 | Router V3 |
| PancakeSwap | 0xa5f8C5Dbd5F286960b9d7cb3694aEd42A57667AD | MasterChef V2 |
| USDC | 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d | Stablecoin |
| USDT | 0x55d398326f99059fF775485246999027B3197955 | Stablecoin |
| WBNB | 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c | Wrapped BNB |

---

## 📡 API Integrations

### External APIs:

| Service | Endpoint | Purpose |
|---------|----------|---------|
| DefiLlama | https://yields.llama.fi/pools | Yield data aggregation |
| Beefy Finance | https://api.beefy.finance/ | Vault APY & TVL |
| Venus API | https://api.venus.io/markets | Market data |
| CoinGecko | https://api.coingecko.com/api/v3 | Token prices |
| Moralis | https://api.moralis.com | Blockchain data |
| Pinata | https://api.pinata.cloud | IPFS storage |
| Alchemy | https://alchemy.com | Smart wallets & RPC |

---

## 🔐 Security Features

### Smart Contract Security:
1. **Reentrancy Guard** - Prevents reentrancy attacks
2. **Pausable** - Emergency pause functionality
3. **Slippage Protection** - 5% max slippage on swaps
4. **Deadline Checks** - 5-minute deadline on swaps
5. **Access Control** - Only vault can call adapters
6. **SafeERC20** - Safe token transfers
7. **Market Health Checks** - Venus market validation

### Frontend Security:
1. **Environment Variables** - Sensitive data in .env
2. **Mock Mode** - Demo without wallet
3. **Wallet Validation** - EIP-1193 provider check
4. **CORS** - Backend server for Pinata pinning

---

## 🚀 Deployment Architecture

### Frontend:
- **Build Tool**: Vite
- **Hosting**: Vercel (with Analytics)
- **Environment**: Node.js + npm

### Backend:
- **Server**: Express.js (Node.js)
- **Port**: 4001
- **Purpose**: Pinata pinning, webhook handling

### Smart Contracts:
- **Network**: BSC Mainnet & Testnet
- **Framework**: Hardhat
- **Compiler**: Solidity ^0.8.20

### Database:
- **IPFS**: Pinata (NFT metadata)
- **Blockchain**: BSC (on-chain state)
- **Cache**: Local storage (wagmi)

---

## 📊 Data Models

### UserFinanceData:
```typescript
{
  balanceBNB: string;
  balanceYBOT: string;
  usdtBalance: string;
  bnbBalance: string;
  stakedAmount: string;
  pendingYield: string;
  creditScore: number;
  creditTier: 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  hasSBT: boolean;
}
```

### VaultStats:
```typescript
{
  tvl: string;
  apy: number;
  totalYieldDistributed: string;
  nextRebalance: string;
}
```

### PoolData:
```typescript
{
  name: string;
  protocol: string;
  asset: string;
  apy: number;
  tvl: string;
  volume24h?: string;
  riskLevel: 'low' | 'medium' | 'high';
  impermanentLossRisk?: string;
}
```

---

## 🔄 Key Workflows

### 1. User Onboarding:
1. Connect wallet (MetaMask)
2. Switch to BSC
3. View dashboard with balances
4. Explore yield strategies
5. Deposit USDC to vault
6. Receive YBOT rewards

### 2. Yield Farming:
1. Vault receives USDC deposit
2. Distributes to adapters (50% Venus, 50% PancakeSwap)
3. Venus: Lends USDC, earns interest + XVS
4. PancakeSwap: Provides liquidity, earns CAKE
5. Keeper calls harvest() periodically
6. Adapters swap rewards to USDC
7. Vault mints YBOT based on yield
8. Users claim YBOT rewards

### 3. NFT Credit Scoring:
1. User completes financial actions
2. Credit score increases
3. Tier upgrades (Iron → Bronze → Silver → Gold → Platinum)
4. Mint SBT NFT representing tier
5. Metadata stored on Pinata IPFS
6. NFT grants vault access

### 4. AI Agent Trading:
1. User enables AI agent
2. Agent analyzes portfolio
3. Recommends yield strategies
4. Executes trades via smart wallet
5. Uses session keys for gasless transactions
6. Reports performance

---

## 🛠️ Development Setup

### Prerequisites:
- Node.js 18+
- Bun (for ElizaOS)
- MetaMask or compatible wallet

### Installation:
```bash
npm install
npm run dev  # Runs Vite + backend server
```

### Environment Variables (.env):
```
GOOGLE_GENERATIVE_AI_API_KEY=...
VITE_MORALIS_KEY=...
VITE_PINATA_KEY=...
VITE_ALCHEMY_KEY=...
VITE_REOWN_PROJECT_ID=...
```

### Smart Contract Deployment:
```bash
npx hardhat compile
npx hardhat deploy --network bsc-mainnet
```

---

## 📈 Performance Metrics

### Vault Metrics:
- **TVL**: $2.45M+
- **Average APY**: 12.8%
- **Total Yield Distributed**: $450K+
- **Rebalance Frequency**: Every 4-12 hours

### Strategy Performance:
- **Venus Lending**: 3-6% APY
- **Stablecoin LP**: 8-20% APY
- **Volatile LP**: 25-200% APY

---

## 🎯 Future Enhancements

1. **More Protocols**: Aave, Curve, Balancer
2. **Cross-Chain**: Ethereum, Polygon, Arbitrum
3. **Advanced AI**: Predictive yield optimization
4. **DAO Governance**: Community voting on strategies
5. **Mobile App**: React Native version
6. **Derivatives**: Options, futures trading

---

## 📝 Notes

- **Mock Mode**: App works without wallet for demo
- **Testnet Support**: Full testnet deployment available
- **Gas Optimization**: Batch operations, efficient storage
- **Slippage Protection**: 5% max on all swaps
- **Fee Structure**: 0.5% deposit, 0.5% withdrawal, 10% performance

