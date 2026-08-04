'use client'

import { motion } from 'framer-motion'
import { User, Medal, Trophy, Activity, ArrowLeft, Settings, Award } from 'lucide-react'
import Link from 'next/link'

// Dummy data for UI showcase
const profileData = {
  username: 'WordMaster99',
  level: 42,
  xp: 15400,
  nextLevelXp: 18000,
  stats: {
    gamesPlayed: 156,
    wins: 89,
    winRate: '57%',
    totalPoints: 12450
  },
  badges: [
    { id: 1, name: 'İlk Galibiyet', icon: '🏆', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' },
    { id: 2, name: 'Kelime Cambazı', icon: '✨', color: 'bg-purple-500/20 text-purple-500 border-purple-500/50' },
    { id: 3, name: '100. Oyun', icon: '🎯', color: 'bg-blue-500/20 text-blue-500 border-blue-500/50' },
    { id: 4, name: 'Kusursuz Tur', icon: '🔥', color: 'bg-red-500/20 text-red-500 border-red-500/50' },
  ]
}

export default function ProfilePage() {
  const xpPercentage = (profileData.xp / profileData.nextLevelXp) * 100

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-12 px-4 relative z-10 overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      
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
          <button className="flex items-center text-neutral-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5 mr-2" /> Ayarlar
          </button>
        </div>

        {/* Profile Header Card */}
        <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 mb-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-bl-full pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
                <span className="text-5xl font-black text-white">{profileData.username.substring(0,2).toUpperCase()}</span>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-neutral-900 border-2 border-neutral-800 rounded-xl px-3 py-1 flex items-center justify-center">
                <Medal className="w-4 h-4 text-yellow-500 mr-1" />
                <span className="font-bold text-sm">Lvl {profileData.level}</span>
              </div>
            </div>

            {/* User Info & XP Bar */}
            <div className="flex-1 w-full mt-4 md:mt-2 text-center md:text-left">
              <h1 className="text-3xl font-extrabold mb-1">{profileData.username}</h1>
              <p className="text-neutral-400 mb-6 flex items-center justify-center md:justify-start">
                <Award className="w-4 h-4 mr-1 text-blue-400" /> Tecrübeli Oyuncu
              </p>

              <div>
                <div className="flex justify-between text-sm font-medium mb-2">
                  <span className="text-neutral-300">Seviye İlerlemesi</span>
                  <span className="text-blue-400">{profileData.xp} / {profileData.nextLevelXp} XP</span>
                </div>
                <div className="h-3 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats & Badges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Stats Column */}
          <div className="md:col-span-1 space-y-4">
            <h3 className="text-xl font-bold flex items-center mb-4">
              <Activity className="w-5 h-5 mr-2 text-blue-400" /> İstatistikler
            </h3>
            
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between">
              <span className="text-neutral-400">Oynanan Oyun</span>
              <span className="text-2xl font-bold">{profileData.stats.gamesPlayed}</span>
            </div>
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between">
              <span className="text-neutral-400">Kazanma Sayısı</span>
              <span className="text-2xl font-bold text-green-400">{profileData.stats.wins}</span>
            </div>
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between">
              <span className="text-neutral-400">Kazanma Oranı</span>
              <span className="text-2xl font-bold text-yellow-400">{profileData.stats.winRate}</span>
            </div>
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between">
              <span className="text-neutral-400">Toplam Puan</span>
              <span className="text-2xl font-bold text-purple-400">{profileData.stats.totalPoints}</span>
            </div>
          </div>

          {/* Badges Column */}
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold flex items-center mb-4">
              <Trophy className="w-5 h-5 mr-2 text-yellow-500" /> Rozetler & Başarımlar
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {profileData.badges.map((badge, index) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  key={badge.id}
                  className={`border rounded-2xl p-4 flex flex-col items-center justify-center text-center backdrop-blur-sm ${badge.color}`}
                >
                  <span className="text-3xl mb-2">{badge.icon}</span>
                  <span className="font-bold text-sm text-white">{badge.name}</span>
                </motion.div>
              ))}
              
              {/* Empty Badge Slots */}
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`empty-${i}`} className="border border-neutral-800 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center bg-neutral-900/20">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 mb-2 flex items-center justify-center text-neutral-600">?</div>
                  <span className="text-xs font-medium text-neutral-600">Kilitli Rozet</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </motion.div>
    </div>
  )
}
