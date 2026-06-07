'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { updateBankTreasury } from './treasury-action';

/**
 * Server Action: Swap tranzakciók rögzítése (admin jogosultság)
 */
export async function recordSwapTransactions(
  sourceWalletId: string,
  destWalletId: string,
  sourceAmount: number,
  destAmount: number,
  targetAmount: number,
  fromCurrency: string,
  toCurrency: string,
  feeUsd: number = 0
) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Admin kulcs
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    // Forrás tranzakció (jelöljük a forrás és cél valutát)
    const { error: error1 } = await supabase
      .from('transactions')
      .insert({
        wallet_id: sourceWalletId,
        type: 'SWAP',
        amount: -sourceAmount,
        status: 'COMPLETED',
        from_currency: fromCurrency,
        to_currency: toCurrency,
        target_amount: targetAmount
      });

    if (error1) {
      console.error("Forrás tranzakció hiba:", error1);
      throw new Error(`Forrás tranzakció sikertelen: ${error1.message}`);
    }

    // Cél tranzakció (jelöljük a forrás és cél valutát)
    const { error: error2 } = await supabase
      .from('transactions')
      .insert({
        wallet_id: destWalletId,
        type: 'SWAP',
        amount: destAmount,
        status: 'COMPLETED',
        from_currency: fromCurrency,
        to_currency: toCurrency,
        target_amount: targetAmount
      });

    if (error2) {
      console.error("Cél tranzakció hiba:", error2);
      throw new Error(`Cél tranzakció sikertelen: ${error2.message}`);
    }

    // Kincstári profit regisztrálása
    if (feeUsd > 0) {
      await updateBankTreasury({ feeUsd: feeUsd });
    }

    console.log("Mindkét tranzakció sikeresen rögzítve");
    return { success: true };
  } catch (error: any) {
    console.error("Server Action hiba:", error);
    throw error;
  }
}
