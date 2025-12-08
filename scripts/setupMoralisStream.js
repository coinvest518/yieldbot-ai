const Moralis = require("moralis").default;

const MORALIS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjdiYWVkNDA0LTIyOGEtNGJhNS04ZTBmLTg5OGVhZmIwNTYyYSIsIm9yZ0lkIjoiNjgyOCIsInVzZXJJZCI6IjEzNjM0IiwidHlwZUlkIjoiYmYzZjA4OWMtNTJkMy00NzdlLWIzNTItNTNhN2ZlOGJhMjQ1IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDY3NTQyNzcsImV4cCI6NDkwMjUxNDI3N30.5a68P3gaLK9CM40FX9MHL6-MY5TBv4tz6ZJPhEnhT5M";
const FUNDRAISER_ADDRESS = "0x06826d64d31c6A05D17D35ae658f47a3827bdd51";
const WEBHOOK_URL = "https://webhook.site/YOUR_WEBHOOK_ID"; // Replace with your webhook URL

const ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "buyer", type: "address" },
      { indexed: false, name: "usdAmount", type: "uint256" },
      { indexed: false, name: "tokensMinted", type: "uint256" },
      { indexed: false, name: "avgPricePerToken", type: "uint256" },
      { indexed: false, name: "fee", type: "uint256" }
    ],
    name: "TokensPurchased",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "tokenAmount", type: "uint256" },
      { indexed: false, name: "usdReceived", type: "uint256" },
      { indexed: false, name: "avgPricePerToken", type: "uint256" },
      { indexed: false, name: "fee", type: "uint256" }
    ],
    name: "TokensSold",
    type: "event"
  }
];

async function setupStream() {
  await Moralis.start({ apiKey: MORALIS_API_KEY });

  const stream = await Moralis.Streams.add({
    webhookUrl: WEBHOOK_URL,
    description: "YBOT Fundraiser Events",
    tag: "ybot_fundraiser",
    chains: ["0x38"], // BSC Mainnet
    includeContractLogs: true,
    abi: ABI,
    topic0: [
      "TokensPurchased(address,uint256,uint256,uint256,uint256)",
      "TokensSold(address,uint256,uint256,uint256,uint256)"
    ]
  });

  console.log("Stream created:", stream.toJSON().id);

  // Add contract address to monitor
  await Moralis.Streams.addAddress({
    id: stream.toJSON().id,
    address: [FUNDRAISER_ADDRESS]
  });

  console.log("✅ Stream setup complete!");
  console.log("Monitoring:", FUNDRAISER_ADDRESS);
  console.log("Webhook:", WEBHOOK_URL);
}

setupStream().catch(console.error);
