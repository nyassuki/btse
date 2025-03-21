/**
 * File Name: cex_arbitrage_btse_coinex_bot.js
 * Author: Yassuki
 * Created Date: 2025-03-14
 * Description: 
 *   A Node.js script that detects and executes arbitrage opportunities 
 *   between BTSE and CoinEx exchanges. It fetches price data, calculates 
 *   trading fees, and facilitates fund transfers between exchanges.
 */

require("dotenv").config(); // Load environment variables
const axios = require("axios");
const readline = require('readline');
const btse = require("./exchange/btse.js");
const coinex = require("./exchange/coinex.js");
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
            btse.getPrice(fromToken, toToken).catch(() => null),
            coinex.getPrice(fromTokenCoinex, toToken).catch(() => null),
        ]);
        const [btseFee, coinexFee] = await Promise.all([
            btse.getTradingFeeRate(fromToken, toToken).catch(() => null),
            coinex.getTradingFeeRate(fromTokenCoinex, toToken).catch(() => null),
        ]);

        const rates = [
            { exchange: "btse", rate: btseRate?.price },
            { exchange: "coinex", rate: coinexRate?.price },
        ].filter(rate => rate.rate);

        const tradingFees = [
            { exchange: "btse", tradingFee: btseFee?.makerFee || 0 },
            { exchange: "coinex", tradingFee: coinexFee?.makerFee || 0 },
        ];

        rates.sort((a, b) => b.rate - a.rate); // Sort by highest rate first.
        return { rates, tradingFees };
    } catch (error) {
        console.error("❌ Error fetching exchange rates:", error);
    }
}

/**
 * Withdraws a specified amount of a token from CoinEx to BTSE.
 * @param {string} token - The token to withdraw.
 * @param {number} amount - The withdrawal amount.
 * @param {string} chain - The blockchain network (default: "ERC20").
 * @returns {Promise<void>} - Logs the withdrawal response.
 */
async function withdrawToBTSE(token, amount, chain = "ERC20") {
    try {
        const coinexToken = convertTokenName(token);
        const destinationAddress = await getBTSEWalletAddress(token, chain);
        const response = await coinex.withdrawToken(coinexToken, amount, destinationAddress, chain);
        console.log(response);
    } catch (error) {
        console.error("❌ Error withdrawing to BTSE:", error);
    }
}

/**
 * Withdraws a specified amount of a token from BTSE to CoinEx.
 * @param {string} token - The token to withdraw.
 * @param {number} amount - The withdrawal amount.
 * @param {string} chain - The blockchain network (default: "ERC20").
 * @returns {Promise<void>} - Logs the withdrawal response.
 */
async function withdrawToCoinEx(token, amount, chain = "ERC20") {
    try {
        const coinexToken = convertTokenName(token);
        const destinationAddress = await getCoinExWalletAddress(coinexToken, chain);
        const response = await btse.withdrawToken(token, amount, destinationAddress, chain);
        console.log(response);
    } catch (error) {
        console.error("❌ Error withdrawing to CoinEx:", error);
    }
}

/**
 * Retrieves the deposit wallet address for a token on CoinEx.
 * @param {string} token - The token symbol.
 * @param {string} chain - The blockchain network (default: "ERC20").
 * @returns {Promise<string>} - The deposit address.
 */
async function getCoinExWalletAddress(token, chain = "ERC20") {
    try {
        return (await coinex.getWalletAddress(token, chain)).address;
    } catch (error) {
        console.error("❌ Error fetching CoinEx wallet address:", error);
    }
}

/**
 * Retrieves the deposit wallet address for a token on BTSE.
 * @param {string} token - The token symbol.
 * @param {string} chain - The blockchain network (default: "ERC20").
 * @returns {Promise<string>} - The deposit address.
 */
async function getBTSEWalletAddress(token, chain = "ERC20") {
    try {
        return (await btse.getWalletAddress(token, chain)).address;
    } catch (error) {
        console.error("❌ Error fetching BTSE wallet address:", error);
    }
}


/**
 * Prompts the user for confirmation before executing a trade.
 */
function getUserConfirmation() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question("\n⚠️  System running on manual mode, confirm if you want to proceed with this trade? (yes/no): ", (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === "y");
        });
    });
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

/**
 * Checks for arbitrage opportunities and calculates potential profit.
 * @param {string} TokenA - The token being traded (e.g., "XMR").
 * @param {string} TokenB - The target token (e.g., "USDT").
 * @param {number} TradingAmount - The amount to trade in TokenB.
 */
async function ArbitrageOpportunity(TokenA, TokenB, TradingAmount) {
	const fromTokenCoinex = convertTokenName(TokenA.toUpperCase());
	//console.log(`\n🚀 Start finding ${TokenA}-${TokenB} arbitrage in ${process.env.OPORTUNITY_FIND} mode, amount ${TradingAmount} ${TokenB} `);
	const GPrice = await getPrice(TokenA, TokenB);
    if (GPrice.rates.length < 2) return console.log("   ⚠️  Not enough data for arbitrage\n");

    const SellOn = GPrice.rates[0];
    const BuyOn = GPrice.rates[1];

    const BuyPrice = BuyOn.rate;
    const SellPrice = SellOn.rate;

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

	const arbitrageProcessMsg = `🔢 Arbitrage FLow :\n   🔢 Convert ${TradingAmount} ${TokenB} -> ${TokenA}, receive: ${TokenA_AmountIN.toFixed(4)} ${TokenA} on ${BuyExchange} (BUY, Fee: ${BuyTradingFee}%)\n` +
	`   🔁 Transfer ${TokenA} to ${SellExchange} (Fee: ${BuyWithdrawFee} ${TokenA})\n` +
	`   🔄 Convert back ${TokenA} -> ${TokenB}, receive: ${TokenB_AmountOUT.toFixed(4)} on ${SellExchange} (SELL, Fee: ${SellTradingFee}%)\n` +
	`   🔁 Transfer back ${TokenB} to ${BuyExchange} (Fee: ${SellWithdrawFee} ${TokenB})\n` +
	`   💰 Final ${TokenB} amount : ${FinalTokenBOut.toFixed(4)}, PNL : ${PNL.toFixed(4)}\n` +
	`   ✅ Oprtunity found with profit ${PNL.toFixed(4)} ${TokenB} (${margin_proc.toFixed(2)} %)`;

	let resultMessage = `\n✅ Arbitrage opportunity for ${TokenA} ${TokenB} ! \n` +
            `   💰 Trading Amount: ${TradingAmount} ${TokenB}\n` +
            `   🟢 Buy ${TokenA} on ${BuyOn.exchange} at ${BuyPrice.toFixed(4)}\n` +
            `   🔴 Sell ${TokenA} on ${SellOn.exchange} at ${SellPrice.toFixed(4)}\n` +
            `   💵 Estimated Profit: ${PNL.toFixed(4)} ${TokenB} (${margin_proc.toFixed(2)} %)\n`;
    console.log(resultMessage);
    if(PNL > 1) {
		
		console.log(arbitrageProcessMsg);
		if(process.env.TELEGRAM_MSG=="YES") {
     		await sendTelegramMessage(resultMessage);
     	}
     	//get trading confirmation if manual mode
        if (process.env.OPORTUNITY_FIND === "manual") {
            const userConfirmed = await getUserConfirmation();
            if (!userConfirmed) return console.log("   ❌ Trade Canceled.\n");
        }

        //swap Token on BuyExchange (SPOT)
        const BUYtrade = await TradeOnBTSE(TokenA, TokenB, "BUY",TradingAmount);
        if(BUYtrade.code != -1) {
        	const GetBTSEBalance = await btse.getBalanceByAsset(TokenA);
        	await withdrawToCoinEx(TokenA, GetBTSEBalance.free, chain);
        	await TradeOnCoinex(TokenA, TokenB, "SELL");

        	const GetCOINEXBalance = await coinex.getBalanceByAsset(TokenB);
        	await withdrawToBTSE(TokenB, GetCOINEXBalance.free); 
        } else {
        	console.log(`   ❌ Swap in SPOT Error ${BUYtrade.msg}\n`);
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

/**
 * Executes a trade on CoinEx and withdraws funds to BTSE.
 *
 * @param {string} TokenA - The token to be traded (e.g., "BTC").
 * @param {string} TokenB - The token to receive (e.g., "USDT").
 * @param {string} side - The trade side ("buy" or "sell").
 */
async function TradeOnCoinex(TokenA, TokenB, side) {
    try {
        let fromTokenCoinex = convertTokenName(TokenA); // Convert token name to CoinEx format
        let TradeableBalance = 0; // Initialize tradeable balance
        let UbalanceCounter = 0; // Counter for API request attempts

        // Wait until a tradeable balance is available
        do {
            UbalanceCounter++;
            if (UbalanceCounter % 4 === 0) { 
                console.clear(); // Clear console output every 4 iterations
                UbalanceCounter = 1;
            }

            // Fetch tradeable balance
            let getTradeableBalance = await coinex.getBalanceByAsset(fromTokenCoinex);

            //get fees
            const GetTradeFee = await coinex.getTradingFeeRate(fromTokenCoinex, TokenB);
            const tradeFee = GetTradeFee.makerFee;
            TradeableBalance = getTradeableBalance.free - (tradeFee / 100 * getTradeableBalance.free); // Deduct 0.02% fee

            if (TradeableBalance <= 0) {
                console.log(`⏳ Tradeable ${fromTokenCoinex} balance: ${TradeableBalance.toFixed(4)} (${UbalanceCounter}) - Waiting for balance to update...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retrying
            }
        } while (TradeableBalance <= 0);

        console.log(`✅ Tradeable balance detected: ${TradeableBalance.toFixed(4)} ${fromTokenCoinex}. Proceeding with trade...`);

        // Execute the trade on CoinEx
        let swapOnSellExchange = await coinex.swapTokens(fromTokenCoinex, TokenB, side, TradeableBalance);

        // Check if the trade was successful
        if (swapOnSellExchange.code !== -1) {
            let withdrawableBalance = 0; // Initialize withdrawable balance

            // Wait until the converted TokenB is available for withdrawal
            do {
                let getWithdrawableBalance = await coinex.getBalanceByAsset(TokenB);
                withdrawableBalance = getWithdrawableBalance.free - 2.5; // Deduct 2.5 units as withdrawal fee

                console.log(`💰 Withdrawable ${TokenB} balance: ${withdrawableBalance.toFixed(4)}`);

                if (withdrawableBalance <= 0) {
                    console.log("⏳ Waiting for balance to update...");
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
                }

            } while (withdrawableBalance <= 0);

            console.log(`✅ Trade successful! Withdrawing ${withdrawableBalance.toFixed(4)} ${TokenB} to BTSE...`);
            
            // Withdraw TokenB to BTSE
            await WithdrawToBTSE(withdrawableBalance);
        } else {
            console.log(`⚠️ Trade failed! (${swapOnSellExchange.code}) ${swapOnSellExchange.msg}`);
        }
    } catch (err) {
        console.error(`⚠️ Error during trade execution: ${err.message}`);
    }
}
/**
 * Scans for arbitrage opportunities across available trading pairs.
 *
 * This function retrieves all available tokens on CoinEx, checks arbitrage opportunities
 * for each token against USDT, and ensures a delay between scans to prevent API rate limits.
 *
 * @async
 * @function ScanArbitrage
 */
async function ScanArbitrage() {
    try {
        // Fetch all available tokens that can be converted
        //const availableCurrency = await coinex.AvailableCurrency("CONVERT");
        const availableCurrency = coins.commonQuotes;
        console.log(availableCurrency);

        let totalTokens = availableCurrency.length;

        console.log(`✅ Total tokens available for conversion: ${totalTokens}`);

        // Iterate through each token to check arbitrage opportunities
        for (const fromToken of availableCurrency) {
            totalTokens--;
            const toToken = "USDT"; // Target trading pair

            console.log(`✅ Checking opportunity: ${fromToken.toUpperCase()}-${toToken.toUpperCase()} | Tokens left to scan: ${totalTokens}`);

            // Check for arbitrage opportunities with a fixed trading amount (e.g., 10 units)
            await ArbitrageOpportunity(fromToken.toUpperCase(), toToken.toUpperCase(), 100);

            // Delay execution to avoid excessive API requests (ensure `delay()` is defined)
            await delay(2000);
        }
    } catch (error) {
        console.error(`⚠️ Error scanning arbitrage opportunities: ${error.message}`);
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
 * Continuously scans for arbitrage opportunities between two tokens.
 *
 * This function takes input parameters from the command line or defaults to `XMR → USDT`
 * with an amount of `10`. It repeatedly calls `ArbitrageOpportunity` every 10 seconds
 * until manually stopped.
 *
 * @async
 * @function FoundArbitrage
 * @returns {Promise<void>} Runs indefinitely until interrupted.
 */
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
	 //ScanArbitrage();
	 FoundArbitrage();
}
module.exports = {
    sendTelegramMessage,
    getPrice,
    withdrawToBTSE,
    withdrawToCoinEx,
    getCoinExWalletAddress,
    getBTSEWalletAddress,
};