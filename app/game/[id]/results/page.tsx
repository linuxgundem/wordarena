'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Trophy, CheckCircle, XCircle, ArrowRight, BrainCircuit, Star } from 'lucide-react'
import Link from 'next/link'

// Dummy evaluation data for UI preview
const dummyResults = [
  { category: 'İsim', answer: 'Kemal', isValid: true, points: 10, reasoning: 'Geçerli ve yaygın bir isim.' },
  { category: 'Şehir', answer: 'Kastamonu', isValid: true, points: 10, reasoning: 'Geçerli bir Türkiye şehri.' },
  { category: 'Ülke', answer: 'Kenya', isValid: true, points: 10, reasoning: 'Geçerli bir Afrika ülkesi.' },
  { category: 'Hayvan', answer: 'Kivi Kuşu', isValid: true, points: 15, reasoning: 'Çok yaratıcı! Nadir bilinen bir kuş türü.' },
  { category: 'Bitki', answer: 'Karpuz', isValid: false, points: 0, reasoning: 'Karpuz bir bitki değil, meyvedir.' },
  { category: 'Meslek', answer: 'Kasiyer', isValid: true, points: 10, reasoning: 'Geçerli bir meslek.' },
]

export default function ResultsPage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [totalScore, setTotalScore] = useState(0)

  useEffect(() => {
    const score = dummyResults.reduce((acc, curr) => acc + curr.points, 0)
    setTotalScore(score)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-12 px-4 relative z-10 overflow-hidden">
      {/* Dekoratif Arka Plan */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        {/* Header - Total Score */}
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
          
          <h1 className="text-4xl font-extrabold mb-4">Tur Sonuçları</h1>
          <p className="text-neutral-400 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 mr-2 text-blue-400" /> 
            Cevapların Gemini Yapay Zekası tarafından değerlendirildi.
          </p>
        </div>

        {/* Results List */}
        <div className="space-y-4 mb-12">
          {dummyResults.map((res, index) => (
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
          ))}
        </div>

        {/* Next Round Button */}
        <div className="flex justify-center">
          <Link 
            href={`/room/${id}`}
            className="group flex items-center px-8 py-4 bg-white text-black hover:bg-neutral-200 rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-xl"
          >
            Sonraki Tura Geç <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </motion.div>
    </div>
  )
}
