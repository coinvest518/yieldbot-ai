// Layer-based NFT Generation Service
// Combines background + full body character layers
// Output: 1024x1536 (portrait) - matches source image dimensions

export interface LayerAsset {
  name: string;
  path: string;
  weight: number;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary';
}

export interface GeneratedNFT {
  image: string; // base64 data URL
  attributes: {
    trait_type: string;
    value: string;
    rarity: string;
  }[];
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary';
}

// Canvas dimensions (square - matches your character images)
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;

// Determine rarity based on weight
const getRarityFromWeight = (weight: number): 'Common' | 'Uncommon' | 'Rare' | 'Legendary' => {
  if (weight <= 5) return 'Legendary';
  if (weight <= 15) return 'Rare';
  if (weight <= 40) return 'Uncommon';
  return 'Common';
};

// Weighted random selection
const weightedRandom = <T extends { weight: number }>(items: T[]): T => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
};

// Common backgrounds from layers/1-Background (weight 50 = common)
const COMMON_BACKGROUNDS: LayerAsset[] = Array.from({ length: 26 }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return {
    name: `Background ${num}`,
    path: `/layers/1-Background/background_${num}_20.png`,
    weight: 50,
    rarity: 'Common' as const
  };
});

// Rare backgrounds from Rare Background folder (weight 10 = rare)
const RARE_BACKGROUNDS: LayerAsset[] = Array.from({ length: 26 }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return {
    name: `Rare Background ${num}`,
    path: `/Rare Background/background_${num}.png`,
    weight: 10,
    rarity: 'Rare' as const
  };
});

// All backgrounds combined
const BACKGROUNDS: LayerAsset[] = [...COMMON_BACKGROUNDS, ...RARE_BACKGROUNDS];

// Full Body Rare characters (weight 20 = uncommon/rare)
const CHARACTERS: LayerAsset[] = [
  { name: 'YBOT Agent Nova', path: '/Full Body Rare/1.png', weight: 20, rarity: 'Rare' },
  { name: 'YBOT Agent Cipher', path: '/Full Body Rare/2.png', weight: 20, rarity: 'Rare' },
  { name: 'YBOT Agent Phantom', path: '/Full Body Rare/3.png', weight: 20, rarity: 'Rare' },
  { name: 'YBOT Agent Specter', path: '/Full Body Rare/4.png', weight: 20, rarity: 'Rare' },
  { name: 'YBOT Agent Zero', path: '/Full Body Rare/5.png', weight: 5, rarity: 'Legendary' },
];

// Load image from path
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('Successfully loaded image:', src, `(${img.width}x${img.height})`);
      resolve(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load image:', src, e);
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
};

// Calculate overall rarity based on traits
const calculateOverallRarity = (traits: { rarity: string }[]): 'Common' | 'Uncommon' | 'Rare' | 'Legendary' => {
  const rarityScore = traits.reduce((score, trait) => {
    switch (trait.rarity) {
      case 'Legendary': return score + 4;
      case 'Rare': return score + 3;
      case 'Uncommon': return score + 2;
      default: return score + 1;
    }
  }, 0);
  
  const avgScore = rarityScore / traits.length;
  if (avgScore >= 3.5) return 'Legendary';
  if (avgScore >= 2.5) return 'Rare';
  if (avgScore >= 1.5) return 'Uncommon';
  return 'Common';
};

// Main generation function - creates layered NFT image at 500x500
export const generateLayeredNFT = async (): Promise<GeneratedNFT> => {
  // Select random layers based on weight
  const selectedBackground = weightedRandom(BACKGROUNDS);
  const selectedCharacter = weightedRandom(CHARACTERS);

  console.log('Generating NFT with:', {
    background: selectedBackground.path,
    character: selectedCharacter.path,
    outputSize: `${CANVAS_WIDTH}x${CANVAS_HEIGHT}`
  });

  // Create canvas at 500x500
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  try {
    // Load and draw background (scaled to fit 500x500)
    const bgImg = await loadImage(selectedBackground.path);
    // Scale background to fill canvas (will crop if aspect ratio differs)
    ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Load character image (500x500)
    const charImg = await loadImage(selectedCharacter.path);
    
    // Draw character centered at full size (should be 500x500)
    ctx.drawImage(charImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    console.log('Drew layers at:', { width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

  } catch (error) {
    console.error('Error loading layer images:', error);
    // Fallback: Create a visually interesting placeholder
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw a stylized placeholder
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, CANVAS_WIDTH - 100, CANVAS_HEIGHT - 100);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fugitive NFT', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`#${Math.floor(Math.random() * 10000)}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    ctx.fillText(selectedBackground.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    ctx.fillText(selectedCharacter.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
  }

  // Build attributes
  const attributes = [
    {
      trait_type: 'Background',
      value: selectedBackground.name,
      rarity: selectedBackground.rarity
    },
    {
      trait_type: 'Character',
      value: selectedCharacter.name,
      rarity: selectedCharacter.rarity
    }
  ];

  const overallRarity = calculateOverallRarity(attributes);

  return {
    image: canvas.toDataURL('image/png'),
    attributes,
    rarity: overallRarity
  };
};

// Get tier from rarity (for compatibility with existing code)
export const getTierFromRarity = (rarity: string): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' => {
  switch (rarity) {
    case 'Legendary': return 'Diamond';
    case 'Rare': return 'Platinum';
    case 'Uncommon': return 'Gold';
    case 'Common': return 'Silver';
    default: return 'Bronze';
  }
};
