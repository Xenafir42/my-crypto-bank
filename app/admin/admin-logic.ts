// app/admin/admin-logic.ts
import { supabase } from "@/lib/supabase";
import { updateBankTreasury } from "@/lib/actions/treasury-action";
import { getLivePrice } from "@/components/exchange-rate-monitor";

export async function getPendingTransactionsAdmin() {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      wallet_id,
      type,
      amount,
      status,
      created_at,
      metadata,
      wallets (
        currency_symbol,
        profiles (
          email,
          username,
          fullname
        )
      )
    `)
    .eq('status', 'PENDING') // Győződj meg róla, hogy az adatbázisban is nagybetűs!
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Lekérdezési hiba az admin oldalon:", error.message);
    throw error;
  }

  return data || [];
}

export async function approveTransaction(transaction: any) {
  if (transaction.type === 'DEPOSIT') {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', transaction.wallet_id)
      .single();

    // HIBAJAVÍTÁS: Itt ellenőrizzük, hogy létezik-e a tárca
    if (!wallet) throw new Error("A céltárca nem található!");

    const newBalance = Number(wallet.balance) + Number(transaction.amount);

    const { error: walletError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', transaction.wallet_id);

    if (walletError) throw walletError;
  }

  const { error: transError } = await supabase
    .from('transactions')
    .update({ status: 'COMPLETED' })
    .eq('id', transaction.id);

  if (transError) throw transError;

  try {
    // Treasury frissítése jóváhagyás után
    const sym = transaction.wallets.currency_symbol;
    const { data: currencyData } = await supabase.from('currencies').select('type').eq('symbol', sym).single();
    const cType = currencyData?.type;

    const price = await getLivePrice(sym);
    const valUsd = Math.abs(Number(transaction.amount)) * price;

    if (transaction.type === 'DEPOSIT') {
      if (cType === 'FIAT') await updateBankTreasury({ fiatChangeUsd: valUsd });
      if (cType === 'CRYPTO') await updateBankTreasury({ cryptoChangeUsd: valUsd });
    } else if (transaction.type === 'WITHDRAW') {
      if (cType === 'FIAT') await updateBankTreasury({ fiatChangeUsd: -valUsd });
      if (cType === 'CRYPTO') await updateBankTreasury({ cryptoChangeUsd: -valUsd });
    }
  } catch (err) {
    console.error("Treasury frissítési hiba:", err);
  }

  return true;
}

export async function rejectTransaction(transaction: any) {
  if (transaction.type === 'WITHDRAW') {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', transaction.wallet_id)
      .single();

    // HIBAJAVÍTÁS: Itt is lekezeljük a null esetet
    if (!wallet) throw new Error("A forrástárca nem található a visszatérítéshez!");

    const refundBalance = Number(wallet.balance) + Math.abs(Number(transaction.amount));

    await supabase
      .from('wallets')
      .update({ balance: refundBalance })
      .eq('id', transaction.wallet_id);
  }

  const { error } = await supabase
    .from('transactions')
    .update({ status: 'REJECTED' })
    .eq('id', transaction.id);

  if (error) throw error;
  return true;
}