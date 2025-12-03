/**
 * API Connection Test Script
 * Run this to verify all yield protocol APIs are working
 * 
 * Usage: npx ts-node scripts/testApiConnections.ts
 * Or import and run testAllConnections() in browser console
 */

// API Endpoints
const API_ENDPOINTS = {
  defiLlama: 'https://yields.llama.fi/pools',
  beefy: {
    vaults: 'https://api.beefy.finance/vaults',
    apy: 'https://api.beefy.finance/apy',
    tvl: 'https://api.beefy.finance/tvl'
  },
  venus: 'https://api.venus.io/markets?chainId=56', // BSC Mainnet chainId
  venusTestnet: 'https://api.venus.io/markets?chainId=97', // BSC Testnet
  coingecko: 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,pancakeswap-token,venus&vs_currencies=usd'
};

interface TestResult {
  name: string;
  status: 'success' | 'failed';
  latencyMs: number;
  dataCount?: number;
  sampleData?: any;
  error?: string;
}

/**
 * Test DefiLlama Yields API
 */
async function testDefiLlama(): Promise<TestResult> {
  const start = Date.now();
  const name = 'DefiLlama Yields API';
  
  try {
    const response = await fetch(API_ENDPOINTS.defiLlama);
    const data = await response.json();
    
    // Filter for BSC pools
    const bscPools = data.data.filter((pool: any) => 
      pool.chain === 'BSC' || pool.chain === 'Binance'
    );
    
    // Get top 3 by APY
    const topPools = bscPools
      .sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 3)
      .map((p: any) => ({
        symbol: p.symbol,
        project: p.project,
        apy: p.apy?.toFixed(2) + '%',
        tvl: '$' + (p.tvlUsd / 1e6).toFixed(2) + 'M'
      }));

    return {
      name,
      status: 'success',
      latencyMs: Date.now() - start,
      dataCount: bscPools.length,
      sampleData: topPools
    };
  } catch (error: any) {
    return {
      name,
      status: 'failed',
      latencyMs: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * Test Venus Protocol API
 */
async function testVenus(): Promise<TestResult> {
  const start = Date.now();
  const name = 'Venus Protocol API';
  
  try {
    const response = await fetch(API_ENDPOINTS.venus);
    const data = await response.json();
    
    // Get markets from response
    const markets = data.result || data.data || data;
    const marketCount = Array.isArray(markets) ? markets.length : Object.keys(markets).length;
    
    // Sample top markets
    const topMarkets = Array.isArray(markets) 
      ? markets.slice(0, 3).map((m: any) => ({
          symbol: m.symbol || m.underlyingSymbol,
          supplyApy: (parseFloat(m.supplyApy || m.supplyRate || '0')).toFixed(2) + '%',
          borrowApy: (parseFloat(m.borrowApy || m.borrowRate || '0')).toFixed(2) + '%'
        }))
      : [{ note: 'Response structure different than expected', raw: JSON.stringify(markets).slice(0, 200) }];

    return {
      name,
      status: 'success',
      latencyMs: Date.now() - start,
      dataCount: marketCount,
      sampleData: topMarkets
    };
  } catch (error: any) {
    return {
      name,
      status: 'failed',
      latencyMs: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * Test Beefy Finance API
 */
async function testBeefy(): Promise<TestResult> {
  const start = Date.now();
  const name = 'Beefy Finance API';
  
  try {
    // Fetch vaults and APY in parallel
    const [vaultsRes, apyRes] = await Promise.all([
      fetch(API_ENDPOINTS.beefy.vaults),
      fetch(API_ENDPOINTS.beefy.apy)
    ]);
    
    const vaults = await vaultsRes.json();
    const apyData = await apyRes.json();
    
    // Filter for BSC vaults
    const bscVaults = vaults.filter((v: any) => v.chain === 'bsc');
    
    // Get top 3 by APY
    const topVaults = bscVaults
      .map((v: any) => ({
        id: v.id,
        name: v.name,
        apy: ((apyData[v.id] || 0) * 100).toFixed(2) + '%',
        platform: v.platformId
      }))
      .sort((a: any, b: any) => parseFloat(b.apy) - parseFloat(a.apy))
      .slice(0, 3);

    return {
      name,
      status: 'success',
      latencyMs: Date.now() - start,
      dataCount: bscVaults.length,
      sampleData: topVaults
    };
  } catch (error: any) {
    return {
      name,
      status: 'failed',
      latencyMs: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * Test CoinGecko Price API
 */
async function testCoinGecko(): Promise<TestResult> {
  const start = Date.now();
  const name = 'CoinGecko Price API';
  
  try {
    const response = await fetch(API_ENDPOINTS.coingecko);
    const data = await response.json();
    
    const prices = Object.entries(data).map(([token, price]: [string, any]) => ({
      token,
      usd: '$' + price.usd.toFixed(2)
    }));

    return {
      name,
      status: 'success',
      latencyMs: Date.now() - start,
      dataCount: prices.length,
      sampleData: prices
    };
  } catch (error: any) {
    return {
      name,
      status: 'failed',
      latencyMs: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * Run all API tests
 */
export async function testAllConnections(): Promise<{
  results: TestResult[];
  summary: { passed: number; failed: number; totalTime: number };
}> {
  console.log('\n🧪 Testing API Connections...\n');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  // Run all tests
  const results = await Promise.all([
    testDefiLlama(),
    testVenus(),
    testBeefy(),
    testCoinGecko()
  ]);
  
  // Print results
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`\n${icon} ${result.name}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Latency: ${result.latencyMs}ms`);
    
    if (result.status === 'success') {
      passed++;
      console.log(`   Records: ${result.dataCount}`);
      console.log(`   Sample Data:`);
      console.log(JSON.stringify(result.sampleData, null, 2).split('\n').map(l => '      ' + l).join('\n'));
    } else {
      failed++;
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Total Time: ${totalTime}ms`);
  console.log('\n');
  
  return {
    results,
    summary: { passed, failed, totalTime }
  };
}

// Export individual tests for selective testing
export {
  testDefiLlama,
  testVenus,
  testBeefy,
  testCoinGecko
};

// Run if executed directly (Node.js CLI only)
// Check for Node.js environment more carefully to avoid browser errors
const isNodeCLI = typeof process !== 'undefined' 
  && typeof process.versions !== 'undefined'
  && typeof process.versions.node !== 'undefined'
  && typeof window === 'undefined';

if (isNodeCLI && process.argv?.[1]?.includes('testApiConnections')) {
  testAllConnections().then(({ summary }) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
