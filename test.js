const axios = require('axios');

async function getBTSETokenDetails(symbol = 'BANANA-USDT') {
    try {
        const url = `https://api.btse.com/spot/api/v3.2/market_summary`;
        const response = await axios.get(url);
        const marketData = response.data;

        // Find the token details
        const token = marketData.find(market => market.symbol === symbol);

        if (!token) {
            console.log(`❌ Token ${symbol} not found on BTSE.`);
            return null;
        }

        console.log(`🔹 Token Details for ${symbol} on BTSE`);
        console.log(`✅ Last Price: ${token.last}`);
        console.log(`📊 24h Volume: ${token.volume}`);
        console.log(`📈 24h High: ${token.high_24h}`);
        console.log(`📉 24h Low: ${token.low_24h}`);
        console.log(`🔄 Price Change (24h): ${token.change_24h}%`);
        console.log(`📌 Status: ${token.active ? 'Active' : 'Inactive'}`);

        return token;
    } catch (error) {
        console.error('❌ Error fetching token details:', error.response?.data || error.message);
    }
}

// Example usage
getBTSETokenDetails();
