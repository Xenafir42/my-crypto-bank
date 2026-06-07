"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase"; // Fontos az import!
import { Sun, Moon, Monitor, ChevronDown, User, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [theme, setTheme] = useState("auto");
  const [currency, setCurrency] = useState("USD");
  const [lang, setLang] = useState("HU");
  const [user, setUser] = useState<any>(null); // Itt tároljuk a belépett usert
  const router = useRouter();

  // Bejelentkezési állapot figyelése
  useEffect(() => {
    // 1. Megnézzük, van-e már aktív session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getSession();

    // 2. Feliratkozunk az auth változásokra (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/"); // Kijelentkezés után főoldalra dobjuk
  };

  return (
    <nav className="h-16 border-b border-violet-900/60 bg-[#0e0b16]/90 backdrop-blur-md text-white flex items-center justify-between px-8 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link href="/home" className="text-xl font-bold tracking-tighter italic text-violet-300">XNFR</Link>
        <div className="hidden md:flex gap-6 text-sm font-medium text-zinc-400">
          <Link href="/swap" className="hover:text-violet-200 transition-colors">Swap</Link>
          <Link href="/wallet" className="hover:text-violet-200 transition-colors">Wallet</Link>
          <Link href="/loans" className="hover:text-violet-200 transition-colors">Hitelfelvétel</Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* KONDICIONÁLIS RENDERELÉS */}
        {user ? (
          // Ha be van jelentkezve: Profile link
          <Link 
            href="/profile" 
            className="flex items-center gap-2 text-sm font-medium bg-violet-950/40 border border-violet-800/60 px-4 py-2 rounded-full hover:bg-violet-900/50 transition-all"
          >
            <User size={16} />
            <span>Profile</span>
          </Link>
        ) : (
          // Ha nincs bejelentkezve: Login és Register
          <>
            <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-violet-200">
              Login
            </Link>
            <Link href="/register" className="bg-violet-500 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-violet-400 transition-all">
              Register
            </Link>
          </>
        )}

        <div className="relative group">
          <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full transition-all">
            <span className="text-lg">···</span>
          </button>

          <div className="absolute right-0 top-full pt-2 hidden group-hover:block w-64 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-[#141022] border border-violet-900/60 rounded-2xl shadow-2xl p-4 space-y-6">
              
              {/* Theme, Currency, Language szekciók maradtak... */}

              {/* KIJELENTKEZÉS GOMB (Csak ha be van lépve) */}
              {user && (
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between text-red-500 hover:bg-red-500/10 p-2 rounded-xl transition-all"
                >
                  <span className="text-sm font-medium">Log out</span>
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
