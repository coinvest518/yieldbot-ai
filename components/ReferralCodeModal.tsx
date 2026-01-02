import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, Share2, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { 
  generateReferralCode, 
  storeReferralCode, 
  getReferralCode,
  getReferralStats 
} from '../services/referralService';

const ReferralCodeModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalReferred: 0, referredWallets: [] as string[] });
  
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();

  useEffect(() => {
    if (isConnected && address) {
      // Check if user already has a code
      const existingCode = getReferralCode(address);
      if (existingCode) {
        setReferralCode(existingCode);
        const userStats = getReferralStats(address);
        setStats({
          totalReferred: userStats.totalReferred,
          referredWallets: userStats.referredWallets
        });
      }
    }
  }, [isConnected, address]);

  const handleGenerateCode = async () => {
    if (!isConnected || !address) {
      open();
      return;
    }

    setLoading(true);
    try {
      const code = generateReferralCode(address);
      await storeReferralCode(address, code);
      setReferralCode(code);
    } catch (error) {
      console.error('Error generating code:', error);
      alert('Failed to generate code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = () => {
    const text = `🎁 Get 100 YBOT tokens FREE! Use my referral code: ${referralCode}\n\nClaim at: ${window.location.origin}/claim`;
    
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Share text copied to clipboard!');
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setCopied(false);
  };

  return (
    <>
      {/* Get Code Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg"
      >
        <Gift className="w-5 h-5" />
        Get Referral Code
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
              ✕
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                <Gift className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Get Your Referral Code
              </h2>
              <p className="text-gray-400 text-sm">
                Share with friends to earn 100 YBOT tokens each
              </p>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {!isConnected ? (
                <>
                  {/* Connect Wallet */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                    <Wallet className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm text-blue-400 mb-3">
                      Connect your wallet to generate a referral code
                    </p>
                  </div>
                  <button
                    onClick={() => open()}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-5 h-5" />
                    Connect Wallet
                  </button>
                </>
              ) : !referralCode ? (
                <>
                  {/* Generate Code */}
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <p className="text-sm text-gray-300 text-center">
                      Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateCode}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? 'Generating...' : (
                      <>
                        <Gift className="w-5 h-5" />
                        Generate My Code
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* Display Code */}
                  <div className="bg-slate-800 border border-purple-500/30 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-2">Your Referral Code:</p>
                    <p className="text-2xl font-bold text-purple-400 text-center tracking-wider">
                      {referralCode}
                    </p>
                  </div>

                  {/* Stats */}
                  {stats.totalReferred > 0 && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                      <p className="text-sm text-green-400 text-center">
                        🎉 {stats.totalReferred} friend{stats.totalReferred > 1 ? 's' : ''} referred!
                      </p>
                    </div>
                  )}

                  {/* Copy Button */}
                  <button
                    onClick={copyCode}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy Code
                      </>
                    )}
                  </button>

                  {/* Share Button */}
                  <button
                    onClick={shareCode}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-5 h-5" />
                    Share Code
                  </button>

                  {/* Info */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-xs text-blue-400">
                      💡 Share this code with friends. When they use it, you both get 100 YBOT tokens!
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReferralCodeModal;
