'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Timer, AlertTriangle, Send } from 'lucide-react'

// Dummy categories for the UI
const GAME_CATEGORIES = ['İsim', 'Şehir', 'Ülke', 'Hayvan', 'Bitki', 'Meslek']

export default function GamePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [countdown, setCountdown] = useState(5) // Başlangıç geri sayımı
  const [gameState, setGameState] = useState<'starting' | 'playing' | 'submitting'>('starting')
  const [timeLeft, setTimeLeft] = useState(60) // Oda ayarlarından gelecek, şimdilik 60
  const [currentLetter, setCurrentLetter] = useState('K')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [cheatWarnings, setCheatWarnings] = useState(0)

  // 1. Fullscreen API Entegrasyonu
  const enterFullscreen = async () => {
    try {
      if (containerRef.current && !document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      }
    } catch (err) {
      toast.error('Tam ekrana geçilemedi. Oyunu oynamak için tam ekran zorunludur.')
    }
  }

  // 2. Anti Hile Sistemleri (Visibility & Blur)
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
        // Oyundan atma mantığı eklenebilir
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

  // 3. Oyun Döngüsü
  useEffect(() => {
    if (gameState === 'starting') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
        return () => clearTimeout(timer)
      } else {
        setGameState('playing')
      }
    }

    if (gameState === 'playing') {
      if (timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
        return () => clearTimeout(timer)
      } else {
        handleSubmit() // Süre bittiğinde otomatik gönder
      }
    }
  }, [countdown, gameState, timeLeft])

  const handleInputChange = (category: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [category]: value
    }))
  }

  const handleSubmit = async () => {
    setGameState('submitting')
    toast.success('Cevaplar gönderiliyor...')
    
    // Gerçek API çağrısı ve Gemini entegrasyonu (7. Aşama) burada yapılacak
    setTimeout(() => {
      router.push(`/game/${id}/results`)
    }, 2000)
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
      
      {/* 1. Başlangıç Geri Sayımı */}
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

      {/* 2. Oyun Ekranı */}
      {gameState === 'playing' && (
        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 md:p-8 h-full">
          
          {/* Header Bar */}
          <div className="flex justify-between items-center bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-4 md:p-6 mb-8 shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.5)]">
                <span className="text-4xl font-black text-white">{currentLetter}</span>
              </div>
              <div>
                <p className="text-sm text-blue-400 font-bold uppercase tracking-wider">Geçerli Harf</p>
                <p className="text-2xl font-bold">Tur 1 / 10</p>
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

          {/* Form */}
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
                    placeholder={`${currentLetter} ile başlayan...`}
                    className="w-full bg-transparent border-none outline-none text-2xl font-medium text-white placeholder-neutral-700 focus:ring-0"
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer Action */}
          <div className="mt-8 flex justify-end">
            <button 
              onClick={handleSubmit}
              className="group flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-lg shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all hover:scale-105"
            >
              Cevapları Gönder 
              <Send className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Submitting State */}
      {gameState === 'submitting' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold">Cevaplar Değerlendiriliyor...</h2>
          <p className="text-neutral-400 mt-2">Yapay Zeka (Gemini) sonuçları analiz ediyor</p>
        </div>
      )}
    </div>
  )
}
