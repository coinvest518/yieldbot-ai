# YBOT Yield Vault - Complete Strategy Documentation

## Overview

The YBOT Yield Vault implements **3 distinct yield strategies** on BNB Chain, ranging from conservative to aggressive. Each strategy leverages battle-tested DeFi protocols with billions in TVL.

---

## 🏦 Strategy 1: Safe Lending (Venus Protocol)

### Description
Supply assets to Venus Protocol's lending pools to earn interest plus XVS token rewards. This is the safest strategy with minimal risk.

### Risk Level: LOW ✅
- No impermanent loss
- No liquidation risk (supply only)
- Battle-tested protocol with $2B+ TVL

### Expected APY: 2% - 6%
- Base lending APY: 2-4%
- XVS rewards: 0.5-1%
- Prime boost (for eligible users): Up to 12%

### Protocol: Venus Protocol

| Contract | BSC Mainnet Address |
|----------|---------------------|
| Comptroller | `0xfD36E2c2a6789Db23113685031d7F16329158384` |
| SwapRouter | `0x8938E6dA30b59c1E27d5f70a94688A89F7c815a4` |
| XVS Token | `0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63` |
| XVS Vault | `0x051100480289e704d20e9DB4804837068f3f9204` |
| Oracle | `0x6592b5DE802159F3E74B2486b091D11a8256ab8A` |

### Top Lending Pools (Live Data)

| Asset | vToken Address | Supply APY | Prime APY |
|-------|----------------|------------|-----------|
| USDT | `0xfD5840Cd36d94D7229439859C0112a4185BC0255` | 2.89% | 11.64% |
| USDC | `0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8` | 3.06% | 8.78% |
| BNB | `0xA07c5b74C9B40447a954e1466938b865b6BBea36` | 0.96% | - |
| BTCB | `0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B` | 0.09% | - |
| ETH | `0xf508fCD89b8bd15579dc79A6827cB4686A3592c8` | 0.15% | - |
| FDUSD | `0xC4eF4229FEc74Ccfe17B2bdeF7715fAC740BA0ba` | 4.20% | - |

### Integration Flow
```solidity
// 1. Approve vToken to spend underlying
IERC20(underlying).approve(vTokenAddress, amount);

// 2. Supply to Venus
IVToken(vTokenAddress).mint(amount);

// 3. Claim XVS rewards
IComptroller(comptroller).claimVenus(address(this));

// 4. Withdraw when needed
IVToken(vTokenAddress).redeemUnderlying(amount);
```

### APIs
- **Venus API**: `https://api.venus.io/markets`
- **Testnet API**: `https://testnetapi.venus.io/markets`

---

## 💎 Strategy 2: Stablecoin LP Farming

### Description
Provide liquidity to stablecoin pairs on PancakeSwap V3 with optional Beefy auto-compounding. Lower impermanent loss risk due to stable asset correlation.

### Risk Level: MEDIUM ⚠️
- Very low impermanent loss (stablecoins track each other)
- Smart contract risk (audited protocols)
- No liquidation risk

### Expected APY: 8% - 20%
- Trading fees: 3-5%
- CAKE rewards: 5-15%
- Beefy auto-compound boost: +10-30%

### Protocols: PancakeSwap V3 + Beefy Finance

| Contract | BSC Mainnet Address |
|----------|---------------------|
| PCS Factory V3 | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| SwapRouter V3 | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` |
| Smart Router | `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4` |
| Position Manager | `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364` |
| MasterChefV3 | `0x556B9306565093C855AEA9AE92A594704c2Cd59e` |
| CAKE Token | `0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82` |
| Beefy BIFI | `0xCa3F508B8e4Dd382eE878A314789373D80A5190A` |

### Top Stablecoin Pools

| Pair | Fee | Pool Address | APR | TVL |
|------|-----|--------------|-----|-----|
| USDT-USDC | 0.01% | `0x92b7807bF19b7DDdf89b706143896d05228f3121` | 12.5% | $45M |
| USDT-BUSD | 0.01% | `0x36842F8fb99D55477C0Da638aF5ceb6bBf86aA98` | 10.8% | $28M |
| FDUSD-USDT | 0.01% | `0x6EB9A78a1a97A6dfB4e7f34D13428d5A4B2A6f5F` | 15.2% | $18M |

### Beefy Vaults (Auto-compound)

| Vault ID | APY | Strategy |
|----------|-----|----------|
| `cakev3-bsc-usdt-usdc-0.01` | 14.8% | Auto-compound CAKE |
| `cakev3-bsc-usdt-busd-0.01` | 12.3% | Auto-compound CAKE |
| `venus-usdt` | 4.2% | Auto-compound XVS |

### Integration Flow
```solidity
// PancakeSwap V3 LP
// 1. Approve tokens to Position Manager
IERC20(token0).approve(positionManager, amount0);
IERC20(token1).approve(positionManager, amount1);

// 2. Create LP position
INonfungiblePositionManager(positionManager).mint(params);

// 3. Stake in MasterChefV3 for CAKE rewards
IMasterChefV3(masterChef).deposit(tokenId);

// 4. Harvest CAKE rewards
IMasterChefV3(masterChef).harvest(tokenId);

// Beefy Alternative (simpler)
// 1. Approve LP tokens to Beefy Vault
// 2. vault.deposit(amount) - auto-compounds
// 3. vault.withdraw(shares) - withdraw anytime
```

### APIs
- **PancakeSwap V3 Subgraph**: `https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc`
- **Farms API**: `https://farms-api.pancakeswap.com/v3/bsc/farms`
- **Beefy Vaults**: `https://api.beefy.finance/vaults`
- **Beefy APY**: `https://api.beefy.finance/apy`

---

## 🚀 Strategy 3: Volatile LP Farming

### Description
Provide liquidity to volatile pairs (e.g., BNB-USDT, CAKE-BNB) for higher yields. Higher APY but significant impermanent loss risk.

### Risk Level: HIGH ⚠️⚠️
- High impermanent loss risk
- Volatile asset exposure
- Requires active monitoring

### Expected APY: 25% - 200%
- Trading fees: 10-20%
- CAKE rewards: 15-100%+
- **Warning**: IL can offset or exceed gains

### Top Volatile Pools

| Pair | Fee | Pool Address | APR | TVL | IL Risk |
|------|-----|--------------|-----|-----|---------|
| CAKE-BNB | 0.25% | `0x7f51c8AaA6b0599abd16674e2b17FEc7a9f674A1` | 45.2% | $85M | High |
| BNB-USDT | 0.05% | `0x36696169C63e42cd08ce11f5deeBbCeBae652050` | 35.8% | $120M | Medium |
| ETH-BNB | 0.05% | `0x63912D2d75cd8D2e4CD76D6aB09C7C7Fe6b24a6E` | 28.5% | $45M | Medium |
| BTCB-BNB | 0.05% | `0x172fcD41E0913e95784454622d1c3724f546f849` | 22.3% | $38M | Medium |

### Beefy Vaults (Auto-compound)

| Vault ID | APY | Notes |
|----------|-----|-------|
| `cakev3-bsc-cake-wbnb-0.25` | 52.4% | CAKE-BNB pair |
| `cakev3-bsc-wbnb-usdt-0.05` | 38.2% | BNB-USDT pair |

### Impermanent Loss Calculator

For a 50/50 LP position:
| Price Change | IL |
|--------------|-----|
| ±10% | 0.11% |
| ±25% | 0.64% |
| ±50% | 2.02% |
| ±100% | 5.72% |
| 2x | 5.72% |
| 5x | 25.46% |

**Example**: BNB drops 50% → 2.02% IL + potential loss in BNB value

---

## 📡 Live Data APIs

### DefiLlama (Aggregated Data)
```bash
# All BSC yield pools
GET https://yields.llama.fi/pools

# Filter by protocol
GET https://yields.llama.fi/pools?project=venus-core-pool
GET https://yields.llama.fi/pools?project=pancakeswap-amm-v3
GET https://yields.llama.fi/pools?project=beefy
```

### Venus Protocol
```bash
# Markets data
GET https://api.venus.io/markets

# Pool data
GET https://api.venus.io/pools

# Testnet
GET https://testnetapi.venus.io/markets
```

### PancakeSwap
```bash
# Farms data
GET https://farms-api.pancakeswap.com/v3/bsc/farms

# V3 Subgraph Query
POST https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc
{
  pools(first: 100, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id
    token0 { symbol }
    token1 { symbol }
    feeTier
    liquidity
    totalValueLockedUSD
    volumeUSD
  }
}
```

### Beefy Finance
```bash
# All vaults
GET https://api.beefy.finance/vaults

# APY data
GET https://api.beefy.finance/apy

# TVL data
GET https://api.beefy.finance/tvl

# APY breakdown
GET https://api.beefy.finance/apy/breakdown
```

### Price Feeds
```bash
# CoinGecko
GET https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,pancakeswap-token,venus&vs_currencies=usd

# Chainlink (on-chain)
BNB/USD: 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE
BTC/USD: 0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf
ETH/USD: 0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e
CAKE/USD: 0xB6064eD41d4f67e353768aA239cA86f4F73665a1
```

---

## 💰 Yield Calculations

### Venus Lending APY
```javascript
// On-chain calculation
supplyRatePerBlock = vToken.supplyRatePerBlock()
blocksPerYear = 10512000 // BSC ~3 sec blocks
supplyAPY = (supplyRatePerBlock / 1e18) * blocksPerYear * 100
```

### PancakeSwap V3 APR
```javascript
// Fee APR
feeAPR = (fees24h * 365) / tvl * 100

// CAKE APR
cakeAPR = (cakeRewardsPerDay * cakePrice * 365) / tvl * 100

// Total APR
totalAPR = feeAPR + cakeAPR
```

### Beefy APY (with compounding)
```javascript
// Daily rate to APY
dailyRate = underlyingAPR / 365
beefyAPY = ((1 + dailyRate) ** 365 - 1) * 100
```

---

## 📊 Yield Estimates

| Investment | Strategy 1 (4%) | Strategy 2 (12%) | Strategy 3 (50%) |
|------------|-----------------|------------------|------------------|
| $10 | $0.40/yr | $1.20/yr | $5.00/yr |
| $100 | $4.00/yr | $12.00/yr | $50.00/yr |
| $1,000 | $40.00/yr | $120.00/yr | $500.00/yr |
| $10,000 | $400.00/yr | $1,200.00/yr | $5,000.00/yr |

**Note**: Strategy 3 yields are before impermanent loss. Actual returns may be significantly lower.

---

## 🔐 Security Considerations

### Protocol Audits
- **Venus**: Certik, PeckShield audited
- **PancakeSwap**: Multiple audits, $3B+ TVL
- **Beefy**: 400+ vaults, battle-tested

### Smart Contract Risk Mitigation
1. Use only audited protocols
2. Set deposit limits per strategy
3. Implement emergency withdrawal
4. Monitor pool health via oracles

### Recommended Allocation
| Risk Profile | S1 (Lending) | S2 (Stable LP) | S3 (Volatile LP) |
|--------------|--------------|----------------|------------------|
| Conservative | 80% | 20% | 0% |
| Moderate | 40% | 40% | 20% |
| Aggressive | 20% | 30% | 50% |

---

## 🛠️ Implementation Checklist

- [x] Define 3 yield strategies
- [x] Document all contract addresses
- [x] Create API integration service
- [x] Build yield calculation functions
- [x] Add live data fetching
- [x] Create dashboard component
- [ ] Implement vault smart contracts
- [ ] Add strategy switching logic
- [ ] Build auto-rebalancing
- [ ] Deploy to testnet
- [ ] Production deployment

---

## 📚 Resources

- [Venus Protocol Docs](https://docs.venus.io)
- [PancakeSwap V3 Docs](https://developer.pancakeswap.finance)
- [Beefy Finance Docs](https://docs.beefy.finance)
- [DefiLlama API](https://api-docs.defillama.com)
- [BSCScan](https://bscscan.com)
