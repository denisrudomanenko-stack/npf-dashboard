import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../services/api'
import type { User, LoginRequest, TokenResponse } from '../types/auth'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (credentials: LoginRequest) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<boolean>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post<TokenResponse>('/auth/login', credentials)
          const { access_token, user } = response.data

          localStorage.setItem('token', access_token)

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          return true
        } catch (error: unknown) {
          const message = error instanceof Error
            ? error.message
            : (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Login failed'

          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
            user: null,
            token: null,
          })
          localStorage.removeItem('token')
          return false
        }
      },

      logout: () => {
        localStorage.removeItem('token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })
      },

      checkAuth: async () => {
        const token = localStorage.getItem('token')
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null })
          return false
        }

        try {
          const response = await api.get<User>('/auth/me')
          set({
            user: response.data,
            token,
            isAuthenticated: true,
          })
          return true
        } catch {
          localStorage.removeItem('token')
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
          return false
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
