import { useState } from 'react';
import { ethers } from 'ethers';
import { findWinnerByClaimCode, calculateClaimAmount } from '../services/winnersService';

const WINNER_CLAIMS_ABI = [
  'function claim(bytes32 claimCode, address recipient) external',
  'function claimed(bytes32) view returns (bool)',
];

export default function WinnerClaim() {
  const [claimCode, setClaimCode] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLookup = async () => {
    setError('');
    setAmount(null);
    setLoading(true);

    try {
      const winner = await findWinnerByClaimCode(claimCode);
      if (!winner) {
        setError('Claim code not found');
        return;
      }
      setAmount(calculateClaimAmount(winner));
    } catch (err) {
      setError('Error fetching winner data');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!amount) return;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        import.meta.env.VITE_WINNER_CLAIMS_CONTRACT,
        WINNER_CLAIMS_ABI,
        signer
      );

      const claimCodeBytes = ethers.id(claimCode);
      const tx = await contract.claim(claimCodeBytes, await signer.getAddress());
      await tx.wait();

      setSuccess(`Claimed ${amount} YBOT!`);
      setClaimCode('');
      setAmount(null);
    } catch (err: any) {
      setError(err.message || 'Claim failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-900 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Claim Your Reward</h2>
      
      <input
        type="text"
        placeholder="Enter claim code"
        value={claimCode}
        onChange={(e) => setClaimCode(e.target.value)}
        className="w-full p-2 mb-2 bg-gray-800 text-white rounded"
      />
      
      <button
        onClick={handleLookup}
        disabled={!claimCode || loading}
        className="w-full p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded mb-4"
      >
        {loading ? 'Loading...' : 'Check Reward'}
      </button>

      {amount && (
        <div className="mb-4 p-4 bg-green-900 rounded">
          <p className="text-lg">Your reward: <strong>{amount} YBOT</strong></p>
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full p-2 mt-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded"
          >
            {loading ? 'Claiming...' : 'Claim Now'}
          </button>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}
      {success && <p className="text-green-500">{success}</p>}
    </div>
  );
}
