const commonQuotes = [
  "BTC", "ETH", "USDT", "BNB", "XRP", "SOL", "ADA", "DOGE", "TRX", "DOT",
  "MATIC", "LTC", "BCH", "LINK", "ATOM", "XLM", "XMR", "ETC", "FIL", "ICP",
  "APE", "ARB", "SAND", "MANA", "GALA", "AVAX", "ALGO", "EOS", "NEAR", "FTM",
  "AAVE", "UNI", "SUSHI", "CRV", "COMP", "YFI", "LDO", "RUNE", "KAVA", "ZEC",
  "DASH", "QTUM", "XEM", "OMG", "SNX", "BAL", "1INCH", "BAT", "ENJ", "CHZ",
  "ANKR", "CRO", "FTT", "TWT", "GRT", "STX", "DYDX", "FLR", "OP", "LRC",
  "CELO", "ROSE", "ICX", "KSM", "WAVES", "ZIL", "REN", "HOT", "SC", "NANO",
  "DGB", "RVN", "HNT", "GLMR", "MOVR", "COTI", "JASMY", "ELF", "OCEAN", "SKL",
  "MASK", "MTL", "RLC", "AGIX", "PYR", "UMA", "STORJ", "BNT", "DODO", "KNC",
  "ACH", "XNO", "RAD", "IDEX", "PERP", "MDT", "TVK", "BOND", "AUDIO", "BETA",
  "VET", "HBAR", "TFUEL", "THETA", "GNO", "LIT", "CELR", "ALICE", "ARK",
  "PHA", "CFX", "CTSI", "BEL", "DENT", "RAY", "KDA", "UOS", "STRAX", "DGB", 
  "RDNT","APT","AZERO","LUNC","SEI","KMD","ZKU", "CLV", "CTX","MINA", 
  "ANIME","KANU","ZK","ORBS","BIGTIME","ARTY","VRA","XDC","CTXC","NOT"
];

const commonQuotes1 = ["MUBI", "TOWER","TRUMP"];
const commonQuotes2 =[
    "WOLF",
    "ELIZA",
    "AICMP",
    "BANANA",
    "DOG",
    "BULL",
    "BDC",
    "1CAT",
    "TRUMP",
    "BULL",
    "TREMP",
    "HOPPY",
    "TRUMP",
    "MANYU",
    "MON",
    "TOWER",
    "TRAC",
    "PENG",
    "PRO",
    "SHRUB",
    "NUB",
    "SORA",
    "TCAPY",
    "URO",
    "BANANA"
];
function getCoinName(pair) {
         
    for (const quote of commonQuotes) {
        if (pair.endsWith(quote)) {
            const base = pair.slice(0, -quote.length); // Extract base coin
            return [base, quote];
        }
    }
    return [pair]; // Return original if no quote match
}

module.exports = { getCoinName,commonQuotes2 };
