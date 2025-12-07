// Test Moralis API for fundraiser contract events
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjdiYWVkNDA0LTIyOGEtNGJhNS04ZTBmLTg5OGVhZmIwNTYyYSIsIm9yZ0lkIjoiNjgyOCIsInVzZXJJZCI6IjEzNjM0IiwidHlwZUlkIjoiYmYzZjA4OWMtNTJkMy00NzdlLWIzNTItNTNhN2ZlOGJhMjQ1IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDY3NTQyNzcsImV4cCI6NDkwMjUxNDI3N30.5a68P3gaLK9CM40FX9MHL6-MY5TBv4tz6ZJPhEnhT5M';
const contractAddress = '0x06826d64d31c6A05D17D35ae658f47a3827bdd51';

// Event signatures - keccak256 hash of event signature
const TOKENS_PURCHASED_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'; // TokensPurchased(address,uint256,uint256,uint256,uint256)
const TOKENS_SOLD_TOPIC = '0x9c52a3c95b3d0b9b6b3b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b'; // TokensSold(address,uint256,uint256,uint256,uint256)

async function checkContractEvents() {
  console.log('Checking contract events via Moralis...');
  console.log('Contract:', contractAddress);
  console.log('Chain: BSC Mainnet (0x38)');

  try {
    // Check for any events from this contract
    const response = await fetch(`https://deep-index.moralis.io/api/v2.2/${contractAddress}/logs?chain=0x38&limit=20`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });

    if (!response.ok) {
      console.error('Moralis API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('Contract logs found:', data.result?.length || 0);

    if (data.result && data.result.length > 0) {
      console.log('Recent logs:');
      data.result.slice(0, 5).forEach((log, i) => {
        console.log(`${i+1}. Block: ${log.block_number}, Tx: ${log.transaction_hash?.slice(0, 10)}..., Topic0: ${log.topic0?.slice(0, 10)}...`);
        if (log.topic0 === TOKENS_PURCHASED_TOPIC) {
          console.log('   -> TOKENS PURCHASED EVENT!');
        } else if (log.topic0 === TOKENS_SOLD_TOPIC) {
          console.log('   -> TOKENS SOLD EVENT!');
        }
      });
    } else {
      console.log('No logs found for this contract');
    }

    // Also try the events endpoint
    console.log('\nTrying events endpoint...');
    const eventsResponse = await fetch(`https://deep-index.moralis.io/api/v2.2/${contractAddress}/events?chain=0x38&limit=10`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });

    const eventsData = await eventsResponse.json();
    console.log('Events endpoint result:', eventsData.result?.length || 0);

  } catch (error) {
    console.error('Error checking Moralis:', error);
  }
}

checkContractEvents();