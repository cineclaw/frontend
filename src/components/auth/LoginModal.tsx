import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Lock, User, Eye, EyeOff, Clapperboard, AlertCircle, Loader2 } from "lucide-react"
import { useLoginMutation } from "../../api/authApi"
import { useAppDispatch } from "../../store/store"
import { setCredentials } from "../../store/authSlice"

interface LoginModalProps {
  isOpen: boolean
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const dispatch = useAppDispatch()
  const [login, { isLoading }] = useLoginMutation()

  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setErrorMessage("Пожалуйста, заполните логин и пароль")
      return
    }

    setErrorMessage(null)
    try {
      const res = await login({
        username: username.trim(),
        password,
        remember_me: rememberMe,
      }).unwrap()

      if (res.success && res.token) {
        dispatch(
          setCredentials({
            token: res.token,
            username: res.username || username.trim(),
            rememberMe,
          })
        )
      } else {
        setErrorMessage("Неверные учётные данные")
      }
    } catch (err: any) {
      const msg = err?.data?.error || "Неверное имя пользователя или пароль"
      setErrorMessage(msg)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-cinema-950/95 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md bg-cinema-900 border border-cinema-700/60 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden relative"
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header / Brand */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-accent-500/10 border border-accent-500/30 flex items-center justify-center text-accent-400 mb-3 shadow-inner">
                <Clapperboard className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                CineClaw Access
              </h2>
              <p className="text-xs text-cinema-400 mt-1">
                Введите учетные данные для входа в домашний кинотеатр
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center gap-2.5 text-xs text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username field */}
              <div>
                <label className="block text-xs font-semibold text-cinema-300 uppercase tracking-wider mb-1.5">
                  Имя пользователя
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cinema-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                    placeholder="admin"
                    autoComplete="username"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2.5 bg-cinema-950/80 border border-cinema-700/80 rounded-xl text-white placeholder-cinema-600 text-[16px] sm:text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-semibold text-cinema-300 uppercase tracking-wider mb-1.5">
                  Пароль
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cinema-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full pl-10 pr-11 py-2.5 bg-cinema-950/80 border border-cinema-700/80 rounded-xl text-white placeholder-cinema-600 text-[16px] sm:text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-cinema-500 hover:text-cinema-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-cinema-700 bg-cinema-950 text-accent-500 focus:ring-accent-500 focus:ring-offset-cinema-900 cursor-pointer accent-accent-500"
                  />
                  <span className="text-xs text-cinema-300">
                    Запомнить меня на этом устройстве
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-accent-600 hover:bg-accent-500 active:bg-accent-700 text-white font-medium text-sm rounded-xl shadow-lg shadow-accent-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Проверка...</span>
                  </>
                ) : (
                  <span>Войти</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-[11px] text-cinema-500">
              CineClaw Cinema Node • Защищённый доступ
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
