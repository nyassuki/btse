const axios = require('axios');
require("dotenv").config(); // Load environment variables

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;


/**
 * Sends a message to a Telegram bot for notifications.
 * @param {string} message - The message to send.
 */
async function sendTelegramMessage(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
        });
    } catch (error) {
        console.error("❌ Error sending Telegram message:", error.response?.data || error.message);
    }
}

async function getBTSEPairs(base,quote) {
    //console.clear();
    const pair_symbol = `${base}-${quote}`;
    try {
        const response = await axios.get('https://api.btse.com/spot/api/v3.2/market_summary');
        const pairs = response.data;
        // Filter pairs that contain the base currency
        const filteredPairs = pairs.filter(pair => pair.symbol === pair_symbol && pair.active);
        let arr_tab = [];
        filteredPairs.forEach(pair => {
            const [base, quote] = pair.symbol.split("-"); // Extract base & quote currencies
            const reverse_price = 1 / parseFloat(pair.lowestAsk);
            const data = {
                exchange:'BTSE',
                pair: pair.symbol,
                volume: pair.volume,
                buy: pair.highestBid,
                sell: pair.lowestAsk,
                spread:parseFloat((pair.lowestAsk-pair.highestBid).toFixed(4)),
                last_price: parseFloat(pair.last.toLocaleString(undefined, { minimumFractionDigits: 4 })),
                maxOrder: pair.maxOrderSize,
                minOrder: pair.minOrderSize,
                velocity: parseFloat(pair.percentageChange.toFixed(2)),
            };
            arr_tab.push(data);
        });

        arr_tab.sort((a, b) => b.sell - a.sell);
        return arr_tab;
    } catch (error) {
        let arr_tab=[];
        const data = {
                exchange:'BTSE',
                pair: '',
                volume: 0,
                buy: 0,
                sell: 0,
                spread:0,
                last_price: 0,
                maxOrder: 0,
                minOrder: 0,
                velocity: 0,
            };
            arr_tab.push(data);
            return arr_tab;
    }
}
async function getCOINEXPairs(base,quote) {
    const base_convert = convertTokenName(base);
     try {
        const symbol =  `${base_convert}${quote}`;
        const response = await axios.get(`https://api.coinex.com/v1/market/ticker?market=${symbol}`);
        const pair = response.data.data.ticker;
        let arr_tab = [];
        const data = {
                exchange:'COINEX',
                pair: symbol,
                volume: parseFloat(pair.vol),
                buy: parseFloat(pair.buy),
                sell: parseFloat(pair.sell),
                spread:parseFloat((parseFloat(pair.sell)-parseFloat(pair.buy)).toFixed(4)),
                last_price: parseFloat(pair.last),
                maxOrder: 0,
                minOrder: 0,
                velocity: 0,
            };
        arr_tab.push(data);
        return arr_tab;
    } catch (error) {
        let arr_tab=[];
        const data = {
                exchange:'COINEX',
                pair: '',
                volume: 0,
                buy: 0,
                sell: 0,
                spread:0,
                last_price: 0,
                maxOrder: 0,
                minOrder: 0,
                velocity: 0,
            };
            arr_tab.push(data);
            return arr_tab;
    }
}
async function getBINANCEPairs(base,quote) {
    try {
        const cbase=convertTokenName(base) 
        const symbol =  `${cbase}${quote}`
        const limit = 2;
        const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${limit}`;
        const response = await axios.get(url);

        let arr_tab = [];
        const data = {
                exchange:'BINANCE',
                pair: symbol,
                volume: parseFloat(response.data.bids[0][1]),
                buy: parseFloat(response.data.bids[0][0]),
                sell: parseFloat(response.data.asks[0][0]),
                spread:parseFloat((parseFloat(response.data.asks[0][0])-parseFloat(response.data.bids[0][0])).toFixed(4)),
                last_price: parseFloat(response.data.bids[0][0]),
                maxOrder: 0,
                minOrder: 0,
                velocity: 0,
            };
             arr_tab.push(data);
            return arr_tab;
    } catch (error) {
        let arr_tab=[];
        const data = {
                exchange:'BINANCE',
                pair: '',
                volume: 0,
                buy: 0,
                sell: 0,
                spread:0,
                last_price: 0,
                maxOrder: 0,
                minOrder: 0,
                velocity: 0,
            };
            arr_tab.push(data);
            return arr_tab;
    }
}

async function getpoloniexPairs(base,quote) {
    const coinPair = `${base}_${quote}`;
    const poloniexOrderBookURL = `https://api.poloniex.com/markets/${coinPair}/orderBook`;
    try {
    const response = await axios.get(poloniexOrderBookURL);
    const orderBook = response.data;
    let arr_tab = [];
    const data = {
        exchange:'POLONIEX',
        pair: coinPair,
        volume: parseFloat(orderBook.bids[1]),
        buy: parseFloat(orderBook.bids[0]),
        sell: parseFloat(orderBook.asks[0]),
        spread:parseFloat((orderBook.asks[0]-orderBook.bids[0])).toFixed(4),
        last_price: parseFloat(orderBook.bids[0]),
        maxOrder: 0,
        minOrder: 0,
        velocity: 0,
    };

        arr_tab.push(data);
        return arr_tab;
    } catch (error) {
        let arr_tab=[];
        const data = {
                exchange:'POLONIEX',
                pair: '',
                volume: 0,
                buy: 0,
                sell: 0,
                spread:0,
                last_price: 0,
                maxOrder: 0,
                minOrder: 0,
                velocity: 0,
            };
            arr_tab.push(data);
            return arr_tab;
    }
}

async function fetchHTXOrderBook(base,quote) {
    base = base.toLowerCase();
    quote = quote.toLowerCase();

    const coinPair = `${base}${quote}`;
    const htxOrderBookURL = `https://api.huobi.pro/market/depth?symbol=${coinPair}&type=step0`;
  try {
    const response = await axios.get(htxOrderBookURL);
    const orderBook = response.data?.tick;
 
   let arr_tab = [];
    const data = {
        exchange:'HUOBI',
        pair: coinPair,
        volume: parseFloat(orderBook.bids[1]),
        buy: parseFloat(orderBook.bids[0][0]),
        sell: parseFloat(orderBook.asks[0][0]),
        spread:parseFloat(orderBook.asks[0][0]-orderBook.bids[0][0]).toFixed(4),
        last_price: parseFloat(orderBook.bids[0]),
        maxOrder: 0,
        minOrder: 0,
        velocity: 0,
    };
        arr_tab.push(data);
        return arr_tab;
  } catch (error) {
        let arr_tab=[];
        const data = {
                exchange:'HUOBI',
                pair: '',
                volume: 0,
                buy: 0,
                sell: 0,
                spread:0,
                last_price: 0,
                maxOrder: 0,
                minOrder: 0,
                velocity: 0,
            };
            arr_tab.push(data);
            return arr_tab;
  }
}
function convertTokenName(token) {
    const tokenMap = {
        TRUMP: "MAGATRUMP",
        TRUMPSOL: "TRUMP",
        TRAC: "TRACBRC",
        WOLF: "WOLFETH",
    };
    return tokenMap[token] || token; // Return mapped name or original if not found.
}

async function main() {
   const args = process.argv.slice(2);
   const baseC = args[0] || "BTC";
   const amountin = args[1] || 50;
   const quoteC = args[2] || "USDT";
   
  await Arbitrage(baseC,quoteC,amountin);
                
}

async function Arbitrage(baseC,quoteC,amountin) {
   let joindata = [];
   const btse= await getBTSEPairs(baseC.toUpperCase(),quoteC.toUpperCase()); // Ensure async call
   const coinex= await getCOINEXPairs(baseC.toUpperCase(),quoteC.toUpperCase()); // Ensure async call
   const binance= await getBINANCEPairs(baseC.toUpperCase(),quoteC.toUpperCase()); // Ensure async call
   const poloniex= await getpoloniexPairs(baseC.toUpperCase(),quoteC.toUpperCase()); // Ensure async call
   const htx= await fetchHTXOrderBook(baseC.toUpperCase(),quoteC.toUpperCase()); // Ensure async call
    
   const btse_data = btse[0];
   const coinex_data = coinex[0];
   const binance_data = binance[0];
   const poloniex_data = poloniex[0];
   const htx_data = htx[0];

   joindata.push(btse_data,coinex_data,binance_data,poloniex_data,htx_data);
   joindata = joindata
      .filter(item => item.sell > 0) // Hapus item dengan sell = 0
      .sort((a, b) => b.sell - a.sell); // Urutkan secara descending berdasarkan sell


   console.table(joindata);

   const buy_price = joindata[joindata.length-1].sell;
   const sell_price = joindata[0].buy;

   const buy_exchange = joindata[joindata.length-1].exchange;
   const sell_exchange = joindata[0].exchange;
   const margin = sell_price-buy_price;

   let EXC_1_OUT = amountin/buy_price;
   EXC_1_OUT = EXC_1_OUT-(EXC_1_OUT*0.2/100); //buy trading fee ;
   let EXC_2_OUT =  EXC_1_OUT*sell_price;
   EXC_2_OUT = EXC_2_OUT-(EXC_2_OUT*0.3/100); //sell trading fee;
   const EXC_MARGIN = EXC_2_OUT-amountin;
   const EXC_MARGIN_PR = EXC_MARGIN/amountin*100;

   const logMessage = `✅ Buy price ${buy_price} on ${buy_exchange} sell price ${sell_price} on ${sell_exchange} margin ${margin.toFixed(4)}\n` +
                      `✅ Amount trade: ${amountin} buy get ${EXC_1_OUT.toFixed(4)} sell and get ${EXC_2_OUT.toFixed(4)} back ${EXC_MARGIN_PR.toFixed(2)}%\n`;
   console.log(logMessage);
    
    if(EXC_MARGIN_PR > 0 ) {
        const tele_message = `✅ Pairs ${baseC}-${quoteC}\n✅ Buy on ${buy_exchange} buy price ${buy_price}\n✅ Sell on ${sell_exchange} sell price ${sell_price}\n✅ Margin ${EXC_2_OUT.toFixed(2)} (${EXC_MARGIN_PR.toFixed(2)}%)`;
        await sendTelegramMessage(tele_message);
    }     
}

async function btse_fetchAvailableMarkets() {
    try {
        const url = `https://api.btse.com/spot/api/v3.2/market_summary`;
        const response = await axios.get(url);
        const fdata =  response.data.map(m => m.symbol);
        return fdata;
    } catch (error) {
        console.error(`⚠️ Error fetching BTSE markets: ${error.message}`);
        return [];
    }
}

async function search() {
    const amountin = 50;
    const quoteC = "USDT";
    const pairs = await btse_fetchAvailableMarkets();
    const firstCoins = [...new Set(pairs.map(pair => pair.split('-')[0]))];
    const firstCoinsWithUSDT = [...new Set(
      pairs
        .filter(pair => pair.endsWith('-USDT')) // Keep only pairs ending in USDT
        .map(pair => pair.split('-')[0])        // Extract first coin name
    )];
    for (const base of firstCoinsWithUSDT) {
        console.log(`⚠️ Checking ${base} oportunity ...`);
        await Arbitrage(base, quoteC, amountin);
    }
}
search();

