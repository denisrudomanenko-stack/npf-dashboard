import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/auth'

interface Permissions {
  canEdit: boolean
  canVectorize: boolean
  canManageUsers: boolean
  canAccessSettings: boolean
  canViewModels: boolean
  canEditSalesData: boolean
  isViewer: boolean
  isManager: boolean
  isSales: boolean
  isAdmin: boolean
  role: UserRole | null
  userId: number | null

  // Check if user can edit/delete a specific entity
  canEditEntity: (createdById: number | null | undefined) => boolean
  canDeleteEntity: (createdById: number | null | undefined) => boolean
}

export function usePermissions(): Permissions {
  const user = useAuthStore((state) => state.user)
  const role = user?.role || null
  const userId = user?.id || null

  const isViewer = role === 'viewer'
  const isManager = role === 'manager'
  const isSales = role === 'sales'
  const isAdmin = role === 'admin'

  /**
   * Check if user can edit/delete an entity based on ownership.
   * - Admin: can edit any entity
   * - Manager/Sales: can only edit entities they created (created_by_id matches)
   * - Viewer: cannot edit anything
   * - Entities without owner (created_by_id is null): only Admin can edit
   */
  const canEditEntity = (createdById: number | null | undefined): boolean => {
    // Admin can edit everything
    if (isAdmin) return true

    // Manager and Sales can only edit their own entities
    if (isManager || isSales) {
      // Old records without owner can only be edited by Admin
      if (createdById === null || createdById === undefined) return false
      return createdById === userId
    }

    // Viewer cannot edit anything
    return false
  }

  return {
    // Viewers can only view, managers, sales and admins can edit
    canEdit: isManager || isSales || isAdmin,
    // Only admins can vectorize documents
    canVectorize: isAdmin,
    // Only admins can manage users
    canManageUsers: isAdmin,
    // Only admins can access settings
    canAccessSettings: isAdmin,
    // Sales role cannot view Models page
    canViewModels: isAdmin || isManager || isViewer,
    // Sales, manager and admin can edit sales data
    canEditSalesData: isAdmin || isManager || isSales,
    isViewer,
    isManager,
    isSales,
    isAdmin,
    role,
    userId,
    canEditEntity,
    canDeleteEntity: canEditEntity, // Same logic for delete
  }
}
