/**
 * AI Service - Powers the YBOT Trading Agents
 * Uses Mistral AI and HuggingFace for intelligent decision making
 */

// ============ TYPES ============

export interface AIAnalysisRequest {
  currentPositions: {
    protocol: string;
    pool: string;
    amount: number;
    entryAPY: number;
    currentAPY: number;
    pnlPercent: number;
  }[];
  availableOpportunities: {
    protocol: string;
    pool: string;
    apy: number;
    tvl: string;
    risk: 'low' | 'medium' | 'high';
  }[];
  userSettings: {
    riskTolerance: 'low' | 'medium' | 'high';
    takeProfitPercent: number;
    stopLossPercent: number;
    maxPositionSize: number;
  };
  walletBalance: number;
}

export interface AIRecommendation {
  action: 'deposit' | 'withdraw' | 'rebalance' | 'hold';
  protocol: string;
  pool: string;
  amount?: number;
  reason: string;
  confidence: number; // 0-100
  urgency: 'low' | 'medium' | 'high';
  risks: string[];
}

export interface AIAnalysisResponse {
  summary: string;
  recommendations: AIRecommendation[];
  marketSentiment: 'bullish' | 'neutral' | 'bearish';
  riskAssessment: {
    overall: 'low' | 'medium' | 'high';
    factors: string[];
  };
  timestamp: Date;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ============ MULTI-PROVIDER AI API ============

class AIService {
  private mistralKey: string;
  private hfToken: string;
  private chatHistory: ChatMessage[] = [];
  private systemPrompt: string;

  constructor() {
    this.mistralKey = import.meta.env.VITE_MISTRAL_API_KEY || '';
    this.hfToken = import.meta.env.VITE_HF_TOKEN || '';
    
    this.systemPrompt = `You are YBOT, an expert DeFi trading AI assistant specialized in BSC (BNB Chain) yield farming and automated trading strategies.

Your capabilities:
- Analyze yield farming opportunities on Venus Protocol, PancakeSwap, and Beefy Finance
- Recommend optimal entry/exit points based on APY changes
- Monitor risk levels and suggest portfolio rebalancing
- Execute take-profit and stop-loss strategies
- Provide real-time market insights

Your personality:
- Professional but friendly
- Data-driven and analytical
- Clear and concise in explanations
- Always considers risk management
- Explains complex DeFi concepts simply

Important rules:
- Never recommend investing more than user can afford to lose
- Always mention risks alongside opportunities
- Be transparent about uncertainty
- Prioritize capital preservation over maximum gains
- Consider gas costs in recommendations

When analyzing opportunities, always structure your response as JSON when asked for recommendations.`;
  }

  setApiKey(key: string, provider: 'mistral' | 'hf' = 'mistral') {
    if (provider === 'mistral') this.mistralKey = key;
    else if (provider === 'hf') this.hfToken = key;
  }

  isConfigured(): boolean {
    return !!(this.mistralKey || this.hfToken);
  }

  async analyzeMarket(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!this.isConfigured()) {
      return this.getMockAnalysis(request);
    }

    const prompt = `
Analyze the following DeFi positions and market opportunities. Provide actionable recommendations.

## Current Positions:
${JSON.stringify(request.currentPositions, null, 2)}

## Available Opportunities:
${JSON.stringify(request.availableOpportunities.slice(0, 10), null, 2)}

## User Settings:
- Risk Tolerance: ${request.userSettings.riskTolerance}
- Take Profit: ${request.userSettings.takeProfitPercent}%
- Stop Loss: ${request.userSettings.stopLossPercent}%
- Max Position: $${request.userSettings.maxPositionSize}
- Wallet Balance: $${request.walletBalance}

## Instructions:
Provide your analysis as JSON with this structure:
{
  "summary": "Brief market summary",
  "recommendations": [
    {
      "action": "deposit|withdraw|rebalance|hold",
      "protocol": "protocol name",
      "pool": "pool name",
      "amount": number or null,
      "reason": "explanation",
      "confidence": 0-100,
      "urgency": "low|medium|high",
      "risks": ["risk1", "risk2"]
    }
  ],
  "marketSentiment": "bullish|neutral|bearish",
  "riskAssessment": {
    "overall": "low|medium|high",
    "factors": ["factor1", "factor2"]
  }
}
`;

    try {
      const response = await this.callAI(prompt);
      const parsed = this.parseAnalysisResponse(response);
      return parsed;
    } catch (error) {
      console.error('AI Analysis failed:', error);
      return this.getMockAnalysis(request);
    }
  }

  async chat(userMessage: string, context?: Partial<AIAnalysisRequest>): Promise<string> {
    this.chatHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    if (!this.isConfigured()) {
      const mockResponse = this.getMockChatResponse(userMessage);
      this.chatHistory.push({
        role: 'assistant',
        content: mockResponse,
        timestamp: new Date(),
      });
      return mockResponse;
    }

    const conversationHistory = this.chatHistory.slice(-10).map(msg => 
      `${msg.role === 'user' ? 'User' : 'YBOT'}: ${msg.content}`
    ).join('\n');

    const contextStr = context ? `
Current Market Context:
- Positions: ${context.currentPositions?.length || 0}
- Best APY Available: ${context.availableOpportunities?.[0]?.apy?.toFixed(1) || 'N/A'}%
- Wallet Balance: $${context.walletBalance || 0}
` : '';

    const prompt = `${this.systemPrompt}

${contextStr}

Conversation History:
${conversationHistory}

Respond naturally to the user's latest message. Be helpful and informative.`;

    try {
      const response = await this.callAI(prompt);
      
      this.chatHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      console.error('Chat failed:', error);
      const fallback = "I'm having trouble connecting to my AI backend. Please check your API key configuration.";
      this.chatHistory.push({
        role: 'assistant',
        content: fallback,
        timestamp: new Date(),
      });
      return fallback;
    }
  }

  async getQuickInsight(opportunities: AIAnalysisRequest['availableOpportunities']): Promise<string> {
    if (!this.isConfigured()) {
      const best = opportunities[0];
      return `Top opportunity: ${best?.protocol} ${best?.pool} at ${best?.apy?.toFixed(1)}% APY (${best?.risk} risk)`;
    }

    const prompt = `
You are YBOT. Give a ONE SENTENCE insight about these BSC DeFi opportunities:
${JSON.stringify(opportunities.slice(0, 5), null, 2)}

Focus on the best opportunity and any notable risks. Keep it under 100 words.
`;

    try {
      return await this.callAI(prompt);
    } catch {
      const best = opportunities[0];
      return `Top opportunity: ${best?.protocol} ${best?.pool} at ${best?.apy?.toFixed(1)}% APY`;
    }
  }

  private async callAI(prompt: string): Promise<string> {
    // Try Mistral first
    if (this.mistralKey) {
      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.mistralKey}`
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048
          })
        });
        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content || 'No response';
        }
      } catch (e) {
        console.warn('Mistral failed, trying fallback');
      }
    }

    // Try HuggingFace
    if (this.hfToken) {
      try {
        const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.hfToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemma-2-2b-it',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.7
          })
        });
        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content || 'No response';
        }
      } catch (e) {
        console.warn('HuggingFace failed');
      }
    }

    throw new Error('All AI providers failed');
  }

  private parseAnalysisResponse(text: string): AIAnalysisResponse {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          timestamp: new Date(),
        };
      }
    } catch (e) {
      console.warn('Failed to parse AI response as JSON:', e);
    }

    return {
      summary: text.slice(0, 200),
      recommendations: [],
      marketSentiment: 'neutral',
      riskAssessment: {
        overall: 'medium',
        factors: ['Unable to fully parse AI response'],
      },
      timestamp: new Date(),
    };
  }

  private getMockAnalysis(request: AIAnalysisRequest): AIAnalysisResponse {
    const bestOpp = request.availableOpportunities[0];
    
    return {
      summary: `Found ${request.availableOpportunities.length} yield opportunities. Top APY: ${bestOpp?.apy?.toFixed(1)}% on ${bestOpp?.protocol}.`,
      recommendations: bestOpp ? [{
        action: 'deposit',
        protocol: bestOpp.protocol,
        pool: bestOpp.pool,
        amount: Math.min(request.walletBalance * 0.2, request.userSettings.maxPositionSize),
        reason: `${bestOpp.protocol} offers ${bestOpp.apy.toFixed(1)}% APY with ${bestOpp.risk} risk`,
        confidence: 70,
        urgency: 'low',
        risks: ['Smart contract risk', 'APY may change'],
      }] : [],
      marketSentiment: 'neutral',
      riskAssessment: {
        overall: request.userSettings.riskTolerance,
        factors: ['Market conditions normal', 'Standard DeFi risks apply'],
      },
      timestamp: new Date(),
    };
  }

  private getMockChatResponse(message: string): string {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('best') || lowerMsg.includes('recommend')) {
      return "🤖 Based on current market conditions, I'd recommend looking at Venus Protocol for stable lending yields (3-8% APY) or PancakeSwap LP farms for higher returns. Would you like me to analyze specific opportunities?";
    }
    if (lowerMsg.includes('risk')) {
      return "🛡️ Risk management is crucial in DeFi! I always recommend: 1) Never invest more than you can lose, 2) Diversify across protocols, 3) Set stop-losses, 4) Monitor positions regularly. What's your risk tolerance?";
    }
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return "👋 Hello! I'm YBOT, your DeFi trading assistant. I can help you find yield opportunities, analyze risks, and manage your positions. What would you like to know?";
    }
    if (lowerMsg.includes('apy') || lowerMsg.includes('yield')) {
      return "📈 Current top yields on BSC:\n• Venus USDT: ~5-8% APY (low risk)\n• PancakeSwap CAKE-BNB: ~15-25% APY (medium risk)\n• Beefy auto-compound vaults: varies\n\nWould you like detailed analysis on any of these?";
    }
    
    return "🤖 I'm YBOT, your DeFi assistant. To unlock my full AI capabilities, please configure your AI provider keys (Mistral or HuggingFace) in settings. For now, I can still help you monitor yields and manage basic strategies!";
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  clearChatHistory() {
    this.chatHistory = [];
  }
}

export const aiService = new AIService();

export default aiService;
