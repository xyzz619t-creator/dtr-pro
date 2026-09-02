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

import './AdminHolidays.css'


// ===========================================================
// OPTIONS
// ===========================================================

const STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Active',
  },
  {
    value: 'inactive',
    label: 'Inactive',
  },
]


const CREDIT_OPTIONS = [
  {
    value: '1.00',
    label: '1 Day',
  },
  {
    value: '0.50',
    label: '0.5 Day',
  },
]


// ===========================================================
// EMPTY FORM
// ===========================================================

function createEmptyForm() {
  return {
    name: '',
    start_date: '',
    end_date: '',

    company_closed: false,

    com_off_eligible: true,
    com_off_credit: '1.00',

    status: 'active',

    description: '',
  }
}


// ===========================================================
// DATE HELPERS
// ===========================================================

function getLocalDateString(
  date = new Date()
) {
  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    )

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    )

  return `${year}-${month}-${day}`
}


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


function buildDateRange(
  startDate,
  endDate
) {
  if (!startDate) {
    return []
  }

  const effectiveEnd =
    endDate ||
    startDate

  const start =
    new Date(
      `${startDate}T00:00:00`
    )

  const end =
    new Date(
      `${effectiveEnd}T00:00:00`
    )

  const dates = []

  const current =
    new Date(start)

  while (
    current <= end
  ) {
    dates.push(
      getLocalDateString(
        current
      )
    )

    current.setDate(
      current.getDate() + 1
    )
  }

  return dates
}


// ===========================================================
// ADMIN HOLIDAYS
// ===========================================================

function AdminHolidays() {
  // =========================================================
  // DATA
  // =========================================================

  const [
    holidays,
    setHolidays,
  ] = useState([])

  const [
    entitlements,
    setEntitlements,
  ] = useState([])


  // =========================================================
  // FILTERS
  // =========================================================

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('')

  const [
    yearFilter,
    setYearFilter,
  ] = useState(
    String(
      new Date()
        .getFullYear()
    )
  )

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('all')


  // =========================================================
  // UI STATE
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    syncingId,
    setSyncingId,
  ] = useState(null)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false)

  const [
    editingHoliday,
    setEditingHoliday,
  ] = useState(null)

  const [
    form,
    setForm,
  ] = useState(
    createEmptyForm()
  )


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadData()
  }, [])


  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData() {
    setLoading(true)
    setErrorMessage('')

    try {
      const [
        holidayResult,
        entitlementResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'holidays'
            )
            .select(`
              id,
              holiday_date,
              name,
              description,
              company_closed,
              status,
              created_at,
              updated_at,
              com_off_eligible,
              com_off_credit
            `)
            .order(
              'holiday_date',
              {
                ascending: true,
              }
            ),

          supabase
            .from(
              'com_off_entitlements'
            )
            .select(`
              id,
              employee_id,
              holiday_id,
              holiday_date,
              entitlement_days,
              status
            `),
        ])

      if (
        holidayResult.error
      ) {
        throw holidayResult.error
      }

      if (
        entitlementResult.error
      ) {
        throw entitlementResult.error
      }

      setHolidays(
        holidayResult.data ||
        []
      )

      setEntitlements(
        entitlementResult.data ||
        []
      )
    } catch (error) {
      console.error(
        'Holiday load error:',
        error
      )

      setErrorMessage(
        `Unable to load holidays: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }


  // =========================================================
  // AVAILABLE YEARS
  // =========================================================

  const availableYears =
    useMemo(() => {
      const currentYear =
        new Date()
          .getFullYear()

      const years =
        new Set([
          String(
            currentYear - 1
          ),

          String(
            currentYear
          ),

          String(
            currentYear + 1
          ),
        ])

      holidays.forEach(
        (holiday) => {
          if (
            holiday.holiday_date
          ) {
            years.add(
              holiday.holiday_date.substring(
                0,
                4
              )
            )
          }
        }
      )

      return Array
        .from(years)
        .sort()
    }, [
      holidays,
    ])


  // =========================================================
  // ENTITLEMENT MAP
  // =========================================================

  const entitlementMap =
    useMemo(() => {
      const map =
        new Map()

      entitlements.forEach(
        (item) => {
          if (
            !map.has(
              item.holiday_id
            )
          ) {
            map.set(
              item.holiday_id,
              {
                earnedEmployees: 0,
                revokedEmployees: 0,
                earnedDays: 0,
              }
            )
          }

          const summary =
            map.get(
              item.holiday_id
            )

          if (
            item.status ===
            'earned'
          ) {
            summary.earnedEmployees +=
              1

            summary.earnedDays +=
              Number(
                item.entitlement_days ||
                0
              )
          }

          if (
            item.status ===
            'revoked'
          ) {
            summary.revokedEmployees +=
              1
          }
        }
      )

      return map
    }, [
      entitlements,
    ])


  // =========================================================
  // FILTERED HOLIDAYS
  // =========================================================

  const filteredHolidays =
    useMemo(() => {
      const keyword =
        searchTerm
          .trim()
          .toLowerCase()

      return holidays.filter(
        (holiday) => {
          // SEARCH

          if (keyword) {
            const searchText =
              [
                holiday.name,
                holiday.holiday_date,
                holiday.description,
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

          // YEAR

          if (
            yearFilter !==
              'all' &&
            !String(
              holiday.holiday_date ||
              ''
            ).startsWith(
              yearFilter
            )
          ) {
            return false
          }

          // STATUS

          if (
            statusFilter !==
              'all' &&
            holiday.status !==
              statusFilter
          ) {
            return false
          }

          return true
        }
      )
    }, [
      holidays,
      searchTerm,
      yearFilter,
      statusFilter,
    ])


  // =========================================================
  // STATISTICS
  // =========================================================

  const statistics =
    useMemo(() => {
      const today =
        getLocalDateString()

      const selected =
        yearFilter ===
        'all'
          ? holidays
          : holidays.filter(
              (holiday) =>
                String(
                  holiday.holiday_date ||
                  ''
                ).startsWith(
                  yearFilter
                )
            )

      const active =
        selected.filter(
          (holiday) =>
            holiday.status ===
            'active'
        )

      const upcoming =
        active.filter(
          (holiday) =>
            holiday.holiday_date >=
            today
        ).length

      const eligible =
        active.filter(
          (holiday) =>
            holiday.com_off_eligible ===
            true
        )

      const totalCredits =
        eligible.reduce(
          (
            total,
            holiday
          ) =>
            total +
            Number(
              holiday.com_off_credit ||
              0
            ),
          0
        )

      return {
        total:
          selected.length,

        active:
          active.length,

        upcoming,

        totalCredits,
      }
    }, [
      holidays,
      yearFilter,
    ])


  // =========================================================
  // UPDATE FORM
  // =========================================================

  function updateForm(
    field,
    value
  ) {
    setForm(
      (previous) => {
        const next = {
          ...previous,

          [field]:
            value,
        }

        if (
          field ===
          'start_date'
        ) {
          if (
            !next.end_date ||
            next.end_date <
              value
          ) {
            next.end_date =
              value
          }
        }

        return next
      }
    )
  }


  // =========================================================
  // OPEN ADD MODAL
  // =========================================================

  function openAddModal() {
    setEditingHoliday(
      null
    )

    setForm(
      createEmptyForm()
    )

    setMessage('')
    setErrorMessage('')

    setModalOpen(true)
  }


  // =========================================================
  // OPEN EDIT MODAL
  // =========================================================

  function openEditModal(
    holiday
  ) {
    setEditingHoliday(
      holiday
    )

    setForm({
      name:
        holiday.name ||
        '',

      start_date:
        holiday.holiday_date ||
        '',

      end_date:
        holiday.holiday_date ||
        '',

      company_closed:
        Boolean(
          holiday.company_closed
        ),

      com_off_eligible:
        Boolean(
          holiday.com_off_eligible
        ),

      com_off_credit:
        Number(
          holiday.com_off_credit ??
          1
        ).toFixed(
          2
        ),

      status:
        holiday.status ||
        'active',

      description:
        holiday.description ||
        '',
    })

    setMessage('')
    setErrorMessage('')

    setModalOpen(true)
  }


  // =========================================================
  // CLOSE MODAL
  // =========================================================

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)

    setEditingHoliday(
      null
    )

    setForm(
      createEmptyForm()
    )

    setErrorMessage('')
  }


  // =========================================================
  // VALIDATE
  // =========================================================

  function validateForm() {
    if (
      !form.name.trim()
    ) {
      return 'Holiday name is required.'
    }

    if (
      !form.start_date
    ) {
      return 'Holiday date is required.'
    }

    if (
      !editingHoliday &&
      form.end_date &&
      form.end_date <
        form.start_date
    ) {
      return 'End date cannot be before start date.'
    }

    const credit =
      Number(
        form.com_off_credit
      )

    if (
      form.com_off_eligible &&
      (
        Number.isNaN(
          credit
        ) ||
        credit < 0 ||
        credit > 1
      )
    ) {
      return 'Com-off credit must be between 0 and 1 day.'
    }

    return ''
  }


  // =========================================================
  // DUPLICATE DATE CHECK
  // =========================================================

  function findDuplicateDates(
    dates
  ) {
    return dates.filter(
      (date) =>
        holidays.some(
          (holiday) =>
            holiday.holiday_date ===
              date &&
            holiday.id !==
              editingHoliday?.id
        )
    )
  }


  // =========================================================
  // SAVE HOLIDAY
  // =========================================================

  async function saveHoliday() {
    const validationError =
      validateForm()

    if (
      validationError
    ) {
      setErrorMessage(
        validationError
      )

      return
    }

    setSaving(true)
    setErrorMessage('')
    setMessage('')

    try {
      // =====================================================
      // EDIT
      // =====================================================

      if (
        editingHoliday
      ) {
        const duplicateDates =
          findDuplicateDates([
            form.start_date,
          ])

        if (
          duplicateDates.length >
          0
        ) {
          throw new Error(
            `A holiday already exists on ${formatDate(
              duplicateDates[0]
            )}.`
          )
        }

        const payload = {
          name:
            form.name.trim(),

          holiday_date:
            form.start_date,

          description:
            form.description
              .trim() ||
            null,

          company_closed:
            Boolean(
              form.company_closed
            ),

          com_off_eligible:
            Boolean(
              form.com_off_eligible
            ),

          com_off_credit:
            form.com_off_eligible
              ? Number(
                  form.com_off_credit
                )
              : 0,

          status:
            form.status,

          updated_at:
            new Date()
              .toISOString(),
        }

        const {
          error,
        } =
          await supabase
            .from(
              'holidays'
            )
            .update(
              payload
            )
            .eq(
              'id',
              editingHoliday.id
            )

        if (error) {
          throw error
        }

        setMessage(
          'Holiday updated successfully.'
        )
      }

      // =====================================================
      // ADD
      // =====================================================

      else {
        const dates =
          buildDateRange(
            form.start_date,

            form.end_date ||
            form.start_date
          )

        const duplicateDates =
          findDuplicateDates(
            dates
          )

        if (
          duplicateDates.length >
          0
        ) {
          throw new Error(
            `A holiday already exists on ${formatDate(
              duplicateDates[0]
            )}.`
          )
        }

        const payload =
          dates.map(
            (
              holidayDate
            ) => ({
              name:
                form.name.trim(),

              holiday_date:
                holidayDate,

              description:
                form.description
                  .trim() ||
                null,

              company_closed:
                Boolean(
                  form.company_closed
                ),

              com_off_eligible:
                Boolean(
                  form.com_off_eligible
                ),

              com_off_credit:
                form.com_off_eligible
                  ? Number(
                      form.com_off_credit
                    )
                  : 0,

              status:
                form.status,

              updated_at:
                new Date()
                  .toISOString(),
            })
          )

        const {
          error,
        } =
          await supabase
            .from(
              'holidays'
            )
            .insert(
              payload
            )

        if (error) {
          throw error
        }

        if (
          dates.length ===
          1
        ) {
          setMessage(
            'Holiday added successfully.'
          )
        } else {
          setMessage(
            `${dates.length} holiday days added successfully.`
          )
        }
      }

      setModalOpen(false)

      setEditingHoliday(
        null
      )

      setForm(
        createEmptyForm()
      )

      await loadData()
    } catch (error) {
      console.error(
        'Holiday save error:',
        error
      )

      setErrorMessage(
        `Unable to save holiday: ${error.message}`
      )
    } finally {
      setSaving(false)
    }
  }


  // =========================================================
  // DELETE HOLIDAY
  // =========================================================

  async function deleteHoliday(
    holiday
  ) {
    const confirmed =
      window.confirm(
        `Delete "${holiday.name}" on ${formatDate(
          holiday.holiday_date
        )}?`
      )

    if (!confirmed) {
      return
    }

    setErrorMessage('')
    setMessage('')

    try {
      const {
        error,
      } =
        await supabase
          .from(
            'holidays'
          )
          .delete()
          .eq(
            'id',
            holiday.id
          )

      if (error) {
        throw error
      }

      setMessage(
        'Holiday deleted.'
      )

      await loadData()
    } catch (error) {
      console.error(
        'Holiday delete error:',
        error
      )

      setErrorMessage(
        `Unable to delete holiday: ${error.message}`
      )
    }
  }


  // =========================================================
  // SYNC HOLIDAY
  // =========================================================

  async function syncHoliday(
    holiday
  ) {
    setSyncingId(
      holiday.id
    )

    setMessage('')
    setErrorMessage('')

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'sync_holiday_com_off_entitlements',
          {
            p_holiday_id:
              holiday.id,
          }
        )

      if (error) {
        throw error
      }

      if (
        data?.success ===
        false
      ) {
        throw new Error(
          data.message ||
          'Unable to synchronize holiday.'
        )
      }

      setMessage(
        `Com-off synchronized. ${data?.earned ?? 0} employee(s) entitled.`
      )

      await loadData()
    } catch (error) {
      console.error(
        'Holiday sync error:',
        error
      )

      setErrorMessage(
        `Unable to synchronize holiday: ${error.message}`
      )
    } finally {
      setSyncingId(
        null
      )
    }
  }


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="admin-holidays-page">

      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <div className="holiday-stat-grid">

        <HolidayStatistic
          label="Total Holiday Days"

          value={
            statistics.total
          }
        />


        <HolidayStatistic
          label="Active"

          value={
            statistics.active
          }

          type="active"
        />


        <HolidayStatistic
          label="Upcoming"

          value={
            statistics.upcoming
          }

          type="upcoming"
        />


        <HolidayStatistic
          label="Com-off Days"

          value={
            statistics
              .totalCredits
              .toFixed(1)
          }

          type="credit"
        />

      </div>


      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {errorMessage &&
        !modalOpen && (

          <div className="holiday-message holiday-error">
            {errorMessage}
          </div>

        )}


      {message && (

        <div className="holiday-message holiday-success">
          {message}
        </div>

      )}


      {/* =====================================================
          FILTER BAR
      ===================================================== */}

      <div className="holiday-filter-bar">

        {/* SEARCH */}

        <div className="holiday-search-box">

          <span>
            🔍
          </span>


          <input
            type="text"

            value={
              searchTerm
            }

            onChange={(
              event
            ) =>
              setSearchTerm(
                event.target.value
              )
            }

            placeholder="Search holiday..."
          />

        </div>


        {/* YEAR */}

        <select
          value={
            yearFilter
          }

          onChange={(
            event
          ) =>
            setYearFilter(
              event.target.value
            )
          }
        >

          <option value="all">
            All Years
          </option>


          {availableYears.map(
            (year) => (

              <option
                key={
                  year
                }

                value={
                  year
                }
              >
                {year}
              </option>

            )
          )}

        </select>


        {/* STATUS */}

        <select
          value={
            statusFilter
          }

          onChange={(
            event
          ) =>
            setStatusFilter(
              event.target.value
            )
          }
        >

          <option value="all">
            All Status
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>

        </select>


        {/* ADD HOLIDAY */}

        <button
          type="button"

          className="holiday-add-button"

          onClick={
            openAddModal
          }
        >
          + Add Holiday
        </button>

      </div>


      {/* =====================================================
          TABLE
      ===================================================== */}

      <div className="holiday-table-card">

        {loading ? (

          <div className="holiday-empty-state">
            Loading holidays...
          </div>

        ) : filteredHolidays.length ===
          0 ? (

          <div className="holiday-empty-state">

            <div className="holiday-empty-icon">
              ★
            </div>


            <strong>
              No holidays found
            </strong>


            <span>
              Add a public holiday to begin.
            </span>

          </div>

        ) : (

          <div className="holiday-table-scroll">

            <table className="holiday-table">

              <thead>

                <tr>

                  <th>
                    Date
                  </th>

                  <th>
                    Holiday
                  </th>

                  <th>
                    Company
                  </th>

                  <th>
                    Com-off
                  </th>

                  <th>
                    Credit
                  </th>

                  <th>
                    Entitled Employees
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredHolidays.map(
                  (holiday) => {
                    const summary =
                      entitlementMap.get(
                        holiday.id
                      ) || {
                        earnedEmployees: 0,
                        revokedEmployees: 0,
                        earnedDays: 0,
                      }

                    return (
                      <tr
                        key={
                          holiday.id
                        }
                      >

                        {/* DATE */}

                        <td>

                          <strong>
                            {formatDate(
                              holiday.holiday_date
                            )}
                          </strong>

                        </td>


                        {/* HOLIDAY */}

                        <td>

                          <div className="holiday-name-cell">

                            <strong>
                              {holiday.name}
                            </strong>


                            {holiday.description && (

                              <small
                                title={
                                  holiday.description
                                }
                              >
                                {holiday.description}
                              </small>

                            )}

                          </div>

                        </td>


                        {/* COMPANY */}

                        <td>

                          <span
                            className={
                              holiday.company_closed
                                ? 'holiday-company-status closed'
                                : 'holiday-company-status open'
                            }
                          >

                            {holiday.company_closed
                              ? 'Closed'
                              : 'Open'}

                          </span>

                        </td>


                        {/* COM-OFF */}

                        <td>

                          <span
                            className={
                              holiday.com_off_eligible
                                ? 'holiday-comoff-status eligible'
                                : 'holiday-comoff-status not-eligible'
                            }
                          >

                            {holiday.com_off_eligible
                              ? 'Eligible'
                              : 'Not Eligible'}

                          </span>

                        </td>


                        {/* CREDIT */}

                        <td>

                          {holiday.com_off_eligible ? (

                            <strong className="holiday-credit-value">

                              +

                              {Number(
                                holiday.com_off_credit ||
                                0
                              ).toFixed(
                                Number(
                                  holiday.com_off_credit
                                ) % 1 ===
                                  0
                                  ? 0
                                  : 1
                              )}

                              {' Day'}

                            </strong>

                          ) : (
                            '—'
                          )}

                        </td>


                        {/* ENTITLED EMPLOYEES */}

                        <td>

                          <div className="holiday-entitlement-cell">

                            <strong>
                              {
                                summary
                                  .earnedEmployees
                              }
                            </strong>


                            <span>

                              {summary
                                .earnedEmployees ===
                              1
                                ? 'employee'
                                : 'employees'}

                            </span>


                            {summary
                              .revokedEmployees >
                              0 && (

                              <small>

                                {
                                  summary
                                    .revokedEmployees
                                }{' '}
                                revoked

                              </small>

                            )}

                          </div>

                        </td>


                        {/* STATUS */}

                        <td>

                          <span
                            className={`holiday-status holiday-status-${holiday.status}`}
                          >
                            {holiday.status}
                          </span>

                        </td>


                        {/* ACTIONS */}

                        <td>

                          <div className="holiday-actions">

                            <button
                              type="button"

                              className="holiday-sync-button"

                              onClick={() =>
                                syncHoliday(
                                  holiday
                                )
                              }

                              disabled={
                                syncingId ===
                                holiday.id
                              }
                            >

                              {syncingId ===
                              holiday.id
                                ? 'Syncing...'
                                : 'Sync'}

                            </button>


                            <button
                              type="button"

                              className="holiday-edit-button"

                              onClick={() =>
                                openEditModal(
                                  holiday
                                )
                              }
                            >
                              Edit
                            </button>


                            <button
                              type="button"

                              className="holiday-delete-button"

                              onClick={() =>
                                deleteHoliday(
                                  holiday
                                )
                              }
                            >
                              Delete
                            </button>

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


      {/* =====================================================
          MODAL
      ===================================================== */}

      {modalOpen &&
        createPortal(

          <div className="holiday-modal-overlay">

            <div className="holiday-modal">

              {/* HEADER */}

              <div className="holiday-modal-header">

                <div>

                  <h2>

                    {editingHoliday
                      ? 'Edit Holiday'
                      : 'Add Holiday'}

                  </h2>


                  <p>

                    {editingHoliday
                      ? 'Update holiday and Com-off settings.'
                      : 'Create one or multiple public holiday days and automatically calculate employee Com-off entitlement.'}

                  </p>

                </div>


                <button
                  type="button"

                  className="holiday-modal-close"

                  onClick={
                    closeModal
                  }

                  disabled={
                    saving
                  }
                >
                  ×
                </button>

              </div>


              {/* BODY */}

              <div className="holiday-modal-body">

                {/* HOLIDAY NAME */}

                <div className="holiday-form-group holiday-form-full">

                  <label>
                    Holiday Name
                    <span>*</span>
                  </label>


                  <input
                    type="text"

                    value={
                      form.name
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'name',
                        event.target.value
                      )
                    }

                    placeholder="e.g. National Day"
                  />

                </div>


                {/* START DATE */}

                <div className="holiday-form-group">

                  <label>

                    {editingHoliday
                      ? 'Holiday Date'
                      : 'Start Date'}

                    <span>*</span>

                  </label>


                  <input
                    type="date"

                    value={
                      form.start_date
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'start_date',
                        event.target.value
                      )
                    }
                  />

                </div>


                {/* END DATE */}

                {!editingHoliday && (

                  <div className="holiday-form-group">

                    <label>
                      End Date
                    </label>


                    <input
                      type="date"

                      min={
                        form.start_date ||
                        undefined
                      }

                      value={
                        form.end_date
                      }

                      onChange={(
                        event
                      ) =>
                        updateForm(
                          'end_date',
                          event.target.value
                        )
                      }
                    />

                  </div>

                )}


                {/* STATUS */}

                <div className="holiday-form-group">

                  <label>
                    Status
                    <span>*</span>
                  </label>


                  <select
                    value={
                      form.status
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'status',
                        event.target.value
                      )
                    }
                  >

                    {STATUS_OPTIONS.map(
                      (item) => (

                        <option
                          key={
                            item.value
                          }

                          value={
                            item.value
                          }
                        >
                          {item.label}
                        </option>

                      )
                    )}

                  </select>

                </div>


                {/* CREDIT */}

                <div className="holiday-form-group">

                  <label>
                    Com-off Credit
                  </label>


                  <select
                    value={
                      form.com_off_credit
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'com_off_credit',
                        event.target.value
                      )
                    }

                    disabled={
                      !form.com_off_eligible
                    }
                  >

                    {CREDIT_OPTIONS.map(
                      (item) => (

                        <option
                          key={
                            item.value
                          }

                          value={
                            item.value
                          }
                        >
                          {item.label}
                        </option>

                      )
                    )}

                  </select>

                </div>


                {/* COMPANY CLOSED */}

                <div className="holiday-toggle-card">

                  <div>

                    <strong>
                      Company Closed
                    </strong>


                    <span>
                      Employees cannot use DTR when enabled.
                    </span>

                  </div>


                  <label className="holiday-switch">

                    <input
                      type="checkbox"

                      checked={
                        form.company_closed
                      }

                      onChange={(
                        event
                      ) =>
                        updateForm(
                          'company_closed',
                          event.target.checked
                        )
                      }
                    />


                    <span className="holiday-switch-slider" />

                  </label>

                </div>


                {/* COM-OFF ELIGIBLE */}

                <div className="holiday-toggle-card">

                  <div>

                    <strong>
                      Com-off Eligible
                    </strong>


                    <span>
                      Only employees scheduled on each holiday date earn Com-off.
                    </span>

                  </div>


                  <label className="holiday-switch">

                    <input
                      type="checkbox"

                      checked={
                        form.com_off_eligible
                      }

                      onChange={(
                        event
                      ) =>
                        updateForm(
                          'com_off_eligible',
                          event.target.checked
                        )
                      }
                    />


                    <span className="holiday-switch-slider" />

                  </label>

                </div>


                {/* AUTOMATIC RULE */}

                <div className="holiday-auto-rule">

                  <div className="holiday-auto-rule-icon">
                    ⚡
                  </div>


                  <div>

                    <strong>
                      Automatic Schedule Check
                    </strong>


                    <p>
                      Each holiday date is checked separately against every employee&apos;s schedule. Scheduled employees earn the selected Com-off credit. Employees who are OFF receive no entitlement.
                    </p>

                  </div>

                </div>


                {/* DESCRIPTION */}

                <div className="holiday-form-group holiday-form-full">

                  <label>
                    Description
                  </label>


                  <textarea
                    rows="3"

                    value={
                      form.description
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'description',
                        event.target.value
                      )
                    }

                    placeholder="Optional holiday description..."
                  />

                </div>

              </div>


              {/* ERROR */}

              {errorMessage && (

                <div className="holiday-modal-error">
                  {errorMessage}
                </div>

              )}


              {/* FOOTER */}

              <div className="holiday-modal-footer">

                <button
                  type="button"

                  className="holiday-cancel-button"

                  onClick={
                    closeModal
                  }

                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="button"

                  className="holiday-save-button"

                  onClick={
                    saveHoliday
                  }

                  disabled={
                    saving
                  }
                >

                  {saving
                    ? 'Saving...'
                    : editingHoliday
                    ? 'Save Changes'
                    : 'Add Holiday'}

                </button>

              </div>

            </div>

          </div>,

          document.body
        )
      }

    </div>
  )
}


// ===========================================================
// STATISTIC CARD
// ===========================================================

function HolidayStatistic({
  label,
  value,
  type = '',
}) {
  return (
    <div
      className={`holiday-stat-card ${
        type
          ? `holiday-stat-${type}`
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


export default AdminHolidays