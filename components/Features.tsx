import React from 'react';
import { ShieldCheck, Zap, LineChart, Banknote } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-ybot-gold" />,
      title: "12%+ APY vs 0.01% Banks",
      desc: "Earn up to 24x more than traditional savings accounts. AI agents automatically rebalance your funds across Venus, PancakeSwap, and Beefy for maximum yield—no manual work required."
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-ybot-cyan" />,
      title: "Build Credit, Not Debt",
      desc: "Every deposit increases your Soulbound Credit Score. Unlike banks that profit from your debt, yBot rewards you for saving and responsible DeFi participation."
    },
    {
      icon: <Banknote className="w-8 h-8 text-green-400" />,
      title: "Smart Wallet Integration",
      desc: "Deposit with any token, buy crypto with your credit card, and recover your wallet without seed phrases. DeFi made as easy as Venmo."
    },
    {
      icon: <LineChart className="w-8 h-8 text-ybot-primary" />,
      title: "Unlock Borrowing Power",
      desc: "High credit score? Access under-collateralized loans like a DeFi credit card. Borrow without locking up all your assets—powered by your on-chain reputation."
    }
  ];

  return (
    <section id="credit" className="py-24 bg-ybot-dark border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center lg:text-left">
          <span className="text-ybot-primary font-bold tracking-wider uppercase text-sm">Why yBot Beats Traditional Banking</span>
          <h2 className="text-4xl font-display font-bold text-white mt-2 mb-6">Your Money, <span className="text-ybot-gold">Working Harder</span></h2>
          <p className="text-ybot-muted max-w-2xl mx-auto lg:mx-0 text-lg">
            Banks keep your money locked up earning pennies while they profit. yBot puts you in control with AI-powered yield strategies, 
            credit building, and smart wallet technology—all while earning 12%+ APY.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-ybot-card p-8 rounded-2xl border border-white/5 hover:border-ybot-primary/30 transition-all hover:-translate-y-2 group shadow-lg hover:shadow-ybot-primary/10">
              <div className="w-16 h-16 bg-ybot-dark rounded-xl flex items-center justify-center mb-6 group-hover:bg-white/5 transition-colors border border-white/5">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-ybot-muted text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;