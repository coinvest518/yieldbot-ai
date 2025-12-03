/**
 * Deployment Script for YBOTYieldVault System
 * 
 * Deploys:
 * 1. YBOTYieldVault - Main vault with YBOT token gate and rewards
 * 2. VenusAdapter - For Venus Protocol lending (BSC)
 * 
 * Prerequisites:
 * - Set DEPLOYER_PRIVATE_KEY in .env
 * - Set BSC_TESTNET_RPC in .env (optional, uses default if not set)
 * - YBOT token should already be deployed
 * 
 * Usage:
 * npx hardhat run scripts/deploy_vault.js --network bscTestnet
 */

import hre from 'hardhat';
const { ethers } = hre;

// ============ Configuration ============

// BSC Testnet Addresses
const BSC_TESTNET = {
  // Your existing YBOT Token
  YBOT_TOKEN: "0x5cBbBe32b2893DDCca439372F6AD120C848B2712",
  
  // Deposit tokens (stablecoins)
  USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // BSC Testnet USDT
  BUSD: "0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee", // BSC Testnet BUSD
  
  // Venus Protocol (BSC Testnet)
  VENUS_COMPTROLLER: "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D",
  V_USDT: "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A", // vUSDT
  V_BUSD: "0x08e0A5575De71037aE36AbfAfb516595fE68e5e4", // vBUSD
  XVS_TOKEN: "0xB9e0E753630434d7863528cc73CB7AC638a7c8ff",
  
  // PancakeSwap
  PANCAKE_ROUTER: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
};

// BSC Mainnet Addresses (for reference)
const BSC_MAINNET = {
  YBOT_TOKEN: "0x5cBbBe32b2893DDCca439372F6AD120C848B2712", // Update with mainnet address
  
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  
  VENUS_COMPTROLLER: "0xfD36E2c2a6789Db23113685031d7F16329158384",
  V_USDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
  V_BUSD: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D",
  XVS_TOKEN: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
  
  PANCAKE_ROUTER: "0x10ED43C718714eb63d5aA57B78B54Ab54A54A54A",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
};

// Vault Configuration
const VAULT_CONFIG = {
  minYBOTBalance: ethers.parseUnits("100", 18), // 100 YBOT required
  ybotRewardRate: 10n,     // 10 YBOT per 1 USDT of yield
  depositFeeBps: 50n,      // 0.5%
  withdrawalFeeBps: 50n,   // 0.5%
  performanceFeeBps: 2000n, // 20%
};

// ============ Deployment Functions ============

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log("Network:", network.name, "Chain ID:", chainId);

  // Select addresses based on network
  const addresses = chainId === 97 ? BSC_TESTNET : BSC_MAINNET;
  console.log("Using addresses:", chainId === 97 ? "BSC Testnet" : "BSC Mainnet");

  // 1. Deploy YBOTYieldVault
  console.log("\n1. Deploying YBOTYieldVault...");
  const YBOTYieldVault = await ethers.getContractFactory("YBOTYieldVault");
  const vault = await YBOTYieldVault.deploy(
    addresses.USDT,                    // depositToken_
    addresses.YBOT_TOKEN,              // ybotToken_
    deployer.address,                  // owner_
    deployer.address,                  // feeCollector_ (update to treasury)
    VAULT_CONFIG.minYBOTBalance,
    VAULT_CONFIG.ybotRewardRate,
    VAULT_CONFIG.depositFeeBps,
    VAULT_CONFIG.withdrawalFeeBps,
    VAULT_CONFIG.performanceFeeBps
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   YBOTYieldVault deployed to:", vaultAddress);

  // 2. Deploy VenusAdapter
  console.log("\n2. Deploying VenusAdapter...");
  const VenusAdapter = await ethers.getContractFactory("VenusAdapter");
  const venusAdapter = await VenusAdapter.deploy(
    addresses.USDT,              // asset_
    addresses.V_USDT,            // vToken_
    vaultAddress,                // vault_
    addresses.VENUS_COMPTROLLER, // comptroller_
    addresses.XVS_TOKEN,         // xvs_
    addresses.PANCAKE_ROUTER     // swapRouter_
  );
  await venusAdapter.waitForDeployment();
  const venusAdapterAddress = await venusAdapter.getAddress();
  console.log("   VenusAdapter deployed to:", venusAdapterAddress);

  // 3. Add VenusAdapter to Vault (100% allocation initially)
  console.log("\n3. Adding VenusAdapter to vault...");
  const addTx = await vault.addAdapter(venusAdapterAddress, 10000); // 100% allocation
  await addTx.wait();
  console.log("   VenusAdapter added with 100% allocation");

  // ============ Summary ============
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", chainId === 97 ? "BSC Testnet" : "BSC Mainnet");
  console.log("Deployer:", deployer.address);
  console.log("");
  console.log("Contracts:");
  console.log("  YBOTYieldVault:", vaultAddress);
  console.log("  VenusAdapter:", venusAdapterAddress);
  console.log("");
  console.log("Configuration:");
  console.log("  Deposit Token:", addresses.USDT);
  console.log("  YBOT Token:", addresses.YBOT_TOKEN);
  console.log("  Min YBOT Balance:", ethers.formatUnits(VAULT_CONFIG.minYBOTBalance, 18));
  console.log("  YBOT Reward Rate:", VAULT_CONFIG.ybotRewardRate.toString(), "YBOT per 1 deposit token yield");
  console.log("  Deposit Fee:", Number(VAULT_CONFIG.depositFeeBps) / 100 + "%");
  console.log("  Withdrawal Fee:", Number(VAULT_CONFIG.withdrawalFeeBps) / 100 + "%");
  console.log("  Performance Fee:", Number(VAULT_CONFIG.performanceFeeBps) / 100 + "%");
  console.log("=".repeat(60));

  // ============ Verification Commands ============
  console.log("\nVerification Commands:");
  console.log(`npx hardhat verify --network bscTestnet ${vaultAddress} \\`);
  console.log(`  "${addresses.USDT}" \\`);
  console.log(`  "${addresses.YBOT_TOKEN}" \\`);
  console.log(`  "${deployer.address}" \\`);
  console.log(`  "${deployer.address}" \\`);
  console.log(`  "${VAULT_CONFIG.minYBOTBalance}" \\`);
  console.log(`  "${VAULT_CONFIG.ybotRewardRate}" \\`);
  console.log(`  "${VAULT_CONFIG.depositFeeBps}" \\`);
  console.log(`  "${VAULT_CONFIG.withdrawalFeeBps}" \\`);
  console.log(`  "${VAULT_CONFIG.performanceFeeBps}"`);
  console.log("");
  console.log(`npx hardhat verify --network bscTestnet ${venusAdapterAddress} \\`);
  console.log(`  "${addresses.USDT}" \\`);
  console.log(`  "${addresses.V_USDT}" \\`);
  console.log(`  "${vaultAddress}" \\`);
  console.log(`  "${addresses.VENUS_COMPTROLLER}" \\`);
  console.log(`  "${addresses.XVS_TOKEN}" \\`);
  console.log(`  "${addresses.PANCAKE_ROUTER}"`);

  // Return deployed addresses for scripts
  return {
    vault: vaultAddress,
    venusAdapter: venusAdapterAddress,
    config: VAULT_CONFIG,
    addresses
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
