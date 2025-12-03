// Simple price display service
// 1 YBOT = 1 USDC (your pricing)
// BNB price fetched from CoinGecko (free, no auth needed)

export const getPrices = async (): Promise<{
  bnbPriceUSD: number;
  ybotPerBNB: number;
  ybotPerUSDC: number;
}> => {
  try {
    // Get BNB price from CoinGecko (free API, no auth)
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd'
    );
    const data = await res.json();
    const bnbPriceUSD = data.binancecoin.usd;

    // Your pricing: 1 YBOT = 1 USDC
    const ybotPerUSDC = 1;
    const ybotPerBNB = bnbPriceUSD * ybotPerUSDC;

    return {
      bnbPriceUSD,
      ybotPerBNB,
      ybotPerUSDC
    };
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    // Fallback prices
    return {
      bnbPriceUSD: 300,
      ybotPerBNB: 300,
      ybotPerUSDC: 1
    };
  }
};
