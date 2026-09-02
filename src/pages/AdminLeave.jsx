import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  createPortal,
} from 'react-dom'

import {
  supabase,
} from '../lib/supabase'

import './AdminLeave.css'


// ===========================================================
// OPTIONS
// ===========================================================

const LEAVE_TYPES = [
  {
    value: 'annual',
    label: 'Annual Leave',
  },
  {
    value: 'sick',
    label: 'Sick Leave',
  },
  {
    value: 'emergency',
    label: 'Emergency Leave',
  },
  {
    value: 'unpaid',
    label: 'Unpaid Leave',
  },
  {
    value: 'other',
    label: 'Other',
  },
]


const DURATION_TYPES = [
  {
    value: 'full_day',
    label: 'Full Day',
  },
  {
    value: 'partial_day',
    label: 'Partial Day',
  },
]


const STATUS_OPTIONS = [
  {
    value: 'pending',
    label: 'Pending',
  },
  {
    value: 'approved',
    label: 'Approved',
  },
  {
    value: 'rejected',
    label: 'Rejected',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
  },
]


// ===========================================================
// EMPTY FORM
// ===========================================================

function createEmptyForm() {
  return {
    employee_id: '',
    leave_type: 'annual',

    start_date: '',
    end_date: '',

    duration_type: 'full_day',

    start_time: '',
    end_time: '',

    reason: '',

    status: 'pending',

    admin_notes: '',
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


function formatTime(value) {
  if (!value) {
    return ''
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
    hour,
    minute,
    0,
    0
  )


  return date.toLocaleTimeString(
    'en-US',
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}


function calculateLeaveDays(
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


  const difference =
    Math.round(
      (
        end.getTime() -
        start.getTime()
      ) /
      86400000
    )


  return Math.max(
    difference + 1,
    1
  )
}


// ===========================================================
// LABEL HELPERS
// ===========================================================

function getLeaveTypeLabel(value) {
  return (
    LEAVE_TYPES.find(
      (item) =>
        item.value ===
        value
    )?.label ||
    value ||
    'Leave'
  )
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


// ===========================================================
// ADMIN LEAVE
// ===========================================================

function AdminLeave() {
  // =========================================================
  // DATA
  // =========================================================

  const [
    employees,
    setEmployees,
  ] = useState([])

  const [
    leaveRecords,
    setLeaveRecords,
  ] = useState([])


  // =========================================================
  // FILTERS
  // =========================================================

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('pending')

  const [
    monthFilter,
    setMonthFilter,
  ] = useState('')


  // =========================================================
  // UI
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
    actionId,
    setActionId,
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
    editingRecord,
    setEditingRecord,
  ] = useState(null)

  const [
    form,
    setForm,
  ] = useState(
    createEmptyForm()
  )


  // =========================================================
  // MONTH PICKER
  // =========================================================

  const monthInputRef =
    useRef(null)


  function openMonthPicker() {
    const input =
      monthInputRef.current


    if (!input) {
      return
    }


    try {
      if (
        typeof input.showPicker ===
        'function'
      ) {
        input.showPicker()
      } else {
        input.focus()
        input.click()
      }
    } catch {
      input.focus()
    }
  }


  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData(
    showLoader = true
  ) {
    if (showLoader) {
      setLoading(true)
    }


    try {
      const [
        employeeResult,
        leaveResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'employees'
            )
            .select(`
              id,
              employee_code,
              first_name,
              last_name,
              department,
              position,
              status
            `)
            .order(
              'first_name',
              {
                ascending: true,
              }
            ),

          supabase
            .from(
              'leave_records'
            )
            .select(`
              id,
              employee_id,
              leave_type,
              start_date,
              end_date,
              duration_type,
              start_time,
              end_time,
              reason,
              status,
              admin_notes,
              approved_at,
              rejected_at,
              attachment_path,
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
        employeeResult.error
      ) {
        throw employeeResult.error
      }


      if (
        leaveResult.error
      ) {
        throw leaveResult.error
      }


      setEmployees(
        employeeResult.data ||
        []
      )


      setLeaveRecords(
        leaveResult.data ||
        []
      )
    } catch (error) {
      console.error(
        'Leave load error:',
        error
      )


      setErrorMessage(
        `Unable to load leave records: ${error.message}`
      )
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }


  // =========================================================
  // INITIAL LOAD + REALTIME + FALLBACK REFRESH
  // =========================================================

  useEffect(() => {
    loadData(true)


    const channel =
      supabase
        .channel(
          'admin-leave-live'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leave_records',
          },
          () => {
            loadData(false)
          }
        )
        .subscribe()


    const refreshTimer =
      window.setInterval(
        () => {
          loadData(false)
        },
        20000
      )


    const handleFocus =
      () => {
        loadData(false)
      }


    window.addEventListener(
      'focus',
      handleFocus
    )


    return () => {
      window.clearInterval(
        refreshTimer
      )

      window.removeEventListener(
        'focus',
        handleFocus
      )

      supabase.removeChannel(
        channel
      )
    }
  }, [])


  // =========================================================
  // STATISTICS
  // =========================================================

  const statistics =
    useMemo(() => {
      const today =
        getLocalDateString()


      const total =
        leaveRecords.length


      const approved =
        leaveRecords.filter(
          (record) =>
            record.status ===
            'approved'
        ).length


      const pending =
        leaveRecords.filter(
          (record) =>
            record.status ===
            'pending'
        ).length


      const onLeave =
        leaveRecords.filter(
          (record) =>
            record.status ===
              'approved' &&
            record.start_date <=
              today &&
            record.end_date >=
              today
        ).length


      return {
        total,
        approved,
        pending,
        onLeave,
      }
    }, [
      leaveRecords,
    ])


  // =========================================================
  // FILTERED RECORDS
  // =========================================================

  const filteredRecords =
    useMemo(() => {
      const keyword =
        searchTerm
          .trim()
          .toLowerCase()


      let monthStart =
        null

      let monthEnd =
        null


      if (monthFilter) {
        const [
          year,
          month,
        ] =
          monthFilter
            .split('-')
            .map(Number)


        monthStart =
          `${year}-${String(
            month
          ).padStart(
            2,
            '0'
          )}-01`


        const lastDay =
          new Date(
            year,
            month,
            0
          ).getDate()


        monthEnd =
          `${year}-${String(
            month
          ).padStart(
            2,
            '0'
          )}-${String(
            lastDay
          ).padStart(
            2,
            '0'
          )}`
      }


      return leaveRecords.filter(
        (record) => {
          const employee =
            record.employees


          if (keyword) {
            const searchText =
              [
                employee?.employee_code,
                employee?.first_name,
                employee?.last_name,
                employee?.department,
                employee?.position,
                record.leave_type,
                record.reason,
                record.status,
                record.start_date,
                record.end_date,
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
            statusFilter !==
              'all' &&
            record.status !==
              statusFilter
          ) {
            return false
          }


          if (
            monthStart &&
            monthEnd
          ) {
            const overlaps =
              record.start_date <=
                monthEnd &&
              record.end_date >=
                monthStart


            if (!overlaps) {
              return false
            }
          }


          return true
        }
      )
    }, [
      leaveRecords,
      searchTerm,
      statusFilter,
      monthFilter,
    ])


  // =========================================================
  // FILTER STATE
  // =========================================================

  const hasFilters =
    Boolean(
      searchTerm ||
      statusFilter !==
        'pending' ||
      monthFilter
    )


  function clearFilters() {
    setSearchTerm('')
    setStatusFilter(
      'pending'
    )
    setMonthFilter('')
  }


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


        if (
          field ===
            'duration_type' &&
          value ===
            'full_day'
        ) {
          next.start_time = ''
          next.end_time = ''
        }


        if (
          field ===
            'duration_type' &&
          value ===
            'partial_day' &&
          next.start_date
        ) {
          next.end_date =
            next.start_date
        }


        return next
      }
    )


    setErrorMessage('')
  }


  // =========================================================
  // ADD
  // =========================================================

  function openAddModal() {
    setEditingRecord(null)

    setForm(
      createEmptyForm()
    )

    setErrorMessage('')
    setMessage('')

    setModalOpen(true)
  }


  // =========================================================
  // EDIT
  // =========================================================

  function openEditModal(
    record
  ) {
    setEditingRecord(
      record
    )


    setForm({
      employee_id:
        record.employee_id ||
        '',

      leave_type:
        record.leave_type ||
        'annual',

      start_date:
        record.start_date ||
        '',

      end_date:
        record.end_date ||
        '',

      duration_type:
        record.duration_type ||
        'full_day',

      start_time:
        record.start_time
          ? String(
              record.start_time
            ).substring(
              0,
              5
            )
          : '',

      end_time:
        record.end_time
          ? String(
              record.end_time
            ).substring(
              0,
              5
            )
          : '',

      reason:
        record.reason ||
        '',

      status:
        record.status ||
        'pending',

      admin_notes:
        record.admin_notes ||
        '',
    })


    setErrorMessage('')
    setMessage('')

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

    setEditingRecord(null)

    setForm(
      createEmptyForm()
    )

    setErrorMessage('')
  }


  // =========================================================
  // VALIDATION
  // =========================================================

  function validateForm() {
    if (
      !form.employee_id
    ) {
      return 'Please select an employee.'
    }


    if (
      !form.leave_type
    ) {
      return 'Please select a leave type.'
    }


    if (
      !form.start_date ||
      !form.end_date
    ) {
      return 'Please select the leave dates.'
    }


    if (
      form.end_date <
      form.start_date
    ) {
      return 'End date cannot be before start date.'
    }


    if (
      form.duration_type ===
      'partial_day'
    ) {
      if (
        form.start_date !==
        form.end_date
      ) {
        return 'Partial-day leave must be on the same date.'
      }


      if (
        !form.start_time ||
        !form.end_time
      ) {
        return 'Start and end times are required for partial-day leave.'
      }


      if (
        form.end_time <=
        form.start_time
      ) {
        return 'Partial-day leave end time must be later than start time.'
      }
    }


    return ''
  }


  // =========================================================
  // STATUS TIMESTAMPS
  // =========================================================

  function getStatusTimestamps(
    status,
    originalRecord = null
  ) {
    const now =
      new Date()
        .toISOString()


    if (
      status ===
      'approved'
    ) {
      return {
        approved_at:
          originalRecord
            ?.approved_at ||
          now,

        rejected_at:
          null,
      }
    }


    if (
      status ===
      'rejected'
    ) {
      return {
        approved_at:
          null,

        rejected_at:
          originalRecord
            ?.rejected_at ||
          now,
      }
    }


    if (
      status ===
      'cancelled'
    ) {
      return {
        approved_at:
          originalRecord
            ?.approved_at ||
          null,

        rejected_at:
          originalRecord
            ?.rejected_at ||
          null,
      }
    }


    return {
      approved_at:
        null,

      rejected_at:
        null,
    }
  }


  // =========================================================
  // SAVE LEAVE
  // =========================================================

  async function saveLeave() {
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
      const timestamps =
        getStatusTimestamps(
          form.status,
          editingRecord
        )


      const payload = {
        employee_id:
          form.employee_id,

        leave_type:
          form.leave_type,

        start_date:
          form.start_date,

        end_date:
          form.end_date,

        duration_type:
          form.duration_type,

        start_time:
          form.duration_type ===
            'partial_day'
            ? form.start_time
            : null,

        end_time:
          form.duration_type ===
            'partial_day'
            ? form.end_time
            : null,

        reason:
          form.reason.trim() ||
          null,

        status:
          form.status,

        admin_notes:
          form.admin_notes
            .trim() ||
          null,

        approved_at:
          timestamps.approved_at,

        rejected_at:
          timestamps.rejected_at,

        updated_at:
          new Date()
            .toISOString(),
      }


      if (editingRecord) {
        const {
          error,
        } =
          await supabase
            .from(
              'leave_records'
            )
            .update(
              payload
            )
            .eq(
              'id',
              editingRecord.id
            )


        if (error) {
          throw error
        }


        setMessage(
          'Leave record updated successfully.'
        )
      } else {
        const {
          error,
        } =
          await supabase
            .from(
              'leave_records'
            )
            .insert(
              payload
            )


        if (error) {
          throw error
        }


        setMessage(
          'Leave record added successfully.'
        )
      }


      setModalOpen(false)
      setEditingRecord(null)

      setForm(
        createEmptyForm()
      )


      await loadData(false)
    } catch (error) {
      console.error(
        'Leave save error:',
        error
      )


      setErrorMessage(
        `Unable to save leave record: ${error.message}`
      )
    } finally {
      setSaving(false)
    }
  }


  // =========================================================
  // APPROVE
  // =========================================================

  async function approveLeave(
    record
  ) {
    const employee =
      record.employees


    const confirmed =
      window.confirm(
        `Approve ${getLeaveTypeLabel(
          record.leave_type
        )} for ${employee?.first_name || 'this employee'} ${employee?.last_name || ''}?`
      )


    if (!confirmed) {
      return
    }


    setActionId(
      record.id
    )

    setErrorMessage('')
    setMessage('')


    try {
      const now =
        new Date()
          .toISOString()


      const {
        error,
      } =
        await supabase
          .from(
            'leave_records'
          )
          .update({
            status:
              'approved',

            approved_at:
              now,

            rejected_at:
              null,

            updated_at:
              now,
          })
          .eq(
            'id',
            record.id
          )


      if (error) {
        throw error
      }


      setMessage(
        `${getLeaveTypeLabel(
          record.leave_type
        )} approved successfully.`
      )


      await loadData(false)
    } catch (error) {
      console.error(
        'Leave approve error:',
        error
      )


      setErrorMessage(
        `Unable to approve leave: ${error.message}`
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // REJECT
  // =========================================================

  async function rejectLeave(
    record
  ) {
    const reason =
      window.prompt(
        'Optional reason for rejecting this leave request:',
        ''
      )


    if (
      reason === null
    ) {
      return
    }


    setActionId(
      record.id
    )

    setErrorMessage('')
    setMessage('')


    try {
      const now =
        new Date()
          .toISOString()


      const payload = {
        status:
          'rejected',

        approved_at:
          null,

        rejected_at:
          now,

        updated_at:
          now,
      }


      if (
        reason.trim()
      ) {
        payload.admin_notes =
          reason.trim()
      }


      const {
        error,
      } =
        await supabase
          .from(
            'leave_records'
          )
          .update(
            payload
          )
          .eq(
            'id',
            record.id
          )


      if (error) {
        throw error
      }


      setMessage(
        `${getLeaveTypeLabel(
          record.leave_type
        )} rejected.`
      )


      await loadData(false)
    } catch (error) {
      console.error(
        'Leave reject error:',
        error
      )


      setErrorMessage(
        `Unable to reject leave: ${error.message}`
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // CANCEL
  // =========================================================

  async function cancelLeave(
    record
  ) {
    const notes =
      window.prompt(
        'Optional reason for cancelling this leave:',
        record.admin_notes ||
        ''
      )


    if (
      notes === null
    ) {
      return
    }


    const confirmed =
      window.confirm(
        'Cancel this approved leave?'
      )


    if (!confirmed) {
      return
    }


    setActionId(
      record.id
    )

    setErrorMessage('')
    setMessage('')


    try {
      const payload = {
        status:
          'cancelled',

        updated_at:
          new Date()
            .toISOString(),
      }


      if (
        notes.trim()
      ) {
        payload.admin_notes =
          notes.trim()
      }


      const {
        error,
      } =
        await supabase
          .from(
            'leave_records'
          )
          .update(
            payload
          )
          .eq(
            'id',
            record.id
          )


      if (error) {
        throw error
      }


      setMessage(
        'Leave cancelled successfully.'
      )


      await loadData(false)
    } catch (error) {
      console.error(
        'Leave cancel error:',
        error
      )


      setErrorMessage(
        `Unable to cancel leave: ${error.message}`
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // VIEW SICK LEAVE PDF
  // =========================================================

  async function viewAttachment(
    record
  ) {
    if (
      !record.attachment_path
    ) {
      setErrorMessage(
        'No medical certificate is attached to this request.'
      )

      return
    }


    setActionId(
      record.id
    )

    setErrorMessage('')


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
          'PDF URL was not returned.'
        )
      }


      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      )
    } catch (error) {
      console.error(
        'Sick Leave PDF error:',
        error
      )


      setErrorMessage(
        `Unable to open medical certificate: ${error.message}`
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // DELETE
  // =========================================================

  async function deleteLeave(
    record
  ) {
    const employee =
      record.employees


    const name =
      [
        employee?.first_name,
        employee?.last_name,
      ]
        .filter(Boolean)
        .join(' ')


    const confirmed =
      window.confirm(
        `Delete this leave record for ${name || 'this employee'}?`
      )


    if (!confirmed) {
      return
    }


    setActionId(
      record.id
    )

    setErrorMessage('')
    setMessage('')


    try {
      if (
        record.attachment_path
      ) {
        const {
          error:
            storageError,
        } =
          await supabase
            .storage
            .from(
              'leave-documents'
            )
            .remove([
              record.attachment_path,
            ])


        if (storageError) {
          console.warn(
            'PDF cleanup warning:',
            storageError
          )
        }
      }


      const {
        error,
      } =
        await supabase
          .from(
            'leave_records'
          )
          .delete()
          .eq(
            'id',
            record.id
          )


      if (error) {
        throw error
      }


      setMessage(
        'Leave record deleted.'
      )


      await loadData(false)
    } catch (error) {
      console.error(
        'Leave delete error:',
        error
      )


      setErrorMessage(
        `Unable to delete leave: ${error.message}`
      )
    } finally {
      setActionId(null)
    }
  }


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="admin-leave-page">

      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <div className="leave-stat-grid">

        <LeaveStatistic
          label="Total Leave"
          value={
            statistics.total
          }
        />


        <LeaveStatistic
          label="Approved"
          value={
            statistics.approved
          }
          type="approved"
        />


        <LeaveStatistic
          label="Pending"
          value={
            statistics.pending
          }
          type="pending"
        />


        <LeaveStatistic
          label="On Leave Today"
          value={
            statistics.onLeave
          }
          type="on-leave"
        />

      </div>


      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {errorMessage &&
        !modalOpen && (

          <div className="leave-message leave-error">
            {errorMessage}
          </div>

        )}


      {message && (

        <div className="leave-message leave-success">
          {message}
        </div>

      )}


      {/* =====================================================
          FILTERS + ADD LEAVE
      ===================================================== */}

      <div className="leave-filter-bar">

        {/* SEARCH */}

        <div className="leave-search-box">

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

            placeholder="Search employee name, code, department, leave type or reason..."
          />

        </div>


        {/* STATUS */}

        <select
          className="leave-status-filter"

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


        {/* MONTH */}

        <div className="leave-month-picker">

          <input
            ref={
              monthInputRef
            }

            type="month"

            value={
              monthFilter
            }

            onChange={(
              event
            ) =>
              setMonthFilter(
                event.target.value
              )
            }

            aria-label="Filter leave by month"
          />


          <button
            type="button"

            className="leave-month-picker-button"

            onClick={
              openMonthPicker
            }

            aria-label="Open month picker"

            title="Select month"
          >
            📅
          </button>

        </div>


        {/* CLEAR */}

        <button
          type="button"

          className="leave-clear-filter"

          onClick={
            clearFilters
          }

          disabled={
            !hasFilters
          }
        >
          Clear
        </button>


        {/* ADD LEAVE */}

        <button
          type="button"

          className="leave-add-button"

          onClick={
            openAddModal
          }
        >
          + Add Leave
        </button>

      </div>


      {/* =====================================================
          TABLE
      ===================================================== */}

      <div className="leave-table-card">

        {loading ? (

          <div className="leave-empty-state">
            Loading leave requests...
          </div>

        ) : filteredRecords.length ===
          0 ? (

          <div className="leave-empty-state">

            <div className="leave-empty-icon">
              📝
            </div>


            <strong>

              {statusFilter ===
                'pending'
                ? 'No pending leave requests'
                : 'No leave records found'}

            </strong>


            <span>

              {statusFilter ===
                'pending'
                ? 'Employee Annual Leave and Sick Leave requests will appear here automatically.'
                : 'Try changing the search or filters.'}

            </span>

          </div>

        ) : (

          <div className="leave-table-scroll">

            <table className="leave-table">

              <thead>

                <tr>

                  <th>
                    Employee
                  </th>

                  <th>
                    Leave Type
                  </th>

                  <th>
                    Dates
                  </th>

                  <th>
                    Days
                  </th>

                  <th>
                    Reason
                  </th>

                  <th>
                    Document
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Submitted
                  </th>

                  <th className="leave-actions-heading">
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredRecords.map(
                  (record) => {
                    const employee =
                      record.employees


                    const days =
                      record.duration_type ===
                        'partial_day'
                        ? 1
                        : calculateLeaveDays(
                            record.start_date,
                            record.end_date
                          )


                    return (
                      <tr
                        key={
                          record.id
                        }
                      >

                        {/* EMPLOYEE */}

                        <td>

                          <div className="leave-employee-cell">

                            <div className="leave-avatar">

                              {getInitials(
                                employee?.first_name,
                                employee?.last_name
                              )}

                            </div>


                            <div className="leave-employee-info">

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


                        {/* TYPE */}

                        <td>

                          <span
                            className={`leave-type-label leave-type-${record.leave_type}`}
                          >

                            {getLeaveTypeLabel(
                              record.leave_type
                            )}

                          </span>

                        </td>


                        {/* DATES */}

                        <td>

                          <div className="leave-date-range">

                            <strong>

                              {formatDate(
                                record.start_date
                              )}

                            </strong>


                            {record.end_date !==
                              record.start_date && (

                              <small>

                                to{' '}

                                {formatDate(
                                  record.end_date
                                )}

                              </small>

                            )}


                            {record.duration_type ===
                              'partial_day' && (

                              <small>

                                {formatTime(
                                  record.start_time
                                )}

                                {' – '}

                                {formatTime(
                                  record.end_time
                                )}

                              </small>

                            )}

                          </div>

                        </td>


                        {/* DAYS */}

                        <td>

                          <strong className="leave-day-count">
                            {days}
                          </strong>

                        </td>


                        {/* REASON */}

                        <td>

                          <div
                            className="leave-reason"

                            title={
                              record.reason ||
                              ''
                            }
                          >

                            {record.reason ||
                              '—'}

                          </div>

                        </td>


                        {/* DOCUMENT */}

                        <td>

                          {record.attachment_path ? (

                            <button
                              type="button"

                              className="leave-pdf-button"

                              disabled={
                                actionId ===
                                record.id
                              }

                              onClick={() =>
                                viewAttachment(
                                  record
                                )
                              }
                            >
                              PDF
                            </button>

                          ) : record.leave_type ===
                            'sick' ? (

                            <span className="leave-no-pdf">
                              No PDF
                            </span>

                          ) : (

                            <span className="leave-no-pdf">
                              —
                            </span>

                          )}

                        </td>


                        {/* STATUS */}

                        <td>

                          <span
                            className={`leave-status leave-status-${record.status}`}
                          >
                            {record.status}
                          </span>

                        </td>


                        {/* SUBMITTED */}

                        <td>

                          <span className="leave-submitted">

                            {formatDateTime(
                              record.created_at
                            )}

                          </span>

                        </td>


                        {/* ACTIONS */}

                        <td>

                          <div className="leave-actions">

                            {record.status ===
                              'pending' && (
                              <>

                                <button
                                  type="button"

                                  className="leave-approve-button"

                                  disabled={
                                    actionId ===
                                    record.id
                                  }

                                  onClick={() =>
                                    approveLeave(
                                      record
                                    )
                                  }
                                >

                                  {actionId ===
                                  record.id
                                    ? 'Wait...'
                                    : 'Approve'}

                                </button>


                                <button
                                  type="button"

                                  className="leave-reject-button"

                                  disabled={
                                    actionId ===
                                    record.id
                                  }

                                  onClick={() =>
                                    rejectLeave(
                                      record
                                    )
                                  }
                                >
                                  Reject
                                </button>

                              </>
                            )}


                            {record.status ===
                              'approved' && (

                              <button
                                type="button"

                                className="leave-cancel-request-button"

                                disabled={
                                  actionId ===
                                  record.id
                                }

                                onClick={() =>
                                  cancelLeave(
                                    record
                                  )
                                }
                              >
                                Cancel
                              </button>

                            )}


                            <button
                              type="button"

                              className="leave-edit-button"

                              disabled={
                                actionId ===
                                record.id
                              }

                              onClick={() =>
                                openEditModal(
                                  record
                                )
                              }
                            >
                              Edit
                            </button>


                            <button
                              type="button"

                              className="leave-delete-button"

                              disabled={
                                actionId ===
                                record.id
                              }

                              onClick={() =>
                                deleteLeave(
                                  record
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
          ADD / EDIT MODAL
      ===================================================== */}

      {modalOpen &&
        createPortal(

          <div className="leave-modal-overlay">

            <div className="leave-modal">

              <div className="leave-modal-header">

                <div>

                  <h2>

                    {editingRecord
                      ? 'Edit Leave'
                      : 'Add Leave'}

                  </h2>


                  <p>

                    {editingRecord
                      ? 'Update employee leave information.'
                      : 'Create a new employee leave record.'}

                  </p>

                </div>


                <button
                  type="button"

                  className="leave-modal-close"

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


              <div className="leave-modal-body">

                {/* EMPLOYEE */}

                <div className="leave-form-group leave-form-full">

                  <label>
                    Employee
                    <span>*</span>
                  </label>


                  <select
                    value={
                      form.employee_id
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'employee_id',
                        event.target.value
                      )
                    }

                    disabled={
                      saving
                    }
                  >

                    <option value="">
                      Select Employee
                    </option>


                    {employees.map(
                      (employee) => (

                        <option
                          key={
                            employee.id
                          }

                          value={
                            employee.id
                          }
                        >

                          {employee.employee_code}

                          {' — '}

                          {employee.first_name}{' '}
                          {employee.last_name}

                          {employee.status !==
                            'active'
                            ? ' (Inactive)'
                            : ''}

                        </option>

                      )
                    )}

                  </select>

                </div>


                {/* LEAVE TYPE */}

                <div className="leave-form-group">

                  <label>
                    Leave Type
                    <span>*</span>
                  </label>


                  <select
                    value={
                      form.leave_type
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'leave_type',
                        event.target.value
                      )
                    }
                  >

                    {LEAVE_TYPES.map(
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


                {/* DURATION */}

                <div className="leave-form-group">

                  <label>
                    Duration
                    <span>*</span>
                  </label>


                  <select
                    value={
                      form.duration_type
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'duration_type',
                        event.target.value
                      )
                    }
                  >

                    {DURATION_TYPES.map(
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


                {/* START DATE */}

                <div className="leave-form-group">

                  <label>
                    Start Date
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

                <div className="leave-form-group">

                  <label>
                    End Date
                    <span>*</span>
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


                {/* PARTIAL DAY */}

                {form.duration_type ===
                  'partial_day' && (
                  <>

                    <div className="leave-form-group">

                      <label>
                        Start Time
                        <span>*</span>
                      </label>


                      <input
                        type="time"

                        value={
                          form.start_time
                        }

                        onChange={(
                          event
                        ) =>
                          updateForm(
                            'start_time',
                            event.target.value
                          )
                        }
                      />

                    </div>


                    <div className="leave-form-group">

                      <label>
                        End Time
                        <span>*</span>
                      </label>


                      <input
                        type="time"

                        value={
                          form.end_time
                        }

                        onChange={(
                          event
                        ) =>
                          updateForm(
                            'end_time',
                            event.target.value
                          )
                        }
                      />

                    </div>

                  </>
                )}


                {/* STATUS */}

                <div className="leave-form-group">

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


                {/* DAYS */}

                <div className="leave-form-group">

                  <label>
                    Leave Days
                  </label>


                  <div className="leave-calculated-days">

                    {form.duration_type ===
                    'partial_day'
                      ? 1
                      : calculateLeaveDays(
                          form.start_date,
                          form.end_date
                        )}

                    {' '}

                    Day(s)

                  </div>

                </div>


                {/* PDF */}

                {editingRecord
                  ?.attachment_path && (

                  <div className="leave-form-group leave-form-full">

                    <label>
                      Medical Certificate
                    </label>


                    <button
                      type="button"

                      className="leave-modal-pdf"

                      onClick={() =>
                        viewAttachment(
                          editingRecord
                        )
                      }
                    >
                      View Attached PDF
                    </button>

                  </div>

                )}


                {/* REASON */}

                <div className="leave-form-group leave-form-full">

                  <label>
                    Reason
                  </label>


                  <textarea
                    rows="3"

                    value={
                      form.reason
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'reason',
                        event.target.value
                      )
                    }

                    placeholder="Enter leave reason..."
                  />

                </div>


                {/* ADMIN NOTES */}

                <div className="leave-form-group leave-form-full">

                  <label>
                    Admin Notes
                  </label>


                  <textarea
                    rows="3"

                    value={
                      form.admin_notes
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'admin_notes',
                        event.target.value
                      )
                    }

                    placeholder="Optional internal notes..."
                  />

                </div>

              </div>


              {errorMessage && (

                <div className="leave-modal-error">
                  {errorMessage}
                </div>

              )}


              <div className="leave-modal-footer">

                <button
                  type="button"

                  className="leave-cancel-button"

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

                  className="leave-save-button"

                  onClick={
                    saveLeave
                  }

                  disabled={
                    saving
                  }
                >

                  {saving
                    ? 'Saving...'
                    : editingRecord
                    ? 'Save Changes'
                    : 'Add Leave'}

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
// STATISTIC
// ===========================================================

function LeaveStatistic({
  label,
  value,
  type = '',
}) {
  return (
    <div
      className={`leave-stat-card ${
        type
          ? `leave-stat-${type}`
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


export default AdminLeave