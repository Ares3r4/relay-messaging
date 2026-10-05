import { useState } from 'react'

const API_URL = '/api'

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/${mode === 'login' ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      // Read text first to prevent JSON syntax crash on empty/HTML responses
      const text = await response.text()
      const result = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(result?.error || `Server error (${response.status})`)
      }

      const accessToken = result?.data?.session?.access_token

      if (accessToken) {
        localStorage.setItem('access_token', accessToken)
        onAuthenticated(accessToken)
      } else if (mode === 'signup' && result?.data?.user) {
        // Handled when Supabase "Confirm Email" setting is active
        setMessage('Account created! Please check your email to verify your account or switch to Login.')
      } else {
        throw new Error('Authentication response did not contain an access token.')
      }
    } catch (authError) {
      setError(authError.message || 'Could not reach the Relay server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLogin = mode === 'login'
  return (
    <main className="auth-screen">
      <div className="auth-aside">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><span /></span><span>relay<span className="brand-version"> / v2</span></span></div>
        <div className="auth-editorial">
          <span className="eyebrow">A quieter kind of conversation</span>
          <h1>Good things<br />happen in<br /><em>real time.</em></h1>
          <p>Your people, in one place. Pick up the thread whenever you are ready.</p>
        </div>
        <span className="auth-coordinate">LIVE MESSAGING / 01</span>
      </div>
      <section className="auth-panel" aria-labelledby="auth-heading">
        <div className="auth-mobile-brand brand-lockup"><span className="brand-mark" aria-hidden="true"><span /></span><span>relay<span className="brand-version"> / v2</span></span></div>
        <div className="auth-form-wrap">
          <div className="auth-heading-group">
            <span className="eyebrow">YOUR SPACE IS READY</span>
            <h2 id="auth-heading">{isLogin ? 'Welcome back.' : 'Come on in.'}</h2>
            <p>{isLogin ? 'Sign in to continue the conversation.' : 'Create an account to join your conversations.'}</p>
          </div>
          <div className="auth-mode" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Login</button>
            <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? 'selected' : ''} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Sign Up</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
            
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="form-success" style={{ color: '#4ade80', fontSize: '0.875rem' }}>{message}</p>}

            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Connecting...' : isLogin ? 'Sign in' : 'Create account'}
              {!isSubmitting && <span aria-hidden="true">&#8594;</span>}
            </button>
          </form>
          <p className="auth-footnote">By continuing, you agree to keep the conversation kind.</p>
        </div>
      </section>
    </main>
  )
}

export default Auth