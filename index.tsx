import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { bscTestnet, bsc } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'cd2c15a170750ad01e62ef80f2ba74f4';

const metadata = {
  name: 'yBOT.FINANCE',
  description: 'BNB Chain NFT Minter & DeFi Platform',
  url: 'http://localhost:3000',
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
    onramp: true,
    swaps: true // Note: Only works on mainnet with supported tokens
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
