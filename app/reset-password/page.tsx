"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const handleTokenFromUrl = async () => {
      try {
        // A Supabase itt feldolgozza a recovery redirectet, PKCE code-ot vagy hash-alapú sessiont.
        const { error: initError } = await supabase.auth.initialize();

        if (initError) {
          console.error("Auth initialize error:", initError);
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setError("Nem sikerült feldolgozni a jelszó-helyreállító linket. Kérjük, igényelj új reset-email-t.");
          setLoading(false);
          return;
        }

        if (isMounted) {
          // Ha sikeres a session, csak megjelenítjük a formot
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Token feldolgozási hiba:", err);
        setError(`Valamilyen hiba történt: ${err.message}. Kérjük, próbálkozz újra vagy igényelj egy új reset-email-t!`);
        setLoading(false);
      }
    };

    handleTokenFromUrl();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    // Validáció
    if (password !== passwordConfirm) {
      setError("A jelszavak nem egyeznek!");
      return;
    }

    if (password.length < 6) {
      setError("A jelszó legalább 6 karakter hosszú kell legyen!");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(`Hiba: ${updateError.message}`);
      } else {
        setSuccess(true);
        setMessage("Jelszavad sikeresen megváltoztatva! Átirányítunk a bejelentkezésre...");
        
        // Kijelentkeztetjük a felhasználót
        await supabase.auth.signOut();

        // 3 másodperc után átirányítunk a login-re
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err: any) {
      setError(`Hiba a jelszó frissítésekor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrap flex items-center justify-center p-4">
      <div className="surface-card w-full max-w-md p-8 rounded-3xl">
        {loading && !success && !error ? (
          <div className="text-center space-y-4">
            <div className="animate-spin inline-block">
              <Lock size={40} className="text-violet-300" />
            </div>
            <p className="text-violet-200">Token ellenőrzése...</p>
          </div>
        ) : error && !success ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-red-900/20 border border-red-900/60 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2 text-red-400">Hiba</h1>
              <p className="text-zinc-300 text-sm mb-6">{error}</p>
              <button 
                onClick={() => router.push("/login")}
                className="accent-button w-full py-3 rounded-full"
              >
                Vissza a bejelentkezésre
              </button>
            </div>
          </div>
        ) : success ? (
          <div className="text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-green-900/20 border border-green-900/60 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2 text-green-400">Siker!</h1>
              <p className="text-zinc-300 text-sm">{message}</p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-2 italic text-violet-200">Új Jelszó Beállítása</h1>
            <p className="text-violet-200/70 text-sm mb-6">Kérjük, adj meg egy új jelszót a fiókod biztosítása érdekében.</p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-300 font-bold mb-2 block">Új Jelszó</label>
                <input 
                  type="password" 
                  placeholder="Legalább 6 karakter" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#100d18] border border-violet-900/60 p-3 rounded-xl focus:outline-none focus:border-violet-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-bold mb-2 block">Jelszó Megerősítése</label>
                <input 
                  type="password" 
                  placeholder="Ismét az új jelszó" 
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full bg-[#100d18] border border-violet-900/60 p-3 rounded-xl focus:outline-none focus:border-violet-400"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-900/60 text-red-300 p-3 rounded-lg text-sm flex gap-2 items-start">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="accent-button w-full py-3 rounded-full disabled:opacity-50"
              >
                {loading ? "Feldolgozás..." : "Jelszó Frissítése"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
