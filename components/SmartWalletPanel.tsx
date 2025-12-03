/**
 * Smart Wallet Panel Component
 * Displays smart wallet info, session key management, and trade history
 * Integrates with AI Agent for autonomous trading
 */

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
  Wallet,
  Shield,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  AlertTriangle,
  Zap,
  History,
  Settings,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Lock,
  Unlock,
  Bot
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
  formatTradeDisplay,
  type TradeRecord
} from '../services/tradeStorageService';

interface SmartWalletPanelProps {
  onSessionKeyChange?: (hasKey: boolean) => void;
}

const SmartWalletPanel: React.FC<SmartWalletPanelProps> = ({ onSessionKeyChange }) => {
  const { address, isConnected } = useAccount();
  
  // State
  const [hasSessionKey, setHasSessionKey] = useState(false);
  const [sessionKey, setSessionKey] = useState<StoredSessionKey | null>(null);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [copied, setCopied] = useState(false);
  
  // Custom permissions
  const [maxAmount, setMaxAmount] = useState('1000');
  const [expiryHours, setExpiryHours] = useState('24');
  
  // Check session key status on mount and when address changes
  useEffect(() => {
    if (address) {
      const hasKey = hasActiveSessionKey(address);
      setHasSessionKey(hasKey);
      
      if (hasKey) {
        const key = getSessionKey(address);
        setSessionKey(key);
      } else {
        setSessionKey(null);
      }
      
      // Load trade history
      const history = getLocalTradeHistory(address);
      setTrades(history);
      
      onSessionKeyChange?.(hasKey);
    }
  }, [address, onSessionKeyChange]);
  
  // Refresh session key status periodically
  useEffect(() => {
    if (!address) return;
    
    const interval = setInterval(() => {
      const hasKey = hasActiveSessionKey(address);
      setHasSessionKey(hasKey);
      
      if (hasKey) {
        const key = getSessionKey(address);
        setSessionKey(key);
      } else {
        setSessionKey(null);
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [address]);
  
  const handleGrantSessionKey = async () => {
    if (!address) return;
    
    setIsGranting(true);
    try {
      const permissions: SessionKeyPermissions = {
        ...getDefaultPermissions(),
        maxAmount,
        expiryHours: parseInt(expiryHours) || 24
      };
      
      const key = await grantSessionKeyPermissions(address, permissions);
      setSessionKey(key);
      setHasSessionKey(true);
      onSessionKeyChange?.(true);
    } catch (error) {
      console.error('Error granting session key:', error);
    } finally {
      setIsGranting(false);
    }
  };
  
  const handleRevokeSessionKey = async () => {
    if (!address) return;
    
    setIsRevoking(true);
    try {
      revokeSessionKey(address);
      setSessionKey(null);
      setHasSessionKey(false);
      onSessionKeyChange?.(false);
    } catch (error) {
      console.error('Error revoking session key:', error);
    } finally {
      setIsRevoking(false);
    }
  };
  
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const tradeStats = getTradeStats(trades);
  
  if (!isConnected || !address) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Connect Wallet</h3>
            <p className="text-sm text-gray-400">Connect your wallet to enable AI trading</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Once connected, you can authorize the AI agent to execute trades on your behalf using session keys.
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-500/10 to-cyan-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Agent Wallet</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 font-mono">
                  {address.slice(0, 8)}...{address.slice(-6)}
                </span>
                <button
                  onClick={copyAddress}
                  className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            hasSessionKey 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
          }`}>
            {hasSessionKey ? (
              <>
                <Unlock className="w-3 h-3" />
                AI Authorized
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                Not Authorized
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Session Key Status */}
      <div className="p-4 space-y-4">
        {hasSessionKey && sessionKey ? (
          <>
            {/* Active Session Info */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
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
            
            {/* Revoke Button */}
            <button
              onClick={handleRevokeSessionKey}
              disabled={isRevoking}
              className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRevoking ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Revoke AI Access
            </button>
          </>
        ) : (
          <>
            {/* Grant Session Key Section */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white">Authorize AI Trading</span>
              </div>
              
              <p className="text-xs text-gray-400 mb-4">
                Grant the AI agent permission to execute trades on your behalf. 
                You set the limits and can revoke access anytime.
              </p>
              
              {/* Quick Settings */}
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
                  <label className="block text-xs text-gray-400 mb-1">Duration (hours)</label>
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
              
              {/* Advanced Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors mb-3"
              >
                <Settings className="w-3 h-3" />
                Advanced Settings
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              
              {showAdvanced && (
                <div className="bg-slate-800/50 rounded-lg p-3 mb-4 text-xs text-gray-400">
                  <p className="mb-2">Allowed Contracts:</p>
                  <ul className="space-y-1 font-mono">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      YBOT Staking: 0x600a...9389
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      YBOT Token: 0x5cBb...2712
                    </li>
                  </ul>
                </div>
              )}
              
              {/* Grant Button */}
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
          </>
        )}
        
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
        
        {/* Trade History Panel */}
        {showHistory && (
          <div className="bg-slate-700/20 rounded-lg p-4 space-y-3">
            {/* Stats */}
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
            
            {/* Trade List */}
            {trades.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No trades yet</p>
                <p className="text-xs">AI-executed trades will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
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
        
        {/* Security Notice */}
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-400">
            <p className="text-blue-300 font-medium mb-1">Your funds are safe</p>
            <p>
              Session keys only allow trading within your set limits. 
              The AI cannot withdraw or transfer your tokens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartWalletPanel;
