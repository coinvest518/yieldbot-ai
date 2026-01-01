import hre from 'hardhat';

async function main() {
  const YBOT_TOKEN = process.env.VITE_YBOT_TOKEN_MAINNET || '0x4f8e86D018377D3FA06609c7b238282ed530707f';
  
  console.log('Deploying WinnerClaims with YBOT:', YBOT_TOKEN);
  
  const WinnerClaims = await hre.ethers.getContractFactory('WinnerClaims');
  const winnerClaims = await WinnerClaims.deploy(YBOT_TOKEN);
  
  await winnerClaims.waitForDeployment();
  const address = await winnerClaims.getAddress();
  
  console.log('WinnerClaims deployed to:', address);
  console.log('Add to .env: VITE_WINNER_CLAIMS_CONTRACT=' + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
