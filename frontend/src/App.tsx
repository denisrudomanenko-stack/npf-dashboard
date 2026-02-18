import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Enterprises from './pages/Enterprises'
import Roadmap from './pages/Roadmap'
import Documents from './pages/Documents'
import Chat from './pages/Chat'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="enterprises" element={<Enterprises />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="documents" element={<Documents />} />
        <Route path="chat" element={<Chat />} />
      </Route>
    </Routes>
  )
}

export default App
