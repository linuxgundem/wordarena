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

    // 3. Benzersiz cevapları grupla (Gemini aynı cevapları tekrar tekrar değerlendirmesin diye)
    const uniqueAnswersMap: Record<string, { cat: string, ans: string, ids: string[], profileIds: string[] }> = {}
    
    for (const a of answers) {
      const catName = (a.categories as any)?.name || 'Bilinmeyen'
      const text = a.answer_text || ''
      const key = `${catName}:::${text}`
      
      if (!uniqueAnswersMap[key]) {
        uniqueAnswersMap[key] = { cat: catName, ans: text, ids: [], profileIds: [] }
      }
      uniqueAnswersMap[key].ids.push(a.id)
      if (!uniqueAnswersMap[key].profileIds.includes(a.profile_id)) {
        uniqueAnswersMap[key].profileIds.push(a.profile_id)
      }
    }

    const uniqueListToEvaluate = Object.values(uniqueAnswersMap).map((u, idx) => ({
      evalId: idx.toString(),
      cat: u.cat,
      ans: u.ans
    }))

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY eksik.' }, { status: 500 })

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `Sen katı ve acımasız ama çok bilgili bir İsim-Şehir oyunu hakemisin. Geçerli harf: "${currentLetter}".
Oyun Türkçe oynanıyor. Aşağıdaki JSON listesinde oyuncuların gönderdiği kelimeleri değerlendireceksin.

KURALLAR (ÇOK KATI):
1. HARF KURALI: Kelime kesinlikle ve istisnasız "${currentLetter}" harfiyle başlamalıdır. (BÜYÜK/küçük harf duyarlılığı yoktur; i/İ, ı/I, ç/Ç, ş/Ş, ğ/Ğ, ö/Ö, ü/Ü harfleri Türkçedeki gibi eşdeğer sayılır. Örn: Harf "İ" ise, "inek" yazılması geçerlidir).
2. BİRDEN FAZLA KELİME SERBESTTİR: Oyuncular özel isim, ünlü kişi, ülke gibi kategorilerde 2 veya 3 kelimelik cevaplar yazabilirler (Örn: "Cem Yılmaz", "Güney Kore", "Los Angeles"). Birden fazla kelime olması KESİNLİKLE GEÇERLİDİR ve hata sebebi değildir.
3. DETAYLI AMA KISA AÇIKLAMA (ÖNEMLİ): 
- Kelime DOĞRUYSA: "reasoning" kısmında sadece "bu geçerlidir" deme. Yazılan kelimenin TAM OLARAK ne olduğunu, sözlük anlamını veya o kişinin kim olduğunu **kısa ve öz bir şekilde (1-2 cümle)** açıkla. Çok uzatma. (Örn: "ZEYNEP, Arapça kökenli olup 'değerli taş' anlamına gelen yaygın bir kadın ismidir." veya "ZEBRA, Afrika'ya özgü, siyah-beyaz çizgili otçul bir memeli türüdür.")
- Kelime YANLIŞSA veya YANLIŞ YAZILMIŞSA: Neden yanlış olduğunu kısaca açıkla ve mutlaka o kategoriye uyan doğru bir örnek kelime ver. (Örn: "ELMA bir Hayvan değildir, C harfiyle başlayan bir hayvan için 'Ceylan' yazabilirdin.")
4. Asla "birden fazla kelimeden oluştuğu için geçersizdir" deme. İki/üç kelime (özel isim vb.) her zaman serbesttir.

Değerlendirilecek Veri:
${JSON.stringify(uniqueListToEvaluate, null, 2)}

SADECE ŞU JSON FORMATINDA YANIT VER:
{
  "results": [
    {
      "evalId": "0",
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

    // 4. Puanları Hesapla ve Dağıt
    const reviews = []
    const playerScores: Record<string, number> = {}

    for (const res of evaluation.results) {
      const u = uniqueListToEvaluate.find(x => x.evalId === res.evalId)
      if (!u) continue

      const key = `${u.cat}:::${u.ans}`
      const group = uniqueAnswersMap[key]
      if (!group) continue

      let points = 0
      if (res.isValid) {
        // Kaç FARKLI oyuncu aynı cevabı vermiş?
        const distinctPlayersCount = group.profileIds.length
        points = distinctPlayersCount === 1 ? 10 : 5
      }

      // Bu gruba (aynı kelimeye) ait tüm cevaplar (answer_id) için aynı yorumu kaydet
      for (const answerId of group.ids) {
        reviews.push({
          answer_id: answerId,
          is_valid: res.isValid,
          reasoning: res.reasoning,
          points_awarded: points
        })
      }

      // Oyuncuların toplam puanlarını topla
      for (const answer of answers) {
         if (group.ids.includes(answer.id) && res.isValid) {
            if (!playerScores[answer.profile_id]) playerScores[answer.profile_id] = 0
            playerScores[answer.profile_id] += points
         }
      }
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
