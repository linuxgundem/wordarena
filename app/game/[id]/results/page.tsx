'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Trophy, CheckCircle, XCircle, ArrowRight, BrainCircuit, Star, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { startNextRoundAction } from '@/app/actions/gameActions'

export default function ResultsPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [totalScore, setTotalScore] = useState(0)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [room, setRoom] = useState<any>(null)
  const [game, setGame] = useState<any>(null)
  const [round, setRound] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isStartingNext, setIsStartingNext] = useState(false)

  useEffect(() => {
    const fetchResults = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setCurrentUser(user)

      // Fetch Room
      const { data: roomData } = await supabase.from('rooms').select('*').eq('id', id).single()
      setRoom(roomData)

      // Fetch Game
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('room_id', id)
        .order('started_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!gameData) return
      setGame(gameData)

      // Fetch Last Ended Round
      const { data: roundData } = await supabase
        .from('rounds')
        .select('*')
        .eq('game_id', gameData.id)
        .not('ended_at', 'is', null)
        .order('round_number', { ascending: false })
        .limit(1)
        .single()
      
      if (!roundData) return
      setRound(roundData)

      // Fetch Total Score
      const { data: scoreData } = await supabase
        .from('scores')
        .select('total_score')
        .eq('game_id', gameData.id)
        .eq('profile_id', user.id)
        .maybeSingle()
      
      if (scoreData) setTotalScore(scoreData.total_score)

      // Fetch Answers and Reviews for this round
      const { data: answersData } = await supabase
        .from('answers')
        .select('id, answer_text, categories(name)')
        .eq('round_id', roundData.id)
        .eq('profile_id', user.id)

      if (answersData && answersData.length > 0) {
        const answerIds = answersData.map(a => a.id)
        const { data: reviewsData } = await supabase
          .from('answer_reviews')
          .select('*')
          .in('answer_id', answerIds)
        
        const combined = answersData.map(a => {
           const rev = reviewsData?.find(r => r.answer_id === a.id)
           return {
             category: a.categories?.name,
             answer: a.answer_text,
             isValid: rev?.is_valid || false,
             points: rev?.points_awarded || 0,
             reasoning: rev?.reasoning || 'Cevap bulunamadı veya değerlendirilemedi.'
           }
        })
        setResults(combined)
      }

      setLoading(false)
    }

    fetchResults()
  }, [id, router, supabase])

  // Realtime subscription for next round start
  useEffect(() => {
    if (!game) return
    const channel = supabase.channel(`game:${game.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rounds', filter: `game_id=eq.${game.id}` },
        (payload) => {
          // Yeni tur eklendi, oyuna dön!
          toast.success('Yeni tur başlıyor!')
          router.push(`/game/${id}`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.new.status === 'finished') {
             toast.success('Oyun bitti! Lobiye dönülüyor...')
             router.push(`/room/${id}`)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game, id, router, supabase])


  const handleNextRound = async () => {
    if (!game || !round) return
    setIsStartingNext(true)
    try {
       await startNextRoundAction(game.id, round.round_number)
       // Realtime event will redirect everyone
    } catch (err: any) {
       toast.error(err.message)
       setIsStartingNext(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Sonuçlar yükleniyor...</div>
  }

  const isOwner = room?.owner_id === currentUser?.id

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-12 px-4 relative z-10 overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
            className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)] mb-6"
          >
            <Trophy className="w-10 h-10 text-yellow-300 mb-1" />
            <span className="text-4xl font-black">{totalScore}</span>
          </motion.div>
          
          <h1 className="text-4xl font-extrabold mb-4">Tur {round?.round_number} Sonuçları</h1>
          <p className="text-neutral-400 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 mr-2 text-blue-400" /> 
            Cevapların Gemini Yapay Zekası tarafından değerlendirildi.
          </p>
        </div>

        <div className="space-y-4 mb-12">
          {results.length === 0 ? (
            <div className="text-center p-8 bg-neutral-900/50 rounded-2xl border border-neutral-800 text-neutral-400">
              Bu tur hiç cevap gönderemediniz.
            </div>
          ) : (
            results.map((res, index) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.3 }}
                key={index}
                className={`p-6 rounded-2xl border backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  res.isValid 
                    ? 'bg-blue-900/10 border-blue-900/30' 
                    : 'bg-red-900/10 border-red-900/30'
                }`}
              >
                <div className="flex items-start md:items-center gap-4">
                  <div className="mt-1 md:mt-0">
                    {res.isValid ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{res.category}</span>
                      <span className="text-xl font-bold text-white">{res.answer}</span>
                    </div>
                    <p className="text-sm text-neutral-300 flex items-center">
                      <span className="opacity-70 mr-2">Yapay Zeka Yorumu:</span> 
                      {res.reasoning}
                    </p>
                  </div>
                </div>

                <div className="flex items-center bg-neutral-900/50 px-4 py-2 rounded-xl border border-neutral-800 w-fit">
                  {res.points > 10 && <Star className="w-4 h-4 text-yellow-500 mr-2" />}
                  <span className={`font-black text-xl ${res.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    +{res.points}
                  </span>
                  <span className="text-xs text-neutral-500 ml-1">Puan</span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="flex justify-center">
          {isOwner ? (
             <button 
               onClick={handleNextRound}
               disabled={isStartingNext}
               className="group flex items-center px-8 py-4 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-xl"
             >
               {isStartingNext ? (
                 <Loader2 className="w-5 h-5 mr-3 animate-spin" /> 
               ) : null}
               Sonraki Tura Geç <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
             </button>
          ) : (
             <div className="px-8 py-4 bg-neutral-900 text-neutral-400 rounded-2xl font-bold text-lg border border-neutral-800 flex items-center">
                <Loader2 className="w-5 h-5 mr-3 animate-spin" /> Oda Kurucusunun Başlatması Bekleniyor...
             </div>
          )}
        </div>

      </motion.div>
    </div>
  )
}
