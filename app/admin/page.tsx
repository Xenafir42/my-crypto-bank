"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPendingTransactionsAdmin, approveTransaction, rejectTransaction } from "./admin-logic";
import { Check, X, Loader2, ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    setLoading(true);
    
    // 1. Felhasználó lekérése
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/");
      return;
    }

    // 2. Admin jog ellenőrzése
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      setTimeout(() => router.push("/"), 3000);
      return;
    }

    // 3. Adatok betöltése
    setIsAdmin(true);
    await loadData();
  }

  // Külön választottuk az adatbetöltést, hogy a gombok megnyomása után is tudjuk hívni
  async function loadData() {
    try {
      const data = await getPendingTransactionsAdmin();
      setPendingList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // --- GOMBOK FUNKCIÓI ---
  const handleApprove = async (trans: any) => {
    if (!confirm("Biztosan jóváhagyod ezt a tranzakciót?")) return;
    try {
      await approveTransaction(trans);
      alert("Sikeresen jóváhagyva!");
      loadData(); // Újratöltjük a listát, hogy eltűnjön a jóváhagyott sor
    } catch (err: any) {
      alert("Hiba: " + err.message);
    }
  };

  const handleReject = async (trans: any) => {
    if (!confirm("Biztosan elutasítod?")) return;
    try {
      await rejectTransaction(trans);
      alert("Tranzakció elutasítva.");
      loadData();
    } catch (err: any) {
      alert("Hiba: " + err.message);
    }
  };

  // --- UI RÉSZLETEK (MEGJELENÍTÉS) ---

  if (loading) return (
    <div className="page-wrap flex flex-col items-center justify-center">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p>Jogosultságok és adatok ellenőrzése...</p>
    </div>
  );

  if (!isAdmin) return (
    <div className="page-wrap flex flex-col items-center justify-center p-6 text-center">
      <ShieldAlert size={64} className="text-red-500 mb-4" />
      <h1 className="text-3xl font-bold mb-2">Hozzáférés Megtagadva</h1>
      <p className="text-zinc-500">Nincs megfelelő jogosultságod az oldal megtekintéséhez.</p>
      <p className="text-zinc-600 text-xs mt-4 italic">Átirányítás a főoldalra...</p>
    </div>
  );

  // ITT VAN A HIÁNYZÓ TÁBLÁZAT:
  return (
    <div className="page-wrap p-8 max-w-6xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-8 italic text-violet-200">Admin Tranzakciókezelő</h1>

      {pendingList.length === 0 ? (
        <div className="bg-[#151124] p-10 rounded-3xl text-center border border-violet-900/60 text-zinc-400">
          Nincsenek függőben lévő (PENDING) tranzakciók a rendszerben.
        </div>
      ) : (
        <div className="bg-[#151124] border border-violet-900/60 rounded-3xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0f0b18] text-zinc-400 text-xs uppercase tracking-widest border-b border-violet-900/60">
                <th className="p-5">Felhasználó</th>
                <th className="p-5">Típus / Valuta</th>
                <th className="p-5">Összeg</th>
                <th className="p-5">Részletek</th>
                <th className="p-5 text-right">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {pendingList.map((trans) => (
                <tr key={trans.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="p-5">
                    <p className="font-bold">{trans.wallets?.profiles?.username || "Névtelen"}</p>
                    <p className="text-[10px] text-zinc-500">{trans.wallets?.profiles?.email}</p>
                  </td>
                  <td className="p-5">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${trans.type === 'DEPOSIT' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                      {trans.type}
                    </span>
                    <p className="mt-1 font-semibold">{trans.wallets?.currency_symbol}</p>
                  </td>
                  <td className="p-5 font-mono font-bold text-lg">
                    {Math.abs(trans.amount).toFixed(2)}
                  </td>
                  <td className="p-5">
                    {trans.type === 'WITHDRAW' ? (
                      <div className="text-[10px] bg-black/50 p-2 rounded-lg border border-zinc-800">
                        <p className="text-zinc-500">Cél IBAN számlaszám:</p>
                        <p className="text-zinc-300 font-mono">{trans.metadata?.iban || "N/A"}</p>
                      </div>
                    ) : (
                      // Dinamikus színezés: Kék ha FIAT (USD), Narancs ha CRYPTO (SOL)
                      <div className={`text-[10px] p-2 rounded-lg border ${trans.wallets?.currency_symbol === 'USD' ? 'bg-blue-900/10 border-blue-900/30' : 'bg-orange-900/10 border-orange-900/30'}`}>
                        <p className={`${trans.wallets?.currency_symbol === 'USD' ? 'text-blue-500' : 'text-orange-500'} font-bold uppercase mb-1`}>
                          {trans.wallets?.currency_symbol === 'USD' ? 'Banki Bizonylat:' : 'Beküldő Tárca Címe:'}
                        </p>
                        <p className={`${trans.wallets?.currency_symbol === 'USD' ? 'text-blue-300' : 'text-orange-300'} font-mono font-black text-xs break-all`}>
                          {trans.metadata?.user_tx_id || <span className="text-red-500 italic">Hiányzó adat</span>}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleApprove(trans)}
                        className="p-2 bg-green-500/20 text-green-500 rounded-xl hover:bg-green-500 hover:text-white transition-all"
                        title="Jóváhagyás"
                      >
                        <Check size={20} />
                      </button>
                      <button 
                        onClick={() => handleReject(trans)}
                        className="p-2 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        title="Elutasítás"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}