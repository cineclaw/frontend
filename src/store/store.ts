import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import { moviesApi } from '../api/moviesApi'
import { torrentsApi } from '../api/torrentsApi'
import { authApi } from '../api/authApi'
import searchReducer from './searchSlice'
import authReducer from './authSlice'

export const store = configureStore({
  reducer: {
    [moviesApi.reducerPath]: moviesApi.reducer,
    [torrentsApi.reducerPath]: torrentsApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    search: searchReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      moviesApi.middleware,
      torrentsApi.middleware,
      authApi.middleware
    ),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
