/**
 * File Name: trump_tower.js
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
        return rates;
    } catch (error) {
        console.error("❌ Error fetching exchange rates:", error);
    }
}

async function FindArbitrage(tradingAmount) {
    const start = process.hrtime();
    console.clear();
    const pair1 = "BANANA-USDT";
    const pair2 = "TOWER-USDT";
    console.log(`🚀 Trading oportunity of ${pair1} AND ${pair2}\n`);
    const pairArray_1 = pair1.split("-"); // Splitting by "-"
    const pairArray_2 = pair2.split("-"); // Splitting by "-"

    const pair1_data = await getPrice(pairArray_1[0], pairArray_1[1]);
    const pair2_data = await getPrice(pairArray_2[0], pairArray_2[1]);

    const pair_1_buy_price = parseFloat(pair1_data[1].rate);
    const pair_1_sell_price = parseFloat(pair1_data[0].rate);
    const pair_1_buy_exchange = pair1_data[1].exchange;
    const pair_1_sell_exchange = pair1_data[0].exchange;

    const pair1_sell_exchangeModule = exchanges[pair_1_sell_exchange];
    const pair1_buy_exchangeModule = exchanges[pair_1_buy_exchange];


    const pair_2_buy_price = parseFloat(pair2_data[1].rate);
    const pair_2_sell_price = parseFloat(pair2_data[0].rate);
    const pair_2_buy_exchange = pair2_data[1].exchange;
    const pair_2_sell_exchange = pair2_data[0].exchange;

    const pair2_sell_exchangeModule = exchanges[pair_2_sell_exchange];
    const pair2_buy_exchangeModule = exchanges[pair_2_buy_exchange];


    const start_USDT = tradingAmount;
    //start with trading par1 buy exchange;
    const pair_1_tradingFee_buy = await pair1_buy_exchangeModule.getTradingFeeRate(pairArray_1[0], "USDT");
    const USDT_IN_TRADING_FEE = tradingAmount - (tradingAmount*pair_1_tradingFee_buy.makerFee/100);
    const TRUMP_IN = parseFloat(USDT_IN_TRADING_FEE/pair_1_buy_price); //buy in buy echange
    
    console.log(`🚀 ${pair1} TRADING`);
    console.log(`   - SPOT Trading ${pairArray_1[0]}-${pairArray_1[1]} on BTSE (BUY) WITH ${tradingAmount.toFixed(4)} and get ${TRUMP_IN.toFixed(4)} ${pairArray_1[0]}`);
    const TRUMP_IN_COINEX = TRUMP_IN-parseFloat(await pair1_buy_exchangeModule.WithdrawFee(pairArray_1[0])); //trump in coinex
    console.log(`   - Withdraw ${pairArray_1[0]} to COINEX and get ${TRUMP_IN_COINEX.toFixed(4)} ${pairArray_1[0]}`);

    const pair_1_tradingFee_sell = await pair1_sell_exchangeModule.getTradingFeeRate(pairArray_1[0], pairArray_1[1]);
    const USDT_BACK_COINEX = (TRUMP_IN_COINEX-(TRUMP_IN_COINEX*pair_1_tradingFee_sell.makerFee/100))*pair_1_sell_price; //sell on COINEX
    const pair_1_profit = USDT_BACK_COINEX-tradingAmount;
    const pair_1_profit_pr = pair_1_profit/tradingAmount*100;

    console.log(`   ✅ SPOT Trading ${pairArray_1[0]}-${pairArray_1[1]} on COINEX (SELL) WITH ${TRUMP_IN_COINEX.toFixed(4)} ${pairArray_1[0]} and get ${USDT_BACK_COINEX.toFixed(4)} ${pairArray_1[1]}`);
    console.log(`   ✅ ${pair1} profit ${pair_1_profit.toFixed(4)} USDT (${pair_1_profit_pr.toFixed(4)}%)\n`);

    console.log(`🚀 ${pair2} TRADING`);
    //pair2 trading
    const pair_2_tradingFee_buy = await pair2_buy_exchangeModule.getTradingFeeRate(pairArray_2[0], pairArray_2[1]);
    //buy tower
    const TOWER_IN = (USDT_BACK_COINEX-(USDT_BACK_COINEX*pair_2_tradingFee_buy.makerFee/100))/pair_2_buy_price;
    console.log(`   - SPOT Trading ${pairArray_2[0]}-${pairArray_2[1]} on COINEX (BUY) WITH ${USDT_BACK_COINEX.toFixed(4)} ${pairArray_2[1]} and get ${TOWER_IN.toFixed(4)} ${pairArray_2[0]}`);
    //withdraw tower
    const TOWER_BTSE_IN = TOWER_IN-(await pair2_buy_exchangeModule.WithdrawFee(pairArray_2[0]));
    console.log(`   - Withdraw ${pairArray_2[0]} to BTSE and get ${TOWER_BTSE_IN.toFixed(4)} ${pairArray_2[0]}`);

    const pair_2_tradingFee_sell = await pair2_sell_exchangeModule.getTradingFeeRate(pairArray_2[0], pairArray_2[1]);
    const FINAL_USDT = (TOWER_BTSE_IN-(TOWER_BTSE_IN*pair_2_tradingFee_sell.makerFee/100))*pair_2_sell_price;
    const pair_2_profit = FINAL_USDT-USDT_BACK_COINEX;
    const pair_2_profit_pr = pair_2_profit/USDT_BACK_COINEX*100;
    console.log(`   ✅ SPOT Trading ${pairArray_2[0]}-${pairArray_2[1]} on BTSE (SELL) WITH ${TOWER_BTSE_IN.toFixed(4)} ${pairArray_2[0]} and get ${FINAL_USDT.toFixed(4)} ${pairArray_2[1]}`);
    console.log(`   ✅ ${pair2} profit ${pair_2_profit.toFixed(4)} USDT (${pair_2_profit_pr.toFixed(4)}%)\n`);


    const PROFIT =  FINAL_USDT-tradingAmount;
    const PR_PROFIT = PROFIT/tradingAmount*100;
    console.log(`💰 Final profit ${PROFIT.toFixed(4)} ${pairArray_2[1]} (${PR_PROFIT.toFixed(4)}%)\n`);
    const end = process.hrtime(start);
    console.log(`⏰ Script execution time: ${end[0]}s and ${end[1] / 1e6}ms\n`);
  
}

FindArbitrage(10);