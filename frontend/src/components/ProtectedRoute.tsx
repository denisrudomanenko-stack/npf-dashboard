import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: UserRole[]
}

export default function ProtectedRoute({
  children,
  requiredRoles,
}: ProtectedRouteProps) {
  const location = useLocation()
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-500 mb-4">
            Доступ запрещён
          </h1>
          <p className="text-gray-400 mb-6">
            У вас нет прав для просмотра этой страницы.
          </p>
          <a
            href="/"
            className="text-blue-500 hover:text-blue-400 underline"
          >
            Вернуться на главную
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
