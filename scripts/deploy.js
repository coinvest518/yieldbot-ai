import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get token address from env
  const tokenAddress = process.env.YBOT_TOKEN_TESTNET;
  if (!tokenAddress) {
    throw new Error("YBOT_TOKEN_TESTNET not set in .env");
  }

  // Deploy NFTNinja
  const NFTNinja = await hre.ethers.getContractFactory("NFTNinja");
  const maxSupply = 50; // Match generated NFTs
  const mintPrice = hre.ethers.parseEther("1"); // 1 token
  const contract = await NFTNinja.deploy("NFTNinja", "NNJ", maxSupply, mintPrice, tokenAddress);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("NFTNinja deployed to:", contractAddress);

  // Save to a file or console
  console.log("Token Address:", tokenAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });