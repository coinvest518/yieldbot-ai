/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID: string;
  // ElizaOS standardized naming for Google AI
  readonly VITE_GOOGLE_GENERATIVE_AI_API_KEY: string;
  /** @deprecated Use VITE_GOOGLE_GENERATIVE_AI_API_KEY */
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_PINATA_KEY: string;
  readonly VITE_PINATA_SECRET: string;
  readonly VITE_PINATA_JWT: string;
  readonly VITE_MORALIS_KEY: string;
  readonly VITE_ALCHEMY_KEY: string;
  readonly VITE_YBOT_TOKEN_TESTNET: string;
  readonly VITE_NFT_CONTRACT_TESTNET: string;
  readonly VITE_YBOT_VAULT_TESTNET: string;
  readonly VITE_YBOT_VAULT_MAINNET: string;
  readonly VITE_TOKEN_SALE_CONTRACT: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_REOWN_AUTH_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
