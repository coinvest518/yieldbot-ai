// Simple Pinata uploader for generated images
// Usage: `npm run pin-art`

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const PINATA_KEY = process.env.VITE_PINATA_KEY;
const PINATA_SECRET = process.env.VITE_PINATA_SECRET;

if (!PINATA_KEY || !PINATA_SECRET) {
  console.error('Pinata API key/secret missing. Set VITE_PINATA_KEY and VITE_PINATA_SECRET in .env.local.');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'output', 'images');

const uploadFile = async (filePath) => {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  // Basic metadata example
  const metadata = JSON.stringify({ name: path.basename(filePath) });
  form.append('pinataMetadata', metadata);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      pinata_api_key: PINATA_KEY,
      pinata_secret_api_key: PINATA_SECRET,
    },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pinata upload failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.IpfsHash;
};

(async () => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      console.error('No images found in', OUTPUT_DIR);
      process.exit(1);
    }

    const files = fs.readdirSync(OUTPUT_DIR).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
    if (files.length === 0) {
      console.error('No image files to pin in', OUTPUT_DIR);
      process.exit(1);
    }

    for (const f of files) {
      const full = path.join(OUTPUT_DIR, f);
      console.log('Uploading', full);
      const cid = await uploadFile(full);
      console.log(`Pinned ${f} -> ipfs://${cid}`);
    }

    console.log('All done.');
  } catch (err) {
    console.error('Pin error', err);
    process.exit(1);
  }
})();
