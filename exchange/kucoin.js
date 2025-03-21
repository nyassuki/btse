const { SpotClient } = require('kucoin-api');
require('dotenv').config(); // Load environment variables from .env file

// Load environment variables
const API_KEY = process.env.KUCOIN_API_KEY;
const API_SECRET = process.env.KUCOIN_API_SECRET;
const API_PASSPHRASE = process.env.KUCOIN_API_PASSPHRASE;

// Initialize the KuCoin Spot API client
const kucoinClient = new SpotClient({
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    apiPassphrase: API_PASSPHRASE,
});

/**
 * Get balance for a specific asset.
 * @param {string} asset - The asset symbol (e.g., 'USDT').
 * @returns {Promise<Object>} - Available and locked balance.
 */
async function getBalanceByAsset(asset) {
    try {
        const balance = await kucoinClient.getBalances({ currency: asset, type: 'main' });
        return {
            free: balance.data.balance, // Available balance
            locked: 0, // Locked balance (KuCoin doesn't provide it directly)
        };
    } catch (error) {
        console.error('Error fetching balance:', error);
        return { free: 0, locked: 0 };
    }
}

/**
 * Get exchange rate between two assets.
 * @param {string} fromAsset - The base asset.
 * @param {string} toAsset - The quote asset.
 * @returns {Promise<Object|null>} - Current price and reverse price.
 */
async function getExchangeRate(fromAsset, toAsset) {
    try {
        let data = await kucoinClient.getTicker({ symbol: `${fromAsset}-${toAsset}` });
        return { price: data.data.price, reverse_price: 1 / data.data.price };
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        return null;
    }
}

/**
 * Get the price of an asset pair.
 * @param {string} fromAsset - The base asset.
 * @param {string} toAsset - The quote asset.
 * @returns {Promise<Object|null>} - Current price data.
 */
async function getPrice(fromAsset, toAsset) {
    return await getExchangeRate(fromAsset, toAsset);
}

/**
 * Swap tokens (Market Order).
 * @param {string} fromAsset - The asset to sell.
 * @param {string} toAsset - The asset to buy.
 * @param {string} side - Trade direction ('buy' or 'sell').
 * @param {number} amount - Trade amount.
 * @returns {Promise<Object>} - Order details.
 */
async function swapTokens(fromAsset, toAsset, side, amount) {
    try {
        const order = await kucoinClient.submitOrder({
            clientOid: Date.now().toString(), // Unique order ID
            side: side.toLowerCase(),
            symbol: `${fromAsset}-${toAsset}`,
            type: 'market',
            size: amount,
        });
        return order.data;
    } catch (error) {
        console.error('Error executing swap:', error);
        return { code: -1, msg: error.body?.msg || 'Unknown error' };
    }
}

/**
 * Withdraw a token to an external address.
 * @param {string} asset - The asset to withdraw.
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @param {string} chain - The blockchain network (default: ERC20).
 * @returns {Promise<Object>} - Withdrawal details.
 */
async function withdrawToken(asset, amount, address, chain = 'ERC20') {
    try {
        const withdrawal = await kucoinClient.submitWithdraw({
            currency: asset,
            address: address,
            amount: amount,
            memo: 'Trade withdrawal',
            chain: chain,
        });
        return withdrawal.data;
    } catch (error) {
        console.error('Error withdrawing token:', error);
        return error.body?.msg || 'Unknown error';
    }
}

/**
 * Get deposit wallet address for a currency.
 * @param {string} currency - The asset symbol.
 * @returns {Promise<Object|null>} - Wallet address and chain details.
 */
async function getWalletAddress(currency) {
    try {
        await kucoinClient.createDepositAddress({ currency: currency });
    } catch (error) {
        console.error('Error creating deposit address:', error);
    }
    try {
        const address = await kucoinClient.getDepositAddressesV2({ currency: currency });
        return { address: address.data[0].address, chain: address.data[0].chain };
    } catch (error) {
        console.error('Error fetching deposit address:', error);
        return null;
    }
}

/**
 * Get trading fee rate.
 * @param {string} fromAsset - Base asset.
 * @param {string} toAsset - Quote asset.
 * @returns {Promise<Object>} - Maker and taker fees.
 */
async function getTradingFeeRate(fromAsset, toAsset) {
    return {
        makerFee: 0.2, // Maker fee percentage
        takerFee: 0.2, // Taker fee percentage
    };
}

/**
 * Get a list of available currencies.
 * @returns {Promise<Array|null>} - List of supported currencies.
 */
async function AvailableCurrency() {
    try {
        const currencies = await kucoinClient.getCurrencies();
        return currencies.data;
    } catch (error) {
        console.error('Error fetching available currencies:', error);
        return null;
    }
}

/**
 * Place a spot trade (market order).
 * @param {string} fromAsset - The asset to sell.
 * @param {string} toAsset - The asset to buy.
 * @param {string} side - Trade direction ('buy' or 'sell').
 * @param {number} amount - Amount to trade.
 * @returns {Promise<Object>} - Trade execution details.
 */
async function placeSpotTrade(fromAsset, toAsset, side, amount) {
    return swapTokens(fromAsset, toAsset, side, amount);
}

module.exports = {
    getBalanceByAsset,
    getExchangeRate,
    getPrice,
    swapTokens,
    withdrawToken,
    getWalletAddress,
    getTradingFeeRate,
    AvailableCurrency,
    placeSpotTrade,
};
