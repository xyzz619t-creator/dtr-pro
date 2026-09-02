import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { supabase } from './lib/supabase'

import FaceScanner from './components/FaceScanner'
import KioskActivityPanels from './components/KioskActivityPanels'

import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'


import './App.css'


// ===========================================================
// DTR FEATURE SWITCHES
//
// CURRENT MODE:
// BREAK START + BREAK END ONLY
//
// Later:
// change false → true
// to enable TIME IN / TIME OUT again.
// ===========================================================

const ENABLE_TIME_IN = false
const ENABLE_TIME_OUT = false

const ENABLE_BREAK_START = true
const ENABLE_BREAK_END = true


function App() {
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
  //
  // Increment this after Break Start / Break End so
  // ON BREAKS and LOG HISTORY refresh immediately.
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
    page,
    setPage,
  ] = useState('employee')

  const [
    adminUser,
    setAdminUser,
  ] = useState(null)

  // =========================================================
  // REFS
  // =========================================================

  const lookupTimer =
    useRef(null)

  const employeeInputRef =
    useRef(null)

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
    async function checkSession() {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth
          .getSession()

      if (
        session?.user
      ) {
        setAdminUser(
          session.user
        )
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
            setAdminUser(
              session?.user ||
              null
            )
          }
        )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
          weekday:
            'long',

          year:
            'numeric',

          month:
            'long',

          day:
            'numeric',
        }
      )

  const timeText =
    currentTime
      .toLocaleTimeString(
        'en-US',
        {
          hour:
            '2-digit',

          minute:
            '2-digit',

          second:
            '2-digit',
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
  //
  // After an action:
  // employee clears
  // employee code clears
  // scanner becomes active again
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

    // =======================================================
    // IMMEDIATELY REFRESH:
    //
    // LEFT  = ON BREAKS
    // RIGHT = LOG HISTORY
    // =======================================================

    setActivityRefreshKey(
      (previous) =>
        previous + 1
    )

    // -------------------------------------------------------
    // Give employee time to see confirmation.
    // -------------------------------------------------------

    window.setTimeout(
      () => {
        resetKiosk()
      },
      700
    )

    // -------------------------------------------------------
    // Remove notice.
    // -------------------------------------------------------

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

    if (
      showLoader
    ) {
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

      // =====================================================
      // NO RESPONSE
      // =====================================================

      if (!data) {
        resetEmployeeData()

        setMessage(
          'No response received from Supabase.'
        )

        return
      }

      // =====================================================
      // EMPLOYEE / SCHEDULE ERROR
      // =====================================================

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

      // =====================================================
      // SUCCESS
      // =====================================================

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
      if (
        showLoader
      ) {
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

    // =======================================================
    // CANCEL MANUAL LOOKUP
    // =======================================================

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

    // =======================================================
    // PUT RECOGNIZED CODE INTO MANUAL INPUT
    // =======================================================

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

    // =======================================================
    // SAME FLOW AS MANUAL CODE
    // =======================================================

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

    // =======================================================
    // AUTOMATIC LOOKUP
    // =======================================================

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

      // =====================================================
      // BACKEND REJECTED ACTION
      // =====================================================

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

      // =====================================================
      // SUCCESS
      // =====================================================

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
  //
  // Kept for future use.
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
  //
  // Kept for future use.
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
          hour:
            'numeric',

          minute:
            '2-digit',
        }
      )
  }

  // =========================================================
  // DUTY END DATE
  //
  // Kept for future TIME OUT mode.
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
  //
  // Kept for future use.
  // =========================================================

  function canTimeOutNow() {
    if (
      !ENABLE_TIME_OUT ||
      !schedule
    ) {
      return false
    }

    // -------------------------------------------------------
    // Backend explicitly allows Time Out.
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // Backend exact availability timestamp.
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // Frontend fallback.
    // -------------------------------------------------------

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
  //
  // Kept for future TIME OUT mode.
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
    page === 'employee' &&
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

    setPage(
      'admin'
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

    setPage(
      'employee'
    )

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
  // ADMIN LOGIN PAGE
  // =========================================================

  if (
    page === 'login'
  ) {
    return (
      <AdminLogin
        onLogin={
          handleAdminLogin
        }
      />
    )
  }

  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  if (
    page === 'admin' &&
    adminUser
  ) {
    return (
      <AdminDashboard
        adminUser={
          adminUser
        }

        onEmployeeDtr={() => {
          setPage(
            'employee'
          )

          resetKiosk()
        }}

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
        onClick={() =>
          setPage(
            'login'
          )
        }
        title="Administrator"
        aria-label="Administrator"
      >
        ⚙
      </button>


      {/* =====================================================
          THREE-COLUMN KIOSK
          
          LEFT   = ON BREAKS
          CENTER = DTR
          RIGHT  = LOG HISTORY
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

              {/* ===============================================
                  EMPLOYEE NAME
              =============================================== */}

              <div className="employee-name">

                {employee.first_name}{' '}
                {employee.last_name}

              </div>


              {/* ===============================================
                  DUTY TIME
              =============================================== */}

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


              {/* ===============================================
                  ACTION ERROR
              =============================================== */}

              {actionError && (

                <div className="dtr-action-error">
                  {actionError}
                </div>

              )}


              {/* ===============================================
                  OFF
              =============================================== */}

              {dashboardStatus ===
                'off' && (

                <div className="off-message">
                  You are OFF today.
                </div>

              )}


              {/* ===============================================
                  TOO EARLY
              =============================================== */}

              {dashboardStatus ===
                'too_early' && (

                <div className="too-early-card">

                  {ENABLE_TIME_IN
                    ? 'Time In is available 45 minutes before your duty starts.'
                    : 'Your duty has not started yet.'}

                </div>

              )}


              {/* ===============================================
                  READY
              =============================================== */}

              {dashboardStatus ===
                'ready' && (

                <div className="dtr-actions">

                  {/* =========================================
                      TIME IN
                      HIDDEN FOR NOW
                  ========================================= */}

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


                  {/* =========================================
                      BREAK START
                  ========================================= */}

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


              {/* ===============================================
                  WORKING
              =============================================== */}

              {dashboardStatus ===
                'working' && (

                <div className="dtr-actions">

                  {/* =========================================
                      FINAL 5 MINUTES

                      Only active when
                      ENABLE_TIME_OUT = true.
                  ========================================= */}

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

                      {/* ======================================
                          BREAK START
                      ====================================== */}

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


                      {/* ======================================
                          TIME OUT
                          HIDDEN FOR NOW
                      ====================================== */}

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


              {/* ===============================================
                  ON BREAK
              =============================================== */}

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


              {/* ===============================================
                  COMPLETED
              =============================================== */}

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

export default App