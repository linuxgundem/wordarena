'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      toast.error(authError.message)
      setLoading(false)
      return
    }

    // 2. Create the profile (Assuming RLS is set or triggers handle it, but we can do it explicitly)
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
        })
      
      if (profileError) {
        toast.error('Profil oluşturulurken hata oluştu: ' + profileError.message)
      } else {
        toast.success('Kayıt başarılı! Lütfen giriş yapın.')
        router.push('/login')
      }
    }

    setLoading(false)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sm:mx-auto sm:w-full sm:max-w-md z-10"
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Aramıza Katıl
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Yeni bir hesap oluşturarak WordArena'da yerini al.
        </p>
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-neutral-800">
        <form className="space-y-6" onSubmit={handleRegister}>
          
          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Kullanıcı Adı
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-neutral-500" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 bg-neutral-800/50 border border-neutral-700 rounded-xl py-3 text-white placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="oyuncu123"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300">
              E-posta
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-neutral-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 bg-neutral-800/50 border border-neutral-700 rounded-xl py-3 text-white placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="ornek@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300">
              Şifre
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-neutral-500" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 bg-neutral-800/50 border border-neutral-700 rounded-xl py-3 text-white placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Kayıt Ol <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-neutral-400">Zaten bir hesabın var mı? </span>
          <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400 transition-colors">
            Giriş yap
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
