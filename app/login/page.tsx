"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Mail, X } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert(error.message);
    } else {
      router.refresh(); 
      router.push("/"); 
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setForgotMessage(`Hiba: ${error.message}`);
      } else {
        setForgotMessage("Email elküldve! Kérjük, ellenőrizd a postafiókod.");
        setTimeout(() => {
          setForgotPasswordOpen(false);
          setForgotEmail("");
          setForgotMessage("");
        }, 3000);
      }
    } catch (err: any) {
      setForgotMessage(`Hiba: ${err.message}`);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="page-wrap flex items-center justify-center p-4">
      <div className="surface-card w-full max-w-md p-8 rounded-3xl">
        <h1 className="text-3xl font-bold mb-2 italic">Bejelentkezés</h1>
        <p className="text-violet-200/70 text-sm mb-6">Kezeld a tárcáidat és tranzakcióidat egy helyen.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" placeholder="Email" 
            className="w-full bg-[#100d18] border border-violet-900/60 p-3 rounded-xl focus:outline-none focus:border-violet-400"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input 
            type="password" placeholder="Jelszó" 
            className="w-full bg-[#100d18] border border-violet-900/60 p-3 rounded-xl focus:outline-none focus:border-violet-400"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="accent-button w-full py-3 rounded-full">
            Belépés
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-violet-900/40 text-center">
          <button 
            type="button"
            onClick={() => setForgotPasswordOpen(true)}
            className="text-violet-300 hover:text-violet-200 text-sm font-medium transition-colors"
          >
            Elfelejtettem a jelszót
          </button>
        </div>
      </div>

      {/* --- MODAL: Jelszó Resetelés --- */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-8 rounded-3xl relative">
            <button 
              onClick={() => setForgotPasswordOpen(false)}
              className="absolute top-6 right-6 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold mb-2 italic text-violet-200">Jelszó Resetelése</h2>
            <p className="text-violet-200/70 text-sm mb-6">
              Add meg az email-címed, és küldünk egy linkkel egy emailt a jelszó megváltoztatásához.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input 
                type="email" 
                placeholder="Email cím" 
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full bg-[#100d18] border border-violet-900/60 p-3 rounded-xl focus:outline-none focus:border-violet-400"
                required
              />

              {forgotMessage && (
                <div className={`p-3 rounded-lg text-sm ${forgotMessage.includes("Hiba") ? "bg-red-900/20 text-red-300 border border-red-900/60" : "bg-green-900/20 text-green-300 border border-green-900/60"}`}>
                  {forgotMessage}
                </div>
              )}

              <button 
                type="submit"
                disabled={forgotLoading}
                className="accent-button w-full py-3 rounded-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Mail size={18} />
                {forgotLoading ? "Küldés..." : "Email Küldése"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}