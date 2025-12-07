// This file exports a function to generate the Iron Tier credit card SVG for yBOT Finance
// You can import and use this SVG as a React component or as a static asset

export const IronCreditCardSVG = ({
  score = 0,
  wallet = '0xDf6a...3b9584',
  id = '651646',
} = {}) => (
  <svg width="508" height="322" viewBox="0 0 508 322" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#a3a3a3" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="508" height="322" rx="24" fill="url(#bg)" />
    <rect x="32" y="100" width="60" height="40" rx="6" fill="#fbbf24" />
    <text x="48" y="128" fontFamily="monospace" fontSize="12" fill="#92400e">■■■■</text>
    <text x="48" y="144" fontFamily="monospace" fontSize="12" fill="#92400e">■■■■</text>
    <text x="40" y="60" fontFamily="Inter, sans-serif" fontWeight="bold" fontSize="22" fill="#a3a3a3">IRON TIER</text>
    <text x="370" y="60" fontFamily="Space Grotesk, sans-serif" fontWeight="bold" fontSize="28" fill="#fff">yBOT FINANCE</text>
    <text x="254" y="180" fontFamily="Space Grotesk, sans-serif" fontWeight="bold" fontSize="90" fill="#fff" textAnchor="middle">{score}</text>
    <text x="254" y="210" fontFamily="Inter, sans-serif" fontSize="16" fill="#94a3b8" textAnchor="middle">SOULBOUND CREDIT SCORE</text>
    <text x="40" y="290" fontFamily="Courier New, monospace" fontSize="18" fill="#fff">{wallet}</text>
    <text x="468" y="290" fontFamily="Courier New, monospace" fontSize="18" fill="#fff" textAnchor="end">ID: {id}</text>
  </svg>
);
