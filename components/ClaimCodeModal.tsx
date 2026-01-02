import React, { useState } from 'react';
import { Gift, Check, X, Loader } from 'lucide-react';

const ClaimCodeModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
    
    setTimeout(() => {
      if (code.startsWith('YBOT-EARLY-')) {
        setStatus('success');
        setMessage('🎉 Code claimed! 100 YBOT tokens will be sent within 24 hours.');
      } else {
        setStatus('error');
        setMessage('Invalid code format. Code should be like: YBOT-EARLY-XXXX');
      }
    }, 1500);
  };

  const closeModal = () => {
    setIsOpen(false);
    setCode('');
    setWalletAddress('');
    setStatus('idle');
    setMessage('');
  };

  return (
    <>
      {/* Claim Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg"
      >
        <Gift className="w-5 h-5" />
        Claim Code
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-md w-full p-6 relative">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                <Gift className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Claim Your YBOT
              </h2>
              <p className="text-gray-400 text-sm">
                Enter your code to receive 100 YBOT tokens
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  disabled={status === 'checking'}
                />
              </div>

              {/* Wallet Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  BSC Wallet Address
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  disabled={status === 'checking'}
                />
              </div>

              {/* Status Message */}
              {status !== 'idle' && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${
                  status === 'success' ? 'bg-green-500/10 border border-green-500/30' :
                  status === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                  'bg-blue-500/10 border border-blue-500/30'
                }`}>
                  {status === 'checking' && <Loader className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />}
                  {status === 'success' && <Check className="w-5 h-5 text-green-400 flex-shrink-0" />}
                  {status === 'error' && <X className="w-5 h-5 text-red-400 flex-shrink-0" />}
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
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
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
        </div>
      )}
    </>
  );
};

export default ClaimCodeModal;
