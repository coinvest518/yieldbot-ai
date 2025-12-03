/**
 * AI Agent Service - Powered by Google Gemini
 * Elite DeFi trading intelligence for yBOT.FINANCE
 * 
 * Features:
 * - ElizaOS-style personality system
 * - Wallet-aware context
 * - Trade execution capabilities
 * - Real-time yield data integration
 */

import { fetchAllYieldStrategies, PoolData } from './protocolDataService';
import { YBOT_CHARACTER, generateSystemPrompt, formatMessageHistory } from './ybotCharacter';
import { getStakingStats, getUserStakingData, type StakingStats, type UserStakingData } from './stakingService';

// ============ TYPES ============

export interface AIAgentConfig {
  name: string;
  personality: string;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  maxPositionUSD: number;
  autoExecute: boolean; // If true, executes without asking
}

export interface AIDecision {
  action: 'deposit' | 'withdraw' | 'rebalance' | 'hold' | 'alert' | 'swap' | 'stake';
  protocol: string;
  pool: string;
  amount?: number;
  token?: string;
  reason: string;
  confidence: number; // 0-100
  urgency: 'low' | 'medium' | 'high';
  aiAnalysis: string;
  transactionData?: {
    to: string;
    data: string;
    value: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  pendingAction?: AIDecision; // For trade execution
}

export interface PortfolioState {
  totalValueUSD: number;
  positions: {
    protocol: string;
    pool: string;
    valueUSD: number;
    apy: number;
    pnlPercent: number;
  }[];
  availableBalance: number;
}

export interface WalletState {
  address: string;
  balance: string; // BNB
  ybotBalance: string;
  chainId: number;
  isConnected: boolean;
}

// Trade intent parsed from user message
export interface TradeIntent {
  action: 'deposit' | 'withdraw' | 'swap' | 'stake';
  amount?: number;
  token?: string;
  protocol?: string;
  pool?: string;
}

// ============ GEMINI AI SERVICE ============

class GeminiAI {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model = YBOT_CHARACTER.settings.model;
  private conversationMemory: Map<string, ChatMessage[]> = new Map(); // Memory per user

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Check if API is configured
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('API key not configured');
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const contents = [];
    
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System Instructions: ${systemPrompt}` }]
      });
      contents.push({
        role: 'model', 
        parts: [{ text: 'I understand. I am YBOT, the elite DeFi trading AI for yBOT.FINANCE. I will follow these instructions precisely.' }]
      });
    }
    
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: YBOT_CHARACTER.settings.temperature,
            maxOutputTokens: YBOT_CHARACTER.settings.maxTokens,
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error:', error);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
    } catch (error) {
      console.error('Error calling Gemini:', error);
      throw error;
    }
  }

  // Parse trade intent from user message
  parseTradeIntent(message: string): TradeIntent | null {
    const lower = message.toLowerCase();
    
    // STAKE patterns - check first since it's specific
    const stakeMatch = lower.match(/(?:stake|staking)\s+(\d+(?:\.\d+)?)\s*(?:ybot)?(?:\s+(?:tokens?|for|in|into))?/i);
    if (stakeMatch) {
      return {
        action: 'stake',
        amount: parseFloat(stakeMatch[1]),
        token: 'YBOT',
        protocol: 'YBOT Staking'
      };
    }
    
    // Also check for "stake my YBOT" or "stake YBOT tokens"
    const stakeMatch2 = lower.match(/stake\s+(?:my\s+)?(?:all\s+)?(\d+(?:\.\d+)?)\s*ybot/i);
    if (stakeMatch2) {
      return {
        action: 'stake',
        amount: parseFloat(stakeMatch2[1]),
        token: 'YBOT',
        protocol: 'YBOT Staking'
      };
    }
    
    // Deposit patterns
    const depositMatch = lower.match(/(?:deposit|supply|add|put)\s+(\d+(?:\.\d+)?)\s*(\w+)?(?:\s+(?:to|into|in)\s+(\w+))?/i);
    if (depositMatch) {
      return {
        action: 'deposit',
        amount: parseFloat(depositMatch[1]),
        token: depositMatch[2]?.toUpperCase(),
        protocol: depositMatch[3]
      };
    }
    
    // Withdraw patterns
    const withdrawMatch = lower.match(/(?:withdraw|remove|take out|pull)\s+(\d+(?:\.\d+)?)\s*(\w+)?(?:\s+from\s+(\w+))?/i);
    if (withdrawMatch) {
      return {
        action: 'withdraw',
        amount: parseFloat(withdrawMatch[1]),
        token: withdrawMatch[2]?.toUpperCase(),
        protocol: withdrawMatch[3]
      };
    }
    
    // Swap patterns
    const swapMatch = lower.match(/(?:swap|exchange|convert|trade)\s+(\d+(?:\.\d+)?)\s*(\w+)\s+(?:to|for|into)\s+(\w+)/i);
    if (swapMatch) {
      return {
        action: 'swap',
        amount: parseFloat(swapMatch[1]),
        token: swapMatch[2]?.toUpperCase(),
        pool: swapMatch[3]?.toUpperCase() // target token
      };
    }
    
    // Quick action patterns
    if (/(?:do it|execute|confirm|proceed|yes|let'?s go)/i.test(lower)) {
      return { action: 'deposit' }; // Will use pending action
    }
    
    return null;
  }

  async analyzeYieldOpportunities(
    strategies: PoolData[],
    portfolio: PortfolioState,
    riskTolerance: string,
    wallet?: WalletState
  ): Promise<AIDecision[]> {
    const prompt = `## YIELD ANALYSIS REQUEST

**Risk Profile:** ${riskTolerance}
**Available Capital:** $${portfolio.availableBalance.toFixed(2)}
${wallet?.isConnected ? `**Wallet:** ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : '**Wallet:** Not connected'}

**Current Positions:**
${portfolio.positions.length > 0 
  ? portfolio.positions.map(p => `• ${p.protocol} ${p.pool}: $${p.valueUSD.toFixed(2)} @ ${p.apy.toFixed(1)}% APY`).join('\n')
  : '• No active positions - fresh capital!'}

**Top ${strategies.length} Yield Opportunities (sorted by APY):**
${strategies.slice(0, 15).map((s, i) => 
  `${i+1}. **${s.protocol}** - ${s.name}: ${s.apy.toFixed(2)}% APY | TVL: ${s.tvl} | Risk: ${s.riskLevel}`
).join('\n')}

## YOUR TASK
Analyze these opportunities and provide 1-3 SPECIFIC, ACTIONABLE recommendations.
Be bold and confident. Give exact amounts to allocate.

Respond ONLY in this JSON format:
{
  "decisions": [
    {
      "action": "deposit",
      "protocol": "Venus Protocol",
      "pool": "USDT Supply",
      "amount": 500,
      "token": "USDT",
      "reason": "5.8% APY with minimal risk - ideal for base yield",
      "confidence": 92,
      "urgency": "medium"
    }
  ],
  "analysis": "Bullish on stablecoin yields this week. Venus USDT spiked to 5.8% - deploy 60% there. PancakeSwap CAKE-BNB at 24% is solid for remaining 40%."
}`;

    const systemPrompt = `You are YBOT, the elite DeFi AI for yBOT.FINANCE.
${YBOT_CHARACTER.bio.slice(0, 3).join(' ')}

CRITICAL INSTRUCTIONS:
- Be SPECIFIC: Name exact protocols and pools
- Be CONFIDENT: Give definitive recommendations, not suggestions
- Be ACTIONABLE: Include exact dollar amounts
- Risk Guide:
  • Conservative: Stables only, 5-15% APY, Venus/Beefy
  • Moderate: Mix of stables + major pairs, 15-30% APY
  • Aggressive: High APY farms OK, IL acceptable

OUTPUT: Valid JSON only. No markdown code blocks.`;

    try {
      const response = await this.generateContent(prompt, systemPrompt);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', response);
        return this.getFallbackDecisions(portfolio, riskTolerance);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.decisions.map((d: any) => ({
        ...d,
        aiAnalysis: parsed.analysis
      }));
    } catch (error) {
      console.error('Error analyzing yields:', error);
      return this.getFallbackDecisions(portfolio, riskTolerance);
    }
  }

  // Fallback decisions when AI fails
  private getFallbackDecisions(portfolio: PortfolioState, riskTolerance: string): AIDecision[] {
    const available = portfolio.availableBalance;
    
    if (riskTolerance === 'conservative') {
      return [{
        action: 'deposit',
        protocol: 'Venus Protocol',
        pool: 'USDT Supply',
        amount: available * 0.8,
        token: 'USDT',
        reason: 'Safe stablecoin yield at 5-6% APY',
        confidence: 85,
        urgency: 'low',
        aiAnalysis: 'Conservative allocation to battle-tested lending protocol.'
      }];
    }
    
    return [{
      action: 'deposit',
      protocol: 'Venus Protocol',
      pool: 'USDT Supply',
      amount: available * 0.5,
      token: 'USDT',
      reason: 'Base yield position at 5-6% APY',
      confidence: 80,
      urgency: 'low',
      aiAnalysis: 'Split between safe lending and LP opportunities.'
    }, {
      action: 'deposit',
      protocol: 'PancakeSwap',
      pool: 'CAKE-BNB LP',
      amount: available * 0.5,
      token: 'BNB',
      reason: 'Higher yield with moderate IL risk at 20-25% APY',
      confidence: 75,
      urgency: 'medium',
      aiAnalysis: 'Balanced approach with yield diversification.'
    }];
  }

  async chat(
    message: string,
    history: ChatMessage[],
    portfolio: PortfolioState,
    wallet?: WalletState,
    liveYieldData?: PoolData[],
    stakingData?: {
      stats: StakingStats | null;
      userData: UserStakingData | null;
    }
  ): Promise<{ response: string; pendingAction?: AIDecision }> {
    // Check for trade intent
    const tradeIntent = this.parseTradeIntent(message);
    
    // Build staking context for system prompt
    const stakingContext = stakingData?.stats ? {
      totalStaked: stakingData.stats.totalStaked,
      rewardPool: stakingData.stats.rewardPool,
      userStaked: stakingData.userData?.totalStaked || '0',
      pendingRewards: stakingData.userData?.totalPendingRewards || '0',
      tiers: [
        { name: 'Flexible', apy: stakingData.stats.flexibleAPY, lockDays: 0 },
        { name: '7 Days', apy: stakingData.stats.days7APY, lockDays: 7 },
        { name: '30 Days', apy: stakingData.stats.days30APY, lockDays: 30 },
        { name: '90 Days', apy: stakingData.stats.days90APY, lockDays: 90 },
      ]
    } : undefined;
    
    // Build context-aware system prompt using character
    const systemPrompt = generateSystemPrompt(
      wallet?.isConnected ? {
        address: wallet.address,
        balance: wallet.balance,
        ybotBalance: wallet.ybotBalance,
        chainId: wallet.chainId
      } : undefined,
      portfolio,
      stakingContext
    );

    // Add live yield data context if available
    let yieldContext = '';
    if (liveYieldData && liveYieldData.length > 0) {
      yieldContext = `

## LIVE YIELD DATA (Real-time from BSC)
${liveYieldData.slice(0, 10).map(y => 
  `• ${y.protocol} ${y.name}: ${y.apy.toFixed(2)}% APY (${y.riskLevel} risk)`
).join('\n')}
`;
    }

    const conversationHistory = formatMessageHistory(
      history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    );

    // Construct the full prompt
    const prompt = `${conversationHistory ? `## Recent Conversation\n${conversationHistory}\n\n` : ''}${yieldContext}

## User's Message
${message}

${tradeIntent ? `
## DETECTED TRADE INTENT
Action: ${tradeIntent.action}
Amount: ${tradeIntent.amount || 'Not specified'}
Token: ${tradeIntent.token || 'Not specified'}
Protocol: ${tradeIntent.protocol || 'Not specified'}

If the user wants to execute a trade, prepare the transaction details and ask for confirmation.
` : ''}

Respond as YBOT - be specific, confident, and actionable. Reference actual numbers from the live data.`;

    try {
      const response = await this.generateContent(prompt, systemPrompt);
      
      // Check if response contains a pending action
      let pendingAction: AIDecision | undefined;
      if (tradeIntent && tradeIntent.amount) {
        // Special handling for staking
        if (tradeIntent.action === 'stake') {
          pendingAction = {
            action: 'stake',
            protocol: 'YBOT Staking',
            pool: 'Flexible Pool',
            amount: tradeIntent.amount,
            token: 'YBOT',
            reason: 'User requested to stake YBOT tokens',
            confidence: 95,
            urgency: 'medium',
            aiAnalysis: 'User-initiated YBOT staking'
          };
        } else {
          pendingAction = {
            action: tradeIntent.action as AIDecision['action'],
            protocol: tradeIntent.protocol || 'Venus Protocol',
            pool: tradeIntent.pool || `${tradeIntent.token} Supply`,
            amount: tradeIntent.amount,
            token: tradeIntent.token,
            reason: 'User requested trade',
            confidence: 95,
            urgency: 'medium',
            aiAnalysis: 'User-initiated transaction'
          };
        }
      }
      
      return { response, pendingAction };
    } catch (error) {
      console.error('Chat error:', error);
      return { 
        response: "⚠️ I hit a snag connecting to my brain. Give me a sec and try again?" 
      };
    }
  }

  // Get memory for a specific user/session
  getMemory(sessionId: string): ChatMessage[] {
    return this.conversationMemory.get(sessionId) || [];
  }

  // Save memory for a session
  saveMemory(sessionId: string, messages: ChatMessage[]) {
    // Keep last 50 messages per session
    this.conversationMemory.set(sessionId, messages.slice(-50));
  }
}

// ============ AI AGENT CLASS ============

export class YBOTAIAgent {
  private config: AIAgentConfig;
  private gemini: GeminiAI;
  private chatHistory: ChatMessage[] = [];
  private lastDecisions: AIDecision[] = [];
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private onUpdate: ((agent: YBOTAIAgent) => void) | null = null;
  private cachedYieldData: PoolData[] = [];
  private lastYieldFetch: number = 0;
  private pendingAction: AIDecision | null = null;

  constructor(config: AIAgentConfig, apiKey: string) {
    this.config = config;
    this.gemini = new GeminiAI(apiKey);
  }

  // Get agent status
  getStatus() {
    return {
      name: this.config.name,
      isRunning: this.isRunning,
      lastDecisions: this.lastDecisions,
      chatHistory: this.chatHistory.slice(-20),
      config: this.config,
      pendingAction: this.pendingAction,
      character: YBOT_CHARACTER // Expose character for UI
    };
  }

  // Get pending action for execution
  getPendingAction(): AIDecision | null {
    return this.pendingAction;
  }

  // Clear pending action
  clearPendingAction() {
    this.pendingAction = null;
  }

  // Confirm and mark action as ready to execute
  confirmAction(): AIDecision | null {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  }

  // Subscribe to updates
  subscribe(callback: (agent: YBOTAIAgent) => void) {
    this.onUpdate = callback;
  }

  // Fetch and cache yield data (5 min cache)
  private async getYieldData(): Promise<PoolData[]> {
    const now = Date.now();
    if (now - this.lastYieldFetch > 5 * 60 * 1000 || this.cachedYieldData.length === 0) {
      try {
        const data = await fetchAllYieldStrategies();
        this.cachedYieldData = [
          ...data.strategy1_safeLending,
          ...data.strategy2_stablecoinLP,
          ...data.strategy3_volatileLP
        ].sort((a, b) => b.apy - a.apy);
        this.lastYieldFetch = now;
      } catch (error) {
        console.error('Failed to fetch yield data:', error);
      }
    }
    return this.cachedYieldData;
  }

  // Start autonomous monitoring
  start(intervalMinutes: number = 5) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`🤖 ${this.config.name} started monitoring...`);
    
    // Run immediately
    this.runAnalysis();
    
    // Then on interval
    this.checkInterval = setInterval(
      () => this.runAnalysis(),
      intervalMinutes * 60 * 1000
    );

    this.notifyUpdate();
  }

  // Stop monitoring
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log(`🤖 ${this.config.name} stopped`);
    this.notifyUpdate();
  }

  // Run AI analysis
  async runAnalysis(portfolio?: PortfolioState, wallet?: WalletState) {
    try {
      // Fetch yield data
      const allStrategies = await this.getYieldData();

      // Default portfolio if not provided
      const currentPortfolio = portfolio || {
        totalValueUSD: 0,
        positions: [],
        availableBalance: 1000 // Default for demo
      };

      // Get AI decisions with wallet context
      this.lastDecisions = await this.gemini.analyzeYieldOpportunities(
        allStrategies,
        currentPortfolio,
        this.config.riskTolerance,
        wallet
      );

      console.log(`🤖 ${this.config.name} found ${this.lastDecisions.length} recommendations`);
      this.notifyUpdate();

      return this.lastDecisions;
    } catch (error) {
      console.error('Analysis error:', error);
      return [];
    }
  }

  // Chat with the agent - wallet-aware
  async chat(message: string, portfolio?: PortfolioState, wallet?: WalletState): Promise<string> {
    // Add user message to history
    this.chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    const currentPortfolio = portfolio || {
      totalValueUSD: 0,
      positions: [],
      availableBalance: 0
    };

    try {
      // Get live yield data for context
      const yieldData = await this.getYieldData();
      
      // Fetch staking data for context
      let stakingData: { stats: StakingStats | null; userData: UserStakingData | null } = {
        stats: null,
        userData: null
      };
      
      try {
        stakingData.stats = await getStakingStats();
        if (wallet?.isConnected && wallet.address) {
          stakingData.userData = await getUserStakingData(wallet.address);
        }
      } catch (e) {
        console.log('Could not fetch staking data:', e);
      }
      
      // Call AI with full context including staking
      const { response, pendingAction } = await this.gemini.chat(
        message, 
        this.chatHistory, 
        currentPortfolio,
        wallet,
        yieldData,
        stakingData
      );
      
      // Store pending action if detected
      if (pendingAction) {
        this.pendingAction = pendingAction;
      }
      
      // Add assistant response to history
      this.chatHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        pendingAction
      });

      this.notifyUpdate();
      return response;
    } catch (error) {
      const errorMsg = "⚠️ Hit a snag there. Mind trying again?";
      this.chatHistory.push({
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date()
      });
      return errorMsg;
    }
  }

  // Update config
  updateConfig(newConfig: Partial<AIAgentConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.notifyUpdate();
  }

  private notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate(this);
    }
  }
}

// ============ AI AGENT MANAGER ============

class AIAgentManager {
  private agents: Map<string, YBOTAIAgent> = new Map();
  private apiKey: string = '';

  // Initialize with API key
  init(apiKey: string) {
    this.apiKey = apiKey;
    
    // Create default agents
    this.createAgent({
      name: 'YBOT Yield Hunter',
      personality: 'Aggressive yield optimizer focused on finding the best APY opportunities',
      riskTolerance: 'moderate',
      maxPositionUSD: 1000,
      autoExecute: false
    });

    this.createAgent({
      name: 'YBOT Guardian',
      personality: 'Conservative risk monitor focused on protecting capital',
      riskTolerance: 'conservative', 
      maxPositionUSD: 500,
      autoExecute: false
    });
  }

  // Create new agent
  createAgent(config: AIAgentConfig): YBOTAIAgent {
    const agent = new YBOTAIAgent(config, this.apiKey);
    this.agents.set(config.name, agent);
    return agent;
  }

  // Get agent by name
  getAgent(name: string): YBOTAIAgent | undefined {
    return this.agents.get(name);
  }

  // Get all agents
  getAllAgents(): YBOTAIAgent[] {
    return Array.from(this.agents.values());
  }

  // Start all agents
  startAll() {
    this.agents.forEach(agent => agent.start());
  }

  // Stop all agents
  stopAll() {
    this.agents.forEach(agent => agent.stop());
  }
}

// Export singleton
export const aiAgentManager = new AIAgentManager();

// Export function to initialize with API key
export function initializeAIAgents(apiKey?: string) {
  // Check for ElizaOS standard naming first, then Vite naming
  const key = apiKey || 
    import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || 
    import.meta.env.VITE_GEMINI_API_KEY || 
    '';
  if (!key) {
    console.warn('⚠️ No Google AI API key found. AI features will be limited.');
    console.warn('Set VITE_GOOGLE_GENERATIVE_AI_API_KEY in .env.local');
    return;
  }
  aiAgentManager.init(key);
  console.log('✅ AI Agents initialized with Google Gemini');
}
