import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import FormData from 'form-data';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PINATA_KEY = process.env.VITE_PINATA_KEY;
const PINATA_SECRET = process.env.VITE_PINATA_SECRET;

console.log('Loaded PINATA_KEY:', PINATA_KEY ? 'YES' : 'NO');
console.log('Loaded PINATA_SECRET:', PINATA_SECRET ? 'YES' : 'NO');

if (!PINATA_KEY || !PINATA_SECRET) {
  console.warn('Warning: VITE_PINATA_KEY or VITE_PINATA_SECRET not set in environment. Pin endpoints will fail.');
}

const pinFileBuffer = async (buffer, filename, mimeType) => {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: mimeType });
  const metadata = JSON.stringify({ name: filename });
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
  return (await res.json()).IpfsHash;
};

const pinJSON = async (json) => {
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: PINATA_KEY,
      pinata_secret_api_key: PINATA_SECRET,
    },
    body: JSON.stringify(json),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pinata JSON pin failed: ${res.status} ${txt}`);
  }
  return (await res.json()).IpfsHash;
};

app.post('/api/pin', async (req, res) => {
  try {
    const { imageBase64, name } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid base64 image' });
    const mimeType = match[1];
    const b64 = match[2];
    const buffer = Buffer.from(b64, 'base64');
    const filename = `${name || 'nft'}-${Date.now()}.png`;

    const imageCid = await pinFileBuffer(buffer, filename, mimeType);

    return res.json({ imageCid });
  } catch (err) {
    console.error('Pin error', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/pin/metadata', async (req, res) => {
  try {
    const { metadata } = req.body;
    if (!metadata) return res.status(400).json({ error: 'No metadata provided' });
    const metaCid = await pinJSON(metadata);
    return res.json({ metaCid });
  } catch (err) {
    console.error('Pin metadata error', err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Pinata backend running on port ${PORT}`);
});
