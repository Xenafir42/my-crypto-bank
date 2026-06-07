"use server";

import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
//import { supabase } from "@/lib/supabase";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { updateBankTreasury } from "@/lib/actions/treasury-action";
import { getLivePrice } from "@/components/exchange-rate-monitor";

/**
 * Automatikus Solana kifizetés és belső egyenleg kezelése
 */
export async function processInstantWithdraw(userId: string, symbol: string, amount: number, destination: string) {
  try {
    console.log(`[WITHDRAW START] User: ${userId}, Symbol: ${symbol}, Amount: ${amount}`);

    // 1. Felhasználói tárca lekérése az adatbázisból
    // Fontos: a symbol-t nagybetűssé tesszük, hogy biztosan egyezzen a DB-vel
    const searchSymbol = symbol.toUpperCase();

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance, user_id')
      .eq('user_id', userId)
      .eq('currency_symbol', searchSymbol)
      .single();

    // Debug log a szerver konzolba, hogy lásd mit talál a Supabase
    console.log("[DB QUERY RESULT]", { wallet, walletError });

    // --- FEDEZET ELLENŐRZÉSE ---
    // Használjuk a Number() konverziót, hogy elkerüljük a típusbeli eltéréseket
    const currentBalance = wallet ? Number(wallet.balance) : 0;

    if (walletError || !wallet || currentBalance < amount) {
      const errorMsg = `Nincs elég fedezet a belső tárcádban (Elérhető: ${currentBalance} ${searchSymbol})`;
      console.error(`[BALANCE ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // 2. SOLANA TRANZAKCIÓ INDÍTÁSA
    const connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
    
    // Bank tárcájának betöltése a .env-ből
    const secretKey = bs58.decode(process.env.BANK_PRIVATE_KEY!);
    const senderKeypair = Keypair.fromSecretKey(secretKey);
    const toPublicKey = new PublicKey(destination);

    // Bank (Phantom) on-chain egyenlegének ellenőrzése
    const bankBalance = await connection.getBalance(senderKeypair.publicKey);
    const lamportsToSend = amount * 1_000_000_000;

    if (bankBalance < lamportsToSend) {
      throw new Error("A Bank központi tárcájában (Phantom) nincs elég teszt-SOL a kifizetéshez!");
    }

    const solTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: lamportsToSend,
      })
    );

    console.log("[BLOCKCHAIN] Tranzakció küldése...");
    const signature = await sendAndConfirmTransaction(connection, solTransaction, [senderKeypair]);
    console.log("[BLOCKCHAIN SUCCESS] Hash:", signature);

    // 3. ADATBÁZIS FRISSÍTÉSE (Csak ha a blokklánc sikeres volt!)
    
    // Egyenleg levonása
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: Number(wallet.balance) - amount })
      .eq('id', wallet.id);

    if (updateError) console.error("[DB UPDATE ERROR]", updateError);

    // Tranzakció rögzítése a naplózáshoz
    const { error: transError } = await supabase
      .from('transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'WITHDRAW',
        amount: -amount,
        status: 'COMPLETED',
        metadata: { 
          destination: destination,
          solanaHash: signature,
          automated: true 
        }
      });

    if (transError) console.error("[DB INSERT ERROR]", transError);

    try {
      const price = await getLivePrice(searchSymbol);
      const valUsd = amount * price;
      // Solana automatikus kifizetés CRYPTO kategória
      await updateBankTreasury({ cryptoChangeUsd: -Math.abs(valUsd) });
    } catch (err) {
      console.error("[TREASURY UPDATE ERROR]", err);
    }

    return { success: true, hash: signature };

  } catch (error: any) {
    console.error("[AUTOMATED WITHDRAW FATAL ERROR]:", error.message);
    return { success: false, error: error.message };
  }
}