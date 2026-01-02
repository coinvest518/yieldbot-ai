/**
 * AI Agent Service - Multi-Provider AI
 * Elite DeFi trading intelligence for yBOT.FINANCE
 * 
 * Features:
 * - Multi-provider AI (Mistral, HuggingFace, MuleRouter)
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

// ============ MULTI-PROVIDER AI SERVICE WITH ALL CAPABILITIES ============

class MultiProviderAI {
  private mistralKey: string;
  private hfToken: string;
  private hyperBrowserKey: string;
  private conversationMemory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.mistralKey = import.meta.env.VITE_MISTRAL_API_KEY || '';
    this.hfToken = import.meta.env.VITE_HF_TOKEN || '';
    this.hyperBrowserKey = import.meta.env.VITE_HYPERBROWSER_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!(this.mistralKey || this.hfToken);
  }

  // ============ CHAT COMPLETIONS ============

  // Mistral AI (Primary - Fast & Accurate)
  async generateContentMistral(prompt: string, systemPrompt?: string): Promise<string> {
    const url = 'https://api.mistral.ai/v1/chat/completions';
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.mistralKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }

  // HuggingFace (Backup - Multiple Models)
  async generateContentHF(prompt: string, systemPrompt?: string): Promise<string> {
    const url = 'https://router.huggingface.co/v1/chat/completions';
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.hfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemma-2-2b-it',
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HuggingFace error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }

  // Smart fallback: Try all providers
  async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('No AI provider configured');
    }

    const providers = [
      { name: 'Mistral', fn: () => this.generateContentMistral(prompt, systemPrompt), enabled: !!this.mistralKey },
      { name: 'HuggingFace', fn: () => this.generateContentHF(prompt, systemPrompt), enabled: !!this.hfToken }
    ];

    for (const provider of providers) {
      if (!provider.enabled) continue;
      
      try {
        console.log(`🤖 Using ${provider.name}...`);
        return await provider.fn();
      } catch (error: any) {
        console.warn(`⚠️ ${provider.name} failed:`, error.message);
      }
    }

    throw new Error('All AI providers failed');
  }

  // ============ EMBEDDINGS (Mistral) ============

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.mistralKey) {
      throw new Error('Mistral API key required for embeddings');
    }

    const url = 'https://api.mistral.ai/v1/embeddings';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.mistralKey}`
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: texts
      })
    });

    if (!response.ok) {
      throw new Error(`Embeddings error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  // ============ CODE EMBEDDINGS (HuggingFace) ============

  async generateCodeEmbeddings(code: string[]): Promise<number[][]> {
    if (!this.hfToken) {
      throw new Error('HuggingFace token required for code embeddings');
    }

    const url = 'https://api-inference.huggingface.co/models/microsoft/codebert-base';
    
    const embeddings = [];
    for (const snippet of code) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: snippet })
      });

      if (response.ok) {
        const data = await response.json();
        embeddings.push(data);
      }
    }
    
    return embeddings;
  }

  // ============ WEB SCRAPING (Hyperbrowser) ============

  async scrapeWebPage(url: string): Promise<{ title: string; content: string; links: string[] }> {
    if (!this.hyperBrowserKey) {
      throw new Error('Hyperbrowser API key required for web scraping');
    }

    const apiUrl = 'https://api.hyperbrowser.ai/api/session';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.hyperBrowserKey
      },
      body: JSON.stringify({
        useStealth: true
      })
    });

    if (!response.ok) {
      throw new Error(`Hyperbrowser error: ${response.status}`);
    }

    const data = await response.json();
    return {
      title: data.title || '',
      content: data.content || '',
      links: data.links || []
    };
  }

  // ============ LIVE DATA ENRICHMENT ============

  async enrichWithLiveData(query: string): Promise<string> {
    // Use Hyperbrowser to fetch live DeFi data
    if (!this.hyperBrowserKey) {
      return query; // Return original if no scraping available
    }

    try {
      // Scrape live BSC data
      const bscData = await this.scrapeWebPage('https://bscscan.com/');
      const defiData = await this.scrapeWebPage('https://defillama.com/chain/BSC');
      
      return `${query}\n\nLive Market Data:\n- BSC Network: ${bscData.title}\n- DeFi TVL: ${defiData.content.slice(0, 200)}...`;
    } catch (error) {
      console.warn('Live data enrichment failed:', error);
      return query;
    }
  }

  // ============ SEMANTIC SEARCH ============

  cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async semanticSearch(query: string, documents: string[], topK: number = 3): Promise<Array<{text: string; score: number; index: number}>> {
    const allTexts = [query, ...documents];
    const embeddings = await this.generateEmbeddings(allTexts);
    
    const queryEmbedding = embeddings[0];
    const docEmbeddings = embeddings.slice(1);
    
    const results = documents.map((text, index) => ({
      text,
      score: this.cosineSimilarity(queryEmbedding, docEmbeddings[index]),
      index
    }));
    
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // ============ CODE SEARCH ============

  async codeSearch(query: string, codeSnippets: string[], topK: number = 3): Promise<Array<{code: string; score: number; index: number}>> {
    try {
      const queryEmbed = await this.generateCodeEmbeddings([query]);
      const codeEmbeds = await this.generateCodeEmbeddings(codeSnippets);
      
      const results = codeSnippets.map((code, index) => ({
        code,
        score: this.cosineSimilarity(queryEmbed[0], codeEmbeds[index]),
        index
      }));
      
      return results.sort((a, b) => b.score - a.score).slice(0, topK);
    } catch (error) {
      console.warn('Code search failed, using text search fallback');
      // Fallback to text embeddings
      return await this.semanticSearch(query, codeSnippets, topK) as any;
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
    } catch (error: any) {
      console.error('Chat error:', error);
      
      // User-friendly error messages
      if (error.message?.includes('quota exceeded')) {
        return { 
          response: "🚨 **API Quota Exceeded**\n\nMy AI brain ran out of free credits. To fix:\n\n1. Get a new API key from Mistral, HuggingFace, or MuleRouter\n2. Update your API keys in `.env.local`\n3. Restart the dev server\n\nOr wait 24 hours for quota reset." 
        };
      }
      
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
  private ai: MultiProviderAI;
  private chatHistory: ChatMessage[] = [];
  private lastDecisions: AIDecision[] = [];
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private onUpdate: ((agent: YBOTAIAgent) => void) | null = null;
  private cachedYieldData: PoolData[] = [];
  private lastYieldFetch: number = 0;
  private pendingAction: AIDecision | null = null;

  constructor(config: AIAgentConfig) {
    this.config = config;
    this.ai = new MultiProviderAI();
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

  // ============ EXECUTION ENGINE ============
  
  /**
   * Execute a stake transaction
   * User-triggered: AI suggests, user confirms, this executes
   */
  async executeStake(amount: string, tierIndex: number = 0): Promise<string> {
    try {
      const { stakeYBOT, LOCK_TIERS } = await import('./stakingService');
      
      // Map tier index to lock duration
      const lockDurations = [LOCK_TIERS.FLEXIBLE, LOCK_TIERS.DAYS_7, LOCK_TIERS.DAYS_30, LOCK_TIERS.DAYS_90];
      const lockDuration = lockDurations[tierIndex] || LOCK_TIERS.FLEXIBLE;
      
      // Execute stake via staking service
      const txHash = await stakeYBOT(amount, lockDuration);
      
      // Log successful trade
      console.log(`✅ Staked ${amount} YBOT in tier ${tierIndex}`);
      
      // Clear pending action
      this.clearPendingAction();
      
      return txHash;
    } catch (error) {
      console.error('Stake execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute a vault deposit
   * User-triggered: AI suggests, user confirms, this executes
   */
  async executeVaultDeposit(amount: string): Promise<string> {
    try {
      const { investInVault } = await import('./web3Service');
      
      // Execute deposit via web3 service
      const txHash = await investInVault(amount);
      
      console.log(`✅ Deposited ${amount} USDT to vault`);
      
      this.clearPendingAction();
      
      return txHash;
    } catch (error) {
      console.error('Vault deposit failed:', error);
      throw error;
    }
  }

  /**
   * Execute any pending action
   * This is the main execution entry point
   */
  async executePendingAction(): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.pendingAction) {
      return { success: false, error: 'No pending action' };
    }

    try {
      let txHash: string;

      switch (this.pendingAction.action) {
        case 'stake':
          if (!this.pendingAction.amount) {
            throw new Error('Amount required for staking');
          }
          txHash = await this.executeStake(this.pendingAction.amount.toString());
          break;

        case 'deposit':
          if (!this.pendingAction.amount) {
            throw new Error('Amount required for deposit');
          }
          txHash = await this.executeVaultDeposit(this.pendingAction.amount.toString());
          break;

        default:
          throw new Error(`Action ${this.pendingAction.action} not yet implemented`);
      }

      return { success: true, txHash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
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
      this.lastDecisions = await this.ai.analyzeYieldOpportunities(
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
      const { response, pendingAction } = await this.ai.chat(
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

  // Initialize with default agents
  init() {
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
    const agent = new YBOTAIAgent(config);
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

// Export function to initialize AI agents
export function initializeAIAgents() {
  aiAgentManager.init();
  console.log('✅ AI Agents initialized with Mistral + HuggingFace');
}
