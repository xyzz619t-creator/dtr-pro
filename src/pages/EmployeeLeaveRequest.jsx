import {
  useMemo,
  useState,
} from 'react'

import {
  supabase,
} from '../lib/supabase'

import './EmployeeLeaveRequest.css'


// ===========================================================
// CONSTANTS
// ===========================================================

const MAX_PDF_SIZE =
  10 * 1024 * 1024


// ===========================================================
// EMPTY FORM
// ===========================================================

function createEmptyForm() {
  return {
    employeeCode: '',
    requestType: 'annual',

    startDate: '',
    endDate: '',

    durationType: 'full_day',

    startTime: '',
    endTime: '',

    reason: '',
    attachment: null,
  }
}


// ===========================================================
// RANDOM FILE NAME
// ===========================================================

function createRandomFileName() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join('-')
}


// ===========================================================
// FORMAT BALANCE
// ===========================================================

function formatBalance(value) {
  const number =
    Number(value || 0)

  if (
    Number.isInteger(number)
  ) {
    return String(number)
  }

  return number.toFixed(1)
}


// ===========================================================
// CALCULATE INCLUSIVE DAYS
// ===========================================================

function calculateInclusiveDays(
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
    ) ||
    end < start
  ) {
    return 0
  }

  return (
    Math.floor(
      (
        end.getTime() -
        start.getTime()
      ) /
        86400000
    ) + 1
  )
}


// ===========================================================
// COMPONENT
// ===========================================================

function EmployeeLeaveRequest({
  onBack,
}) {
  // =========================================================
  // FORM
  // =========================================================

  const [
    form,
    setForm,
  ] = useState(
    createEmptyForm()
  )

  // =========================================================
  // EMPLOYEE
  // =========================================================

  const [
    employee,
    setEmployee,
  ] = useState(null)

  const [
    comOffBalance,
    setComOffBalance,
  ] = useState(null)

  // =========================================================
  // UI
  // =========================================================

  const [
    checkingEmployee,
    setCheckingEmployee,
  ] = useState(false)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  // =========================================================
  // COM-OFF CALCULATIONS
  // =========================================================

  const requestedComOffDays =
    useMemo(
      () => {
        if (
          form.requestType !==
          'comoff'
        ) {
          return 0
        }

        return calculateInclusiveDays(
          form.startDate,
          form.endDate
        )
      },
      [
        form.requestType,
        form.startDate,
        form.endDate,
      ]
    )

  const availableComOff =
    Number(
      comOffBalance?.available ||
      0
    )

  const pendingComOff =
    Number(
      comOffBalance?.pending ||
      0
    )

  const remainingIfApproved =
    Math.max(
      availableComOff -
      requestedComOffDays,
      0
    )

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
          [field]: value,
        }

        // ---------------------------------------------------
        // START DATE
        // ---------------------------------------------------

        if (
          field === 'startDate'
        ) {
          if (
            !next.endDate ||
            next.endDate < value
          ) {
            next.endDate =
              value
          }
        }

        // ---------------------------------------------------
        // FULL DAY
        // ---------------------------------------------------

        if (
          field === 'durationType' &&
          value === 'full_day'
        ) {
          next.startTime = ''
          next.endTime = ''
        }

        // ---------------------------------------------------
        // PARTIAL DAY
        // ---------------------------------------------------

        if (
          field === 'durationType' &&
          value === 'partial_day' &&
          next.startDate
        ) {
          next.endDate =
            next.startDate
        }

        return next
      }
    )

    setErrorMessage('')
    setSuccessMessage('')
  }

  // =========================================================
  // EMPLOYEE CODE
  // =========================================================

  function handleEmployeeCodeChange(
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,
        employeeCode: value,
      })
    )

    setEmployee(null)
    setComOffBalance(null)

    setErrorMessage('')
    setSuccessMessage('')
  }

  // =========================================================
  // REQUEST TYPE
  // =========================================================

  function changeRequestType(
    requestType
  ) {
    setForm(
      (previous) => {
        const next = {
          ...previous,

          requestType,

          attachment:
            requestType === 'sick'
              ? previous.attachment
              : null,
        }

        if (
          requestType ===
          'comoff'
        ) {
          next.durationType =
            'full_day'

          next.startTime = ''
          next.endTime = ''

          if (
            next.startDate &&
            !next.endDate
          ) {
            next.endDate =
              next.startDate
          }
        }

        return next
      }
    )

    setErrorMessage('')
    setSuccessMessage('')
  }

  // =========================================================
  // LOAD EMPLOYEE PROFILE
  // =========================================================

  async function loadEmployeeProfile(
    employeeCode
  ) {
    const code =
      String(
        employeeCode || ''
      ).trim()

    if (!code) {
      throw new Error(
        'Enter your employee code.'
      )
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_employee_request_profile',
        {
          p_employee_code:
            code,
        }
      )

    if (error) {
      throw error
    }

    if (
      !data ||
      data.success !== true
    ) {
      throw new Error(
        data?.message ||
        'Unable to verify employee.'
      )
    }

    if (!data.employee) {
      throw new Error(
        'Employee information was not returned.'
      )
    }

    setEmployee(
      data.employee
    )

    setComOffBalance(
      data.com_off || {
        earned: 0,
        used: 0,
        pending: 0,
        available: 0,
      }
    )

    return data
  }

  // =========================================================
  // FIND EMPLOYEE
  // =========================================================

  async function findEmployee() {
    const code =
      form.employeeCode.trim()

    if (!code) {
      setErrorMessage(
        'Enter your employee code.'
      )

      return
    }

    setCheckingEmployee(true)

    setEmployee(null)
    setComOffBalance(null)

    setErrorMessage('')
    setSuccessMessage('')

    try {
      await loadEmployeeProfile(
        code
      )
    } catch (error) {
      console.error(
        'Employee lookup error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to verify employee.'
      )
    } finally {
      setCheckingEmployee(false)
    }
  }

  // =========================================================
  // PDF ATTACHMENT
  // =========================================================

  function handleAttachment(
    event
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      setForm(
        (previous) => ({
          ...previous,
          attachment: null,
        })
      )

      return
    }

    if (
      file.type !==
      'application/pdf'
    ) {
      event.target.value = ''

      setForm(
        (previous) => ({
          ...previous,
          attachment: null,
        })
      )

      setErrorMessage(
        'Only PDF files are allowed.'
      )

      return
    }

    if (
      file.size >
      MAX_PDF_SIZE
    ) {
      event.target.value = ''

      setForm(
        (previous) => ({
          ...previous,
          attachment: null,
        })
      )

      setErrorMessage(
        'PDF file must be 10 MB or smaller.'
      )

      return
    }

    setForm(
      (previous) => ({
        ...previous,
        attachment: file,
      })
    )

    setErrorMessage('')
    setSuccessMessage('')
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  function validateForm() {
    if (!employee) {
      return 'Please verify your employee code first.'
    }

    if (
      employee.employee_code !==
      form.employeeCode.trim()
    ) {
      return 'Employee code has changed. Please verify it again.'
    }

    if (!form.startDate) {
      return (
        form.requestType ===
        'comoff'
          ? 'Com-off From Date is required.'
          : 'Start date is required.'
      )
    }

    // -------------------------------------------------------
    // ANNUAL / SICK
    // -------------------------------------------------------

    if (
      form.requestType !==
      'comoff'
    ) {
      if (!form.endDate) {
        return 'End date is required.'
      }

      if (
        form.endDate <
        form.startDate
      ) {
        return 'End date cannot be before start date.'
      }

      if (
        form.durationType ===
        'partial_day'
      ) {
        if (
          form.startDate !==
          form.endDate
        ) {
          return 'Partial-day leave must use the same start and end date.'
        }

        if (
          !form.startTime ||
          !form.endTime
        ) {
          return 'Start and end time are required for partial-day leave.'
        }

        if (
          form.endTime <=
          form.startTime
        ) {
          return 'End time must be after start time.'
        }
      }
    }

    // -------------------------------------------------------
    // COM-OFF
    // -------------------------------------------------------

    if (
      form.requestType ===
      'comoff'
    ) {
      if (!form.endDate) {
        return 'Com-off To Date is required.'
      }

      if (
        form.endDate <
        form.startDate
      ) {
        return 'Com-off To Date cannot be before From Date.'
      }

      if (
        requestedComOffDays <
        1
      ) {
        return 'Select a valid Com-off date range.'
      }

      if (
        availableComOff <
        1
      ) {
        return 'You do not have an available Com-off balance.'
      }

      if (
        requestedComOffDays >
        availableComOff
      ) {
        return (
          `You only have ${formatBalance(
            availableComOff
          )} available Com-off day(s), but selected ${requestedComOffDays} day(s).`
        )
      }
    }

    return ''
  }

  // =========================================================
  // UPLOAD SICK LEAVE PDF
  // =========================================================

  async function uploadSickAttachment() {
    if (
      form.requestType !==
        'sick' ||
      !form.attachment
    ) {
      return null
    }

    if (!employee?.id) {
      throw new Error(
        'Employee information is missing.'
      )
    }

    const fileName =
      `${createRandomFileName()}.pdf`

    const year =
      form.startDate
        ? String(
            form.startDate
          ).slice(0, 4)
        : String(
            new Date()
              .getFullYear()
          )

    const filePath =
      [
        employee.id,
        year,
        fileName,
      ].join('/')

    const {
      error,
    } =
      await supabase
        .storage
        .from(
          'leave-documents'
        )
        .upload(
          filePath,
          form.attachment,
          {
            contentType:
              'application/pdf',

            upsert: false,

            cacheControl:
              '3600',
          }
        )

    if (error) {
      throw new Error(
        `Unable to upload PDF: ${error.message}`
      )
    }

    return filePath
  }

  // =========================================================
  // SUBMIT ANNUAL / SICK
  // =========================================================

  async function submitLeaveRequest() {
    let attachmentPath =
      null

    if (
      form.requestType ===
        'sick' &&
      form.attachment
    ) {
      attachmentPath =
        await uploadSickAttachment()
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'submit_employee_leave_request',
        {
          p_employee_code:
            form.employeeCode.trim(),

          p_leave_type:
            form.requestType,

          p_start_date:
            form.startDate,

          p_end_date:
            form.endDate ||
            form.startDate,

          p_duration_type:
            form.durationType,

          p_start_time:
            form.durationType ===
            'partial_day'
              ? form.startTime
              : null,

          p_end_time:
            form.durationType ===
            'partial_day'
              ? form.endTime
              : null,

          p_reason:
            form.reason.trim() ||
            null,

          p_attachment_path:
            attachmentPath,
        }
      )

    if (error) {
      throw error
    }

    if (
      !data ||
      data.success !== true
    ) {
      throw new Error(
        data?.message ||
        'Unable to submit leave request.'
      )
    }

    return data
  }

  // =========================================================
  // SUBMIT COM-OFF
  // =========================================================

  async function submitComOffRequest() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'submit_employee_com_off_request',
        {
          p_employee_code:
            form.employeeCode.trim(),

          p_start_date:
            form.startDate,

          p_end_date:
            form.endDate,

          p_reason:
            form.reason.trim() ||
            null,
        }
      )

    if (error) {
      throw error
    }

    if (
      !data ||
      data.success !== true
    ) {
      throw new Error(
        data?.message ||
        'Unable to submit Com-off request.'
      )
    }

    return data
  }

  // =========================================================
  // RESET REQUEST
  // =========================================================

  function resetRequestForm() {
    setForm(
      (previous) => ({
        ...createEmptyForm(),

        employeeCode:
          previous.employeeCode,

        requestType:
          previous.requestType,
      })
    )
  }

  // =========================================================
  // REFRESH BALANCE
  // =========================================================

  async function refreshEmployeeBalance() {
    try {
      await loadEmployeeProfile(
        form.employeeCode
      )
    } catch (error) {
      console.error(
        'Balance refresh error:',
        error
      )
    }
  }

  // =========================================================
  // SUBMIT
  // =========================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    const validationError =
      validateForm()

    if (validationError) {
      setErrorMessage(
        validationError
      )

      return
    }

    setSubmitting(true)

    setErrorMessage('')
    setSuccessMessage('')

    try {
      if (
        form.requestType ===
        'comoff'
      ) {
        const result =
          await submitComOffRequest()

        setSuccessMessage(
          result.message ||
          (
            requestedComOffDays ===
            1
              ? 'Com-off request submitted successfully.'
              : `${requestedComOffDays} consecutive Com-off days submitted successfully.`
          )
        )

        await refreshEmployeeBalance()
      } else {
        const result =
          await submitLeaveRequest()

        setSuccessMessage(
          result.message ||
          (
            form.requestType ===
            'sick'
              ? 'Sick Leave request submitted successfully.'
              : 'Annual Leave request submitted successfully.'
          )
        )
      }

      resetRequestForm()
    } catch (error) {
      console.error(
        'Request submission error:',
        error
      )

      setErrorMessage(
        error.message
          ? `Unable to submit request: ${error.message}`
          : 'Unable to submit request.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // =========================================================
  // BACK TO DTR
  // =========================================================

  function handleBack() {
    if (onBack) {
      onBack()
      return
    }

    window.location.href = '/'
  }

  // =========================================================
  // REQUEST TITLE
  // =========================================================

  const requestTitle =
    useMemo(
      () => {
        switch (
          form.requestType
        ) {
          case 'sick':
            return 'Sick Leave'

          case 'comoff':
            return 'Com-off'

          default:
            return 'Annual Leave'
        }
      },
      [
        form.requestType,
      ]
    )

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="employee-leave-page">

      {/* =====================================================
          FIXED HEADER
      ===================================================== */}

      <header className="employee-leave-header">

        <img
          src="/dtr-pro-logo.png"
          alt="DTR Pro"
          className="employee-leave-logo"
        />

        <button
          type="button"
          className="employee-leave-back"
          onClick={
            handleBack
          }
        >
          Employee DTR
        </button>

      </header>


      {/* =====================================================
          CONTENT
      ===================================================== */}

      <main className="employee-leave-content">

        {/* ===================================================
            PAGE TITLE
        =================================================== */}

        <section className="employee-leave-intro">

          <h1>
            Leave Request
          </h1>

          <p>
            Apply for annual leave, sick leave or Com-off.
          </p>

        </section>


        {/* ===================================================
            EMPLOYEE CARD
        =================================================== */}

        <section className="leave-employee-card">

          <div className="leave-employee-search">

            <div className="leave-employee-copy">

              <label>
                Employee Code
              </label>

              <p>
                Enter your employee code to continue.
              </p>

            </div>


            <div className="leave-code-control">

              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"

                value={
                  form.employeeCode
                }

                onChange={(
                  event
                ) =>
                  handleEmployeeCodeChange(
                    event.target.value
                  )
                }

                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    event.preventDefault()
                    findEmployee()
                  }
                }}

                placeholder="Employee code"

                disabled={
                  checkingEmployee ||
                  submitting
                }
              />


              <button
                type="button"

                onClick={
                  findEmployee
                }

                disabled={
                  checkingEmployee ||
                  submitting ||
                  !form.employeeCode.trim()
                }
              >

                {checkingEmployee
                  ? 'Checking...'
                  : 'Continue'}

              </button>

            </div>

          </div>


          {/* =================================================
              EMPLOYEE PROFILE
          ================================================= */}

          {employee && (

            <div className="leave-employee-profile">

              <div className="leave-employee-avatar">

                {employee
                  .first_name
                  ?.charAt(0)}

                {employee
                  .last_name
                  ?.charAt(0)}

              </div>


              <div className="leave-employee-details">

                <strong>

                  {employee.first_name}{' '}
                  {employee.last_name}

                </strong>


                <span>

                  {employee.employee_code}

                  {' • '}

                  {employee.department ||
                    'Employee'}

                  {employee.position
                    ? ` • ${employee.position}`
                    : ''}

                </span>

              </div>

            </div>

          )}

        </section>


        {/* ===================================================
            LOOKUP ERROR
        =================================================== */}

        {!employee &&
          errorMessage && (

          <div className="leave-request-message error">
            {errorMessage}
          </div>

        )}


        {/* ===================================================
            REQUEST FORM
        =================================================== */}

        {employee && (

          <form
            className="leave-request-card"
            onSubmit={
              handleSubmit
            }
          >

            {/* =================================================
                REQUEST TYPE
            ================================================= */}

            <div className="leave-type-tabs">

              <button
                type="button"

                className={
                  form.requestType ===
                  'annual'
                    ? 'active'
                    : ''
                }

                onClick={() =>
                  changeRequestType(
                    'annual'
                  )
                }

                disabled={
                  submitting
                }
              >

                <span className="leave-type-icon">
                  ◷
                </span>

                <strong>
                  Annual Leave
                </strong>

              </button>


              <button
                type="button"

                className={
                  form.requestType ===
                  'sick'
                    ? 'active'
                    : ''
                }

                onClick={() =>
                  changeRequestType(
                    'sick'
                  )
                }

                disabled={
                  submitting
                }
              >

                <span className="leave-type-icon">
                  ✚
                </span>

                <strong>
                  Sick Leave
                </strong>

              </button>


              <button
                type="button"

                className={
                  form.requestType ===
                  'comoff'
                    ? 'active'
                    : ''
                }

                onClick={() =>
                  changeRequestType(
                    'comoff'
                  )
                }

                disabled={
                  submitting
                }
              >

                <span className="leave-type-icon">
                  ↻
                </span>

                <strong>
                  Com-off
                </strong>

              </button>

            </div>


            {/* =================================================
                FORM TITLE
            ================================================= */}

            <div className="leave-form-heading">

              <div>

                <h2>
                  {requestTitle}
                </h2>


                <p>

                  {form.requestType ===
                  'comoff'
                    ? 'Use one or more consecutive available Com-off days.'
                    : form.requestType ===
                      'sick'
                    ? 'Submit your sick leave request. A medical certificate PDF can be attached.'
                    : 'Complete your annual leave request details.'}

                </p>

              </div>


              {form.requestType ===
                'comoff' && (

                <div className="leave-comoff-balance">

                  <span>
                    Available
                  </span>

                  <strong>
                    {formatBalance(
                      availableComOff
                    )}
                  </strong>

                  <small>
                    day(s)
                  </small>

                </div>

              )}

            </div>


            {/* =================================================
                FORM GRID
            ================================================= */}

            <div className="leave-form-grid">

              {/* ===============================================
                  START DATE
              =============================================== */}

              <div className="leave-form-group">

                <label>

                  {form.requestType ===
                  'comoff'
                    ? 'From Date'
                    : 'Start Date'}

                  <span>*</span>

                </label>

                <input
                  type="date"

                  value={
                    form.startDate
                  }

                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'startDate',
                      event.target.value
                    )
                  }

                  disabled={
                    submitting
                  }
                />

              </div>


              {/* ===============================================
                  END DATE
              =============================================== */}

              <div className="leave-form-group">

                <label>

                  {form.requestType ===
                  'comoff'
                    ? 'To Date'
                    : 'End Date'}

                  <span>*</span>

                </label>

                <input
                  type="date"

                  min={
                    form.startDate ||
                    undefined
                  }

                  value={
                    form.endDate
                  }

                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'endDate',
                      event.target.value
                    )
                  }

                  disabled={
                    submitting
                  }
                />

              </div>


              {/* ===============================================
                  COM-OFF REQUESTED
              =============================================== */}

              {form.requestType ===
                'comoff' && (

                <div className="leave-form-group">

                  <label>
                    Requested Com-off
                  </label>

                  <input
                    type="text"
                    readOnly

                    value={
                      requestedComOffDays
                        ? `${requestedComOffDays} ${
                            requestedComOffDays ===
                            1
                              ? 'Day'
                              : 'Days'
                          }`
                        : '—'
                    }
                  />

                </div>

              )}


              {/* ===============================================
                  COM-OFF REMAINING
              =============================================== */}

              {form.requestType ===
                'comoff' && (

                <div className="leave-form-group">

                  <label>
                    Remaining if Approved
                  </label>

                  <input
                    type="text"
                    readOnly

                    value={
                      requestedComOffDays
                        ? `${formatBalance(
                            remainingIfApproved
                          )} Day(s)`
                        : `${formatBalance(
                            availableComOff
                          )} Day(s)`
                    }
                  />

                </div>

              )}


              {/* ===============================================
                  COM-OFF PENDING
              =============================================== */}

              {form.requestType ===
                'comoff' &&
                pendingComOff >
                0 && (

                <div className="leave-form-full">

                  <div className="leave-request-message success leave-inline-message">

                    You currently have{' '}

                    <strong>
                      {formatBalance(
                        pendingComOff
                      )}
                    </strong>{' '}

                    Com-off day(s) pending approval.

                    Pending requests do not reduce your available balance until approved.

                  </div>

                </div>

              )}


              {/* ===============================================
                  DURATION
              =============================================== */}

              {form.requestType !==
                'comoff' && (

                <div className="leave-form-group">

                  <label>
                    Duration
                  </label>

                  <select
                    value={
                      form.durationType
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'durationType',
                        event.target.value
                      )
                    }

                    disabled={
                      submitting
                    }
                  >

                    <option value="full_day">
                      Full Day
                    </option>

                    <option value="partial_day">
                      Partial Day
                    </option>

                  </select>

                </div>

              )}


              {/* ===============================================
                  PARTIAL START TIME
              =============================================== */}

              {form.requestType !==
                'comoff' &&
                form.durationType ===
                'partial_day' && (

                <div className="leave-form-group">

                  <label>
                    Start Time
                    <span>*</span>
                  </label>

                  <input
                    type="time"

                    value={
                      form.startTime
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'startTime',
                        event.target.value
                      )
                    }

                    disabled={
                      submitting
                    }
                  />

                </div>

              )}


              {/* ===============================================
                  PARTIAL END TIME
              =============================================== */}

              {form.requestType !==
                'comoff' &&
                form.durationType ===
                'partial_day' && (

                <div className="leave-form-group">

                  <label>
                    End Time
                    <span>*</span>
                  </label>

                  <input
                    type="time"

                    value={
                      form.endTime
                    }

                    onChange={(
                      event
                    ) =>
                      updateForm(
                        'endTime',
                        event.target.value
                      )
                    }

                    disabled={
                      submitting
                    }
                  />

                </div>

              )}


              {/* ===============================================
                  SICK LEAVE PDF
              =============================================== */}

              {form.requestType ===
                'sick' && (

                <div className="leave-form-group leave-form-full">

                  <label>
                    Medical Certificate
                  </label>

                  <label className="leave-file-upload">

                    <input
                      type="file"

                      accept="application/pdf,.pdf"

                      onChange={
                        handleAttachment
                      }

                      disabled={
                        submitting
                      }
                    />

                    <div className="leave-upload-icon">
                      PDF
                    </div>

                    <div className="leave-file-copy">

                      <strong>

                        {form.attachment
                          ? form.attachment.name
                          : 'Attach medical certificate'}

                      </strong>

                      <span>

                        {form.attachment
                          ? `${(
                              form.attachment.size /
                              1024 /
                              1024
                            ).toFixed(
                              2
                            )} MB • PDF selected`
                          : 'Optional PDF file • Maximum 10 MB'}

                      </span>

                    </div>

                    <span className="leave-upload-button">

                      {form.attachment
                        ? 'Change PDF'
                        : 'Choose PDF'}

                    </span>

                  </label>

                </div>

              )}


              {/* ===============================================
                  REASON
              =============================================== */}

              <div className="leave-form-group leave-form-full">

                <label>

                  {form.requestType ===
                  'sick'
                    ? 'Remarks'
                    : 'Reason'}

                </label>

                <textarea
                  rows="4"

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

                  placeholder={
                    form.requestType ===
                    'comoff'
                      ? 'Optional reason for Com-off request...'
                      : form.requestType ===
                        'sick'
                      ? 'Optional remarks...'
                      : 'Enter reason for leave...'
                  }

                  disabled={
                    submitting
                  }
                />

              </div>

            </div>


            {/* =================================================
                COM-OFF WARNING
            ================================================= */}

            {form.requestType ===
              'comoff' &&
              requestedComOffDays >
              availableComOff &&
              requestedComOffDays >
              0 && (

              <div className="leave-request-message error">

                You selected{' '}

                <strong>
                  {requestedComOffDays}
                </strong>{' '}

                day(s), but you only have{' '}

                <strong>
                  {formatBalance(
                    availableComOff
                  )}
                </strong>{' '}

                available Com-off day(s).

              </div>

            )}


            {/* =================================================
                ERROR
            ================================================= */}

            {errorMessage && (

              <div className="leave-request-message error">
                {errorMessage}
              </div>

            )}


            {/* =================================================
                SUCCESS
            ================================================= */}

            {successMessage && (

              <div className="leave-request-message success">
                {successMessage}
              </div>

            )}


            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="leave-request-footer">

              <button
                type="submit"

                className="leave-submit-button"

                disabled={
                  submitting ||
                  (
                    form.requestType ===
                    'comoff' &&
                    (
                      requestedComOffDays <
                      1 ||
                      requestedComOffDays >
                      availableComOff
                    )
                  )
                }
              >

                {submitting
                  ? (
                      form.requestType ===
                        'sick' &&
                      form.attachment
                        ? 'Uploading & Submitting...'
                        : 'Submitting...'
                    )
                  : 'Submit Request'}

              </button>

            </div>

          </form>

        )}

      </main>

    </div>
  )
}


export default EmployeeLeaveRequest