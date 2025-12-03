import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, BarChart3, Wallet, Bot, Coins, Lock } from 'lucide-react';
import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();

  const CustomWalletButton = () => {
    const handleConnect = async () => {
      try {
        open();
      } catch (error) {
        console.error('Failed to open wallet modal:', error);
      }
    };

    if (isConnected && address) {
      return (
        <button
          onClick={handleConnect}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium text-sm"
        >
          <Wallet size={16} />
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      );
    }
    
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all font-medium text-sm shadow-lg shadow-purple-500/25"
      >
        <Wallet size={16} />
        Connect Wallet
      </button>
    );
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-ybot-dark/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <BarChart3 className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-white hidden sm:block">
              yBOT<span className="text-cyan-400">.FINANCE</span>
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Regular Links */}
            <a href="#" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Ecosystem
            </a>
            <a href="#vault" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Vault
            </a>
            <a href="#yield-strategies" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Yield
            </a>
            <a href="#roadmap" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Roadmap
            </a>
            
            {/* Divider */}
            <div className="w-px h-6 bg-white/10 mx-2" />
            
            {/* Feature Links */}
            <Link 
              to="/ai-agents" 
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-all"
            >
              <Bot size={14} />
              <span>AI Agents</span>
            </Link>
            <Link 
              to="/fundraiser" 
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-300 hover:text-green-200 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg transition-all"
            >
              <Coins size={14} />
              <span>Token Sale</span>
            </Link>
            <Link 
              to="/staking" 
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-yellow-300 hover:text-yellow-200 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg transition-all"
            >
              <Lock size={14} />
              <span>Staking</span>
            </Link>
          </div>

          {/* Right Side - Wallet */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="text-xs text-gray-400">
                {isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <CustomWalletButton />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden bg-ybot-dark border-t border-white/5">
          <div className="px-4 py-4 space-y-2">
            {/* Regular Links */}
            <a href="#" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              Ecosystem
            </a>
            <a href="#vault" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              Vault
            </a>
            <a href="#yield-strategies" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              Yield Strategies
            </a>
            <a href="#roadmap" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              Roadmap
            </a>
            
            {/* Divider */}
            <div className="h-px bg-white/10 my-3" />
            
            {/* Feature Links */}
            <Link
              to="/ai-agents"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
            >
              <Bot size={18} className="text-purple-400" />
              <span className="font-medium">AI Agents</span>
            </Link>
            <Link
              to="/fundraiser"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
            >
              <Coins size={18} className="text-green-400" />
              <span className="font-medium">Token Sale</span>
            </Link>
            <Link
              to="/staking"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors"
            >
              <Lock size={18} className="text-yellow-400" />
              <span className="font-medium">Staking</span>
            </Link>
            
            {/* Divider */}
            <div className="h-px bg-white/10 my-3" />
            
            {/* Wallet */}
            <div className="px-2">
              <CustomWalletButton />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;