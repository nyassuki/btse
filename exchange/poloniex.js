require('dotenv').config();
const Poloniex = require('poloniex-api-node');

// 🔐 Load API Credentials from .env
const API_KEY = process.env.POLONIEX_API_KEY;
const SECRET = process.env.POLONIEX_SECRET;

// Initialize Poloniex client
const poloniex = new Poloniex(API_KEY, SECRET);
 

 const tradesHistory = poloniex.getTradesHistory({ limit: 1000, symbols: 'BTC_USDT' })
  .then((result) => console.log(result))
  .catch((err) => console.log(err))


 