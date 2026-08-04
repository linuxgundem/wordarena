'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, ArrowLeft, Crown, Medal, TrendingUp } from 'lucide-react'
import Link from 'next/link'

// Dummy data for leaderboard
const leaderboardData = [
  { rank: 1, username: 'WordMaster99', xp: 15400, winRate: '78%', games: 200 },
  { rank: 2, username: 'KelimeKrali', xp: 14200, winRate: '65%', games: 180 },
  { rank: 3, username: 'Asli_Yazar', xp: 13800, winRate: '70%', games: 150 },
  { rank: 4, username: 'HizliKlavye', xp: 12500, winRate: '55%', games: 165 },
  { rank: 5, username: 'ProOyuncu', xp: 11000, winRate: '60%', games: 120 },
  { rank: 6, username: 'CevapMakinesi', xp: 9800, winRate: '50%', games: 110 },
  { rank: 7, username: 'SessizHarf', xp: 8500, winRate: '48%', games: 95 },
  { rank: 8, username: 'HarfKurdu', xp: 7200, winRate: '45%', games: 80 },
]

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<'global' | 'weekly' | 'monthly'>('global')

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-500" />
      case 2: return <Medal className="w-6 h-6 text-slate-300" />
      case 3: return <Medal className="w-6 h-6 text-amber-600" />
      default: return <span className="font-bold text-neutral-500 w-6 text-center">{rank}</span>
    }
  }

  const getRowStyle = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
      case 2: return 'bg-slate-300/10 border-slate-300/30 text-slate-300'
      case 3: return 'bg-amber-600/10 border-amber-600/30 text-amber-500'
      default: return 'bg-neutral-900/40 border-neutral-800 text-white hover:bg-neutral-800 transition-colors'
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-12 px-4 relative z-10 overflow-hidden">
      {/* Dekoratif Arka Plan */}
      <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        {/* Navigation */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" /> Ana Sayfaya Dön
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-[0_0_40px_rgba(234,179,8,0.3)] mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Liderlik Tablosu</h1>
          <p className="text-neutral-400 max-w-xl mx-auto">
            WordArena'nın en iyileri! En yüksek XP'ye ve kazanma oranına sahip oyuncuları incele.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-neutral-900/60 p-1 rounded-xl border border-neutral-800 flex space-x-1">
            <button 
              onClick={() => setTimeframe('global')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${timeframe === 'global' ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
            >
              Tüm Zamanlar
            </button>
            <button 
              onClick={() => setTimeframe('monthly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${timeframe === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
            >
              Bu Ay
            </button>
            <button 
              onClick={() => setTimeframe('weekly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${timeframe === 'weekly' ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
            >
              Bu Hafta
            </button>
          </div>
        </div>

        {/* Top 3 Podium (Optional extra feature, for now list layout) */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-6 border-b border-neutral-800 text-xs font-bold text-neutral-500 uppercase tracking-wider bg-neutral-900/80">
            <div className="col-span-2 md:col-span-1 text-center">Sıra</div>
            <div className="col-span-6 md:col-span-5">Oyuncu</div>
            <div className="col-span-4 md:col-span-3 text-right">XP Puanı</div>
            <div className="hidden md:block col-span-3 text-right">Kazanma %</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-neutral-800/50">
            {leaderboardData.map((user, index) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                key={user.rank}
                className={`grid grid-cols-12 gap-4 p-4 md:p-6 items-center border-l-4 border-l-transparent ${getRowStyle(user.rank)}`}
                style={{ borderLeftColor: user.rank === 1 ? '#eab308' : user.rank === 2 ? '#cbd5e1' : user.rank === 3 ? '#d97706' : 'transparent' }}
              >
                <div className="col-span-2 md:col-span-1 flex justify-center">
                  {getRankIcon(user.rank)}
                </div>
                
                <div className="col-span-6 md:col-span-5 flex items-center">
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center mr-3 font-bold text-white shrink-0">
                    {user.username.substring(0,2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <span className={`font-bold text-base ${user.rank <= 3 ? 'text-current' : 'text-white'}`}>
                      {user.username}
                    </span>
                    <div className="text-xs text-neutral-500 mt-0.5 md:hidden">
                      Win: {user.winRate}
                    </div>
                  </div>
                </div>

                <div className="col-span-4 md:col-span-3 text-right font-black text-lg">
                  <span className={user.rank <= 3 ? 'text-current' : 'text-blue-400'}>
                    {user.xp.toLocaleString()}
                  </span>
                </div>

                <div className="hidden md:flex col-span-3 justify-end items-center text-right font-medium">
                  <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                  {user.winRate}
                </div>
              </motion.div>
            ))}
          </div>

        </div>

      </motion.div>
    </div>
  )
}
