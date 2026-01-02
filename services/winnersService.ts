const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
const WINNERS_IPFS_HASH = import.meta.env.VITE_WINNERS_IPFS_HASH;

export interface Winner {
  email: string;
  name: string;
  ranking: number;
}

export const fetchWinnersFromPinata = async (): Promise<Winner[]> => {
  const url = `${PINATA_GATEWAY}/${WINNERS_IPFS_HASH}`;
  const response = await fetch(url);
  const csv = await response.text();
  
  const lines = csv.trim().split('\n');
  const winners: Winner[] = [];
  
  // CSV format: Rank,Name,Social Media/Tag,Email,Location,Date
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 4) {
      const ranking = parseInt(parts[0]) || 0;
      const name = parts[1]?.trim() || '';
      const email = parts[3]?.trim() || '';
      
      if (email) {
        winners.push({ email, name, ranking });
      }
    }
  }
  
  return winners;
};

export const findWinnerByEmail = async (email: string): Promise<Winner | null> => {
  const winners = await fetchWinnersFromPinata();
  return winners.find(w => w.email.toLowerCase() === email.toLowerCase()) || null;
};

export const calculateRewardAmount = (ranking: number): number => {
  if (ranking <= 10) return 100;
  if (ranking <= 50) return 50;
  if (ranking <= 100) return 25;
  return 10;
};
