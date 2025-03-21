require('dotenv').config(); // Load .env file
const axios = require('axios');
const crypto = require('crypto');

// Load API credentials from .env
const apiKey = process.env.BTSE_API_KEY; // BTSE API key
const passphrase = process.env.BTSE_PASSPHRASE; // BTSE API passphrase
const baseURL = process.env.BTSE_API_BASE_URL; // BTSE API base URL
//const baseURL = 'https://testapi.btse.io/spot';// BTSE testnet API base URL :api-testnet.btse.com
/**
 * Creates an HMAC SHA384 signature for BTSE API requests.
 * @param {string} path - The API endpoint path (e.g., /api/v3.2/user/wallet).
 * @param {Object} params - The request parameters (for POST requests).
 * @param {string} secret - The API secret key.
 * @param {string} nonce - A unique nonce for the request.
 * @returns {string} - The HMAC SHA384 signature in hexadecimal format.
 */
function createSignature(path, params, secret, nonce) {
    const bodyStr = params && Object.keys(params).length ? JSON.stringify(params) : ''; // Use bodyStr only if params exist
    const payload = path + nonce + bodyStr; // Concatenate path, nonce, and bodyStr
    return crypto.createHmac('sha384', secret).update(payload).digest('hex'); // Create and return the signature
}

/**
 * Fetches the balance of a specific asset or all assets.
 * @param {string|null} currency - The currency to fetch the balance for (e.g., USDT). If null, fetches all balances.
 * @returns {Promise<Object|null>} - The balance response containing free and locked amounts, or null on error.
 */
async function getBalanceByAsset(currency = null) {
    const path = '/api/v3.2/user/wallet'; // API endpoint for wallet balance
    const url = `${baseURL}${path}`; // Full API URL
    const params = {}; // No parameters for this endpoint
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        const response = await axios.get(url, { headers }); // Make the API request

        if (currency) {
            // Find the balance for the specified currency
            const balance = response.data.find((b) => b.currency === currency);
            if (balance) {
                return { free: parseFloat(balance.available), locked: parseFloat(balance.total - balance.available) }; // Return free and locked balances
            } else {
                //console.error('Currency not found:', currency);
                return { free: 0, locked: 0 }; // Return 0 if currency not found
            }
        } else {
            return response.data; // Return all balances
        }
    } catch (error) {
        return null; // Return null on error
    }
}

/**
 * Fetches the exchange rate for a trading pair.
 * @param {string} fromCurrency - The source currency (e.g., USDT).
 * @param {string} toCurrency - The target currency (e.g., LTC).
 * @returns {Promise<Object>} - The exchange rate response containing price and reverse price.
 */
async function getExchangeRate2(fromCurrency, toCurrency) {
    const path = '/api/v3.2/exchangeRate'; // API endpoint for exchange rate
    const url = `${baseURL}${path}?srcCurrency=${fromCurrency}&targetCurrency=${toCurrency}`; // Full API URL with query params
    const params = {}; // No parameters for this endpoint
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
		let exchangable = await checkTradingPair(fromCurrency, toCurrency);
		if(exchangable==true) {
			const response = await axios.get(url, { headers }); // Make the API request

			if (response.data && response.data.data) {
				const price = parseFloat(response.data.data); // Extract price
				const reversePrice = 1 / price; // Calculate reverse price
				return { price, reverse_price: reversePrice }; // Return price and reverse price
			} else {
				//console.error('Exchange rate data not found in response');
				return { price: 0, reverse_price: 0 }; // Return 0 if data is missing
			}
		} else {
			return { price: 0, reverse_price: 0 };
		}
    } catch (error) {
        return { price: 0, reverse_price: 0 }; // Return 0 on error
    }
}
async function getExchangeRate(fromCurrency, toCurrency) {
    try {
        const symbol = `${fromCurrency}-${toCurrency}`
        const response = await axios.get('https://api.btse.com/spot/api/v3.2/market_summary');
        const marketData = response.data;
        
        const priceData = marketData.find(market => market.symbol === symbol);
        
        if (priceData) {
            //console.log(`BTSE Spot Price for ${symbol}: ${priceData.last}`);
            return priceData.last;
            return { price: priceData.last, reserve_price: 1/priceData.last};
        } else {
           return { price: 0, reserve_price: 0};
        }
    } catch (error) {
        return { price: 0, reserve_price: 0};
    }
}
async function getTradingFeeRate(fromCurrency, toCurrency) {
    const path = '/api/v3.2/user/fees'; // API endpoint for exchange rate
    const url = `${baseURL}${path}?symbol=${fromCurrency}-${toCurrency}`; // Full API URL with query params
    const params = {}; // No parameters for this endpoint
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        let exchangable = await checkTradingPair(fromCurrency, toCurrency);
        if(exchangable==true) {
            const response = await axios.get(url, { headers }); // Make the API request
             if (response.data || response.data.data) {
                const makerFee = response.data[0]['makerFee']; // Extract price
                const takerFee = response.data[0]['takerFee']; // Extract price
                return { makerFee:makerFee, takerFee: takerFee }; // Return price and reverse price
            } else {
                //console.error('Exchange rate data not found in response');
                return { makerFee: 0, takerFee: 0 }; // Return 0 if data is missing
            }
        } else {
            return { makerFee: 0, takerFee: 0 };
        }
    } catch (error) {
        return { makerFee: 0, takerFee: 0 }; // Return 0 on error
    }
}
/**
 * Fetches the exchange rate for a trading pair.
 * @param {string} fromCurrency - The source currency (e.g., USDT).
 * @param {string} toCurrency - The target currency (e.g., LTC).
 * @returns {Promise<Object>} - The exchange rate response containing price and reverse price.
 */
async function getPrice(fromCurrency, toCurrency) {
    const path = '/api/v3.2/price'; // API endpoint for exchange rate
    const url = `${baseURL}${path}?symbol=${fromCurrency}-${toCurrency}`; // Full API URL with query params
    const params = {}; // No parameters for this endpoint
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };
     try {
        let exchangable = await checkTradingPair(fromCurrency, toCurrency);
        if(exchangable==true) {
            const response = await axios.get(url, { headers }); // Make the API request
            
            if (response.data || response.data.data) {
                const price = parseFloat(response.data[0]['lastPrice']); // Extract price
                const reversePrice = 1 / price; // Calculate reverse price
                 
                return { price, reverse_price: reversePrice }; // Return price and reverse price
            } else {
                //console.error('Exchange rate data not found in response');
                return { price: 0, reverse_price: 0 }; // Return 0 if data is missing
            }
        } else {
            return { price: 0, reverse_price: 0 };
        }
    } catch (error) {
        return { price: 0, reverse_price: 0 }; // Return 0 on error
    }
}

/**
 * Swaps tokens on BTSE.
 * @param {string} fromAsset - The asset to swap from (e.g., USDT).
 * @param {string} toAsset - The asset to swap to (e.g., LTC).
 * @param {string} type - The type of swap (e.g., "buy" or "sell").
 * @param {number} amount - The amount to swap.
 * @returns {Promise<Object>} - The swap response containing code and message.
 */
 
async function swapTokens(fromAsset, toAsset, type, amount) {
    const path = '/api/v3.2/user/wallet/convert'; // API endpoint for token conversion
    const url = `${baseURL}${path}`; // Full API URL
    const swapParams = { amount, fromAsset, toAsset }; // Swap parameters
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, swapParams, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        const response = await axios.post(url, swapParams, { headers }); // Make the API request
        if (response.data.success) {
            return { code: response.data.code, msg: response.data.msg }; // Return success response
        } else {
            return { code: -1, msg: response.data.msg }; // Return error response
        }
    } catch (error) {
        return { code: -1, msg: error.response?.data?.msg || 'Swap failed' }; // Return error details
    }
}
/**
 * trade SPOT tokens on BTSE.
 * @param {string} fromAsset - The asset to swap from (e.g., USDT).
 * @param {string} toAsset - The asset to swap to (e.g., LTC).
 * @param {string} type - The type of swap (e.g., "buy" or "sell").
 * @param {number} amount - The amount to swap.
 * @returns {Promise<Object>} - The swap response containing code and message.
 */
 
async function spotTradeTokens(fromAsset, toAsset, type, size,amount) {
    const path = '/api/v3.2/order'; // API endpoint for token conversion
    const url = `${baseURL}${path}`; // Full API URL
    const swapParams = { 
            size: size,
            symbol: `${fromAsset}-${toAsset}`, 
            side:type,
            type:"MARKET"
             
        }; // Swap parameters
        //console.log(swapParams);

    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, swapParams, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        const response = await axios.post(url, swapParams, { headers }); // Make the API request 
        //console.log(response.data[0]); 
        const order_status = response.data[0].status;
        if(order_status==2 || order_status==3 || order_status==4 || order_status==5) {
            const amount = response.data[0].fillSize;
            const getFee=await getTradingFeeRate(fromAsset, toAsset);
            const fee = getFee.makerFee;
            const final_amount = amount-(amount*fee);
            const price = response.data[0].price;
            const amount_back = price*amount;
            if(type=="sell") {
                return {code:1,amount:amount_back, fee:fee, final_amount:amount_back-(amount_back*fee), msg:`success`}; 
            } else {
                return {code:1,amount:amount, fee:fee, final_amount:final_amount, msg:`success`}; 
            }
        } else {
            const err = JSON.parse(response.data[0].message);
            return { code:-1, amount: 0, fee:0,final_amount:0,msg: `(BTSE) ${err.default_msg}` };
        }
       
    } catch (error) {
        return { code: -1, msg: `(BTSE) ${error.response.data.msg}` || 'Swap failed' }; // Return error details
    }
}

/**
 * Fetches available currencies for a specific action (e.g., WITHDRAW).
 * @param {string} action - The action (e.g., "WITHDRAW").
 * @returns {Promise<Object|null>} - The list of available currencies, or null on error.
 */
async function AvailableCurrency(action) {
    const path = '/api/v3.2/availableCurrencies'; // API endpoint for available currencies
    const url = `${baseURL}${path}?action=${action}`; // Full API URL with query params
    const params = {}; // No parameters for this endpoint
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        const response = await axios.get(url, { headers }); // Make the API request
        return response.data; // Return available currencies
    } catch (error) {
        return null; // Return null on error
    }
}

/**
 * Fetches available currency networks for a specific currency.
 * @param {string} currency - The currency (e.g., USDT).
 * @returns {Promise<Object|null>} - The list of available currency networks, or null on error.
 */
async function availableCurrencyNetworks(currency) {
    const path = '/api/v3.2/availableCurrencyNetworks'; // API endpoint for currency networks
    const url = `${baseURL}${path}?currency=${currency}`; // Full API URL with query params
    const params = {}; // No parameters for this endpoint
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        const response = await axios.get(url, { headers }); // Make the API request
        return response.data; // Return available currency networks
    } catch (error) {
        return null; // Return null on error
    }
}

/**
 * Withdraws funds from BTSE.
 * @param {string} currency - The currency to withdraw (e.g., USDT).
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @returns {Promise<Object>} - The withdrawal response containing code and message.
 */
async function withdrawToken(currency, amount, address,chain) {
    const path = '/api/v3.2/user/wallet/withdraw'; // API endpoint for withdrawals
    const url = `${baseURL}${path}`; // Full API URL
    const params = {
        currency:`${currency}-${chain}`, // Currency to withdraw
        address:address, // Destination address
        amount:amount, // Amount to withdraw
        includeWithdrawFee: true, // Include withdrawal fee
    };
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        const response = await axios.post(url, params, { headers }); // Make the API request
        return { code: 1, msg: response.data }; // Return success response
    } catch (error) {
        return { code: -1, msg: `(BTSE) ${error.response?.data?.msg}` || 'Withdrawal failed' }; // Return error details
    }
}

async function getWalletAddress(currency, network) {
    const path = '/api/v3.2/user/wallet/address'; // API endpoint for withdrawals
    const url = `${baseURL}${path}`; // Full API URL
    const params = {
        currency, // Currency to create
        network, // currency network
    };
    const nonce = Date.now().toString(); // Unique nonce for the request
    const signature = createSignature(path, params, passphrase, nonce); // Generate signature

    const headers = {
        'request-api': apiKey, // API key
        'request-nonce': nonce, // Nonce
        'request-sign': signature, // Signature
        'Content-Type': 'application/json', // Content type
    };

    try {
        const response = await axios.post(url, params, { headers }); // Make the API request
		 return { address: response.data[0].address};
    } catch (error) {
       return { address: 0};
    }
}
 
// Function to check if two assets are swappable
async function checkTradingPair(tokenA, tokenB) {
  try {
    // Fetch all available trading pairs
    const response = await axios.get(`${baseURL}/api/v3.2/market_summary`);	
    const markets = response.data;

    // Check if a direct pair exists (TokenA-TokenB or TokenB-TokenA)
    const directPair1 = `${tokenA}-${tokenB}`; // e.g., BTC-USD
    const directPair2 = `${tokenB}-${tokenA}`; // e.g., USD-BTC

    const isDirectSwap = markets.some(
      (market) => market.symbol === directPair1 || market.symbol === directPair2
    );

    if (isDirectSwap) {
      return true;
    }
    const intermediateTokens = new Set();
    // Find all markets where TokenA is the base or quote
    for (const market of markets) {
      const [base, quote] = market.symbol.split('-');
      if (base === tokenA || quote === tokenA) {
        intermediateTokens.add(base === tokenA ? quote : base);
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Retrieves the withdrawal fee for a given token on BTSE.
 * 
 * @param {string} token - The token symbol (e.g., "TRUMP", "USDT").
 * @returns {number} - The withdrawal fee in the token's units.
 */
function WithdrawFee(token) {
    let Fee = 0; // Default fee value

    switch (token) {
        case "TRUMP":
            Fee = 4.54; // Fixed withdrawal fee for TRUMP
            break;
        case "USDT":
            Fee = 2; // Fixed withdrawal fee for USDT
            break;
        case "BANANA":
            Fee = 0.05481;
            break;
        default:
            Fee = 0.005; // Default withdrawal fee for other tokens
            break;
    }

    return Fee;
}


//main();
 async function main() {
	let tokenA = "XMR";
	let tokenB = "USDT";
	/*
    let  balance = await getBalanceByAsset(tokenA);
	console.log(balance);
		
	let address =await  swapTokens(tokenB, tokenA, "BUY", 1);
	console.log(address);
	
	let  balance2 = await getBalanceByAsset(tokenA);
	console.log(balance2);
	
	let  swapable = await checkTradingPair(tokenA, tokenB);
	console.log(swapable);
    
    let  spot = await spotTradeTokens(tokenA, tokenB, "SELL", "1");
    console.log(spot);
    */
	let  FeeRate = await getFeeRate(tokenA, tokenB);
    console.log(FeeRate);

}

// Export functions for external use
module.exports = {
    getBalanceByAsset,
    getExchangeRate,
    getPrice,
    swapTokens,
    spotTradeTokens,
    AvailableCurrency,
    availableCurrencyNetworks,
    withdrawToken,
    getWalletAddress,
    getTradingFeeRate,
    WithdrawFee
};

