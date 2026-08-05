'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { GoogleGenAI } from '@google/genai'

// Supabase Sunucu İstemcisi Oluşturucu
async function getSupabase() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {}
        },
      },
    }
  )
}

const DEFAULT_CATEGORIES = ['İsim', 'Şehir', 'Ülke', 'Hayvan', 'Bitki', 'Meslek']

// Kategorileri veritabanına ekle (Yarım kalmış kurulumlar için)
export async function seedCategories() {
  const supabase = await getSupabase()
  
  for (const cat of DEFAULT_CATEGORIES) {
    await supabase.from('categories').insert({ name: cat }).select().single().catch(() => {})
  }
}

// Oyunu Başlat
export async function startGameAction(roomId: string, maxRounds: number) {
  const supabase = await getSupabase()
  
  // 1. Kategorileri tohumla (ne olur ne olmaz)
  await seedCategories()

  // 2. Game oluştur
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      room_id: roomId,
      status: 'in_progress'
    })
    .select()
    .single()

  if (gameError || !game) throw new Error('Oyun oluşturulamadı: ' + gameError?.message)

  // 3. İlk turu oluştur
  const alphabet = "ABCDEFGHIJKLMNOPRSTUVYZ"
  const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)]

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      game_id: game.id,
      round_number: 1,
      letter: randomLetter
    })
    .select()
    .single()

  if (roundError || !round) throw new Error('Tur oluşturulamadı: ' + roundError?.message)

  // 4. Oda durumunu playing yap (Realtime tetikler)
  await supabase
    .from('rooms')
    .update({ status: 'playing' })
    .eq('id', roomId)

  return { game, round }
}

// Cevap Gönderme
export async function submitAnswersAction(roundId: string, answersObj: Record<string, string>) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Giriş yapmanız gerekli.')

  // Kategorileri al
  const { data: categories } = await supabase.from('categories').select('id, name')
  if (!categories) throw new Error('Kategoriler bulunamadı.')

  const inserts = []
  for (const [catName, answerText] of Object.entries(answersObj)) {
    const category = categories.find(c => c.name === catName)
    if (!category || !answerText.trim()) continue

    inserts.push({
      round_id: roundId,
      profile_id: user.id,
      category_id: category.id,
      answer_text: answerText.trim().toUpperCase()
    })
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('answers').insert(inserts)
    if (error && error.code !== '23505') { // Ignore unique constraint violation if re-submitted
      throw new Error('Cevaplar kaydedilemedi: ' + error.message)
    }
  }
  
  return true
}

// Tur Değerlendirme (Gemini API ile)
export async function evaluateRoundAction(roundId: string, roomId: string) {
  const supabase = await getSupabase()
  
  // 1. Tur ve Harf bilgisini çek
  const { data: round } = await supabase.from('rounds').select('*, games(room_id)').eq('id', roundId).single()
  if (!round) throw new Error('Tur bulunamadı')

  const { data: roomData } = await supabase.from('rooms').select('total_rounds').eq('id', roomId).single()

  const currentLetter = round.letter

  // 2. Bu turdaki tüm cevapları çek
  const { data: answers } = await supabase
    .from('answers')
    .select('id, answer_text, profile_id, categories(name)')
    .eq('round_id', roundId)

  if (!answers || answers.length === 0) {
    // Kimse cevap vermemişse direkt turu bitir
    return await proceedToNextRound(round, roomData?.total_rounds || 10, supabase)
  }

  // 3. Gemini Prompt'u Hazırla
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY eksik.')

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `Sen bir İsim-Şehir oyunu hakemisin. Geçerli harf: "${currentLetter}".
Oyun Türkçe oynanıyor. Aşağıdaki JSON listesinde oyuncuların verdiği cevaplar var.
Kurallar:
1. Kelime verilen "${currentLetter}" harfiyle başlamalıdır. (Tolerans gösterme)
2. Kelime verilen kategoriye uygun olmalıdır (Örn: Karpuz bir meyvedir, bitki kategorisinde 10 puan sayılır. Kasiyer meslektir vb.)
3. Mantıksız, harfle başlamayan veya uydurma kelimeler için isValid=false, geçerliyse isValid=true yap.
4. "reasoning" kısmında nedenini (1 kısa cümle) Türkçe açıkla.

Gelen Veri:
${JSON.stringify(answers.map(a => ({ id: a.id, cat: a.categories.name, ans: a.answer_text })), null, 2)}

SADECE ŞU JSON FORMATINDA YANIT VER, BAŞKA HİÇBİR YAZI EKLEME:
{
  "results": [
    {
      "id": "cevap_id",
      "isValid": true,
      "reasoning": "Açıklama"
    }
  ]
}
`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    })

    const rawResponse = response.text || "{}"
    const cleanedResponse = rawResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim()
    const evaluation = JSON.parse(cleanedResponse)

    // 4. Puanları Hesapla
    const reviews = []
    const validAnswersMap: Record<string, string[]> = {}

    for (const res of evaluation.results) {
      const answer = answers.find(a => a.id === res.id)
      if (!answer) continue

      if (res.isValid) {
        const key = `${answer.categories.name}:${answer.answer_text}`
        if (!validAnswersMap[key]) validAnswersMap[key] = []
        validAnswersMap[key].push(answer.profile_id)
      }
    }

    const playerScores: Record<string, number> = {}

    for (const res of evaluation.results) {
      const answer = answers.find(a => a.id === res.id)
      if (!answer) continue

      let points = 0
      if (res.isValid) {
        const key = `${answer.categories.name}:${answer.answer_text}`
        const count = validAnswersMap[key].length
        
        if (count === 1) points = 10
        else points = 5
      }

      reviews.push({
        answer_id: res.id,
        is_valid: res.isValid,
        reasoning: res.reasoning,
        points_awarded: points
      })

      if (!playerScores[answer.profile_id]) playerScores[answer.profile_id] = 0
      playerScores[answer.profile_id] += points
    }

    // 5. Veritabanına Kaydet
    if (reviews.length > 0) {
      await supabase.from('answer_reviews').insert(reviews)
    }

    // Skorları güncelle
    for (const [profileId, points] of Object.entries(playerScores)) {
      const { data: currentScoreData } = await supabase
        .from('scores')
        .select('total_score')
        .eq('game_id', round.game_id)
        .eq('profile_id', profileId)
        .maybeSingle()
      
      if (currentScoreData) {
        await supabase
          .from('scores')
          .update({ total_score: currentScoreData.total_score + points })
          .eq('game_id', round.game_id)
          .eq('profile_id', profileId)
      } else {
        await supabase
          .from('scores')
          .insert({
            game_id: round.game_id,
            profile_id: profileId,
            total_score: points
          })
      }
    }

    // 6. Turu bitir
    await supabase.from('rounds').update({ ended_at: new Date().toISOString() }).eq('id', round.id)
    
    // Check if game over
    const totalRounds = roomData?.total_rounds || 10
    if (round.round_number >= totalRounds) {
      await supabase.from('games').update({ 
        status: 'completed', 
        finished_at: new Date().toISOString() 
      }).eq('id', round.game_id)
      
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', round.games.room_id)
      return { status: 'game_over' }
    }

    return { status: 'round_evaluated' }

  } catch (err: any) {
    console.error("Gemini Hatası:", err)
    throw new Error("Değerlendirme başarısız oldu: " + err.message)
  }
}

// Sonraki Turu Başlat (Host tetikler)
export async function startNextRoundAction(gameId: string, currentRoundNumber: number) {
  const supabase = await getSupabase()

  const alphabet = "ABCDEFGHIJKLMNOPRSTUVYZ"
  const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)]

  const { data: nextRound, error } = await supabase
    .from('rounds')
    .insert({
      game_id: gameId,
      round_number: currentRoundNumber + 1,
      letter: randomLetter
    })
    .select()
    .single()
    
  if (error) throw new Error("Yeni tur başlatılamadı.")
  return nextRound
}
