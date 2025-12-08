import React from 'react';
import { X, Check } from 'lucide-react';

const BankingComparison: React.FC = () => {
  const comparisons = [
    { feature: 'Interest Rate (APY)', bank: '0.01% - 0.5%', ybot: '12%+ APY', highlight: true },
    { feature: 'Monthly Fees', bank: '$5-15/month', ybot: '$0 (No fees)' },
    { feature: 'Minimum Balance', bank: '$500-1,500', ybot: 'No minimum' },
    { feature: 'Credit Building', bank: 'Requires debt/loans', ybot: 'Build credit by saving' },
    { feature: 'Loan Approval Time', bank: '3-7 days', ybot: 'Instant (on-chain)' },
    { feature: 'Collateral for Loans', bank: '100%+ collateral', ybot: 'Under-collateralized' },
    { feature: 'Account Recovery', bank: 'Call support, wait days', ybot: 'Social recovery (instant)' },
    { feature: 'Automation', bank: 'Manual transfers', ybot: 'AI agents auto-optimize' },
    { feature: 'Transparency', bank: 'Hidden fees', ybot: 'Open-source smart contracts' },
    { feature: 'Access', bank: 'Credit check required', ybot: 'Open to everyone' },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-ybot-dark to-ybot-card border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-ybot-primary font-bold tracking-wider uppercase text-sm">The Difference</span>
          <h2 className="text-4xl font-display font-bold text-white mt-2 mb-4">
            Traditional Banks vs <span className="text-gradient">yBot Finance</span>
          </h2>
          <p className="text-ybot-muted max-w-2xl mx-auto text-lg">
            See why thousands are switching from legacy banking to DeFi-powered savings
          </p>
        </div>

        {/* Comparison Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          {/* Table Header */}
          <div className="grid grid-cols-3 gap-4 p-6 bg-ybot-dark border-b border-white/10">
            <div className="text-ybot-muted font-bold text-sm uppercase">Feature</div>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
                <X size={16} className="text-red-400" />
                <span className="text-red-400 font-bold text-sm">Traditional Banks</span>
              </div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
                <Check size={16} className="text-green-400" />
                <span className="text-green-400 font-bold text-sm">yBot Finance</span>
              </div>
            </div>
          </div>

          {/* Table Rows */}
          {comparisons.map((item, idx) => (
            <div 
              key={idx} 
              className={`grid grid-cols-3 gap-4 p-6 border-b border-white/5 hover:bg-white/5 transition-colors ${
                item.highlight ? 'bg-ybot-primary/5' : ''
              }`}
            >
              <div className="text-white font-medium flex items-center">
                {item.feature}
                {item.highlight && (
                  <span className="ml-2 px-2 py-0.5 bg-ybot-gold/20 text-ybot-gold text-xs rounded-full">
                    Key Benefit
                  </span>
                )}
              </div>
              <div className="text-center text-red-400 flex items-center justify-center">
                <span className="text-sm">{item.bank}</span>
              </div>
              <div className="text-center text-green-400 font-bold flex items-center justify-center">
                <span className="text-sm">{item.ybot}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-col items-center gap-4 p-8 bg-gradient-to-r from-ybot-primary/10 to-ybot-cyan/10 rounded-2xl border border-ybot-primary/20">
            <p className="text-white text-xl font-bold">
              💰 On a $10,000 deposit, you'd earn <span className="text-ybot-gold">$1,200/year</span> with yBot
            </p>
            <p className="text-ybot-muted">
              vs. only <span className="line-through">$1-50/year</span> with traditional banks
            </p>
            <a 
              href="#vault"
              className="px-8 py-4 bg-ybot-primary hover:bg-ybot-primaryHover text-white font-bold rounded-lg transition-all transform hover:-translate-y-1 shadow-lg"
            >
              Start Earning 12%+ APY →
            </a>
          </div>
        </div>

      </div>
    </section>
  );
};

export default BankingComparison;
