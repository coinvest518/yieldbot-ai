import { useState } from 'react';
import { ethers } from 'ethers';
import { Gift } from 'lucide-react';
import { findWinnerByEmail, calculateRewardAmount } from '../services/winnersService';

const WINNER_CLAIMS_ABI = [
  'function claim(bytes32 claimCode, address recipient) external',
  'function claimed(bytes32) view returns (bool)',
];

export default function ClaimReward() {
  const [email, setEmail] = useState('');
  const [winner, setWinner] = useState<any>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCheckEmail = async () => {
    setError('');
    setWinner(null);
    setReward(null);
    setLoading(true);

    try {
      const found = await findWinnerByEmail(email);
      if (!found) {
        setError('Email not found in winners list');
        return;
      }
      setWinner(found);
      setReward(calculateRewardAmount(found.ranking));
    } catch (err) {
      setError('Error checking email');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!winner || !reward) return;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      const contract = new ethers.Contract(
        import.meta.env.VITE_WINNER_CLAIMS_CONTRACT,
        WINNER_CLAIMS_ABI,
        signer
      );

      const claimCodeBytes = ethers.id(email.toLowerCase());
      const tx = await contract.claim(claimCodeBytes, userAddress);
      await tx.wait();

      setSuccess(`Claimed ${reward} YBOT! Ranking: #${winner.ranking}`);
      setEmail('');
      setWinner(null);
      setReward(null);
    } catch (err: any) {
      setError(err.message || 'Claim failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        <Gift className="w-5 h-5 text-green-400" />
        Claim Gleam Reward
      </h2>
      
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 mb-3 bg-slate-800 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-purple-500"
      />
      
      <button
        onClick={handleCheckEmail}
        disabled={!email || loading}
        className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg font-bold transition-colors mb-4"
      >
        {loading ? 'Checking...' : 'Check Reward'}
      </button>

      {winner && reward && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-gray-300 mb-2">Name: <span className="text-white font-bold">{winner.name}</span></p>
          <p className="text-sm text-gray-300 mb-3">Ranking: <span className="text-green-400 font-bold">#{winner.ranking}</span></p>
          <p className="text-lg font-bold text-green-400 mb-3">Reward: {reward} YBOT</p>
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full p-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg font-bold transition-colors"
          >
            {loading ? 'Claiming...' : 'Claim Now'}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}
    </div>
  );
}
