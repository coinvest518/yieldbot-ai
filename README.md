<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# YBOT Finance - DeFi Yield Aggregator with AI Agents

AI-powered yield farming platform on BSC with ElizaOS agent integration.

## Run Locally

**Prerequisites:** Node.js, Bun (for ElizaOS)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set environment variables in [.env.local](.env.local):
   ```bash
   # Google AI (ElizaOS standardized naming)
   GOOGLE_GENERATIVE_AI_API_KEY=your_api_key
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

## ElizaOS Integration

Install ElizaOS CLI and plugins:
```bash
bun i -g @elizaos/cli
elizaos plugins add @elizaos/plugin-google-genai
elizaos plugins add evm
```
