import React from 'react';
import { ArrowRight, Lock, TrendingUp, ShieldCheck } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <div className="relative pt-40 pb-16 overflow-hidden min-h-[85vh] flex items-center">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-ybot-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-ybot-cyan/10 rounded-full blur-[100px]" />
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-center">
          
          <div className="lg:col-span-7 text-center lg:text-left z-20">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-ybot-gold/30 bg-ybot-gold/10 text-ybot-gold text-xs font-mono font-bold tracking-widest uppercase mb-8">
              <span className="flex h-2 w-2 rounded-full bg-ybot-gold mr-2 animate-pulse"></span>
              APY Protocol Live
            </div>
            
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-white mb-6 leading-[1.1]">
              Automate Your <br />
              <span className="text-gradient">Financial Future</span>
            </h1>
            
            <p className="mt-4 text-lg text-ybot-muted mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
              yBot isn't just a token. It's an automated investment engine. 
              Hold $YBOT to access the Vault, earn yields from diversified DeFi strategies, 
              and build your <strong>Soulbound Credit Score</strong> to unlock borrowing power.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a 
                href="#vault"
                className="inline-flex justify-center items-center px-8 py-4 border border-transparent text-base font-bold rounded-lg text-white bg-ybot-primary hover:bg-ybot-primaryHover transition-all transform hover:-translate-y-1 shadow-[0_0_30px_rgba(99,102,241,0.4)]"
              >
                Access Vault
                <ArrowRight className="ml-2 -mr-1 h-5 w-5" />
              </a>
              <a 
                href="#roadmap"
                className="inline-flex justify-center items-center px-8 py-4 border border-white/10 text-base font-bold rounded-lg text-white bg-white/5 hover:bg-white/10 transition-all backdrop-blur-sm"
              >
                View Roadmap
              </a>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 grid grid-cols-3 gap-8">
               <div className="text-center lg:text-left">
                  <div className="text-3xl font-display font-bold text-white">$2.4M</div>
                  <div className="text-xs text-ybot-muted uppercase tracking-wider mt-1">Total Value Locked</div>
               </div>
               <div className="text-center lg:text-left">
                  <div className="text-3xl font-display font-bold text-ybot-gold">12.8%</div>
                  <div className="text-xs text-ybot-muted uppercase tracking-wider mt-1">Average APY</div>
               </div>
               <div className="text-center lg:text-left">
                  <div className="text-3xl font-display font-bold text-ybot-cyan">5k+</div>
                  <div className="text-xs text-ybot-muted uppercase tracking-wider mt-1">Credit Holders</div>
               </div>
            </div>
          </div>

          <div className="mt-20 lg:mt-0 lg:col-span-5 relative hidden lg:flex justify-center items-center">
            {/* 3D Abstract Representation */}
            <div className="relative w-full max-w-[380px] aspect-[4/5] animate-float">
               
               {/* Main Card Panel */}
               <div className="absolute inset-0 bg-gradient-to-br from-ybot-card to-ybot-dark border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 z-20">
                  <div className="w-24 h-24 bg-ybot-primary/20 rounded-full flex items-center justify-center mb-6 relative">
                     <Lock className="w-10 h-10 text-ybot-primary z-10" />
                     <div className="absolute inset-0 border border-ybot-primary/30 rounded-full animate-ping opacity-20"></div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Vault Active</h3>
                  <div className="w-full bg-ybot-dark rounded-full h-2 mt-4 overflow-hidden">
                     <div className="bg-ybot-cyan w-[75%] h-full animate-shine bg-[length:200%_100%] bg-gradient-to-r from-ybot-cyan via-white/50 to-ybot-cyan"></div>
                  </div>
                  <div className="flex justify-between w-full text-xs text-ybot-muted mt-2">
                     <span>Yield Generating</span>
                     <span className="text-ybot-cyan">Processing...</span>
                  </div>

                  {/* Floating Elements attached to card */}
                  
                  {/* Right Badge */}
                  <div className="absolute -right-4 top-12 bg-ybot-card border border-white/10 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-pulse-slow backdrop-blur-md">
                     <div className="p-2 bg-green-500/20 rounded-lg"><TrendingUp size={16} className="text-green-500" /></div>
                     <div>
                        <div className="text-[10px] text-gray-400 uppercase">Yield Paid</div>
                        <div className="font-bold text-green-400 text-sm">+$452.00</div>
                     </div>
                  </div>

                  {/* Left Badge */}
                  <div className="absolute -left-4 bottom-12 bg-ybot-card border border-white/10 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-float backdrop-blur-md" style={{animationDelay: '1.5s'}}>
                     <div className="p-2 bg-ybot-gold/20 rounded-lg"><ShieldCheck size={16} className="text-ybot-gold" /></div>
                     <div>
                        <div className="text-[10px] text-gray-400 uppercase">Credit Score</div>
                        <div className="font-bold text-white text-sm">720 (Gold)</div>
                     </div>
                  </div>
               </div>
               
               {/* Glow behind */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[100%] bg-ybot-primary/20 blur-[60px] -z-10 rounded-full" />
            </div>
          </div>
        </div>

        {/* Partners & Listings Section */}
        <div className="mt-20 pt-12 border-t border-white/5">
          {/* Listed On */}
          <div className="text-center mb-10">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Listed & Tracked On</p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <a href="https://coinmooner.com/coins/yield-bot-ybot" target="_blank" rel="noopener noreferrer" className="partner-card">
                <img src="/coinmooner.png" alt="CoinMooner" className="h-5" />
                <span>CoinMooner</span>
              </a>
              <a href="https://pancakeswap.finance/swap?outputCurrency=0xYBOT" target="_blank" rel="noopener noreferrer" className="partner-card">
                <img src="https://assets.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo_%281%29.png" alt="PancakeSwap" className="h-6" />
                <span>PancakeSwap</span>
              </a>
              <a href="https://dexscreener.com/bsc" target="_blank" rel="noopener noreferrer" className="partner-card">
                <img src="https://dexscreener.com/favicon.png" alt="DEXScreener" className="h-5" />
                <span>DEXScreener</span>
              </a>
              <a href="https://www.dextools.io/app/en/bnb/pairs" target="_blank" rel="noopener noreferrer" className="partner-card">
                <img src="/dextools.svg" alt="DEXTools" className="h-5" />
                <span>DEXTools</span>
              </a>
              <a href="https://www.geckoterminal.com/bsc/pools" target="_blank" rel="noopener noreferrer" className="partner-card">
                <img src="https://www.geckoterminal.com/favicon.ico" alt="GeckoTerminal" className="h-5" />
                <span>GeckoTerminal</span>
              </a>
            </div>
          </div>

          {/* Powered By Protocols */}
          <div className="text-center mb-10">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Powered By DeFi Protocols</p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <a href="https://venus.io" target="_blank" rel="noopener noreferrer" className="partner-card partner-card-protocol">
                <img src="https://assets.coingecko.com/coins/images/12677/small/venus.png" alt="Venus" className="h-6" />
                <span>Venus Protocol</span>
              </a>
              <a href="https://pancakeswap.finance" target="_blank" rel="noopener noreferrer" className="partner-card partner-card-protocol">
                <img src="https://assets.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo_%281%29.png" alt="PancakeSwap" className="h-6" />
                <span>PancakeSwap V3</span>
              </a>
              <a href="https://beefy.com" target="_blank" rel="noopener noreferrer" className="partner-card partner-card-protocol">
                <img src="https://app.beefy.com/favicon.ico" alt="Beefy" className="h-6" />
                <span>Beefy Finance</span>
              </a>
              <a href="https://chain.link" target="_blank" rel="noopener noreferrer" className="partner-card partner-card-protocol">
                <img src="https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" alt="Chainlink" className="h-6" />
                <span>Chainlink Oracles</span>
              </a>
              <a href="https://www.bnbchain.org" target="_blank" rel="noopener noreferrer" className="partner-card partner-card-protocol">
                <img src="https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" alt="BNB Chain" className="h-6" />
                <span>BNB Chain</span>
              </a>
              <a href="https://moralis.io" target="_blank" rel="noopener noreferrer" className="partner-card partner-card-protocol">
                <img src="https://moralis.io/wp-content/uploads/2021/05/moralis-light.svg" alt="Moralis" className="h-5" />
                <span>Moralis</span>
              </a>
              <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" className="partner-card partner-card-protocol">
                <img src="https://static.coingecko.com/s/coingecko-logo-8903d34ce19ca4be1c81f0db30e924154750d208683fad7ae6f2ce06c76d0a56.png" alt="CoinGecko" className="h-5" />
                <span>CoinGecko API</span>
              </a>
            </div>
          </div>

          {/* Coming Soon */}
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Coming Soon</p>
            <div className="flex flex-wrap justify-center items-center gap-3">
              <div className="partner-card-soon">
                <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" alt="Ethereum" className="h-4" />
                <span>Ethereum</span>
              </div>
              <div className="partner-card-soon">
                <img src="https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" alt="Avalanche" className="h-4" />
                <span>Avalanche</span>
              </div>
              <div className="partner-card-soon">
                <img src="https://assets.coingecko.com/coins/images/4713/small/polygon.png" alt="Polygon" className="h-4" />
                <span>Polygon</span>
              </div>
              <div className="partner-card-soon">
                <img src="https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chridge.png" alt="Aave" className="h-4" />
                <span>Aave</span>
              </div>
              <div className="partner-card-soon">
                <img src="https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png" alt="MakerDAO" className="h-4" />
                <span>MakerDAO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;