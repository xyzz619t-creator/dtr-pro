import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { supabase } from './lib/supabase'

import FaceScanner from './components/FaceScanner'
import KioskActivityPanels from './components/KioskActivityPanels'

import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import EmployeeLeaveRequest from './pages/EmployeeLeaveRequest'

import './App.css'


// ===========================================================
// DTR FEATURE SWITCHES
//
// CURRENT MODE:
// BREAK START + BREAK END ONLY
//
// LATER:
// change false → true
// to enable TIME IN / TIME OUT again.
// ===========================================================

const ENABLE_TIME_IN = false
const ENABLE_TIME_OUT = false

const ENABLE_BREAK_START = true
const ENABLE_BREAK_END = true


// ===========================================================
// ADMIN ROUTES
// ===========================================================

const ADMIN_LOGIN_PATH = '/admin/login'

const ADMIN_PAGE_PATHS = {
  employees: '/admin/employees',
  schedules: '/admin/schedules',
  leave: '/admin/leave',
  holidays: '/admin/holidays',
  comoff: '/admin/com-off',
  reports: '/admin/reports',
}


// ===========================================================
// NORMALIZE PATH
// ===========================================================

function normalizePath(pathname) {
  const value =
    String(pathname || '/')
      .replace(/\/+$/, '')

  return value || '/'
}


// ===========================================================
// DTR APPLICATION
// ===========================================================

function DtrApp({
  pathname,
  navigate,
}) {
  // =========================================================
  // CLOCK
  // =========================================================

  const [
    currentTime,
    setCurrentTime,
  ] = useState(
    new Date()
  )


  // =========================================================
  // EMPLOYEE
  // =========================================================

  const [
    employeeCode,
    setEmployeeCode,
  ] = useState('')

  const [
    employee,
    setEmployee,
  ] = useState(null)

  const [
    schedule,
    setSchedule,
  ] = useState(null)

  const [
    dashboardStatus,
    setDashboardStatus,
  ] = useState('none')

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    actionError,
    setActionError,
  ] = useState('')

  const [
    kioskNotice,
    setKioskNotice,
  ] = useState('')


  // =========================================================
  // ACTIVITY PANELS
  // =========================================================

  const [
    activityRefreshKey,
    setActivityRefreshKey,
  ] = useState(0)


  // =========================================================
  // FACE RECOGNITION
  // =========================================================

  const [
    faceRecognizing,
    setFaceRecognizing,
  ] = useState(false)


  // =========================================================
  // ADMIN
  // =========================================================

  const [
    adminUser,
    setAdminUser,
  ] = useState(null)

  const [
    checkingAdminSession,
    setCheckingAdminSession,
  ] = useState(true)


  // =========================================================
  // REFS
  // =========================================================

  const lookupTimer =
    useRef(null)

  const employeeInputRef =
    useRef(null)


  // =========================================================
  // ROUTE STATUS
  // =========================================================

  const isAdminRoute =
    pathname === '/admin' ||
    pathname === ADMIN_LOGIN_PATH ||
    pathname.startsWith('/admin/')


  const isKnownAdminPage =
    Object.values(
      ADMIN_PAGE_PATHS
    ).includes(
      pathname
    )


  // =========================================================
  // LIVE CLOCK
  // =========================================================

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setCurrentTime(
            new Date()
          )
        },
        1000
      )

    return () => {
      window.clearInterval(
        timer
      )
    }
  }, [])


  // =========================================================
  // ADMIN SESSION
  // =========================================================

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth
            .getSession()

        if (!mounted) {
          return
        }

        setAdminUser(
          session?.user ||
          null
        )
      } catch (error) {
        console.error(
          'Admin session error:',
          error
        )

        if (mounted) {
          setAdminUser(null)
        }
      } finally {
        if (mounted) {
          setCheckingAdminSession(
            false
          )
        }
      }
    }

    checkSession()


    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            session
          ) => {
            if (!mounted) {
              return
            }

            setAdminUser(
              session?.user ||
              null
            )

            setCheckingAdminSession(
              false
            )
          }
        )


    return () => {
      mounted = false

      subscription.unsubscribe()
    }
  }, [])


  // =========================================================
  // ADMIN ROUTE NORMALIZATION
  // =========================================================

  useEffect(() => {
    if (!isAdminRoute) {
      return
    }

    if (checkingAdminSession) {
      return
    }

    // -------------------------------------------------------
    // ADMIN LOGGED IN
    // -------------------------------------------------------

    if (adminUser) {
      if (
        pathname === '/admin' ||
        pathname === ADMIN_LOGIN_PATH
      ) {
        navigate(
          ADMIN_PAGE_PATHS.employees,
          {
            replace: true,
          }
        )

        return
      }

      if (!isKnownAdminPage) {
        navigate(
          ADMIN_PAGE_PATHS.employees,
          {
            replace: true,
          }
        )
      }

      return
    }


    // -------------------------------------------------------
    // ADMIN NOT LOGGED IN
    // -------------------------------------------------------

    if (
      pathname !==
      ADMIN_LOGIN_PATH
    ) {
      navigate(
        ADMIN_LOGIN_PATH,
        {
          replace: true,
        }
      )
    }
  }, [
    adminUser,
    checkingAdminSession,
    isAdminRoute,
    isKnownAdminPage,
    navigate,
    pathname,
  ])


  // =========================================================
  // CLEAN LOOKUP TIMER
  // =========================================================

  useEffect(() => {
    return () => {
      if (
        lookupTimer.current
      ) {
        window.clearTimeout(
          lookupTimer.current
        )
      }
    }
  }, [])


  // =========================================================
  // DATE / TIME
  // =========================================================

  const dateText =
    currentTime
      .toLocaleDateString(
        'en-US',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }
      )


  const timeText =
    currentTime
      .toLocaleTimeString(
        'en-US',
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }
      )


  // =========================================================
  // RESET EMPLOYEE DATA
  // =========================================================

  function resetEmployeeData() {
    setEmployee(null)

    setSchedule(null)

    setDashboardStatus(
      'none'
    )
  }


  // =========================================================
  // RESET KIOSK
  // =========================================================

  function resetKiosk() {
    if (
      lookupTimer.current
    ) {
      window.clearTimeout(
        lookupTimer.current
      )

      lookupTimer.current =
        null
    }

    setEmployeeCode('')

    resetEmployeeData()

    setMessage('')

    setActionError('')

    setFaceRecognizing(false)

    window.setTimeout(
      () => {
        employeeInputRef
          .current
          ?.focus()
      },
      50
    )
  }


  // =========================================================
  // ACTION SUCCESS
  // =========================================================

  function completeActionAndReset(
    successMessage
  ) {
    setKioskNotice(
      successMessage
    )

    setActivityRefreshKey(
      (previous) =>
        previous + 1
    )

    window.setTimeout(
      () => {
        resetKiosk()
      },
      700
    )

    window.setTimeout(
      () => {
        setKioskNotice('')
      },
      2200
    )
  }


  // =========================================================
  // LOAD EMPLOYEE DASHBOARD
  // =========================================================

  async function loadEmployeeDashboard(
    codeValue,
    showLoader = true
  ) {
    const code =
      String(
        codeValue ||
        ''
      ).trim()

    if (!code) {
      return
    }

    if (showLoader) {
      setLoading(true)
    }

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'get_employee_dashboard',
          {
            p_employee_code:
              code,
          }
        )

      if (error) {
        throw error
      }

      if (!data) {
        resetEmployeeData()

        setMessage(
          'No response received from Supabase.'
        )

        return
      }

      if (
        data.success !==
        true
      ) {
        resetEmployeeData()

        setMessage(
          data.message ||
          'Employee not found.'
        )

        return
      }

      setEmployee(
        data.employee ||
        null
      )

      setSchedule(
        data.schedule ||
        null
      )

      setDashboardStatus(
        data.dashboard_status ||
        'off'
      )

      setMessage('')
    } catch (error) {
      console.error(
        'Employee dashboard error:',
        error
      )

      resetEmployeeData()

      setMessage(
        `Unable to load employee information: ${error.message}`
      )
    } finally {
      if (showLoader) {
        setLoading(false)
      }

      setFaceRecognizing(false)
    }
  }


  // =========================================================
  // FACE RECOGNIZED
  // =========================================================

  async function handleFaceRecognized(
    recognizedCode,
    match
  ) {
    const code =
      String(
        recognizedCode ||
        ''
      ).trim()

    if (
      !code ||
      loading ||
      actionLoading ||
      employee
    ) {
      return
    }

    if (
      lookupTimer.current
    ) {
      window.clearTimeout(
        lookupTimer.current
      )

      lookupTimer.current =
        null
    }

    setFaceRecognizing(true)

    setMessage('')

    setActionError('')

    setEmployeeCode(
      code
    )


    const recognizedName =
      [
        match?.employee
          ?.first_name,

        match?.employee
          ?.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .trim()


    if (
      recognizedName
    ) {
      setKioskNotice(
        `Face recognized: ${recognizedName}`
      )

      window.setTimeout(
        () => {
          setKioskNotice('')
        },
        1800
      )
    }

    await loadEmployeeDashboard(
      code
    )
  }


  // =========================================================
  // MANUAL EMPLOYEE CODE
  // =========================================================

  function handleEmployeeCodeChange(
    event
  ) {
    const value =
      event.target.value

    setEmployeeCode(
      value
    )

    resetEmployeeData()

    setMessage('')

    setActionError('')

    setFaceRecognizing(false)

    if (
      value.trim()
    ) {
      setKioskNotice('')
    }

    if (
      lookupTimer.current
    ) {
      window.clearTimeout(
        lookupTimer.current
      )
    }

    const code =
      value.trim()

    if (!code) {
      return
    }

    lookupTimer.current =
      window.setTimeout(
        () => {
          loadEmployeeDashboard(
            code
          )
        },
        500
      )
  }


  // =========================================================
  // DTR ACTION
  // =========================================================

  async function runDtrAction(
    functionName,
    timeParameter
  ) {
    const code =
      employeeCode.trim()

    if (!code) {
      return
    }

    setActionLoading(
      true
    )

    setActionError('')

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          functionName,
          {
            p_employee_code:
              code,

            [timeParameter]:
              new Date()
                .toISOString(),
          }
        )

      if (error) {
        throw error
      }

      if (
        !data?.success
      ) {
        setActionError(
          data?.message ||
          'Unable to complete action.'
        )

        await loadEmployeeDashboard(
          code,
          false
        )

        return
      }

      completeActionAndReset(
        data.message ||
        'Recorded successfully.'
      )
    } catch (error) {
      console.error(
        `${functionName} error:`,
        error
      )

      setActionError(
        error.message ||
        'Unable to complete action.'
      )
    } finally {
      setActionLoading(false)
    }
  }


  // =========================================================
  // TIME IN
  // =========================================================

  function handleTimeIn() {
    return runDtrAction(
      'clock_in',
      'p_time_in'
    )
  }


  // =========================================================
  // BREAK START
  // =========================================================

  function handleBreakStart() {
    return runDtrAction(
      'break_start',
      'p_break_start'
    )
  }


  // =========================================================
  // BREAK END
  // =========================================================

  function handleBreakEnd() {
    return runDtrAction(
      'break_end',
      'p_break_end'
    )
  }


  // =========================================================
  // TIME OUT
  // =========================================================

  function handleTimeOut() {
    return runDtrAction(
      'clock_out',
      'p_time_out'
    )
  }


  // =========================================================
  // FORMAT SCHEDULE TIME
  // =========================================================

  function formatScheduleTime(
    value
  ) {
    if (!value) {
      return '--:--'
    }

    const [
      hour,
      minute,
    ] =
      String(value)
        .substring(
          0,
          5
        )
        .split(':')
        .map(Number)

    const date =
      new Date()

    date.setHours(
      hour
    )

    date.setMinutes(
      minute
    )

    date.setSeconds(0)

    return date
      .toLocaleTimeString(
        'en-US',
        {
          hour: 'numeric',
          minute: '2-digit',
        }
      )
  }


  // =========================================================
  // DUTY END DATE
  // =========================================================

  function getDutyEndDate() {
    if (
      !schedule
        ?.scheduled_end
    ) {
      return null
    }

    const dutyEnd =
      new Date(
        schedule
          .scheduled_end
      )

    if (
      Number.isNaN(
        dutyEnd.getTime()
      )
    ) {
      return null
    }

    return dutyEnd
  }


  // =========================================================
  // TIME OUT AVAILABLE
  // =========================================================

  function canTimeOutNow() {
    if (
      !ENABLE_TIME_OUT ||
      !schedule
    ) {
      return false
    }

    if (
      schedule
        .can_time_out ===
        true ||
      schedule
        .can_time_out ===
        'true'
    ) {
      return true
    }

    if (
      schedule
        .time_out_available_from
    ) {
      const availableFrom =
        new Date(
          schedule
            .time_out_available_from
        )

      if (
        !Number.isNaN(
          availableFrom
            .getTime()
        )
      ) {
        return (
          currentTime >=
          availableFrom
        )
      }
    }

    const dutyEnd =
      getDutyEndDate()

    if (!dutyEnd) {
      return false
    }

    const availableFrom =
      new Date(
        dutyEnd.getTime() -
        60 *
          60 *
          1000
      )

    return (
      currentTime >=
      availableFrom
    )
  }


  // =========================================================
  // FINAL 5 MINUTES
  // =========================================================

  function isLastFiveMinutesOrLater() {
    if (
      !ENABLE_TIME_OUT
    ) {
      return false
    }

    const dutyEnd =
      getDutyEndDate()

    if (!dutyEnd) {
      return false
    }

    const finalFiveStarts =
      new Date(
        dutyEnd.getTime() -
        5 *
          60 *
          1000
      )

    return (
      currentTime >=
      finalFiveStarts
    )
  }


  const canTimeOut =
    canTimeOutNow()


  const finalFiveMinutes =
    isLastFiveMinutesOrLater()


  // =========================================================
  // FACE SCANNER ACTIVE
  // =========================================================

  const faceScannerActive =
    !isAdminRoute &&
    !employee &&
    !employeeCode.trim() &&
    !loading &&
    !actionLoading &&
    !faceRecognizing


  // =========================================================
  // ADMIN LOGIN
  // =========================================================

  function handleAdminLogin(
    loginData
  ) {
    setAdminUser(
      loginData.user
    )

    navigate(
      ADMIN_PAGE_PATHS.employees,
      {
        replace: true,
      }
    )
  }


  // =========================================================
  // ADMIN LOGOUT
  // =========================================================

  async function handleLogout() {
    try {
      await supabase.auth
        .signOut()
    } catch (error) {
      console.error(
        'Admin logout error:',
        error
      )
    }

    setAdminUser(null)

    navigate(
      ADMIN_LOGIN_PATH,
      {
        replace: true,
      }
    )
  }


  // =========================================================
  // EMPLOYEE DTR
  // =========================================================

  function handleEmployeeDtr() {
    navigate('/')

    resetKiosk()

    window.setTimeout(
      () => {
        employeeInputRef
          .current
          ?.focus()
      },
      100
    )
  }


  // =========================================================
  // ADMIN ROUTE
  // =========================================================

  if (isAdminRoute) {
    // -------------------------------------------------------
    // SESSION CHECKING
    // -------------------------------------------------------

    if (
      checkingAdminSession
    ) {
      return (
        <AdminLogin
          onLogin={
            handleAdminLogin
          }
        />
      )
    }


    // -------------------------------------------------------
    // NOT LOGGED IN
    // -------------------------------------------------------

    if (!adminUser) {
      return (
        <AdminLogin
          onLogin={
            handleAdminLogin
          }
        />
      )
    }


    // -------------------------------------------------------
    // ADMIN DASHBOARD
    // -------------------------------------------------------

    return (
      <AdminDashboard
        adminUser={
          adminUser
        }

        currentPath={
          pathname
        }

        onNavigate={
          navigate
        }

        onEmployeeDtr={
          handleEmployeeDtr
        }

        onLogout={
          handleLogout
        }
      />
    )
  }


  // =========================================================
  // EMPLOYEE KIOSK
  // =========================================================

  return (
    <div className="app">

      {/* =====================================================
          ADMIN ICON
      ===================================================== */}

      <button
        type="button"
        className="admin-icon-button"

        onClick={() => {
          navigate(
            ADMIN_LOGIN_PATH
          )
        }}

        title="Administrator"

        aria-label="Administrator"
      >
        ⚙
      </button>


      {/* =====================================================
          THREE-COLUMN KIOSK
      ===================================================== */}

      <KioskActivityPanels
        refreshKey={
          activityRefreshKey
        }
      >

        <main className="dtr-container">

          {/* =================================================
              LOGO / CLOCK
          ================================================= */}

          <section className="clock-section">

            <img
              src="/dtr-pro-logo.png"
              alt="Katrina Coffee & Cakes"
              className="dtr-logo"
            />


            <div className="live-clock">
              {timeText}
            </div>


            <div className="current-date">
              {dateText}
            </div>

          </section>


          {/* =================================================
              NOTICE
          ================================================= */}

          {kioskNotice && (
            <div className="kiosk-notice">
              {kioskNotice}
            </div>
          )}


          {/* =================================================
              FACE SCANNER
          ================================================= */}

          {!employee &&
            !employeeCode
              .trim() && (

            <FaceScanner
              active={
                faceScannerActive
              }

              disabled={
                loading ||
                actionLoading
              }

              onRecognized={
                handleFaceRecognized
              }
            />

          )}


          {/* =================================================
              MANUAL EMPLOYEE CODE
          ================================================= */}

          <section className="employee-section">

            <label htmlFor="employeeCode">
              Employee Code
            </label>


            <input
              ref={
                employeeInputRef
              }

              id="employeeCode"

              className="employee-code-input"

              type="text"

              inputMode="numeric"

              value={
                employeeCode
              }

              onChange={
                handleEmployeeCodeChange
              }

              placeholder="Enter employee code"

              autoComplete="off"
            />


            {loading && (
              <div className="lookup-message">
                Checking employee...
              </div>
            )}


            {message &&
              !loading && (

              <div className="lookup-error">
                {message}
              </div>

            )}

          </section>


          {/* =================================================
              EMPLOYEE DUTY
          ================================================= */}

          {employee && (

            <section className="employee-duty-card">

              <div className="employee-name">

                {employee.first_name}{' '}
                {employee.last_name}

              </div>


              {schedule && (

                <div className="employee-duty">

                  <div className="duty-time">

                    {formatScheduleTime(
                      schedule
                        .scheduled_start_time
                    )}


                    <span className="duty-arrow">
                      →
                    </span>


                    {formatScheduleTime(
                      schedule
                        .scheduled_end_time
                    )}

                  </div>


                  {schedule
                    .scheduled_end_next_day && (

                    <div className="overnight-label">
                      Overnight Duty
                    </div>

                  )}

                </div>

              )}


              {actionError && (

                <div className="dtr-action-error">
                  {actionError}
                </div>

              )}


              {dashboardStatus ===
                'off' && (

                <div className="off-message">
                  You are OFF today.
                </div>

              )}


              {dashboardStatus ===
                'too_early' && (

                <div className="too-early-card">

                  {ENABLE_TIME_IN
                    ? 'Time In is available 45 minutes before your duty starts.'
                    : 'Your duty has not started yet.'}

                </div>

              )}


              {dashboardStatus ===
                'ready' && (

                <div className="dtr-actions">

                  {ENABLE_TIME_IN && (

                    <button
                      type="button"

                      className="
                        dtr-button
                        time-in-button
                      "

                      onClick={
                        handleTimeIn
                      }

                      disabled={
                        actionLoading
                      }
                    >

                      {actionLoading
                        ? 'PLEASE WAIT...'
                        : 'TIME IN'}

                    </button>

                  )}


                  {ENABLE_BREAK_START && (

                    <button
                      type="button"

                      className="
                        dtr-button
                        break-button
                      "

                      onClick={
                        handleBreakStart
                      }

                      disabled={
                        actionLoading
                      }
                    >

                      {actionLoading
                        ? 'PLEASE WAIT...'
                        : 'BREAK START'}

                    </button>

                  )}

                </div>

              )}


              {dashboardStatus ===
                'working' && (

                <div className="dtr-actions">

                  {ENABLE_TIME_OUT &&
                  finalFiveMinutes ? (

                    <button
                      type="button"

                      className="
                        dtr-button
                        time-out-button
                      "

                      onClick={
                        handleTimeOut
                      }

                      disabled={
                        actionLoading
                      }
                    >

                      {actionLoading
                        ? 'PLEASE WAIT...'
                        : 'TIME OUT'}

                    </button>

                  ) : (

                    <>

                      {ENABLE_BREAK_START && (

                        <button
                          type="button"

                          className="
                            dtr-button
                            break-button
                          "

                          onClick={
                            handleBreakStart
                          }

                          disabled={
                            actionLoading
                          }
                        >

                          {actionLoading
                            ? 'PLEASE WAIT...'
                            : 'BREAK START'}

                        </button>

                      )}


                      {ENABLE_TIME_OUT &&
                        canTimeOut && (

                        <button
                          type="button"

                          className="
                            dtr-button
                            time-out-button
                          "

                          onClick={
                            handleTimeOut
                          }

                          disabled={
                            actionLoading
                          }
                        >

                          {actionLoading
                            ? 'PLEASE WAIT...'
                            : 'TIME OUT'}

                        </button>

                      )}

                    </>

                  )}

                </div>

              )}


              {dashboardStatus ===
                'on_break' && (

                <div className="dtr-actions">

                  {ENABLE_BREAK_END && (

                    <button
                      type="button"

                      className="
                        dtr-button
                        break-end-button
                      "

                      onClick={
                        handleBreakEnd
                      }

                      disabled={
                        actionLoading
                      }
                    >

                      {actionLoading
                        ? 'PLEASE WAIT...'
                        : 'BREAK END'}

                    </button>

                  )}

                </div>

              )}


              {dashboardStatus ===
                'completed' && (

                <div className="completed-message">
                  Duty Completed
                </div>

              )}

            </section>

          )}

        </main>

      </KioskActivityPanels>

    </div>
  )
}


// ===========================================================
// APPLICATION ROUTER
// ===========================================================

function App() {
  const [
    pathname,
    setPathname,
  ] = useState(
    () =>
      normalizePath(
        window.location.pathname
      )
  )


  // =========================================================
  // NAVIGATE
  // =========================================================

  const navigate =
    useCallback(
      (
        path,
        options = {}
      ) => {
        const nextPath =
          normalizePath(
            path
          )

        const currentPath =
          normalizePath(
            window.location.pathname
          )

        if (
          currentPath !==
          nextPath
        ) {
          if (
            options.replace
          ) {
            window.history
              .replaceState(
                {},
                '',
                nextPath
              )
          } else {
            window.history
              .pushState(
                {},
                '',
                nextPath
              )
          }
        }

        setPathname(
          nextPath
        )
      },
      []
    )


  // =========================================================
  // BACK / FORWARD
  // =========================================================

  useEffect(() => {
    function handlePopState() {
      setPathname(
        normalizePath(
          window.location.pathname
        )
      )
    }

    window.addEventListener(
      'popstate',
      handlePopState
    )

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState
      )
    }
  }, [])


  // =========================================================
  // EMPLOYEE LEAVE REQUEST
  // =========================================================

  if (
    pathname ===
    '/leave-request'
  ) {
    return (
      <EmployeeLeaveRequest
        onBack={() =>
          navigate('/')
        }
      />
    )
  }


  // =========================================================
  // DTR / ADMIN
  // =========================================================

  return (
    <DtrApp
      pathname={
        pathname
      }

      navigate={
        navigate
      }
    />
  )
}


export default App