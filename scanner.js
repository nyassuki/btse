/**
 * File Name: scanner.js v.2
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

async function FindArbitrage(tradingAmount,fromToken, scanOnly=true) {
    const toToken = "USDT";
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:.T]/g, '').slice(0, 14); // Format: YYYYMMDDHHMMSS
    const fileName = `profitable_${timestamp}.txt`;

    const GPrice = await getPrice(fromToken, toToken);
    if (!GPrice || !GPrice.rates || GPrice.rates.length < 2) {
        console.error("❌ Not enough rate data to execute arbitrage.");
        return;
    }

    const sell_exchangeName = GPrice.rates[0].exchange; // "btse" or "coinex"
    const buy_exchangeName = GPrice.rates[1].exchange; // "btse" or "coinex"

    const sellPrice = GPrice.rates[0].rate;
    const buyPrice = GPrice.rates[1].rate;

    const sell_exchangeModule = exchanges[sell_exchangeName];
    const buy_exchangeModule = exchanges[buy_exchangeName];
    
    const arbitrageMessage = `🚀 (${now.toLocaleString()}) Potential arbitrage (${fromToken}-${toToken}) ${tradingAmount} ${toToken}:\n`+
                                `   🛒 Buy on ${buy_exchangeName} rate: ${buyPrice}\n`+
                                `   💵 Sell on ${sell_exchangeName} rate: ${sellPrice}`;

    console.log(arbitrageMessage);

    const tradingFee = await buy_exchangeModule.getTradingFeeRate(fromToken, toToken);
    const tokenA_in_buy_exchange = parseFloat(tradingAmount-(tradingFee.makerFee/100*tradingAmount))/buyPrice;
    const tokenA_in_sell_exchange = tokenA_in_buy_exchange - parseFloat(await buy_exchangeModule.WithdrawFee(fromToken));
    const tokenB_out_sell_exchange = tokenA_in_sell_exchange*sellPrice;
    const tokenB_in_buy_exchange = tokenB_out_sell_exchange-parseFloat(await sell_exchangeModule.WithdrawFee(toToken));
    const final_profit_lost_in_toToken= parseFloat(tokenB_in_buy_exchange)-parseFloat(tradingAmount);
    const final_profit_lost_in_procentage = parseFloat(final_profit_lost_in_toToken)/tradingAmount*100;

    //get toToken balance in buy echange
    const getToTokenBalance = await buy_exchangeModule.getBalanceByAsset(toToken);
    const toTokenBalance = getToTokenBalance.free;

    const potentionArbitrage = `\n💰 Potential profit (or loss): ${final_profit_lost_in_toToken.toFixed(4)} ${toToken} ( ${final_profit_lost_in_procentage.toFixed(2)}% )`;
    console.log(potentionArbitrage);
    
    if(parseInt(process.env.PROFIT_THRESHOLD) < parseFloat(final_profit_lost_in_toToken)) {
        await sendTelegramMessage(`${arbitrageMessage}\n${potentionArbitrage}`);
        if(scanOnly==true) {
            console.log(`⏳ Scan only go to next scan`);
        } else {
            console.log(`💰 Profitable trading, start trading procedure :`)
            console.log(`   - Excute trading in ${buy_exchangeName} ~ SPOT ~ Position BUY :`);
            const BuySize = tokenA_in_buy_exchange;
            const buy_command = await buy_exchangeModule.spotTradeTokens(fromToken, toToken, "BUY",BuySize,tradingAmount);
            if(buy_command.code!=-1) {
                // get wallet address on sell exchange
                const with_dest_addres_sell = await sell_exchangeModule.getWalletAddress(fromToken, "ERC20");
                //get fromToken balance to withdraw
                const getfromTOkenBalance = await buy_exchangeModule.getBalanceByAsset(fromToken);
                //withdraw to sell exchange
                const withdraw_from_buy_balance = await buy_exchangeModule.withdrawToken(fromToken, getfromTOkenBalance.free, with_dest_addres_sell.address, "ERC20");
                //wait till balance transfered (approx 3 mins)
                let TradeableBalance = 0; // Initialize tradeable balance
                do {
                    let getTradeableBalance = await sell_exchangeModule.getBalanceByAsset(fromToken);
                    if (TradeableBalance <= 0) {
                        console.log(`⏳ Tradeable ${fromToken} balance: ${TradeableBalance.toFixed(4)} - Waiting for balance to update...`);
                        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retrying
                    }
                } while (TradeableBalance <= 0);

                //sell exchange

                const SellSize = TradeableBalance/sellPrice; // sell amount is equal to total fromToken asset in sell exchange
                const sell_command = await sell_exchangeModule.spotTradeTokens(fromToken, toToken, "SELL",SellSize,TradeableBalance);
                if(sell_command.code != -1) {
                    //sell success then witdraw back to Buy exchange for next trading round
                    //get toToken balance :
                    let gettoTokenbalanceback = await sell_exchangeModule.getBalanceByAsset(toToken);
                    // get wallet address on sell exchange
                    const with_dest_addres_buy = await buy_exchangeModule.getWalletAddress(toToken, "ERC20");
                    //withdraw to sell exchange, withdraw all toToken balance in sell exchange 
                    const withdraw_from_sell_balance = await sell_exchangeModule.withdrawToken(fromToken, gettoTokenbalanceback.free, with_dest_addres_buy.address, "ERC20");
                    //done get back totToken in Buy exchange
                } else {
                    console.log(`   - Trading failed : ${sell_command.msg} (${TradeableBalance} ${fromToken})\n`);
                }
            } else {
                console.log(`   - Trading failed : ${buy_command.msg} (${toTokenBalance} ${toToken})\n`);
            }
        }
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

async function FoundArbitrage() {
    console.clear(); // Clears the console for a clean output on each run
    console.log("✅ Start scanning....");
    try {
        // Get command-line arguments or set default values
        const args = process.argv.slice(2);
        const amount = args[0] || 10; // Default: 10
        const fromToken = (args[1] || "XMR").toUpperCase(); // Default: "XMR"
        const scanOnly = args[2] || true;

        while (true) {
            const start = process.hrtime();
            await FindArbitrage(amount, fromToken,scanOnly);
            const end = process.hrtime(start);
            console.log(`⏰ Arbitrage execution time: ${end[0]}s and ${end[1] / 1e6}ms`);
            console.log(`\n🔄 Rechecking arbitrage in 10 seconds...`);
            await delay(10000); // Delay to prevent API rate limits
        }
    } catch (err) {
        console.error("⚠️ Error in FoundArbitrage function:", err);
    }
}

async function ScanArbitrage() {
    try {
        // Fetch all available tokens that can be converted
        //const availableCurrency = await coinex.AvailableCurrency("CONVERT");
        const availableCurrency = coins.commonQuotes2;
        console.log(availableCurrency);

        let totalTokens = availableCurrency.length;

        console.log(`✅ Total tokens available for conversion: ${totalTokens}`);

        // Iterate through each token to check arbitrage opportunities
        for (const fromToken of availableCurrency) {
            totalTokens--;
            const toToken = "USDT"; // Target trading pair

            console.log(`✅ Checking opportunity: ${fromToken.toUpperCase()}-${toToken.toUpperCase()} | Tokens left to scan: ${totalTokens}`);

            // Check for arbitrage opportunities with a fixed trading amount (e.g., 10 units)
            await FindArbitrage(100,fromToken.toUpperCase());

            // Delay execution to avoid excessive API requests (ensure `delay()` is defined)
            await delay(2000);
        }
    } catch (error) {
        console.error(`⚠️ Error scanning arbitrage opportunities: ${error.message}`);
    }
}

async function main() {
    //await ScanArbitrage();
    await FoundArbitrage();
}
main();
 