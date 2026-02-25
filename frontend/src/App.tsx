import { Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Toast from './components/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Enterprises from './pages/Enterprises'
import Roadmap from './pages/Roadmap'
import Documents from './pages/Documents'
import Models from './pages/Models'
import Chat from './pages/Chat'
import LLMSettings from './pages/LLMSettings'
import RAGQueue from './pages/RAGQueue'
import Users from './pages/Users'
import { useAuthStore } from './stores/authStore'

function App() {
  const { checkAuth } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const init = async () => {
      await checkAuth()
      setIsChecking(false)
    }
    init()
  }, [checkAuth])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <Toast />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="enterprises" element={<Enterprises />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="documents" element={<Documents />} />
        <Route path="models" element={<Models />} />
        <Route path="chat" element={<Chat />} />
        <Route path="settings/llm" element={<LLMSettings />} />
        <Route path="settings/rag-queue" element={<RAGQueue />} />
        <Route
          path="users"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
    </>
  )
}

export default App
