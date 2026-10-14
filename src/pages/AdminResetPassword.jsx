import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AdminResetPassword.css'

function AdminResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function checkRecoverySession() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (!mounted) return
        if (sessionError) throw sessionError

        if (data?.session?.user) {
          setRecoveryReady(true)
        }
      } catch (sessionError) {
        console.error('Password recovery session error:', sessionError)
      } finally {
        if (mounted) setCheckingSession(false)
      }
    }

    checkRecoverySession()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        if (
          event === 'PASSWORD_RECOVERY' ||
          (event === 'SIGNED_IN' && session?.user)
        ) {
          setRecoveryReady(true)
          setCheckingSession(false)
        }
      }
    )

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!recoveryReady) {
      setError(
        'This password reset link is invalid or has expired. Please request a new reset link.'
      )
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) throw updateError

      setMessage(
        'Password updated successfully. Redirecting to administrator login...'
      )
      setPassword('')
      setConfirmPassword('')

      await supabase.auth.signOut()

      window.setTimeout(() => {
        window.location.replace('/admin/login')
      }, 1600)
    } catch (updateError) {
      console.error('Password update error:', updateError)
      setError(updateError?.message || 'Unable to update your password.')
    } finally {
      setLoading(false)
    }
  }

  function goToLogin() {
    window.location.replace('/admin/login')
  }

  if (checkingSession) {
    return (
      <main className="admin-reset-page">
        <div className="admin-reset-orbit" aria-hidden="true">
          <div className="admin-reset-orbit-ring" />
        </div>

        <section className="admin-reset-card admin-reset-card-loading">
          <div className="admin-reset-brand">
            <div className="admin-reset-brand-text">Katrina</div>
            <div className="admin-reset-brand-subtext">COFFEE &amp; CAKES</div>
          </div>

          <div className="admin-reset-spinner" />
          <p className="admin-reset-checking-text">
            Checking password reset link...
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-reset-page">
      <div className="admin-reset-orbit" aria-hidden="true">
        <div className="admin-reset-orbit-ring" />
      </div>

      <section className="admin-reset-card">
        <div className="admin-reset-brand">
          <div className="admin-reset-brand-text">Katrina</div>
          <div className="admin-reset-brand-subtext">COFFEE &amp; CAKES</div>
        </div>

        <div className="admin-reset-heading">
          <h1>Reset Password</h1>
          <p>Enter your new administrator password.</p>
        </div>

        {!recoveryReady && (
          <div className="admin-reset-message admin-reset-error">
            This password reset link is invalid or has expired. Please request a
            new reset link from the administrator login page.
          </div>
        )}

        {error && (
          <div className="admin-reset-message admin-reset-error">{error}</div>
        )}

        {message && (
          <div className="admin-reset-message admin-reset-success">{message}</div>
        )}

        {recoveryReady && !message && (
          <form className="admin-reset-form" onSubmit={handleSubmit}>
            <label className="admin-reset-field">
              <span>New Password</span>
              <div className="admin-reset-input-wrap">
                <span className="admin-reset-input-icon" aria-hidden="true">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="admin-reset-eye"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            <label className="admin-reset-field">
              <span>Confirm Password</span>
              <div className="admin-reset-input-wrap">
                <span className="admin-reset-input-icon" aria-hidden="true">🔒</span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="admin-reset-eye"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            <p className="admin-reset-hint">Use at least 8 characters.</p>

            <button
              type="submit"
              className="admin-reset-submit"
              disabled={loading}
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {!message && (
          <button type="button" className="admin-reset-back" onClick={goToLogin}>
            ← Back to Administrator Login
          </button>
        )}
      </section>
    </main>
  )
}

export default AdminResetPassword
