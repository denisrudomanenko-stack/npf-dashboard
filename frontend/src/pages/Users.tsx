import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { User, UserCreate, UserUpdate, UserRole } from '../types/auth'

const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  sales: 'Продавец',
  viewer: 'Просмотр',
}

const roleColors: Record<UserRole, { bg: string; text: string }> = {
  admin: { bg: 'rgba(147, 51, 234, 0.15)', text: '#a855f7' },
  manager: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  sales: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  viewer: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
}

interface UserFormData {
  username: string
  email: string
  password: string
  role: UserRole
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    role: 'viewer',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await api.get<User[]>('/users/')
      setUsers(response.data)
      setError(null)
    } catch (err) {
      setError('Не удалось загрузить пользователей')
      console.error('Load users error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingUser(null)
    setFormData({ username: '', email: '', password: '', role: 'viewer' })
    setFormError(null)
    setShowModal(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
    })
    setFormError(null)
    setShowModal(true)
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Удалить пользователя "${user.username}"?`)) return

    try {
      await api.delete(`/users/${user.id}`)
      setUsers(users.filter((u) => u.id !== user.id))
    } catch (err) {
      alert('Не удалось удалить пользователя')
      console.error('Delete user error:', err)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const response = await api.put<User>(`/users/${user.id}`, {
        is_active: !user.is_active,
      })
      setUsers(users.map((u) => (u.id === user.id ? response.data : u)))
    } catch (err) {
      alert('Не удалось обновить статус')
      console.error('Toggle active error:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validate form
    if (!formData.username.trim()) {
      setFormError('Введите имя пользователя')
      return
    }
    if (formData.username.trim().length < 3) {
      setFormError('Имя пользователя должно быть не менее 3 символов')
      return
    }
    if (!formData.email.trim()) {
      setFormError('Введите email')
      return
    }
    if (!editingUser && !formData.password) {
      setFormError('Введите пароль')
      return
    }
    if (formData.password && formData.password.length < 6) {
      setFormError('Пароль должен быть не менее 6 символов')
      return
    }

    setSaving(true)

    try {
      if (editingUser) {
        const updateData: UserUpdate = {
          username: formData.username,
          email: formData.email,
          role: formData.role,
        }
        if (formData.password) {
          updateData.password = formData.password
        }

        const response = await api.put<User>(
          `/users/${editingUser.id}`,
          updateData
        )
        setUsers(users.map((u) => (u.id === editingUser.id ? response.data : u)))
      } else {
        const createData: UserCreate = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }

        console.log('Creating user:', createData)
        const response = await api.post<User>('/users/', createData)
        console.log('User created:', response.data)
        setUsers([response.data, ...users])
      }

      setShowModal(false)
    } catch (err: unknown) {
      console.error('Save user error:', err)
      const errorResponse = err as { response?: { data?: { detail?: string | Array<{ msg: string; loc: string[] }> } } }
      const detail = errorResponse?.response?.data?.detail

      let message = 'Произошла ошибка при сохранении'
      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation error format
        const fieldErrors = detail.map(e => {
          const field = e.loc?.[e.loc.length - 1] || 'поле'
          const fieldLabels: Record<string, string> = {
            username: 'Имя пользователя',
            email: 'Email',
            password: 'Пароль',
            role: 'Роль',
          }
          return `${fieldLabels[field] || field}: ${e.msg}`
        })
        message = fieldErrors.join('. ')
      }

      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleCloseModal = () => {
    if (!saving) {
      setShowModal(false)
    }
  }

  if (loading) {
    return (
      <div className="users-page">
        <div className="loading-state">Загрузка...</div>
        <style>{styles}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="users-page">
        <div className="error-state">{error}</div>
        <style>{styles}</style>
      </div>
    )
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Пользователи</h1>
        <button className="btn-primary" onClick={handleAdd}>
          + Добавить пользователя
        </button>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 500, color: '#1f2937', background: 'transparent' }}>
                      {user.username}
                    </span>
                  </div>
                </td>
                <td className="user-email">{user.email}</td>
                <td>
                  <span
                    className="role-badge"
                    style={{
                      backgroundColor: roleColors[user.role].bg,
                      color: roleColors[user.role].text,
                    }}
                  >
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td>
                  <button
                    className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}
                    onClick={() => handleToggleActive(user)}
                  >
                    {user.is_active ? 'Активен' : 'Отключён'}
                  </button>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn-link" onClick={() => handleEdit(user)}>
                      Изменить
                    </button>
                    <button className="btn-link danger" onClick={() => handleDelete(user)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="empty-state">Нет пользователей</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-content">
              {formError && (
                <div className="form-error">{formError}</div>
              )}

              <div className="form-group">
                <label>Имя пользователя</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Введите имя пользователя"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="user@example.com"
                />
              </div>

              <div className="form-group">
                <label>
                  Пароль
                  {editingUser && (
                    <span className="label-hint"> (оставьте пустым, чтобы не менять)</span>
                  )}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={editingUser ? '••••••' : 'Минимум 6 символов'}
                />
              </div>

              <div className="form-group">
                <label>Роль</label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as UserRole })
                  }
                >
                  <option value="viewer">Просмотр</option>
                  <option value="sales">Продавец</option>
                  <option value="manager">Менеджер</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .users-page {
    padding: 24px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .page-header h1 {
    font-size: 24px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: 48px;
    color: var(--text-muted);
  }

  .error-state {
    color: #dc2626;
  }

  .users-table-container {
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
  }

  .users-table th {
    text-align: left;
    padding: 12px 16px;
    background: #f8f9fa;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border);
  }

  .users-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
  }

  .users-table tr:last-child td {
    border-bottom: none;
  }

  .users-table tr:hover {
    background: #f8f9fa;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
  }

  .user-name {
    font-weight: 500;
    color: var(--text);
  }

  .user-email {
    color: var(--text-muted);
  }

  .role-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .status-badge.active {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .status-badge.active:hover {
    background: rgba(34, 197, 94, 0.25);
  }

  .status-badge.inactive {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .status-badge.inactive:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .btn-link.danger {
    color: #ef4444;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #f1f5f9;
    color: var(--text);
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: #e2e8f0;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .user-modal {
    background: white;
    border-radius: 12px;
    width: 440px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
  }

  .modal-close {
    width: 32px;
    height: 32px;
    border: none;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 20px;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #e2e8f0;
    color: var(--text);
  }

  .modal-content {
    padding: 24px;
    overflow-y: auto;
  }

  .form-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 8px;
  }

  .label-hint {
    font-weight: 400;
    color: var(--text-muted);
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text);
    background: white;
    transition: all 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group input::placeholder {
    color: #9ca3af;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 8px;
    margin-top: 8px;
    border-top: 1px solid var(--border);
  }
`
