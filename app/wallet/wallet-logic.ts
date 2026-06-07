// app/wallet/wallet-logic.ts
import { supabase } from "@/lib/supabase";

export async function getActiveWallets(userId: string) {
  const { data, error } = await supabase
    .from('wallets')
    .select(`
      id,
      balance,
      currency_symbol,
      currencies (
        name,
        type
      )
    `)
    .eq('user_id', userId)
    .gt('balance', 0) // Csak a 0-nál nagyobb egyenlegek
    .order('balance', { ascending: false });

  if (error) {
    console.error("Hiba a tárcák lekérésekor:", error.message);
    return [];
  }
  
  return data || [];
}


// app/wallet/transfer-logic.ts
import { getUserWalletData } from "@/app/swap/swap-logic";

/**
 * Befizetési kérelem indítása
 */
export async function createDepositRequest(userId: string, symbol: string, amount: number, txId?: string) {
  // 1. Keressük meg vagy hozzuk létre a tárcát
  const { data: wallet } = await supabase
    .from('wallets')
    .upsert({ user_id: userId, currency_symbol: symbol }, { onConflict: 'user_id,currency_symbol' })
    .select('id')
    .single();

  if (!wallet) throw new Error("Tárca nem található");

  // Összerakjuk a metadatát, ha a felhasználó megadott tranzakció azonosítót
  const metadata = txId ? { user_tx_id: txId } : {};

  // 2. Tranzakció rögzítése PENDING státusszal
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'DEPOSIT',
      amount: amount,
      status: 'PENDING',
      metadata: metadata // Itt mentjük el a banki azonosítót!
    })
    .select('id')
    .single();

  if (error) throw error;
  
  return data.id;
}

/**
 * Kifizetési kérelem indítása
 */
export async function createWithdrawRequest(userId: string, symbol: string, amount: number, iban: string) {
  const wallet = await getUserWalletData(userId, symbol);
  if (!wallet || Number(wallet.balance) < amount) throw new Error("Nincs elég fedezet");

  // 1. Tranzakció rögzítése PENDING státusszal
  const { error: transError } = await supabase
    .from('transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'WITHDRAW',
      amount: -amount, // Negatív összeg a levonáshoz
      status: 'PENDING',
      metadata: { iban: iban }
    });

  if (transError) throw transError;

  // 2. AZONNALI levonás a tárcából
  const { error: updateError } = await supabase
    .from('wallets')
    .update({ balance: Number(wallet.balance) - amount })
    .eq('id', wallet.id);

  if (updateError) throw updateError;

  return true;
}

// app/wallet/wallet-logic.ts bővítése

/**
 * Lekéri a felhasználó függőben lévő (PENDING) tranzakcióit
 */
export async function getPendingTransactions(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      type,
      amount,
      status,
      created_at,
      wallets!inner (
        currency_symbol,
        user_id
      )
    `)
      .eq('wallets.user_id', userId)
      .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Hiba a függő tranzakciók lekérésekor:", error.message);
    return [];
  }
  
  return data || [];
}

/**
 * Lekéri a felhasználó összes (negatív) tranzakcióját (história)
 */
export async function getUserTransactions(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      type,
      amount,
      status,
      created_at,
      metadata,
      from_currency,
      to_currency,
      target_amount,
      wallets!inner (
        currency_symbol,
        user_id
      )
    `)
    .eq('wallets.user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Hiba a tranzakciók lekérésekor:", error.message);
    return [];
  }

  // A PostgREST logikai hibája miatt JS szinten filterezzük ki a pozitív SWAP tranzakciókat
  const filteredData = (data || []).filter(t => {
    if (t.type === 'SWAP') {
      return t.amount < 0;
    }
    return true;
  });

  return filteredData;
}

export async function getAvailableCurrencies() {
  const { data, error } = await supabase
    .from('currencies')
    .select('symbol, name, type')
    .order('symbol');

  if (error) {
    console.error("Hiba a valuták lekérésekor:", error.message);
    return [];
  }
  return data || [];
}