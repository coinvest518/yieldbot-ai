import React from 'react';
import { Twitter, Github, Send, BarChart3 } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-ybot-dark py-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <BarChart3 className="text-white w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl text-white">
                yBOT<span className="text-cyan-400">.FINANCE</span>
              </span>
              <p className="text-xs text-gray-500">YieldBot DeFi</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Ecosystem</a>
            <a href="#vault" className="hover:text-white transition-colors">Vault</a>
            <a href="#yield-strategies" className="hover:text-white transition-colors">Yield</a>
            <a href="#roadmap" className="hover:text-white transition-colors">Roadmap</a>
          </div>

          {/* Social Links */}
          <div className="flex gap-4">
            <a 
              href="https://x.com/yieldbot_ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-10 h-10 bg-slate-800 hover:bg-purple-500/20 border border-slate-700 hover:border-purple-500/50 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <Twitter size={18} />
            </a>
            <a 
              href="#" 
              className="w-10 h-10 bg-slate-800 hover:bg-purple-500/20 border border-slate-700 hover:border-purple-500/50 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <Github size={18} />
            </a>
            <a 
              href="#" 
              className="w-10 h-10 bg-slate-800 hover:bg-purple-500/20 border border-slate-700 hover:border-purple-500/50 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <Send size={18} />
            </a>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © 2025 YieldBot DeFi. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;