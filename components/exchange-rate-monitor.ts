/*/**
 * Lekéri az élő árfolyamot egy adott szimbólumhoz USD-ben.
 * @param symbol A valuta szimbóluma (pl. BTC, ETH, EUR)
 
export async function getLivePrice(symbol: string): Promise<number> {
  try {
    // Ingyenes API hívás (nem igényel kulcsot alap szinten)
    const response = await fetch(
      ``
    );
    const data = await response.json();
    
    // Visszaadjuk az USD árat, vagy 1-et, ha valami hiba van (pl. USD/USD esetén)
    return data.USD || 1;
  } catch (error) {
    console.error("Hiba az élő árfolyam lekérésekor:", error);
    return 1;
  }
}*/

// CoinGecko API ID-k leképzése a szimbólumokból
const symbolToIdMap: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  ada: "cardano",
  dot: "polkadot",
  doge: "dogecoin",
  // Fontos: A CoinGecko egy KRIPTO API. A tiszta fiat valuták közötti váltást (pl. EUR -> USD)
  // alapvetően nem támogatja ezen a végponton. Ha EUR-t is akarsz mérni, oda fiat API kell.
};

/**
 * Lekéri az élő árfolyamot egy adott szimbólumhoz USD-ben.
 * @param symbol A valuta szimbóluma (pl. BTC, ETH)
 */
export async function getLivePrice(symbol: string): Promise<number> {
  try {
    const cleanSymbol = symbol.toLowerCase().trim();

    // Ha magát az USD-t kérik, az USD/USD árfolyam mindig 1
    if (cleanSymbol === "usd") return 1;

    // Megkeressük a CoinGecko által használt ID-t
    const coinId = symbolToIdMap[cleanSymbol];

    if (!coinId) {
      console.warn(`Nem támogatott vagy ismeretlen szimbólum: ${symbol}`);
      return 1; // Biztonsági mentés: ha nem ismerjük, 1-et adunk vissza
    }

    // Kulcs beolvasása a környezeti változókból (Next.js példa)
    const apiKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
    
    if (!apiKey) {
      console.error("Hiányzik a CoinGecko API kulcs a .env.local fájlból!");
      return 1;
    }

    // Dinamikus URL az ID-val és az API kulccsal
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${coinId}&x_cg_demo_api_key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API hiba: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // A CoinGecko válasza pl: { "bitcoin": { "usd": 63250 } }
    // Így dinamikusan kell kiolvasnunk az adatot:
    const price = data[coinId]?.usd;

    if (price === undefined) {
      console.warn(`Nem található árfolyam a következő ID-hoz: ${coinId}`);
      return 1;
    }
    
    return price;
  } catch (error) {
    console.error(`Hiba az élő árfolyam lekérésekor (${symbol}):`, error);
    return 1;
  }
}