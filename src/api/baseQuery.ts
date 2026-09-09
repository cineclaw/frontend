import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react"
import type { RootState } from "../store/store"
import { logout } from "../store/authSlice"

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/",
  prepareHeaders: (headers, { getState }) => {
    const token =
      (getState() as RootState).auth?.token ||
      localStorage.getItem("cineclaw_auth_token") ||
      sessionStorage.getItem("cineclaw_auth_token")

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
    return headers
  },
})

export const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result.error && result.error.status === 401) {
    // Session expired or invalid
    api.dispatch(logout())
  }
  return result
}
