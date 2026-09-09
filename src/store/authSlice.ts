import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  username: string | null
  rememberMe: boolean
  isAuthChecked: boolean
}

const savedToken = localStorage.getItem("cineclaw_auth_token") || sessionStorage.getItem("cineclaw_auth_token")
const savedUser = localStorage.getItem("cineclaw_auth_user") || sessionStorage.getItem("cineclaw_auth_user")
const savedRemember = localStorage.getItem("cineclaw_auth_remember") !== "false"

const initialState: AuthState = {
  isAuthenticated: !!savedToken,
  token: savedToken || null,
  username: savedUser || null,
  rememberMe: savedRemember,
  isAuthChecked: false,
}

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string; username: string; rememberMe: boolean }>
    ) => {
      state.isAuthenticated = true
      state.token = action.payload.token
      state.username = action.payload.username
      state.rememberMe = action.payload.rememberMe
      state.isAuthChecked = true

      if (action.payload.rememberMe) {
        localStorage.setItem("cineclaw_auth_token", action.payload.token)
        localStorage.setItem("cineclaw_auth_user", action.payload.username)
        localStorage.setItem("cineclaw_auth_remember", "true")
        sessionStorage.removeItem("cineclaw_auth_token")
      } else {
        sessionStorage.setItem("cineclaw_auth_token", action.payload.token)
        sessionStorage.setItem("cineclaw_auth_user", action.payload.username)
        localStorage.removeItem("cineclaw_auth_token")
        localStorage.removeItem("cineclaw_auth_user")
        localStorage.setItem("cineclaw_auth_remember", "false")
      }
    },
    logout: (state) => {
      state.isAuthenticated = false
      state.token = null
      state.username = null
      state.isAuthChecked = true

      localStorage.removeItem("cineclaw_auth_token")
      localStorage.removeItem("cineclaw_auth_user")
      sessionStorage.removeItem("cineclaw_auth_token")
      sessionStorage.removeItem("cineclaw_auth_user")
    },
    setAuthChecked: (state, action: PayloadAction<boolean>) => {
      state.isAuthChecked = action.payload
    },
  },
})

export const { setCredentials, logout, setAuthChecked } = authSlice.actions
export default authSlice.reducer
