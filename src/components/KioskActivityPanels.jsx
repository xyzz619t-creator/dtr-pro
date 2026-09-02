import {
  useEffect,
  useState,
} from 'react'

import {
  supabase,
} from '../lib/supabase'

import './KioskActivityPanels.css'


const REFRESH_INTERVAL_MS =
  3000


function KioskActivityPanels({
  children,
  refreshKey = 0,
}) {
  // =========================================================
  // DATA
  // =========================================================

  const [
    onBreaks,
    setOnBreaks,
  ] = useState([])

  const [
    history,
    setHistory,
  ] = useState([])

  const [
    now,
    setNow,
  ] = useState(
    new Date()
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')


  // =========================================================
  // LOAD FEED
  // =========================================================

  useEffect(() => {
    let cancelled = false

    async function loadFeed() {
      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            'get_kiosk_break_feed',
            {
              p_history_limit:
                50,
            }
          )

        if (
          cancelled
        ) {
          return
        }

        if (error) {
          throw error
        }

        if (
          data?.success !==
          true
        ) {
          throw new Error(
            'Unable to load break activity.'
          )
        }

        setOnBreaks(
          Array.isArray(
            data.on_breaks
          )
            ? data.on_breaks
            : []
        )

        setHistory(
          Array.isArray(
            data.history
          )
            ? data.history
            : []
        )

        setErrorMessage('')
      } catch (error) {
        if (
          cancelled
        ) {
          return
        }

        console.error(
          'Kiosk break feed error:',
          error
        )

        setErrorMessage(
          'Unable to load activity.'
        )
      } finally {
        if (
          !cancelled
        ) {
          setLoading(false)
        }
      }
    }

    // Immediate load
    loadFeed()

    // Live refresh
    const refreshTimer =
      window.setInterval(
        loadFeed,
        REFRESH_INTERVAL_MS
      )

    return () => {
      cancelled = true

      window.clearInterval(
        refreshTimer
      )
    }
  }, [
    refreshKey,
  ])


  // =========================================================
  // ELAPSED TIME CLOCK
  // =========================================================

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            new Date()
          )
        },
        15000
      )

    return () => {
      window.clearInterval(
        timer
      )
    }
  }, [])


  // =========================================================
  // NAME
  // =========================================================

  function getName(
    item
  ) {
    return [
      item?.first_name,
      item?.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
  }


  // =========================================================
  // INITIALS
  // =========================================================

  function getInitials(
    item
  ) {
    const first =
      String(
        item?.first_name ||
        ''
      )
        .trim()
        .charAt(0)

    const last =
      String(
        item?.last_name ||
        ''
      )
        .trim()
        .charAt(0)

    return (
      `${first}${last}`
        .toUpperCase() ||
      '--'
    )
  }


  // =========================================================
  // AVATAR HUE
  // =========================================================

  function getAvatarHue(
    item
  ) {
    const text =
      String(
        item?.employee_code ||
        getName(item) ||
        ''
      )

    let total = 0

    for (
      let index = 0;
      index < text.length;
      index++
    ) {
      total +=
        text.charCodeAt(
          index
        )
    }

    return (
      total * 47
    ) % 360
  }


  // =========================================================
  // CLOCK TIME
  // =========================================================

  function formatTime(
    value
  ) {
    if (!value) {
      return '--:--'
    }

    const date =
      new Date(
        value
      )

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '--:--'
    }

    return date
      .toLocaleTimeString(
        'en-US',
        {
          timeZone:
            'Asia/Dubai',

          hour:
            '2-digit',

          minute:
            '2-digit',

          hour12:
            false,
        }
      )
  }


  // =========================================================
  // BREAK ELAPSED
  // =========================================================

  function getElapsed(
    breakStart
  ) {
    if (!breakStart) {
      return ''
    }

    const start =
      new Date(
        breakStart
      )

    if (
      Number.isNaN(
        start.getTime()
      )
    ) {
      return ''
    }

    const minutes =
      Math.max(
        0,
        Math.floor(
          (
            now.getTime() -
            start.getTime()
          ) /
          60000
        )
      )

    if (
      minutes < 60
    ) {
      return `${minutes} min`
    }

    const hours =
      Math.floor(
        minutes / 60
      )

    const remaining =
      minutes % 60

    return `${hours}h ${remaining}m`
  }


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="kiosk-workspace">

      {/* =====================================================
          LEFT — ON BREAKS
      ===================================================== */}

      <aside className="kiosk-side-column kiosk-side-left">

        <section className="kiosk-liquid-panel">

          <div className="kiosk-panel-heading">

            <div>

              <h2>
                ON BREAKS
              </h2>

            </div>


            <div className="kiosk-panel-count">
              {onBreaks.length}
            </div>

          </div>


          <div className="kiosk-panel-scroll">

            {loading &&
            onBreaks.length ===
              0 ? (

              <div className="kiosk-panel-empty">
                Loading...
              </div>

            ) : onBreaks.length ===
              0 ? (

              <div className="kiosk-panel-empty">

                <span className="empty-status-dot" />

                No employees currently on break.

              </div>

            ) : (

              onBreaks.map(
                (item) => (

                  <article
                    key={
                      item.break_id
                    }
                    className="kiosk-activity-card on-break-card"
                  >

                    <div
                      className="kiosk-avatar"
                      style={{
                        '--avatar-hue':
                          getAvatarHue(
                            item
                          ),
                      }}
                    >
                      {getInitials(
                        item
                      )}
                    </div>


                    <div className="kiosk-activity-info">

                      <div className="kiosk-activity-name">
                        {getName(
                          item
                        )}
                      </div>


                      <div className="kiosk-activity-meta">

                        <span className="on-break-status">
                          ON BREAK
                        </span>

                        <span>
                          {getElapsed(
                            item.break_start
                          )}
                        </span>

                      </div>

                    </div>


                    <div className="kiosk-activity-time">
                      {formatTime(
                        item.break_start
                      )}
                    </div>

                  </article>

                )
              )

            )}

          </div>

        </section>

      </aside>


      {/* =====================================================
          CENTER — EXISTING DTR
      ===================================================== */}

      <div className="kiosk-center-slot">
        {children}
      </div>


      {/* =====================================================
          RIGHT — LOG HISTORY
      ===================================================== */}

      <aside className="kiosk-side-column kiosk-side-right">

        <section className="kiosk-liquid-panel">

          <div className="kiosk-panel-heading">

            <div>

              <h2>
                LOG HISTORY
              </h2>

            </div>

          </div>


          <div className="kiosk-panel-scroll">

            {errorMessage && (

              <div className="kiosk-panel-error">
                {errorMessage}
              </div>

            )}


            {loading &&
            history.length ===
              0 ? (

              <div className="kiosk-panel-empty">
                Loading...
              </div>

            ) : history.length ===
              0 ? (

              <div className="kiosk-panel-empty">
                No break history yet.
              </div>

            ) : (

              history.map(
                (item) => {

                  const isEnd =
                    item.action ===
                    'BREAK END'

                  return (
                    <article
                      key={
                        item.event_id
                      }
                      className={
                        isEnd
                          ? 'kiosk-activity-card log-card break-end-log'
                          : 'kiosk-activity-card log-card break-start-log'
                      }
                    >

                      <div
                        className="kiosk-avatar"
                        style={{
                          '--avatar-hue':
                            getAvatarHue(
                              item
                            ),
                        }}
                      >
                        {getInitials(
                          item
                        )}
                      </div>


                      <div className="kiosk-activity-info">

                        <div className="kiosk-activity-name">
                          {getName(
                            item
                          )}
                        </div>


                        <div
                          className={
                            isEnd
                              ? 'kiosk-log-action break-end-action'
                              : 'kiosk-log-action break-start-action'
                          }
                        >
                          {item.action}
                        </div>

                      </div>


                      <div className="kiosk-activity-time">
                        {formatTime(
                          item.event_time
                        )}
                      </div>

                    </article>
                  )
                }
              )

            )}

          </div>

        </section>

      </aside>

    </div>
  )
}

export default KioskActivityPanels