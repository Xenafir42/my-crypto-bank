"use server";

import { createClient } from "@supabase/supabase-js";

// FIGYELEM: Itt a SERVICE_ROLE kulcsot használjuk, mert a bejelentkezett 
// felhasználónak az RLS miatt nincs joga csak úgy átírni a saját egyenlegét!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function processRepayment(userId: string, loanId: string, repayAmount: number) {
  try {
    if (repayAmount <= 0) throw new Error("Az összegnek nagyobbnak kell lennie 0-nál!");

    // 1. Lekérjük a hitel adatait és a hozzá tartozó valuta szimbólumát
    const { data: loan, error: loanErr } = await supabase
      .from('user_loans')
      .select('*, currencies ( symbol )')
      .eq('id', loanId)
      .eq('user_id', userId)
      .single();

    if (loanErr || !loan) throw new Error("Hitel nem található!");

    const remainingAmount = Number(loan.loan_amount) - Number(loan.amount_repaid);
    if (repayAmount > remainingAmount) {
      throw new Error(`Nem fizethetsz vissza többet, mint a hátralék! (Hátralék: ${remainingAmount})`);
    }

    const currencySymbol = loan.currencies.symbol;

    // 2. Ellenőrizzük a tárca egyenlegét
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .eq('currency_symbol', currencySymbol)
      .single();

    if (walletErr || !wallet || Number(wallet.balance) < repayAmount) {
      throw new Error(`Nincs elég fedezet a ${currencySymbol} tárcádban a törlesztéshez!`);
    }

    // 3. Levonás a tárcából
    const newBalance = Number(wallet.balance) - repayAmount;
    const { error: deductErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', wallet.id);

    if (deductErr) throw new Error("Hiba a levonás során!");

    // 4. Hitel frissítése (hozzáadjuk a törlesztést)
    const newRepaidTotal = Number(loan.amount_repaid) + repayAmount;

    const { error: updateLoanErr } = await supabase
      .from('user_loans')
      .update({ 
        amount_repaid: newRepaidTotal
      })
      .eq('id', loanId);

    if (updateLoanErr) throw new Error("Hiba a hitel frissítésekor!");

    // 5. Tranzakció naplózása
    await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      type: 'LOAN_REPAYMENT',
      amount: -repayAmount,
      status: 'COMPLETED'
    });

    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}