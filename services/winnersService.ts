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
  
  for (let i = 1; i < lines.length; i++) {
    const [email, name, ranking] = lines[i].split(',').map(s => s.trim());
    if (email) {
      winners.push({
        email,
        name,
        ranking: parseInt(ranking) || 0,
      });
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
