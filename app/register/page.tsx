"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    
    if (error) setError(error.message);
    else router.push("/login?message=Ellenőrizd az email fiókodat!");
  };

  return (
    <div className="page-wrap flex items-center justify-center p-4">
      <div className="surface-card w-full max-w-md p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-bold mb-2 italic">Regisztráció</h1>
        <p className="text-violet-200/70 text-sm mb-6">Nyiss saját crypto bank fiókot kevesebb mint 1 perc alatt.</p>
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        <form onSubmit={handleRegister} className="space-y-4">
          <input 
            type="email" placeholder="Email" 
            className="w-full bg-[#100d18] border border-violet-900/60 p-3 rounded-xl focus:outline-none focus:border-violet-400 transition-all"
            onChange={(e) => setEmail(e.target.value)} required
          />
          <input 
            type="password" placeholder="Jelszó" 
            className="w-full bg-[#100d18] border border-violet-900/60 p-3 rounded-xl focus:outline-none focus:border-violet-400 transition-all"
            onChange={(e) => setPassword(e.target.value)} required
          />
          <button className="accent-button w-full py-3 rounded-full">
            Regisztráció
          </button>
        </form>
        <p className="mt-6 text-zinc-500 text-sm text-center">
          Van már fiókod? <Link href="/login" className="text-violet-300 hover:underline">Jelentkezz be</Link>
        </p>
      </div>
    </div>
  );
}