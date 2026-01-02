import React, { useState } from 'react';
import { Gift, Check, X, Loader } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const ClaimCodePage: React.FC = () => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const handleClaim = async () => {
    if (!code.trim()) {
      setStatus('error');
      setMessage('Please enter a claim code');
      return;
    }

    if (!walletAddress.trim()) {
      setStatus('error');
      setMessage('Please enter your wallet address');
      return;
    }

    setStatus('checking');
    
    // Simulate API call
    setTimeout(() => {
      // Check if code format is valid
      if (code.startsWith('YBOT-EARLY-')) {
        setStatus('success');
        setMessage('🎉 Code claimed! 100 YBOT tokens will be sent to your wallet within 24 hours.');
      } else {
        setStatus('error');
        setMessage('Invalid code format. Code should be like: YBOT-EARLY-XXXX');
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-ybot-dark">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/20 rounded-full mb-6">
              <Gift className="w-10 h-10 text-purple-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Claim Your YBOT Tokens
            </h1>
            <p className="text-gray-400 text-lg">
              Enter your claim code to receive 100 YBOT tokens
            </p>
          </div>

          {/* Claim Form */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-8">
            <div className="space-y-6">
              {/* Code Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Claim Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="YBOT-EARLY-XXXX"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  disabled={status === 'checking'}
                />
              </div>

              {/* Wallet Address Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your BSC Wallet Address
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  disabled={status === 'checking'}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Make sure this is a BSC (BNB Chain) address
                </p>
              </div>

              {/* Status Message */}
              {status !== 'idle' && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${
                  status === 'success' ? 'bg-green-500/10 border border-green-500/30' :
                  status === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                  'bg-blue-500/10 border border-blue-500/30'
                }`}>
                  {status === 'checking' && <Loader className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />}
                  {status === 'success' && <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
                  {status === 'error' && <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                  <p className={`text-sm ${
                    status === 'success' ? 'text-green-400' :
                    status === 'error' ? 'text-red-400' :
                    'text-blue-400'
                  }`}>
                    {message}
                  </p>
                </div>
              )}

              {/* Claim Button */}
              <button
                onClick={handleClaim}
                disabled={status === 'checking' || status === 'success'}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {status === 'checking' ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : status === 'success' ? (
                  <>
                    <Check className="w-5 h-5" />
                    Claimed!
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    Claim 100 YBOT
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">📋 How it works:</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>1. Enter your unique claim code (received via email or social media)</li>
              <li>2. Provide your BSC wallet address</li>
              <li>3. Click "Claim 100 YBOT"</li>
              <li>4. Tokens will be sent within 24 hours</li>
            </ul>
          </div>

          {/* Support */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Need help?{' '}
              <a
                href="https://t.me/yieldbotai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ClaimCodePage;
