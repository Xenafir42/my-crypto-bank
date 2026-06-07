"use client";
import { useEffect, useRef } from "react";

export default function TradingViewChart({ symbol = "COINBASE:SOLUSD" }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    // Megakadályozzuk, hogy a Next.js duplán hozza létre a grafikont fejlesztői módban
    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark", // Passzol a sötét dizájnodhoz
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_side_toolbar: true,
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });

    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="w-full h-[400px] bg-zinc-950 p-4 border border-zinc-800 rounded-[2rem] overflow-hidden">
      <div ref={container} className="w-full h-full" />
    </div>
  );
}