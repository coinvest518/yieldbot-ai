/**
 * Embedded Wallet Panel Component
 * 
 * This creates a SEPARATE embedded wallet for AI trading on BSC.
 * It's independent of the MetaMask/Reown wallet connection.
 * 
 * Features:
 * - Generate new wallet or import existing
 * - View wallet address and BSC balance
 * - Export private key for backup
 * - Session keys for AI agent autonomous trading
 * - Encrypted storage in localStorage
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers, HDNodeWallet, Wallet as EthersWallet } from 'ethers';
import {
  Wallet,
  Shield,
  Key,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  AlertCircle,
  Loader2,
  Bot,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  History,
  Zap,
  CheckCircle,
  Plus,
  Import,
  Trash2,
} from 'lucide-react';
import {
  hasActiveSessionKey,
  getSessionKey,
  grantSessionKeyPermissions,
  revokeSessionKey,
  getDefaultPermissions,
  formatSessionExpiry,
  type SessionKeyPermissions,
  type StoredSessionKey
} from '../services/smartWalletService';
import {
  getLocalTradeHistory,
  getTradeStats,
  type TradeRecord
} from '../services/tradeStorageService';

// BSC Testnet configuration
const BSC_TESTNET = {
  chainId: 97,
  name: 'BSC Testnet',
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  symbol: 'tBNB',
  blockExplorer: 'https://testnet.bscscan.com',
};

// Storage key for encrypted wallet
const WALLET_STORAGE_KEY = 'ybot_embedded_wallet';

interface StoredWallet {
  address: string;
  encryptedKey: string;
  createdAt: number;
}

interface EmbeddedWalletPanelProps {
  onWalletChange?: (address: string | null) => void;
  onSessionKeyChange?: (hasKey: boolean) => void;
}

/**
 * Simple encryption using a password
 * In production, use a more secure encryption method
 */
const encryptKey = (privateKey: string, password: string): string => {
  // Simple XOR encryption for demo - use proper encryption in production
  const encoded = btoa(privateKey);
  const passHash = btoa(password);
  let result = '';
  for (let i = 0; i < encoded.length; i++) {
    result += String.fromCharCode(
      encoded.charCodeAt(i) ^ passHash.charCodeAt(i % passHash.length)
    );
  }
  return btoa(result);
};

const decryptKey = (encrypted: string, password: string): string | null => {
  try {
    const decoded = atob(encrypted);
    const passHash = btoa(password);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ passHash.charCodeAt(i % passHash.length)
      );
    }
    return atob(result);
  } catch {
    return null;
  }
};

const EmbeddedWalletPanel: React.FC<EmbeddedWalletPanelProps> = ({
  onWalletChange,
  onSessionKeyChange,
}) => {
  // Wallet state - can be HDNodeWallet (from createRandom) or Wallet (from private key)
  const [wallet, setWallet] = useState<HDNodeWallet | EthersWallet | null>(null);
  const [storedWallet, setStoredWallet] = useState<StoredWallet | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importKey, setImportKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Session key state
  const [hasSessionKey, setHasSessionKey] = useState(false);
  const [sessionKey, setSessionKey] = useState<StoredSessionKey | null>(null);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  
  // Session key settings
  const [maxAmount, setMaxAmount] = useState('1000');
  const [expiryHours, setExpiryHours] = useState('24');

  // Load stored wallet on mount
  useEffect(() => {
    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredWallet = JSON.parse(stored);
        setStoredWallet(parsed);
      } catch (e) {
        console.error('Failed to parse stored wallet:', e);
      }
    }
    setIsLoading(false);
  }, []);

  // Fetch balance when wallet is unlocked
  const fetchBalance = useCallback(async () => {
    if (!wallet) return;
    
    try {
      const provider = new ethers.JsonRpcProvider(BSC_TESTNET.rpcUrl);
      const balanceWei = await provider.getBalance(wallet.address);
      setBalance(ethers.formatEther(balanceWei));
    } catch (e) {
      console.error('Failed to fetch balance:', e);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet) {
      fetchBalance();
      // Refresh balance every 30 seconds
      const interval = setInterval(fetchBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [wallet, fetchBalance]);

  // Check session key status when wallet changes
  useEffect(() => {
    if (wallet) {
      const hasKey = hasActiveSessionKey(wallet.address);
      setHasSessionKey(hasKey);
      
      if (hasKey) {
        const key = getSessionKey(wallet.address);
        setSessionKey(key);
      } else {
        setSessionKey(null);
      }
      
      // Load trade history
      const history = getLocalTradeHistory(wallet.address);
      setTrades(history);
      
      onWalletChange?.(wallet.address);
      onSessionKeyChange?.(hasKey);
    } else {
      onWalletChange?.(null);
    }
  }, [wallet, onWalletChange, onSessionKeyChange]);

  // Create new wallet
  const handleCreateWallet = () => {
    setError('');
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      const newWallet = ethers.Wallet.createRandom();
      const encrypted = encryptKey(newWallet.privateKey, password);
      
      const stored: StoredWallet = {
        address: newWallet.address,
        encryptedKey: encrypted,
        createdAt: Date.now(),
      };
      
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(stored));
      setStoredWallet(stored);
      setWallet(newWallet);
      setShowCreateModal(false);
      setPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError('Failed to create wallet');
      console.error(e);
    }
  };

  // Import existing wallet
  const handleImportWallet = () => {
    setError('');
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (!importKey.trim()) {
      setError('Please enter a private key');
      return;
    }
    
    try {
      let privateKey = importKey.trim();
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      
      const importedWallet = new ethers.Wallet(privateKey);
      const encrypted = encryptKey(privateKey, password);
      
      const stored: StoredWallet = {
        address: importedWallet.address,
        encryptedKey: encrypted,
        createdAt: Date.now(),
      };
      
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(stored));
      setStoredWallet(stored);
      setWallet(importedWallet);
      setShowImportModal(false);
      setPassword('');
      setImportKey('');
    } catch (e) {
      setError('Invalid private key');
      console.error(e);
    }
  };

  // Unlock existing wallet
  const handleUnlockWallet = () => {
    setError('');
    
    if (!storedWallet) {
      setError('No wallet found');
      return;
    }
    
    const decrypted = decryptKey(storedWallet.encryptedKey, password);
    if (!decrypted) {
      setError('Incorrect password');
      return;
    }
    
    try {
      const unlockedWallet = new ethers.Wallet(decrypted);
      if (unlockedWallet.address.toLowerCase() !== storedWallet.address.toLowerCase()) {
        setError('Wallet verification failed');
        return;
      }
      
      setWallet(unlockedWallet);
      setShowUnlockModal(false);
      setPassword('');
    } catch (e) {
      setError('Failed to unlock wallet');
      console.error(e);
    }
  };

  // Lock wallet
  const handleLockWallet = () => {
    setWallet(null);
    setShowPrivateKey(false);
  };

  // Delete wallet
  const handleDeleteWallet = () => {
    if (confirm('Are you sure? This will permanently delete your wallet. Make sure you have backed up your private key!')) {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      setStoredWallet(null);
      setWallet(null);
      onWalletChange?.(null);
    }
  };

  // Copy address
  const copyAddress = async () => {
    if (wallet) {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Grant session key
  const handleGrantSessionKey = async () => {
    if (!wallet) return;
    
    setIsGranting(true);
    try {
      const permissions: SessionKeyPermissions = {
        ...getDefaultPermissions(),
        maxAmount,
        expiryHours: parseInt(expiryHours) || 24
      };
      
      const key = await grantSessionKeyPermissions(wallet.address, permissions);
      setSessionKey(key);
      setHasSessionKey(true);
      onSessionKeyChange?.(true);
    } catch (error) {
      console.error('Error granting session key:', error);
    } finally {
      setIsGranting(false);
    }
  };

  // Revoke session key
  const handleRevokeSessionKey = async () => {
    if (!wallet) return;
    
    setIsRevoking(true);
    try {
      revokeSessionKey(wallet.address);
      setSessionKey(null);
      setHasSessionKey(false);
      onSessionKeyChange?.(false);
    } catch (error) {
      console.error('Error revoking session key:', error);
    } finally {
      setIsRevoking(false);
    }
  };

  const tradeStats = getTradeStats(trades);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="text-gray-400">Loading wallet...</span>
        </div>
      </div>
    );
  }

  // No wallet - show create/import options
  if (!storedWallet) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-500/10 to-cyan-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Trading Wallet</h3>
              <p className="text-xs text-gray-400">Create your embedded wallet for BSC</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-blue-300 font-medium mb-1">Separate from MetaMask</p>
                <p className="text-gray-400 text-xs">
                  This is a new embedded wallet for AI trading on BSC Testnet. 
                  Create it with a password. You can export the private key anytime.
                </p>
              </div>
            </div>
          </div>

          {/* Chain Info */}
          <div className="bg-slate-700/30 rounded-lg p-3 mb-4 text-xs text-gray-400">
            <div className="flex items-center justify-between">
              <span>Network:</span>
              <span className="text-white font-medium">{BSC_TESTNET.name}</span>
            </div>
          </div>

          {/* Create/Import Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Wallet
            </button>
            
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              <Import className="w-4 h-4" />
              Import Existing Wallet
            </button>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Create New Wallet</h3>
              
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password (min 8 chars)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    placeholder="Confirm password"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setPassword('');
                    setConfirmPassword('');
                    setError('');
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWallet}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Import Wallet</h3>
              
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Private Key</label>
                  <input
                    type="password"
                    value={importKey}
                    onChange={(e) => setImportKey(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                    placeholder="0x..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Set Password (min 8 chars)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                    placeholder="Enter password"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setPassword('');
                    setImportKey('');
                    setError('');
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportWallet}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg font-medium"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Wallet exists but locked
  if (!wallet) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Lock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Wallet Locked</h3>
              <p className="text-xs text-gray-400 font-mono">
                {storedWallet.address.slice(0, 10)}...{storedWallet.address.slice(-8)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => setShowUnlockModal(true)}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            Unlock Wallet
          </button>
          
          <button
            onClick={handleDeleteWallet}
            className="w-full py-3 mt-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Wallet
          </button>
        </div>

        {/* Unlock Modal */}
        {showUnlockModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Unlock Wallet</h3>
              
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlockWallet()}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowUnlockModal(false);
                    setPassword('');
                    setError('');
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlockWallet}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg font-medium"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Wallet unlocked - show full UI
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-green-500/10 to-cyan-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Bot className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Trading Wallet</h3>
              <p className="text-xs text-green-400">● Unlocked</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Session Status Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              hasSessionKey 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {hasSessionKey ? (
                <>
                  <Unlock className="w-3 h-3" />
                  AI Active
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" />
                  AI Inactive
                </>
              )}
            </div>
            
            <button
              onClick={handleLockWallet}
              className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
              title="Lock wallet"
            >
              <Lock className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Wallet Address & Balance */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Wallet Address</span>
            <span className="text-xs text-gray-500">{BSC_TESTNET.name}</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 text-sm text-white font-mono bg-slate-800 px-3 py-2 rounded truncate">
              {wallet.address}
            </code>
            <button
              onClick={copyAddress}
              className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <a
              href={`${BSC_TESTNET.blockExplorer}/address/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
              title="View on explorer"
            >
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
            <span className="text-sm text-gray-400">Balance</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                {parseFloat(balance).toFixed(4)} {BSC_TESTNET.symbol}
              </span>
              <button
                onClick={fetchBalance}
                className="p-1 hover:bg-slate-600 rounded transition-colors"
                title="Refresh balance"
              >
                <RefreshCw className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Session Key Section */}
        <div className="border-t border-slate-700/50 pt-4">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-400" />
            AI Trading Authorization
          </h4>

          {hasSessionKey && sessionKey ? (
            /* Active Session */
            <>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Session Active</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Max Trade:</span>
                    <span className="ml-2 text-white font-medium">
                      {sessionKey.permissions.maxAmount} YBOT
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Expires:</span>
                    <span className="ml-2 text-white font-medium">
                      {formatSessionExpiry(sessionKey.expiryAt)}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <span>AI agent can auto-execute trades within limits</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleRevokeSessionKey}
                disabled={isRevoking}
                className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRevoking ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Revoke AI Access
              </button>
            </>
          ) : (
            /* Grant Session Key */
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-4">
                Grant the AI agent permission to execute trades on your behalf. 
                You set the limits and can revoke access anytime.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Amount (YBOT)</label>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Duration</label>
                  <select
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                  >
                    <option value="1">1 hour</option>
                    <option value="6">6 hours</option>
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                  </select>
                </div>
              </div>
              
              <button
                onClick={handleGrantSessionKey}
                disabled={isGranting}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGranting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Authorize AI Agent
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Trade History Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Trade History</span>
            <span className="px-2 py-0.5 bg-slate-600 rounded text-xs text-gray-300">
              {trades.length}
            </span>
          </div>
          {showHistory ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {showHistory && (
          <div className="bg-slate-700/20 rounded-lg p-4 space-y-3">
            {trades.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pb-3 border-b border-slate-700/50">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-lg font-bold text-white">{tradeStats.totalTrades}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Success</p>
                  <p className="text-lg font-bold text-green-400">{tradeStats.successfulTrades}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Volume</p>
                  <p className="text-lg font-bold text-cyan-400">{tradeStats.totalVolume.toFixed(0)}</p>
                </div>
              </div>
            )}
            
            {trades.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No trades yet</p>
                <p className="text-xs">AI-executed trades will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {trades.slice(0, 10).map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        trade.status === 'success' ? 'bg-green-500' :
                        trade.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-white capitalize">{trade.action}</span>
                      <span className="text-gray-400">{trade.amount} {trade.token}</span>
                    </div>
                    <span className="text-gray-500">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Advanced Options */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-white">Wallet Settings</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="bg-slate-700/20 rounded-lg p-4 space-y-3">
            {/* Export Private Key */}
            <div>
              <button
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="w-full py-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {showPrivateKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {showPrivateKey ? 'Hide' : 'Show'} Private Key
              </button>
              
              {showPrivateKey && (
                <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Private Key</span>
                  </div>
                  <code className="block text-xs text-white font-mono bg-slate-800 px-3 py-2 rounded break-all">
                    {wallet.privateKey}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(wallet.privateKey);
                      alert('Private key copied!');
                    }}
                    className="mt-2 text-xs text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy to clipboard
                  </button>
                  <p className="text-xs text-red-300 mt-2">
                    ⚠️ Never share your private key. Anyone with it can access your funds.
                  </p>
                </div>
              )}
            </div>

            {/* Delete Wallet */}
            <button
              onClick={handleDeleteWallet}
              className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Wallet
            </button>
          </div>
        )}

        {/* Security Notice */}
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-400">
            <p className="text-blue-300 font-medium mb-1">Embedded Wallet</p>
            <p>
              This wallet is separate from your MetaMask. It's specifically for AI agent trading on BSC Testnet.
              Export the private key for backup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddedWalletPanel;
