/**
 * AI Service - Powers the YBOT Trading Agents
 * Uses Google Gemini for intelligent decision making
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

// ============ GEMINI API ============

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

class AIService {
  private apiKey: string;
  private chatHistory: ChatMessage[] = [];
  private systemPrompt: string;

  constructor() {
    // Try to get API key from env - ElizaOS standardized naming
    this.apiKey = import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || 
                  import.meta.env.VITE_GEMINI_API_KEY || '';
    
    // System prompt that defines the agent's personality and capabilities
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

  // Set API key (can be called from UI if user provides their own key)
  setApiKey(key: string) {
    this.apiKey = key;
  }

  // Check if API is configured
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  // Main analysis function - analyzes market and returns recommendations
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
      const response = await this.callGemini(prompt);
      const parsed = this.parseAnalysisResponse(response);
      return parsed;
    } catch (error) {
      console.error('AI Analysis failed:', error);
      return this.getMockAnalysis(request);
    }
  }

  // Chat function - for interactive conversations with the agent
  async chat(userMessage: string, context?: Partial<AIAnalysisRequest>): Promise<string> {
    // Add user message to history
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

    // Build conversation context
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
      const response = await this.callGemini(prompt);
      
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

  // Get quick market insight
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
      return await this.callGemini(prompt);
    } catch {
      const best = opportunities[0];
      return `Top opportunity: ${best?.protocol} ${best?.pool} at ${best?.apy?.toFixed(1)}% APY`;
    }
  }

  // Call Gemini API
  private async callGemini(prompt: string): Promise<string> {
    const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
  }

  // Parse JSON response from Gemini
  private parseAnalysisResponse(text: string): AIAnalysisResponse {
    try {
      // Try to extract JSON from the response
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

    // Fallback response
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

  // Mock analysis when API not configured
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

  // Mock chat response
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
    
    return "🤖 I'm YBOT, your DeFi assistant. To unlock my full AI capabilities, please configure your Gemini API key in settings. For now, I can still help you monitor yields and manage basic strategies!";
  }

  // Get chat history
  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  // Clear chat history
  clearChatHistory() {
    this.chatHistory = [];
  }
}

// Export singleton instance
export const aiService = new AIService();

export default aiService;
