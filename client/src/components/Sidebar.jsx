import { useState } from 'react'
import ProfileEditor from './ProfileEditor.jsx'

const DEFAULT_ROOMS = ['general', 'random']

function Sidebar({ activeRoom, onRoomChange, user, token, onLogout }) {
  const [rooms, setRooms] = useState(DEFAULT_ROOMS)
  const [roomQuery, setRoomQuery] = useState('')
  const [profile, setProfile] = useState(() => ({
    full_name: user.user_metadata?.full_name || '',
    username: user.user_metadata?.username || '',
    bio: user.user_metadata?.bio || '',
    avatar_url: user.user_metadata?.avatar_url || '',
  }))
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  function handleRoomSubmit(event) {
    event.preventDefault()
    const roomName = roomQuery.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-')
    if (!roomName) return
    setRooms((current) => current.includes(roomName) ? current : [...current, roomName])
    onRoomChange(roomName)
    setRoomQuery('')
  }

  const email = user.email || 'Relay member'
  const displayName = profile.full_name || profile.username || email.split('@')[0]
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><span /></span><span>relay<span className="brand-version"> / v2</span></span></div>
        <span className="workspace-label">YOUR WORKSPACE</span>
      </header>
      <div className="room-section">
        <div className="section-label-row"><span className="section-label">ROOMS</span><span className="room-count">{String(rooms.length).padStart(2, '0')}</span></div>
        <form className="room-search" onSubmit={handleRoomSubmit}>
          <span aria-hidden="true">+</span>
          <input aria-label="Switch to or create a room" placeholder="Find or create a room" value={roomQuery} onChange={(event) => setRoomQuery(event.target.value)} />
          <button type="submit" aria-label="Open or create room" title="Open or create room">&#8629;</button>
        </form>
        <nav className="room-list" aria-label="Chat rooms">
          {rooms.map((room) => (
            <button key={room} type="button" className={`room-link ${activeRoom === room ? 'active' : ''}`} onClick={() => onRoomChange(room)} aria-current={activeRoom === room ? 'page' : undefined}>
              <span className="room-hash">#</span><span>{room}</span>
              {activeRoom === room && <span className="room-active-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="note-spark" aria-hidden="true">*</span><span>Small rooms, better conversations.</span></div>
        <div className="user-row">
          <div className="user-avatar" aria-hidden="true">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="user-meta"><span className="user-name">{displayName}</span><span className="user-email">{email}</span></div>
          <button className="profile-edit-button" type="button" onClick={() => setIsProfileOpen(true)} aria-label="Edit profile" title="Edit profile">Edit profile</button>
          <button className="logout-button" type="button" onClick={onLogout} title="Log out" aria-label="Log out"><span aria-hidden="true">&#8599;</span></button>
        </div>
      </div>
      {isProfileOpen && (
        <ProfileEditor
          token={token}
          user={user}
          initialProfile={profile}
          onClose={() => setIsProfileOpen(false)}
          onSaved={setProfile}
        />
      )}
    </aside>
  )
}

export default Sidebar