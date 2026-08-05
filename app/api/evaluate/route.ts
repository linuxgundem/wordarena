import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { GoogleGenAI } from '@google/genai'

async function getSupabase() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch (error) {}
        },
      },
    }
  )
}

export async function POST(request: Request) {
  try {
    const { roundId, roomId } = await request.json()
    const supabase = await getSupabase()
    
    // 1. Tur ve Harf bilgisini çek
    const { data: round } = await supabase.from('rounds').select('*, games(room_id)').eq('id', roundId).single()
    if (!round) return NextResponse.json({ error: 'Tur bulunamadı' }, { status: 404 })

    const { data: roomData } = await supabase.from('rooms').select('total_rounds').eq('id', roomId).single()
    const currentLetter = round.letter

    // 2. Bu turdaki tüm cevapları çek
    const { data: answers } = await supabase
      .from('answers')
      .select('id, answer_text, profile_id, categories(name)')
      .eq('round_id', roundId)

    if (!answers || answers.length === 0) {
      await supabase.from('rounds').update({ ended_at: new Date().toISOString() }).eq('id', round.id)
      
      const totalRounds = roomData?.total_rounds || 10
      if (round.round_number >= totalRounds) {
        await supabase.from('games').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', round.game_id)
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', round.games.room_id)
        return NextResponse.json({ status: 'game_over' })
      }
      return NextResponse.json({ status: 'round_evaluated' })
    }

    // 3. Gemini Prompt'u Hazırla
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY eksik.' }, { status: 500 })

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `Sen bir İsim-Şehir oyunu hakemisin. Geçerli harf: "${currentLetter}".
Oyun Türkçe oynanıyor. Aşağıdaki JSON listesinde oyuncuların verdiği cevaplar var.
Kurallar:
1. Kelime verilen "${currentLetter}" harfiyle başlamalıdır. (Tolerans gösterme)
2. Kelime verilen kategoriye uygun olmalıdır (Örn: Karpuz bir meyvedir, bitki kategorisinde 10 puan sayılır. Kasiyer meslektir vb.)
3. Mantıksız, harfle başlamayan veya uydurma kelimeler için isValid=false, geçerliyse isValid=true yap.
4. "reasoning" kısmında nedenini (1 kısa cümle) Türkçe açıkla.

Gelen Veri:
${JSON.stringify(answers.map(a => {
  const cat = a.categories as any
  return { id: a.id, cat: cat?.name, ans: a.answer_text }
}), null, 2)}

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
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
        const cat = answer.categories as any
        const key = `${cat?.name}:${answer.answer_text}`
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
        const cat = answer.categories as any
        const key = `${cat?.name}:${answer.answer_text}`
        const count = validAnswersMap[key] ? validAnswersMap[key].length : 0
        
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
          .insert({ game_id: round.game_id, profile_id: profileId, total_score: points })
      }
    }

    // 6. Turu bitir
    await supabase.from('rounds').update({ ended_at: new Date().toISOString() }).eq('id', round.id)
    
    const totalRounds = roomData?.total_rounds || 10
    if (round.round_number >= totalRounds) {
      await supabase.from('games').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', round.game_id)
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', round.games.room_id)
      return NextResponse.json({ status: 'game_over' })
    }

    return NextResponse.json({ status: 'round_evaluated' })

  } catch (err: any) {
    console.error("Gemini Hatası:", err)
    return NextResponse.json({ error: "Değerlendirme başarısız oldu: " + err.message }, { status: 500 })
  }
}
