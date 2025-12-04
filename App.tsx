import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Features from './components/Features';
import Roadmap from './components/Roadmap';
import Footer from './components/Footer';
import YieldStrategyDashboard from './components/YieldStrategyDashboard';
import ApiTester from './components/ApiTester';
import AIAgentsPage from './pages/AIAgentsPage';
import FundraiserPage from './pages/FundraiserPage';
import StakingPage from './pages/StakingPage';
import LiveTicker from './components/LiveTicker';
import { clearWalletConnection } from './services/web3Service';
import { useAccount } from 'wagmi';

// ============ HOME PAGE ============
const HomePage: React.FC = () => {
  const [showApiTester, setShowApiTester] = useState(false);
  const [investmentAmount, setInvestmentAmount] = useState(100);

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Dashboard />
        
        {/* Yield Strategies Section */}
        <section id="yield-strategies" className="py-16 px-4 md:px-8 lg:px-16">
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                💰 Live Yield Strategies
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Real-time yield data from Venus Protocol, PancakeSwap V3, and Beefy Finance. 
                Choose your risk level and start earning.
              </p>
              
              {/* Investment Amount Selector */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <span className="text-gray-400">Simulate with:</span>
                <div className="flex gap-2">
                  {[10, 100, 1000, 10000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setInvestmentAmount(amount)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        investmentAmount === amount
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      ${amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Yield Strategy Dashboard */}
            <YieldStrategyDashboard investmentAmount={investmentAmount} />
            
            {/* API Tester Toggle */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setShowApiTester(!showApiTester)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-all"
              >
                {showApiTester ? '🔼 Hide API Tester' : '🔧 Show API Connection Tester'}
              </button>
            </div>
            
            {/* API Tester (collapsible) */}
            {showApiTester && (
              <div className="mt-6">
                <ApiTester />
              </div>
            )}
          </div>
        </section>

        <Features />
        <Roadmap />
      </main>
      <Footer />
    </>
  );
};

// ============ MAIN APP ============
const App: React.FC = () => {
  // Clear any stale wallet connections on app load
  useEffect(() => {
    // Only clear if there's no active wallet connection
    const hasActiveConnection = localStorage.getItem('wagmi.store');
    if (!hasActiveConnection) {
      clearWalletConnection();
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-ybot-dark selection:bg-ybot-primary selection:text-white font-sans">
        <LiveTicker />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ai-agents" element={<AIAgentsPage />} />
          <Route path="/fundraiser" element={<FundraiserPage />} />
          <Route path="/staking" element={<StakingPage />} />
        </Routes>
        <Analytics />
        {/* User Feedback Button */}
        <div className="fixed bottom-4 right-4 z-50">
          <a
            href="https://t.me/yieldbotai"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg shadow-lg transition-all"
          >
            User Feedback
          </a>
        </div>
      </div>
    </Router>
  );
};

export default App;