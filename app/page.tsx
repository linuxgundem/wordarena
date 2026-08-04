'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, LogIn, Dices, Trophy, User, Settings, ArrowRight } from 'lucide-react'
import RoomConfigModal from '@/components/RoomConfigModal'

export default function HomePage() {
  const router = useRouter()
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full px-4 relative z-10 py-12">
      {/* Decorative Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl w-full"
      >
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
            WordArena
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto">
            Gerçek zamanlı, yapay zekâ destekli ve modern İsim-Şehir deneyimi. Arkadaşlarına veya dünyaya karşı yarış!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Yeni Oda Kur */}
          <button 
            onClick={() => setIsConfigModalOpen(true)}
            className="group relative flex flex-col items-start p-8 bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl hover:bg-neutral-800/60 hover:border-blue-500/50 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full group-hover:bg-blue-500/20 transition-all pointer-events-none" />
            <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
              <Plus className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Yeni Oda Kur</h3>
            <p className="text-neutral-400 flex-1">
              Kategorileri, süreyi ve oyuncu sayısını sen belirle. Özel veya herkese açık bir oda oluştur.
            </p>
            <div className="mt-6 flex items-center text-blue-400 font-medium group-hover:translate-x-2 transition-transform">
              Oluştur <ArrowRight className="ml-2 w-5 h-5" />
            </div>
          </button>

          {/* Odaya Katıl */}
          <Link 
            href="/lobby" 
            className="group relative flex flex-col items-start p-8 bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl hover:bg-neutral-800/60 hover:border-purple-500/50 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full group-hover:bg-purple-500/20 transition-all pointer-events-none" />
            <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-6">
              <LogIn className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Odaya Katıl</h3>
            <p className="text-neutral-400 flex-1">
              Arkadaşının davet koduyla veya herkese açık aktif odalara anında katıl.
            </p>
            <div className="mt-6 flex items-center text-purple-400 font-medium group-hover:translate-x-2 transition-transform">
              Odalara Göz At <ArrowRight className="ml-2 w-5 h-5" />
            </div>
          </Link>
          
        </div>

        {/* Alt Menü */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/random" className="flex items-center justify-center p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white">
            <Dices className="w-5 h-5 mr-3" /> Rastgele Oyun
          </Link>
          <Link href="/leaderboard" className="flex items-center justify-center p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white">
            <Trophy className="w-5 h-5 mr-3" /> Sıralama
          </Link>
          <Link href="/profile" className="flex items-center justify-center p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white">
            <User className="w-5 h-5 mr-3" /> Profil
          </Link>
          <Link href="/settings" className="flex items-center justify-center p-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white">
            <Settings className="w-5 h-5 mr-3" /> Ayarlar
          </Link>
        </div>
      </motion.div>

      {/* Oda Kurma Modalı */}
      <RoomConfigModal 
        isOpen={isConfigModalOpen} 
        onClose={() => setIsConfigModalOpen(false)} 
      />
    </div>
  )
}
