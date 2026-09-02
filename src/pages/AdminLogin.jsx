import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AdminLogin.css'

function AdminLogin({ onLogin }) {
  // =========================================================
  // FORM
  // =========================================================

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // =========================================================
  // STATE
  // =========================================================

  const [loading, setLoading] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // =========================================================
  // CHECK EXISTING SESSION
  // =========================================================

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      try {
        const { data, error } =
          await supabase.auth.getSession()

        if (!mounted) {
          return
        }

        if (error) {
          console.error(
            'Session check error:',
            error
          )

          setCheckingSession(false)
          return
        }

        if (data?.session?.user) {
          await verifyAdmin(
            data.session.user
          )
        } else {
          setCheckingSession(false)
        }
      } catch (error) {
        console.error(
          'Session check failed:',
          error
        )

        if (mounted) {
          setCheckingSession(false)
        }
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [])

  // =========================================================
  // VERIFY ADMIN
  // =========================================================

  async function verifyAdmin(user) {
    if (!user) {
      setCheckingSession(false)
      return
    }

    const { data, error } =
      await supabase
        .from('admin_profiles')
        .select(
          'id, role, status'
        )
        .eq('id', user.id)
        .maybeSingle()

    if (error) {
      console.error(
        'Admin profile error:',
        error
      )

      await supabase.auth.signOut()

      setError(
        `Unable to verify administrator account: ${error.message}`
      )

      setCheckingSession(false)
      return
    }

    if (!data) {
      await supabase.auth.signOut()

      setError(
        'Administrator profile not found.'
      )

      setCheckingSession(false)
      return
    }

    if (
      String(data.role)
        .toLowerCase() !==
      'admin'
    ) {
      await supabase.auth.signOut()

      setError(
        'This account does not have administrator access.'
      )

      setCheckingSession(false)
      return
    }

    if (
      String(data.status)
        .toLowerCase() !==
      'active'
    ) {
      await supabase.auth.signOut()

      setError(
        'This administrator account is inactive.'
      )

      setCheckingSession(false)
      return
    }

    setCheckingSession(false)

    if (onLogin) {
      onLogin({
        user,
        profile: data,
      })
    }
  }

  // =========================================================
  // LOGIN
  // =========================================================

  async function handleLogin(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    const cleanEmail =
      email.trim()

    if (!cleanEmail) {
      setError(
        'Please enter your email.'
      )
      return
    }

    if (!password) {
      setError(
        'Please enter your password.'
      )
      return
    }

    setLoading(true)

    try {
      const { data, error } =
        await supabase.auth
          .signInWithPassword({
            email: cleanEmail,
            password,
          })

      if (error) {
        throw error
      }

      if (!data?.user) {
        throw new Error(
          'Login succeeded but no user was returned.'
        )
      }

      await verifyAdmin(
        data.user
      )
    } catch (error) {
      console.error(
        'Admin login error:',
        error
      )

      setError(
        error?.message ||
        'Unable to sign in.'
      )
    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // FORGOT PASSWORD
  // =========================================================

  async function handleForgotPassword() {
    setError('')
    setMessage('')

    const cleanEmail =
      email.trim()

    if (!cleanEmail) {
      setError(
        'Enter your administrator email first.'
      )
      return
    }

    setSendingReset(true)

    try {
      const { error } =
        await supabase.auth
          .resetPasswordForEmail(
            cleanEmail,
            {
              redirectTo:
                `${window.location.origin}/reset-password`,
            }
          )

      if (error) {
        throw error
      }

      setMessage(
        'Password reset link sent. Please check your email.'
      )
    } catch (error) {
      console.error(
        'Password reset error:',
        error
      )

      setError(
        error?.message ||
        'Unable to send password reset email.'
      )
    } finally {
      setSendingReset(false)
    }
  }

  // =========================================================
  // EMAIL ICON
  // =========================================================

  function EmailIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="admin-login-field-svg"
      >
        <path
          d="M4 5.5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="m3.5 7 8.5 6 8.5-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // =========================================================
  // LOCK ICON
  // =========================================================

  function LockIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="admin-login-field-svg"
      >
        <rect
          x="4.5"
          y="10"
          width="15"
          height="10"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />

        <path
          d="M8 10V7a4 4 0 0 1 8 0v3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <path
          d="M12 14.25v2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // =========================================================
  // EYE ICON
  // =========================================================

  function EyeIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="admin-login-eye-svg"
      >
        <path
          d="M2.5 12s3.4-5.5 9.5-5.5S21.5 12 21.5 12s-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle
          cx="12"
          cy="12"
          r="2.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  // =========================================================
  // EYE OFF ICON
  // =========================================================

  function EyeOffIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="admin-login-eye-svg"
      >
        <path
          d="m3 3 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <path
          d="M10.7 6.6c.42-.07.85-.1 1.3-.1 6.1 0 9.5 5.5 9.5 5.5a16.6 16.6 0 0 1-3 3.45"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M6.1 7.6A16.1 16.1 0 0 0 2.5 12s3.4 5.5 9.5 5.5c1.1 0 2.1-.18 3-.49"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M9.9 9.9A3 3 0 0 0 14.1 14.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // =========================================================
  // CHECKING SESSION
  // =========================================================

  if (checkingSession) {
    return (
      <main className="admin-login-page">

        {/* ===============================================
            ANIMATED OUTER RING
        =============================================== */}

        <div
          className="admin-login-orbit"
          aria-hidden="true"
        >
          <div className="admin-login-orbit-track" />

          <div className="admin-login-orbit-bars">
            {Array.from({
              length: 44,
            }).map((_, index) => (
              <span
                key={index}
                style={{
                  '--bar-index': index,
                }}
              />
            ))}
          </div>
        </div>


        {/* ===============================================
            CARD
        =============================================== */}

        <section className="admin-login-card admin-login-card-loading">

          <img
            src="/dtr-pro-logo.png"
            alt="DTR Pro"
            className="admin-login-logo"
          />

          <div className="admin-login-session-loader">
            Checking session...
          </div>

        </section>

      </main>
    )
  }

  // =========================================================
  // LOGIN UI
  // =========================================================

  return (
    <main className="admin-login-page">

      {/* =====================================================
          ANIMATED RING
      ===================================================== */}

      <div
        className="admin-login-orbit"
        aria-hidden="true"
      >
        <div className="admin-login-orbit-track" />

        <div className="admin-login-orbit-bars">
          {Array.from({
            length: 44,
          }).map((_, index) => (
            <span
              key={index}
              style={{
                '--bar-index': index,
              }}
            />
          ))}
        </div>
      </div>


      {/* =====================================================
          LOGIN CARD
      ===================================================== */}

      <section className="admin-login-card">

        {/* ===================================================
            LOGO
        =================================================== */}

        <div className="admin-login-brand">

          <img
            src="/dtr-pro-logo.png"
            alt="DTR Pro"
            className="admin-login-logo"
          />

        </div>


        {/* ===================================================
            FORM
        =================================================== */}

        <form
          className="admin-login-form"
          onSubmit={handleLogin}
        >

          {/* =================================================
              EMAIL
          ================================================= */}

          <div className="admin-login-input-shell">

            <span className="admin-login-input-icon">
              <EmailIcon />
            </span>

            <input
              id="adminEmail"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="Email"
              autoComplete="email"
              aria-label="Administrator email"
            />

          </div>


          {/* =================================================
              PASSWORD
          ================================================= */}

          <div className="admin-login-input-shell">

            <span className="admin-login-input-icon">
              <LockIcon />
            </span>

            <input
              id="adminPassword"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Password"
              autoComplete="current-password"
              aria-label="Administrator password"
            />


            <button
              type="button"
              className="admin-password-eye"
              onClick={() =>
                setShowPassword(
                  (current) =>
                    !current
                )
              }
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
              title={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
            >
              {showPassword
                ? <EyeOffIcon />
                : <EyeIcon />}
            </button>

          </div>


          {/* =================================================
              FORGOT PASSWORD
          ================================================= */}

          <div className="admin-login-forgot-row">

            <button
              type="button"
              className="admin-forgot-password"
              onClick={
                handleForgotPassword
              }
              disabled={
                sendingReset
              }
            >
              {sendingReset
                ? 'Sending...'
                : 'Forgot password?'}
            </button>

          </div>


          {/* =================================================
              ERROR
          ================================================= */}

          {error && (

            <div className="admin-login-error">
              {error}
            </div>

          )}


          {/* =================================================
              MESSAGE
          ================================================= */}

          {message && (

            <div className="admin-login-message">
              {message}
            </div>

          )}


          {/* =================================================
              SIGN IN
          ================================================= */}

          <button
            type="submit"
            className="admin-login-button"
            disabled={loading}
          >
            {loading
              ? 'Signing in...'
              : 'Sign In'}
          </button>

        </form>

      </section>

    </main>
  )
}

export default AdminLogin