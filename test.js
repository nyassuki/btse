const axios = require("axios");
require("dotenv").config();

const baseCoin = "USDT"; // Base currency
const velocityCheckTimeframe = 5000; // 5 seconds for velocity check
const velocityThreshold = 0.0005; // Minimum velocity for execution

// Telegram notification function
async function sendToTelegram(message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        await axios.post(url, { chat_id: chatId, text: message, parse_mode: "Markdown" });
        console.log("📩 Sent alert to Telegram!");
    } catch (error) {
        console.error(`⚠️ Telegram Error: ${error.message}`);
    }
}

// Fetch available trading pairs
async function fetchAvailableMarkets() {
    try {
        const url = `https://api.btse.com/spot/api/v3.2/market_summary`;
        const response = await axios.get(url);
        return response.data.map(m => m.symbol);
    } catch (error) {
        console.error(`⚠️ Error fetching BTSE markets: ${error.message}`);
        return [];
    }
}

// Fetch order book with logging
async function fetchOrderBook(pair) {
    try {
        console.log(`🔍 Fetching order book for ${pair}...`);
        const url = `https://api.btse.com/spot/api/v3.2/orderbook?symbol=${pair}`;
        const response = await axios.get(url);
        return response.data || null;
    } catch (error) {
        console.error(`⚠️ Error fetching order book for ${pair}: ${error.message}`);
        return null;
    }
}

// Generate possible triangular arbitrage routes
function generateTriangularRoutes(markets) {
    const routes = [];
    const baseMarkets = markets.filter(m => m.endsWith(baseCoin));

    for (const pair1 of baseMarkets) {
        const base1 = pair1.replace(`-${baseCoin}`, "");

        for (const pair2 of markets) {
            if (pair2.startsWith(base1) && !pair2.endsWith(baseCoin)) {
                const base2 = pair2.split("-")[1];

                for (const pair3 of markets) {
                    if (pair3.startsWith(base2) && pair3.endsWith(baseCoin)) {
                        routes.push([
                            { pair: pair1, base: base1, quote: baseCoin },
                            { pair: pair2, base: base2, quote: base1 },
                            { pair: pair3, base: base2, quote: baseCoin },
                        ]);
                    }
                }
            }
        }
    }
    return routes;
}

// Check order book velocity
async function checkVelocity(pair) {
    try {
        console.log(`📊 Checking order book velocity for ${pair}...`);
        const url = `https://api.btse.com/spot/api/v3.2/orderbook?symbol=${pair}`;
        const initialOrderBook = await axios.get(url);

        if (!initialOrderBook.data.buyQuote || !initialOrderBook.data.sellQuote) {
            console.log(`⚠️ No order book data for ${pair}`);
            return 0;
        }

        const initialTopBid = initialOrderBook.data.buyQuote[0].price;
        const initialTopAsk = initialOrderBook.data.sellQuote[0].price;

        await new Promise(resolve => setTimeout(resolve, velocityCheckTimeframe));

        const updatedOrderBook = await axios.get(url);
        if (!updatedOrderBook.data.buyQuote || !updatedOrderBook.data.sellQuote) {
            console.log(`⚠️ No updated order book data for ${pair}`);
            return 0;
        }

        const updatedTopBid = updatedOrderBook.data.buyQuote[0].price;
        const updatedTopAsk = updatedOrderBook.data.sellQuote[0].price;

        const bidVelocity = Math.abs(updatedTopBid - initialTopBid);
        const askVelocity = Math.abs(updatedTopAsk - initialTopAsk);

        const totalVelocity = bidVelocity + askVelocity;
        console.log(`✅ Velocity for ${pair}: ${totalVelocity.toFixed(6)}`);
        return totalVelocity;
    } catch (error) {
        console.error(`⚠️ Error checking velocity for ${pair}: ${error.message}`);
        return 0;
    }
}

// Find the most profitable arbitrage opportunity
async function findMostProfitableArbitrage() {
    console.log(`\n🔎 Scanning for triangular arbitrage opportunities on BTSE...\n`);

    const availableMarkets = await fetchAvailableMarkets();
    const triangularRoutes = generateTriangularRoutes(availableMarkets);

    console.log(`✅ Found ${triangularRoutes.length} possible arbitrage routes!\n`);

    if (triangularRoutes.length === 0) {
        console.log("❌ No triangular arbitrage routes found!");
        return;
    }

    let bestProfit = -Infinity;
    let bestRoute = null;
    let checkedPairs = 0;
    const totalPairs = triangularRoutes.length;

    for (const route of triangularRoutes) {
        checkedPairs++;
        console.log(`📊 Checking route ${checkedPairs}/${totalPairs}... Remaining: ${totalPairs - checkedPairs}`);

        const orderBooks = {};
        let allBooksAvailable = true;

        for (const trade of route) {
            orderBooks[trade.pair] = await fetchOrderBook(trade.pair);
            if (!orderBooks[trade.pair]) {
                allBooksAvailable = false;
                break;
            }
        }

        if (!allBooksAvailable) continue;

        const startAmount = 50;
        try {
            const buyBase1 = startAmount / orderBooks[route[0].pair].sellQuote[0].price;
            const buyBase2 = buyBase1 / orderBooks[route[1].pair].sellQuote[0].price;
            const finalUSDT = buyBase2 * orderBooks[route[2].pair].buyQuote[0].price;

            const profit = finalUSDT - startAmount;

            console.log(`🔄 Route: ${route[0].pair} → ${route[1].pair} → ${route[2].pair}`);
            console.log(`💰 Profit: ${profit.toFixed(6)} USDT ${profit > 0 ? "✅" : "❌"}\n`);

            if (profit > bestProfit) {
                bestProfit = profit;
                bestRoute = route;
            }
        } catch (error) {
            continue;
        }
    }

    if (bestProfit > 0 && bestRoute) {
        console.log(`\n🚀 **Most Profitable Arbitrage Found!**`);
        console.log(`💰 Profit: ${bestProfit.toFixed(6)} USDT`);

        console.log(`🔍 Checking order book velocity...`);
        const velocity1 = await checkVelocity(bestRoute[0].pair);
        const velocity2 = await checkVelocity(bestRoute[1].pair);
        const velocity3 = await checkVelocity(bestRoute[2].pair);

        console.log(`📊 Velocity Results:`);
        console.log(`   - ${bestRoute[0].pair}: ${velocity1.toFixed(6)}`);
        console.log(`   - ${bestRoute[1].pair}: ${velocity2.toFixed(6)}`);
        console.log(`   - ${bestRoute[2].pair}: ${velocity3.toFixed(6)}\n`);
        if (velocity1 < velocityThreshold || velocity2 < velocityThreshold || velocity3 < velocityThreshold) {
            console.log(`❌ Low velocity detected! Trading might not be feasible.`);
        } else {
            console.log(`✅ Sufficient velocity! Trading is feasible.`);
            const message = `🚀 *Arbitrage Opportunity Found!*\n` +
                            `💰 *Profit:* ${bestProfit.toFixed(6)} USDT\n` +
                            `🔹 *Route:* ${bestRoute[0].pair} → ${bestRoute[1].pair} → ${bestRoute[2].pair}\n` +
                            `📊 *Remaining Routes:* ${totalPairs - checkedPairs}\n` +
                            `✅ Trading is feasible!`;
            await sendToTelegram(message);
        }
    } else {
        console.log(`❌ No profitable arbitrage found.`);
    }
}

findMostProfitableArbitrage();
