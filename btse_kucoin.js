/**
 * File Name: cex_arbitrage_btse_kucoin_bot.js
 * Author: Yassuki
 * Created Date: 2025-03-14
 * Description: 
 *   A Node.js script that detects and executes arbitrage opportunities 
 *   between BTSE and kucoin exchanges. It fetches price data, calculates 
 *   trading fees, and facilitates fund transfers between exchanges.
 */

require("dotenv").config(); // Load environment variables
const axios = require("axios");
const readline = require('readline');
const btse = require("./exchange/btse.js");
const kucoin = require("./exchange/kucoin.js");
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
        const fromTokenkucoin = convertTokenName(fromToken.toUpperCase());

        const [btseRate, kucoinRate] = await Promise.all([
            btse.getPrice(fromToken, toToken).catch(() => null),
            kucoin.getPrice(fromTokenkucoin, toToken).catch(() => null),
        ]);
        const [btseFee, kucoinFee] = await Promise.all([
            btse.getTradingFeeRate(fromToken, toToken).catch(() => null),
            kucoin.getTradingFeeRate(fromTokenkucoin, toToken).catch(() => null),
        ]);

        const rates = [
            { exchange: "btse", rate: btseRate?.price },
            { exchange: "kucoin", rate: kucoinRate?.price },
        ].filter(rate => rate.rate);

        const tradingFees = [
            { exchange: "btse", tradingFee: btseFee?.makerFee || 0 },
            { exchange: "kucoin", tradingFee: kucoinFee?.makerFee || 0 },
        ];

        rates.sort((a, b) => b.rate - a.rate); // Sort by highest rate first.
        return { rates, tradingFees };
    } catch (error) {
        console.error("❌ Error fetching exchange rates:", error);
    }
}

/**
 * Creates a delay for asynchronous operations.
 *
 * This function returns a Promise that resolves after the specified time (in milliseconds).
 * Useful for preventing API rate limits, pacing function execution, or adding timeouts.
 *
 * @param {number} ms - The duration to delay in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified time.
 */
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retrieves the withdrawal fee for a given token on BTSE.
 * 
 * @param {string} token - The token symbol (e.g., "TRUMP", "USDT").
 * @returns {number} - The withdrawal fee in the token's units.
 */
function BTSEWithdrawFee(token) {
    let Fee = 0; // Default fee value

    switch (token) {
        case "TRUMP":
            Fee = 4.54; // Fixed withdrawal fee for TRUMP
            break;
        case "USDT":
            Fee = 2; // Fixed withdrawal fee for USDT
            break;
        default:
            Fee = 0.005; // Default withdrawal fee for other tokens
            break;
    }

    return Fee;
}


async function ArbitrageOpportunity(TokenA, TokenB, TradingAmount) {
	const GPrice = await getPrice(TokenA, TokenB);
    if (GPrice.rates.length < 2) return console.log("   ⚠️  Not enough data for arbitrage\n");
    const SellOn = GPrice.rates[0];
    const BuyOn = GPrice.rates[1];

    const BuyPrice = parseFloat(BuyOn.rate);
    const SellPrice = parseFloat(SellOn.rate);

    const BuyExchange = BuyOn.exchange;
    const SellExchange = SellOn.exchange;

    const BuyWithdrawFee = BTSEWithdrawFee(TokenA);
    const SellWithdrawFee = 2.5;

    const BuyTradingFee = GPrice.tradingFees.find(e => e.exchange === BuyOn.exchange)?.tradingFee || 0;
    const SellTradingFee = GPrice.tradingFees.find(e => e.exchange === SellOn.exchange)?.tradingFee || 0;

    const tradeableBuyAmount = TradingAmount-(BuyTradingFee/100*TradingAmount);
    const TokenA_AmountOut = tradeableBuyAmount/BuyPrice;

    const TokenA_AmountIN = TokenA_AmountOut-BuyWithdrawFee;
    const tradeableSellAmount = TokenA_AmountIN-(SellTradingFee/100*TokenA_AmountIN);
    const TokenB_AmountOUT = tradeableSellAmount*SellPrice;
    const FinalTokenBOut = TokenB_AmountOUT-SellWithdrawFee;
    const PNL = FinalTokenBOut-TradingAmount;
    const margin_proc = (PNL/TradingAmount)*100;
    let resultMessage = `\n✅ Arbitrage opportunity for ${TokenA} ${TokenB} ! \n` +
            `   💰 Trading Amount: ${TradingAmount} ${TokenB}\n` +
            `   🟢 Buy ${TokenA} on ${BuyOn.exchange} at ${BuyPrice.toFixed(4)}\n` +
            `   🔴 Sell ${TokenA} on ${SellOn.exchange} at ${SellPrice.toFixed(4)}\n` +
            `   💵 Estimated Profit: ${PNL.toFixed(4)} ${TokenB} (${margin_proc.toFixed(2)} %)\n`;
    console.log(resultMessage);

    const arbitrageProcessMsg = `🔢 Arbitrage FLow :\n   🔢 Convert ${TradingAmount} ${TokenB} -> ${TokenA}, receive: ${TokenA_AmountIN.toFixed(4)} ${TokenA} on ${BuyExchange} (BUY, Fee: ${BuyTradingFee}%)\n` +
	`   🔁 Transfer ${TokenA} to ${SellExchange} (Fee: ${BuyWithdrawFee} ${TokenA})\n` +
	`   🔄 Convert back ${TokenA} -> ${TokenB}, receive: ${TokenB_AmountOUT.toFixed(4)} on ${SellExchange} (SELL, Fee: ${SellTradingFee}%)\n` +
	`   🔁 Transfer back ${TokenB} to ${BuyExchange} (Fee: ${SellWithdrawFee} ${TokenB})\n` +
	`   💰 Final ${TokenB} amount : ${FinalTokenBOut.toFixed(4)}, PNL : ${PNL.toFixed(4)}\n` +
	`   ✅ Oprtunity found with profit ${PNL.toFixed(4)} ${TokenB} (${margin_proc.toFixed(2)} %)`;
	if(PNL > 1) {
		console.log(arbitrageProcessMsg);
		if(process.env.TELEGRAM_MSG=="YES") {
     		await sendTelegramMessage(resultMessage);
     	}
	} else {
		console.log(`   ❌ Arbitrage opportunity not found !\n`);
	}
}


/**
 * Executes a trade on BTSE.
 * 
 * @param {string} TokenA - The base token to be traded (e.g., "BTC").
 * @param {string} TokenB - The quote token (e.g., "USDT").
 * @param {number} amount - The amount of TokenB to trade.
 * @param {string} side - The trade side ("buy" or "sell").
 * @returns {Promise<Object>} - The response from the BTSE API.
 */
async function TradeOnBTSE(TokenA, TokenB, side,amount) {
    try {
        // Get available balance for TokenB
        const balanceData = await btse.getBalanceByAsset(TokenB);
        const balance = balanceData?.free || 0;

        // Initialize buy size variable
        let BuySize = 0;

        // Fetch price details from BTSE
        const priceData = await getPrice(TokenA, TokenB);
        if (!priceData || !priceData.rates || priceData.rates.length < 2) {
            throw new Error("Failed to retrieve valid price data.");
        }

        const BuyOn = priceData.rates[1]; // Get buy price from BTSE
        const BuyPrice = BuyOn.rate;

        // Determine trade amount based on the environment variable
        if (process.env.TRADING_AMONT_BY == "balance") {
            BuySize = balance / BuyPrice;
        } else if (process.env.TRADING_AMONT_BY == "input") {
            BuySize = amount / BuyPrice;
        } else {
            throw new Error("❌ Invalid TRADING_AMOUNT_BY setting. Use 'balance' or 'input'.\n");
        }

        // Execute the trade on BTSE
        const BuyAction = await btse.spotTradeTokens(TokenA, TokenB, side, BuySize.toFixed(2));
        //console.log(BuyAction);
        return BuyAction; // Return API response
    } catch (error) {
        console.error("❌ Trade execution failed:", error.message + "\n");
        return { success: false, error: error.message };
    }
}

async function FoundArbitrage() {
    console.clear(); // Clears the console for a clean output on each run
    try {
        // Get command-line arguments or set default values
        const args = process.argv.slice(2);
        const fromToken = (args[0] || "XMR").toUpperCase(); // Default: "XMR"
        //const toToken = (args[1] || "USDT").toUpperCase(); // Default: "USDT"
        const amount = args[1] || 10; // Default: 10
        const toToken = "USDT";
        console.log(`🚀 Starting arbitrage scan: ${fromToken} → ${toToken} (Amount: ${amount} ${toToken})`);

        while (true) {
            await ArbitrageOpportunity(fromToken, toToken, amount);
            console.log(`\n🔄 Rechecking arbitrage in 10 seconds...`);
            await delay(10000); // Delay to prevent API rate limits
        }
    } catch (err) {
        console.error("⚠️ Error in FoundArbitrage function:", err);
    }
}


main();

async function main() {
	FoundArbitrage();
}