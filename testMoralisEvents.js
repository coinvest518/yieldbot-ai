/**
 * Test Moralis API integration for fundraiser events
 */
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function testMoralisEvents() {
  const MORALIS_API_KEY = process.env.VITE_MORALIS_KEY;
  const ybotTokenContract = '0x4f8e86d018377d3fa06609c7b238282ed530707f'; // YBOT token contract
  const fundraiserContract = '0x06826d64d31c6A05D17D35ae658f47a3827bdd51'; // Fundraiser contract

  if (!MORALIS_API_KEY) {
    console.error('❌ No Moralis API key found in .env (VITE_MORALIS_KEY)');
    return;
  }

  console.log('🔍 Testing Moralis APIs for YBOT fundraiser events...');
  console.log('📋 YBOT Token Contract:', ybotTokenContract);
  console.log('📋 Fundraiser Contract:', fundraiserContract);
  console.log('🔑 API Key:', MORALIS_API_KEY.substring(0, 10) + '...');

  try {
    // Test 1: ERC20 transfers for YBOT token (should show token movements)
    console.log('\n📊 Test 1: YBOT Token ERC20 Transfers...');
    const tokenTransfersUrl = `https://deep-index.moralis.io/api/v2.2/erc20/${ybotTokenContract}/transfers?chain=bsc&limit=10`;

    const tokenResponse = await fetch(tokenTransfersUrl, {
      headers: {
        'X-API-Key': MORALIS_API_KEY,
        'accept': 'application/json'
      }
    });

    console.log('📡 Token Transfers Response:', tokenResponse.status, tokenResponse.statusText);

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      console.log(`✅ Found ${tokenData.result?.length || 0} YBOT token transfers`);

      if (tokenData.result?.length > 0) {
        console.log('\n📋 Recent YBOT transfers:');
        for (let i = 0; i < Math.min(3, tokenData.result.length); i++) {
          const transfer = tokenData.result[i];
          console.log(`\n--- Transfer ${i + 1} ---`);
          console.log('From:', transfer.from_address);
          console.log('To:', transfer.to_address);
          console.log('Value:', transfer.value, 'YBOT');
          console.log('Transaction:', transfer.transaction_hash?.substring(0, 20) + '...');
          console.log('Block:', transfer.block_number);
        }
      }
    } else {
      const errorText = await tokenResponse.text();
      console.log('❌ Token API Error:', errorText);
    }

    // Test 2: Custom events from fundraiser contract (should show purchase/sell events)
    console.log('\n📊 Test 2: Fundraiser Contract Custom Events...');
    console.log('⚠️  Note: This will likely fail as Moralis deprecated /logs and /events endpoints');
    console.log('💡 For production, use paid RPC or implement event indexing');

    // This will fail, but let's show what we're trying to do
    const eventUrl = `https://deep-index.moralis.io/api/v2.2/${fundraiserContract}/logs?chain=bsc&limit=5`;

    const eventResponse = await fetch(eventUrl, {
      headers: {
        'X-API-Key': MORALIS_API_KEY,
        'accept': 'application/json'
      }
    });

    console.log('📡 Event Response:', eventResponse.status, eventResponse.statusText);

    if (eventResponse.ok) {
      const eventData = await eventResponse.json();
      console.log(`✅ Found ${eventData.result?.length || 0} fundraiser events`);
    } else {
      console.log('❌ As expected - Moralis deprecated this endpoint');
      console.log('💡 Solution: Use direct RPC calls or paid services for custom contract events');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMoralisEvents();