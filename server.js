const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: parse JSON and capture raw body for webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Error connecting to MongoDB:", err));

// Define Mongoose schema and model for Balance
const balanceSchema = new mongoose.Schema({
  _id: { type: String, default: 'balance' },
  balance: { type: Number, default: 0 }
});
const Balance = mongoose.model('Balance', balanceSchema);

// Serve static files from public folder (index.html, success.html)
app.use(express.static(path.join(__dirname, 'public')));

// API to get current balance
app.get('/api/balance', async (req, res) => {
  try {
    let balDoc = await Balance.findById('balance');
    if (!balDoc) {
      // Create the document if it doesn't exist
      balDoc = await Balance.create({ _id: 'balance', balance: 0 });
    }
    res.json({ balance: balDoc.balance });
  } catch (err) {
    console.error("Error fetching balance:", err);
    res.status(500).json({ error: 'Error fetching balance' });
  }
});

// Razorpay webhook endpoint
app.post('/webhook', (req, res) => {
  const secret = process.env.RAZORPAY_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  // Verify the webhook signature using the raw body
  const hash = crypto.createHmac('sha256', secret)
                     .update(req.rawBody)
                     .digest('hex');

  if (hash === signature) {
    console.log("Webhook verified successfully.");
    const event = req.body.event;

    // Check if the payment is captured (successful)
    if (event === 'payment.captured') {
      // Increment the balance by 1
      Balance.findByIdAndUpdate('balance', { $inc: { balance: 1 } }, { upsert: true, new: true }, (err, doc) => {
        if (err) {
          console.error("Error updating balance:", err);
          return res.status(500).json({ error: 'Error updating balance' });
        } else {
          console.log("Balance updated. New balance:", doc.balance);
          return res.json({ status: 'success', balance: doc.balance });
        }
      });
    } else {
      return res.status(400).json({ error: 'Event not handled' });
    }
  } else {
    console.error("Invalid webhook signature.");
    return res.status(400).json({ error: 'Invalid signature' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
