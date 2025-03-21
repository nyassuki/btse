const btse = require("./exchange/btse.js");
const coinex = require("./exchange/coinex.js");

const fs = require("fs");
require("dotenv").config();
const axios = require("axios");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function checkBalance(exchange_, token) {
    let balance = 0;
    const exchange = exchange_.toUpperCase();
    
    if (exchange == "BTSE") {
        balance = await btse.getBalanceByAsset(token);
    } else if (exchange == "COINEX") {
        balance = await coinex.getBalanceByAsset(token);
    }
    
    return balance ? balance.free : 0; // Ensure it returns a valid number
}

async function spotTrading(exchange_, tokenA, tokenB, side, amount) {
    const exchange = exchange_.toUpperCase();
    let trading_response = "";

    if (exchange == "BTSE") {
        const getTradingPrice = await btse.getPrice(tokenA, tokenB);
        let orderSize = 0;

        if (side.toUpperCase() == "BUY") {
            orderSize = amount / getTradingPrice.price;
            orderSize = orderSize.toFixed(2);
        } else if (side.toUpperCase() == "SELL") {
            orderSize = amount;
            orderSize = orderSize.toFixed(2);
        }
        trading_response = await btse.spotTradeTokens(tokenA, tokenB, side, orderSize, orderSize);

    } else if (exchange == "COINEX") {
        trading_response = await coinex.spotTradeTokens(tokenA, tokenB, side, amount, amount);
    }

    return trading_response;
}

async function withdrawAssettoExchange(exchange_, token, amount_, withdrawAllBalance = false) {
    const exchange = exchange_.toUpperCase();
    let withDestAddress = "";
    let amount = 0;

    if (exchange == "BTSE") {
        if (withdrawAllBalance==true) {
            amount = await checkBalance("btse", token);
        } else if (withdrawAllBalance==false) {
            amount = amount_;
        }

        withDestAddress = await coinex.getWalletAddress(token, "ERC20");
        return await btse.withdrawToken(token, amount, withDestAddress.address, "ERC20");

    } else if (exchange == "COINEX") {
        if (withdrawAllBalance==true) {
            amount = await checkBalance("coinex", token);
        } else if (withdrawAllBalance==false) {
            amount = amount_;
        }

        withDestAddress = await btse.getWalletAddress(token, "ERC20");
        return await coinex.withdrawToken(token, amount, withDestAddress.address, "ERC20");
    }
}
 
async function triangleArbitrage() {
    const start = process.hrtime();
    const args = process.argv.slice(2);
    const step = args[0] || "all"; // Default: 10

    const pair_1_1 = "BANANA";
    const pair_1_2 = "USDT";
    const pair_2_1 = "TOWER";
    const pair_2_2 = "USDT";

    console.log(`\n✅ Start triangle arbitrage trading ${pair_1_1}-${pair_1_2} ${pair_2_1}-${pair_2_2} step ${step}`);

    if (step == "all" || step == 1) {
        let usdt_balance_btse = await checkBalance("btse", pair_1_2);
        console.log(`⏳ Arbitrage started with ${usdt_balance_btse} ${pair_1_2}`);
        let pair1_buy = await spotTrading("btse", pair_1_1, pair_1_2, "buy", usdt_balance_btse);
        console.log(`   - step 1 SPOT BUY ${pair_1_1} to ${pair_1_2} in BTSE ${pair1_buy.msg}`);
    }

    if (step == "all" || step == 2) {
        let trump_balance_btse = await checkBalance("btse", pair_1_1);
        let withdraw_pair1_buy = await withdrawAssettoExchange("btse", pair_1_1, trump_balance_btse);
        console.log(`   - step 2 withdraw ${pair_1_1} to COINEX ${withdraw_pair1_buy.msg}`);
    }

    if (step == "all" || step == 3) {
        let trump_balance_coinex = await checkBalance("coinex", pair_1_1);
        let pair2_sell = await spotTrading("coinex", pair_1_1, pair_1_2, "sell", trump_balance_coinex);
        console.log(`   - step 3 SPOT SELL ${pair_1_1} to ${pair_1_2} in COINEX ${pair2_sell.msg}`);
    }

    if (step == "all" || step == 4) {
        let usdt_balance_coinex = await checkBalance("coinex", pair_1_2);
        let pair2_buy = await spotTrading("coinex", pair_2_1, pair_1_2, "buy", usdt_balance_coinex);
        console.log(`   - step 4 SPOT BUY ${pair_2_1} to ${pair_2_2} in BTSE ${pair2_buy.msg}`);
    }

    if (step == "all" || step == 5) {
        let tower_balance_coinex = await checkBalance("coinex", pair_2_1);
        let withdraw_pair2_buy = await withdrawAssettoExchange("coinex", pair_2_1, tower_balance_coinex);
        console.log(`   - step 5 withdraw ${pair_2_1} to BTSE ${withdraw_pair2_buy.message}`);
    }

    if (step == "all" || step == 6) {
        let tower_balance_btse = await checkBalance("btse", pair_2_1);
        let pair1_sell = await spotTrading("btse", pair_2_1, pair_1_2, "sell", tower_balance_btse);
        console.log(`   - step 6 SPOT SELL ${pair_2_1} to ${pair_2_2} in BTSE ${pair1_sell.msg}`);
    }

 
    let usdt_balance_btse = await checkBalance("btse", pair_1_2);
    console.log(`💰 Final USDT balance: ${usdt_balance_btse}\n`);


    const end = process.hrtime(start);
    console.log(`⏰ Script execution time: ${end[0]}s and ${end[1] / 1e6}ms\n`);
}

async function towerArbitrage() {
    const start = process.hrtime();
    const pair_1_0 = "TOWER";
    const pair_1_1 = "USDT";
    
    const args = process.argv.slice(2);
    const step = args[0] || "all"; // Default: 10

    console.log(`\n✅ Start TOWER arbitrage trading ${pair_1_0}-${pair_1_1} step ${step}`);
    if (step == "all" || step == 1) {
        let usdt_balance_coinex = await checkBalance("coinex", pair_1_1);
        let pair2_sell = await spotTrading("coinex", pair_1_0, pair_1_1, "buy", usdt_balance_coinex);
        console.log(`⏳ Arbitrage started with ${usdt_balance_coinex} ${pair_1_1}`);
        console.log(`   - step 1 ${pair2_sell.msg}`);
    }

    if (step == "all" || step == 2) {
        let tower_balance_coinex = await checkBalance("coinex", pair_1_0);
        let withdraw_pair1_buy = await withdrawAssettoExchange("coinex", pair_1_0, tower_balance_coinex);
        console.log(`   - step 2 ${withdraw_pair1_buy.message}`);
    }

    if (step == "all" || step == 3) {
        let tower_balance_btse = await checkBalance("btse", pair_1_0);
        let pair1_sell = await spotTrading("btse", pair_1_0, pair_1_1, "sell", tower_balance_btse);
        console.log(`   - step 3 ${pair1_sell.msg}`);
    }

    let usdt_balance_btse = await checkBalance("btse", pair_1_1);
    console.log(`💰 Final USDT balance: ${usdt_balance_btse}\n`);


    const end = process.hrtime(start);
    console.log(`⏰ Script execution time: ${end[0]}s and ${end[1] / 1e6}ms\n`);
}
async function main() {
    console.log(await checkBalance("coinex", pair_1_2));
    console.log(await spotTrading("coinex", pair_2_1, pair_1_2, "buy", 2.99172357));
    //console.log(await withdrawAssettoExchange("btse", pair_1_2, "20000"));
}

triangleArbitrage();
//towerArbitrage();
