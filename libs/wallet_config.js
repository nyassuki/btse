require("dotenv").config();
 

const wallet_production = [
	{exchange:"btse",token:"USDT", address:"0x308Be008677b10d4946A87e9C0b3EF700459b8f0", network:"ERC20"},
	{exchange:"btse",token:"LTC", address:"0x308Be008677b10d4946A87e9C0b3EF700459b8f0", network:"Litecoin"},
	{exchange:"btse",token:"BNB", address:"0x308Be008677b10d4946A87e9C0b3EF700459b8f0", network:"BEP20"},
	{exchange:"btse",token:"DOGE", address:"0x308Be008677b10d4946A87e9C0b3EF700459b8f0", network:"BEP20"},
	{exchange:"btse",token:"ACH", address:"0x308Be008677b10d4946A87e9C0b3EF700459b8f0", network:"ERC20"},
	
	{exchange:"todobit",token:"USDT", address:"0x828E3b52B894c8c4E1f19e8D7672B7F7d93b15DE", network:"ERC20"},
	{exchange:"todobit",token:"LTC", address:"LiAAY1V5rf1dk6rPLrwcy3es2vXQZ4mfLj", network:"Litecoin"},
	{exchange:"todobit",token:"BNB", address:"0xbecb393d9E9162849c992ef9404b90cB07ABFF2f", network:"BEP20"},
	{exchange:"todobit",token:"DOGE", address:"D5dReiZ1aeHhmfzXLqaD1kE8NN2cr8An8p", network:"Dogecoin"},
	
	{exchange:"okx",token:"USDT", address:"0x2b387b91a3e1d6be1e9bd11d9287a9de3c247907", network:"ERC20"},
	{exchange:"okx",token:"LTC", address:"LTC1q3fdzjptch9qj7t8wju36fuutfr4y8l5k60nxmdhgghczkkphvafqpn7z6a", network:"Litecoin"},
	{exchange:"okx",token:"DGB", address:"Sa3sBMEBjKzNAVTW7xN79iFAe3ipaK3LuR", network:"Digibyte"},
	{exchange:"okx",token:"RDNT", address:"0x2b387b91a3e1d6be1e9bd11d9287a9de3c247907", network:"Arbitrum"},
	{exchange:"okx",token:"GLMR", address:"0x2b387b91a3e1d6be1e9bd11d9287a9de3c247907", network:"Moonbeam"},
	{exchange:"okx",token:"BNB", address:"0x2b387b91a3e1d6be1e9bd11d9287a9de3c247907", network:"BEP20"},
	{exchange:"okx",token:"DOGE", address:"9rgSChNSJTpCqD9zitpHbrH2RobtAD7fr4", network:"Dogecoin"},
	{exchange:"okx",token:"ACH", address:"0x2b387b91a3e1d6be1e9bd11d9287a9de3c247907", network:"ERC20"},
	
	{exchange:"htx",token:"USDT", address:"0xbc151db57e96c1fddd0a6501e32b627033cf7648", network:"ERC20"},
	{exchange:"htx",token:"LTC", address:"Lh3Ku81TQP9x8Dbd8oN6NXvvKyNJaLmDeA", network:"Litecoin"},
	{exchange:"htx",token:"LTC", address:"0xbc151db57e96c1fddd0a6501e32b627033cf7648", network:"ERC20"},
	{exchange:"htx",token:"BNB", address:"0xbc151db57e96c1fddd0a6501e32b627033cf7648", network:"BEP20"},
	{exchange:"htx",token:"DOGE", address:"D6Rx5jspHRR8sdXK3vUZPPLV8VmdjzpBXP", network:"Dogecoin"},
	{exchange:"htx",token:"ACH", address:"0xbc151db57e96c1fddd0a6501e32b627033cf7648", network:"ERC20"},
	
	{exchange:"binance",token:"USDT", address:"0x88611ce3c55b9c576761caab40e97f8a99b01c72", network:"ERC20"},
	{exchange:"binance",token:"DGB", address:"DF5F4JmEat2sagYHcsNx1LYqbVKEm2mWRV", network:"Digibyte"},
	{exchange:"binance",token:"LTC", address:"LfpTiiwHr6fftUCCZN4Znt4xvxYLHr7mQF", network:"Litecoin"},
	{exchange:"binance",token:"RDNT", address:"0x88611ce3c55b9c576761caab40e97f8a99b01c72", network:"BEP20"},
	{exchange:"binance",token:"BNB", address:"0x88611ce3c55b9c576761caab40e97f8a99b01c72", network:"BEP20"},
	{exchange:"binance",token:"DOGE", address:"DC8AvJoFaFisMpQfNUNTkHqU8YDvkMfxye", network:"Dogecoin"},
	{exchange:"binance",token:"ACH", address:"0x88611ce3c55b9c576761caab40e97f8a99b01c72", network:"BSC20"},
	{exchange:"binance",token:"DOGE", address:"0x88611ce3c55b9c576761caab40e97f8a99b01c72", network:"ERC20"},
	
	{exchange:"coinex",token:"BTC", address:"1BG7g8dWPHpM5YcGE3booNZAFauUSnQqhH", network:"Bitcoin"},
	{exchange:"coinex",token:"USDT", address:"0x0e38583dec6a03e49182241cd4cc2cb4c2e45be9", network:"ERC20"},
	{exchange:"coinex",token:"DGB", address:"DKK8zBjmESWnufHVZVJMfUGrYJmtW3RsWS", network:"Digibyte"},
	{exchange:"coinex",token:"RDNT", address:"0x0e38583dec6a03e49182241cd4cc2cb4c2e45be9", network:"Arbitrum"},
	{exchange:"coinex",token:"LTC", address:"ltc1qn88z0nv6u2rrx3395j2w362tzhx8nvtaw0kcms", network:"Litecoin"},
	{exchange:"coinex",token:"GLMR", address:"0x0e38583dec6a03e49182241cd4cc2cb4c2e45be9", network:"Moonbeam"},
	{exchange:"coinex",token:"BNB", address:"0x0e38583dec6a03e49182241cd4cc2cb4c2e45be9", network:"BEP20"},
	{exchange:"coinex",token:"DOGE", address:"DBipCbf3FQcCWjVHi5RTVVivDK1b4S3dFv", network:"Dogecoin"},
	{exchange:"coinex",token:"ACH", address:"0x0e38583dec6a03e49182241cd4cc2cb4c2e45be9", network:"ERC20"},
	
];

module.exports = {
    wallet_production
};

