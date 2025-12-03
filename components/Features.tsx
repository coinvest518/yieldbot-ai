import React from 'react';
import { ShieldCheck, Zap, LineChart, Banknote } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-ybot-gold" />,
      title: "Automated Yield Vault",
      desc: "Simply hold YBOT. A 2% tax on every transaction is automatically routed to our high-yield vault, compounding wealth for all holders."
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-ybot-cyan" />,
      title: "Soulbound Credit",
      desc: "Your financial behavior is recorded on-chain. Build a permanent, non-transferable credit score to prove your trustworthiness."
    },
    {
      icon: <Banknote className="w-8 h-8 text-green-400" />,
      title: "Under-Collateralized Loans",
      desc: "Platinum Tier holders can access borrowing pools with significantly lower collateral requirements based on their SBT score."
    },
    {
      icon: <LineChart className="w-8 h-8 text-ybot-primary" />,
      title: "Liquidity Growth",
      desc: "3% of every transaction creates a rising price floor by auto-injecting liquidity into the BNB/YBOT pair."
    }
  ];

  return (
    <section id="credit" className="py-24 bg-ybot-dark border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center lg:text-left">
          <span className="text-ybot-primary font-bold tracking-wider uppercase text-sm">Ecosystem</span>
          <h2 className="text-4xl font-display font-bold text-white mt-2 mb-6">Built for <span className="text-ybot-gold">Longevity</span></h2>
          <p className="text-ybot-muted max-w-2xl mx-auto lg:mx-0 text-lg">
            We aren't just creating a token; we are building an on-chain reputation layer for the future of decentralized finance.
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