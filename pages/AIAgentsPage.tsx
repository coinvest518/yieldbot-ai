/**
 * AI Agents Page - Dedicated dashboard for AI trading agents with chat interface
 * Features: Wallet-aware AI, trade execution, ElizaOS-style personality
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Navbar from '../components/Navbar';
import {
  Bot,
  Play,
  Pause,
  Settings,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Shield,
  Target,
  RefreshCw,
  MessageSquare,
  BarChart3,
  Send,
  Sparkles,
  Brain,
  ArrowLeft,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  Home,
  Wallet,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import {
  agentManager,
  AgentState,
  AgentAction,
  AgentLogEntry,
  AgentConfig,
} from '../services/agentService';
import {
  aiAgentManager,
  initializeAIAgents,
  YBOTAIAgent,
  AIDecision,
  ChatMessage,
  PortfolioState,
  WalletState,
} from '../services/aiAgentService';
import { getYBOTBalance } from '../services/web3Service';
import { stakeYBOT, LOCK_TIERS } from '../services/stakingService';
import EmbeddedWalletPanel from '../components/EmbeddedWalletPanel';

// ============ TRADE EXECUTION PANEL ============

interface TradeExecutionPanelProps {
  decision: AIDecision;
  onExecute: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

const TradeExecutionPanel: React.FC<TradeExecutionPanelProps> = ({
  decision,
  onExecute,
  onCancel,
  isExecuting
}) => (
  <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 rounded-xl p-4 my-2">
    <div className="flex items-center gap-2 mb-3">
      <Zap className="w-5 h-5 text-purple-400" />
      <span className="font-semibold text-white">Transaction Ready</span>
    </div>
    
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">Action:</span>
        <span className="text-white font-medium capitalize">{decision.action}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Protocol:</span>
        <span className="text-white">{decision.protocol}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Pool:</span>
        <span className="text-white">{decision.pool}</span>
      </div>
      {decision.amount && (
        <div className="flex justify-between">
          <span className="text-gray-400">Amount:</span>
          <span className="text-green-400 font-medium">${decision.amount.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-gray-400">Confidence:</span>
        <span className={`font-medium ${decision.confidence >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
          {decision.confidence}%
        </span>
      </div>
    </div>
    
    <div className="flex gap-2 mt-4">
      <button
        onClick={onCancel}
        disabled={isExecuting}
        className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onExecute}
        disabled={isExecuting}
        className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isExecuting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Executing...
          </>
        ) : (
          <>
            <ArrowRight className="w-4 h-4" />
            Execute
          </>
        )}
      </button>
    </div>
  </div>
);

// ============ CHAT INTERFACE ============

interface ChatInterfaceProps {
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose, isExpanded, onToggleExpand }) => {
  const { address, isConnected, chainId } = useAccount();
  const { data: bnbBalance } = useBalance({ address });
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "👋 Hey! I'm YBOT, your elite DeFi trading AI. I have live access to BSC yields and can help you:\n\n🔥 **Find top yields** across Venus, PancakeSwap, Beefy\n💰 **Execute trades** when you're ready to deploy\n📊 **Analyze your portfolio** and optimize returns\n⚡ **Alert you** to opportunities and risks\n\nConnect your wallet for personalized insights, or just ask me anything about BSC DeFi!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<AIDecision | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [ybotBalance, setYbotBalance] = useState('0');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get AI agent - lazy initialization on first use
  const [aiAgent, setAiAgent] = useState<YBOTAIAgent | null>(null);
  const [aiInitialized, setAiInitialized] = useState(false);

  // Format BNB balance
  const formattedBnbBalance = bnbBalance 
    ? formatUnits(bnbBalance.value, bnbBalance.decimals)
    : '0';

  // Fetch YBOT balance when wallet connects
  useEffect(() => {
    if (address) {
      getYBOTBalance(address).then(setYbotBalance).catch(() => setYbotBalance('0'));
    }
  }, [address]);

  // Build wallet state for AI context
  const walletState: WalletState | undefined = isConnected && address ? {
    address,
    balance: formattedBnbBalance,
    ybotBalance,
    chainId: chainId || 56,
    isConnected: true
  } : undefined;

  // Auto-scroll to bottom of chat messages only
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  // Initialize AI only when user first sends a message (lazy load)
  const ensureAIInitialized = () => {
    if (!aiInitialized) {
      initializeAIAgents();
      setAiInitialized(true);
      const agent = aiAgentManager.getAgent('YBOT Yield Hunter');
      setAiAgent(agent || null);
      return agent;
    }
    return aiAgent;
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      // Initialize AI on first message (lazy load - no API call until user sends)
      const agent = ensureAIInitialized();
      
      // Build portfolio from wallet state
      const portfolio: PortfolioState = {
        totalValueUSD: parseFloat(formattedBnbBalance) * 600 + parseFloat(ybotBalance) * 0.1, // Rough estimate
        positions: [],
        availableBalance: parseFloat(formattedBnbBalance) * 600, // BNB in USD
      };

      let response: string;
      if (agent) {
        response = await agent.chat(userInput, portfolio, walletState);
        
        // Check for pending action
        const action = agent.getPendingAction();
        if (action) {
          setPendingAction(action);
        }
      } else {
        // Fallback response if AI not initialized
        response = getMockResponse(userInput);
      }

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "⚠️ Hit a snag there. Mind trying again?",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExecuteTrade = async () => {
    if (!pendingAction || !isConnected) return;
    
    setIsExecuting(true);
    try {
      let txHash: string;
      
      // Handle staking specifically
      if (pendingAction.action === 'stake' && pendingAction.token === 'YBOT') {
        console.log('[AI Agent] Executing YBOT stake:', pendingAction.amount);
        
        // Use flexible tier by default (can be enhanced to let user choose)
        const lockDuration = LOCK_TIERS.FLEXIBLE; // 0 = no lock
        const amount = pendingAction.amount?.toString() || '10';
        
        txHash = await stakeYBOT(amount, lockDuration);
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **Staking Successful!**\n\n🎉 You staked **${amount} YBOT** in the Flexible Pool!\n\n**Transaction:** \`${txHash.slice(0, 10)}...${txHash.slice(-8)}\`\n\nYour tokens are now earning **5% APY**! Check the Staking page to view your position and rewards. 🔥`,
          timestamp: new Date()
        }]);
        
        // Refresh YBOT balance
        if (address) {
          getYBOTBalance(address).then(setYbotBalance).catch(() => {});
        }
      } else {
        // TODO: Implement other trade execution via web3Service
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **Transaction Submitted!**\n\n${pendingAction.action} ${pendingAction.amount ? `$${pendingAction.amount}` : ''} to ${pendingAction.protocol} ${pendingAction.pool}\n\nTracking your position... 📊`,
          timestamp: new Date()
        }]);
      }
      
      setPendingAction(null);
      aiAgent?.clearPendingAction();
    } catch (error: any) {
      console.error('[AI Agent] Trade execution error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant', 
        content: `❌ **Transaction Failed**\n\n${error.message || 'Unknown error occurred'}\n\nPlease check your wallet and try again.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelTrade = () => {
    setPendingAction(null);
    aiAgent?.clearPendingAction();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '🚫 Trade cancelled. What else can I help with?',
      timestamp: new Date()
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick action buttons - context aware
  const quickActions = isConnected ? [
    { label: '📈 Best yields?', prompt: 'What are the best yield opportunities right now for my portfolio?' },
    { label: '💰 My portfolio', prompt: 'Analyze my current positions and suggest improvements' },
    { label: '🔐 Stake YBOT', prompt: 'Stake 100 YBOT tokens for me' },
    { label: '🔄 Rebalance', prompt: 'Should I rebalance my positions?' },
  ] : [
    { label: '📈 Best yields?', prompt: 'What are the best yield opportunities right now?' },
    { label: '🛡️ Risk tips', prompt: 'What are the main risks I should watch out for in DeFi?' },
    { label: '💰 Venus APY', prompt: 'What are the current APY rates on Venus Protocol?' },
    { label: '🥞 PancakeSwap', prompt: 'Tell me about PancakeSwap V3 LP farming' },
  ];

  return (
    <div className={`flex flex-col bg-slate-900/95 backdrop-blur-lg rounded-2xl border border-slate-700/50 shadow-2xl ${
      isExpanded ? 'h-[calc(100vh-200px)]' : 'h-[600px]'
    }`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-500/10 to-cyan-500/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></span>
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              YBOT AI
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Online</span>
            </h3>
            <p className="text-xs text-gray-400">
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3" />
                  {address?.slice(0, 6)}...{address?.slice(-4)} • {parseFloat(formattedBnbBalance).toFixed(4)} BNB
                </span>
              ) : (
                'Connect wallet for personalized insights'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : 'bg-slate-800 text-gray-200 rounded-bl-md border border-slate-700/50'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none
                  prose-headings:text-white prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-3
                  prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                  prose-p:text-gray-200 prose-p:mb-2 prose-p:leading-relaxed
                  prose-strong:text-purple-300 prose-strong:font-semibold
                  prose-em:text-cyan-300
                  prose-ul:my-2 prose-ul:pl-4 prose-li:text-gray-300 prose-li:mb-1
                  prose-ol:my-2 prose-ol:pl-4
                  prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-cyan-300 prose-code:text-xs
                  prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-600 prose-pre:rounded-lg prose-pre:p-3
                  prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
                ">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm leading-relaxed">{msg.content}</div>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                <span className="text-xs opacity-60">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(msg.content, index)}
                    className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1 transition-opacity"
                  >
                    {copiedId === index ? (
                      <>
                        <Check size={12} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Pending Trade Execution Panel */}
        {pendingAction && isConnected && (
          <TradeExecutionPanel
            decision={pendingAction}
            onExecute={handleExecuteTrade}
            onCancel={handleCancelTrade}
            isExecuting={isExecuting}
          />
        )}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs text-gray-400">YBOT is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-5 py-3 border-t border-slate-700/30">
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                setInput(action.prompt);
                inputRef.current?.focus();
              }}
              className="flex-shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs rounded-full border border-slate-700/50 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-5 pb-5">
        <div className="flex items-end gap-3 bg-slate-800 rounded-xl border border-slate-600 p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask YBOT anything about DeFi..."
            rows={1}
            className="flex-1 bg-slate-700 border-none outline-none text-white placeholder-gray-400 resize-none py-2 px-3 max-h-32 rounded-lg caret-purple-400"
            style={{ minHeight: '40px', caretColor: '#c084fc' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={`p-2.5 rounded-lg transition-all ${
              input.trim() && !isTyping
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:opacity-90'
                : 'bg-slate-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by Google Gemini AI • Not financial advice
        </p>
      </div>
    </div>
  );
};

// Mock response fallback
function getMockResponse(message: string): string {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('best') || lowerMsg.includes('yield') || lowerMsg.includes('opportunity')) {
    return "📈 **Current Top Yields on BSC:**\n\n1. **Venus USDT** - ~5-8% APY (Low Risk)\n2. **PancakeSwap CAKE-BNB** - ~15-25% APY (Medium Risk)\n3. **Beefy Auto-Compound** - Varies by vault\n\nFor your risk profile, I'd recommend starting with Venus lending for stable returns, then diversifying into LP farms as you get more comfortable.";
  }
  if (lowerMsg.includes('risk') || lowerMsg.includes('safe')) {
    return "🛡️ **Key DeFi Risks to Watch:**\n\n• **Smart Contract Risk** - Always use audited protocols\n• **Impermanent Loss** - Affects LP positions\n• **Oracle Manipulation** - Can cause liquidations\n• **Rug Pulls** - Stick to established projects\n\n**My Tips:**\n1. Never invest more than you can lose\n2. Diversify across protocols\n3. Set stop-losses\n4. Monitor positions regularly";
  }
  if (lowerMsg.includes('venus')) {
    return "🏦 **Venus Protocol Overview:**\n\nVenus is the largest lending protocol on BSC, similar to Aave/Compound.\n\n**Current Rates (approximate):**\n• USDT Supply: 5-8% APY\n• BNB Supply: 2-4% APY\n• BTCB Supply: 1-3% APY\n\n**How it works:**\n1. Supply assets to earn interest\n2. Borrow against your collateral\n3. Earn XVS rewards\n\nWant me to analyze specific opportunities?";
  }
  if (lowerMsg.includes('pancake') || lowerMsg.includes('swap')) {
    return "🥞 **PancakeSwap V3 LP Farming:**\n\n**Key Features:**\n• Concentrated liquidity (like Uniswap V3)\n• Higher capital efficiency\n• Customizable price ranges\n\n**Popular Pairs:**\n• CAKE-BNB: ~15-25% APY\n• USDT-BNB: ~10-15% APY\n• BTCB-BNB: ~8-12% APY\n\n**Tips:**\n• Wider ranges = less IL, lower APY\n• Tighter ranges = more IL risk, higher APY\n• CAKE staking boost available";
  }
  
  return "🤖 I'm YBOT, your DeFi assistant! I can help with:\n\n• **Yield Analysis** - Find best APY opportunities\n• **Risk Assessment** - Understand protocol risks\n• **Strategy Tips** - Optimize your portfolio\n• **Protocol Info** - Venus, PancakeSwap, Beefy\n\nWhat would you like to explore?";
}

// ============ STATUS BADGE ============

const StatusBadge: React.FC<{ status: AgentState['status'] }> = ({ status }) => {
  const styles = {
    idle: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    monitoring: 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse',
    analyzing: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
    executing: 'bg-purple-500/20 text-purple-400 border-purple-500/30 animate-pulse',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ============ AGENT ICON ============

const AgentIcon: React.FC<{ type: AgentConfig['type']; className?: string }> = ({ type, className = '' }) => {
  const icons = {
    'yield-hunter': <Target className={className} />,
    'risk-monitor': <Shield className={className} />,
    'trade-executor': <Zap className={className} />,
    'portfolio-manager': <BarChart3 className={className} />,
  };
  return icons[type] || <Bot className={className} />;
};

// ============ MINI AGENT CARD ============

const MiniAgentCard: React.FC<{
  agent: AgentState;
  onToggle: () => void;
}> = ({ agent, onToggle }) => {
  const isRunning = agent.status === 'monitoring' || agent.status === 'analyzing' || agent.status === 'executing';
  
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isRunning ? 'bg-green-500/20' : 'bg-slate-700'}`}>
            <AgentIcon type={agent.config.type} className={`w-4 h-4 ${isRunning ? 'text-green-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <h4 className="font-medium text-white text-sm">{agent.config.name}</h4>
            <p className="text-xs text-gray-500">{agent.config.type}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs">
          <span className={agent.stats.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}>
            {agent.stats.pnlPercent >= 0 ? '+' : ''}{agent.stats.pnlPercent.toFixed(1)}% P&L
          </span>
          <span className="text-gray-400">{agent.stats.actionsExecuted} actions</span>
        </div>
        <button
          onClick={onToggle}
          className={`p-2 rounded-lg transition-all ${
            isRunning
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          }`}
        >
          {isRunning ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </div>
  );
};

// ============ AI DECISIONS PANEL ============

const AIDecisionsPanel: React.FC<{ decisions: AIDecision[] }> = ({ decisions }) => {
  if (decisions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No AI recommendations yet</p>
        <p className="text-xs mt-1">Start an agent to get AI-powered insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((decision, index) => (
        <div
          key={index}
          className={`p-4 rounded-xl border ${
            decision.urgency === 'high'
              ? 'bg-red-500/10 border-red-500/30'
              : decision.urgency === 'medium'
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-slate-800/50 border-slate-700/50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                decision.action === 'deposit' ? 'bg-green-500/20 text-green-400' :
                decision.action === 'withdraw' ? 'bg-red-500/20 text-red-400' :
                decision.action === 'rebalance' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {decision.action.toUpperCase()}
              </span>
              <span className="text-sm text-white">{decision.protocol}</span>
            </div>
            <span className="text-xs text-gray-400">{decision.confidence}% confident</span>
          </div>
          <p className="text-sm text-gray-300">{decision.reason}</p>
          {decision.aiAnalysis && (
            <p className="text-xs text-gray-500 mt-2 italic">{decision.aiAnalysis}</p>
          )}
        </div>
      ))}
    </div>
  );
};

// ============ MAIN PAGE COMPONENT ============

const AIAgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [aiDecisions, setAiDecisions] = useState<AIDecision[]>([]);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [showAgentList, setShowAgentList] = useState(true);
  const { address, isConnected } = useAccount();

  // Initialize and subscribe to agent updates (no API calls here - just local agents)
  useEffect(() => {
    // Load local agents (no API calls)
    const loadAgents = () => {
      const allAgents = agentManager.getAllAgents();
      setAgents(allAgents);
    };

    loadAgents();
    agentManager.subscribe((updatedAgents) => {
      setAgents(updatedAgents);
    });
  }, []);

  const handleToggleAgent = (agentId: string) => {
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      const state = agent.getState();
      if (state.status === 'monitoring' || state.status === 'analyzing') {
        agent.stop();
      } else {
        agent.start();
      }
    }
  };

  // Calculate stats
  const activeAgents = agents.filter(
    (a) => a.status === 'monitoring' || a.status === 'analyzing' || a.status === 'executing'
  ).length;
  const totalPnL = agents.reduce((sum, a) => sum + a.stats.totalPnL, 0);

  return (
    <div className="min-h-screen bg-ybot-dark">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8">
        {/* Page Title Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Bot className="w-7 h-7 text-purple-500" />
              <h1 className="text-2xl font-bold text-white">AI <span className="text-purple-400">Agents</span></h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Quick Stats */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-400">{activeAgents} Active</span>
              </div>
              <div className="h-4 w-px bg-slate-700"></div>
              <span className={`text-sm font-medium ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} P&L
              </span>
            </div>
            
            {/* Wallet Status */}
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-400 hidden sm:inline">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 rounded-lg">
                <AlertTriangle size={14} className="text-yellow-400" />
                <span className="text-sm text-yellow-400 hidden sm:inline">Not connected</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Chat Interface */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                Chat with YBOT AI
              </h2>
            </div>
            <ChatInterface
              isExpanded={chatExpanded}
              onToggleExpand={() => setChatExpanded(!chatExpanded)}
            />
          </div>

          {/* Right Column - Agents & Decisions */}
          <div className="space-y-6">
            {/* Agents Section */}
            <div>
              <div
                onClick={() => setShowAgentList(!showAgentList)}
                className="w-full flex items-center justify-between mb-4 cursor-pointer"
              >
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-400" />
                  Trading Agents
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      agentManager.startAll();
                    }}
                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-all"
                  >
                    Start All
                  </button>
                  {showAgentList ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </div>
              
              {showAgentList && (
                <div className="grid gap-3">
                  {agents.map((agent) => (
                    <MiniAgentCard
                      key={agent.config.id}
                      agent={agent}
                      onToggle={() => handleToggleAgent(agent.config.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* AI Decisions Section */}
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                AI Recommendations
              </h2>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <AIDecisionsPanel decisions={aiDecisions} />
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-400" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    // Initialize AI only when user clicks (lazy load)
                    initializeAIAgents();
                    const aiAgent = aiAgentManager.getAgent('YBOT Yield Hunter');
                    if (aiAgent) {
                      const decisions = await aiAgent.runAnalysis();
                      setAiDecisions(decisions);
                    }
                  }}
                  className="p-4 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl border border-purple-500/30 text-purple-400 font-medium transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} />
                  Scan Yields
                </button>
                <button className="p-4 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl border border-blue-500/30 text-blue-400 font-medium transition-all flex items-center justify-center gap-2">
                  <Activity size={18} />
                  View Activity
                </button>
                <button className="p-4 bg-green-500/20 hover:bg-green-500/30 rounded-xl border border-green-500/30 text-green-400 font-medium transition-all flex items-center justify-center gap-2">
                  <TrendingUp size={18} />
                  Portfolio
                </button>
                <button className="p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600/50 text-gray-300 font-medium transition-all flex items-center justify-center gap-2">
                  <Settings size={18} />
                  Settings
                </button>
              </div>
            </div>

            {/* Smart Wallet Section - Separate Embedded Wallet for AI Trading */}
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-green-400" />
                AI Trading Wallet
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Create a <span className="text-purple-400">separate embedded wallet</span> for autonomous AI trading. 
                This is independent of your MetaMask wallet.
              </p>
              <EmbeddedWalletPanel 
                onWalletChange={(addr) => console.log('Embedded wallet:', addr)}
                onSessionKeyChange={(hasKey) => console.log('Session key active:', hasKey)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIAgentsPage;
