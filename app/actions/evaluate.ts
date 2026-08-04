'use server'

import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/lib/supabase/server'

interface Answer {
  categoryId: string
  categoryName: string
  answerText: string
}

interface EvaluationResult {
  categoryId: string
  isValid: boolean
  reasoning: string
  points: number
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

export async function evaluateAnswers(
  roomId: string,
  roundId: string,
  letter: string,
  answers: Answer[]
): Promise<EvaluationResult[]> {
  const supabase = await createClient()
  
  // 1. Kullanıcıyı al
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 2. Prompt'u hazırla
  const answersList = answers.map(a => `- Kategori: ${a.categoryName} -> Cevap: "${a.answerText}"`).join('\n')
  
  const prompt = `
Sen bir İsim-Şehir oyununda hakemsin. 
Geçerli Harf: "${letter}"

Aşağıda bir oyuncunun verdiği cevaplar var. Bu cevapları şu kurallara göre değerlendir:
1. Cevap "${letter}" harfi ile BAŞLAMALIDIR. Başlamıyorsa geçersizdir (0 puan).
2. Cevap boşsa veya anlamsızsa geçersizdir (0 puan).
3. Cevap kategorisine %100 uygun olmalıdır. Uymuyorsa geçersizdir (0 puan).
4. Eğer geçerli, doğru ve sıradan bir cevap ise 10 puan ver.
5. Eğer geçerli ve çok yaratıcı/nadir bilinen bir cevap ise 12-15 arası ekstra puan ver.

Lütfen yanıtını SADECE aşağıdaki JSON formatında ver. Başka hiçbir açıklama metni ekleme.
[
  {
    "categoryId": "...",
    "isValid": true/false,
    "reasoning": "Neden geçerli veya geçersiz olduğuyla ilgili 1 cümlelik Türkçe açıklama",
    "points": 10
  }
]

Oyuncunun Cevapları:
${answersList}
`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const text = response.text || '[]'
    
    // JSON'ı temizle (Bazen markdown bloğu içinde dönebilir)
    const jsonStr = text.replace(/```json\n?|```\n?/g, '').trim()
    const evaluations = JSON.parse(jsonStr) as EvaluationResult[]

    // 3. Veritabanına kaydet
    for (const evalResult of evaluations) {
      const answerRecord = answers.find(a => a.categoryId === evalResult.categoryId)
      if (!answerRecord) continue

      // Önce answer tablosuna yaz
      const { data: ansData } = await supabase.from('answers').upsert({
        round_id: roundId,
        profile_id: user.id,
        category_id: evalResult.categoryId,
        answer_text: answerRecord.answerText
      }).select().single()

      if (ansData) {
        // Sonra review tablosuna yaz
        await supabase.from('answer_reviews').insert({
          answer_id: ansData.id,
          is_valid: evalResult.isValid,
          reasoning: evalResult.reasoning,
          points_awarded: evalResult.points
        })
      }
    }

    return evaluations
  } catch (error) {
    console.error('Gemini evaluation error:', error)
    throw new Error('Değerlendirme sırasında bir hata oluştu.')
  }
}
