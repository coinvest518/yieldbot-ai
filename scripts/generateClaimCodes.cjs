// Generate 100 unique claim codes for YBOT giveaway
const fs = require('fs');

function generateCode() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `YBOT-EARLY-${randomNum}`;
}

function generateUniqueCodes(count) {
  const codes = new Set();
  
  while (codes.size < count) {
    codes.add(generateCode());
  }
  
  return Array.from(codes);
}

// Generate 100 codes
const codes = generateUniqueCodes(100);

// Create JSON format
const codesData = codes.map((code, index) => ({
  id: index + 1,
  code: code,
  claimed: false,
  claimedBy: null,
  claimedAt: null,
  amount: '100'
}));

// Save to JSON file
fs.writeFileSync(
  'claim-codes.json',
  JSON.stringify(codesData, null, 2)
);

// Also create a simple text list
fs.writeFileSync(
  'claim-codes.txt',
  codes.join('\n')
);

console.log('✅ Generated 100 unique claim codes!');
console.log('📄 Saved to: claim-codes.json and claim-codes.txt');
console.log('\nSample codes:');
codes.slice(0, 5).forEach(code => console.log(`  ${code}`));
