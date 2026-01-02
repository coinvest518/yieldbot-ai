import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract details
const CONTRACT_ADDRESS = '0xfFf743E45d122D9a1eEC4f7A0906d9466072Ab66';
const CONTRACT_ABI = [
  'function setClaimAmount(bytes32 claimCode, uint256 amount) external',
];

// Read CSV from IPFS and calculate claim amounts
async function parseWinners() {
  const ipfsHash = process.env.VITE_WINNERS_IPFS_HASH;
  const gateway = process.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
  const url = `${gateway}/${ipfsHash}`;
  
  const response = await fetch(url);
  const csv = await response.text();
  
  const lines = csv.trim().split('\n');
  const winners = [];
  
  // CSV format: Rank,Name,Social Media/Tag,Email,Location,Date
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 4) {
      const ranking = parseInt(parts[0]) || 0;
      const email = parts[3]?.trim() || '';
      
      if (email && ranking > 0) {
        let amount = 10; // default
        if (ranking <= 10) amount = 100;
        else if (ranking <= 50) amount = 50;
        else if (ranking <= 100) amount = 25;
        
        winners.push({ email, ranking, amount });
      }
    }
  }
  
  return winners;
}

async function setClaimAmounts() {
  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  
  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  
  // Parse winners from IPFS
  const winners = await parseWinners();
  
  console.log(`Found ${winners.length} winners`);
  
  // Set claim amounts
  for (const winner of winners) {
    const claimCode = ethers.id(winner.email.toLowerCase());
    const amountInWei = ethers.parseEther(winner.amount.toString());
    
    console.log(`Setting claim for ${winner.email} (rank ${winner.ranking}): ${winner.amount} YBOT`);
    
    try {
      const tx = await contract.setClaimAmount(claimCode, amountInWei);
      await tx.wait();
      console.log(`✓ Set claim for ${winner.email}`);
    } catch (err: any) {
      console.error(`✗ Failed for ${winner.email}:`, err.message);
    }
  }
  
  console.log('Done!');
}

setClaimAmounts().catch(console.error);
