import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createPortal,
} from 'react-dom'

import {
  supabase,
} from '../lib/supabase'

import './AdminComOff.css'


// ===========================================================
// FORMAT DATE
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


// ===========================================================
// FORMAT DATE TIME
// ===========================================================

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

  return date.toLocaleDateString(
    'en-US',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  )
}


// ===========================================================
// FORMAT DAYS
// ===========================================================

function formatDays(value) {
  const number =
    Number(
      value || 0
    )

  if (
    Number.isInteger(number)
  ) {
    return String(number)
  }

  return number.toFixed(1)
}


// ===========================================================
// INITIALS
// ===========================================================

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


// ===========================================================
// ADMIN COM-OFF
// ===========================================================

function AdminComOff() {
  // =========================================================
  // DATA
  // =========================================================

  const [
    entitlements,
    setEntitlements,
  ] = useState([])

  const [
    requests,
    setRequests,
  ] = useState([])


  // =========================================================
  // REQUEST FILTERS
  // =========================================================

  const [
    requestSearchTerm,
    setRequestSearchTerm,
  ] = useState('')

  const [
    requestStatus,
    setRequestStatus,
  ] = useState('pending')


  // =========================================================
  // EMPLOYEE BALANCE FILTER
  // =========================================================

  const [
    employeeSearchTerm,
    setEmployeeSearchTerm,
  ] = useState('')


  // =========================================================
  // UI
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    actionId,
    setActionId,
  ] = useState(null)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    selectedEmployee,
    setSelectedEmployee,
  ] = useState(null)


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadComOffData()
  }, [])


  // =========================================================
  // LOAD ALL DATA
  // =========================================================

  async function loadComOffData() {
    setLoading(true)
    setErrorMessage('')

    try {
      const [
        entitlementResult,
        requestResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'com_off_entitlements'
            )
            .select(`
              id,
              employee_id,
              holiday_id,
              holiday_date,
              shift_id,
              schedule_source,
              entitlement_days,
              status,
              reason,
              earned_at,
              revoked_at,
              created_at,
              updated_at,

              employees (
                id,
                employee_code,
                first_name,
                last_name,
                department,
                position,
                status
              ),

              holidays (
                id,
                name,
                holiday_date,
                description,
                status,
                com_off_eligible,
                com_off_credit
              ),

              shifts (
                id,
                name
              )
            `)
            .order(
              'holiday_date',
              {
                ascending: false,
              }
            ),

          supabase
            .from(
              'com_off_requests'
            )
            .select(`
              id,
              employee_id,
              requested_date,
              start_date,
              end_date,
              requested_days,
              reason,
              status,
              admin_notes,
              approved_at,
              rejected_at,
              cancelled_at,
              created_at,
              updated_at,

              employees (
                id,
                employee_code,
                first_name,
                last_name,
                department,
                position,
                status
              )
            `)
            .order(
              'created_at',
              {
                ascending: false,
              }
            ),
        ])

      if (
        entitlementResult.error
      ) {
        throw entitlementResult.error
      }

      if (
        requestResult.error
      ) {
        throw requestResult.error
      }

      setEntitlements(
        entitlementResult.data ||
        []
      )

      setRequests(
        requestResult.data ||
        []
      )
    } catch (error) {
      console.error(
        'Com-off load error:',
        error
      )

      setErrorMessage(
        `Unable to load Com-off data: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }


  // =========================================================
  // EMPLOYEE SUMMARY
  // =========================================================

  const employeeSummaries =
    useMemo(() => {
      const map =
        new Map()


      // =====================================================
      // ENTITLEMENTS
      // =====================================================

      entitlements.forEach(
        (item) => {
          const employee =
            item.employees

          if (
            !employee ||
            !item.employee_id
          ) {
            return
          }

          if (
            !map.has(
              item.employee_id
            )
          ) {
            map.set(
              item.employee_id,
              {
                employee_id:
                  item.employee_id,

                employee_code:
                  employee.employee_code,

                first_name:
                  employee.first_name,

                last_name:
                  employee.last_name,

                department:
                  employee.department,

                position:
                  employee.position,

                employee_status:
                  employee.status,

                earned_days: 0,
                revoked_days: 0,
                earned_count: 0,
                revoked_count: 0,
                used_days: 0,
                pending_days: 0,
                pending_requests: 0,
                available_days: 0,

                last_holiday_date:
                  null,

                history: [],
                requests: [],
              }
            )
          }

          const summary =
            map.get(
              item.employee_id
            )

          summary.history.push(
            item
          )

          if (
            item.status ===
            'earned'
          ) {
            summary.earned_days +=
              Number(
                item.entitlement_days ||
                0
              )

            summary.earned_count +=
              1

            if (
              !summary.last_holiday_date ||
              item.holiday_date >
                summary.last_holiday_date
            ) {
              summary.last_holiday_date =
                item.holiday_date
            }
          }

          if (
            item.status ===
            'revoked'
          ) {
            summary.revoked_days +=
              Number(
                item.entitlement_days ||
                0
              )

            summary.revoked_count +=
              1
          }
        }
      )


      // =====================================================
      // REQUESTS
      // =====================================================

      requests.forEach(
        (request) => {
          const employee =
            request.employees

          if (
            !employee ||
            !request.employee_id
          ) {
            return
          }

          if (
            !map.has(
              request.employee_id
            )
          ) {
            map.set(
              request.employee_id,
              {
                employee_id:
                  request.employee_id,

                employee_code:
                  employee.employee_code,

                first_name:
                  employee.first_name,

                last_name:
                  employee.last_name,

                department:
                  employee.department,

                position:
                  employee.position,

                employee_status:
                  employee.status,

                earned_days: 0,
                revoked_days: 0,
                earned_count: 0,
                revoked_count: 0,
                used_days: 0,
                pending_days: 0,
                pending_requests: 0,
                available_days: 0,

                last_holiday_date:
                  null,

                history: [],
                requests: [],
              }
            )
          }

          const summary =
            map.get(
              request.employee_id
            )

          summary.requests.push(
            request
          )

          if (
            request.status ===
            'approved'
          ) {
            summary.used_days +=
              Number(
                request.requested_days ||
                0
              )
          }

          if (
            request.status ===
            'pending'
          ) {
            summary.pending_days +=
              Number(
                request.requested_days ||
                0
              )

            summary.pending_requests +=
              1
          }
        }
      )


      // =====================================================
      // AVAILABLE BALANCE
      // Pending does NOT deduct.
      // =====================================================

      map.forEach(
        (summary) => {
          summary.available_days =
            Math.max(
              summary.earned_days -
                summary.used_days,
              0
            )
        }
      )


      return Array
        .from(
          map.values()
        )
        .filter(
          (employee) =>
            employee.earned_days >
              0 ||
            employee.used_days >
              0 ||
            employee.pending_days >
              0
        )
        .sort(
          (
            a,
            b
          ) => {
            const nameA =
              `${a.first_name || ''} ${a.last_name || ''}`

            const nameB =
              `${b.first_name || ''} ${b.last_name || ''}`

            return nameA.localeCompare(
              nameB
            )
          }
        )
    }, [
      entitlements,
      requests,
    ])


  // =========================================================
  // FILTER REQUESTS
  // =========================================================

  const filteredRequests =
    useMemo(() => {
      const keyword =
        requestSearchTerm
          .trim()
          .toLowerCase()

      return requests.filter(
        (request) => {
          if (
            requestStatus !==
              'all' &&
            request.status !==
              requestStatus
          ) {
            return false
          }

          if (keyword) {
            const employee =
              request.employees

            const searchText =
              [
                employee?.employee_code,
                employee?.first_name,
                employee?.last_name,
                employee?.department,
                employee?.position,
                request.reason,
                request.start_date,
                request.end_date,
                request.requested_date,
                request.status,
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

          return true
        }
      )
    }, [
      requests,
      requestSearchTerm,
      requestStatus,
    ])


  // =========================================================
  // FILTER EMPLOYEE BALANCES
  // =========================================================

  const filteredEmployees =
    useMemo(() => {
      const keyword =
        employeeSearchTerm
          .trim()
          .toLowerCase()

      if (!keyword) {
        return employeeSummaries
      }

      return employeeSummaries.filter(
        (employee) => {
          const searchText =
            [
              employee.employee_code,
              employee.first_name,
              employee.last_name,
              employee.department,
              employee.position,
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
      employeeSummaries,
      employeeSearchTerm,
    ])


  // =========================================================
  // STATISTICS
  // =========================================================

  const statistics =
    useMemo(() => {
      const eligibleEmployees =
        employeeSummaries.filter(
          (employee) =>
            employee.earned_days >
            0
        ).length

      const used =
        requests
          .filter(
            (request) =>
              request.status ===
              'approved'
          )
          .reduce(
            (
              total,
              request
            ) =>
              total +
              Number(
                request.requested_days ||
                  0
              ),
            0
          )

      const pending =
        requests.filter(
          (request) =>
            request.status ===
            'pending'
        ).length

      return {
        eligibleEmployees,
        used,
        pending,
      }
    }, [
      employeeSummaries,
      requests,
    ])


  // =========================================================
  // APPROVE REQUEST
  // =========================================================

  async function approveRequest(
    request
  ) {
    const employee =
      request.employees

    const confirmed =
      window.confirm(
        `Approve ${formatDays(
          request.requested_days
        )} Com-off day(s) for ${employee?.first_name || 'this employee'} ${employee?.last_name || ''}?`
      )

    if (!confirmed) {
      return
    }

    setActionId(
      request.id
    )

    setErrorMessage('')
    setSuccessMessage('')

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'approve_com_off_request',
          {
            p_request_id:
              request.id,

            p_admin_notes:
              null,
          }
        )

      if (error) {
        throw error
      }

      if (
        data?.success !== true
      ) {
        throw new Error(
          data?.message ||
          'Unable to approve request.'
        )
      }

      setSuccessMessage(
        data.message ||
        'Com-off request approved successfully.'
      )

      await loadComOffData()
    } catch (error) {
      console.error(
        'Approve Com-off error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to approve request.'
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // REJECT REQUEST
  // =========================================================

  async function rejectRequest(
    request
  ) {
    const notes =
      window.prompt(
        'Optional reason for rejecting this Com-off request:',
        ''
      )

    if (notes === null) {
      return
    }

    setActionId(
      request.id
    )

    setErrorMessage('')
    setSuccessMessage('')

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'reject_com_off_request',
          {
            p_request_id:
              request.id,

            p_admin_notes:
              notes.trim() ||
              null,
          }
        )

      if (error) {
        throw error
      }

      if (
        data?.success !== true
      ) {
        throw new Error(
          data?.message ||
          'Unable to reject request.'
        )
      }

      setSuccessMessage(
        data.message ||
        'Com-off request rejected.'
      )

      await loadComOffData()
    } catch (error) {
      console.error(
        'Reject Com-off error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to reject request.'
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // CANCEL REQUEST
  // =========================================================

  async function cancelRequest(
    request
  ) {
    const notes =
      window.prompt(
        'Optional reason for cancelling this Com-off request:',
        request.admin_notes ||
        ''
      )

    if (notes === null) {
      return
    }

    const confirmed =
      window.confirm(
        'Cancel this Com-off request? If already approved, the used balance will be restored.'
      )

    if (!confirmed) {
      return
    }

    setActionId(
      request.id
    )

    setErrorMessage('')
    setSuccessMessage('')

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'cancel_com_off_request',
          {
            p_request_id:
              request.id,

            p_admin_notes:
              notes.trim() ||
              null,
          }
        )

      if (error) {
        throw error
      }

      if (
        data?.success !== true
      ) {
        throw new Error(
          data?.message ||
          'Unable to cancel request.'
        )
      }

      setSuccessMessage(
        data.message ||
        'Com-off request cancelled.'
      )

      await loadComOffData()
    } catch (error) {
      console.error(
        'Cancel Com-off error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to cancel request.'
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // HISTORY
  // =========================================================

  function openHistory(
    employee
  ) {
    setSelectedEmployee(
      employee
    )
  }


  function closeHistory() {
    setSelectedEmployee(
      null
    )
  }


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="admin-comoff-page">

      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <div className="comoff-stat-grid">

        <ComOffStatistic
          label="Eligible Employees"

          value={
            statistics.eligibleEmployees
          }
        />


        <ComOffStatistic
          label="Used"

          value={
            formatDays(
              statistics.used
            )
          }

          type="used"
        />


        <ComOffStatistic
          label="Pending Requests"

          value={
            statistics.pending
          }

          type="pending"
        />

      </div>


      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {errorMessage && (

        <div className="comoff-message comoff-error">
          {errorMessage}
        </div>

      )}


      {successMessage && (

        <div className="comoff-message comoff-success">
          {successMessage}
        </div>

      )}


      {/* =====================================================
          COM-OFF REQUESTS
      ===================================================== */}

      <section className="comoff-request-section">

        <div className="comoff-section-header">

          <div>

            <h2>
              Com-off Requests
            </h2>

            <p>
              Review employee requests and approve or reject them.
            </p>

          </div>


          <select
            value={
              requestStatus
            }

            onChange={(
              event
            ) =>
              setRequestStatus(
                event.target.value
              )
            }
          >

            <option value="pending">
              Pending
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="cancelled">
              Cancelled
            </option>

            <option value="all">
              All Requests
            </option>

          </select>

        </div>


        {/* REQUEST SEARCH */}

        <div className="comoff-request-filter-bar">

          <div className="comoff-request-search-box">

            <span>
              🔍
            </span>


            <input
              type="text"

              value={
                requestSearchTerm
              }

              onChange={(
                event
              ) =>
                setRequestSearchTerm(
                  event.target.value
                )
              }

              placeholder="Search request by employee name, code, department, position or reason..."
            />

          </div>


          {requestSearchTerm && (

            <button
              type="button"

              className="comoff-request-clear"

              onClick={() =>
                setRequestSearchTerm('')
              }
            >
              Clear
            </button>

          )}

        </div>


        {/* REQUEST TABLE */}

        <div className="comoff-request-card">

          {loading ? (

            <div className="comoff-request-empty">
              Loading requests...
            </div>

          ) : filteredRequests.length ===
            0 ? (

            <div className="comoff-request-empty">

              <strong>

                {requestSearchTerm
                  ? 'No matching requests found'
                  : requestStatus ===
                    'all'
                  ? 'No Com-off requests'
                  : `No ${requestStatus} Com-off requests`}

              </strong>


              <span>

                {requestSearchTerm
                  ? 'Try searching another employee name or code.'
                  : 'Employee requests will appear here automatically.'}

              </span>

            </div>

          ) : (

            <div className="comoff-request-table-wrap">

              <table className="comoff-request-table">

                <thead>

                  <tr>

                    <th>
                      Employee
                    </th>

                    <th>
                      From
                    </th>

                    <th>
                      To
                    </th>

                    <th>
                      Days
                    </th>

                    <th>
                      Reason
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Submitted
                    </th>

                    <th className="request-actions-heading">
                      Actions
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {filteredRequests.map(
                    (request) => {
                      const employee =
                        request.employees

                      return (
                        <tr
                          key={
                            request.id
                          }
                        >

                          <td>

                            <div className="request-employee">

                              <div className="request-avatar">

                                {getInitials(
                                  employee?.first_name,
                                  employee?.last_name
                                )}

                              </div>


                              <div>

                                <strong>

                                  {employee?.first_name ||
                                    'Unknown'}{' '}

                                  {employee?.last_name ||
                                    ''}

                                </strong>


                                <small>

                                  Code:{' '}

                                  {employee?.employee_code ||
                                    '—'}

                                </small>

                              </div>

                            </div>

                          </td>


                          <td>

                            {formatDate(
                              request.start_date ||
                              request.requested_date
                            )}

                          </td>


                          <td>

                            {formatDate(
                              request.end_date ||
                              request.requested_date
                            )}

                          </td>


                          <td>

                            <strong className="request-days">

                              {formatDays(
                                request.requested_days
                              )}

                            </strong>

                          </td>


                          <td>

                            <div
                              className="request-reason"

                              title={
                                request.reason ||
                                ''
                              }
                            >

                              {request.reason ||
                                '—'}

                            </div>

                          </td>


                          <td>

                            <span
                              className={`request-status request-status-${request.status}`}
                            >
                              {request.status}
                            </span>

                          </td>


                          <td>

                            {formatDateTime(
                              request.created_at
                            )}

                          </td>


                          <td>

                            <div className="request-actions">

                              {request.status ===
                                'pending' && (
                                <>

                                  <button
                                    type="button"

                                    className="request-approve"

                                    disabled={
                                      actionId ===
                                      request.id
                                    }

                                    onClick={() =>
                                      approveRequest(
                                        request
                                      )
                                    }
                                  >

                                    {actionId ===
                                    request.id
                                      ? 'Wait...'
                                      : 'Approve'}

                                  </button>


                                  <button
                                    type="button"

                                    className="request-reject"

                                    disabled={
                                      actionId ===
                                      request.id
                                    }

                                    onClick={() =>
                                      rejectRequest(
                                        request
                                      )
                                    }
                                  >
                                    Reject
                                  </button>

                                </>
                              )}


                              {request.status ===
                                'approved' && (

                                <button
                                  type="button"

                                  className="request-cancel"

                                  disabled={
                                    actionId ===
                                    request.id
                                  }

                                  onClick={() =>
                                    cancelRequest(
                                      request
                                    )
                                  }
                                >
                                  Cancel
                                </button>

                              )}


                              {(request.status ===
                                'rejected' ||
                                request.status ===
                                'cancelled') && (

                                <span className="request-no-action">
                                  —
                                </span>

                              )}

                            </div>

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


      {/* =====================================================
          EMPLOYEE BALANCES
      ===================================================== */}

      <section className="comoff-balance-section">

        <div className="comoff-section-header balance-heading">

          <div>

            <h2>
              Employee Balances
            </h2>

            <p>
              Current earned, used, pending and available Com-off.
            </p>

          </div>

        </div>


        {/* EMPLOYEE SEARCH */}

        <div className="comoff-filter-bar">

          <div className="comoff-search-box">

            <span className="comoff-search-icon">
              🔍
            </span>


            <input
              type="text"

              value={
                employeeSearchTerm
              }

              onChange={(
                event
              ) =>
                setEmployeeSearchTerm(
                  event.target.value
                )
              }

              placeholder="Search employee code, name, department or position..."
            />

          </div>


          {employeeSearchTerm && (

            <button
              type="button"

              className="comoff-clear-button"

              onClick={() =>
                setEmployeeSearchTerm('')
              }
            >
              Clear
            </button>

          )}

        </div>


        {/* EMPLOYEE BALANCE TABLE */}

        <div className="comoff-table-card">

          {loading ? (

            <div className="comoff-empty-state">
              Loading Com-off balances...
            </div>

          ) : filteredEmployees.length ===
            0 ? (

            <div className="comoff-empty-state">

              <div className="comoff-empty-icon">
                ↻
              </div>

              <strong>
                No employees found
              </strong>

            </div>

          ) : (

            <div className="comoff-table-scroll">

              <table className="comoff-table">

                <thead>

                  <tr>

                    <th>
                      Employee
                    </th>

                    <th>
                      Department
                    </th>

                    <th>
                      Position
                    </th>

                    <th>
                      Eligible Holidays
                    </th>

                    <th>
                      Earned
                    </th>

                    <th>
                      Used
                    </th>

                    <th>
                      Pending
                    </th>

                    <th>
                      Available
                    </th>

                    <th>
                      Latest Holiday
                    </th>

                    <th className="comoff-actions-heading">
                      Actions
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {filteredEmployees.map(
                    (employee) => (

                      <tr
                        key={
                          employee.employee_id
                        }
                      >

                        <td>

                          <div className="comoff-employee-cell">

                            <div className="comoff-avatar">

                              {getInitials(
                                employee.first_name,
                                employee.last_name
                              )}

                            </div>


                            <div className="comoff-employee-info">

                              <strong>

                                {employee.first_name}{' '}
                                {employee.last_name}

                              </strong>


                              <small>

                                Code:{' '}

                                {employee.employee_code}

                              </small>

                            </div>

                          </div>

                        </td>


                        <td>

                          <div className="comoff-cell-text">
                            {employee.department ||
                              '—'}
                          </div>

                        </td>


                        <td>

                          <div className="comoff-cell-text">
                            {employee.position ||
                              '—'}
                          </div>

                        </td>


                        <td>

                          <div className="comoff-holiday-count">

                            <strong>
                              {employee.earned_count}
                            </strong>

                            <span>

                              {employee.earned_count ===
                              1
                                ? 'holiday'
                                : 'holidays'}

                            </span>

                          </div>

                        </td>


                        <td>

                          <span className="comoff-balance earned">

                            {formatDays(
                              employee.earned_days
                            )}

                          </span>

                        </td>


                        <td>

                          <span className="comoff-balance used">

                            {formatDays(
                              employee.used_days
                            )}

                          </span>

                        </td>


                        <td>

                          <span className="comoff-balance pending">

                            {formatDays(
                              employee.pending_days
                            )}

                          </span>

                        </td>


                        <td>

                          <span className="comoff-balance available">

                            {formatDays(
                              employee.available_days
                            )}

                          </span>

                        </td>


                        <td>

                          <div className="comoff-latest-date">

                            {formatDate(
                              employee.last_holiday_date
                            )}

                          </div>

                        </td>


                        <td>

                          <div className="comoff-actions">

                            <button
                              type="button"

                              className="comoff-history-button"

                              onClick={() =>
                                openHistory(
                                  employee
                                )
                              }
                            >
                              View History
                            </button>

                          </div>

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


      {/* =====================================================
          HISTORY MODAL
      ===================================================== */}

      {selectedEmployee &&
        createPortal(

          <ComOffHistoryModal
            employee={
              selectedEmployee
            }

            onClose={
              closeHistory
            }
          />,

          document.body
        )
      }

    </div>
  )
}


// ===========================================================
// STATISTIC CARD
// ===========================================================

function ComOffStatistic({
  label,
  value,
  type = '',
}) {
  return (
    <div
      className={`comoff-stat-card ${
        type
          ? `comoff-stat-${type}`
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
// HISTORY MODAL
// ===========================================================

function ComOffHistoryModal({
  employee,
  onClose,
}) {
  const entitlementHistory =
    [...employee.history]
      .sort(
        (
          a,
          b
        ) =>
          String(
            b.holiday_date
          ).localeCompare(
            String(
              a.holiday_date
            )
          )
      )


  const requestHistory =
    [...employee.requests]
      .sort(
        (
          a,
          b
        ) =>
          String(
            b.created_at
          ).localeCompare(
            String(
              a.created_at
            )
          )
      )


  return (
    <div className="comoff-modal-overlay">

      <div className="comoff-modal">

        <div className="comoff-modal-header">

          <div>

            <h2>
              Com-off History
            </h2>

            <p>

              {employee.first_name}{' '}
              {employee.last_name}

              {' • '}

              Employee Code:{' '}

              {employee.employee_code}

            </p>

          </div>


          <button
            type="button"

            className="comoff-modal-close"

            onClick={
              onClose
            }
          >
            ×
          </button>

        </div>


        {/* BALANCE */}

        <div className="comoff-history-balance">

          <div>

            <span>
              Earned
            </span>

            <strong>
              {formatDays(
                employee.earned_days
              )}
            </strong>

          </div>


          <div>

            <span>
              Used
            </span>

            <strong>
              {formatDays(
                employee.used_days
              )}
            </strong>

          </div>


          <div>

            <span>
              Pending
            </span>

            <strong>
              {formatDays(
                employee.pending_days
              )}
            </strong>

          </div>


          <div>

            <span>
              Available
            </span>

            <strong className="available">
              {formatDays(
                employee.available_days
              )}
            </strong>

          </div>

        </div>


        {/* CONTENT */}

        <div className="comoff-modal-content">

          {/* REQUEST HISTORY */}

          <div className="comoff-history-section">

            <h3>
              Request History
            </h3>


            {requestHistory.length ===
            0 ? (

              <div className="history-empty">
                No Com-off requests yet.
              </div>

            ) : (

              requestHistory.map(
                (request) => (

                  <div
                    key={
                      request.id
                    }

                    className="comoff-request-history-item"
                  >

                    <div>

                      <strong>

                        {formatDate(
                          request.start_date ||
                          request.requested_date
                        )}


                        {(
                          request.end_date &&
                          request.end_date !==
                            request.start_date
                        ) && (
                          <>
                            {' → '}

                            {formatDate(
                              request.end_date
                            )}
                          </>
                        )}

                      </strong>


                      <small>

                        {formatDays(
                          request.requested_days
                        )}{' '}

                        day(s)

                      </small>

                    </div>


                    <span
                      className={`request-status request-status-${request.status}`}
                    >
                      {request.status}
                    </span>

                  </div>

                )
              )

            )}

          </div>


          {/* ENTITLEMENT HISTORY */}

          <div className="comoff-history-section">

            <h3>
              Entitlement History
            </h3>


            {entitlementHistory.length ===
            0 ? (

              <div className="history-empty">
                No entitlement history.
              </div>

            ) : (

              entitlementHistory.map(
                (item) => {
                  const holiday =
                    item.holidays

                  const shift =
                    item.shifts

                  return (
                    <div
                      key={
                        item.id
                      }

                      className="comoff-history-item"
                    >

                      <div className="comoff-history-main">

                        <strong>

                          {holiday?.name ||
                            'Public Holiday'}

                        </strong>


                        <span>

                          {formatDate(
                            item.holiday_date
                          )}

                        </span>

                      </div>


                      <div className="comoff-history-shift">

                        <span>
                          Shift
                        </span>

                        <strong>

                          {shift?.name ||
                            'Scheduled'}

                        </strong>

                      </div>


                      <div className="comoff-history-credit">

                        <span>
                          Credit
                        </span>

                        <strong>

                          {item.status ===
                          'earned'
                            ? '+'
                            : ''}

                          {formatDays(
                            item.entitlement_days
                          )}

                        </strong>

                      </div>


                      <span
                        className={`comoff-history-status ${item.status}`}
                      >
                        {item.status}
                      </span>

                    </div>
                  )
                }
              )

            )}

          </div>

        </div>


        {/* FOOTER */}

        <div className="comoff-modal-footer">

          <button
            type="button"

            onClick={
              onClose
            }
          >
            Close
          </button>

        </div>

      </div>

    </div>
  )
}


export default AdminComOff