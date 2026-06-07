"use client";

import { useState, useEffect } from "react";
// Hozzáadtuk a getLivePrice és executeSwap függvényeket az importokhoz
import { getCurrencies, getUserBalance, hasEnoughFunds, executeSwap } from "./swap-logic";
import { getLivePrice } from "@/components/exchange-rate-monitor";
import { supabase } from "@/lib/supabase";
import { ArrowDown, AlertCircle, RefreshCcw } from "lucide-react";
import ChartSelector from "@/components/ChartSelector";

export default function SwapComponent() {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [userBalance, setUserBalance] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ÚJ ÁLLAPOTOK AZ ÉLŐ ÁRFOLYAMHOZ
  const [liveRate, setLiveRate] = useState<number>(1);
  const [loadingRate, setLoadingRate] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // 1. Kezdeti adatok betöltése
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const data = await getCurrencies();
      setCurrencies(data);

      if (data.length > 0) {
        setFromCurrency(data[0].symbol);
        setToCurrency(data[1]?.symbol || data[0].symbol);
      }
    }
    init();
  }, []);

  // 2. Egyenleg frissítése
  useEffect(() => {
    if (userId && fromCurrency) {
      getUserBalance(userId, fromCurrency).then(setUserBalance);
    }
  }, [userId, fromCurrency]);

  // 3. ÉLŐ ÁRFOLYAM LEKÉRDEZÉSE ÉS SZÁMÍTÁSA
  // Amikor változik a 'From' vagy 'To' valuta, lekérjük az új árakat
  useEffect(() => {
    async function updateRate() {
      if (fromCurrency && toCurrency) {
        setLoadingRate(true);
        const priceFrom = await getLivePrice(fromCurrency); //
        const priceTo = await getLivePrice(toCurrency);

        // Keresztárfolyam számítása: (Eladott ár USD-ben) / (Vett ár USD-ben)
        setLiveRate(priceFrom / priceTo);
        setLoadingRate(false);
      }
    }
    updateRate();
  }, [fromCurrency, toCurrency]);

  // 4. Tranzakció végrehajtása
  const handleSwap = async () => {
    if (!userId || !amount || parseFloat(amount) <= 0) return;

    setIsSwapping(true);
    setError(null);

    try {
      const numAmount = parseFloat(amount);
      await executeSwap(userId, fromCurrency, toCurrency, numAmount);

      alert("Sikeres csere!");
      setAmount(""); // Mező ürítése

      // Egyenleg frissítése a felületen
      const newBalance = await getUserBalance(userId, fromCurrency);
      setUserBalance(newBalance);
    } catch (err: any) {
      setError("Hiba a tranzakció során: " + err.message);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const numVal = parseFloat(val);
    if (numVal > 0 && !hasEnoughFunds(userBalance, numVal)) {
      setError("Nincs elég fedezet a tárcádban!");
    } else {
      setError(null);
    }
  };

  // 1% Tranzakciós költség kalkuláció
  const numAmount = amount ? parseFloat(amount) : 0;
  const transactionFee = numAmount * 0.01; // 1% fee
  const amountAfterFee = numAmount - transactionFee; // Valódi swap összeg
  const calculatedToAmount = amountAfterFee > 0 ? (amountAfterFee * liveRate).toFixed(6) : "0.00";

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-md mx-auto space-y-2">
        <div className="flex justify-between items-end mb-4 px-2">
        <h2 className="text-xl font-bold text-white italic">Swap</h2>
        {/* Árfolyam kijelzése */}
        <div className="text-[10px] text-violet-200/70 flex items-center gap-1 bg-violet-950/30 border border-violet-900/50 px-2 py-1 rounded-md">
          {loadingRate ? <RefreshCcw size={10} className="animate-spin" /> : null}
          1 {fromCurrency} ≈ {liveRate.toFixed(6)} {toCurrency}
        </div>
      </div>

      {/* --- ELADÁS DOBOZ --- */}
      <div className="bg-[#151124] border border-violet-900/60 p-4 rounded-3xl hover:border-violet-600 transition-all">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-zinc-500 font-medium">Eladás</label>
          <span className="text-xs text-zinc-400">
            Egyenleg: <b className="text-zinc-200">{userBalance.toFixed(4)} {fromCurrency}</b>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className={`bg-transparent text-3xl font-bold outline-none w-full text-white placeholder-zinc-700 ${error ? 'text-red-400' : ''}`}
          />
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className="bg-[#0f0b18] border border-violet-900/60 text-white p-2 rounded-2xl text-sm font-bold outline-none cursor-pointer"
          >
            {currencies.map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center -my-4 relative z-10">
        <div className="bg-black border-4 border-black p-2 rounded-2xl text-white shadow-xl">
          <ArrowDown size={20} strokeWidth={3} />
        </div>
      </div>

      {/* --- VÉTEL DOBOZ (JAVÍTVA) --- */}
      <div className="bg-[#151124] border border-violet-900/60 p-4 rounded-3xl hover:border-violet-600 transition-all">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-zinc-500 font-medium">Vétel</label>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="text"
            value={calculatedToAmount} // Dinamikusan kiszámolt érték
            readOnly
            className="bg-transparent text-3xl font-bold outline-none w-full text-white opacity-40"
          />
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className="bg-[#0f0b18] border border-violet-900/60 text-white p-2 rounded-2xl text-sm font-bold outline-none cursor-pointer"
          >
            {currencies.map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs font-semibold px-4 pt-2 animate-pulse">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* --- TRANZAKCIÓS KÖLTSÉG ÖSSZEGZÉS --- */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-violet-950/30 border border-violet-900/50 p-4 rounded-2xl space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400">Befizetendő összeg:</span>
            <span className="text-white font-bold">{numAmount.toFixed(4)} {fromCurrency}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-orange-400 font-semibold">Tranzakciós költség (1%):</span>
            <span className="text-orange-300 font-bold">-{transactionFee.toFixed(4)} {fromCurrency}</span>
          </div>

          <div className="border-t border-violet-900/50 pt-3 flex justify-between items-center text-sm">
            <span className="text-violet-200 font-bold">Végösszeg (után kapok):</span>
            <span className="text-green-400 font-black">{calculatedToAmount} {toCurrency}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={!!error || !amount || parseFloat(amount) <= 0 || isSwapping}
        className="w-full bg-violet-500 text-white font-extrabold py-5 rounded-3xl mt-4 hover:bg-violet-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all active:scale-95"
      >
        {isSwapping ? "Feldolgozás..." : error ? "Nincs elég fedezet" : "Csere végrehajtása"}
      </button>
      </div>

      {/* GRAFIKON SZEKCIÓ (szélesebb) */}
      <div className="w-full max-w-4xl mt-12 w-[200%]">
        <ChartSelector />
      </div>
    </div>
  );
}