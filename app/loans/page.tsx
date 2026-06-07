"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrencies, requestLoan, getUserLoans } from "./loan-logic";
import { Landmark, Loader2, CheckCircle2 } from "lucide-react";
import { getLivePrice } from "@/components/exchange-rate-monitor";

export default function LoansPage() {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("USD");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState(3);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const loansData = await getUserLoans(user.id);
        
        // Hozzáadjuk mindegyikhez a dollár értéket
        const enrichedLoans = await Promise.all(loansData.map(async (loan: any) => {
          const sym = loan.currencies.symbol;
          const livePrice = await getLivePrice(sym);
          const usdValue = Number(loan.loan_amount) * livePrice;
          return { ...loan, usdValue, symbol: sym };
        }));
        
        setActiveLoans(enrichedLoans);
      }

      const curData = await getCurrencies();
      setCurrencies(curData);
      
      if (curData.length > 0) setSelectedSymbol(curData[0].symbol);
      setLoading(false);
    }
    init();
  }, []);

  const handleApply = async () => {
    if (!userId) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Kérlek érvényes összeget adj meg!");
      return;
    }

    setIsProcessing(true);
    try {
      await requestLoan(userId, selectedSymbol, numAmount, months);
      setSuccess(true);
    } catch (err: any) {
      alert("Hiba történt: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-violet-500" size={40} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center shadow-lg">
          <CheckCircle2 size={64} />
        </div>
        <h2 className="text-3xl font-black italic tracking-tighter text-white">Hitel Jóváhagyva!</h2>
        <p className="text-zinc-400">Az összeg azonnal hozzáadódott a tárcád egyenlegéhez.</p>
        <button 
          onClick={() => { setSuccess(false); setAmount(""); }}
          className="bg-violet-900 border border-violet-500 px-6 py-3 rounded-full text-white font-bold hover:bg-violet-800 transition-colors"
        >
          Új hitel felvétele
        </button>
      </div>
    );
  }

  return (
    <div className="page-wrap flex flex-col items-center p-6 min-h-screen">
      <div className="w-full max-w-lg mt-10">
        <div className="text-center space-y-2 mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-500/10 text-violet-400 rounded-full mb-2 border border-violet-900/50">
            <Landmark size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black italic text-violet-200 uppercase tracking-tighter">Gyors Hitel</h1>
          <p className="text-zinc-400 text-sm">Igényelj kölcsönt azonnali jóváírással, minimális THM-el.</p>
        </div>

        <div className="bg-[#130f1e] border border-violet-900/50 p-8 rounded-[2rem] shadow-2xl space-y-6">
          
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 ml-2 font-bold uppercase tracking-widest">Kívánt Valuta</label>
            <div className="relative">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-violet-500 transition-all font-bold appearance-none cursor-pointer"
              >
                {currencies.map(c => (
                  <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-500">▼</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 ml-2 font-bold uppercase tracking-widest">Igényelt Összeg</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-violet-500 transition-all font-mono text-2xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 ml-2 font-bold uppercase tracking-widest">Törlesztési Futamidő ({months} Hónap)</label>
            <input 
              type="range" 
              min="1" 
              max="60" 
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-zinc-500 font-bold px-1">
              <span>1 Hónap</span>
              <span>5 Év</span>
            </div>
          </div>

          <div className="bg-violet-950/20 border border-violet-900/40 p-4 rounded-2xl text-sm font-medium text-violet-200/80">
            A kölcsön felvétele után a rendszer azonnal jóváírja neked a megadott <b>{amount || "0"} {selectedSymbol}</b> összeget.
          </div>

          <button 
            onClick={handleApply}
            disabled={isProcessing || !amount || parseFloat(amount) <= 0}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-wider py-5 rounded-[1.5rem] mt-4 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-30"
          >
            {isProcessing ? (
              <><Loader2 className="animate-spin" size={20} /> Feldolgozás...</>
            ) : "Hitel Felvétele"}
          </button>

        </div>

        {/* --- AKTÍV HITELEK LISTÁJA --- */}
        {activeLoans.length > 0 && (
          <div className="mt-12 space-y-4">
            <h3 className="text-xl font-bold px-2 italic tracking-tight text-zinc-200">Aktív Hitelek</h3>
            {activeLoans.map(loan => (
              <div key={loan.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] hover:border-zinc-500 transition-all shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-500/10 text-violet-400 rounded-full flex items-center justify-center font-black">
                      <Landmark size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-md text-white">Hitel</h4>
                      <p className="text-xs text-zinc-500">Felvéve: {new Date(loan.loan_date).toLocaleDateString('hu-HU')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-lg text-white">
                      {Number(loan.loan_amount).toFixed(loan.symbol === 'SOL' ? 4 : 2)} {loan.symbol}
                    </div>
                    <div className="text-xs text-violet-400 font-bold uppercase mt-1 tracking-widest">
                      ~ ${loan.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="border-t border-zinc-800 pt-3 flex justify-between items-center">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                    Törlesztési határidő:<br />
                    <span className="text-red-400 text-xs">{new Date(loan.repayment_deadline).toLocaleDateString('hu-HU')}</span>
                  </p>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                      Már törlesztve:
                      <br/>
                      <span className="text-white text-xs">{Number(loan.amount_repaid).toFixed(2)} {loan.symbol}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}