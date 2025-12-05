import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { bscTestnet, bsc } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error('VITE_REOWN_PROJECT_ID is not set. Get one from https://dashboard.reown.com');
}

const metadata = {
  name: 'yBOT.FINANCE',
  description: 'BNB Chain NFT Minter & DeFi Platform',
  url: 'https://yieldbot.cc',
  icons: ['https://avatars.githubusercontent.com/u/179229932']
};

// Support both BSC Mainnet and Testnet - user can switch in wallet
const networks = [bsc, bscTestnet];

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks
});

const queryClient = new QueryClient();

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: bscTestnet, // Default to testnet for safety
  metadata,
  projectId,
  features: {
    analytics: true,
    email: false,
    socials: []
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <WagmiProvider config={wagmiAdapter.wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
