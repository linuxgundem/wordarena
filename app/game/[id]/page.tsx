'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Timer, AlertTriangle, Send } from 'lucide-react'

const GAME_CATEGORIES = ['İsim', 'Şehir', 'Ülke', 'Hayvan', 'Bitki', 'Meslek']

export default function GamePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [gameState, setGameState] = useState<'starting' | 'playing' | 'submitting' | 'evaluating'>('starting')
  const [countdown, setCountdown] = useState(5)
  const [timeLeft, setTimeLeft] = useState(60)
  const [localStartTime, setLocalStartTime] = useState<number | null>(null)
  
  const [room, setRoom] = useState<any>(null)
  const [game, setGame] = useState<any>(null)
  const [round, setRound] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [cheatWarnings, setCheatWarnings] = useState(0)

  // Initialization
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)

      // Get Room
      const { data: roomData } = await supabase.from('rooms').select('*').eq('id', id).single()
      if (roomData) {
        setRoom(roomData)
        setTimeLeft(roomData.round_time)
      }

      // Get Active Game
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('room_id', id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()
        
      if (gameData) setGame(gameData)

      // Get Active Round
      if (gameData) {
        const { data: roundData } = await supabase
          .from('rounds')
          .select('*')
          .eq('game_id', gameData.id)
          .is('ended_at', null)
          .order('round_number', { ascending: false })
          .limit(1)
          .single()
        
        if (roundData) {
           setRound(roundData)
           setLocalStartTime(Date.now())
        }
        else {
           // Round ended, push to results
           router.push(`/game/${id}/results`)
        }
      }
    }
    
    init()
  }, [id, router, supabase])

  // Realtime subscription to Rounds (To know when evaluation is done)
  useEffect(() => {
    if (!round) return
    
    const channel = supabase.channel(`round:${round.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${round.id}` },
        (payload) => {
          if (payload.new.ended_at !== null) {
            router.push(`/game/${id}/results`)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [round, id, router, supabase])


  // Fullscreen Entegrasyonu
  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      setIsFullscreen(true)
    } catch (err) {
      console.error(err)
      toast.error('Tam ekrana geçilemedi. Oyunu oynamak için tam ekran zorunludur.')
      // Fallback: Just let them play anyway if fullscreen is blocked
      setIsFullscreen(true)
    }
  }

  // Anti Hile Sistemleri
  useEffect(() => {
    if (gameState !== 'playing') return
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setCheatWarnings(prev => prev + 1)
        toast.error('Uyarı: Sekme değiştirdiniz!', { icon: '⚠️', duration: 3000 })
      }
    }
    const handleBlur = () => {
      setCheatWarnings(prev => prev + 1)
      toast.error('Uyarı: Odak kayboldu (Pencere değişti)!', { icon: '⚠️', duration: 3000 })
    }
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false)
        toast.error('Tam ekrandan çıkmak yasaktır! Lütfen geri dönün.', { duration: 4000 })
      } else {
        setIsFullscreen(true)
      }
    }
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      toast.error('Kopyala/Yapıştır yapmak yasaktır!')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('copy', handleCopyPaste)
    document.addEventListener('paste', handleCopyPaste)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('copy', handleCopyPaste)
      document.removeEventListener('paste', handleCopyPaste)
    }
  }, [gameState])

  // Submit Logic
  const submitData = useCallback(async () => {
    if (gameState !== 'playing') return
    setGameState('submitting')
    toast.success('Cevaplar gönderiliyor...')
    
    try {
      // Get categories
      const { data: categories } = await supabase.from('categories').select('id, name')
      if (categories) {
        const inserts = []
        for (const [catName, answerText] of Object.entries(answers)) {
          const category = categories.find(c => c.name === catName)
          if (!category || !answerText.trim()) continue
          inserts.push({
            round_id: round.id,
            profile_id: currentUser.id,
            category_id: category.id,
            answer_text: answerText.trim().toUpperCase()
          })
        }
        if (inserts.length > 0) {
          await supabase.from('answers').insert(inserts)
        }
      }

      setGameState('evaluating')
      
      // If Host, trigger evaluation API but give a solid grace period for slow connections
      if (room && currentUser && room.owner_id === currentUser.id) {
        setTimeout(async () => {
          try {
             await fetch('/api/evaluate', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ roundId: round.id, roomId: room.id })
             })
          } catch (err: any) {
             toast.error('Değerlendirme hatası: ' + err.message)
          }
        }, 6000) // 6 saniye bekle ki diğer oyuncular verilerini kesin kaydetsin
      }
    } catch(err: any) {
      toast.error(err.message)
    }
  }, [gameState, round, answers, room, currentUser])

  // Oyun Döngüsü (Bağıl zaman tabanlı tam senkronizasyon - sekme uykuya dalsa bile etkilenmez)
  useEffect(() => {
    if (!round || !room || !localStartTime || gameState === 'submitting' || gameState === 'evaluating') return

    const gameDurationMs = room.round_time * 1000
    const startDelayMs = 5000 // 5 saniye bekleme
    
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - localStartTime
      
      // 1. Bekleme Süresi (Starting)
      if (elapsed < startDelayMs) {
        setGameState('starting')
        setCountdown(Math.ceil((startDelayMs - elapsed) / 1000))
      } 
      // 2. Oyun Süresi (Playing)
      else if (elapsed < startDelayMs + gameDurationMs) {
        setGameState('playing')
        setTimeLeft(Math.ceil((startDelayMs + gameDurationMs - elapsed) / 1000))
      } 
      // 3. Süre Bitti (Submitting)
      else {
        clearInterval(interval)
        setTimeLeft(0)
        submitData()
      }
    }, 500)

    return () => clearInterval(interval)
  }, [round, room, gameState, localStartTime, submitData])

  const handleInputChange = (category: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [category]: value
    }))
  }

  if (!isFullscreen && gameState === 'starting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-white p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-bold mb-4">Oyuna Hazır Mısın?</h1>
        <p className="text-neutral-400 max-w-md mb-8">
          Oyun tam ekranda oynanmaktadır. Başladıktan sonra sekme değiştirmek, pencereyi küçültmek veya tam ekrandan çıkmak uyarı almanıza ve diskalifiye olmanıza sebep olabilir.
        </p>
        <button 
          onClick={enterFullscreen}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all"
        >
          Anladım, Tam Ekrana Geç ve Başla
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-neutral-950 text-white overflow-hidden flex flex-col">
      <AnimatePresence>
        {gameState === 'starting' && isFullscreen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/20 backdrop-blur-md z-50"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-9xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-white to-blue-400"
            >
              {countdown}
            </motion.div>
            <p className="mt-8 text-2xl font-medium text-blue-200">Tur Başlıyor...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === 'playing' && round && room && (
        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 md:p-8 h-full">
          <div className="flex justify-between items-center bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-4 md:p-6 mb-8 shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.5)]">
                <span className="text-4xl font-black text-white">{round.letter}</span>
              </div>
              <div>
                <p className="text-sm text-blue-400 font-bold uppercase tracking-wider">Geçerli Harf</p>
                <p className="text-2xl font-bold">Tur {round.round_number} / {room.total_rounds}</p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {cheatWarnings > 0 && (
                <div className="flex items-center text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-lg font-medium">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  {cheatWarnings} Uyarı
                </div>
              )}
              
              <div className={`flex items-center text-3xl font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                <Timer className="w-8 h-8 mr-3 opacity-50" />
                {timeLeft}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GAME_CATEGORIES.map((cat, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={cat} 
                  className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 focus-within:bg-neutral-800 focus-within:border-blue-500/50 transition-all"
                >
                  <label className="block text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wide">
                    {cat}
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck="false"
                    maxLength={30}
                    value={answers[cat] || ''}
                    onChange={(e) => handleInputChange(cat, e.target.value.toUpperCase())}
                    placeholder={`${round.letter} ile başlayan...`}
                    className="w-full bg-transparent border-none outline-none text-2xl font-medium text-white placeholder-neutral-700 focus:ring-0"
                  />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button 
              onClick={submitData}
              className="group flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-lg shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all hover:scale-105"
            >
              Cevapları Gönder 
              <Send className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {(gameState === 'submitting' || gameState === 'evaluating') && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold">
            {gameState === 'submitting' ? 'Cevaplar İletiliyor...' : 'Yapay Zeka Değerlendiriyor...'}
          </h2>
          <p className="text-neutral-400 mt-2">Bu işlem birkaç saniye sürebilir, lütfen bekleyin.</p>
        </div>
      )}
    </div>
  )
}
