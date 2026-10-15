
import { useEffect, useRef, useState } from 'react'
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

  const verificationRef = useRef(null)

  // =====================================================
  // VERIFY PASSWORD RECOVERY LINK
  // =====================================================

  useEffect(() => {
    let mounted = true

    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const tokenType = params.get('type')
    const isDirectRecoveryLink = params.has('token_hash')

    function removeRecoveryTokenFromUrl() {
      const url = new URL(window.location.href)

      url.searchParams.delete('token_hash')
      url.searchParams.delete('type')

      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`
      )
    }

    // Keep compatibility with the original Supabase
    // password recovery redirect flow.
    const { data: authListener } =
      supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted || isDirectRecoveryLink) return

        if (
          event === 'PASSWORD_RECOVERY' &&
          session?.user
        ) {
          setRecoveryReady(true)
          setError('')
          setCheckingSession(false)
        }
      })

    async function verifyRecoveryLink() {
      if (!isDirectRecoveryLink) {
        if (mounted) {
          setCheckingSession(false)
        }
        return
      }

      try {
        if (!tokenHash || tokenType !== 'recovery') {
          throw new Error('Invalid recovery link')
        }

        // Prevent duplicate verification during
        // React Strict Mode development checks.
        if (!verificationRef.current) {
          verificationRef.current =
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery',
            })
        }

        const { data, error: verifyError } =
          await verificationRef.current

        if (verifyError) {
          throw verifyError
        }

        if (!data?.session?.user) {
          throw new Error('Recovery session not established')
        }

        if (!mounted) return

        setRecoveryReady(true)
        setError('')
      } catch (verifyError) {
        console.error(
          'Password recovery verification failed:',
          verifyError
        )

        if (mounted) {
          setRecoveryReady(false)
          setError(
            'This password reset link is invalid or has expired. ' +
            'Please request a new password reset link.'
          )
        }
      } finally {
        if (mounted) {
          // Remove the sensitive token from the address bar.
          removeRecoveryTokenFromUrl()
          setCheckingSession(false)
        }
      }
    }

    verifyRecoveryLink()

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  // =====================================================
  // UPDATE ADMIN PASSWORD
  // =====================================================

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!recoveryReady) {
      setError(
        'Invalid or expired password reset session. ' +
        'Please request a new reset link.'
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
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        })

      if (updateError) {
        throw updateError
      }

      setMessage(
        'Password updated successfully. ' +
        'Redirecting to administrator login...'
      )

      setRecoveryReady(false)
      setPassword('')
      setConfirmPassword('')

      // Sign out after changing the password.
      const { error: signOutError } =
        await supabase.auth.signOut()

      if (signOutError) {
        console.error(
          'Sign out after password reset:',
          signOutError
        )
      }

      window.setTimeout(() => {
        window.location.replace('/admin/login')
      }, 1600)
    } catch (updateError) {
      console.error('Password update error:', updateError)

      setError(
        updateError?.message ||
        'Unable to update your password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // RETURN TO ADMIN LOGIN
  // =====================================================

  function goToLogin() {
    window.location.replace('/admin/login')
  }

  // =====================================================
  // LOADING SCREEN
  // =====================================================

  if (checkingSession) {
    return (
      <main className="admin-reset-page">
        <div
          className="admin-reset-orbit"
          aria-hidden="true"
        >
          <div className="admin-reset-orbit-ring" />
        </div>

        <section className="admin-reset-card admin-reset-card-loading">
          <div className="admin-reset-brand">
            <div className="admin-reset-brand-text">
              Katrina
            </div>

            <div className="admin-reset-brand-subtext">
              COFFEE &amp; CAKES
            </div>
          </div>

          <div className="admin-reset-spinner" />

          <p className="admin-reset-checking-text">
            Checking password reset link...
          </p>
        </section>
      </main>
    )
  }

  // =====================================================
  // PASSWORD RESET PAGE
  // =====================================================

  return (
    <main className="admin-reset-page">
      <div
        className="admin-reset-orbit"
        aria-hidden="true"
      >
        <div className="admin-reset-orbit-ring" />
      </div>

      <section className="admin-reset-card">
        {/* BRAND */}

        <div className="admin-reset-brand">
          <div className="admin-reset-brand-text">
            Katrina
          </div>

          <div className="admin-reset-brand-subtext">
            COFFEE &amp; CAKES
          </div>
        </div>

        {/* HEADING */}

        <div className="admin-reset-heading">
          <h1>Reset Password</h1>
          <p>Enter your new administrator password.</p>
        </div>

        {/* INVALID OR EXPIRED LINK */}

        {!recoveryReady && !error && !message && (
          <div className="admin-reset-message admin-reset-error">
            This password reset link is invalid or has expired.
            Please request a new reset link from the
            administrator login page.
          </div>
        )}

        {/* ERROR MESSAGE */}

        {error && (
          <div className="admin-reset-message admin-reset-error">
            {error}
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {message && (
          <div className="admin-reset-message admin-reset-success">
            {message}
          </div>
        )}

        {/* PASSWORD RESET FORM */}

        {recoveryReady && !message && (
          <form
            className="admin-reset-form"
            onSubmit={handleSubmit}
          >
            {/* NEW PASSWORD */}

            <label className="admin-reset-field">
              <span>New Password</span>

              <div className="admin-reset-input-wrap">
                <span
                  className="admin-reset-input-icon"
                  aria-hidden="true"
                >
                  🔒
                </span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  disabled={loading}
                  required
                  minLength={8}
                />

                <button
                  type="button"
                  className="admin-reset-eye"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  disabled={loading}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            {/* CONFIRM PASSWORD */}

            <label className="admin-reset-field">
              <span>Confirm Password</span>

              <div className="admin-reset-input-wrap">
                <span
                  className="admin-reset-input-icon"
                  aria-hidden="true"
                >
                  🔒
                </span>

                <input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="admin-reset-eye"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  disabled={loading}
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            {/* PASSWORD HINT */}

            <p className="admin-reset-hint">
              Use at least 8 characters.
            </p>

            {/* SUBMIT BUTTON */}

            <button
              type="submit"
              className="admin-reset-submit"
              disabled={loading}
            >
              {loading
                ? 'Updating Password...'
                : 'Update Password'}
            </button>
          </form>
        )}

        {/* BACK TO LOGIN */}

        {!message && (
          <button
            type="button"
            className="admin-reset-back"
            onClick={goToLogin}
          >
            ← Back to Administrator Login
          </button>
        )}
      </section>
    </main>
  )
}

export default AdminResetPassword
