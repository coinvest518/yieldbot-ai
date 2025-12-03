import React, { useState, useEffect } from 'react';
import { NFTItem } from '../types';
import { ExternalLink, Loader2, X, Sparkles, Key } from 'lucide-react';
import { drawAccessKey } from '../services/yieldService';

interface GalleryProps {
  items: NFTItem[];
  loading: boolean;
}

// Demo placeholder Access Keys - shown when no real NFTs exist (10 tiers)
const DEMO_ACCESS_KEYS: Omit<NFTItem, 'previewImage'>[] = [
  { id: 1, tokenId: 1, name: 'Iron Access Key', description: 'Basic entry access to starter yield vaults.', image: '', tier: 'Iron', rarity: 'Common', attributes: [{ trait_type: 'Tier', value: 'Iron' }] },
  { id: 2, tokenId: 2, name: 'Bronze Access Key', description: 'Grants entry access to Bronze yield vaults.', image: '', tier: 'Bronze', rarity: 'Common', attributes: [{ trait_type: 'Tier', value: 'Bronze' }] },
  { id: 3, tokenId: 3, name: 'Silver Access Key', description: 'Grants priority access to Silver yield vaults.', image: '', tier: 'Silver', rarity: 'Common', attributes: [{ trait_type: 'Tier', value: 'Silver' }] },
  { id: 4, tokenId: 4, name: 'Gold Access Key', description: 'Grants priority access to Gold yield vaults.', image: '', tier: 'Gold', rarity: 'Uncommon', attributes: [{ trait_type: 'Tier', value: 'Gold' }] },
  { id: 5, tokenId: 5, name: 'Platinum Access Key', description: 'Grants VIP access to Platinum yield vaults.', image: '', tier: 'Platinum', rarity: 'Rare', attributes: [{ trait_type: 'Tier', value: 'Platinum' }] },
  { id: 6, tokenId: 6, name: 'Diamond Access Key', description: 'Grants exclusive access to Diamond yield vaults.', image: '', tier: 'Diamond', rarity: 'Legendary', attributes: [{ trait_type: 'Tier', value: 'Diamond' }] },
  { id: 7, tokenId: 7, name: 'Obsidian Access Key', description: 'Dark elite access to shadow yield protocols.', image: '', tier: 'Obsidian', rarity: 'Legendary', attributes: [{ trait_type: 'Tier', value: 'Obsidian' }] },
  { id: 8, tokenId: 8, name: 'Titanium Access Key', description: 'Ultra-strong access to fortified vaults.', image: '', tier: 'Titanium', rarity: 'Rare', attributes: [{ trait_type: 'Tier', value: 'Titanium' }] },
  { id: 9, tokenId: 9, name: 'Emerald Access Key', description: 'Nature-powered access to green yield pools.', image: '', tier: 'Emerald', rarity: 'Rare', attributes: [{ trait_type: 'Tier', value: 'Emerald' }] },
  { id: 10, tokenId: 10, name: 'Ruby Access Key', description: 'Fiery access to high-heat yield furnaces.', image: '', tier: 'Ruby', rarity: 'Legendary', attributes: [{ trait_type: 'Tier', value: 'Ruby' }] },
];

const Gallery: React.FC<GalleryProps> = ({ items, loading }) => {
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null);
  const [demoItems, setDemoItems] = useState<NFTItem[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);

  // Generate demo key images when no real items exist
  useEffect(() => {
    const generateDemoKeys = async () => {
      if (items.length === 0 && !loading) {
        setDemoLoading(true);
        const demoWithImages = await Promise.all(
          DEMO_ACCESS_KEYS.map(async (demo) => {
            const keyImage = await drawAccessKey(demo.tier as 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Obsidian' | 'Titanium' | 'Emerald' | 'Ruby');
            return {
              ...demo,
              previewImage: keyImage,
              image: keyImage, // For demo, key is also the "real" image
            };
          })
        );
        setDemoItems(demoWithImages);
        setDemoLoading(false);
      }
    };
    generateDemoKeys();
  }, [items.length, loading]);

  const displayItems = items.length > 0 ? items : demoItems;
  const isDemo = items.length === 0 && demoItems.length > 0;

  return (
    <div className="w-full mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white font-display">
            {isDemo ? 'Access Key Collection' : 'My NFT Collection'} 
            <span className="text-ybot-primary text-sm ml-2 font-mono">({displayItems.length})</span>
            {isDemo && <span className="text-ybot-muted text-xs ml-2">(Preview)</span>}
        </h3>
        <div className="h-px flex-1 bg-white/5 ml-6"></div>
      </div>

      {isDemo && (
        <div className="mb-6 p-4 bg-gradient-to-r from-ybot-primary/10 to-purple-500/10 rounded-xl border border-ybot-primary/20 flex items-center gap-3">
          <Key className="w-5 h-5 text-ybot-primary" />
          <p className="text-ybot-muted text-sm">
            <span className="text-white font-bold">Access Keys</span> unlock yield vaults. Mint your first key above to start earning!
          </p>
        </div>
      )}

      {(loading || demoLoading) ? (
        <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-ybot-primary animate-spin" />
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-dashed border-white/10">
            <p className="text-ybot-muted">No Access Keys found. Mint your first key above!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayItems.map((nft) => (
                <div 
                    key={nft.tokenId} 
                    onClick={() => setSelectedNFT(nft)}
                    className="group relative bg-ybot-card rounded-xl overflow-hidden border border-white/5 hover:border-ybot-primary/50 transition-all hover:-translate-y-1 shadow-lg hover:shadow-ybot-primary/20 cursor-pointer"
                >
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-ybot-dark to-transparent opacity-60 z-10 pointer-events-none"></div>
                    
                    {/* Image - Show preview (key) if available, otherwise main image - Square 1:1 */}
                    <div className="aspect-square w-full bg-slate-900 relative">
                        {(nft.previewImage || nft.image) ? (
                            <img 
                                src={nft.previewImage || nft.image} 
                                alt={nft.name} 
                                className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-ybot-muted">
                                <span>No Image</span>
                            </div>
                        )}
                        <div className="absolute top-2 right-2 z-20">
                            <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md bg-black/50 border border-white/10 text-white backdrop-blur-sm`}>
                                #{nft.tokenId}
                            </span>
                        </div>
                        {nft.rarity && (
                            <div className="absolute top-2 left-2 z-20">
                                <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md backdrop-blur-sm flex items-center gap-1
                                    ${nft.rarity === 'Legendary' ? 'bg-purple-500/50 text-purple-200 border border-purple-400/30' :
                                      nft.rarity === 'Rare' ? 'bg-cyan-500/50 text-cyan-200 border border-cyan-400/30' :
                                      nft.rarity === 'Uncommon' ? 'bg-yellow-500/50 text-yellow-200 border border-yellow-400/30' :
                                      'bg-gray-500/50 text-gray-200 border border-gray-400/30'}`}>
                                    <Sparkles size={10} /> {nft.rarity}
                                </span>
                            </div>
                        )}
                        {/* Click hint */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                            <span className="text-white text-sm font-bold">Click to View</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 relative z-20">
                        <h4 className="text-white font-bold truncate">{nft.name}</h4>
                        <p className="text-ybot-muted text-xs mt-1 truncate">{nft.description}</p>
                        
                        <div className="mt-4 flex justify-between items-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded border inline-flex items-center gap-1
                                ${nft.tier === 'Ruby' ? 'text-red-300 border-red-400/30 bg-red-500/20' :
                                  nft.tier === 'Emerald' ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/20' :
                                  nft.tier === 'Titanium' ? 'text-gray-100 border-gray-300/30 bg-gray-400/20' :
                                  nft.tier === 'Obsidian' ? 'text-gray-400 border-gray-600/30 bg-gray-800/40' :
                                  nft.tier === 'Diamond' ? 'text-purple-300 border-purple-400/30 bg-purple-500/20' : 
                                  nft.tier === 'Platinum' ? 'text-cyan-300 border-cyan-400/30 bg-cyan-500/20' : 
                                  nft.tier === 'Gold' ? 'text-yellow-300 border-yellow-400/30 bg-yellow-500/20' :
                                  nft.tier === 'Silver' ? 'text-slate-200 border-slate-400/30 bg-slate-500/20' :
                                  nft.tier === 'Bronze' ? 'text-orange-300 border-orange-400/30 bg-orange-600/20' :
                                  nft.tier === 'Iron' ? 'text-zinc-400 border-zinc-500/30 bg-zinc-600/20' :
                                  'text-gray-300 border-gray-500/30 bg-gray-500/20'}`}>
                                <Key size={10} /> {nft.tier}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); }}
                                className="text-ybot-muted hover:text-white transition-colors"
                            >
                                <ExternalLink size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* Modal for detailed view */}
      {selectedNFT && (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedNFT(null)}
        >
            <div 
                className="bg-ybot-card rounded-2xl w-[500px] max-w-[95vw] max-h-[95vh] overflow-auto border border-white/10 shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button 
                    onClick={() => setSelectedNFT(null)}
                    className="absolute top-2 right-2 text-white/50 hover:text-white z-30 bg-black/50 rounded-full p-1"
                >
                    <X size={20} />
                </button>

                {/* NFT Image - Square 1:1 aspect ratio (matches 500x500 output) */}
                <div className="w-full aspect-square bg-slate-900 relative">
                    {selectedNFT.image ? (
                        <img 
                            src={selectedNFT.image} 
                            alt={selectedNFT.name} 
                            className="w-full h-full object-contain"
                            style={{ imageRendering: 'auto' }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-ybot-muted">
                            <span>No Image Available</span>
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{selectedNFT.name}</h2>
                            <p className="text-ybot-muted text-sm mt-1">{selectedNFT.description}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                            {selectedNFT.rarity && (
                                <span className={`inline-flex items-center justify-center px-3 py-1.5 text-xs uppercase font-bold rounded-lg leading-none
                                    ${selectedNFT.rarity === 'Legendary' ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50' :
                                      selectedNFT.rarity === 'Rare' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50' :
                                      selectedNFT.rarity === 'Uncommon' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-400/50' :
                                      'bg-gray-500/30 text-gray-300 border border-gray-400/50'}`}>
                                    {selectedNFT.rarity}
                                </span>
                            )}
                            <span className={`inline-flex items-center justify-center px-3 py-1.5 text-xs uppercase font-bold rounded-lg leading-none
                                ${selectedNFT.tier === 'Diamond' ? 'bg-purple-500/30 text-purple-300 border border-purple-400/50' :
                                  selectedNFT.tier === 'Platinum' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50' :
                                  selectedNFT.tier === 'Gold' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-400/50' :
                                  selectedNFT.tier === 'Silver' ? 'bg-slate-400/30 text-slate-200 border border-slate-400/50' :
                                  selectedNFT.tier === 'Bronze' ? 'bg-orange-600/30 text-orange-300 border border-orange-400/50' :
                                  'bg-gray-500/30 text-gray-300 border border-gray-400/50'}`}>
                                {selectedNFT.tier} Tier
                            </span>
                        </div>
                    </div>

                    {/* Attributes */}
                    {selectedNFT.attributes && selectedNFT.attributes.length > 0 && (
                        <div>
                            <h3 className="text-white font-bold mb-3">Attributes</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {selectedNFT.attributes.map((attr, idx) => (
                                    <div key={idx} className="bg-ybot-dark rounded-lg p-3 border border-white/5">
                                        <p className="text-ybot-muted text-xs uppercase">{attr.trait_type}</p>
                                        <p className="text-white font-bold text-sm mt-1">{attr.value}</p>
                                        {attr.rarity && (
                                            <p className={`text-xs mt-1 ${
                                                attr.rarity === 'Legendary' ? 'text-purple-400' :
                                                attr.rarity === 'Rare' ? 'text-cyan-400' :
                                                attr.rarity === 'Uncommon' ? 'text-yellow-400' :
                                                'text-gray-400'
                                            }`}>
                                                {attr.rarity}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Token ID */}
                    <div className="flex justify-between items-center pt-4 border-t border-white/10">
                        <span className="text-ybot-muted text-sm">Token ID</span>
                        <span className="text-white font-mono">#{selectedNFT.tokenId}</span>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;