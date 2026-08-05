'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { startGameAction } from '@/app/actions/gameActions'
import { Users, Crown, Settings, LogOut, CheckCircle2, Play, UserPlus, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

interface Profile {
  id: string
  username: string
  avatar_url?: string
}

interface RoomPlayer {
  id: string
  is_ready: boolean
  profile_id: string
  profiles: Profile
}

interface Room {
  id: string
  owner_id: string
  max_players: number
  status: string
  round_time: number
  total_rounds: number
  is_private: boolean
}

export default function LobbyPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRoomData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)

      // Fetch Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single()

      if (roomError || !roomData) {
        toast.error('Oda bulunamadı.')
        router.push('/')
        return
      }
      setRoom(roomData)

      // Katılımcıyı odaya ekle (eğer daha önce eklenmemişse)
      const { data: existingPlayer } = await supabase
        .from('room_players')
        .select('id')
        .eq('room_id', id)
        .eq('profile_id', user.id)
        .maybeSingle()

      if (!existingPlayer) {
        // Oda kapasitesini kontrol et
        const { count } = await supabase
          .from('room_players')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', id)
          
        if (count !== null && count >= roomData.max_players) {
           toast.error('Oda dolu!')
           router.push('/')
           return
        }

        // Oyuncuyu ekle
        const { error: joinError } = await supabase
          .from('room_players')
          .insert({
            room_id: id,
            profile_id: user.id,
            is_ready: false
          })
        
        if (joinError) {
           toast.error('Odaya katılırken hata oluştu: ' + joinError.message)
        } else {
           toast.success('Odaya katıldınız!')
        }
      }

      // Fetch Players
      fetchPlayers()
      
      setLoading(false)
    }

    const fetchPlayers = async () => {
      const { data: playersData, error } = await supabase
        .from('room_players')
        .select('*, profiles(id, username, avatar_url)')
        .eq('room_id', id)
      
      if (!error && playersData) {
        // @ts-ignore
        setPlayers(playersData)
      }
    }

    fetchRoomData()

    // Realtime subscription
    const channel = supabase.channel(`room:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${id}` },
        () => {
          fetchPlayers() // Reload players when someone joins/leaves/readies up
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` },
        (payload) => {
          setRoom(payload.new as Room)
          if (payload.new.status === 'playing') {
            router.push(`/game/${id}`) // Start game
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, router, supabase])

  const toggleReady = async () => {
    const currentPlayer = players.find(p => p.profile_id === currentUser?.id)
    if (!currentPlayer) return

    await supabase
      .from('room_players')
      .update({ is_ready: !currentPlayer.is_ready })
      .eq('id', currentPlayer.id)
  }

  const startGame = async () => {
    if (!room || room.owner_id !== currentUser?.id) return
    
    // Check if everyone is ready
    const allReady = players.every(p => p.is_ready)
    if (!allReady) {
      toast.error('Tüm oyuncuların hazır olması gerekiyor.')
      return
    }

    try {
      toast.loading('Oyun başlatılıyor...', { id: 'start' })
      await startGameAction(room.id, room.total_rounds)
      toast.success('Oyun başladı!', { id: 'start' })
      // Yönlendirme Realtime tarafından tetiklenecek
    } catch (err: any) {
      toast.error(err.message, { id: 'start' })
    }
  }

  if (loading || !room) {
    return <div className="min-h-screen flex items-center justify-center text-white">Yükleniyor...</div>
  }

  const isOwner = room.owner_id === currentUser?.id
  const currentPlayer = players.find(p => p.profile_id === currentUser?.id)
  
  return (
    <div className="flex flex-col items-center flex-1 w-full px-4 relative z-10 py-12">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-white flex items-center">
              Lobi Bekleme Odası
              {room.is_private && <Lock className="w-6 h-6 ml-3 text-purple-400" />}
            </h1>
            <p className="text-neutral-400 mt-2">
              <span className="font-mono bg-neutral-800 px-2 py-1 rounded-md text-sm">{room.id}</span>
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                toast.success('Oda linki kopyalandı! Arkadaşlarınıza gönderebilirsiniz.')
              }}
              className="flex items-center px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Davet Et
            </button>
            <button 
              onClick={() => router.push('/')}
              className="flex items-center px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4 mr-2" /> Ayrıl
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Players Area */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-400" /> Oyuncular
              </h2>
              <span className="text-sm font-medium text-neutral-400">
                {players.length} / {room.max_players}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border ${
                    player.is_ready ? 'bg-green-900/10 border-green-900/50' : 'bg-neutral-900/50 border-neutral-800'
                  } backdrop-blur-sm`}
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mr-4 font-bold text-lg text-white">
                      {player.profiles.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium flex items-center">
                        {player.profiles.username}
                        {player.profile_id === room.owner_id && (
                          <Crown className="w-4 h-4 ml-2 text-yellow-500" />
                        )}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">Seviye 1</p>
                    </div>
                  </div>
                  {player.is_ready ? (
                    <span className="flex items-center text-xs font-bold text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> HAZIR
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-neutral-500 bg-neutral-800 px-3 py-1.5 rounded-full">
                      BEKLİYOR
                    </span>
                  )}
                </motion.div>
              ))}

              {/* Empty Slots */}
              {Array.from({ length: room.max_players - players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center justify-center p-4 rounded-2xl border border-neutral-800 border-dashed bg-neutral-900/20 text-neutral-600 font-medium">
                  Boş Slot
                </div>
              ))}
            </div>
          </div>

          {/* Room Settings & Controls */}
          <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 h-fit">
            <h2 className="text-xl font-bold text-white flex items-center mb-6">
              <Settings className="w-5 h-5 mr-2 text-neutral-400" /> Oda Ayarları
            </h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Tur Süresi</span>
                <span className="text-white font-medium">{room.round_time} Saniye</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Tur Sayısı</span>
                <span className="text-white font-medium">{room.total_rounds} Tur</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-800">
                <span className="text-neutral-400 text-sm">Yapay Zeka Hakem</span>
                <span className="text-blue-400 font-medium">Aktif</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button 
                onClick={toggleReady}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center ${
                  currentPlayer?.is_ready 
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' 
                    : 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/20'
                }`}
              >
                {currentPlayer?.is_ready ? 'HAZIR DURUMUNU İPTAL ET' : 'HAZIRIM!'}
              </button>

              {isOwner && (
                <button 
                  onClick={startGame}
                  className="w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                >
                  <Play className="w-4 h-4 mr-2" /> OYUNU BAŞLAT
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
