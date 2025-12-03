import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, Shield, Wallet, Lock, ArrowUpRight, CheckCircle, Award, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { WalletState, UserFinanceData, VaultStats, TIERS, NFTItem } from '../types';
import { investInVault, mintCreditScoreSBT, claimYields, connectWallet, getYBOTBalance, getUSDTBalance, approveYBOT, mintNFT, getNFTContractInfo, getVaultUserInfo } from '../services/web3Service';
import { uploadToPinata, base64ToBlob, uploadMetadataToPinata } from '../services/pinataService';
import { getNativeBalance, fetchWalletNFTs } from '../services/moralisService';
import { mockFetchUserFinance, mockFetchVaultStats, drawCreditCard, getTierFromScore, drawAccessKey } from '../services/yieldService';
import { generateLayeredNFT, getTierFromRarity } from '../services/layerGenService';
import { getPrices } from '../services/priceService';
import { getFundraiserStats, buyWithBnb, FUNDRAISER_CONSTANTS, type FundraiserStats } from '../services/fundraiserService';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import Gallery from './Gallery';

const Dashboard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const [userData, setUserData] = useState<UserFinanceData | null>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [investAmount, setInvestAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [mintingKey, setMintingKey] = useState(false);
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const [galleryItems, setGalleryItems] = useState<NFTItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  
  const [ybotBalance, setYbotBalance] = useState<string>('0');
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [nftInfo, setNftInfo] = useState<any>(null);
  const [prices, setPrices] = useState<{ bnbPriceUSD: number; ybotPerBNB: number; ybotPerUSDC: number } | null>(null);
  
  // Fundraiser/Bonding Curve state
  const [fundraiserStats, setFundraiserStats] = useState<FundraiserStats | null>(null);
  const [buyBnbAmount, setBuyBnbAmount] = useState<string>('');
  const [buyingTokens, setBuyingTokens] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Load mock vault stats (no blockchain calls needed)
      const stats = await mockFetchVaultStats();
      setVaultStats(stats);
      
      // Load price data (uses CoinGecko, no wallet needed)
      const priceData = await getPrices();
      setPrices(priceData);
      
      // ONLY load blockchain data if wallet is connected
      if (isConnected && address) {
        // Load fundraiser stats only when connected
        try {
          const fStats = await getFundraiserStats();
          setFundraiserStats(fStats);
        } catch (e) {
          console.log('Fundraiser stats not available');
        }
        
        const realBalance = await getNativeBalance(address);
        const finance = await mockFetchUserFinance(address);
        
        // Fetch USDT balance
        const usdtBal = await getUSDTBalance(address);
        
        // Try to fetch real vault data
        let stakedAmount = '0.00';
        let pendingYield = '0.00';
        try {
          const vaultUserData = await getVaultUserInfo(address);
          stakedAmount = vaultUserData.deposited;
          pendingYield = vaultUserData.pendingYBOT;
        } catch (e) {
          console.log('Vault user info not available, using defaults');
        }
        
        const mergedData = { 
          ...finance, 
          balanceBNB: realBalance,
          usdtBalance: usdtBal,
          stakedAmount: stakedAmount,
          pendingYield: pendingYield
        };
        setUserData(mergedData);
        
        const img = await drawCreditCard(mergedData, address);
        setCardImage(img);

        // Fetch REAL NFTs from blockchain via Moralis
        setGalleryLoading(true);
        const nfts = await fetchWalletNFTs(address);
        console.log('Fetched NFTs from wallet:', nfts);
        setGalleryItems(nfts);
        setGalleryLoading(false);

        const balance = await getYBOTBalance(address);
        setYbotBalance(balance);
        const info = await getNFTContractInfo();
        setNftInfo(info);
      }
    };
    loadData();
  }, [isConnected, address]);

  const handleInvest = async () => {
    if (!investAmount || parseFloat(investAmount) <= 0) return;
    if (!address) return;
    
    setLoading(true);
    try {
      const hash = await investInVault(investAmount);
      
      if (userData) {
         const newStaked = (parseFloat(userData.stakedAmount) + parseFloat(investAmount)).toFixed(2);
         const newUsdtBalance = (parseFloat(userData.usdtBalance) - parseFloat(investAmount)).toFixed(2);
         const newScore = userData.creditScore + (parseFloat(investAmount) * 10);
         
         const updatedData = {
            ...userData,
            stakedAmount: newStaked,
            usdtBalance: newUsdtBalance,
            creditScore: Math.floor(newScore),
            creditTier: getTierFromScore(newScore)
         };
         
         setUserData(updatedData);
         
         if (address) {
            const img = await drawCreditCard(updatedData, address);
            setCardImage(img);
         }
      }
      setTxHash(hash);
      setInvestAmount('');
    } catch (e) {
      console.error('Deposit failed:', e);
      alert('Deposit failed. Make sure you have enough USDT and 100 YBOT for vault access.');
    } finally {
      setLoading(false);
    }
  };

  const handleMintSBT = async () => {
    if (!userData || !address || !cardImage) return;
    setLoading(true);
    try {
       const blob = base64ToBlob(cardImage);
       const imgHash = await uploadToPinata(blob);
       
       const metadata = {
          name: `yBot Credit Score - ${userData.creditTier}`,
          description: "Soulbound Credit Token for yBot Finance Ecosystem. Grants access to borrowing pools.",
          image: `ipfs://${imgHash}`,
          attributes: [
             { trait_type: "Score", value: userData.creditScore },
             { trait_type: "Tier", value: userData.creditTier }
          ]
       };
       const metaHash = await uploadMetadataToPinata(metadata);
       
       const hash = await mintCreditScoreSBT(`ipfs://${metaHash}`);
       setTxHash(hash);
       setUserData({...userData, hasSBT: true});
    } catch (e) {
       console.error(e);
    } finally {
       setLoading(false);
    }
  };

  const handleDirectMintKey = async () => {
    if (!address || !nftInfo) return;
    setMintingKey(true);
    try {
        const tokenId = nftInfo.nextId;
        
        if (parseFloat(ybotBalance) < parseFloat(nftInfo.mintPrice)) {
            alert(`Insufficient YBOT balance. Need ${nftInfo.mintPrice} YBOT. Current: ${ybotBalance}`);
            setMintingKey(false);
            return;
        }

        if (!approved) {
            setApproving(true);
            await approveYBOT(nftInfo.mintPrice);
            setApproved(true);
            setApproving(false);
        }

        // Generate the REAL layered NFT image from your layers
        const generatedNFT = await generateLayeredNFT();
        const tier = getTierFromRarity(generatedNFT.rarity);
        
        // Also generate the key preview image
        const keyPreviewImage = await drawAccessKey(tier, tokenId);
        
        // Upload the REAL layered image to Pinata (this is what shows in wallets/OpenSea)
        const blob = base64ToBlob(generatedNFT.image);
        const imgHash = await uploadToPinata(blob);

        // Create metadata with real attributes
        const metadata = {
            name: `${tier} Access Key`,
            description: `${tier} Access Key grants priority access to ${tier} yield vaults. ${generatedNFT.rarity} rarity.`,
            image: `ipfs://${imgHash}`,
            external_url: `https://yoursite.com/nft/${tokenId}`,
            attributes: [
                ...generatedNFT.attributes.map(attr => ({
                    trait_type: attr.trait_type,
                    value: attr.value
                })),
                { trait_type: "Rarity", value: generatedNFT.rarity },
                { trait_type: "Tier", value: tier },
                { trait_type: "Token ID", value: tokenId.toString() }
            ]
        };
        const metaHash = await uploadMetadataToPinata(metadata);

        const hash = await mintNFT(`ipfs://${metaHash}`);
        setTxHash(hash);

        // Add to gallery with both images
        const newItem: NFTItem = {
            id: Date.now(),
            tokenId: tokenId,
            name: `${tier} Access Key`,
            description: `Grants priority access to ${tier} yield vaults.`,
            image: generatedNFT.image, // The real layered image
            previewImage: keyPreviewImage, // The key for preview
            tier: tier,
            attributes: generatedNFT.attributes,
            rarity: generatedNFT.rarity
        };
        setGalleryItems(prev => [newItem, ...prev]);

        const updatedBalance = await getYBOTBalance(address);
        setYbotBalance(updatedBalance);

    } catch (e) {
        console.error("Mint Failed", e);
        alert('Mint failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
        setMintingKey(false);
    }
  };

  // Handle buying YBOT with BNB via bonding curve
  const handleBuyWithBnb = async () => {
    if (!buyBnbAmount || parseFloat(buyBnbAmount) <= 0) return;
    if (!address) return;
    
    setBuyingTokens(true);
    try {
      const hash = await buyWithBnb(buyBnbAmount);
      setTxHash(hash);
      setBuyBnbAmount('');
      
      // Refresh balance and stats
      const newBalance = await getYBOTBalance(address);
      setYbotBalance(newBalance);
      const fStats = await getFundraiserStats();
      setFundraiserStats(fStats);
    } catch (e) {
      console.error('Buy failed:', e);
      alert('Purchase failed. Please check your BNB balance and try again.');
    } finally {
      setBuyingTokens(false);
    }
  };

  return (
    <section id="dashboard" className="py-20 bg-ybot-dark relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
               { label: 'Total Value Locked', val: vaultStats?.tvl || '---', icon: Lock, color: 'text-ybot-primary' },
               { label: 'Protocol APY', val: (vaultStats?.apy || '0') + '%', icon: TrendingUp, color: 'text-green-400' },
               { label: 'Yield Paid', val: '$' + (vaultStats?.totalYieldDistributed || '---'), icon: Wallet, color: 'text-ybot-gold' },
               { label: 'Next Rebalance', val: vaultStats?.nextRebalance || '---', icon: RefreshCw, color: 'text-ybot-cyan' },
            ].map((stat, idx) => (
               <div key={idx} className="glass-panel p-4 rounded-xl flex items-center gap-4">
                  <div className={`p-3 bg-white/5 rounded-lg ${stat.color}`}>
                     <stat.icon size={20} />
                  </div>
                  <div>
                     <p className="text-xs text-ybot-muted uppercase font-bold">{stat.label}</p>
                     <p className="text-lg font-display font-bold text-white">{stat.val}</p>
                  </div>
               </div>
            ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
            
            <div className="lg:col-span-5 space-y-8">
               <div className="glass-panel p-8 rounded-2xl border-t border-ybot-primary/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-32 bg-ybot-primary/10 blur-[80px] rounded-full group-hover:bg-ybot-primary/20 transition-all"></div>
                  
                  <div className="flex justify-between items-center mb-6 relative z-10">
                     <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield className="text-ybot-cyan" /> My Credit Score
                     </h3>
                     {userData?.hasSBT && <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-bold border border-green-500/30">MINTED & ACTIVE</span>}
                  </div>

                  <div className="w-full aspect-[1.58] bg-slate-800 rounded-xl mb-6 shadow-2xl relative overflow-hidden transition-transform hover:scale-[1.02]">
                     {cardImage ? (
                        <img src={cardImage} alt="Credit Card" className="w-full h-full object-cover" />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center text-ybot-muted">
                           {isConnected ? 'Loading Card...' : 'Connect Wallet to View'}
                        </div>
                     )}
                  </div>

                  {isConnected && userData && (
                     <div className="space-y-4 relative z-10">
                        <div className="flex justify-between text-sm">
                           <span className="text-gray-400">Current Score</span>
                           <span className="text-white font-bold">{userData.creditScore} PTS</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                           <div 
                              className="h-full bg-gradient-to-r from-ybot-primary to-ybot-cyan"
                              style={{ width: `${(userData.creditScore / 1000) * 100}%` }}
                           />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                           <span>Iron (0)</span>
                           <span>Platinum (1000)</span>
                        </div>
                        
                        {!userData.hasSBT ? (
                           <button 
                              disabled={true}
                              className="w-full py-3 bg-slate-800/50 border border-slate-600/30 text-gray-500 rounded-lg font-bold flex justify-center items-center gap-2 mt-4 cursor-not-allowed"
                           >
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full mr-1">Coming Soon</span>
                              Mint Soulbound Token
                           </button>
                        ) : (
                           <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center">
                              Your credit is being tracked on-chain.
                           </div>
                        )}
                     </div>
                  )}
               </div>
               
               <div className="glass-panel p-6 rounded-2xl">
                  <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Award size={18} className="text-ybot-gold" /> Tier Benefits</h4>
                  <ul className="space-y-3">
                     {Object.entries(TIERS).map(([tier, data]) => (
                        <li key={tier} className={`flex justify-between text-sm ${userData?.creditTier === tier ? 'text-white font-bold' : 'text-gray-500'}`}>
                           <span>{tier}</span>
                           <span>{tier === 'Iron' ? 'Base Access' : tier === 'Platinum' ? 'Zero-Collateral Loans' : 'Yield Boost + Borrowing'}</span>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>

            <div id="vault" className="lg:col-span-7 space-y-8">
               
               <div className="glass-panel p-8 rounded-2xl border border-ybot-gold/10 relative">
                  <div className="absolute top-0 right-0 p-32 bg-ybot-gold/5 blur-[80px] rounded-full pointer-events-none"></div>

                  <div className="flex justify-between items-start mb-8">
                     <div>
                        <h3 className="text-2xl font-bold text-white mb-1">yBot Yield Vault</h3>
                        <p className="text-ybot-muted text-sm">Deposit USDT → Earn YBOT rewards via Venus & PancakeSwap strategies.</p>
                     </div>
                     <div className="text-right">
                        <p className="text-sm text-ybot-muted">Your Deposited Balance</p>
                        <p className="text-3xl font-display font-bold text-white">{userData?.stakedAmount || '0.00'} <span className="text-lg text-ybot-muted">USDT</span></p>
                     </div>
                  </div>

                  {!isConnected ? (
                     <div className="h-64 flex flex-col items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10">
                        <Wallet className="w-12 h-12 text-gray-500 mb-4" />
                        <button
                          onClick={() => open()}
                          className="px-6 py-3 bg-ybot-primary hover:bg-ybot-primaryHover text-white font-bold rounded-lg transition-all"
                        >
                          Connect Wallet
                        </button>
                     </div>
                  ) : (
                     <div className="space-y-8">
                        <div className="bg-ybot-card p-6 rounded-xl border border-white/5">
                           <div className="flex justify-between mb-2">
                              <label className="text-sm text-gray-400 font-bold">💰 Deposit USDT</label>
                              <span className="text-sm text-gray-400">Available: {userData?.usdtBalance || '0.00'} USDT</span>
                           </div>
                           <div className="flex gap-4">
                              <input 
                                 type="number" 
                                 value={investAmount}
                                 onChange={(e) => setInvestAmount(e.target.value)}
                                 placeholder="0.0" 
                                 className="w-full bg-ybot-dark border border-white/10 rounded-lg px-4 text-white text-xl focus:border-ybot-primary outline-none transition-colors"
                              />
                              <button 
                                 onClick={handleInvest}
                                 disabled={loading}
                                 className="px-8 bg-ybot-primary hover:bg-ybot-primaryHover text-white font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                              >
                                 {loading ? 'Processing...' : 'DEPOSIT'} <ArrowUpRight size={18} />
                              </button>
                           </div>
                           <p className="text-xs text-gray-500 mt-2">
                              * Requires 100 YBOT to access vault. 0.1% deposit fee applies.
                           </p>
                           <div className="mt-3 p-3 bg-ybot-dark/50 rounded-lg border border-ybot-cyan/20">
                              <p className="text-xs text-ybot-cyan">💡 <strong>How it works:</strong> Your USDT is deployed to Venus (lending) and PancakeSwap (LP farming). You earn YBOT tokens as rewards.</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-ybot-card p-6 rounded-xl border border-white/5">
                              <p className="text-sm text-gray-400 mb-1">🎁 Pending YBOT Rewards</p>
                              <p className="text-2xl font-bold text-ybot-gold flex items-center gap-2">
                                 +{userData?.pendingYield || '0.00'} YBOT
                              </p>
                              <button className="text-xs text-ybot-gold underline mt-2 hover:text-white">Claim Rewards</button>
                           </div>
                           <div className="bg-ybot-card p-6 rounded-xl border border-white/5">
                              <p className="text-sm text-gray-400 mb-1">📈 Projected Monthly</p>
                              <p className="text-2xl font-bold text-white">
                                 {userData ? (parseFloat(userData.stakedAmount) * 0.012).toFixed(2) : '0.00'} YBOT
                              </p>
                              <p className="text-xs text-green-400 mt-2">Based on current APY</p>
                           </div>
                        </div>

                        {txHash && (
                           <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                              <CheckCircle className="text-green-500" />
                              <div>
                                 <p className="text-green-400 font-bold">Transaction Successful</p>
                                 <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" className="text-xs text-green-500/70 hover:underline hover:text-green-400">View on Explorer</a>
                              </div>
                           </div>
                        )}
                     </div>
                  )}
               </div>

               {isConnected && (
                    <div className="glass-panel p-8 rounded-2xl border border-ybot-cyan/20 relative overflow-hidden">
                        <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-ybot-cyan to-ybot-primary"></div>
                        
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                                <Sparkles className="text-ybot-cyan" /> Get YBOT Tokens & Mint NFT
                            </h3>
                            <p className="text-ybot-muted text-sm">
                                Purchase YBOT tokens via bonding curve or swap. Each purchase includes an exclusive Access Key NFT.
                            </p>
                        </div>

                        {/* Bonding Curve Section */}
                        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-4 rounded-xl border border-purple-500/30 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚀</span>
                              <span className="text-sm font-bold text-white">Token Sale (Bonding Curve)</span>
                            </div>
                            <Link 
                              to="/fundraiser" 
                              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                              View Full Page <ExternalLink size={12} />
                            </Link>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">
                                ${fundraiserStats?.totalUsdRaised || '0'} raised
                              </span>
                              <span className="text-gray-400">
                                {fundraiserStats?.progressPercent.toFixed(1) || '0'}% of ${(FUNDRAISER_CONSTANTS.FUNDRAISING_GOAL / 1000).toFixed(0)}K goal
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                style={{ width: `${Math.min(fundraiserStats?.progressPercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Current Price */}
                          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-400">Current Price</p>
                              <p className="text-lg font-bold text-purple-400">
                                ${parseFloat(fundraiserStats?.currentPrice || '0.10').toFixed(4)}
                                <span className="text-xs text-gray-500 ml-1">/YBOT</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Tokens Sold</p>
                              <p className="text-sm font-bold text-white">
                                {fundraiserStats?.totalTokensSold ? parseFloat(fundraiserStats.totalTokensSold).toLocaleString() : '0'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Quick Buy with BNB */}
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={buyBnbAmount}
                              onChange={(e) => setBuyBnbAmount(e.target.value)}
                              placeholder="BNB amount"
                              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                            />
                            <button
                              onClick={handleBuyWithBnb}
                              disabled={buyingTokens || !buyBnbAmount || parseFloat(buyBnbAmount) <= 0}
                              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {buyingTokens ? <Loader2 className="animate-spin" size={14} /> : '🔶'}
                              Buy
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Early buyers get better prices • Price increases as tokens sell
                          </p>
                        </div>

                        <div className="bg-ybot-dark p-4 rounded-lg border border-ybot-cyan/20 mb-6">
                          <p className="text-sm text-white font-bold mb-2">📊 Your YBOT Balance</p>
                          <p className="text-3xl font-display font-bold text-ybot-cyan">{ybotBalance} YBOT</p>
                          <p className="text-xs text-ybot-muted mt-1">Ready to mint NFT: {parseFloat(ybotBalance) >= 1 ? '✅ Yes' : '❌ Need more tokens'}</p>
                        </div>

                        <div className="space-y-3">
                          <p className="text-xs text-ybot-muted uppercase font-bold">Other Ways to Get YBOT</p>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => open({ view: 'OnRampProviders' })}
                                className="px-4 py-3 bg-green-500 text-white hover:bg-green-600 font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                💳 Buy with Fiat
                            </button>
                            
                            <button 
                                onClick={() => open({ view: 'Swap', arguments: { toToken: 'YBOT' } })}
                                className="px-4 py-3 bg-blue-500 text-white hover:bg-blue-600 font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                🔄 Swap Tokens
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 text-center">Use Coinbase Pay or swap BNB/USDC for YBOT</p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-xs text-ybot-muted uppercase font-bold mb-3">Mint Your NFT</p>
                          <button 
                              onClick={handleDirectMintKey}
                              disabled={mintingKey || parseFloat(ybotBalance) < 1}
                              className="w-full px-6 py-4 bg-white text-ybot-dark hover:bg-gray-200 font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                          >
                              {mintingKey ? (
                                  <><Loader2 className="animate-spin" size={20} /> Minting NFT...</>
                              ) : parseFloat(ybotBalance) < 1 ? (
                                  <>❌ Insufficient Balance (Need 1 YBOT)</>
                              ) : (
                                  <>✨ Mint Access Key NFT</>
                              )}
                          </button>
                          <p className="text-xs text-gray-500 text-center mt-2">NFT will appear in your wallet & gallery</p>
                        </div>
                    </div>
                )}
            </div>

        </div>

        {isConnected && (
            <Gallery items={galleryItems} loading={galleryLoading} />
        )}

      </div>
    </section>
  );
};

export default Dashboard;
