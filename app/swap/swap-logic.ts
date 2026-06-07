import {getLivePrice} from "@/components/exchange-rate-monitor";
// app/swap/swap-logic.ts
import { supabase } from "@/lib/supabase";
import { recordSwapTransactions } from "@/lib/actions/swap-action";

/**
 * Lekéri az összes elérhető valutát.
 */
export async function getCurrencies() {
  const { data, error } = await supabase
    .from('currencies')
    .select('symbol, name, type')
    .order('name', { ascending: true });

  if (error) return [];
  return data || [];
}

/**
 * Lekéri a felhasználó egyenlegét és a tárca ID-ját.
 */
export async function getUserWalletData(userId: string, symbol: string) {
  if (!userId || !symbol) return null;

  const { data, error } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('user_id', userId)
    .eq('currency_symbol', symbol)
    .single();

  if (error) return null;
  return data;
}

/**
 * Lekéri a felhasználó egyenlegét (kompatibilitás miatt).
 */
export async function getUserBalance(userId: string, symbol: string) {
  const data = await getUserWalletData(userId, symbol);
  return data?.balance || 0;
}



/**
 * Ellenőrzi a fedezetet.
 */
export function hasEnoughFunds(balance: number, amountToSpend: number): boolean {
  const numAmount = typeof amountToSpend === 'string' ? parseFloat(amountToSpend) : amountToSpend;
  if (isNaN(numAmount) || numAmount <= 0) return false;
  return balance >= numAmount;
}

/**
 * VÉGLEGES EXECUTE SWAP: 1% transaction fee-vel
 */
export async function executeSwap(userId: string, fromSym: string, toSym: string, amount: number) {
  // 1. 1% Transaction Fee számítás
  const transactionFee = amount * 0.01; // 1% fee
  const amountAfterFee = amount - transactionFee; // Valódi swap összeg

  // 2. Árfolyam számítás
  const priceFrom = await getLivePrice(fromSym);
  const priceTo = await getLivePrice(toSym);
  const rate = priceFrom / priceTo;
  const toAmount = amountAfterFee * rate;

  // 3. Fee USD-ben
  const feeInUSD = transactionFee * priceFrom;

  // 4. FORRÁS tárca adatainak lekérése
  const sourceWallet = await getUserWalletData(userId, fromSym);
  if (!sourceWallet) throw new Error("Forrás tárca nem található");

  // 5. Ellenőrzi, hogy van-e elég egyenleg (az 1% fee-t is beleértve)
  if (sourceWallet.balance < amount) {
    throw new Error("Nincs elég egyenleg a tranzakcióhoz (1% fee-t is beleértve)");
  }

  // 6. Levonás a forrás tárcából (az egész összeget, beleértve a fee-t)
  const { error: error1 } = await supabase
    .from('wallets')
    .update({ balance: Number(sourceWallet.balance) - amount })
    .eq('id', sourceWallet.id);

  if (error1) throw error1;

  // 7. CÉL tárca biztosítása (Upsert) és ID lekérése
  const { data: destWallet, error: error2 } = await supabase
    .from('wallets')
    .upsert({ 
      user_id: userId, 
      currency_symbol: toSym 
    }, { onConflict: 'user_id,currency_symbol' })
    .select('id, balance')
    .single();

  if (error2 || !destWallet) throw new Error("Cél tárca hiba");

  // 8. Jóváírás a cél tárcában (csak az amountAfterFee kerül át)
  const { error: error3 } = await supabase
    .from('wallets')
    .update({ balance: Number(destWallet.balance) + toAmount })
    .eq('id', destWallet.id);

  if (error3) throw error3;

  // 9. TRANZAKCIÓK RÖGZÍTÉSE - SERVER ACTION-BAN (ADMIN JOGOSULTSÁG)
  try {
    await recordSwapTransactions(sourceWallet.id, destWallet.id, amount, toAmount, toAmount, fromSym, toSym, feeInUSD);
    console.log("Tranzakciók sikeresen rögzítve");
  } catch (transactionError: any) {
    console.error("Tranzakciók rögzítési hiba:", transactionError);
    throw transactionError;
  }

  return { success: true, feeCharged: feeInUSD, amountReceived: toAmount };
}