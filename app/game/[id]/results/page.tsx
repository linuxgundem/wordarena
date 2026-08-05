'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, CheckCircle, XCircle, ArrowRight, BrainCircuit, Star, Loader2, AlertTriangle, User, UserMinus, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

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

  // Sürekli İtiraz ve Doğrulama State'leri (Cevap ID -> İtiraz Edenlerin/Doğrulayanların Listesi)
  const [objections, setObjections] = useState<Record<string, { id: string, username: string }[]>>({})
  const [verifications, setVerifications] = useState<Record<string, { id: string, username: string }[]>>({})

  const fetchResults = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()
    setCurrentUser({ ...user, username: profile?.username || 'Anonim' })

    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', id).single()
    setRoom(roomData)

    const { data: gameData } = await supabase.from('games').select('*').eq('room_id', id).order('started_at', { ascending: false }).limit(1).single()
    if (!gameData) return
    setGame(gameData)

    const { data: roundData } = await supabase.from('rounds').select('*').eq('game_id', gameData.id).not('ended_at', 'is', null).order('round_number', { ascending: false }).limit(1).single()
    if (!roundData) return
    setRound(roundData)

    const { data: scoreData } = await supabase.from('scores').select('total_score').eq('game_id', gameData.id).eq('profile_id', user.id).maybeSingle()
    if (scoreData) setTotalScore(scoreData.total_score)

    // TÜM oyuncuların cevaplarını çek
    const { data: answersData } = await supabase
      .from('answers')
      .select('id, answer_text, category_name, profile_id, categories(name), profiles(username)')
      .eq('round_id', roundData.id)

    if (answersData && answersData.length > 0) {
      const answerIds = answersData.map(a => a.id)
      const { data: reviewsData } = await supabase.from('answer_reviews').select('*').in('answer_id', answerIds)
      
      const combined = answersData.map(a => {
         const rev = reviewsData?.find(r => r.answer_id === a.id)
         const cat = (a.categories as any)?.name || a.category_name
         const p = a.profiles as any
         return {
           id: a.id,
           profileId: a.profile_id,
           username: p?.username || 'Anonim',
           category: cat,
           answer: a.answer_text,
           isValid: rev?.is_valid || false,
           points: rev?.points_awarded || 0,
           reasoning: rev?.reasoning || 'Cevap bulunamadı veya değerlendirilemedi.',
           _revoked: false,
           _verified: false
         }
      })
      // Kategorilere göre sırala
      combined.sort((a, b) => a.category.localeCompare(b.category))
      setResults(combined)
    }
    setLoading(false)
  }, [id, router, supabase])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  useEffect(() => {
    if (!game) return
    const channel = supabase.channel(`game:${game.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rounds', filter: `game_id=eq.${game.id}` }, () => {
        window.location.href = `/game/${id}`
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, (payload) => {
          if (payload.new.status === 'finished') {
             toast.success('Oyun bitti! Lobiye dönülüyor...')
             router.push(`/room/${id}`)
          }
      })
      .on('broadcast', { event: 'answer_objected' }, ({ payload }) => {
         setObjections(prev => {
            const arr = prev[payload.answerId] || []
            if (arr.some(a => a.id === payload.profileId)) return prev
            return { ...prev, [payload.answerId]: [...arr, { id: payload.profileId, username: payload.username }] }
         })
         checkThresholds(payload.answerId, 'objection', payload.activePlayersCount)
      })
      .on('broadcast', { event: 'answer_verified' }, ({ payload }) => {
         setVerifications(prev => {
            const arr = prev[payload.answerId] || []
            if (arr.some(a => a.id === payload.profileId)) return prev
            return { ...prev, [payload.answerId]: [...arr, { id: payload.profileId, username: payload.username }] }
         })
         checkThresholds(payload.answerId, 'verification', payload.activePlayersCount)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [game, id, router, supabase])

  const activePlayersCount = useMemo(() => {
    return Math.max(1, new Set(results.map(r => r.profileId)).size)
  }, [results])

  // Eşik kontrolünü hem local tetikleyici hem de yayın alanlar kontrol eder
  // Ancak DB güncellemesini sadece tetikleyici (oy veren) yapar
  const checkThresholds = (answerId: string, type: 'objection' | 'verification', currentTotalPlayers: number) => {
     setResults(prev => {
        return prev.map(res => {
           if (res.id !== answerId) return res
           
           const threshold = Math.max(1, currentTotalPlayers - 1)
           
           if (type === 'objection') {
              setObjections(objs => {
                 const currentList = objs[answerId] || []
                 if (currentList.length >= threshold && !res._revoked) {
                    res._revoked = true
                    res.isValid = false
                    res.points = 0
                 }
                 return objs
              })
           } else if (type === 'verification') {
              setVerifications(vers => {
                 const currentList = vers[answerId] || []
                 if (currentList.length >= threshold && !res._verified) {
                    res._verified = true
                    res.isValid = true
                    res.points = 10
                 }
                 return vers
              })
           }
           return res
        })
     })
  }

  const handleObject = async (res: any) => {
    if (!currentUser || res._revoked || res._verified) return
    if (res.profileId === currentUser.id) return toast.error("Kendi cevabınıza itiraz edemezsiniz!")

    const currentList = objections[res.id] || []
    if (currentList.some(a => a.id === currentUser.id)) return
    
    const newArr = [...currentList, { id: currentUser.id, username: currentUser.username }]
    setObjections(prev => ({ ...prev, [res.id]: newArr }))

    supabase.channel(`game:${game.id}`).send({
      type: 'broadcast',
      event: 'answer_objected',
      payload: { answerId: res.id, profileId: currentUser.id, username: currentUser.username, activePlayersCount }
    })

    const threshold = Math.max(1, activePlayersCount - 1)
    if (newArr.length >= threshold) {
      toast.success('Oy çokluğuyla puan İPTAL edildi!')
      // DB Güncellemesini sadece bu eşiği aşan kişi (son itirazı yapan) yapar
      await supabase.from('answer_reviews').update({ is_valid: false, points_awarded: 0 }).eq('answer_id', res.id)
      const { data: scoreData } = await supabase.from('scores').select('total_score').eq('game_id', game.id).eq('profile_id', res.profileId).maybeSingle()
      if (scoreData) {
         await supabase.from('scores').update({ total_score: Math.max(0, scoreData.total_score - res.points) }).eq('game_id', game.id).eq('profile_id', res.profileId)
      }
      checkThresholds(res.id, 'objection', activePlayersCount)
    }
  }

  const handleVerify = async (res: any) => {
    if (!currentUser || res._revoked || res._verified) return
    if (res.profileId === currentUser.id) return toast.error("Kendi cevabınızı onaylayamazsınız!")

    const currentList = verifications[res.id] || []
    if (currentList.some(a => a.id === currentUser.id)) return
    
    const newArr = [...currentList, { id: currentUser.id, username: currentUser.username }]
    setVerifications(prev => ({ ...prev, [res.id]: newArr }))

    supabase.channel(`game:${game.id}`).send({
      type: 'broadcast',
      event: 'answer_verified',
      payload: { answerId: res.id, profileId: currentUser.id, username: currentUser.username, activePlayersCount }
    })

    const threshold = Math.max(1, activePlayersCount - 1)
    if (newArr.length >= threshold) {
      toast.success('Oy çokluğuyla KABUL edildi!')
      await supabase.from('answer_reviews').update({ is_valid: true, points_awarded: 10 }).eq('answer_id', res.id)
      const { data: scoreData } = await supabase.from('scores').select('total_score').eq('game_id', game.id).eq('profile_id', res.profileId).maybeSingle()
      if (scoreData) {
         await supabase.from('scores').update({ total_score: scoreData.total_score + 10 }).eq('game_id', game.id).eq('profile_id', res.profileId)
      }
      checkThresholds(res.id, 'verification', activePlayersCount)
    }
  }

  const handleNextRound = async () => {
    if (!game || !round) return
    setIsStartingNext(true)
    try {
       const alphabet = "ABCDEFGHIJKLMNOPRSTUVYZ"
       const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)]

       const { error } = await supabase.from('rounds').insert({ game_id: game.id, round_number: round.round_number + 1, letter: randomLetter })
       if (error) throw new Error("Yeni tur başlatılamadı.")
    } catch (err: any) {
       toast.error(err.message)
       setIsStartingNext(false)
    }
  }

  const groupedResults = useMemo(() => {
    return results.reduce((acc: any, res: any) => {
      if (!acc[res.category]) acc[res.category] = []
      acc[res.category].push(res)
      return acc
    }, {})
  }, [results, objections, verifications])

  if (loading) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Sonuçlar yükleniyor...</div>

  const isOwner = room?.owner_id === currentUser?.id

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-12 px-4 relative z-10 overflow-x-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }} className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)] mb-6">
            <Trophy className="w-10 h-10 text-yellow-300 mb-1" />
            <span className="text-4xl font-black">{totalScore}</span>
          </motion.div>
          <h1 className="text-4xl font-extrabold mb-4">Tur {round?.round_number} Sonuçları</h1>
          <p className="text-neutral-400 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 mr-2 text-blue-400" /> Tüm oyuncuların cevapları aşağıdadır.
          </p>
        </div>

        <div className="flex flex-col gap-8 mb-12">
          {results.length === 0 ? (
            <div className="text-center p-8 bg-neutral-900/50 rounded-2xl border border-neutral-800 text-neutral-400">
              Bu tur hiç cevap gönderilmedi.
            </div>
          ) : (
            Object.entries(groupedResults).map(([categoryName, categoryResults]: any) => (
              <div key={categoryName} className="bg-neutral-900/30 rounded-3xl p-6 border border-neutral-800/50 shadow-xl">
                <h2 className="text-2xl font-black text-blue-400 mb-6 uppercase tracking-widest border-b border-blue-900/30 pb-4 flex items-center">
                  Kategori: {categoryName}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryResults.map((res: any, index: number) => {
                     const obs = objections[res.id] || []
                     const vers = verifications[res.id] || []
                     const isDone = res._revoked || res._verified
                     const bgCard = res._revoked ? 'bg-neutral-900/30 border-neutral-800 opacity-60 grayscale' : res._verified ? 'bg-green-900/10 border-green-900/30' : res.isValid ? 'bg-blue-900/10 border-blue-900/30' : 'bg-red-900/10 border-red-900/30'
                     
                     return (
                      <motion.div key={res.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }} className={`p-5 rounded-2xl border backdrop-blur-sm flex flex-col justify-between gap-3 relative ${bgCard}`}>
                        
                        {res._revoked && (
                          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className="bg-red-600 text-white font-black px-6 py-2 rounded-xl rotate-12 text-2xl uppercase border-4 border-red-800 shadow-2xl">
                              İptal Edildi
                            </div>
                          </div>
                        )}
                        {res._verified && (
                          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className="bg-green-600 text-white font-black px-6 py-2 rounded-xl -rotate-12 text-2xl uppercase border-4 border-green-800 shadow-2xl">
                              Kabul Edildi
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-start z-0">
                           <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                             <User className="w-4 h-4" /> {res.username}
                           </div>
                           <div className="flex items-center bg-neutral-900/50 px-3 py-1 rounded-lg border border-neutral-800">
                              <span className={`font-black text-lg ${res.points > 0 ? 'text-green-400' : 'text-neutral-500 line-through'}`}>+{res.points}</span>
                           </div>
                        </div>
                        
                        <div className={`flex items-start gap-3 z-0 ${res._revoked ? 'opacity-50' : ''}`}>
                          {res.isValid ? <CheckCircle className="w-6 h-6 text-green-500 mt-1" /> : <XCircle className="w-6 h-6 text-red-500 mt-1" />}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-neutral-500 uppercase">{res.category}:</span>
                              <span className={`text-lg font-bold text-white break-all ${res._revoked ? 'line-through text-neutral-500' : ''}`}>{res.answer}</span>
                            </div>
                            <p className="text-xs text-neutral-400 leading-relaxed">{res.reasoning}</p>
                          </div>
                        </div>

                        {!isDone && (
                          <div className="mt-4 pt-4 border-t border-white/5 z-0">
                            {res.isValid ? (
                              <>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {obs.map(o => (
                                    <span key={o.id} className="text-xs bg-red-900/30 text-red-400 border border-red-900/50 px-2 py-1 rounded-md flex items-center">
                                      <UserMinus className="w-3 h-3 mr-1" /> {o.username}
                                    </span>
                                  ))}
                                </div>
                                {res.profileId !== currentUser?.id && (
                                  <button onClick={() => handleObject(res)} disabled={obs.some((o:any) => o.id === currentUser?.id)} className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-300 text-sm font-medium rounded-xl transition-colors border border-neutral-700 hover:border-neutral-500 flex items-center justify-center">
                                    <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" /> Haksız Puan: İtiraz Et
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {vers.map(v => (
                                    <span key={v.id} className="text-xs bg-green-900/30 text-green-400 border border-green-900/50 px-2 py-1 rounded-md flex items-center">
                                      <UserCheck className="w-3 h-3 mr-1" /> {v.username}
                                    </span>
                                  ))}
                                </div>
                                {res.profileId !== currentUser?.id && (
                                  <button onClick={() => handleVerify(res)} disabled={vers.some((v:any) => v.id === currentUser?.id)} className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-300 text-sm font-medium rounded-xl transition-colors border border-neutral-700 hover:border-neutral-500 flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Doğrula / Puan Ver
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-center">
          {isOwner ? (
             <button onClick={handleNextRound} disabled={isStartingNext} className="group flex items-center px-8 py-4 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-xl">
               {isStartingNext && <Loader2 className="w-5 h-5 mr-3 animate-spin" />}
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
