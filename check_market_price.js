/**
 * File Name: check_market_price.js
 * Author: Yassuki
 * Created Date: 2025-03-14
 * Description: 
 *   A Node.js script that detects and executes arbitrage opportunities 
 *   between BTSE and CoinEx exchanges. It fetches price data, calculates 
 *   trading fees, and facilitates fund transfers between exchanges.
 */
const fs = require('fs');
require("dotenv").config(); // Load environment variables
const axios = require("axios");
const readline = require("readline");
const exchanges = {
    btse: require("./exchange/btse.js"),
    coinex: require("./exchange/coinex.js"),
};
const wallet_config = require("./libs/wallet_config.js");
const coins = require("./libs/coins.js");

const wallet_address = wallet_config.wallet_production;
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

/**
 * Converts token names for compatibility with CoinEx's naming conventions.
 * @param {string} token - The input token symbol.
 * @returns {string} - The CoinEx-compatible token symbol.
 */
function convertTokenName(token) {
    const tokenMap = {
        TRUMP: "MAGATRUMP",
        TRUMPSOL: "TRUMP",
        TRAC: "TRACBRC",
    };
    return tokenMap[token] || token; // Return mapped name or original if not found.
}

/**
 * Fetches the latest buy/sell prices and trading fees from both exchanges.
 * @param {string} fromToken - The token to trade (e.g., "XMR").
 * @param {string} toToken - The target token (e.g., "USDT").
 * @returns {Promise<{rates: Object[], tradingFees: Object[]}>} - Sorted price data and trading fees.
 */
async function getPrice(fromToken, toToken) {
    try {
        const fromTokenCoinex = convertTokenName(fromToken.toUpperCase());

        const [btseRate, coinexRate] = await Promise.all([
            exchanges.btse.getPrice(fromToken, toToken).catch(() => null),
            exchanges.coinex.getPrice(fromTokenCoinex, toToken).catch(() => null),
        ]);
        const [btseFee, coinexFee] = await Promise.all([
            exchanges.btse.getTradingFeeRate(fromToken, toToken).catch(() => null),
            exchanges.coinex.getTradingFeeRate(fromTokenCoinex, toToken).catch(() => null),
        ]);

        const rates = [{
                exchange: "btse",
                rate: btseRate?.price
            },
            {
                exchange: "coinex",
                rate: coinexRate?.price
            },
        ].filter((rate) => rate.rate);

        const tradingFees = [{
                exchange: "btse",
                tradingFee: btseFee?.makerFee || 0
            },
            {
                exchange: "coinex",
                tradingFee: coinexFee?.makerFee || 0
            },
        ];

        rates.sort((a, b) => b.rate - a.rate); // Sort by highest rate first.
        return {
            rates,
            tradingFees
        };
    } catch (error) {
        console.error("❌ Error fetching exchange rates:", error);
    }
}

async function checkMarket(fromToken, amount) {
    try {
        const start = process.hrtime();
        //console.clear();
        const toToken = "USDT";
        console.log(`\n✅ Pair ${fromToken}-${toToken} amount: ${amount}`);

        const GPrice = await getPrice(fromToken, toToken);
        const sell_exchangeName = GPrice.rates[0].exchange; // "btse" or "coinex"
        const buy_exchangeName = GPrice.rates[1].exchange; // "btse" or "coinex"

        const sellPrice = GPrice.rates[0].rate;
        const buyPrice = GPrice.rates[1].rate;

        const sell_exchangeModule = exchanges[sell_exchangeName];
        const buy_exchangeModule = exchanges[buy_exchangeName];
        const buy_on_buyexchange = (amount/buyPrice);
        const FinalBuyResult = parseFloat(buy_on_buyexchange)-(parseFloat(buy_on_buyexchange)*0.2/100);

        const buy_on_sellexchange = amount/sellPrice;
        console.log(`   - Buy on ${buy_exchangeName} and sell on ${sell_exchangeName}`);
        console.log(`   - ${buy_exchangeName} price ${buyPrice} GET ${FinalBuyResult.toFixed(4)}`)
        console.log(`   - ${sell_exchangeName} price ${sellPrice} GET ${buy_on_sellexchange.toFixed(4)}\n`)
        //console.log(parseFloat(buy_on_buyexchange)*0.2/100);

        const tokenA_inSell = FinalBuyResult- (await buy_exchangeModule.WithdrawFee(fromToken));
        const sell_result = tokenA_inSell*sellPrice;
        const Final_sell_result = parseFloat(sell_result)-(parseFloat(sell_result)*0.3/100);
        const USDT_Back = parseFloat(Final_sell_result)-2.5;
        const pnl = USDT_Back-amount;
        const pnl_p = pnl/amount*100;

        console.log(`✅ Final result is : ${Final_sell_result.toFixed(4)}`);
        console.log(`   - USDT Back is ${USDT_Back.toFixed(4)}`);
        if(pnl > 0 ) {
            console.log(`   - Profit : ${pnl.toFixed(4)} (${pnl_p.toFixed(2)}%)\n`);
            sendTelegramMessage(`${fromToken} - Profit : ${pnl.toFixed(4)} (${pnl_p.toFixed(2)}%)`);
        } else if(pnl <= 0 ) {
            console.log(`⚠️  Loss : ${pnl.toFixed(2)} (${pnl_p.toFixed(2)*-1}%)\n`);
        }
        const end = process.hrtime(start);
        console.log(`⏰ Script execution time: ${end[0]}s and ${end[1] / 1e6}ms\n`);
    } catch(error) {
        console.log(error);
    }
}


async function check() {
    const args = process.argv.slice(2);
    const amount = args[0] || 10;
    const fromToken = (args[1] || "TRUMP").toUpperCase();
    checkMarket(fromToken,amount);
}

async function Scan() {
      const availableCurrency = coins.commonQuotes2;
      //console.log(availableCurrency);
      let totalTokens = availableCurrency.length;
      for (const fromToken of availableCurrency) {
        console.log(`✅ Checking opportunity: ${fromToken.toUpperCase()}-USDT | Tokens left to scan: ${totalTokens}`);
        await checkMarket(fromToken.toUpperCase(),10);
      }
}
check();
