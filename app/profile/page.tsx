"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // Új state az emailnek
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setEmail(user.email || ""); // Betöltjük a jelenlegi emailt
        
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        if (data) setUsername(data.username || "");
      }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async () => {
    setLoading(true);
    
    // 1. Felhasználónév frissítése a 'profiles' táblában
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id);

    // 2. Email frissítése a Supabase Auth-ban
    // FIGYELEM: Ha a "Confirm Email" be van kapcsolva a Supabase-en, 
    // akkor kapni fogsz egy levelet az új címre!
    if (email !== user.email) {
      const { error: authError } = await supabase.auth.updateUser({ email });
      if (authError) alert("Email hiba: " + authError.message);
      else alert("Az email megváltoztatásához ellenőrizd a postafiókodat!");
    }

    if (!profileError) alert("Profil sikeresen frissítve!");
    setLoading(false);
  };

  if (!user) return <div className="p-10 text-white">Betöltés...</div>;

  return (
    <div className="page-wrap p-6 md:p-10">
      <div className="surface-card text-white max-w-xl mx-auto space-y-6 p-8 rounded-3xl">
      <h1 className="text-3xl font-bold italic text-violet-200">Profil Beállítások</h1>

      <div className="space-y-2">
        <label className="text-zinc-300 text-sm">E-mail cím</label>
        <input 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#100d18] p-3 rounded-xl border border-violet-900/60 focus:border-violet-400 outline-none transition-all"
        />
      </div>

      <div className="space-y-2">
        <label className="text-zinc-300 text-sm">Felhasználónév</label>
        <input 
          type="text"
          value={username} 
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-[#100d18] p-3 rounded-xl border border-violet-900/60 focus:border-violet-400 outline-none transition-all"
        />
      </div>

      <button 
        onClick={handleUpdate} 
        disabled={loading}
        className="accent-button px-8 py-3 rounded-full disabled:bg-zinc-500"
      >
        {loading ? "Mentés..." : "Minden módosítás mentése"}
      </button>
      </div>
    </div>
  );
}