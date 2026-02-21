import { create } from 'zustand'

export type ToastType = 'error' | 'warning' | 'success' | 'info'

interface ToastState {
  message: string | null
  type: ToastType
  isVisible: boolean

  show: (message: string, type?: ToastType) => void
  hide: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'info',
  isVisible: false,

  show: (message: string, type: ToastType = 'info') => {
    set({ message, type, isVisible: true })

    // Auto-hide after 5 seconds
    setTimeout(() => {
      set((state) => {
        // Only hide if this is still the same message
        if (state.message === message) {
          return { isVisible: false, message: null }
        }
        return state
      })
    }, 5000)
  },

  hide: () => set({ isVisible: false, message: null }),
}))
