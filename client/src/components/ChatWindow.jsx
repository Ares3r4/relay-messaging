import { useEffect, useRef, useState } from 'react'

function formatMessageTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function ChatWindow({ activeRoom, currentUserId, messages, connectionStatus, error, sendMessage }) {
  const [draft, setDraft] = useState('')
  const feedRef = useRef(null)
  const isConnected = connectionStatus === 'connected'

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [messages])

  function handleSubmit(event) {
    event.preventDefault()
    if (sendMessage(draft)) setDraft('')
  }

  return (
    <section className="chat-panel" aria-label={`Room ${activeRoom}`}>
      <header className="chat-header">
        <div className="chat-room-title"><span className="chat-room-hash">#</span><div><h1>{activeRoom}</h1><p>A good place to pick up the thread.</p></div></div>
        <div className={`connection-indicator ${isConnected ? 'online' : ''}`}><span className="connection-dot" />{connectionStatus === 'connecting' ? 'Connecting' : isConnected ? 'Live' : 'Offline'}</div>
      </header>
      <div className="message-feed" ref={feedRef} aria-live="polite" aria-relevant="additions text">
        <div className="feed-intro"><span className="feed-rule" /><div className="feed-intro-mark" aria-hidden="true">#</div><h2>Welcome to {activeRoom}</h2><p>This is the beginning of the conversation.</p><span className="feed-rule" /></div>
        {messages.map((message, index) => {
          const isOwnMessage = message.sender_id === currentUserId
          return (
            <article className={`message-row ${isOwnMessage ? 'own-message' : ''}`} key={message.id || `${message.sender_id}-${message.created_at}-${index}`}>
              <div className={`message-avatar ${isOwnMessage ? 'own-avatar' : ''}`} aria-hidden="true">{(message.sender_id || '?').slice(0, 1).toUpperCase()}</div>
              <div className="message-content">
                <div className="message-meta"><span className="message-sender">{isOwnMessage ? 'You' : message.sender_id || 'Unknown member'}</span><time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time></div>
                <p className="message-bubble">{message.content}</p>
              </div>
            </article>
          )
        })}
      </div>
      <div className="composer-area">
        {error && <p className="chat-error" role="status">{error}</p>}
        <form className="message-composer" onSubmit={handleSubmit}>
          <input aria-label={`Message #${activeRoom}`} placeholder={`Message #${activeRoom}`} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!isConnected} />
          <span className="composer-room-label">#{activeRoom}</span>
          <button type="submit" disabled={!isConnected || !draft.trim()} aria-label="Send message"><span>Send</span><span aria-hidden="true">&#8594;</span></button>
        </form>
        <p className="composer-caption">Messages are shared with everyone in this room.</p>
      </div>
    </section>
  )
}

export default ChatWindow