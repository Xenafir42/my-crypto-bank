'use server';

import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import crypto from "crypto";

type TreasuryUpdateParams = {
  fiatChangeUsd?: number;
  cryptoChangeUsd?: number;
  feeUsd?: number;
};

export async function updateBankTreasury(params: TreasuryUpdateParams) {
  try {
    // Kikeressük a treasury sort
    const { data: treasury, error: fetchErr } = await supabase
      .from('bank_treasury')
      .select('*')
      .limit(1)
      .single();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.error("Hiba a bank_treasury lekérésekor:", fetchErr);
      return false;
    }

    const fiatChange = params.fiatChangeUsd || 0;
    const cryptoChange = params.cryptoChangeUsd || 0;
    const feeUsd = params.feeUsd || 0;

    if (!treasury) {
      // Ha még nincs, létrehozzuk
      const newId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from('bank_treasury').insert({
        id: newId,
        total_fiat_balance: fiatChange,
        total_crypto_balance: cryptoChange,
        total_loans_issued: 0,
        transaction_fee_revenue: feeUsd,
        interest_revenue: 0,
        last_updated: new Date().toISOString()
      });
      if (insertErr) console.error("Hiba insert során:", insertErr);
      return true;
    }

    // Frissítjük a meglévő sort
    const newFiat = Number(treasury.total_fiat_balance || 0) + fiatChange;
    const newCrypto = Number(treasury.total_crypto_balance || 0) + cryptoChange;
    const newFee = Number(treasury.transaction_fee_revenue || 0) + feeUsd;

    const { error: updateErr } = await supabase.from('bank_treasury')
      .update({
        total_fiat_balance: newFiat,
        total_crypto_balance: newCrypto,
        transaction_fee_revenue: newFee,
        last_updated: new Date().toISOString()
      })
      .eq('id', treasury.id);
      
    if (updateErr) console.error("Hiba update során:", updateErr);

    return true;
  } catch (err) {
    console.error("Váratlan hiba a treasury frissítésekor:", err);
    return false;
  }
}
