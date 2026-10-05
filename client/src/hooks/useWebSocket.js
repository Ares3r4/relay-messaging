import { useCallback, useEffect, useRef, useState } from 'react'

const SOCKET_URL = 'ws://localhost:8080'

export function useWebSocket(token, activeRoom) {
  const socketRef = useRef(null)
  const activeRoomRef = useRef(activeRoom)
  const [messages, setMessages] = useState([])
  const [messagesRoom, setMessagesRoom] = useState(activeRoom)
  const [messagesToken, setMessagesToken] = useState(token)
  const [connectionStatus, setConnectionStatus] = useState(token ? 'connecting' : 'disconnected')
  const [error, setError] = useState('')

  useEffect(() => {
    activeRoomRef.current = activeRoom
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: activeRoom } }))
    }
  }, [activeRoom])

  useEffect(() => {
    if (!token) {
      return undefined
    }

    const socket = new WebSocket(`${SOCKET_URL}?token=${encodeURIComponent(token)}`)
    let disposed = false
    socketRef.current = socket
    queueMicrotask(() => {
      if (!disposed) setConnectionStatus('connecting')
    })

    socket.addEventListener('open', () => {
      if (disposed) return
      setConnectionStatus('connected')
      setError('')
      socket.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: activeRoomRef.current } }))
    })

    socket.addEventListener('message', (event) => {
      if (disposed) return
      try {
        const frame = JSON.parse(event.data)
        if (frame.type === 'ROOM_HISTORY' && Array.isArray(frame.payload)) {
          setMessages(frame.payload)
          setMessagesRoom(activeRoomRef.current)
          setMessagesToken(token)
          setError('')
        } else if (frame.type === 'NEW_MESSAGE' && frame.payload) {
          setMessages((current) => [...current, frame.payload])
          setMessagesRoom(activeRoomRef.current)
          setMessagesToken(token)
          setError('')
        } else if (frame.error) {
          setError(frame.error)
        }
      } catch {
        setError('Received an unreadable message from the server.')
      }
    })

    socket.addEventListener('error', () => {
      if (!disposed) setError('Connection error. Check that the Relay server is running.')
    })
    socket.addEventListener('close', (event) => {
      if (disposed) return
      setConnectionStatus('disconnected')
      if (event.code !== 1000) {
        const closeReason = event.reason ? `: ${event.reason}` : ''
        setError(`WebSocket closed (${event.code})${closeReason}`)
      }
    })

    return () => {
      disposed = true
      if (socketRef.current === socket) socketRef.current = null
      socket.close()
      setConnectionStatus('disconnected')
    }
  }, [token])

  const sendMessage = useCallback((content) => {
    const trimmedContent = content.trim()
    const socket = socketRef.current
    if (!trimmedContent || socket?.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ type: 'SEND_MESSAGE', payload: { content: trimmedContent } }))
    return true
  }, [])

  const joinRoom = useCallback((roomId) => {
    const normalizedRoom = roomId.trim()
    const socket = socketRef.current
    if (!normalizedRoom || socket?.readyState !== WebSocket.OPEN) return false
    activeRoomRef.current = normalizedRoom
    setMessages([])
    socket.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: normalizedRoom } }))
    return true
  }, [])

  const visibleMessages = token && messagesToken === token && messagesRoom === activeRoom ? messages : []

  return { messages: visibleMessages, connectionStatus, error, sendMessage, joinRoom }
}