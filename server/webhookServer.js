const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const EVENTS_FILE = path.join(__dirname, 'events.json');

// Initialize events file
if (!fs.existsSync(EVENTS_FILE)) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify([]));
}

// Webhook endpoint for Moralis Streams
app.post('/webhook/moralis', (req, res) => {
  console.log('📥 Received webhook from Moralis');
  
  const { confirmed, logs, tag } = req.body;
  
  // Return 200 immediately for test webhooks
  if (!logs || logs.length === 0) {
    console.log('✅ Test webhook received');
    return res.status(200).json({ success: true });
  }

  // Only process confirmed events
  if (confirmed) {
    const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    
    logs.forEach(log => {
      const event = {
        type: log.topic0.includes('TokensPurchased') ? 'buy' : 'sell',
        address: log.topic1, // buyer/seller address
        usdAmount: log.data[0],
        tokenAmount: log.data[1],
        price: log.data[2],
        fee: log.data[3],
        txHash: log.transactionHash,
        timestamp: new Date().toISOString(),
        blockNumber: log.blockNumber
      };
      
      events.unshift(event); // Add to beginning
      console.log(`✅ ${event.type.toUpperCase()}: ${event.address}`);
    });
    
    // Keep only last 100 events
    const trimmed = events.slice(0, 100);
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(trimmed, null, 2));
  }
  
  res.status(200).json({ success: true });
});

// API endpoint to get events
app.get('/api/events', (req, res) => {
  const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  res.json(events);
});

const PORT = 4002;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on http://localhost:${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook/moralis`);
});
