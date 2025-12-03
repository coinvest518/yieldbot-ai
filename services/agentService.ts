/**
 * YBOT AI Agent Service
 * Manages autonomous trading agents that monitor yields and execute strategies
 */

import { fetchAllYieldStrategies, PoolData } from './protocolDataService';

// Re-export PoolData as YieldStrategy for agent use
export type YieldStrategy = PoolData & {
  protocol: string;
  pool: string;
  risk: 'low' | 'medium' | 'high';
};

// ============ TYPES ============

export type AgentStatus = 'idle' | 'monitoring' | 'analyzing' | 'executing' | 'paused' | 'error';
export type AgentType = 'yield-hunter' | 'risk-monitor' | 'trade-executor' | 'portfolio-manager';

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  enabled: boolean;
  // Thresholds
  minAPYThreshold: number;      // Only consider strategies above this APY
  maxRiskLevel: 'low' | 'medium' | 'high';
  rebalanceThreshold: number;   // % difference to trigger rebalance (e.g., 2 = 2%)
  takeProfitPercent: number;    // Take profit at X% gain
  stopLossPercent: number;      // Stop loss at X% loss
  // Timing
  checkIntervalMinutes: number; // How often to check
  // Limits
  maxPositionSize: number;      // Max USD per position
  maxTotalExposure: number;     // Max USD total across all positions
}

export interface AgentState {
  config: AgentConfig;
  status: AgentStatus;
  lastCheck: Date | null;
  lastAction: string | null;
  currentPositions: AgentPosition[];
  pendingActions: AgentAction[];
  activityLog: AgentLogEntry[];
  stats: AgentStats;
}

export interface AgentPosition {
  id: string;
  protocol: string;
  pool: string;
  entryAPY: number;
  currentAPY: number;
  entryAmount: number;
  currentValue: number;
  pnlPercent: number;
  entryTime: Date;
}

export interface AgentAction {
  id: string;
  type: 'deposit' | 'withdraw' | 'rebalance' | 'take-profit' | 'stop-loss';
  protocol: string;
  pool: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface AgentLogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'action' | 'error' | 'success';
  message: string;
  details?: any;
}

export interface AgentStats {
  totalDeposited: number;
  totalWithdrawn: number;
  totalPnL: number;
  pnlPercent: number;
  actionsExecuted: number;
  successfulActions: number;
  failedActions: number;
  uptime: number; // hours
}

export interface AgentAnalysis {
  timestamp: Date;
  topOpportunities: YieldStrategy[];
  currentBestAPY: number;
  recommendations: AgentRecommendation[];
  riskAssessment: RiskAssessment;
}

export interface AgentRecommendation {
  action: 'deposit' | 'withdraw' | 'rebalance' | 'hold';
  protocol: string;
  pool: string;
  reason: string;
  expectedAPY: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: { factor: string; level: 'low' | 'medium' | 'high'; description: string }[];
}

// ============ DEFAULT CONFIGS ============

export const DEFAULT_AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  'yield-hunter': {
    id: 'yield-hunter-1',
    name: 'Yield Hunter',
    type: 'yield-hunter',
    enabled: true,
    minAPYThreshold: 5,
    maxRiskLevel: 'medium',
    rebalanceThreshold: 2,
    takeProfitPercent: 20,
    stopLossPercent: 10,
    checkIntervalMinutes: 5,
    maxPositionSize: 1000,
    maxTotalExposure: 5000,
  },
  'risk-monitor': {
    id: 'risk-monitor-1',
    name: 'Risk Monitor',
    type: 'risk-monitor',
    enabled: true,
    minAPYThreshold: 0,
    maxRiskLevel: 'high',
    rebalanceThreshold: 5,
    takeProfitPercent: 50,
    stopLossPercent: 5,
    checkIntervalMinutes: 1,
    maxPositionSize: 10000,
    maxTotalExposure: 50000,
  },
  'trade-executor': {
    id: 'trade-executor-1',
    name: 'Trade Executor',
    type: 'trade-executor',
    enabled: false, // Requires user approval
    minAPYThreshold: 3,
    maxRiskLevel: 'low',
    rebalanceThreshold: 1,
    takeProfitPercent: 10,
    stopLossPercent: 5,
    checkIntervalMinutes: 10,
    maxPositionSize: 500,
    maxTotalExposure: 2000,
  },
  'portfolio-manager': {
    id: 'portfolio-manager-1',
    name: 'Portfolio Manager',
    type: 'portfolio-manager',
    enabled: true,
    minAPYThreshold: 3,
    maxRiskLevel: 'medium',
    rebalanceThreshold: 3,
    takeProfitPercent: 25,
    stopLossPercent: 15,
    checkIntervalMinutes: 15,
    maxPositionSize: 2000,
    maxTotalExposure: 10000,
  },
};

// ============ AGENT CLASS ============

class YBOTAgent {
  private state: AgentState;
  private checkInterval: NodeJS.Timeout | null = null;
  private onUpdate: ((state: AgentState) => void) | null = null;

  constructor(config: AgentConfig) {
    this.state = {
      config,
      status: 'idle',
      lastCheck: null,
      lastAction: null,
      currentPositions: [],
      pendingActions: [],
      activityLog: [],
      stats: {
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalPnL: 0,
        pnlPercent: 0,
        actionsExecuted: 0,
        successfulActions: 0,
        failedActions: 0,
        uptime: 0,
      },
    };
  }

  // Subscribe to state updates
  subscribe(callback: (state: AgentState) => void) {
    this.onUpdate = callback;
  }

  // Get current state
  getState(): AgentState {
    return { ...this.state };
  }

  // Update config
  updateConfig(config: Partial<AgentConfig>) {
    this.state.config = { ...this.state.config, ...config };
    this.log('info', `Config updated: ${JSON.stringify(config)}`);
    this.notifyUpdate();
  }

  // Start monitoring
  start() {
    if (this.checkInterval) return;
    
    this.state.status = 'monitoring';
    this.log('success', `${this.state.config.name} started monitoring`);
    
    // Initial check
    this.runCheck();
    
    // Set up interval
    this.checkInterval = setInterval(
      () => this.runCheck(),
      this.state.config.checkIntervalMinutes * 60 * 1000
    );
    
    this.notifyUpdate();
  }

  // Stop monitoring
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.state.status = 'paused';
    this.log('info', `${this.state.config.name} paused`);
    this.notifyUpdate();
  }

  // Run a check cycle
  async runCheck() {
    if (this.state.status === 'paused') return;
    
    try {
      this.state.status = 'analyzing';
      this.notifyUpdate();
      
      // Fetch latest yield data
      const strategyData = await fetchAllYieldStrategies();
      
      // Convert YieldStrategyData to flat array of YieldStrategy
      const strategies: YieldStrategy[] = [
        ...strategyData.strategy1_safeLending.map(p => ({ ...p, pool: p.name, risk: p.riskLevel })),
        ...strategyData.strategy2_stablecoinLP.map(p => ({ ...p, pool: p.name, risk: p.riskLevel })),
        ...strategyData.strategy3_volatileLP.map(p => ({ ...p, pool: p.name, risk: p.riskLevel })),
      ];
      
      // Analyze opportunities
      const analysis = this.analyzeOpportunities(strategies);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(analysis);
      
      // Log findings
      if (recommendations.length > 0) {
        this.log('info', `Found ${recommendations.length} opportunities`, { recommendations });
        
        // Create pending actions for high-confidence recommendations
        recommendations
          .filter(r => r.confidence === 'high' && r.action !== 'hold')
          .forEach(r => this.createPendingAction(r));
      }
      
      this.state.lastCheck = new Date();
      this.state.status = 'monitoring';
      this.notifyUpdate();
      
    } catch (error) {
      this.state.status = 'error';
      this.log('error', `Check failed: ${error}`);
      this.notifyUpdate();
    }
  }

  // Analyze yield opportunities
  private analyzeOpportunities(strategies: YieldStrategy[]): AgentAnalysis {
    const { minAPYThreshold, maxRiskLevel } = this.state.config;
    
    // Filter by risk level
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const maxRisk = riskLevels[maxRiskLevel];
    
    const filtered = strategies.filter(s => {
      const strategyRisk = riskLevels[s.risk] || 3;
      return s.apy >= minAPYThreshold && strategyRisk <= maxRisk;
    });
    
    // Sort by APY
    const sorted = filtered.sort((a, b) => b.apy - a.apy);
    
    return {
      timestamp: new Date(),
      topOpportunities: sorted.slice(0, 10),
      currentBestAPY: sorted[0]?.apy || 0,
      recommendations: [],
      riskAssessment: this.assessRisk(sorted),
    };
  }

  // Generate trading recommendations
  private generateRecommendations(analysis: AgentAnalysis): AgentRecommendation[] {
    const recommendations: AgentRecommendation[] = [];
    const { rebalanceThreshold, takeProfitPercent, stopLossPercent } = this.state.config;
    
    // Check current positions
    for (const position of this.state.currentPositions) {
      // Take profit check
      if (position.pnlPercent >= takeProfitPercent) {
        recommendations.push({
          action: 'withdraw',
          protocol: position.protocol,
          pool: position.pool,
          reason: `Take profit: ${position.pnlPercent.toFixed(1)}% gain reached`,
          expectedAPY: position.currentAPY,
          confidence: 'high',
        });
      }
      // Stop loss check
      else if (position.pnlPercent <= -stopLossPercent) {
        recommendations.push({
          action: 'withdraw',
          protocol: position.protocol,
          pool: position.pool,
          reason: `Stop loss: ${position.pnlPercent.toFixed(1)}% loss reached`,
          expectedAPY: position.currentAPY,
          confidence: 'high',
        });
      }
      // Rebalance check - if better opportunity exists
      else {
        const betterOpportunity = analysis.topOpportunities.find(
          o => o.apy > position.currentAPY + rebalanceThreshold
        );
        if (betterOpportunity) {
          recommendations.push({
            action: 'rebalance',
            protocol: betterOpportunity.protocol,
            pool: betterOpportunity.pool,
            reason: `Better APY available: ${betterOpportunity.apy.toFixed(1)}% vs current ${position.currentAPY.toFixed(1)}%`,
            expectedAPY: betterOpportunity.apy,
            confidence: 'medium',
          });
        }
      }
    }
    
    // If no positions, recommend best opportunity
    if (this.state.currentPositions.length === 0 && analysis.topOpportunities.length > 0) {
      const best = analysis.topOpportunities[0];
      recommendations.push({
        action: 'deposit',
        protocol: best.protocol,
        pool: best.pool,
        reason: `Best opportunity: ${best.apy.toFixed(1)}% APY on ${best.protocol}`,
        expectedAPY: best.apy,
        confidence: analysis.riskAssessment.overallRisk === 'low' ? 'high' : 'medium',
      });
    }
    
    return recommendations;
  }

  // Assess overall risk
  private assessRisk(strategies: YieldStrategy[]): RiskAssessment {
    const factors: RiskAssessment['factors'] = [];
    
    // Check if relying on high APY (often unsustainable)
    const avgAPY = strategies.reduce((sum, s) => sum + s.apy, 0) / (strategies.length || 1);
    if (avgAPY > 50) {
      factors.push({
        factor: 'High APY',
        level: 'high',
        description: 'Average APY above 50% - may be unsustainable',
      });
    } else if (avgAPY > 20) {
      factors.push({
        factor: 'Elevated APY',
        level: 'medium',
        description: 'Average APY above 20% - monitor for changes',
      });
    } else {
      factors.push({
        factor: 'Stable APY',
        level: 'low',
        description: 'APY in sustainable range',
      });
    }
    
    // Check protocol diversity
    const protocols = new Set(strategies.map(s => s.protocol));
    if (protocols.size < 2) {
      factors.push({
        factor: 'Protocol Concentration',
        level: 'high',
        description: 'Funds concentrated in single protocol',
      });
    } else if (protocols.size < 3) {
      factors.push({
        factor: 'Limited Diversification',
        level: 'medium',
        description: 'Consider adding more protocols',
      });
    } else {
      factors.push({
        factor: 'Good Diversification',
        level: 'low',
        description: 'Spread across multiple protocols',
      });
    }
    
    // Overall risk
    const highCount = factors.filter(f => f.level === 'high').length;
    const overallRisk = highCount >= 2 ? 'high' : highCount >= 1 ? 'medium' : 'low';
    
    return { overallRisk, factors };
  }

  // Create a pending action
  private createPendingAction(recommendation: AgentRecommendation) {
    const action: AgentAction = {
      id: `action-${Date.now()}`,
      type: recommendation.action as AgentAction['type'],
      protocol: recommendation.protocol,
      pool: recommendation.pool,
      amount: this.state.config.maxPositionSize,
      reason: recommendation.reason,
      status: 'pending',
      createdAt: new Date(),
    };
    
    this.state.pendingActions.push(action);
    this.log('action', `New action pending: ${action.type} on ${action.protocol}`, action);
  }

  // Approve a pending action
  approveAction(actionId: string) {
    const action = this.state.pendingActions.find(a => a.id === actionId);
    if (action) {
      action.status = 'approved';
      this.log('success', `Action approved: ${action.type} on ${action.protocol}`);
      this.notifyUpdate();
    }
  }

  // Reject a pending action
  rejectAction(actionId: string) {
    this.state.pendingActions = this.state.pendingActions.filter(a => a.id !== actionId);
    this.log('info', 'Action rejected');
    this.notifyUpdate();
  }

  // Add log entry
  private log(type: AgentLogEntry['type'], message: string, details?: any) {
    const entry: AgentLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date(),
      type,
      message,
      details,
    };
    
    this.state.activityLog.unshift(entry);
    
    // Keep only last 100 entries
    if (this.state.activityLog.length > 100) {
      this.state.activityLog = this.state.activityLog.slice(0, 100);
    }
  }

  // Notify subscribers of state update
  private notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate(this.getState());
    }
  }
}

// ============ AGENT MANAGER ============

class AgentManager {
  private agents: Map<string, YBOTAgent> = new Map();
  private onUpdate: ((agents: AgentState[]) => void) | null = null;

  // Initialize default agents
  init() {
    Object.values(DEFAULT_AGENT_CONFIGS).forEach(config => {
      this.createAgent(config);
    });
  }

  // Create a new agent
  createAgent(config: AgentConfig): YBOTAgent {
    const agent = new YBOTAgent(config);
    agent.subscribe(() => this.notifyUpdate());
    this.agents.set(config.id, agent);
    return agent;
  }

  // Get agent by ID
  getAgent(id: string): YBOTAgent | undefined {
    return this.agents.get(id);
  }

  // Get all agents
  getAllAgents(): AgentState[] {
    return Array.from(this.agents.values()).map(a => a.getState());
  }

  // Start all enabled agents
  startAll() {
    this.agents.forEach(agent => {
      if (agent.getState().config.enabled) {
        agent.start();
      }
    });
  }

  // Stop all agents
  stopAll() {
    this.agents.forEach(agent => agent.stop());
  }

  // Subscribe to updates
  subscribe(callback: (agents: AgentState[]) => void) {
    this.onUpdate = callback;
  }

  private notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate(this.getAllAgents());
    }
  }
}

// Export singleton
export const agentManager = new AgentManager();

// Initialize on import
agentManager.init();
