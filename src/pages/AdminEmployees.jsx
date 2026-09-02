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

import FaceEnrollment from './FaceEnrollment'

import './AdminEmployees.css'


function AdminEmployees() {
  // =========================================================
  // DATA
  // =========================================================

  const [
    employees,
    setEmployees,
  ] = useState([])


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
    search,
    setSearch,
  ] = useState('')

  const [
    showForm,
    setShowForm,
  ] = useState(false)

  const [
    editingEmployee,
    setEditingEmployee,
  ] = useState(null)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')


  // =========================================================
  // FACE RECOGNITION
  // =========================================================

  const [
    faceEnrollmentEmployee,
    setFaceEnrollmentEmployee,
  ] = useState(null)

  const [
    faceProfilesByEmployee,
    setFaceProfilesByEmployee,
  ] = useState({})

  const [
    loadingFaceProfiles,
    setLoadingFaceProfiles,
  ] = useState(false)


  // =========================================================
  // EMPTY FORM
  // =========================================================

  const emptyForm = {
    employee_code: '',
    first_name: '',
    last_name: '',
    department: '',
    position: '',
    email: '',
    phone: '',
    date_joined: '',
    status: 'active',
  }


  const [
    form,
    setForm,
  ] = useState(
    emptyForm
  )


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadEmployees()
    loadFaceProfileStatus()
  }, [])


  // =========================================================
  // LOCK PAGE SCROLL WHILE MODAL OPEN
  // =========================================================

  useEffect(() => {
    if (
      !showForm &&
      !faceEnrollmentEmployee
    ) {
      return
    }


    const previousOverflow =
      document.body.style.overflow


    document.body.style.overflow =
      'hidden'


    return () => {
      document.body.style.overflow =
        previousOverflow
    }
  }, [
    showForm,
    faceEnrollmentEmployee,
  ])


  // =========================================================
  // LOAD EMPLOYEES
  // =========================================================

  async function loadEmployees() {
    setLoading(true)


    try {
      const {
        data,
        error,
      } =
        await supabase
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
            email,
            phone,
            date_joined,
            status,
            created_at,
            updated_at
          `)
          .order(
            'employee_code',
            {
              ascending: true,
            }
          )


      if (error) {
        throw error
      }


      setEmployees(
        data || []
      )
    } catch (error) {
      console.error(
        'Load employees error:',
        error
      )


      setErrorMessage(
        `Unable to load employees: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }


  // =========================================================
  // LOAD FACE PROFILE STATUS
  // =========================================================

  async function loadFaceProfileStatus() {
    setLoadingFaceProfiles(true)


    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'employee_face_profiles'
          )
          .select(`
            employee_id,
            sample_type,
            status
          `)
          .eq(
            'status',
            'active'
          )


      if (error) {
        throw error
      }


      const employeeSamples = {}


      for (
        const row of
        data || []
      ) {
        if (
          !employeeSamples[
            row.employee_id
          ]
        ) {
          employeeSamples[
            row.employee_id
          ] =
            new Set()
        }


        employeeSamples[
          row.employee_id
        ].add(
          row.sample_type
        )
      }


      const normalized = {}


      Object.entries(
        employeeSamples
      ).forEach(
        ([
          employeeId,
          samples,
        ]) => {
          normalized[
            employeeId
          ] = {
            count:
              samples.size,

            front:
              samples.has(
                'front'
              ),

            left:
              samples.has(
                'left'
              ),

            right:
              samples.has(
                'right'
              ),

            complete:
              samples.has(
                'front'
              ) &&
              samples.has(
                'left'
              ) &&
              samples.has(
                'right'
              ),
          }
        }
      )


      setFaceProfilesByEmployee(
        normalized
      )
    } catch (error) {
      console.error(
        'Face profile status error:',
        error
      )
    } finally {
      setLoadingFaceProfiles(
        false
      )
    }
  }


  // =========================================================
  // SEARCH
  // =========================================================

  const filteredEmployees =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()


      if (!keyword) {
        return employees
      }


      return employees.filter(
        (employee) => {
          const searchableText =
            [
              employee.employee_code,
              employee.first_name,
              employee.last_name,
              employee.department,
              employee.position,
              employee.email,
              employee.phone,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()


          return searchableText.includes(
            keyword
          )
        }
      )
    }, [
      employees,
      search,
    ])


  // =========================================================
  // FORM CHANGE
  // =========================================================

  function handleFormChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target


    setForm(
      (previous) => ({
        ...previous,

        [name]:
          value,
      })
    )


    setMessage('')
    setErrorMessage('')
  }


  // =========================================================
  // OPEN ADD EMPLOYEE
  // =========================================================

  function openAddEmployee() {
    setEditingEmployee(
      null
    )


    setForm({
      ...emptyForm,
    })


    setMessage('')
    setErrorMessage('')


    setShowForm(true)
  }


  // =========================================================
  // OPEN EDIT EMPLOYEE
  // =========================================================

  function openEditEmployee(
    employee
  ) {
    setEditingEmployee(
      employee
    )


    setForm({
      employee_code:
        employee.employee_code ||
        '',

      first_name:
        employee.first_name ||
        '',

      last_name:
        employee.last_name ||
        '',

      department:
        employee.department ||
        '',

      position:
        employee.position ||
        '',

      email:
        employee.email ||
        '',

      phone:
        employee.phone ||
        '',

      date_joined:
        employee.date_joined ||
        '',

      status:
        employee.status ||
        'active',
    })


    setMessage('')
    setErrorMessage('')


    setShowForm(true)
  }


  // =========================================================
  // CLOSE FORM
  // =========================================================

  function closeForm() {
    if (
      saving ||
      faceEnrollmentEmployee
    ) {
      return
    }


    setShowForm(false)

    setEditingEmployee(
      null
    )


    setForm({
      ...emptyForm,
    })


    setErrorMessage('')
  }


  // =========================================================
  // VALIDATION
  // =========================================================

  function validateForm() {
    if (
      !form.employee_code
        .trim()
    ) {
      return 'Employee Code is required.'
    }


    if (
      !form.first_name
        .trim()
    ) {
      return 'First Name is required.'
    }


    if (
      !form.last_name
        .trim()
    ) {
      return 'Last Name is required.'
    }


    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return 'Please enter a valid email address.'
    }


    return null
  }


  // =========================================================
  // SAVE EMPLOYEE
  // =========================================================

  async function saveEmployee(
    event
  ) {
    event.preventDefault()


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

    setMessage('')
    setErrorMessage('')


    const employeeData = {
      employee_code:
        form.employee_code
          .trim(),

      first_name:
        form.first_name
          .trim(),

      last_name:
        form.last_name
          .trim(),

      department:
        form.department
          .trim() ||
        null,

      position:
        form.position
          .trim() ||
        null,

      email:
        form.email
          .trim() ||
        null,

      phone:
        form.phone
          .trim() ||
        null,

      date_joined:
        form.date_joined ||
        null,

      status:
        form.status,
    }


    try {
      // =====================================================
      // UPDATE
      // =====================================================

      if (
        editingEmployee
      ) {
        const {
          error,
        } =
          await supabase
            .from(
              'employees'
            )
            .update(
              employeeData
            )
            .eq(
              'id',
              editingEmployee.id
            )


        if (error) {
          throw error
        }


        setMessage(
          'Employee updated successfully.'
        )
      }

      // =====================================================
      // ADD
      // =====================================================

      else {
        const {
          error,
        } =
          await supabase
            .from(
              'employees'
            )
            .insert(
              employeeData
            )


        if (error) {
          throw error
        }


        setMessage(
          'Employee added successfully.'
        )
      }


      setShowForm(false)

      setEditingEmployee(
        null
      )


      setForm({
        ...emptyForm,
      })


      await loadEmployees()
    } catch (error) {
      console.error(
        'Save employee error:',
        error
      )


      if (
        error.code ===
        '23505'
      ) {
        setErrorMessage(
          'This Employee Code already exists.'
        )
      } else if (
        error.code ===
        '23514'
      ) {
        setErrorMessage(
          'One of the employee values does not match the database requirements.'
        )
      } else {
        setErrorMessage(
          `Unable to save employee: ${error.message}`
        )
      }
    } finally {
      setSaving(false)
    }
  }


  // =========================================================
  // ACTIVATE / DEACTIVATE
  // =========================================================

  async function toggleEmployeeStatus(
    employee
  ) {
    const newStatus =
      employee.status ===
      'active'
        ? 'inactive'
        : 'active'


    const actionText =
      newStatus ===
      'active'
        ? 'activate'
        : 'deactivate'


    const confirmed =
      window.confirm(
        `Are you sure you want to ${actionText} ${employee.first_name} ${employee.last_name}?`
      )


    if (!confirmed) {
      return
    }


    setMessage('')
    setErrorMessage('')


    try {
      const {
        error,
      } =
        await supabase
          .from(
            'employees'
          )
          .update({
            status:
              newStatus,
          })
          .eq(
            'id',
            employee.id
          )


      if (error) {
        throw error
      }


      setMessage(
        newStatus ===
        'active'
          ? 'Employee activated successfully.'
          : 'Employee deactivated successfully.'
      )


      await loadEmployees()
    } catch (error) {
      console.error(
        'Employee status error:',
        error
      )


      setErrorMessage(
        `Unable to update employee status: ${error.message}`
      )
    }
  }


  // =========================================================
  // OPEN FACE ENROLLMENT
  // =========================================================

  function openFaceEnrollment() {
    if (
      !editingEmployee
    ) {
      return
    }


    setErrorMessage('')


    setFaceEnrollmentEmployee(
      editingEmployee
    )
  }


  // =========================================================
  // FACE ENROLLMENT SAVED
  // =========================================================

  async function handleFaceSaved() {
    await loadFaceProfileStatus()


    setMessage(
      'Face profile registered successfully.'
    )


    setErrorMessage('')
  }


  // =========================================================
  // GET FACE STATUS
  // =========================================================

  function getFaceStatus(
    employeeId
  ) {
    return (
      faceProfilesByEmployee[
        employeeId
      ] || {
        count: 0,
        front: false,
        left: false,
        right: false,
        complete: false,
      }
    )
  }


  // =========================================================
  // COUNTS
  // =========================================================

  const totalEmployees =
    employees.length


  const activeEmployees =
    employees.filter(
      (employee) =>
        employee.status ===
        'active'
    ).length


  const inactiveEmployees =
    employees.filter(
      (employee) =>
        employee.status ===
        'inactive'
    ).length


  // =========================================================
  // CURRENT FACE STATUS
  // =========================================================

  const editingFaceStatus =
    editingEmployee
      ? getFaceStatus(
          editingEmployee.id
        )
      : null


  // =========================================================
  // EMPLOYEE FORM MODAL
  // =========================================================

  const employeeFormModal =
    showForm
      ? createPortal(
          <div
            className="employee-modal-backdrop"
            role="presentation"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeForm()
              }
            }}
          >

            <div
              className="employee-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-modal-title"
              onMouseDown={(
                event
              ) => {
                event.stopPropagation()
              }}
            >

              {/* =============================================
                  MODAL HEADER
              ============================================= */}

              <div className="employee-modal-header">

                <div>

                  <h2 id="employee-modal-title">
                    {editingEmployee
                      ? 'Edit Employee'
                      : 'Add Employee'}
                  </h2>


                  <p>
                    {editingEmployee
                      ? 'Update employee information and face recognition.'
                      : 'Create a new employee record.'}
                  </p>

                </div>


                <button
                  type="button"
                  className="employee-modal-close"
                  onClick={
                    closeForm
                  }
                  disabled={
                    saving ||
                    Boolean(
                      faceEnrollmentEmployee
                    )
                  }
                  aria-label="Close"
                >
                  ×
                </button>

              </div>


              {/* =============================================
                  FORM
              ============================================= */}

              <form
                onSubmit={
                  saveEmployee
                }
                className="employee-form"
              >

                <div className="employee-form-field">

                  <label>
                    Employee Code
                    <span>*</span>
                  </label>


                  <input
                    type="text"
                    name="employee_code"
                    value={
                      form.employee_code
                    }
                    onChange={
                      handleFormChange
                    }
                    placeholder="e.g. 361"
                    autoFocus
                  />

                </div>


                <div className="employee-form-row">

                  <div className="employee-form-field">

                    <label>
                      First Name
                      <span>*</span>
                    </label>


                    <input
                      type="text"
                      name="first_name"
                      value={
                        form.first_name
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="First name"
                    />

                  </div>


                  <div className="employee-form-field">

                    <label>
                      Last Name
                      <span>*</span>
                    </label>


                    <input
                      type="text"
                      name="last_name"
                      value={
                        form.last_name
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="Last name"
                    />

                  </div>

                </div>


                <div className="employee-form-row">

                  <div className="employee-form-field">

                    <label>
                      Department
                    </label>


                    <input
                      type="text"
                      name="department"
                      value={
                        form.department
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="e.g. Decoration"
                    />

                  </div>


                  <div className="employee-form-field">

                    <label>
                      Position
                    </label>


                    <input
                      type="text"
                      name="position"
                      value={
                        form.position
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="Job position"
                    />

                  </div>

                </div>


                <div className="employee-form-row">

                  <div className="employee-form-field">

                    <label>
                      Email
                    </label>


                    <input
                      type="email"
                      name="email"
                      value={
                        form.email
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="employee@email.com"
                    />

                  </div>


                  <div className="employee-form-field">

                    <label>
                      Phone
                    </label>


                    <input
                      type="text"
                      name="phone"
                      value={
                        form.phone
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="+971..."
                    />

                  </div>

                </div>


                <div className="employee-form-row">

                  <div className="employee-form-field">

                    <label>
                      Date Joined
                    </label>


                    <input
                      type="date"
                      name="date_joined"
                      value={
                        form.date_joined
                      }
                      onChange={
                        handleFormChange
                      }
                    />

                  </div>


                  <div className="employee-form-field">

                    <label>
                      Status
                    </label>


                    <select
                      name="status"
                      value={
                        form.status
                      }
                      onChange={
                        handleFormChange
                      }
                    >

                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>

                    </select>

                  </div>

                </div>


                {/* ===========================================
                    FACE RECOGNITION
                =========================================== */}

                {editingEmployee && (

                  <div className="employee-face-section">

                    <div className="employee-face-main">

                      <div className="employee-face-icon">
                        ◉
                      </div>


                      <div className="employee-face-info">

                        <div className="employee-face-title-row">

                          <strong>
                            Face Recognition
                          </strong>


                          {loadingFaceProfiles ? (

                            <span className="employee-face-status loading">
                              Checking...
                            </span>

                          ) : editingFaceStatus?.complete ? (

                            <span className="employee-face-status enrolled">
                              ✓ Enrolled
                            </span>

                          ) : editingFaceStatus?.count > 0 ? (

                            <span className="employee-face-status incomplete">
                              {editingFaceStatus.count}/3 Captured
                            </span>

                          ) : (

                            <span className="employee-face-status not-enrolled">
                              Not Enrolled
                            </span>

                          )}

                        </div>


                        <p>
                          Register this employee for automatic face identification at the DTR kiosk.
                        </p>


                        {editingFaceStatus?.complete && (

                          <div className="employee-face-samples">

                            <span>
                              ✓ Front
                            </span>

                            <span>
                              ✓ Left
                            </span>

                            <span>
                              ✓ Right
                            </span>

                          </div>

                        )}

                      </div>

                    </div>


                    <button
                      type="button"
                      className="employee-register-face-button"
                      onClick={
                        openFaceEnrollment
                      }
                      disabled={
                        saving ||
                        loadingFaceProfiles
                      }
                    >

                      {editingFaceStatus?.complete
                        ? 'Re-register Face'
                        : editingFaceStatus?.count > 0
                        ? 'Continue Enrollment'
                        : 'Register Face'}

                    </button>

                  </div>

                )}


                {!editingEmployee && (

                  <div className="employee-face-new-notice">

                    <span>
                      ◉
                    </span>


                    <div>

                      <strong>
                        Face Recognition
                      </strong>


                      <p>
                        Save the employee first. You can register their face when editing the employee afterward.
                      </p>

                    </div>

                  </div>

                )}


                {errorMessage && (

                  <div className="employee-form-error">
                    {errorMessage}
                  </div>

                )}


                <div className="employee-form-actions">

                  <button
                    type="button"
                    className="employee-cancel-button"
                    onClick={
                      closeForm
                    }
                    disabled={
                      saving ||
                      Boolean(
                        faceEnrollmentEmployee
                      )
                    }
                  >
                    Cancel
                  </button>


                  <button
                    type="submit"
                    className="employee-save-button"
                    disabled={
                      saving ||
                      Boolean(
                        faceEnrollmentEmployee
                      )
                    }
                  >
                    {saving
                      ? 'Saving...'
                      : editingEmployee
                      ? 'Update Employee'
                      : 'Add Employee'}
                  </button>

                </div>

              </form>

            </div>

          </div>,

          document.body
        )
      : null


  // =========================================================
  // FACE ENROLLMENT MODAL
  // =========================================================

  const faceEnrollmentModal =
    faceEnrollmentEmployee
      ? createPortal(
          <FaceEnrollment
            employee={
              faceEnrollmentEmployee
            }

            onClose={() => {
              setFaceEnrollmentEmployee(
                null
              )
            }}

            onSaved={
              handleFaceSaved
            }
          />,

          document.body
        )
      : null


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="admin-employees-page">

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="employee-summary-grid">

        <div className="employee-summary-card">

          <span>
            Total Employees
          </span>

          <strong>
            {totalEmployees}
          </strong>

        </div>


        <div className="employee-summary-card">

          <span>
            Active
          </span>

          <strong>
            {activeEmployees}
          </strong>

        </div>


        <div className="employee-summary-card">

          <span>
            Inactive
          </span>

          <strong>
            {inactiveEmployees}
          </strong>

        </div>

      </div>


      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {message && (

        <div className="employee-message success">
          {message}
        </div>

      )}


      {errorMessage &&
        !showForm && (

          <div className="employee-message error">
            {errorMessage}
          </div>

        )}


      {/* =====================================================
          SEARCH + ADD EMPLOYEE
      ===================================================== */}

      <div className="employee-toolbar">

        <div className="employee-search-wrapper">

          <span className="employee-search-icon">
            🔍
          </span>


          <input
            type="text"
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search employee code, name, department..."
          />

        </div>


        <button
          type="button"
          className="employee-add-button"
          onClick={
            openAddEmployee
          }
        >
          + Add Employee
        </button>

      </div>


      {/* =====================================================
          EMPLOYEE TABLE
      ===================================================== */}

      <div className="employees-table-card">

        {loading ? (

          <div className="employees-loading">
            Loading employees...
          </div>

        ) : filteredEmployees.length ===
          0 ? (

          <div className="employees-empty">
            No employees found.
          </div>

        ) : (

          <div className="employees-table-wrapper">

            <table className="employees-table">

              <thead>

                <tr>

                  <th>
                    Code
                  </th>

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
                    Contact
                  </th>

                  <th>
                    Date Joined
                  </th>

                  <th>
                    Status
                  </th>

                  <th className="employee-actions-heading">
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredEmployees.map(
                  (employee) => (

                    <tr
                      key={
                        employee.id
                      }
                    >

                      <td>

                        <strong className="employee-code-value">
                          {employee.employee_code}
                        </strong>

                      </td>


                      <td>

                        <div className="employee-table-name">
                          {employee.first_name}{' '}
                          {employee.last_name}
                        </div>

                      </td>


                      <td>
                        {employee.department ||
                          '—'}
                      </td>


                      <td>
                        {employee.position ||
                          '—'}
                      </td>


                      <td>

                        <div className="employee-contact">

                          <span>
                            {employee.email ||
                              '—'}
                          </span>


                          {employee.phone && (

                            <small>
                              {employee.phone}
                            </small>

                          )}

                        </div>

                      </td>


                      <td>
                        {employee.date_joined ||
                          '—'}
                      </td>


                      <td>

                        <span
                          className={
                            employee.status ===
                            'active'
                              ? 'employee-status active'
                              : 'employee-status inactive'
                          }
                        >
                          {employee.status ===
                          'active'
                            ? 'Active'
                            : 'Inactive'}
                        </span>

                      </td>


                      <td>

                        <div className="employee-row-actions">

                          <button
                            type="button"
                            className="employee-edit-button"
                            onClick={() =>
                              openEditEmployee(
                                employee
                              )
                            }
                          >
                            Edit
                          </button>


                          <button
                            type="button"
                            className={
                              employee.status ===
                              'active'
                                ? 'employee-status-button deactivate'
                                : 'employee-status-button activate'
                            }
                            onClick={() =>
                              toggleEmployeeStatus(
                                employee
                              )
                            }
                          >
                            {employee.status ===
                            'active'
                              ? 'Deactivate'
                              : 'Activate'}
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


      {employeeFormModal}

      {faceEnrollmentModal}

    </div>
  )
}


export default AdminEmployees