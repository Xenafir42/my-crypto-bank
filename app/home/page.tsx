import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wallet, ArrowLeftRight, LogOut, Landmark } from 'lucide-react'
import ChartSelector from '@/components/ChartSelector'

export default async function IndexPage() {
  const cookieStore = await cookies()

  // Supabase kliens létrehozása a szerver oldalon
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  // Session ellenőrzése
  const { data: { session } } = await supabase.auth.getSession()

  // Ha nincs belépve, irány a login
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="page-wrap flex flex-col items-center justify-center p-6 min-h-screen">
      <div className="surface-card w-full max-w-5xl space-y-8 text-center rounded-[2rem] p-8 md:p-10">

        {/* Üdvözlés */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-violet-200">XNFR CRYPTO BANK</h1>
          <p className="text-zinc-300 text-sm">Üdvözlünk újra!</p>
          <p className="text-violet-100/80 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Egy modern, gyors és biztonságos felület, ahol a tárcád kezelése, a váltás és a tranzakciók követése egyetlen egységes élményben történik.
          </p>
          <div className="bg-violet-950/30 border border-violet-900/60 py-2 px-4 rounded-full inline-block">
            <span className="text-violet-300 text-xs font-mono">{session.user.email}</span>
          </div>
        </div>

        {/* Árfolyam diagramok */}


        {/* Gyorsmenü */}
        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/wallet"
            className="flex items-center justify-between bg-[#130f1e] border border-violet-900/50 p-6 rounded-3xl hover:border-violet-500 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/15 rounded-2xl text-violet-300">
                <Wallet size={24} />
              </div>
              <div className="text-left">
                <span className="block font-bold">Wallet</span>
                <span className="text-xs text-zinc-400">Egyenleg és tranzakciók</span>
              </div>
            </div>
            <div className="text-zinc-700 group-hover:text-white transition-colors">→</div>
          </Link>

          <Link
            href="/swap"
            className="flex items-center justify-between bg-[#130f1e] border border-violet-900/50 p-6 rounded-3xl hover:border-violet-500 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/15 rounded-2xl text-violet-300">
                <ArrowLeftRight size={24} />
              </div>
              <div className="text-left">
                <span className="block font-bold">Swap</span>
                <span className="text-xs text-zinc-400">Váltás kriptovaluták között</span>
              </div>
            </div>
            <div className="text-zinc-700 group-hover:text-white transition-colors">→</div>
          </Link>

          <Link
            href="/loans"
            className="flex items-center justify-between bg-[#130f1e] border border-violet-900/50 p-6 rounded-3xl hover:border-violet-500 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/15 rounded-2xl text-violet-300">
                <Landmark size={24} />
              </div>
              <div className="text-left">
                <span className="block font-bold">Hitelfelvétel</span>
                <span className="text-xs text-zinc-400">Biztonságos hitelek azonnal</span>
              </div>
            </div>
            <div className="text-zinc-700 group-hover:text-white transition-colors">→</div>
          </Link>
        </div>
      </div>

      <div className="w-full max-w-5xl mt-8">
        <ChartSelector />
      </div>

    </div>
  )
}