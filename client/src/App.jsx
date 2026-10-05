import { useState } from 'react'
import Auth from './components/Auth.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import Sidebar from './components/Sidebar.jsx'
import { useWebSocket } from './hooks/useWebSocket.js'
import './App.css'

function getUserFromToken(token) {
  try {
    const payload = token.split('.')[1]
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(normalizedPayload))
  } catch {
    return {}
  }
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'))
  const [currentRoom, setCurrentRoom] = useState('general')
  const { messages, connectionStatus, error, sendMessage } = useWebSocket(token, currentRoom)
  const user = token ? getUserFromToken(token) : {}

  function handleLogout() {
    localStorage.removeItem('access_token')
    setToken(null)
  }

  if (!token) return <Auth onAuthenticated={setToken} />

  return (
    <main className="app-shell">
      <Sidebar activeRoom={currentRoom} onRoomChange={setCurrentRoom} user={user} token={token} onLogout={handleLogout} />
      <ChatWindow
        activeRoom={currentRoom}
        currentUserId={user.sub}
        messages={messages}
        connectionStatus={connectionStatus}
        error={error}
        sendMessage={sendMessage}
      />
    </main>
  )
}

export default App
