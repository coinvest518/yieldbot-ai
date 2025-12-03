// Deploy script for NFTNinja contract using Hardhat
// Usage: npx hardhat run scripts/deploy_hardhat.js --network bscTestnet

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with', deployer.address);

  const NFT = await ethers.getContractFactory('NFTNinja');
  const nft = await NFT.deploy('NFTNinja', 'NN', 10000, ethers.utils.parseEther('0.1'));
  await nft.deployed();

  console.log('NFTNinja deployed to', nft.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
