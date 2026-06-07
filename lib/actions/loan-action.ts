'use server';

import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { updateBankTreasury } from "@/lib/actions/treasury-action";
import { getLivePrice } from "@/components/exchange-rate-monitor";

export async function processLoanRequest(userId: string, currencySymbol: string, amount: number, months: number) {
  try {
    // 1. Megkeressük a pénznem UUID-jét
    const { data: currency, error: currencyErr } = await supabase
      .from('currencies')
      .select('id, type')
      .eq('symbol', currencySymbol)
      .single();

    if (currencyErr || !currency) {
      throw new Error('A megadott valuta nem létezik az adatbázisban.');
    }

    // 2. Kiszámoljuk a lejárati dátumot
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + months);

    // 3. Beillesztés a user_loans táblába
    // A loan_date és created_at autómatikusan is kaphat értéket, de biztosra megyünk:
    const now = new Date().toISOString();
    const { error: loanErr } = await supabase
      .from('user_loans')
      .insert({
        user_id: userId,
        loan_amount: amount,
        amount_repaid: 0,
        currency_id: currency.id,
        loan_date: now,
        repayment_deadline: deadline.toISOString()
      });

    if (loanErr) {
      console.error("Hitel kérelem rögzítési hiba:", loanErr);
      throw new Error(`Nem sikerült elmenteni a hitelkérelmet: ${loanErr.message}`);
    }

    // 4. A kért hitelt AZONNAL jóváírjuk a user egyenlegén (wallets tábla)
    // Megnézzük létezik-e tárca
    const { data: wallet, error: fetchWalletErr } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .eq('currency_symbol', currencySymbol)
      .single();

    let destWalletId = "";
    
    if (!wallet) {
      // Nem létezik tárca, létrehozni kell
      const { data: newWallet, error: insertWalletErr } = await supabase
        .from('wallets')
        .insert({ user_id: userId, currency_symbol: currencySymbol, balance: amount })
        .select('id')
        .single();
        
      if (insertWalletErr) throw new Error("A tárca létrehozása sikertelen.");
      destWalletId = newWallet.id;
    } else {
      destWalletId = wallet.id;
      // Frissítjük a meglévő egyenleget
      const { error: updateErr } = await supabase
        .from('wallets')
        .update({ balance: Number(wallet.balance) + amount })
        .eq('id', destWalletId);
        
      if (updateErr) throw new Error("A hitelösszeg egyenleghez adása sikertelen.");
    }
    
    // 5. Tranzakció regisztrálása a transactions táblába, hogy a wallet előzményeiben is látszódjon
    await supabase.from('transactions').insert({
        wallet_id: destWalletId,
        type: 'DEPOSIT', // Hitelből származó bejövő
        amount: amount,
        status: 'COMPLETED',
        metadata: { info: "Hitel folyósítás" }
    });

    // 6. Treasury - total_loans_issued növelése dollár értékkel
    try {
      const price = await getLivePrice(currencySymbol);
      const usdValue = amount * price;

      // Először lekérjük a treasury jelenlegi adatát
      const { data: treasury } = await supabase.from('bank_treasury').select('*').limit(1).single();
      if (treasury) {
        const newTotalLoans = Number(treasury.total_loans_issued || 0) + usdValue;
        let updatePayload: any = { total_loans_issued: newTotalLoans, last_updated: new Date().toISOString() };
        
        // Esetleg emellett DEPOSIT miatt módosítjuk a crypto / fiat balance-t is? (Hiszen ez folyósított pénz, a Bank kasszájából ment ki: mínusz)
        if (currency.type === 'FIAT') {
           updatePayload.total_fiat_balance = Number(treasury.total_fiat_balance || 0) - usdValue;
        } else {
           updatePayload.total_crypto_balance = Number(treasury.total_crypto_balance || 0) - usdValue;
        }

        await supabase.from('bank_treasury').update(updatePayload).eq('id', treasury.id);
      }
    } catch (err) {
      console.error("Treasury hitel update hiba:", err);
    }

    return { success: true };
  } catch (err: any) {
    console.error("processLoanRequest error:", err);
    throw err;
  }
}
