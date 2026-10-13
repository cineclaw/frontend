import { createApi } from "@reduxjs/toolkit/query/react"
import { baseQueryWithAuth } from "./baseQuery"

export interface LoginRequest {
  username: string
  password: string
  remember_me: boolean
}

export interface LoginResponse {
  success: boolean
  token: string
  username: string
  expires_at: string
}

export interface MeResponse {
  authenticated: boolean
  username?: string
}

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithAuth,
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: "api/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    logout: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: "api/auth/logout",
        method: "POST",
      }),
    }),
    me: builder.query<MeResponse, void>({
      query: () => ({
        url: "api/auth/me",
      }),
    }),
    approvePairing: builder.mutation<{ success: boolean; message: string; username: string }, { code: string }>({
      query: (body) => ({
        url: "api/auth/pair/approve",
        method: "POST",
        body,
      }),
    }),
  }),
})

export const { useLoginMutation, useLogoutMutation, useMeQuery, useLazyMeQuery, useApprovePairingMutation } = authApi
