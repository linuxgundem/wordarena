'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, Clock, Hash, Lock, BrainCircuit, ArrowRight, Loader2, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface RoomConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function RoomConfigModal({ isOpen, onClose }: RoomConfigModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [roundTime, setRoundTime] = useState(60)
  const [totalRounds, setTotalRounds] = useState(10)
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [aiEnabled, setAiEnabled] = useState(true)
  
  // Örnek kategoriler, veritabanından da çekilebilir
  const defaultCategories = ['İsim', 'Şehir', 'Ülke', 'Hayvan', 'Bitki', 'Meslek']
  const [selectedCategories, setSelectedCategories] = useState<string[]>(defaultCategories)

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const handleCreateRoom = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Lütfen en az bir kategori seçin.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Oda kurmak için giriş yapmalısınız.')
      setLoading(false)
      return
    }

    // 1. Odayı oluştur
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        owner_id: user.id,
        max_players: maxPlayers,
        round_time: roundTime,
        total_rounds: totalRounds,
        is_private: isPrivate,
        password: isPrivate ? password : null,
        ai_referee_enabled: aiEnabled,
      })
      .select()
      .single()

    if (roomError) {
      toast.error('Oda oluşturulurken hata: ' + roomError.message)
      setLoading(false)
      return
    }

    // (Not: Gerçek uygulamada kategorileri ID ile eşleştirip room_categories tablosuna ekleyeceğiz.
    // Şimdilik sadece oda ID'sini alıp lobiye yönlendiriyoruz)

    // 2. Sahibi oyuncu olarak odaya ekle
    const { error: joinError } = await supabase.from('room_players').insert({
      room_id: room.id,
      profile_id: user.id,
      is_ready: false
    })

    if (joinError) {
      toast.error('Odaya katılırken hata oluştu: ' + joinError.message)
      setLoading(false)
      return
    }

    toast.success('Oda kuruldu!')
    router.push(`/room/${room.id}`)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-neutral-800 bg-neutral-900/50">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Settings className="w-6 h-6 mr-3 text-blue-400" />
                Oda Ayarları
              </h2>
              <button 
                onClick={onClose}
                className="text-neutral-400 hover:text-white transition-colors p-2 rounded-full hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left Col - Game Settings */}
                <div className="space-y-6">
                  <div>
                    <label className="flex items-center text-sm font-medium text-neutral-300 mb-3">
                      <Users className="w-4 h-4 mr-2 text-neutral-500" /> Oyuncu Sayısı ({maxPlayers})
                    </label>
                    <input 
                      type="range" min="2" max="10" step="1" 
                      value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-neutral-500 mt-1">
                      <span>2</span><span>10</span>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center text-sm font-medium text-neutral-300 mb-3">
                      <Clock className="w-4 h-4 mr-2 text-neutral-500" /> Tur Süresi ({roundTime} sn)
                    </label>
                    <input 
                      type="range" min="30" max="120" step="15" 
                      value={roundTime} onChange={(e) => setRoundTime(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-neutral-500 mt-1">
                      <span>30s</span><span>120s</span>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center text-sm font-medium text-neutral-300 mb-3">
                      <Hash className="w-4 h-4 mr-2 text-neutral-500" /> Tur Sayısı ({totalRounds})
                    </label>
                    <input 
                      type="range" min="5" max="20" step="5" 
                      value={totalRounds} onChange={(e) => setTotalRounds(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-neutral-500 mt-1">
                      <span>5</span><span>20</span>
                    </div>
                  </div>
                </div>

                {/* Right Col - Advanced & Categories */}
                <div className="space-y-6">
                  
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center justify-between p-4 rounded-xl border border-neutral-700 bg-neutral-800/30 cursor-pointer hover:bg-neutral-800 transition-colors">
                      <div className="flex items-center">
                        <Lock className="w-5 h-5 mr-3 text-purple-400" />
                        <div>
                          <p className="text-white font-medium text-sm">Özel Oda</p>
                          <p className="text-neutral-400 text-xs mt-0.5">Sadece şifre ile girilebilir</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={isPrivate} 
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="w-5 h-5 rounded border-neutral-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-neutral-900 bg-neutral-900"
                      />
                    </label>

                    {isPrivate && (
                      <motion.input
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        type="text"
                        placeholder="Oda Şifresi..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    )}
                  </div>

                  <label className="flex items-center justify-between p-4 rounded-xl border border-blue-900/50 bg-blue-900/10 cursor-pointer hover:bg-blue-900/20 transition-colors">
                    <div className="flex items-center">
                      <BrainCircuit className="w-5 h-5 mr-3 text-blue-400" />
                      <div>
                        <p className="text-white font-medium text-sm">Yapay Zeka Hakem</p>
                        <p className="text-blue-400/80 text-xs mt-0.5">Gemini cevapları onaylasın (Önerilen)</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={aiEnabled} 
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      className="w-5 h-5 rounded border-blue-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900 bg-neutral-900"
                    />
                  </label>

                </div>
              </div>

              {/* Categories */}
              <div className="mt-8">
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  Kategoriler <span className="text-neutral-500 font-normal">({selectedCategories.length} seçili)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {defaultCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selectedCategories.includes(cat)
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button className="px-4 py-2 rounded-full text-sm font-medium bg-neutral-800 border border-dashed border-neutral-600 text-neutral-400 hover:text-white transition-all">
                    + Özel Ekle
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl text-neutral-300 hover:text-white font-medium transition-colors mr-4"
              >
                İptal
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="flex items-center px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Odayı Kur <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
