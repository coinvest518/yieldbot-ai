/**
 * AI Agent Dashboard Component
 * Beautiful Taskade-like interface for managing trading agents
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Play,
  Pause,
  Settings,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Shield,
  Target,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  BarChart3,
  Wallet,
  Eye,
  EyeOff,
  Check,
  X,
  Info,
  Send,
  Sparkles,
  Brain,
} from 'lucide-react';
import {
  agentManager,
  AgentState,
  AgentAction,
  AgentLogEntry,
  AgentConfig,
  DEFAULT_AGENT_CONFIGS,
} from '../services/agentService';
import {
  aiAgentManager,
  initializeAIAgents,
  YBOTAIAgent,
  AIDecision,
  ChatMessage,
} from '../services/aiAgentService';

// ============ TYPES ============

interface AgentDashboardProps {
  walletAddress?: string;
}

// ============ HELPER COMPONENTS ============

const StatusBadge: React.FC<{ status: AgentState['status'] }> = ({ status }) => {
  const styles = {
    idle: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    monitoring: 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse',
    analyzing: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
    executing: 'bg-purple-500/20 text-purple-400 border-purple-500/30 animate-pulse',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const icons = {
    idle: <Clock size={12} />,
    monitoring: <Eye size={12} />,
    analyzing: <Activity size={12} />,
    executing: <Zap size={12} />,
    paused: <Pause size={12} />,
    error: <AlertTriangle size={12} />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const AgentIcon: React.FC<{ type: AgentConfig['type']; className?: string }> = ({ type, className = '' }) => {
  const icons = {
    'yield-hunter': <Target className={className} />,
    'risk-monitor': <Shield className={className} />,
    'trade-executor': <Zap className={className} />,
    'portfolio-manager': <BarChart3 className={className} />,
  };
  return icons[type] || <Bot className={className} />;
};

const LogIcon: React.FC<{ type: AgentLogEntry['type'] }> = ({ type }) => {
  const icons = {
    info: <Info size={14} className="text-blue-400" />,
    warning: <AlertTriangle size={14} className="text-yellow-400" />,
    action: <Zap size={14} className="text-purple-400" />,
    error: <X size={14} className="text-red-400" />,
    success: <CheckCircle size={14} className="text-green-400" />,
  };
  return icons[type];
};

// ============ AGENT CARD ============

const AgentCard: React.FC<{
  agent: AgentState;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ agent, onToggle, onSelect, isSelected }) => {
  const isRunning = agent.status === 'monitoring' || agent.status === 'analyzing' || agent.status === 'executing';
  
  return (
    <div
      onClick={onSelect}
      className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
        isSelected
          ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/50 shadow-lg shadow-purple-500/10'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isRunning ? 'bg-green-500/20' : 'bg-slate-700'}`}>
            <AgentIcon type={agent.config.type} className={`w-5 h-5 ${isRunning ? 'text-green-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{agent.config.name}</h3>
            <p className="text-xs text-gray-500">{agent.config.type}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <p className="text-xs text-gray-500 mb-0.5">P&L</p>
          <p className={`text-sm font-bold ${agent.stats.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {agent.stats.pnlPercent >= 0 ? '+' : ''}{agent.stats.pnlPercent.toFixed(2)}%
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <p className="text-xs text-gray-500 mb-0.5">Actions</p>
          <p className="text-sm font-bold text-white">{agent.stats.actionsExecuted}</p>
        </div>
      </div>

      {/* Last Activity */}
      <div className="text-xs text-gray-500 mb-4">
        {agent.lastCheck ? (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            Last check: {new Date(agent.lastCheck).toLocaleTimeString()}
          </span>
        ) : (
          <span>Never checked</span>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
          isRunning
            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
        }`}
      >
        {isRunning ? (
          <>
            <Pause size={16} /> Pause Agent
          </>
        ) : (
          <>
            <Play size={16} /> Start Agent
          </>
        )}
      </button>

      {/* Pending Actions Badge */}
      {agent.pendingActions.length > 0 && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold animate-bounce">
          {agent.pendingActions.length}
        </div>
      )}
    </div>
  );
};

// ============ ACTIVITY FEED ============

const ActivityFeed: React.FC<{ logs: AgentLogEntry[] }> = ({ logs }) => {
  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
          >
            <div className="mt-0.5">
              <LogIcon type={log.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300">{log.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// ============ PENDING ACTIONS ============

const PendingActions: React.FC<{
  actions: AgentAction[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}> = ({ actions, onApprove, onReject }) => {
  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No pending actions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div
          key={action.id}
          className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 text-xs font-medium">
                {action.type.toUpperCase()}
              </span>
              <h4 className="text-white font-medium mt-2">{action.protocol}</h4>
              <p className="text-sm text-gray-400">{action.pool}</p>
            </div>
            <p className="text-lg font-bold text-white">${action.amount.toLocaleString()}</p>
          </div>
          
          <p className="text-sm text-gray-300 mb-4">{action.reason}</p>
          
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(action.id)}
              className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Check size={16} /> Approve
            </button>
            <button
              onClick={() => onReject(action.id)}
              className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium text-sm flex items-center justify-center gap-2 transition-all"
            >
              <X size={16} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============ AGENT SETTINGS ============

const AgentSettings: React.FC<{
  config: AgentConfig;
  onUpdate: (config: Partial<AgentConfig>) => void;
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-400 block mb-2">Min APY Threshold (%)</label>
        <input
          type="number"
          value={config.minAPYThreshold}
          onChange={(e) => onUpdate({ minAPYThreshold: parseFloat(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
        />
      </div>
      
      <div>
        <label className="text-sm text-gray-400 block mb-2">Max Risk Level</label>
        <select
          value={config.maxRiskLevel}
          onChange={(e) => onUpdate({ maxRiskLevel: e.target.value as any })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      
      <div>
        <label className="text-sm text-gray-400 block mb-2">Rebalance Threshold (%)</label>
        <input
          type="number"
          value={config.rebalanceThreshold}
          onChange={(e) => onUpdate({ rebalanceThreshold: parseFloat(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400 block mb-2">Take Profit (%)</label>
          <input
            type="number"
            value={config.takeProfitPercent}
            onChange={(e) => onUpdate({ takeProfitPercent: parseFloat(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-2">Stop Loss (%)</label>
          <input
            type="number"
            value={config.stopLossPercent}
            onChange={(e) => onUpdate({ stopLossPercent: parseFloat(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
          />
        </div>
      </div>
      
      <div>
        <label className="text-sm text-gray-400 block mb-2">Check Interval (minutes)</label>
        <input
          type="number"
          value={config.checkIntervalMinutes}
          onChange={(e) => onUpdate({ checkIntervalMinutes: parseInt(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
        />
      </div>
      
      <div>
        <label className="text-sm text-gray-400 block mb-2">Max Position Size ($)</label>
        <input
          type="number"
          value={config.maxPositionSize}
          onChange={(e) => onUpdate({ maxPositionSize: parseFloat(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 outline-none"
        />
      </div>
    </div>
  );
};

// ============ MAIN DASHBOARD ============

const AgentDashboard: React.FC<AgentDashboardProps> = ({ walletAddress }) => {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'activity' | 'actions' | 'settings'>('activity');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and subscribe to agent updates
  useEffect(() => {
    const loadAgents = () => {
      const allAgents = agentManager.getAllAgents();
      setAgents(allAgents);
      if (allAgents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(allAgents[0].config.id);
      }
      setIsLoading(false);
    };

    loadAgents();
    agentManager.subscribe((updatedAgents) => {
      setAgents(updatedAgents);
    });
  }, []);

  const selectedAgent = agents.find((a) => a.config.id === selectedAgentId);

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

  const handleApproveAction = (actionId: string) => {
    if (selectedAgent) {
      const agent = agentManager.getAgent(selectedAgent.config.id);
      agent?.approveAction(actionId);
    }
  };

  const handleRejectAction = (actionId: string) => {
    if (selectedAgent) {
      const agent = agentManager.getAgent(selectedAgent.config.id);
      agent?.rejectAction(actionId);
    }
  };

  const handleUpdateConfig = (updates: Partial<AgentConfig>) => {
    if (selectedAgent) {
      const agent = agentManager.getAgent(selectedAgent.config.id);
      agent?.updateConfig(updates);
    }
  };

  // Calculate overall stats
  const totalPnL = agents.reduce((sum, a) => sum + a.stats.totalPnL, 0);
  const totalActions = agents.reduce((sum, a) => sum + a.stats.actionsExecuted, 0);
  const activeAgents = agents.filter(
    (a) => a.status === 'monitoring' || a.status === 'analyzing' || a.status === 'executing'
  ).length;
  const pendingActionsCount = agents.reduce((sum, a) => sum + a.pendingActions.length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl p-5 border border-purple-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-gray-400 text-sm">Active Agents</span>
          </div>
          <p className="text-3xl font-bold text-white">{activeAgents}<span className="text-lg text-gray-500">/{agents.length}</span></p>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl p-5 border border-green-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-gray-400 text-sm">Total P&L</span>
          </div>
          <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-2xl p-5 border border-blue-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-gray-400 text-sm">Actions Executed</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalActions}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 rounded-2xl p-5 border border-yellow-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">Pending Actions</span>
          </div>
          <p className="text-3xl font-bold text-white">{pendingActionsCount}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Agent Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              AI Trading Agents
            </h3>
            <button
              onClick={() => agentManager.startAll()}
              className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-all flex items-center gap-2"
            >
              <Play size={14} /> Start All
            </button>
          </div>

          <div className="grid gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.config.id}
                agent={agent}
                onToggle={() => handleToggleAgent(agent.config.id)}
                onSelect={() => setSelectedAgentId(agent.config.id)}
                isSelected={agent.config.id === selectedAgentId}
              />
            ))}
          </div>
        </div>

        {/* Agent Detail Panel */}
        <div className="lg:col-span-7">
          {selectedAgent ? (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
              {/* Panel Header */}
              <div className="p-5 border-b border-slate-700/50 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                      <AgentIcon type={selectedAgent.config.type} className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedAgent.config.name}</h3>
                      <p className="text-sm text-gray-400">{selectedAgent.config.type}</p>
                    </div>
                  </div>
                  <StatusBadge status={selectedAgent.status} />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-700/50">
                {[
                  { id: 'activity', label: 'Activity', icon: Activity },
                  { id: 'actions', label: 'Pending', icon: Zap, badge: selectedAgent.pendingActions.length },
                  { id: 'settings', label: 'Settings', icon: Settings },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                      activeTab === tab.id
                        ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                    {tab.badge ? (
                      <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-5">
                {activeTab === 'activity' && <ActivityFeed logs={selectedAgent.activityLog} />}
                {activeTab === 'actions' && (
                  <PendingActions
                    actions={selectedAgent.pendingActions}
                    onApprove={handleApproveAction}
                    onReject={handleRejectAction}
                  />
                )}
                {activeTab === 'settings' && (
                  <AgentSettings config={selectedAgent.config} onUpdate={handleUpdateConfig} />
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 bg-slate-800/30 rounded-2xl border border-slate-700/50 min-h-[400px]">
              <div className="text-center">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select an agent to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
