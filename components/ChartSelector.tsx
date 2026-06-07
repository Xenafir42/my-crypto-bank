"use client";

import { useState } from "react";
import TradingViewChart from "./TradingViewChart";

export default function ChartSelector() {
  const [symbol, setSymbol] = useState("COINBASE:BTCUSD");

  const coins = [
    { name: "BTC/USD", symbol: "COINBASE:BTCUSD" },
    { name: "ETH/USD", symbol: "COINBASE:ETHUSD" },
    { name: "SOL/USD", symbol: "COINBASE:SOLUSD" },
  ];

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {coins.map(coin => (
          <button
            key={coin.symbol}
            onClick={() => setSymbol(coin.symbol)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              symbol === coin.symbol
                ? "bg-violet-600 text-white border border-violet-500"
                : "bg-[#130f1e] text-zinc-400 border border-violet-900/50 hover:border-violet-500 hover:text-white"
            }`}
          >
            {coin.name}
          </button>
        ))}
      </div>
      
      <div className="w-full">
        <TradingViewChart symbol={symbol} />
      </div>
    </div>
  );
}
