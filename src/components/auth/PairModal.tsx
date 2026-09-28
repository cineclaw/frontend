import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Tv, CheckCircle2, AlertCircle, Loader2, X, User, ArrowRight } from "lucide-react"
import { useLoginMutation, useApprovePairingMutation } from "../../api/authApi"
import { useAppDispatch, useAppSelector } from "../../store/store"
import { setCredentials } from "../../store/authSlice"

interface PairModalProps {
  isOpen: boolean
  initialCode?: string
  onClose: () => void
}

export const PairModal: React.FC<PairModalProps> = ({
  isOpen,
  initialCode = "",
  onClose,
}) => {
  const dispatch = useAppDispatch()
  const { isAuthenticated, username: currentUsername } = useAppSelector((state) => state.auth)

  const [code, setCode] = useState(initialCode)
  const [username, setUsername] = useState(currentUsername || "admin")
  const [password, setPassword] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [login, { isLoading: isLoggingIn }] = useLoginMutation()
  const [approvePairing, { isLoading: isApproving }] = useApprovePairingMutation()

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode)
    }
  }, [initialCode])

  const handleApprove = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanCode = code.trim().replace(/\s+/g, "")
    if (!cleanCode) {
      setErrorMessage("Введите 6-значный код с экрана ТВ")
      return
    }

    setErrorMessage(null)

    // If not authenticated, login first
    if (!isAuthenticated) {
      if (!username.trim() || !password) {
        setErrorMessage("Для подтверждения введите логин и пароль администратора")
        return
      }

      try {
        const loginRes = await login({
          username: username.trim(),
          password,
          remember_me: true,
        }).unwrap()

        if (loginRes.success && loginRes.token) {
          dispatch(
            setCredentials({
              token: loginRes.token,
              username: loginRes.username || username.trim(),
              rememberMe: true,
            })
          )
        } else {
          setErrorMessage("Неверные учетные данные")
          return
        }
      } catch (err: any) {
        setErrorMessage(err?.data?.error || "Не удалось войти: неверный пароль")
        return
      }
    }

    // Now call approvePairing
    try {
      const res = await approvePairing({ code: cleanCode }).unwrap()
      if (res.success) {
        setIsSuccess(true)
      } else {
        setErrorMessage(res.message || "Не удалось подтвердить код")
      }
    } catch (err: any) {
      setErrorMessage(err?.data?.error || "Ошибка сопряжения: код не найден или истек")
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-cinema-950/95 backdrop-blur-xl"
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
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-cinema-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <Tv className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Подключение телевизора
              </h2>
              <p className="text-xs text-cinema-400 mt-1">
                Быстрая авторизация Apple TV и Android TV без ввода пароля с пульта
              </p>
            </div>

            {/* Success View */}
            {isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 flex flex-col items-center text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Телевизор успешно подключен!</h3>
                  <p className="text-xs text-cinema-400 mt-1.5 max-w-xs">
                    Ваш телевизор или приставка уже вошли в CineClaw. Можете закрыть это окно.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full mt-4 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Вернуться в медиатеку
                </button>
              </motion.div>
            ) : (
              /* Pairing Form */
              <form onSubmit={handleApprove} className="space-y-4">
                {/* Error Banner */}
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center gap-2.5 text-xs text-destructive"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{errorMessage}</span>
                  </motion.div>
                )}

                {/* PIN Code Field */}
                <div>
                  <label className="block text-xs font-semibold text-cinema-300 uppercase tracking-wider mb-1.5">
                    Код подтверждения с экрана ТВ
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    maxLength={10}
                    className="w-full bg-cinema-950 border border-cinema-700/80 rounded-xl px-4 py-3.5 text-center text-2xl font-black tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/80 font-mono transition-all"
                  />
                </div>

                {/* If already authenticated, show user info */}
                {isAuthenticated ? (
                  <div className="p-3 rounded-xl bg-cinema-800/60 border border-cinema-700/40 flex items-center justify-between text-xs text-cinema-300">
                    <span>Авторизован как:</span>
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      {currentUsername || "admin"}
                    </span>
                  </div>
                ) : (
                  /* If not authenticated, require credentials */
                  <div className="space-y-3 pt-2 border-t border-cinema-800">
                    <p className="text-xs text-cinema-400">
                      Для подтверждения сопряжения войдите в аккаунт:
                    </p>
                    <div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Логин"
                        className="w-full bg-cinema-950 border border-cinema-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/80"
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Пароль"
                        className="w-full bg-cinema-950 border border-cinema-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/80"
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoggingIn || isApproving || !code.trim()}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                >
                  {isLoggingIn || isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Подключение...</span>
                    </>
                  ) : (
                    <>
                      <span>Подтвердить подключение</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
