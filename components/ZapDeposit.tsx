/**
 * ZapDeposit Component
 * One-click deposit UI - deposit ANY token into the vault
 */

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ZapService, COMMON_TOKENS, type TokenInfo, type ZapQuote } from '../services/zapService';

interface ZapDepositProps {
  provider?: ethers.BrowserProvider;
  userAddress?: string;
  chainId?: number;
}

const ZapDeposit: React.FC<ZapDepositProps> = ({
  provider,
  userAddress,
  chainId = 56,
}) => {
  const [selectedToken, setSelectedToken] = useState<string>('BNB');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [quote, setQuote] = useState<ZapQuote | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [bnbBalance, setBnbBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);

  // Token options
  const tokens = chainId === 56 ? COMMON_TOKENS.bscMainnet : COMMON_TOKENS.bscTestnet;
  const tokenList = [
    { symbol: 'BNB', address: 'native', logo: '🔶' },
    { symbol: 'USDT', address: tokens.USDT, logo: '💵' },
    { symbol: 'USDC', address: (tokens as any).USDC || '', logo: '💲' },
    { symbol: 'BUSD', address: tokens.BUSD, logo: '💰' },
    { symbol: 'CAKE', address: (tokens as any).CAKE || '', logo: '🥞' },
  ].filter(t => t.address);

  // Fetch balances
  useEffect(() => {
    if (provider && userAddress) {
      fetchBalances();
    }
  }, [provider, userAddress, selectedToken]);

  // Get quote when amount changes
  useEffect(() => {
    if (inputAmount && parseFloat(inputAmount) > 0) {
      getQuote();
    } else {
      setQuote(null);
    }
  }, [inputAmount, selectedToken, slippage]);

  const fetchBalances = async () => {
    if (!provider || !userAddress) return;

    try {
      // Get BNB balance
      const balance = await provider.getBalance(userAddress);
      setBnbBalance(ethers.formatEther(balance));

      // Get token balance if not BNB
      if (selectedToken !== 'BNB') {
        const token = tokenList.find(t => t.symbol === selectedToken);
        if (token?.address && token.address !== 'native') {
          const zapService = new ZapService(provider, chainId);
          const info = await zapService.getTokenInfo(token.address, userAddress);
          setTokenInfo(info);
        }
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  const getQuote = async () => {
    if (!provider || !inputAmount) return;

    setQuoteLoading(true);
    try {
      const zapService = new ZapService(provider, chainId);
      const token = tokenList.find(t => t.symbol === selectedToken);
      
      if (token) {
        const tokenAddress = token.address === 'native' ? tokens.WBNB : token.address;
        const quoteResult = await zapService.getZapInQuote(
          tokenAddress,
          inputAmount,
          Math.floor(slippage * 100)
        );
        setQuote(quoteResult);
      }
    } catch (error) {
      console.error('Error getting quote:', error);
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleZap = async () => {
    if (!provider || !userAddress || !inputAmount || !quote) return;

    setLoading(true);
    setTxStatus('pending');

    try {
      const signer = await provider.getSigner();
      const zapService = new ZapService(provider, chainId);
      await zapService.connectSigner(signer);

      let tx: ethers.TransactionResponse;

      if (selectedToken === 'BNB') {
        tx = await zapService.zapInBNB(inputAmount, quote.minShares);
      } else {
        const token = tokenList.find(t => t.symbol === selectedToken);
        if (!token?.address) throw new Error('Token not found');
        
        tx = await zapService.zapIn(
          token.address,
          inputAmount,
          quote.minShares,
          tokenInfo?.decimals || 18
        );
      }

      setTxHash(tx.hash);
      await tx.wait();
      
      setTxStatus('success');
      setInputAmount('');
      setQuote(null);
      fetchBalances();
    } catch (error: any) {
      console.error('Zap failed:', error);
      setTxStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const getBalance = () => {
    if (selectedToken === 'BNB') return bnbBalance;
    return tokenInfo?.balanceFormatted || '0';
  };

  const setMaxAmount = () => {
    const balance = getBalance();
    // Leave some BNB for gas
    if (selectedToken === 'BNB') {
      const max = Math.max(0, parseFloat(balance) - 0.01);
      setInputAmount(max.toString());
    } else {
      setInputAmount(balance);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-900/20 to-slate-900 rounded-2xl p-6 border border-indigo-500/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            ⚡ Zap Deposit
          </h2>
          <p className="text-gray-400 text-sm">
            Deposit any token in one click
          </p>
        </div>
        
        {/* Slippage Settings */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Slippage:</span>
          <div className="flex gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-2 py-1 rounded text-xs ${
                  slippage === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Token Selection */}
      <div className="mb-4">
        <label className="text-sm text-gray-400 mb-2 block">Select Token</label>
        <div className="flex gap-2 flex-wrap">
          {tokenList.map((token) => (
            <button
              key={token.symbol}
              onClick={() => setSelectedToken(token.symbol)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                selectedToken === token.symbol
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <span>{token.logo}</span>
              <span>{token.symbol}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Amount */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-gray-400">Amount</label>
          <span className="text-sm text-gray-500">
            Balance: {parseFloat(getBalance()).toFixed(4)} {selectedToken}
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={setMaxAmount}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-indigo-600/30 text-indigo-400 rounded-lg text-sm hover:bg-indigo-600/50"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Quote Display */}
      {quote && (
        <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">You will receive</span>
            <span className="text-white font-bold text-lg">
              {quoteLoading ? '...' : parseFloat(quote.expectedSharesFormatted).toFixed(4)} shares
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Minimum (with slippage)</span>
            <span className="text-gray-400">
              {ethers.formatUnits(quote.minShares, 18).slice(0, 10)} shares
            </span>
          </div>
        </div>
      )}

      {/* Zap Flow Visualization */}
      <div className="bg-slate-800/30 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-center gap-2 text-sm">
          <div className="flex items-center gap-2 bg-slate-700 px-3 py-2 rounded-lg">
            <span>{tokenList.find(t => t.symbol === selectedToken)?.logo}</span>
            <span className="text-white">{selectedToken}</span>
          </div>
          <span className="text-indigo-400">→</span>
          <div className="text-gray-400 px-2">Swap</div>
          <span className="text-indigo-400">→</span>
          <div className="flex items-center gap-2 bg-slate-700 px-3 py-2 rounded-lg">
            <span>💵</span>
            <span className="text-white">USDT</span>
          </div>
          <span className="text-indigo-400">→</span>
          <div className="text-gray-400 px-2">Deposit</div>
          <span className="text-indigo-400">→</span>
          <div className="flex items-center gap-2 bg-indigo-600 px-3 py-2 rounded-lg">
            <span>🏦</span>
            <span className="text-white">Vault</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      {!userAddress ? (
        <button
          disabled
          className="w-full py-4 bg-slate-700 text-gray-400 rounded-xl font-semibold"
        >
          Connect Wallet
        </button>
      ) : (
        <button
          onClick={handleZap}
          disabled={loading || !inputAmount || parseFloat(inputAmount) <= 0}
          className={`w-full py-4 rounded-xl font-semibold transition-all ${
            loading || !inputAmount || parseFloat(inputAmount) <= 0
              ? 'bg-slate-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Processing...
            </span>
          ) : (
            `⚡ Zap ${inputAmount || '0'} ${selectedToken}`
          )}
        </button>
      )}

      {/* Transaction Status */}
      {txStatus !== 'idle' && (
        <div className={`mt-4 p-4 rounded-xl ${
          txStatus === 'pending' ? 'bg-yellow-500/10 border border-yellow-500/30' :
          txStatus === 'success' ? 'bg-green-500/10 border border-green-500/30' :
          'bg-red-500/10 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <span>
              {txStatus === 'pending' && '⏳'}
              {txStatus === 'success' && '✅'}
              {txStatus === 'error' && '❌'}
            </span>
            <span className={
              txStatus === 'pending' ? 'text-yellow-400' :
              txStatus === 'success' ? 'text-green-400' :
              'text-red-400'
            }>
              {txStatus === 'pending' && 'Transaction pending...'}
              {txStatus === 'success' && 'Zap successful!'}
              {txStatus === 'error' && 'Transaction failed'}
            </span>
          </div>
          {txHash && (
            <a
              href={`https://bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 text-sm mt-2 block hover:underline"
            >
              View on BscScan →
            </a>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-4 text-center text-xs text-gray-500">
        <p>🔄 Automatically swaps your token to the vault's asset</p>
        <p>⚡ One transaction - no manual swaps needed</p>
      </div>
    </div>
  );
};

export default ZapDeposit;
