// Test direct RPC call to check contract events
import { ethers } from 'ethers';

const contractAddress = '0x06826d64d31c6A05D17D35ae658f47a3827bdd51';
const RPC_URL = 'https://bsc-dataseed.binance.org';

async function checkContractEvents() {
  console.log('Checking contract events via direct RPC...');
  console.log('Contract:', contractAddress);
  console.log('RPC:', RPC_URL);

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock);

    // Check last 100 blocks instead of 1000 to avoid rate limits
    const fromBlock = Math.max(0, currentBlock - 100);
    console.log(`Checking blocks ${fromBlock} to ${currentBlock}`);

    const filter = {
      address: contractAddress,
      fromBlock: fromBlock,
      toBlock: 'latest'
    };

    const logs = await provider.getLogs(filter);
    console.log(`Found ${logs.length} logs for contract`);

    if (logs.length > 0) {
      console.log('Recent logs:');
      logs.slice(-5).forEach((log, i) => { // Show last 5
        console.log(`${i+1}. Block: ${log.blockNumber}, Tx: ${log.transactionHash.slice(0, 10)}..., Topics: ${log.topics.length}`);
        console.log(`   Topic0: ${log.topics[0]}`);
        console.log(`   Data length: ${log.data.length}`);
      });
    } else {
      console.log('No logs found - contract may have no transactions yet');
    }

    // Also check if contract exists
    const code = await provider.getCode(contractAddress);
    console.log('Contract code length:', code.length);
    if (code === '0x') {
      console.log('❌ Contract does not exist at this address!');
    } else {
      console.log('✅ Contract exists at this address');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkContractEvents();