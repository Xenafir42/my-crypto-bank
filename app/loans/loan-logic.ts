import { getAvailableCurrencies } from "@/app/wallet/wallet-logic";
import { supabase } from "@/lib/supabase";
import { processLoanRequest } from "@/lib/actions/loan-action";

export async function getCurrencies() {
  return await getAvailableCurrencies();
}

export async function requestLoan(userId: string, currencySymbol: string, amount: number, months: number) {
  // A biztonságos mentés miatt áthelyeztük a Server Action-ba!
  return await processLoanRequest(userId, currencySymbol, amount, months);
}

export async function getUserLoans(userId: string) {
  const { data, error } = await supabase
    .from('user_loans')
    .select(`
      id,
      loan_amount,
      amount_repaid,
      loan_date,
      repayment_deadline,
      currencies!inner (
        symbol
      )
    `)
    .eq('user_id', userId)
    .order('loan_date', { ascending: false });

  if (error) {
    console.error("Hiba a hitelek lekérésekor:", error.message);
    return [];
  }
  return data || [];
}
