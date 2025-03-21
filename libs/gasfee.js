require("dotenv").config();
const axios = require("axios");
const https = require("https");

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BASE_URL = "https://api.etherscan.io/api";
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usdt";


const agent = new https.Agent({  
    rejectUnauthorized: false // Ignores certificate issues
});


/**
 * Fetch the latest Ethereum price in USDT.
 * @returns {Promise<number>} - ETH price in USDT.
 */
async function getETHPrice() {
    try {
        // Try CoinGecko first
        const response = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usdt");
        if (response.data.ethereum.usdt) return response.data.ethereum.usdt;

        // If CoinGecko fails, use Binance
        const binanceResponse = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
        return parseFloat(binanceResponse.data.price);
    } catch (error) {
        console.error("❌ Error fetching ETH price:", error.message || error);
        throw error;
    }
}

/**
 * Fetch the current gas prices from Etherscan.
 * @returns {Promise<Object>} - The gas prices in Gwei and USDT.
 */
async function getGasCost() {
    const url = `${BASE_URL}?module=gastracker&action=gasoracle&apikey=${ETHERSCAN_API_KEY}`;

    try {
        const response = await axios.get(url);

        // Check if the API response is successful
        if (response.data.status === "1" && response.data.result) {
            // Fetch ETH price in USDT
            const ethPrice = await getETHPrice();

            // Convert Gwei to ETH (1 Gwei = 10⁻⁹ ETH)
            const gasPrices = {
                low: parseFloat(response.data.result.SafeGasPrice), 
                medium: parseFloat(response.data.result.ProposeGasPrice), 
                high: parseFloat(response.data.result.FastGasPrice),
            };

            // Convert gas prices to ETH
            const gasPricesETH = {
                low: gasPrices.low * 1e-9, 
                medium: gasPrices.medium * 1e-9,
                high: gasPrices.high * 1e-9,
            };

            // Convert gas prices to USDT
            const gasPricesUSDT = {
                low: (gasPricesETH.low * ethPrice).toFixed(6), 
                medium: (gasPricesETH.medium * ethPrice).toFixed(6),
                high: (gasPricesETH.high * ethPrice).toFixed(6),
            };

            return { gasPrices, gasPricesETH, gasPricesUSDT, ethPrice };
        } else {
            throw new Error(`Etherscan API error: ${response.data.message}`);
        }
    } catch (error) {
        console.error("❌ Error fetching gas prices:", error.message || error);
        throw error;
    }
}
module.exports = { getGasCost };

// Example usage
// (async () => {
    // try {
        // const { gasPrices, gasPricesUSDT, ethPrice } = await getGasCost();

        // console.log(`📊 ETH Price: ${ethPrice} USDT`);
        // console.log("💰 Gas Prices:");
        // console.log(`  🔹 Low: ${gasPrices.low} Gwei (${gasPricesUSDT.low} USDT)`);
        // console.log(`  🔹 Medium: ${gasPrices.medium} Gwei (${gasPricesUSDT.medium} USDT)`);
        // console.log(`  🔹 High: ${gasPrices.high} Gwei (${gasPricesUSDT.high} USDT)`);
    // } catch (error) {
        // console.error("❌ Error:", error.message || error);
    // }
// })();
