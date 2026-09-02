import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  supabase,
} from '../lib/supabase'

import './AdminReports.css'


// ===========================================================
// HELPERS
// ===========================================================

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      `${value}T00:00:00`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleDateString(
    'en-US',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  )
}


function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleString(
    'en-US',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}


function formatTime(value) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleTimeString(
    'en-US',
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}


function formatNumber(
  value,
  decimals = 2
) {
  const number =
    Number(
      value || 0
    )

  if (
    Number.isInteger(number)
  ) {
    return String(number)
  }

  return number.toFixed(
    decimals
  )
}


function formatMinutes(value) {
  const total =
    Math.max(
      0,
      Number(
        value || 0
      )
    )

  const hours =
    Math.floor(
      total / 60
    )

  const minutes =
    Math.round(
      total % 60
    )

  if (
    hours > 0 &&
    minutes > 0
  ) {
    return `${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}m`
}


function getInitials(
  firstName,
  lastName
) {
  const first =
    String(
      firstName || ''
    )
      .trim()
      .charAt(0)

  const last =
    String(
      lastName || ''
    )
      .trim()
      .charAt(0)

  return (
    `${first}${last}`
      .toUpperCase() ||
    '?'
  )
}


function calculateCalendarDays(
  startDate,
  endDate
) {
  if (
    !startDate ||
    !endDate
  ) {
    return 0
  }

  const start =
    new Date(
      `${startDate}T00:00:00`
    )

  const end =
    new Date(
      `${endDate}T00:00:00`
    )

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return 0
  }

  return Math.max(
    Math.floor(
      (
        end.getTime() -
        start.getTime()
      ) /
      86400000
    ) + 1,
    0
  )
}


function titleCase(value) {
  if (!value) {
    return '—'
  }

  return String(value)
    .replaceAll(
      '_',
      ' '
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    )
}


function getOne(value) {
  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ||
      null
    )
  }

  return (
    value ||
    null
  )
}


// ===========================================================
// CSV
// ===========================================================

function escapeCsv(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  const string =
    String(value)

  return `"${string.replaceAll(
    '"',
    '""'
  )}"`
}


function downloadCsv(
  fileName,
  rows
) {
  if (
    !rows ||
    rows.length === 0
  ) {
    window.alert(
      'No report data to export.'
    )

    return
  }

  const headers =
    Object.keys(
      rows[0]
    )

  const content =
    [
      headers
        .map(
          escapeCsv
        )
        .join(','),

      ...rows.map(
        (row) =>
          headers
            .map(
              (header) =>
                escapeCsv(
                  row[
                    header
                  ]
                )
            )
            .join(',')
      ),
    ].join('\n')

  const blob =
    new Blob(
      [
        '\uFEFF',
        content,
      ],
      {
        type:
          'text/csv;charset=utf-8;',
      }
    )

  const url =
    URL.createObjectURL(
      blob
    )

  const anchor =
    document.createElement(
      'a'
    )

  anchor.href =
    url

  anchor.download =
    fileName

  document.body.appendChild(
    anchor
  )

  anchor.click()

  anchor.remove()

  URL.revokeObjectURL(
    url
  )
}


// ===========================================================
// ADMIN REPORTS
// ===========================================================

function AdminReports() {
  // =========================================================
  // ACTIVE TAB
  // =========================================================

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    'attendance'
  )


  // =========================================================
  // DATA
  // =========================================================

  const [
    attendance,
    setAttendance,
  ] = useState([])

  const [
    leave,
    setLeave,
  ] = useState([])

  const [
    comOffRequests,
    setComOffRequests,
  ] = useState([])

  const [
    comOffBalances,
    setComOffBalances,
  ] = useState([])

  const [
    breakLogs,
    setBreakLogs,
  ] = useState([])


  // =========================================================
  // UI
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')


  // =========================================================
  // ATTENDANCE FILTERS
  // =========================================================

  const [
    attendanceSearch,
    setAttendanceSearch,
  ] = useState('')

  const [
    attendanceFrom,
    setAttendanceFrom,
  ] = useState('')

  const [
    attendanceTo,
    setAttendanceTo,
  ] = useState('')

  const [
    attendanceShift,
    setAttendanceShift,
  ] = useState('all')

  const [
    attendanceStatus,
    setAttendanceStatus,
  ] = useState('all')


  // =========================================================
  // LEAVE FILTERS
  // =========================================================

  const [
    leaveSearch,
    setLeaveSearch,
  ] = useState('')

  const [
    leaveFrom,
    setLeaveFrom,
  ] = useState('')

  const [
    leaveTo,
    setLeaveTo,
  ] = useState('')

  const [
    leaveType,
    setLeaveType,
  ] = useState('all')

  const [
    leaveStatus,
    setLeaveStatus,
  ] = useState('all')


  // =========================================================
  // COM-OFF FILTERS
  // =========================================================

  const [
    comOffSearch,
    setComOffSearch,
  ] = useState('')

  const [
    comOffRequestSearch,
    setComOffRequestSearch,
  ] = useState('')

  const [
    comOffRequestStatus,
    setComOffRequestStatus,
  ] = useState('all')

  const [
    comOffFrom,
    setComOffFrom,
  ] = useState('')

  const [
    comOffTo,
    setComOffTo,
  ] = useState('')


  // =========================================================
  // BREAK LOG FILTERS
  // =========================================================

  const [
    logSearch,
    setLogSearch,
  ] = useState('')

  const [
    logFrom,
    setLogFrom,
  ] = useState('')

  const [
    logTo,
    setLogTo,
  ] = useState('')

  const [
    logStatus,
    setLogStatus,
  ] = useState('all')


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadReports()
  }, [])


  // =========================================================
  // LOAD REPORTS
  // =========================================================

  async function loadReports(
    isRefresh = false
  ) {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setErrorMessage('')

    try {
      const [
        attendanceResult,
        leaveResult,
        comOffRequestResult,
        comOffBalanceResult,
        breakLogResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'v_admin_attendance_report'
            )
            .select('*')
            .order(
              'duty_date',
              {
                ascending: false,
              }
            ),

          supabase
            .from(
              'v_admin_leave_report'
            )
            .select('*')
            .order(
              'created_at',
              {
                ascending: false,
              }
            ),

          supabase
            .from(
              'v_admin_com_off_request_report'
            )
            .select('*')
            .order(
              'created_at',
              {
                ascending: false,
              }
            ),

          supabase
            .from(
              'v_admin_com_off_balance_report'
            )
            .select('*')
            .order(
              'employee_name',
              {
                ascending: true,
              }
            ),

          supabase
            .from(
              'attendance_breaks'
            )
            .select(`
              id,
              attendance_id,
              break_start,
              break_end,
              break_minutes,
              created_at,
              updated_at,

              attendance_records (
                id,
                duty_date,
                employee_id,
                shift_id,

                employees (
                  id,
                  employee_code,
                  first_name,
                  last_name,
                  department,
                  position
                ),

                shifts (
                  id,
                  name
                )
              )
            `)
            .order(
              'break_start',
              {
                ascending: false,
              }
            ),
        ])


      if (
        attendanceResult.error
      ) {
        throw attendanceResult.error
      }

      if (
        leaveResult.error
      ) {
        throw leaveResult.error
      }

      if (
        comOffRequestResult.error
      ) {
        throw comOffRequestResult.error
      }

      if (
        comOffBalanceResult.error
      ) {
        throw comOffBalanceResult.error
      }

      if (
        breakLogResult.error
      ) {
        throw breakLogResult.error
      }


      setAttendance(
        attendanceResult.data ||
        []
      )

      setLeave(
        leaveResult.data ||
        []
      )

      setComOffRequests(
        comOffRequestResult.data ||
        []
      )

      setComOffBalances(
        comOffBalanceResult.data ||
        []
      )

      setBreakLogs(
        breakLogResult.data ||
        []
      )
    } catch (error) {
      console.error(
        'Reports load error:',
        error
      )

      setErrorMessage(
        `Unable to load reports: ${error.message}`
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }


  // =========================================================
  // ATTENDANCE OPTIONS
  // =========================================================

  const shiftOptions =
    useMemo(
      () =>
        Array
          .from(
            new Set(
              attendance
                .map(
                  (item) =>
                    item.shift_name
                )
                .filter(Boolean)
            )
          )
          .sort(),
      [
        attendance,
      ]
    )


  const attendanceStatusOptions =
    useMemo(
      () =>
        Array
          .from(
            new Set(
              attendance
                .map(
                  (item) =>
                    item.attendance_status
                )
                .filter(Boolean)
            )
          )
          .sort(),
      [
        attendance,
      ]
    )


  // =========================================================
  // FILTERED ATTENDANCE
  // =========================================================

  const filteredAttendance =
    useMemo(() => {
      const keyword =
        attendanceSearch
          .trim()
          .toLowerCase()

      return attendance.filter(
        (item) => {
          if (keyword) {
            const searchText =
              [
                item.employee_code,
                item.employee_name,
                item.department,
                item.position,
                item.shift_name,
                item.attendance_status,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            if (
              !searchText.includes(
                keyword
              )
            ) {
              return false
            }
          }


          if (
            attendanceFrom &&
            item.duty_date <
              attendanceFrom
          ) {
            return false
          }


          if (
            attendanceTo &&
            item.duty_date >
              attendanceTo
          ) {
            return false
          }


          if (
            attendanceShift !==
              'all' &&
            item.shift_name !==
              attendanceShift
          ) {
            return false
          }


          if (
            attendanceStatus !==
              'all' &&
            item.attendance_status !==
              attendanceStatus
          ) {
            return false
          }


          return true
        }
      )
    }, [
      attendance,
      attendanceSearch,
      attendanceFrom,
      attendanceTo,
      attendanceShift,
      attendanceStatus,
    ])


  // =========================================================
  // LEAVE OPTIONS
  // =========================================================

  const leaveTypeOptions =
    useMemo(
      () =>
        Array
          .from(
            new Set(
              leave
                .map(
                  (item) =>
                    item.leave_type
                )
                .filter(Boolean)
            )
          )
          .sort(),
      [
        leave,
      ]
    )


  const leaveStatusOptions =
    useMemo(
      () =>
        Array
          .from(
            new Set(
              leave
                .map(
                  (item) =>
                    item.leave_status
                )
                .filter(Boolean)
            )
          )
          .sort(),
      [
        leave,
      ]
    )


  // =========================================================
  // FILTERED LEAVE
  // =========================================================

  const filteredLeave =
    useMemo(() => {
      const keyword =
        leaveSearch
          .trim()
          .toLowerCase()

      return leave.filter(
        (item) => {
          if (keyword) {
            const searchText =
              [
                item.employee_code,
                item.employee_name,
                item.department,
                item.position,
                item.leave_type,
                item.leave_status,
                item.reason,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            if (
              !searchText.includes(
                keyword
              )
            ) {
              return false
            }
          }


          if (
            leaveFrom &&
            item.end_date <
              leaveFrom
          ) {
            return false
          }


          if (
            leaveTo &&
            item.start_date >
              leaveTo
          ) {
            return false
          }


          if (
            leaveType !==
              'all' &&
            item.leave_type !==
              leaveType
          ) {
            return false
          }


          if (
            leaveStatus !==
              'all' &&
            item.leave_status !==
              leaveStatus
          ) {
            return false
          }


          return true
        }
      )
    }, [
      leave,
      leaveSearch,
      leaveFrom,
      leaveTo,
      leaveType,
      leaveStatus,
    ])


  // =========================================================
  // LEAVE SUMMARY
  // =========================================================

  const leaveSummary =
    useMemo(() => {
      return {
        total:
          filteredLeave.length,

        pending:
          filteredLeave.filter(
            (item) =>
              item.leave_status ===
              'pending'
          ).length,

        approved:
          filteredLeave.filter(
            (item) =>
              item.leave_status ===
              'approved'
          ).length,

        sick:
          filteredLeave.filter(
            (item) =>
              item.leave_type ===
              'sick'
          ).length,
      }
    }, [
      filteredLeave,
    ])


  // =========================================================
  // COM-OFF BALANCES
  // =========================================================

  const filteredComOffBalances =
    useMemo(() => {
      const keyword =
        comOffSearch
          .trim()
          .toLowerCase()

      if (!keyword) {
        return comOffBalances
      }

      return comOffBalances.filter(
        (item) => {
          const searchText =
            [
              item.employee_code,
              item.employee_name,
              item.department,
              item.position,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

          return searchText.includes(
            keyword
          )
        }
      )
    }, [
      comOffBalances,
      comOffSearch,
    ])


  // =========================================================
  // COM-OFF REQUEST OPTIONS
  // =========================================================

  const comOffStatusOptions =
    useMemo(
      () =>
        Array
          .from(
            new Set(
              comOffRequests
                .map(
                  (item) =>
                    item.request_status
                )
                .filter(Boolean)
            )
          )
          .sort(),
      [
        comOffRequests,
      ]
    )


  // =========================================================
  // COM-OFF REQUESTS
  // =========================================================

  const filteredComOffRequests =
    useMemo(() => {
      const keyword =
        comOffRequestSearch
          .trim()
          .toLowerCase()

      return comOffRequests.filter(
        (item) => {
          if (keyword) {
            const searchText =
              [
                item.employee_code,
                item.employee_name,
                item.department,
                item.position,
                item.reason,
                item.request_status,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            if (
              !searchText.includes(
                keyword
              )
            ) {
              return false
            }
          }


          if (
            comOffRequestStatus !==
              'all' &&
            item.request_status !==
              comOffRequestStatus
          ) {
            return false
          }


          if (
            comOffFrom &&
            item.end_date <
              comOffFrom
          ) {
            return false
          }


          if (
            comOffTo &&
            item.start_date >
              comOffTo
          ) {
            return false
          }


          return true
        }
      )
    }, [
      comOffRequests,
      comOffRequestSearch,
      comOffRequestStatus,
      comOffFrom,
      comOffTo,
    ])


  // =========================================================
  // BREAK LOGS
  // =========================================================

  const filteredBreakLogs =
    useMemo(() => {
      const keyword =
        logSearch
          .trim()
          .toLowerCase()

      return breakLogs.filter(
        (item) => {
          const attendanceRecord =
            getOne(
              item.attendance_records
            )

          const employee =
            getOne(
              attendanceRecord?.employees
            )

          const shift =
            getOne(
              attendanceRecord?.shifts
            )

          const dutyDate =
            attendanceRecord?.duty_date ||
            ''

          const status =
            item.break_end
              ? 'completed'
              : 'on_break'


          if (keyword) {
            const searchText =
              [
                employee?.employee_code,
                employee?.first_name,
                employee?.last_name,
                employee?.department,
                employee?.position,
                shift?.name,
                status,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            if (
              !searchText.includes(
                keyword
              )
            ) {
              return false
            }
          }


          if (
            logFrom &&
            dutyDate <
              logFrom
          ) {
            return false
          }


          if (
            logTo &&
            dutyDate >
              logTo
          ) {
            return false
          }


          if (
            logStatus !==
              'all' &&
            status !==
              logStatus
          ) {
            return false
          }


          return true
        }
      )
    }, [
      breakLogs,
      logSearch,
      logFrom,
      logTo,
      logStatus,
    ])


  // =========================================================
  // VIEW PDF
  // =========================================================

  async function viewLeavePdf(
    record
  ) {
    if (
      !record.attachment_path
    ) {
      return
    }

    try {
      const {
        data,
        error,
      } =
        await supabase
          .storage
          .from(
            'leave-documents'
          )
          .createSignedUrl(
            record.attachment_path,
            600
          )


      if (error) {
        throw error
      }


      if (
        !data?.signedUrl
      ) {
        throw new Error(
          'Unable to create PDF link.'
        )
      }


      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      )
    } catch (error) {
      console.error(
        'Report PDF error:',
        error
      )

      setErrorMessage(
        `Unable to open PDF: ${error.message}`
      )
    }
  }


  // =========================================================
  // EXPORT ATTENDANCE
  // =========================================================

  function exportAttendance() {
    const rows =
      filteredAttendance.map(
        (item) => ({
          'Employee Code':
            item.employee_code,

          'Employee Name':
            item.employee_name,

          Department:
            item.department,

          Position:
            item.position,

          'Duty Date':
            item.duty_date,

          Shift:
            item.shift_name,

          'Time In':
            item.time_in
              ? formatDateTime(
                  item.time_in
                )
              : '',

          'Time Out':
            item.time_out
              ? formatDateTime(
                  item.time_out
                )
              : '',

          'Break Count':
            item.break_count,

          'Break Minutes':
            item.total_break_minutes,

          'Work Minutes':
            item.total_work_minutes,

          Status:
            item.attendance_status,
        })
      )


    downloadCsv(
      'DTR_Attendance_Report.csv',
      rows
    )
  }


  // =========================================================
  // EXPORT LEAVE
  // =========================================================

  function exportLeave() {
    const rows =
      filteredLeave.map(
        (item) => ({
          'Employee Code':
            item.employee_code,

          'Employee Name':
            item.employee_name,

          Department:
            item.department,

          Position:
            item.position,

          'Leave Type':
            titleCase(
              item.leave_type
            ),

          'Start Date':
            item.start_date,

          'End Date':
            item.end_date,

          Days:
            item.calendar_days,

          Duration:
            titleCase(
              item.duration_type
            ),

          Reason:
            item.reason,

          Status:
            titleCase(
              item.leave_status
            ),

          'Admin Notes':
            item.admin_notes,

          'Submitted At':
            item.created_at
              ? formatDateTime(
                  item.created_at
                )
              : '',
        })
      )


    downloadCsv(
      'DTR_Leave_Report.csv',
      rows
    )
  }


  // =========================================================
  // EXPORT COM-OFF BALANCES
  // =========================================================

  function exportComOffBalances() {
    const rows =
      filteredComOffBalances.map(
        (item) => ({
          'Employee Code':
            item.employee_code,

          'Employee Name':
            item.employee_name,

          Department:
            item.department,

          Position:
            item.position,

          'Eligible Holidays':
            item.eligible_holiday_count,

          Earned:
            item.earned_days,

          Used:
            item.used_days,

          Pending:
            item.pending_days,

          Available:
            item.available_days,

          'Latest Holiday':
            item.latest_holiday_date,
        })
      )


    downloadCsv(
      'DTR_Com_Off_Balance_Report.csv',
      rows
    )
  }


  // =========================================================
  // EXPORT COM-OFF REQUESTS
  // =========================================================

  function exportComOffRequests() {
    const rows =
      filteredComOffRequests.map(
        (item) => ({
          'Employee Code':
            item.employee_code,

          'Employee Name':
            item.employee_name,

          Department:
            item.department,

          Position:
            item.position,

          'From Date':
            item.start_date,

          'To Date':
            item.end_date,

          'Requested Days':
            item.requested_days,

          Reason:
            item.reason,

          Status:
            titleCase(
              item.request_status
            ),

          'Admin Notes':
            item.admin_notes,

          'Submitted At':
            item.created_at
              ? formatDateTime(
                  item.created_at
                )
              : '',
        })
      )


    downloadCsv(
      'DTR_Com_Off_Request_Report.csv',
      rows
    )
  }


  // =========================================================
  // EXPORT BREAK LOGS
  // =========================================================

  function exportBreakLogs() {
    const rows =
      filteredBreakLogs.map(
        (item) => {
          const attendanceRecord =
            getOne(
              item.attendance_records
            )

          const employee =
            getOne(
              attendanceRecord?.employees
            )

          const shift =
            getOne(
              attendanceRecord?.shifts
            )

          return {
            'Employee Code':
              employee?.employee_code ||
              '',

            'Employee Name':
              [
                employee?.first_name,
                employee?.last_name,
              ]
                .filter(Boolean)
                .join(' '),

            Department:
              employee?.department ||
              '',

            Position:
              employee?.position ||
              '',

            'Duty Date':
              attendanceRecord?.duty_date ||
              '',

            Shift:
              shift?.name ||
              '',

            'Break Start':
              item.break_start
                ? formatDateTime(
                  item.break_start
                )
                : '',

            'Break End':
              item.break_end
                ? formatDateTime(
                  item.break_end
                )
                : '',

            'Break Minutes':
              item.break_minutes ||
              0,

            Status:
              item.break_end
                ? 'Completed'
                : 'On Break',
          }
        }
      )


    downloadCsv(
      'DTR_Break_Logs.csv',
      rows
    )
  }


  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  function clearAttendanceFilters() {
    setAttendanceSearch('')
    setAttendanceFrom('')
    setAttendanceTo('')
    setAttendanceShift('all')
    setAttendanceStatus('all')
  }


  function clearLeaveFilters() {
    setLeaveSearch('')
    setLeaveFrom('')
    setLeaveTo('')
    setLeaveType('all')
    setLeaveStatus('all')
  }


  function clearComOffBalanceSearch() {
    setComOffSearch('')
  }


  function clearComOffRequestFilters() {
    setComOffRequestSearch('')
    setComOffRequestStatus('all')
    setComOffFrom('')
    setComOffTo('')
  }


  function clearLogFilters() {
    setLogSearch('')
    setLogFrom('')
    setLogTo('')
    setLogStatus('all')
  }


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="admin-reports-page">

      {/* =====================================================
          FROZEN TOP TABS
      ===================================================== */}

      <div className="reports-tabs-row">

        <div className="reports-tabs">

          <button
            type="button"
            className={
              activeTab ===
              'attendance'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'attendance'
              )
            }
          >
            Attendance
          </button>


          <button
            type="button"
            className={
              activeTab ===
              'leave'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'leave'
              )
            }
          >
            Leave
          </button>


          <button
            type="button"
            className={
              activeTab ===
              'comoff'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'comoff'
              )
            }
          >
            Com-off
          </button>


          <button
            type="button"
            className={
              activeTab ===
              'logs'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'logs'
              )
            }
          >
            Logs
          </button>

        </div>


        <button
          type="button"
          className="reports-refresh-button"
          onClick={() =>
            loadReports(true)
          }
          disabled={
            refreshing
          }
        >
          {refreshing
            ? 'Refreshing...'
            : '↻ Refresh'}
        </button>

      </div>


      {/* =====================================================
          SCROLLABLE CONTENT
      ===================================================== */}

      <div className="reports-content-scroll">

        {errorMessage && (

          <div className="reports-message reports-error">
            {errorMessage}
          </div>

        )}


        {loading ? (

          <div className="reports-loading">
            Loading reports...
          </div>

        ) : (
          <>

            {/* =================================================
                ATTENDANCE
            ================================================= */}

            {activeTab ===
              'attendance' && (

              <section className="reports-tab-section">

                <div className="reports-filter-card">

                  <div className="reports-search">

                    <span>
                      🔍
                    </span>

                    <input
                      type="text"
                      value={
                        attendanceSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setAttendanceSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search employee, code, department or position..."
                    />

                  </div>


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      attendanceFrom
                    }
                    onChange={(
                      event
                    ) =>
                      setAttendanceFrom(
                        event.target.value
                      )
                    }
                    title="From Date"
                  />


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      attendanceTo
                    }
                    min={
                      attendanceFrom ||
                      undefined
                    }
                    onChange={(
                      event
                    ) =>
                      setAttendanceTo(
                        event.target.value
                      )
                    }
                    title="To Date"
                  />


                  <select
                    value={
                      attendanceShift
                    }
                    onChange={(
                      event
                    ) =>
                      setAttendanceShift(
                        event.target.value
                      )
                    }
                  >

                    <option value="all">
                      All Shifts
                    </option>

                    {shiftOptions.map(
                      (shift) => (

                        <option
                          key={
                            shift
                          }
                          value={
                            shift
                          }
                        >
                          {shift}
                        </option>

                      )
                    )}

                  </select>


                  <select
                    value={
                      attendanceStatus
                    }
                    onChange={(
                      event
                    ) =>
                      setAttendanceStatus(
                        event.target.value
                      )
                    }
                  >

                    <option value="all">
                      All Status
                    </option>

                    {attendanceStatusOptions.map(
                      (status) => (

                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {titleCase(
                            status
                          )}
                        </option>

                      )
                    )}

                  </select>


                  <button
                    type="button"
                    className="reports-clear-button"
                    onClick={
                      clearAttendanceFilters
                    }
                  >
                    Clear
                  </button>


                  <button
                    type="button"
                    className="reports-export-button"
                    onClick={
                      exportAttendance
                    }
                  >
                    Export CSV
                  </button>

                </div>


                <div className="reports-table-card">

                  {filteredAttendance.length ===
                    0 ? (

                    <ReportEmpty
                      text="No attendance records found."
                    />

                  ) : (

                    <div className="reports-table-wrap">

                      <table className="reports-table attendance-report-table">

                        <thead>

                          <tr>
                            <th>Employee</th>
                            <th>Duty Date</th>
                            <th>Shift</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th>Breaks</th>
                            <th>Break</th>
                            <th>Work</th>
                            <th>Status</th>
                          </tr>

                        </thead>


                        <tbody>

                          {filteredAttendance.map(
                            (item) => (

                              <tr
                                key={
                                  item.attendance_id
                                }
                              >

                                <td>

                                  <EmployeeCell
                                    firstName={
                                      item.first_name
                                    }
                                    lastName={
                                      item.last_name
                                    }
                                    code={
                                      item.employee_code
                                    }
                                  />

                                </td>


                                <td>
                                  {formatDate(
                                    item.duty_date
                                  )}
                                </td>


                                <td>

                                  <span className="reports-shift-pill">

                                    {item.shift_name ||
                                      '—'}

                                  </span>

                                </td>


                                <td>
                                  {formatTime(
                                    item.time_in
                                  )}
                                </td>


                                <td>
                                  {formatTime(
                                    item.time_out
                                  )}
                                </td>


                                <td>

                                  <span className="reports-count-pill">

                                    {item.break_count ||
                                      0}

                                  </span>

                                </td>


                                <td>
                                  {formatMinutes(
                                    item.total_break_minutes
                                  )}
                                </td>


                                <td>

                                  <strong className="reports-work-value">

                                    {formatMinutes(
                                      item.total_work_minutes
                                    )}

                                  </strong>

                                </td>


                                <td>

                                  <StatusBadge
                                    status={
                                      item.attendance_status
                                    }
                                  />

                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>

              </section>

            )}


            {/* =================================================
                LEAVE
            ================================================= */}

            {activeTab ===
              'leave' && (

              <section className="reports-tab-section">

                <div className="reports-stat-grid reports-stat-grid-four">

                  <ReportStat
                    label="Total Leave"
                    value={
                      leaveSummary.total
                    }
                  />


                  <ReportStat
                    label="Pending"
                    value={
                      leaveSummary.pending
                    }
                    type="orange"
                  />


                  <ReportStat
                    label="Approved"
                    value={
                      leaveSummary.approved
                    }
                    type="green"
                  />


                  <ReportStat
                    label="Sick Leave"
                    value={
                      leaveSummary.sick
                    }
                    type="purple"
                  />

                </div>


                <div className="reports-filter-card">

                  <div className="reports-search">

                    <span>
                      🔍
                    </span>

                    <input
                      type="text"
                      value={
                        leaveSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setLeaveSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search employee, leave type or reason..."
                    />

                  </div>


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      leaveFrom
                    }
                    onChange={(
                      event
                    ) =>
                      setLeaveFrom(
                        event.target.value
                      )
                    }
                  />


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      leaveTo
                    }
                    min={
                      leaveFrom ||
                      undefined
                    }
                    onChange={(
                      event
                    ) =>
                      setLeaveTo(
                        event.target.value
                      )
                    }
                  />


                  <select
                    value={
                      leaveType
                    }
                    onChange={(
                      event
                    ) =>
                      setLeaveType(
                        event.target.value
                      )
                    }
                  >

                    <option value="all">
                      All Types
                    </option>

                    {leaveTypeOptions.map(
                      (type) => (

                        <option
                          key={
                            type
                          }
                          value={
                            type
                          }
                        >
                          {titleCase(
                            type
                          )}
                        </option>

                      )
                    )}

                  </select>


                  <select
                    value={
                      leaveStatus
                    }
                    onChange={(
                      event
                    ) =>
                      setLeaveStatus(
                        event.target.value
                      )
                    }
                  >

                    <option value="all">
                      All Status
                    </option>

                    {leaveStatusOptions.map(
                      (status) => (

                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {titleCase(
                            status
                          )}
                        </option>

                      )
                    )}

                  </select>


                  <button
                    type="button"
                    className="reports-clear-button"
                    onClick={
                      clearLeaveFilters
                    }
                  >
                    Clear
                  </button>


                  <button
                    type="button"
                    className="reports-export-button"
                    onClick={
                      exportLeave
                    }
                  >
                    Export CSV
                  </button>

                </div>


                <div className="reports-table-card">

                  {filteredLeave.length ===
                    0 ? (

                    <ReportEmpty
                      text="No leave records found."
                    />

                  ) : (

                    <div className="reports-table-wrap">

                      <table className="reports-table leave-report-table">

                        <thead>

                          <tr>
                            <th>Employee</th>
                            <th>Type</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Days</th>
                            <th>Duration</th>
                            <th>Reason</th>
                            <th>Document</th>
                            <th>Status</th>
                          </tr>

                        </thead>


                        <tbody>

                          {filteredLeave.map(
                            (item) => (

                              <tr
                                key={
                                  item.leave_id
                                }
                              >

                                <td>

                                  <EmployeeCell
                                    firstName={
                                      item.first_name
                                    }
                                    lastName={
                                      item.last_name
                                    }
                                    code={
                                      item.employee_code
                                    }
                                  />

                                </td>


                                <td>

                                  <span
                                    className={`reports-leave-type reports-leave-${item.leave_type}`}
                                  >
                                    {titleCase(
                                      item.leave_type
                                    )}
                                  </span>

                                </td>


                                <td>
                                  {formatDate(
                                    item.start_date
                                  )}
                                </td>


                                <td>
                                  {formatDate(
                                    item.end_date
                                  )}
                                </td>


                                <td>

                                  <strong className="reports-day-value">

                                    {item.calendar_days ??
                                      calculateCalendarDays(
                                        item.start_date,
                                        item.end_date
                                      )}

                                  </strong>

                                </td>


                                <td>
                                  {titleCase(
                                    item.duration_type
                                  )}
                                </td>


                                <td>

                                  <div
                                    className="reports-truncate"
                                    title={
                                      item.reason ||
                                      ''
                                    }
                                  >
                                    {item.reason ||
                                      '—'}
                                  </div>

                                </td>


                                <td>

                                  {item.attachment_path ? (

                                    <button
                                      type="button"
                                      className="reports-pdf-button"
                                      onClick={() =>
                                        viewLeavePdf(
                                          item
                                        )
                                      }
                                    >
                                      PDF
                                    </button>

                                  ) : (

                                    <span className="reports-muted">
                                      —
                                    </span>

                                  )}

                                </td>


                                <td>

                                  <StatusBadge
                                    status={
                                      item.leave_status
                                    }
                                  />

                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>

              </section>

            )}


            {/* =================================================
                COM-OFF
            ================================================= */}

            {activeTab ===
              'comoff' && (

              <section className="reports-tab-section">

                <div className="reports-section-title">

                  <div>

                    <h2>
                      Employee Com-off Balances
                    </h2>

                    <p>
                      Earned, used, pending and available Com-off balances.
                    </p>

                  </div>


                  <button
                    type="button"
                    className="reports-export-button"
                    onClick={
                      exportComOffBalances
                    }
                  >
                    Export CSV
                  </button>

                </div>


                <div className="reports-single-filter">

                  <div className="reports-search">

                    <span>
                      🔍
                    </span>

                    <input
                      type="text"
                      value={
                        comOffSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setComOffSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search employee, code, department or position..."
                    />

                  </div>


                  {comOffSearch && (

                    <button
                      type="button"
                      className="reports-clear-button"
                      onClick={
                        clearComOffBalanceSearch
                      }
                    >
                      Clear
                    </button>

                  )}

                </div>


                <div className="reports-table-card">

                  {filteredComOffBalances.length ===
                    0 ? (

                    <ReportEmpty
                      text="No Com-off balances found."
                    />

                  ) : (

                    <div className="reports-table-wrap">

                      <table className="reports-table comoff-balance-report-table">

                        <thead>

                          <tr>
                            <th>Employee</th>
                            <th>Department</th>
                            <th>Position</th>
                            <th>Holidays</th>
                            <th>Earned</th>
                            <th>Used</th>
                            <th>Pending</th>
                            <th>Available</th>
                            <th>Latest Holiday</th>
                          </tr>

                        </thead>


                        <tbody>

                          {filteredComOffBalances.map(
                            (item) => (

                              <tr
                                key={
                                  item.employee_id
                                }
                              >

                                <td>

                                  <EmployeeCell
                                    firstName={
                                      item.first_name
                                    }
                                    lastName={
                                      item.last_name
                                    }
                                    code={
                                      item.employee_code
                                    }
                                  />

                                </td>


                                <td>
                                  {item.department ||
                                    '—'}
                                </td>


                                <td>

                                  <div className="reports-truncate">

                                    {item.position ||
                                      '—'}

                                  </div>

                                </td>


                                <td>
                                  {item.eligible_holiday_count ||
                                    0}
                                </td>


                                <td>

                                  <BalancePill
                                    type="earned"
                                    value={
                                      item.earned_days
                                    }
                                  />

                                </td>


                                <td>

                                  <BalancePill
                                    type="used"
                                    value={
                                      item.used_days
                                    }
                                  />

                                </td>


                                <td>

                                  <BalancePill
                                    type="pending"
                                    value={
                                      item.pending_days
                                    }
                                  />

                                </td>


                                <td>

                                  <BalancePill
                                    type="available"
                                    value={
                                      item.available_days
                                    }
                                  />

                                </td>


                                <td>
                                  {formatDate(
                                    item.latest_holiday_date
                                  )}
                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>


                <div className="reports-section-title reports-second-section">

                  <div>

                    <h2>
                      Com-off Request History
                    </h2>

                    <p>
                      Pending, approved, rejected and cancelled requests.
                    </p>

                  </div>


                  <button
                    type="button"
                    className="reports-export-button"
                    onClick={
                      exportComOffRequests
                    }
                  >
                    Export CSV
                  </button>

                </div>


                <div className="reports-filter-card reports-comoff-request-filter">

                  <div className="reports-search">

                    <span>
                      🔍
                    </span>

                    <input
                      type="text"
                      value={
                        comOffRequestSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setComOffRequestSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search employee, code or reason..."
                    />

                  </div>


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      comOffFrom
                    }
                    onChange={(
                      event
                    ) =>
                      setComOffFrom(
                        event.target.value
                      )
                    }
                  />


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      comOffTo
                    }
                    min={
                      comOffFrom ||
                      undefined
                    }
                    onChange={(
                      event
                    ) =>
                      setComOffTo(
                        event.target.value
                      )
                    }
                  />


                  <select
                    value={
                      comOffRequestStatus
                    }
                    onChange={(
                      event
                    ) =>
                      setComOffRequestStatus(
                        event.target.value
                      )
                    }
                  >

                    <option value="all">
                      All Status
                    </option>

                    {comOffStatusOptions.map(
                      (status) => (

                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {titleCase(
                            status
                          )}
                        </option>

                      )
                    )}

                  </select>


                  <button
                    type="button"
                    className="reports-clear-button"
                    onClick={
                      clearComOffRequestFilters
                    }
                  >
                    Clear
                  </button>

                </div>


                <div className="reports-table-card">

                  {filteredComOffRequests.length ===
                    0 ? (

                    <ReportEmpty
                      text="No Com-off request records found."
                    />

                  ) : (

                    <div className="reports-table-wrap">

                      <table className="reports-table comoff-request-report-table">

                        <thead>

                          <tr>
                            <th>Employee</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Days</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Submitted</th>
                          </tr>

                        </thead>


                        <tbody>

                          {filteredComOffRequests.map(
                            (item) => (

                              <tr
                                key={
                                  item.request_id
                                }
                              >

                                <td>

                                  <EmployeeCell
                                    firstName={
                                      item.first_name
                                    }
                                    lastName={
                                      item.last_name
                                    }
                                    code={
                                      item.employee_code
                                    }
                                  />

                                </td>


                                <td>
                                  {formatDate(
                                    item.start_date
                                  )}
                                </td>


                                <td>
                                  {formatDate(
                                    item.end_date
                                  )}
                                </td>


                                <td>

                                  <strong className="reports-day-value">

                                    {formatNumber(
                                      item.requested_days
                                    )}

                                  </strong>

                                </td>


                                <td>

                                  <div
                                    className="reports-truncate"
                                    title={
                                      item.reason ||
                                      ''
                                    }
                                  >
                                    {item.reason ||
                                      '—'}
                                  </div>

                                </td>


                                <td>

                                  <StatusBadge
                                    status={
                                      item.request_status
                                    }
                                  />

                                </td>


                                <td>
                                  {formatDate(
                                    item.created_at
                                      ?.slice(
                                        0,
                                        10
                                      )
                                  )}
                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>

              </section>

            )}


            {/* =================================================
                LOGS
            ================================================= */}

            {activeTab ===
              'logs' && (

              <section className="reports-tab-section">

                <div className="reports-section-title">

                  <div>

                    <h2>
                      Break Logs
                    </h2>

                    <p>
                      Employee Break Start and Break End history.
                    </p>

                  </div>


                  <button
                    type="button"
                    className="reports-export-button"
                    onClick={
                      exportBreakLogs
                    }
                  >
                    Export CSV
                  </button>

                </div>


                <div className="reports-log-filter">

                  <div className="reports-search">

                    <span>
                      🔍
                    </span>

                    <input
                      type="text"
                      value={
                        logSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setLogSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search employee, code, department, position or shift..."
                    />

                  </div>


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      logFrom
                    }
                    onChange={(
                      event
                    ) =>
                      setLogFrom(
                        event.target.value
                      )
                    }
                    title="From Date"
                  />


                  <input
                    className="reports-date-picker"
                    type="date"
                    value={
                      logTo
                    }
                    min={
                      logFrom ||
                      undefined
                    }
                    onChange={(
                      event
                    ) =>
                      setLogTo(
                        event.target.value
                      )
                    }
                    title="To Date"
                  />


                  <select
                    value={
                      logStatus
                    }
                    onChange={(
                      event
                    ) =>
                      setLogStatus(
                        event.target.value
                      )
                    }
                  >

                    <option value="all">
                      All Status
                    </option>

                    <option value="on_break">
                      On Break
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                  </select>


                  <button
                    type="button"
                    className="reports-clear-button"
                    onClick={
                      clearLogFilters
                    }
                  >
                    Clear
                  </button>

                </div>


                <div className="reports-table-card">

                  {filteredBreakLogs.length ===
                    0 ? (

                    <ReportEmpty
                      text="No break logs found."
                    />

                  ) : (

                    <div className="reports-table-wrap">

                      <table className="reports-table break-log-report-table">

                        <thead>

                          <tr>
                            <th>Employee</th>
                            <th>Duty Date</th>
                            <th>Shift</th>
                            <th>Break Start</th>
                            <th>Break End</th>
                            <th>Duration</th>
                            <th>Status</th>
                          </tr>

                        </thead>


                        <tbody>

                          {filteredBreakLogs.map(
                            (item) => {
                              const attendanceRecord =
                                getOne(
                                  item.attendance_records
                                )

                              const employee =
                                getOne(
                                  attendanceRecord?.employees
                                )

                              const shift =
                                getOne(
                                  attendanceRecord?.shifts
                                )

                              const isActive =
                                !item.break_end

                              return (

                                <tr
                                  key={
                                    item.id
                                  }
                                >

                                  <td>

                                    <EmployeeCell
                                      firstName={
                                        employee?.first_name
                                      }
                                      lastName={
                                        employee?.last_name
                                      }
                                      code={
                                        employee?.employee_code
                                      }
                                    />

                                  </td>


                                  <td>
                                    {formatDate(
                                      attendanceRecord?.duty_date
                                    )}
                                  </td>


                                  <td>

                                    <span className="reports-shift-pill">

                                      {shift?.name ||
                                        '—'}

                                    </span>

                                  </td>


                                  <td>

                                    <div className="break-log-time">

                                      <strong>
                                        {formatTime(
                                          item.break_start
                                        )}
                                      </strong>

                                      <small>

                                        {item.break_start
                                          ? new Date(
                                            item.break_start
                                          )
                                            .toLocaleDateString(
                                              'en-US',
                                              {
                                                day: '2-digit',
                                                month: 'short',
                                              }
                                            )
                                          : '—'}

                                      </small>

                                    </div>

                                  </td>


                                  <td>

                                    {item.break_end ? (

                                      <div className="break-log-time">

                                        <strong>
                                          {formatTime(
                                            item.break_end
                                          )}
                                        </strong>

                                        <small>

                                          {new Date(
                                            item.break_end
                                          )
                                            .toLocaleDateString(
                                              'en-US',
                                              {
                                                day: '2-digit',
                                                month: 'short',
                                              }
                                            )}

                                        </small>

                                      </div>

                                    ) : (

                                      <span className="reports-muted">
                                        —
                                      </span>

                                    )}

                                  </td>


                                  <td>

                                    {isActive ? (

                                      <span className="break-log-progress">
                                        In Progress
                                      </span>

                                    ) : (

                                      <strong className="break-log-duration">

                                        {formatMinutes(
                                          item.break_minutes
                                        )}

                                      </strong>

                                    )}

                                  </td>


                                  <td>

                                    <span
                                      className={
                                        isActive
                                          ? 'break-log-status active'
                                          : 'break-log-status completed'
                                      }
                                    >

                                      {isActive
                                        ? 'On Break'
                                        : 'Completed'}

                                    </span>

                                  </td>

                                </tr>

                              )
                            }
                          )}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>

              </section>

            )}

          </>
        )}

      </div>

    </div>
  )
}


// ===========================================================
// STAT
// ===========================================================

function ReportStat({
  label,
  value,
  type = '',
}) {
  return (
    <div
      className={`reports-stat-card ${
        type
          ? `reports-stat-${type}`
          : ''
      }`}
    >

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  )
}


// ===========================================================
// EMPLOYEE
// ===========================================================

function EmployeeCell({
  firstName,
  lastName,
  code,
}) {
  return (
    <div className="reports-employee">

      <div className="reports-avatar">

        {getInitials(
          firstName,
          lastName
        )}

      </div>


      <div>

        <strong>
          {firstName || ''}{' '}
          {lastName || ''}
        </strong>

        <small>
          Code: {code || '—'}
        </small>

      </div>

    </div>
  )
}


// ===========================================================
// STATUS
// ===========================================================

function StatusBadge({
  status,
}) {
  return (
    <span
      className={`reports-status reports-status-${status || 'unknown'}`}
    >
      {titleCase(
        status
      )}
    </span>
  )
}


// ===========================================================
// BALANCE
// ===========================================================

function BalancePill({
  type,
  value,
}) {
  return (
    <span
      className={`reports-balance reports-balance-${type}`}
    >
      {formatNumber(
        value
      )}
    </span>
  )
}


// ===========================================================
// EMPTY
// ===========================================================

function ReportEmpty({
  text,
}) {
  return (
    <div className="reports-empty">

      <div>
        📊
      </div>

      <strong>
        {text}
      </strong>

      <span>
        Try adjusting the report filters.
      </span>

    </div>
  )
}


export default AdminReports