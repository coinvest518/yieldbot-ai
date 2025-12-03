// Interacts with Moralis EVM API
// Uses the key provided by the user

import { NFTItem } from '../types';
import { drawAccessKey } from './yieldService';

const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_KEY;

// Contract addresses for different networks
const NFT_CONTRACT_TESTNET = import.meta.env.VITE_NFT_CONTRACT_TESTNET || '0x6D0646E2245B33C57E86f7E5F564dFB7b0587469';
const NFT_CONTRACT_MAINNET = import.meta.env.VITE_NFT_CONTRACT_MAINNET || '0x6D0646E2245B33C57E86f7E5F564dFB7b0587469'; // Update with mainnet contract when deployed

// Get correct contract address based on chainId
export const getNFTContractAddress = (chainId: string): string => {
  // BSC Mainnet
  if (chainId === '0x38' || chainId === '56') {
    return NFT_CONTRACT_MAINNET;
  }
  // BSC Testnet (default)
  return NFT_CONTRACT_TESTNET;
};

export const getNativeBalance = async (address: string, chainId: string = '0x61') => {
  if (!address) return '0';

  try {
    const response = await fetch(`https://deep-index.moralis.io/api/v2.2/${address}/balance?chain=${chainId}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });

    if (!response.ok) {
      // Handle generic errors or rate limits
      console.warn("Moralis request failed, returning 0 balance");
      return '0.0000';
    }

    const data = await response.json();
    // Balance is returned in Wei, convert to BNB roughly for display
    const balanceBNB = (Number(data.balance) / 1e18).toFixed(4);
    return balanceBNB;
  } catch (error) {
    console.error("Moralis Fetch Error:", error);
    return '0.0000';
  }
};

// Fetch NFTs owned by address from our specific contract
export const fetchWalletNFTs = async (address: string, chainId: string = '0x61'): Promise<NFTItem[]> => {
  if (!address) return [];

  const contractAddress = getNFTContractAddress(chainId);

  try {
    // Fetch NFTs from specific contract
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${address}/nft?chain=${chainId}&token_addresses[]=${contractAddress}&format=decimal&media_items=true`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.warn("Moralis NFT fetch failed:", response.status);
      return [];
    }

    const data = await response.json();
    console.log('Moralis NFT response:', data);

    if (!data.result || data.result.length === 0) {
      return [];
    }

    // Transform Moralis data to our NFTItem format
    const nfts: NFTItem[] = await Promise.all(
      data.result.map(async (nft: any) => {
        let metadata: any = {};
        let imageUrl = '';

        // Parse metadata if available
        if (nft.metadata) {
          try {
            metadata = typeof nft.metadata === 'string' ? JSON.parse(nft.metadata) : nft.metadata;
          } catch (e) {
            console.warn('Failed to parse NFT metadata:', e);
          }
        }

        // Get image URL - try multiple sources
        if (metadata.image) {
          imageUrl = metadata.image.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        } else if (nft.media?.original_media_url) {
          imageUrl = nft.media.original_media_url;
        } else if (nft.token_uri) {
          // Fetch metadata from token URI if not cached
          try {
            const tokenUri = nft.token_uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
            const metaResponse = await fetch(tokenUri);
            if (metaResponse.ok) {
              metadata = await metaResponse.json();
              imageUrl = metadata.image?.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/') || '';
            }
          } catch (e) {
            console.warn('Failed to fetch token metadata:', e);
          }
        }

        // Extract tier and rarity from attributes
        let tier = 'Silver';
        let rarity = 'Common';
        const attributes = metadata.attributes || [];
        
        for (const attr of attributes) {
          if (attr.trait_type === 'Tier') tier = attr.value;
          if (attr.trait_type === 'Rarity') rarity = attr.value;
        }

        // Generate key preview image based on tier
        const keyPreviewImage = await drawAccessKey(tier as 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond');

        return {
          id: parseInt(nft.token_id),
          tokenId: parseInt(nft.token_id),
          name: metadata.name || `${tier} Access Key`,
          description: metadata.description || `Grants priority access to ${tier} yield vaults.`,
          image: imageUrl,
          previewImage: keyPreviewImage, // Key preview for gallery display
          tier: tier,
          rarity: rarity,
          attributes: attributes.map((attr: any) => ({
            trait_type: attr.trait_type,
            value: attr.value,
            rarity: attr.rarity
          }))
        };
      })
    );

    return nfts;
  } catch (error) {
    console.error("Moralis NFT Fetch Error:", error);
    return [];
  }
};
