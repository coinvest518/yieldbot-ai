import React, { useState } from 'react';
import { 
  Rocket, 
  TrendingUp, 
  Shield, 
  Coins, 
  Users, 
  Lock, 
  Zap, 
  Target,
  CheckCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Percent,
  Gift,
  BarChart3
} from 'lucide-react';

interface RoadmapPhase {
  phase: string;
  title: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  icon: React.ReactNode;
  desc: string;
  details: string[];
  metrics?: { label: string; value: string }[];
}

const Roadmap: React.FC = () => {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(1);

  const phases: RoadmapPhase[] = [
    {
      phase: "Phase 01",
      title: "Foundation & Token Launch",
      status: 'completed',
      icon: <Rocket className="w-5 h-5" />,
      desc: "YBOT Token deployed on BNB Chain with bonding curve mechanics for fair price discovery.",
      details: [
        "YBOT Token deployed at $0.10 starting price",
        "Bonding curve: +$0.0001 per token sold",
        "5% transaction fee funds protocol treasury",
        "Liquidity automatically provided via bonding curve",
        "Smart contracts deployed on BSC Testnet"
      ],
      metrics: [
        { label: "Starting Price", value: "$0.10" },
        { label: "Goal", value: "$100K" },
        { label: "Trade Fee", value: "5%" }
      ]
    },
    {
      phase: "Phase 02",
      title: "Staking & Yield Vault",
      status: 'in-progress',
      icon: <Lock className="w-5 h-5" />,
      desc: "Multiple earning opportunities through staking tiers and yield vault strategies.",
      details: [
        "4-tier staking: Flexible (5%), 7-day (12%), 30-day (25%), 90-day (50% APY)",
        "Yield Vault requires 100 YBOT to access (gate mechanism)",
        "Deposit USDT → Earn YBOT rewards (10 YBOT per $1 yield)",
        "Integrated with Venus, PancakeSwap V3, and Beefy Finance",
        "Early unstake penalty: 10% (goes back to reward pool)"
      ],
      metrics: [
        { label: "Max APY", value: "50%" },
        { label: "Vault Gate", value: "100 YBOT" },
        { label: "Min Stake", value: "10 YBOT" }
      ]
    },
    {
      phase: "Phase 03",
      title: "NFT Collection & Utility",
      status: 'in-progress',
      icon: <Gift className="w-5 h-5" />,
      desc: "Limited NFT collection with utility benefits for holders within the ecosystem.",
      details: [
        "NFTNinja Collection: 50 unique NFTs",
        "Mint price: 1 YBOT per NFT (~$0.10 at base)",
        "NFT holders get boosted staking rewards",
        "AI-generated art using Google Gemini",
        "Metadata stored on IPFS via Pinata"
      ],
      metrics: [
        { label: "Supply", value: "50 NFTs" },
        { label: "Mint Cost", value: "1 YBOT" },
        { label: "Boost", value: "+10% APY" }
      ]
    },
    {
      phase: "Phase 04",
      title: "AI Agents & Automation",
      status: 'upcoming',
      icon: <Zap className="w-5 h-5" />,
      desc: "AI-powered trading agents and automated yield optimization strategies.",
      details: [
        "ElizaOS-powered AI trading agents",
        "Automated yield farming optimization",
        "Smart rebalancing between protocols",
        "Risk-adjusted strategy recommendations",
        "Natural language portfolio management"
      ],
      metrics: [
        { label: "Agents", value: "3 Types" },
        { label: "Protocols", value: "5+" },
        { label: "Auto-compound", value: "Yes" }
      ]
    },
    {
      phase: "Phase 05",
      title: "Credit Scoring & Identity",
      status: 'upcoming',
      icon: <Shield className="w-5 h-5" />,
      desc: "On-chain credit scoring based on DeFi activity and Soulbound Token identity.",
      details: [
        "Credit score based on holding duration & volume",
        "Soulbound Tokens (SBT) for immutable on-chain identity",
        "Score tiers: Bronze, Silver, Gold, Platinum",
        "Higher scores unlock better loan terms",
        "Reputation portable across DeFi protocols"
      ],
      metrics: [
        { label: "Score Range", value: "0-1000" },
        { label: "Tiers", value: "4 Levels" },
        { label: "SBT", value: "Non-transferable" }
      ]
    },
    {
      phase: "Phase 06",
      title: "Lending Protocol",
      status: 'upcoming',
      icon: <DollarSign className="w-5 h-5" />,
      desc: "Decentralized lending with reduced or zero collateral for high-credit users.",
      details: [
        "Platinum holders access 0-collateral micro-loans",
        "Loan amounts based on credit score",
        "Funded by Yield Vault reserves",
        "Competitive interest rates for borrowers",
        "Default protection via staking slashing"
      ],
      metrics: [
        { label: "Max Loan", value: "$10K" },
        { label: "Platinum Rate", value: "0% Collateral" },
        { label: "APR", value: "5-15%" }
      ]
    }
  ];

  const getStatusStyles = (status: RoadmapPhase['status']) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-green-500/20',
          border: 'border-green-500/50',
          text: 'text-green-400',
          glow: 'shadow-green-500/30',
          icon: <CheckCircle className="w-4 h-4" />
        };
      case 'in-progress':
        return {
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          glow: 'shadow-yellow-500/30',
          icon: <Clock className="w-4 h-4" />
        };
      case 'upcoming':
        return {
          bg: 'bg-purple-500/20',
          border: 'border-purple-500/50',
          text: 'text-purple-400',
          glow: 'shadow-purple-500/30',
          icon: <Target className="w-4 h-4" />
        };
    }
  };

  return (
    <section id="roadmap" className="py-24 bg-ybot-dark border-t border-white/5 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute right-0 top-0 w-1/2 h-1/2 bg-gradient-to-bl from-purple-500/5 to-transparent" />
        <div className="absolute left-0 bottom-0 w-1/2 h-1/2 bg-gradient-to-tr from-cyan-500/5 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full mb-6">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">YieldBot DeFi Roadmap</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Building the Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">DeFi</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            From token launch to decentralized lending — our journey to revolutionize yield farming and credit scoring on BNB Chain.
          </p>
          
          {/* Whitepaper Link */}
          <a
            href="https://yieldbot-o4yndit.gamma.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/25"
          >
            <ExternalLink className="w-4 h-4" />
            Read Full Whitepaper
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
            <p className="text-3xl font-bold text-white">$0.10</p>
            <p className="text-sm text-gray-400">Starting Token Price</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
            <p className="text-3xl font-bold text-green-400">50%</p>
            <p className="text-sm text-gray-400">Max Staking APY</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
            <p className="text-3xl font-bold text-purple-400">100</p>
            <p className="text-sm text-gray-400">YBOT for Vault Access</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
            <p className="text-3xl font-bold text-cyan-400">$100K</p>
            <p className="text-sm text-gray-400">Fundraising Goal</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-yellow-500 via-purple-500 to-purple-500/20" />

          <div className="space-y-8">
            {phases.map((phase, i) => {
              const styles = getStatusStyles(phase.status);
              const isExpanded = expandedPhase === i;
              const isEven = i % 2 === 0;

              return (
                <div
                  key={i}
                  className={`relative flex flex-col md:flex-row items-start ${
                    isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Content Card */}
                  <div className={`w-full md:w-1/2 ${isEven ? 'md:pr-12' : 'md:pl-12'} pl-20 md:pl-0`}>
                    <div
                      className={`bg-slate-800/50 rounded-2xl border ${styles.border} overflow-hidden transition-all duration-300 hover:shadow-lg ${styles.glow} cursor-pointer`}
                      onClick={() => setExpandedPhase(isExpanded ? null : i)}
                    >
                      {/* Header */}
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${styles.bg} rounded-xl flex items-center justify-center ${styles.text}`}>
                              {phase.icon}
                            </div>
                            <div>
                              <span className={`text-xs font-bold tracking-wider uppercase ${styles.text}`}>
                                {phase.phase}
                              </span>
                              <h3 className="text-xl font-bold text-white">{phase.title}</h3>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}>
                              {styles.icon}
                              {phase.status === 'completed' ? 'Done' : phase.status === 'in-progress' ? 'Active' : 'Soon'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm">{phase.desc}</p>

                        {/* Metrics */}
                        {phase.metrics && (
                          <div className="flex flex-wrap gap-3 mt-4">
                            {phase.metrics.map((metric, j) => (
                              <div key={j} className="bg-slate-900/50 rounded-lg px-3 py-2">
                                <p className="text-xs text-gray-500">{metric.label}</p>
                                <p className={`text-sm font-bold ${styles.text}`}>{metric.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-6 pb-6 border-t border-slate-700/50 pt-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Key Deliverables</p>
                          <ul className="space-y-2">
                            {phase.details.map((detail, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                                <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.text}`} />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline Node */}
                  <div className="absolute left-8 md:left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <div className={`w-4 h-4 rounded-full ${styles.bg} border-2 ${styles.border} z-10`} />
                    <div className={`absolute w-8 h-8 ${styles.bg} rounded-full animate-ping opacity-30`} />
                  </div>

                  {/* Empty space for alignment */}
                  <div className="hidden md:block w-1/2" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10 rounded-2xl p-8 border border-purple-500/20">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to Join the Journey?</h3>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              Start with just $10 to get 100 YBOT tokens. Stake for up to 50% APY and unlock access to the Yield Vault.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/fundraiser"
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium transition-all flex items-center gap-2"
              >
                <Coins className="w-4 h-4" />
                Buy YBOT Tokens
              </a>
              <a
                href="/staking"
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all border border-slate-700 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Start Staking
              </a>
              <a
                href="https://yieldbot-o4yndit.gamma.site/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 text-purple-400 hover:text-purple-300 font-medium transition-all flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Read Whitepaper
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Roadmap;