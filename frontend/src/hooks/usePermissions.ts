import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/auth'

interface Permissions {
  canEdit: boolean
  canManageUsers: boolean
  canAccessSettings: boolean
  isViewer: boolean
  isManager: boolean
  isAdmin: boolean
  role: UserRole | null
}

export function usePermissions(): Permissions {
  const user = useAuthStore((state) => state.user)
  const role = user?.role || null

  const isViewer = role === 'viewer'
  const isManager = role === 'manager'
  const isAdmin = role === 'admin'

  return {
    // Viewers can only view, managers and admins can edit
    canEdit: isManager || isAdmin,
    // Only admins can manage users
    canManageUsers: isAdmin,
    // Only admins can access settings
    canAccessSettings: isAdmin,
    isViewer,
    isManager,
    isAdmin,
    role,
  }
}
