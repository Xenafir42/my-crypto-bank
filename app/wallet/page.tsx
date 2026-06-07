"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  getActiveWallets, 
  getPendingTransactions, 
  createDepositRequest, 
  createWithdrawRequest,
  getAvailableCurrencies,
  getUserTransactions
} from "./wallet-logic";
import { getUserLoans } from "@/app/loans/loan-logic";
import { processInstantWithdraw } from "@/lib/actions/withdraw-action";
// FIGYELEM: Ezt az importot hozzáadtuk! Győződj meg róla, hogy a fájl létezik.
import { processRepayment } from "@/lib/actions/repay-action";
import { getLivePrice } from "@/components/exchange-rate-monitor";
import { Wallet, Loader2, ArrowUpCircle, ArrowDownCircle, X, Clock, Landmark, Globe, CheckCircle2, RefreshCcw } from "lucide-react";

type WalletAsset = {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  livePriceUsd: number;
  totalUsdValue: number;
};

type CurrencyDef = {
  symbol: string;
  name: string;
  type: string;
};

export default function WalletPage() {
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [pendingTrans, setPendingTrans] = useState<any[]>([]);
  const [userTrans, setUserTrans] = useState<any[]>([]);
  const [availableCurrencies, setAvailableCurrencies] = useState<CurrencyDef[]>([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);

  // Modal és űrlap állapotok (Módosítva a "repay" típussal)
  const [activeModal, setActiveModal] = useState<"deposit" | "withdraw" | "repay" | null>(null);
  const [withdrawMethod, setWithdrawMethod] = useState<"bank" | "crypto">("bank");
  const [selectedSymbol, setSelectedSymbol] = useState("USD");
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [solAddress, setSolAddress] = useState("");
  const [depositTxId, setDepositTxId] = useState(""); 
  const [refCode, setRefCode] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // ÚJ: Törlesztéshez szükséges állapotok
  const [repayAmount, setRepayAmount] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  useEffect(() => {
    loadPortfolio();
  }, []);

  async function loadPortfolio() {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const [walletsData, pendingData, currenciesData, historyData, loansData] = await Promise.all([
        getActiveWallets(user.id),
        getPendingTransactions(user.id),
        getAvailableCurrencies(),
        getUserTransactions(user.id),
        getUserLoans(user.id) 
      ]);

      setPendingTrans(pendingData);
      setAvailableCurrencies(currenciesData);
      setUserTrans(historyData);

      const enrichedLoans = await Promise.all(loansData.map(async (loan: any) => {
        const sym = loan.currencies.symbol;
        const livePrice = await getLivePrice(sym);
        const usdValue = Number(loan.loan_amount) * livePrice;
        return { ...loan, usdValue, symbol: sym };
      }));
      setActiveLoans(enrichedLoans);

      if (currenciesData.length > 0 && selectedSymbol === "USD") {
        setSelectedSymbol(currenciesData[0].symbol);
      }

      let portfolioTotal = 0;
      const enrichedAssets: WalletAsset[] = await Promise.all(
        walletsData.map(async (wallet: any) => {
          const symbol = wallet.currency_symbol;
          const balance = Number(wallet.balance);
          const livePrice = await getLivePrice(symbol);
          const usdValue = balance * livePrice;
          portfolioTotal += usdValue;

          return {
            id: wallet.id,
            symbol: symbol,
            name: wallet.currencies?.name || symbol,
            balance: balance,
            livePriceUsd: livePrice,
            totalUsdValue: usdValue
          };
        })
      );

      enrichedAssets.sort((a, b) => b.totalUsdValue - a.totalUsdValue);
      setAssets(enrichedAssets);
      setTotalPortfolioValue(portfolioTotal);
    } catch (err) {
      console.error("Hiba a portfólió betöltésekor:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const selectedCurrencyObj = availableCurrencies.find(c => c.symbol === selectedSymbol);
  const isFiatDeposit = activeModal === "deposit" && selectedCurrencyObj?.type === "FIAT";
  const isCryptoDeposit = activeModal === "deposit" && selectedCurrencyObj?.type === "CRYPTO";

  // ÚJ: Törlesztés logika
  const handleRepay = async () => {
    if (!selectedLoanId) return;
    setIsProcessing(true);
    try {
      const numAmount = parseFloat(repayAmount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("Érvénytelen összeg");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nincs bejelentkezve");

      const result = await processRepayment(user.id, selectedLoanId, numAmount);
      
      if (!result.success) throw new Error(result.error);
      
      alert("Sikeres törlesztés!");
      setActiveModal(null);
      setRepayAmount("");
      setSelectedLoanId(null);
      await loadPortfolio(); 
    } catch (err: any) {
      alert("Hiba: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setIsProcessing(true);

    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("Érvénytelen összeg");

      if (activeModal === "deposit") {
        if ((isFiatDeposit || isCryptoDeposit) && !depositTxId) {
          throw new Error("Kérlek, add meg a kért azonosítót (Banki bizonylat vagy Tárca cím)!");
        }
        
        const code = await createDepositRequest(user.id, selectedSymbol, numAmount, depositTxId);
        setRefCode(code); 
      } else if (activeModal === "withdraw") {
        if (withdrawMethod === "crypto") {
          if (!solAddress) throw new Error("Kérlek add meg a Solana címet!");
          const result = await processInstantWithdraw(user.id, selectedSymbol, numAmount, solAddress);
          if (!result.success) throw new Error(result.error);
          alert(`Sikeres Solana kifizetés!\nHash: ${result.hash}`);
          setActiveModal(null);
        } else {
          if (!iban) throw new Error("Kérlek add meg az IBAN számot!");
          await createWithdrawRequest(user.id, selectedSymbol, numAmount, iban);
          alert("Kifizetési kérelem rögzítve! Az adminisztrátor hamarosan jóváhagyja.");
          setActiveModal(null);
        }
      }
      await loadPortfolio();
    } catch (err: any) {
      alert("Hiba: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500">
        <Loader2 className="animate-spin mb-4 text-blue-500" size={40} />
        <p className="animate-pulse">Portfólió szinkronizálása a blokklánccal...</p>
      </div>
    );
  }

  return (
    <div className="page-wrap w-full max-w-2xl mx-auto space-y-8 mt-10 px-4 pb-20 text-white">
      
      {/* --- FELSŐ ÖSSZESÍTŐ --- */}
      <div className="bg-gradient-to-b from-[#231a36] to-[#151124] border border-violet-900/60 p-10 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-60"></div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3">Teljes Portfólió Érték</h2>
        <div className="text-6xl font-black tracking-tighter mb-8">
          ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>

        <div className="flex gap-4 justify-center">
          <button 
            onClick={() => { setRefCode(null); setAmount(""); setDepositTxId(""); setActiveModal("deposit"); }}
            className="flex items-center gap-2 bg-violet-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-violet-400 transition-all active:scale-95 text-sm shadow-lg"
          >
            <ArrowDownCircle size={18} /> Deposit
          </button>
          <button 
            onClick={() => { setAmount(""); setActiveModal("withdraw"); }}
            className="flex items-center gap-2 bg-violet-950/50 text-white px-8 py-4 rounded-2xl font-bold hover:bg-violet-900/50 transition-all active:scale-95 text-sm border border-violet-900/60 shadow-lg"
          >
            <ArrowUpCircle size={18} /> Withdraw
          </button>
        </div>
      </div>

      {/* --- ESZKÖZÖK --- */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold px-2 italic tracking-tight text-zinc-200">Saját Assetek</h3>
        {assets.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 p-10 rounded-3xl text-center text-zinc-600 italic">
            Még nincs egyenleged. Töltsd fel a számládat!
          </div>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="group flex items-center justify-between bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] hover:border-zinc-500 transition-all shadow-sm">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-black border border-zinc-700 rounded-full flex items-center justify-center font-black text-sm text-blue-400 shadow-inner">
                  {asset.symbol}
                </div>
                <div>
                  <h4 className="font-bold text-lg">{asset.name}</h4>
                  <p className="text-zinc-500 font-mono text-sm">{asset.balance.toFixed(asset.symbol === 'SOL' ? 4 : 2)} {asset.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-xl">${asset.totalUsdValue.toLocaleString()}</div>
                <div className="text-zinc-600 text-[10px] font-bold mt-1 uppercase tracking-widest">Rate: ${asset.livePriceUsd.toFixed(2)}</div>
              </div>
            </div>
          ))
        )}

        {/* --- AKTÍV HITELEK --- */}
        {activeLoans.length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className="text-xl font-bold px-2 italic tracking-tight text-red-200/80">Törlesztendő Hitelek</h3>
            {activeLoans.map(loan => (
              <div key={loan.id} className="group flex flex-col bg-[#1f1118] border border-red-900/50 p-6 rounded-[2rem] hover:border-red-500 transition-all shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-black border border-red-900/40 rounded-full flex items-center justify-center font-black text-sm text-red-400 shadow-inner">
                      <Landmark size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white">Hitel</h4>
                      <p className="text-red-400/80 font-mono text-sm font-bold">
                        {Number(loan.loan_amount).toFixed(loan.symbol === 'SOL' ? 4 : 2)} {loan.symbol}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Felvéve: {new Date(loan.loan_date).toLocaleDateString('hu-HU')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xl text-red-100">
                      ~ ${loan.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-red-500/70 text-[10px] font-bold mt-1 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded inline-block">
                      Határidő: {new Date(loan.repayment_deadline).toLocaleDateString('hu-HU')}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-2 font-bold uppercase tracking-widest">
                      Már törlesztve: <span className="text-white">{Number(loan.amount_repaid).toFixed(2)} {loan.symbol}</span>
                    </div>
                  </div>
                </div>

                {/* ÚJ: Törlesztés gomb a kártya alján */}
                {Number(loan.amount_repaid) < Number(loan.loan_amount) && (
                  <button 
                    onClick={() => {
                      setSelectedLoanId(loan.id);
                      setRepayAmount("");
                      setActiveModal("repay");
                    }}
                    className="mt-6 w-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Törlesztés Indítása
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- PENDING TRANZAKCIÓK --- */}
      {pendingTrans.length > 0 && (
        <div className="pt-6 border-t border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-500 mb-4 px-2 flex items-center gap-2 uppercase tracking-widest">
            <Clock size={16} className="text-orange-500" /> Folyamatban lévő kérések
          </h3>
          <div className="space-y-3">
            {pendingTrans.map((trans) => (
              <div key={trans.id} className="bg-orange-500/5 border border-orange-500/10 p-5 rounded-2xl flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                    {trans.type === 'DEPOSIT' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-zinc-200">{trans.type} - {trans.wallets.currency_symbol}</div>
                    <p className="text-[10px] text-zinc-500 font-mono">{new Date(trans.created_at).toLocaleString('hu-HU')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-zinc-300">
                    {trans.amount > 0 ? '+' : ''}{Number(trans.amount).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-orange-500/60 font-bold uppercase">Jóváhagyásra vár...</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TRÖRTÉNETI TRANZAKCIÓK --- */}
      {userTrans.length > 0 && (
        <div className="pt-6 border-t border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-500 mb-4 px-2 flex items-center gap-2 uppercase tracking-widest">
            <Clock size={16} className="text-blue-500" /> Tranzakció Előzmények
          </h3>
          <div className="space-y-3">
            {userTrans.map((trans) => (
              <div key={trans.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center hover:border-zinc-700 transition-colors">
                <div className="flex gap-4 items-center">
                  <div className={`p-2 rounded-lg ${
                    trans.type === 'DEPOSIT' || trans.amount > 0 
                      ? 'bg-green-500/10 text-green-500' 
                      : trans.type === 'SWAP' 
                        ? 'bg-violet-500/10 text-violet-400'
                        : 'bg-red-500/10 text-red-500'
                  }`}>
                    {trans.type === 'DEPOSIT' || trans.amount > 0 ? <ArrowDownCircle size={20} /> : 
                     trans.type === 'SWAP' ? <RefreshCcw size={20} /> : <ArrowUpCircle size={20} />}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-zinc-200">
                      {trans.type} 
                      {trans.type === 'SWAP' ? ` (${trans.from_currency} -> ${trans.to_currency})` : ` - ${trans.wallets.currency_symbol}`}
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono">{new Date(trans.created_at).toLocaleString('hu-HU')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-zinc-300">
                    {trans.amount > 0 ? '+' : ''}{Number(trans.amount).toFixed(4)}
                  </div>
                  {trans.type === 'SWAP' && trans.target_amount && (
                    <div className="text-[10px] text-green-400 font-bold uppercase mt-1">
                      + {Number(trans.target_amount).toFixed(4)} {trans.to_currency}
                    </div>
                  )}
                  <div className={`text-[9px] font-bold uppercase mt-1 ${
                    trans.status === 'COMPLETED' ? 'text-green-500/60' : 
                    trans.status === 'REJECTED' ? 'text-red-500/60' : 'text-zinc-500/60'
                  }`}>
                    {trans.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODAL RENDSZER --- */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md p-10 rounded-[3rem] relative shadow-2xl">
            <button onClick={() => { setActiveModal(null); setRefCode(null); }} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
              <X size={28} />
            </button>
            
            <h3 className="text-3xl font-black mb-8 italic text-white capitalize">{activeModal}</h3>

            {!refCode ? (
              <>
                {/* ÚJ: TÖRLESZTÉS (REPAY) LOGIKA MEGJELENÍTÉSE */}
                {activeModal === "repay" ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                      <p className="text-xs text-red-200/80 text-center leading-relaxed">
                        A megadott összeg automatikusan levonásra kerül a megfelelő valutájú tárcádból.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 ml-2 font-bold uppercase tracking-widest">Törleszteni kívánt összeg</label>
                      <input 
                        type="number" 
                        value={repayAmount} 
                        onChange={(e) => setRepayAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-red-500 transition-all font-mono text-xl"
                      />
                    </div>
                    <button 
                      onClick={handleRepay}
                      disabled={isProcessing || !repayAmount}
                      className="w-full py-5 rounded-[1.5rem] font-black text-lg mt-4 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-30 bg-red-600 text-white hover:bg-red-500"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={22} />}
                      Befizetés Jóváhagyása
                    </button>
                  </div>
                ) : (
                  /* EREDETI DEPOSIT / WITHDRAW MEGJELENÍTÉS */
                  <div className="space-y-6">
                    {/* --- LEGÖRDÜLŐ VALUTA VÁLASZTÓ --- */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 ml-2 font-bold uppercase tracking-widest">Kiválasztott Valuta</label>
                      <div className="relative">
                        <select
                          value={selectedSymbol}
                          onChange={(e) => setSelectedSymbol(e.target.value)}
                          className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                        >
                          {activeModal === 'deposit' ? (
                            availableCurrencies.map(c => (
                              <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name}</option>
                            ))
                          ) : activeModal === 'withdraw' ? (
                            withdrawMethod === 'bank' ? (
                              availableCurrencies.filter(c => c.type === 'FIAT').map(c => (
                                <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name}</option>
                              ))
                            ) : (
                              availableCurrencies.filter(c => c.type === 'CRYPTO').map(c => (
                                <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name}</option>
                              ))
                            )
                          ) : null}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-500">
                          ▼
                        </div>
                      </div>
                    </div>

                    {/* Kifizetési mód választó */}
                    {activeModal === "withdraw" && (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setWithdrawMethod("bank")}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${withdrawMethod === "bank" ? 'bg-zinc-800 border-zinc-400 text-white' : 'bg-black border-zinc-800 text-zinc-600'}`}
                        >
                          <Landmark size={20} />
                          <span className="text-[10px] font-bold uppercase">Banki utalás</span>
                        </button>
                        <button 
                          onClick={() => setWithdrawMethod("crypto")}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${withdrawMethod === "crypto" ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black border-zinc-800 text-zinc-600'}`}
                        >
                          <Globe size={20} />
                          <span className="text-[10px] font-bold uppercase">Solana Chain</span>
                        </button>
                      </div>
                    )}

                    {/* Összeg beviteli mező */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 ml-2 font-bold uppercase tracking-widest">Összeg ({selectedSymbol})</label>
                      <input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-mono text-xl"
                      />
                    </div>

                    {/* --- FIAT DEPOSIT --- */}
                    {isFiatDeposit && (
                      <div className="p-5 bg-blue-900/10 border border-blue-900/40 rounded-3xl space-y-4 animate-in fade-in duration-300">
                        <p className="text-xs text-blue-200/70 leading-relaxed text-center">
                          Kérjük, utald el a kívánt összeget az alábbi bankszámlaszámra:
                        </p>
                        <div className="font-mono text-lg font-black text-blue-400 select-all text-center p-4 bg-black rounded-2xl border border-blue-900/30">
                          RO14BACX0000002256982000
                        </div>
                        
                        <div className="space-y-2 pt-4 border-t border-blue-900/30">
                          <label className="text-[10px] text-blue-500 font-bold uppercase ml-2">Tranzakció azonosítója (Banki bizonylat)</label>
                          <input 
                            type="text" 
                            value={depositTxId} 
                            onChange={(e) => setDepositTxId(e.target.value)}
                            placeholder="Pl. TX-123456789"
                            className="w-full bg-black border border-blue-900/50 p-4 rounded-xl text-white outline-none focus:border-blue-500 transition-all font-mono text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* --- CRYPTO DEPOSIT --- */}
                    {isCryptoDeposit && (
                      <div className="p-5 bg-orange-900/10 border border-orange-900/40 rounded-3xl space-y-4 animate-in fade-in duration-300">
                        <p className="text-xs text-orange-200/70 leading-relaxed text-center">
                          Kérjük, küldd el a pontos összeget az alábbi központi <b>{selectedSymbol}</b> tárcacímünkre:
                        </p>
                        <div className="font-mono text-sm font-black text-orange-400 select-all text-center p-4 bg-black rounded-2xl border border-orange-900/30 break-all">
                          {selectedSymbol === 'SOL' ? 'DX3SyQEUx9iNqM987Qna5YVGjxPN2fQE4eUb4rkznurp' : 'DX3SyQEUx9iNqM987Qna5YVGjxPN2fQE4eUb4rkznurp'}
                        </div>
                        
                        <div className="space-y-2 pt-4 border-t border-orange-900/30">
                          <label className="text-[10px] text-orange-500 font-bold uppercase ml-2">Küldő tárca címe (Ebből utaltál)</label>
                          <input 
                            type="text" 
                            value={depositTxId} 
                            onChange={(e) => setDepositTxId(e.target.value)}
                            placeholder="Pl. a te Phantom címed (DX9...)"
                            className="w-full bg-black border border-orange-900/50 p-4 rounded-xl text-white outline-none focus:border-orange-500 transition-all font-mono text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Withdraw Bank mező */}
                    {activeModal === "withdraw" && withdrawMethod === "bank" && (
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-500 ml-2 font-bold uppercase">Cél IBAN Számlaszám</label>
                        <input 
                          type="text" 
                          value={iban} 
                          onChange={(e) => setIban(e.target.value)}
                          placeholder="HU00 1177..."
                          className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-zinc-500 transition-all font-mono"
                        />
                      </div>
                    )}

                    {/* Withdraw Crypto mező */}
                    {activeModal === "withdraw" && withdrawMethod === "crypto" && (
                      <div className="space-y-2">
                        <label className="text-[10px] text-blue-500/70 ml-2 font-bold uppercase">Solana Wallet Cím (Devnet)</label>
                        <input 
                          type="text" 
                          value={solAddress} 
                          onChange={(e) => setSolAddress(e.target.value)}
                          placeholder="Cím (pl. DX3S...)"
                          className="w-full bg-black border border-blue-900/50 p-5 rounded-2xl text-blue-400 outline-none focus:border-blue-500 transition-all font-mono text-sm"
                        />
                      </div>
                    )}

                    {/* Fő akciógomb */}
                    <button 
                      onClick={handleAction}
                      disabled={isProcessing || !amount || ((isFiatDeposit || isCryptoDeposit) && !depositTxId)}
                      className={`w-full py-5 rounded-[1.5rem] font-black text-lg mt-4 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-30 
                        ${withdrawMethod === 'crypto' && activeModal === 'withdraw' ? 'bg-blue-600 text-white' : 'bg-white text-black'}`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          Feldolgozás...
                        </>
                      ) : (
                        <>
                          {activeModal === 'withdraw' && withdrawMethod === 'crypto' ? <Globe size={22} /> : <CheckCircle2 size={22} />}
                          Kérelem Beküldése
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Siker képernyő */
              <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={48} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Kérelem Rögzítve</h4>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed px-4">
                  {isFiatDeposit 
                    ? "A megadott tranzakció azonosítót elmentettük. Az adminisztrátor hamarosan ellenőrzi a beérkezett utalást, és jóváírja az összeget a tárcádban." 
                    : "A tranzakció sikeresen elküldve feldolgozásra."}
                </p>
                <button 
                  onClick={() => { setActiveModal(null); setRefCode(null); }} 
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  Vissza a tárcához
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}