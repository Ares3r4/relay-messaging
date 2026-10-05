import { useEffect, useState } from 'react'

const EMPTY_PROFILE = {
  full_name: '',
  username: '',
  bio: '',
  avatar_url: '',
}

function ProfileEditor({ token, user, initialProfile, onClose, onSaved }) {
  const [profile, setProfile] = useState(initialProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/profile/${encodeURIComponent(user.sub)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result?.error || 'Could not load your profile.')
        if (result.data) setProfile({ ...EMPTY_PROFILE, ...initialProfile, ...result.data })
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [initialProfile, user.sub])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function updateField(event) {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Could not save your profile.')

      const savedProfile = { ...profile, ...result.data }
      setProfile(savedProfile)
      onSaved(savedProfile)
      setSuccess('Profile saved.')
    } catch (saveError) {
      setError(saveError.message || 'Could not reach the Relay server.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="profile-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-heading">
        <header className="profile-dialog-header">
          <div>
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h2 id="profile-heading">Edit profile</h2>
          </div>
          <button className="profile-close-button" type="button" onClick={onClose} aria-label="Close profile editor">&times;</button>
        </header>
        <p className="profile-email">{user.email}</p>
        {isLoading ? (
          <p className="profile-loading">Loading profile...</p>
        ) : (
          <form className="profile-form" onSubmit={handleSubmit}>
            <label htmlFor="profile-full-name">Full name</label>
            <input id="profile-full-name" name="full_name" value={profile.full_name || ''} onChange={updateField} autoComplete="name" />
            <label htmlFor="profile-username">Username</label>
            <input id="profile-username" name="username" value={profile.username || ''} onChange={updateField} autoComplete="username" />
            <label htmlFor="profile-bio">Bio</label>
            <textarea id="profile-bio" name="bio" value={profile.bio || ''} onChange={updateField} rows="3" maxLength="280" />
            <label htmlFor="profile-avatar-url">Avatar image URL</label>
            <input id="profile-avatar-url" name="avatar_url" type="url" value={profile.avatar_url || ''} onChange={updateField} placeholder="https://example.com/avatar.jpg" />
            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="profile-success" role="status">{success}</p>}
            <div className="profile-actions">
              <button className="profile-cancel-button" type="button" onClick={onClose}>Cancel</button>
              <button className="auth-submit" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save profile'}
                {!isSaving && <span aria-hidden="true">&#8594;</span>}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

export default ProfileEditor