import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Repeat } from 'lucide-react';

interface TickerItem {
  symbol: string;
  price: string;
  change: number;
  type: 'price' | 'trade';
  tradeType?: 'buy' | 'sell';
  amount?: string;
}

// Top tokens to show
const TOP_TOKENS = 'bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron,chainlink,polkadot,avalanche-2,shiba-inu,uniswap,litecoin,cosmos';

const LiveTicker: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch top tokens from CoinGecko (free, no auth)
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${TOP_TOKENS}&vs_currencies=usd&include_24hr_change=true`
        );
        const data = await res.json();
        
        const symbolMap: Record<string, string> = {
          bitcoin: 'BTC', ethereum: 'ETH', binancecoin: 'BNB', solana: 'SOL',
          ripple: 'XRP', cardano: 'ADA', dogecoin: 'DOGE', tron: 'TRX',
          chainlink: 'LINK', polkadot: 'DOT', 'avalanche-2': 'AVAX',
          'shiba-inu': 'SHIB', uniswap: 'UNI', litecoin: 'LTC', cosmos: 'ATOM'
        };

        const tickerItems: TickerItem[] = [
          // Add YBOT first
          { symbol: 'YBOT', price: '$1.00', change: 0, type: 'price' },
        ];

        // Add all fetched tokens
        Object.entries(data).forEach(([id, info]: [string, any]) => {
          const symbol = symbolMap[id] || id.toUpperCase();
          const price = info.usd;
          const change = info.usd_24h_change || 0;
          
          tickerItems.push({
            symbol,
            price: price >= 1 ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${price.toFixed(6)}`,
            change: parseFloat(change.toFixed(2)),
            type: 'price'
          });
        });

        setItems(tickerItems);
      } catch (error) {
        console.error('Ticker fetch error:', error);
        // Fallback
        setItems([
          { symbol: 'BTC', price: '$100,000', change: 1.2, type: 'price' },
          { symbol: 'ETH', price: '$3,500', change: 2.1, type: 'price' },
          { symbol: 'BNB', price: '$650', change: 0.8, type: 'price' },
          { symbol: 'SOL', price: '$200', change: 3.5, type: 'price' },
          { symbol: 'YBOT', price: '$1.00', change: 0, type: 'price' },
        ]);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <div 
      className="fixed top-16 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-b border-white/5 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={`flex gap-6 py-1.5 px-4 ${isPaused ? '' : 'animate-ticker'}`}>
        {/* Triple duplicate for seamless loop */}
        {[...items, ...items, ...items].map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <span className="text-gray-400 font-medium">{item.symbol}</span>
            <span className="text-white">{item.price}</span>
            <span className={`flex items-center gap-0.5 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(item.change).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveTicker;
