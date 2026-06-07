/**
 * Lekéri az élő árfolyamot egy adott szimbólumhoz USD-ben.
 * @param symbol A valuta szimbóluma (pl. BTC, ETH, EUR)
 */
export async function getLivePrice(symbol: string): Promise<number> {
  try {
    // Ingyenes API hívás (nem igényel kulcsot alap szinten)
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/price?fsym=${symbol.toUpperCase()}&tsyms=USD`
    );
    const data = await response.json();
    
    // Visszaadjuk az USD árat, vagy 1-et, ha valami hiba van (pl. USD/USD esetén)
    return data.USD || 1;
  } catch (error) {
    console.error("Hiba az élő árfolyam lekérésekor:", error);
    return 1;
  }
}