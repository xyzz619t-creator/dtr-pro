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

import './AdminDevices.css'


const DEVICE_TOKEN_STORAGE_KEY =
  'dtr_device_token'


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
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }
  )
}


function AdminDevices() {
  // =========================================================
  // DATA
  // =========================================================

  const [
    devices,
    setDevices,
  ] = useState([])

  const [
    departments,
    setDepartments,
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
    busyDeviceId,
    setBusyDeviceId,
  ] = useState(null)

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState('all')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('all')

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    showForm,
    setShowForm,
  ] = useState(false)

  const [
    editingDevice,
    setEditingDevice,
  ] = useState(null)

  const [
    tokenResult,
    setTokenResult,
  ] = useState(null)

  const [
    tokenCopied,
    setTokenCopied,
  ] = useState(false)

  const [
    browserRegistered,
    setBrowserRegistered,
  ] = useState(() => {
    try {
      return Boolean(
        window.localStorage.getItem(
          DEVICE_TOKEN_STORAGE_KEY
        )
      )
    } catch {
      return false
    }
  })


  // =========================================================
  // FORM
  // =========================================================

  const emptyForm = {
    device_name: '',
    department: '',
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
    loadData()
  }, [])


  // =========================================================
  // LOCK PAGE SCROLL WHILE MODAL OPEN
  // =========================================================

  useEffect(() => {
    if (
      !showForm &&
      !tokenResult
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
    tokenResult,
  ])


  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData() {
    setLoading(true)
    setErrorMessage('')

    try {
      const [
        deviceResult,
        departmentResult,
      ] =
        await Promise.all([
          supabase.rpc(
            'admin_list_kiosk_devices'
          ),

          supabase.rpc(
            'admin_list_device_departments'
          ),
        ])

      if (deviceResult.error) {
        throw deviceResult.error
      }

      if (departmentResult.error) {
        throw departmentResult.error
      }

      if (
        deviceResult.data?.success !==
        true
      ) {
        throw new Error(
          deviceResult.data?.message ||
          'Unable to load devices.'
        )
      }

      if (
        departmentResult.data?.success !==
        true
      ) {
        throw new Error(
          departmentResult.data?.message ||
          'Unable to load departments.'
        )
      }

      setDevices(
        Array.isArray(
          deviceResult.data?.devices
        )
          ? deviceResult.data.devices
          : []
      )

      setDepartments(
        Array.isArray(
          departmentResult.data
            ?.departments
        )
          ? departmentResult.data
              .departments
          : []
      )
    } catch (error) {
      console.error(
        'Load devices error:',
        error
      )

      setErrorMessage(
        `Unable to load devices: ${
          error.message
        }`
      )
    } finally {
      setLoading(false)
    }
  }


  // =========================================================
  // FILTERED DEVICES
  // =========================================================

  const filteredDevices =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()

      return devices.filter(
        (device) => {
          if (
            departmentFilter !==
              'all' &&
            String(
              device.department ||
              ''
            ) !== departmentFilter
          ) {
            return false
          }

          if (
            statusFilter !==
              'all' &&
            String(
              device.status ||
              ''
            ).toLowerCase() !==
              statusFilter
          ) {
            return false
          }

          if (!keyword) {
            return true
          }

          const searchableText =
            [
              device.device_name,
              device.department,
              device.status,
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
      devices,
      search,
      departmentFilter,
      statusFilter,
    ])


  // =========================================================
  // COUNTS
  // =========================================================

  const totalDevices =
    devices.length

  const activeDevices =
    devices.filter(
      (device) =>
        String(
          device.status ||
          ''
        ).toLowerCase() ===
        'active'
    ).length

  const inactiveDevices =
    devices.filter(
      (device) =>
        String(
          device.status ||
          ''
        ).toLowerCase() ===
        'inactive'
    ).length


  // =========================================================
  // FORM HELPERS
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
        [name]: value,
      })
    )

    setMessage('')
    setErrorMessage('')
  }


  function openAddDevice() {
    setEditingDevice(null)

    setForm({
      ...emptyForm,
      department:
        departments[0] ||
        '',
    })

    setMessage('')
    setErrorMessage('')
    setShowForm(true)
  }


  function openEditDevice(
    device
  ) {
    setEditingDevice(
      device
    )

    setForm({
      device_name:
        device.device_name ||
        '',

      department:
        device.department ||
        '',
    })

    setMessage('')
    setErrorMessage('')
    setShowForm(true)
  }


  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    setEditingDevice(null)

    setForm({
      ...emptyForm,
    })

    setErrorMessage('')
  }


  function validateForm() {
    if (
      !form.device_name
        .trim()
    ) {
      return 'Device Name is required.'
    }

    if (
      !form.department
        .trim()
    ) {
      return 'Department is required.'
    }

    return null
  }


  // =========================================================
  // TOKEN HELPERS
  // =========================================================

  function openTokenResult({
    token,
    device,
    registered = false,
    title,
  }) {
    setTokenCopied(false)

    setTokenResult({
      token,
      device,
      registered,
      title,
    })
  }


  async function copyToken() {
    const token =
      tokenResult?.token

    if (!token) {
      return
    }

    try {
      await navigator.clipboard
        .writeText(token)

      setTokenCopied(true)

      window.setTimeout(
        () => {
          setTokenCopied(false)
        },
        1800
      )
    } catch (error) {
      console.error(
        'Copy token error:',
        error
      )

      setErrorMessage(
        'Unable to copy token automatically. Select the token and copy it manually.'
      )
    }
  }


  function registerTokenInBrowser(
    token
  ) {
    try {
      window.localStorage.setItem(
        DEVICE_TOKEN_STORAGE_KEY,
        token
      )

      setBrowserRegistered(
        true
      )

      setTokenResult(
        (previous) =>
          previous
            ? {
                ...previous,
                registered: true,
              }
            : previous
      )

      setMessage(
        'This browser is now registered as the selected DTR device.'
      )
    } catch (error) {
      console.error(
        'Register browser token error:',
        error
      )

      setErrorMessage(
        'Unable to register this browser. Browser storage may be unavailable.'
      )
    }
  }


  function clearBrowserRegistration() {
    const confirmed =
      window.confirm(
        'Remove the DTR device token from this browser? This does not delete or deactivate the device in Supabase.'
      )

    if (!confirmed) {
      return
    }

    try {
      window.localStorage.removeItem(
        DEVICE_TOKEN_STORAGE_KEY
      )

      setBrowserRegistered(
        false
      )

      setMessage(
        'DTR device registration removed from this browser.'
      )

      setErrorMessage('')
    } catch (error) {
      console.error(
        'Clear browser registration error:',
        error
      )

      setErrorMessage(
        'Unable to remove the browser registration.'
      )
    }
  }


  // =========================================================
  // CREATE / UPDATE DEVICE
  // =========================================================

  async function saveDevice(
    registerBrowser = false
  ) {
    const validationError =
      validateForm()

    if (validationError) {
      setErrorMessage(
        validationError
      )

      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      if (editingDevice) {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            'admin_update_kiosk_device',
            {
              p_device_id:
                editingDevice.id,

              p_device_name:
                form.device_name
                  .trim(),

              p_department:
                form.department
                  .trim(),
            }
          )

        if (error) {
          throw error
        }

        if (
          data?.success !==
          true
        ) {
          throw new Error(
            data?.message ||
            'Unable to update device.'
          )
        }

        setMessage(
          data.message ||
          'Device updated successfully.'
        )

        setShowForm(false)
        setEditingDevice(null)

        setForm({
          ...emptyForm,
        })

        await loadData()

        return
      }

      const {
        data,
        error,
      } =
        await supabase.rpc(
          'admin_create_kiosk_device',
          {
            p_device_name:
              form.device_name
                .trim(),

            p_department:
              form.department
                .trim(),
          }
        )

      if (error) {
        throw error
      }

      if (
        data?.success !==
        true
      ) {
        throw new Error(
          data?.message ||
          'Unable to create device.'
        )
      }

      const token =
        String(
          data?.device_token ||
          ''
        ).trim()

      if (!token) {
        throw new Error(
          'Device was created but no private token was returned.'
        )
      }

      if (registerBrowser) {
        registerTokenInBrowser(
          token
        )
      }

      setShowForm(false)
      setEditingDevice(null)

      setForm({
        ...emptyForm,
      })

      await loadData()

      setMessage(
        registerBrowser
          ? 'Device created and this browser was registered successfully.'
          : 'Device created successfully.'
      )

      openTokenResult({
        token,
        device:
          data?.device ||
          null,
        registered:
          registerBrowser,
        title:
          'Device Created',
      })
    } catch (error) {
      console.error(
        'Save device error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to save device.'
      )
    } finally {
      setSaving(false)
    }
  }


  function handleFormSubmit(
    event
  ) {
    event.preventDefault()

    saveDevice(false)
  }


  // =========================================================
  // ACTIVATE / DEACTIVATE
  // =========================================================

  async function toggleDeviceStatus(
    device
  ) {
    const currentStatus =
      String(
        device.status ||
        ''
      ).toLowerCase()

    const newStatus =
      currentStatus ===
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
        `Are you sure you want to ${actionText} "${device.device_name}"?`
      )

    if (!confirmed) {
      return
    }

    setBusyDeviceId(
      device.id
    )

    setMessage('')
    setErrorMessage('')

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'admin_set_kiosk_device_status',
          {
            p_device_id:
              device.id,

            p_status:
              newStatus,
          }
        )

      if (error) {
        throw error
      }

      if (
        data?.success !==
        true
      ) {
        throw new Error(
          data?.message ||
          'Unable to update device status.'
        )
      }

      setMessage(
        data.message ||
        'Device status updated.'
      )

      await loadData()
    } catch (error) {
      console.error(
        'Device status error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to update device status.'
      )
    } finally {
      setBusyDeviceId(null)
    }
  }


  // =========================================================
  // REGENERATE TOKEN
  // =========================================================

  async function regenerateToken(
    device
  ) {
    const confirmed =
      window.confirm(
        `Regenerate the private token for "${device.device_name}"?\n\nThe old token will stop working immediately.`
      )

    if (!confirmed) {
      return
    }

    setBusyDeviceId(
      device.id
    )

    setMessage('')
    setErrorMessage('')

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'admin_regenerate_kiosk_device_token',
          {
            p_device_id:
              device.id,
          }
        )

      if (error) {
        throw error
      }

      if (
        data?.success !==
        true
      ) {
        throw new Error(
          data?.message ||
          'Unable to regenerate device token.'
        )
      }

      const token =
        String(
          data?.device_token ||
          ''
        ).trim()

      if (!token) {
        throw new Error(
          'Token was regenerated but no private token was returned.'
        )
      }

      setMessage(
        'Device token regenerated successfully.'
      )

      openTokenResult({
        token,
        device:
          data?.device ||
          device,
        registered:
          false,
        title:
          'New Device Token',
      })
    } catch (error) {
      console.error(
        'Regenerate token error:',
        error
      )

      setErrorMessage(
        error.message ||
        'Unable to regenerate device token.'
      )
    } finally {
      setBusyDeviceId(null)
    }
  }


  // =========================================================
  // DEVICE FORM MODAL
  // =========================================================

  const deviceFormModal =
    showForm
      ? createPortal(
          <div
            className="device-modal-backdrop"
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
              className="device-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="device-modal-title"
              onMouseDown={(
                event
              ) => {
                event.stopPropagation()
              }}
            >
              <div className="device-modal-header">
                <div>
                  <h2 id="device-modal-title">
                    {editingDevice
                      ? 'Edit Device'
                      : 'Add Device'}
                  </h2>

                  <p>
                    {editingDevice
                      ? 'Update the device name or assigned department.'
                      : 'Create a new department-aware DTR device.'}
                  </p>
                </div>

                <button
                  type="button"
                  className="device-modal-close"
                  onClick={
                    closeForm
                  }
                  disabled={
                    saving
                  }
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form
                className="device-form"
                onSubmit={
                  handleFormSubmit
                }
              >
                <div className="device-form-field">
                  <label>
                    Device Name
                    <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="device_name"
                    value={
                      form.device_name
                    }
                    onChange={
                      handleFormChange
                    }
                    placeholder="e.g. Decoration iPad 01"
                    autoFocus
                  />
                </div>

                <div className="device-form-field">
                  <label>
                    Department
                    <span>*</span>
                  </label>

                  <select
                    name="department"
                    value={
                      form.department
                    }
                    onChange={
                      handleFormChange
                    }
                  >
                    <option value="">
                      Select department
                    </option>

                    {departments.map(
                      (department) => (
                        <option
                          key={
                            department
                          }
                          value={
                            department
                          }
                        >
                          {department}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="device-form-note">
                  <strong>
                    Same DTR URL
                  </strong>

                  <p>
                    The private device token identifies this browser and department. Supabase stores only the token hash.
                  </p>
                </div>

                {errorMessage && (
                  <div className="device-form-error">
                    {errorMessage}
                  </div>
                )}

                <div className="device-form-actions">
                  <button
                    type="button"
                    className="device-cancel-button"
                    onClick={
                      closeForm
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancel
                  </button>

                  {editingDevice ? (
                    <button
                      type="submit"
                      className="device-save-button"
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? 'Saving...'
                        : 'Update Device'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="submit"
                        className="device-secondary-save-button"
                        disabled={
                          saving
                        }
                      >
                        {saving
                          ? 'Saving...'
                          : 'Create Device'}
                      </button>

                      <button
                        type="button"
                        className="device-save-button"
                        onClick={() =>
                          saveDevice(
                            true
                          )
                        }
                        disabled={
                          saving
                        }
                      >
                        {saving
                          ? 'Saving...'
                          : 'Create & Register'}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>,

          document.body
        )
      : null


  // =========================================================
  // PRIVATE TOKEN MODAL
  // =========================================================

  const tokenModal =
    tokenResult
      ? createPortal(
          <div
            className="device-modal-backdrop"
            role="presentation"
          >
            <div
              className="device-token-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="device-token-title"
            >
              <div className="device-modal-header">
                <div>
                  <h2 id="device-token-title">
                    {tokenResult.title}
                  </h2>

                  <p>
                    {tokenResult.device
                      ?.device_name ||
                      'DTR Device'}
                    {' · '}
                    {tokenResult.device
                      ?.department ||
                      ''}
                  </p>
                </div>
              </div>

              <div className="device-token-body">
                <div className="device-token-warning">
                  <strong>
                    Save this token now.
                  </strong>

                  <p>
                    The plaintext token is shown only from this response. The database stores only its SHA-256 hash.
                  </p>
                </div>

                <label className="device-token-label">
                  Private Device Token
                </label>

                <textarea
                  className="device-token-value"
                  value={
                    tokenResult.token
                  }
                  readOnly
                  rows="4"
                  onFocus={(
                    event
                  ) =>
                    event.target.select()
                  }
                />

                {tokenResult.registered && (
                  <div className="device-browser-registered">
                    ✓ This browser is registered with this token.
                  </div>
                )}

                <div className="device-token-actions">
                  <button
                    type="button"
                    className="device-cancel-button"
                    onClick={() =>
                      setTokenResult(
                        null
                      )
                    }
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="device-secondary-save-button"
                    onClick={
                      copyToken
                    }
                  >
                    {tokenCopied
                      ? 'Copied ✓'
                      : 'Copy Token'}
                  </button>

                  <button
                    type="button"
                    className="device-save-button"
                    onClick={() =>
                      registerTokenInBrowser(
                        tokenResult.token
                      )
                    }
                    disabled={
                      tokenResult.registered
                    }
                  >
                    {tokenResult.registered
                      ? 'Registered ✓'
                      : 'Register This Browser'}
                  </button>
                </div>
              </div>
            </div>
          </div>,

          document.body
        )
      : null


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="admin-devices-page">
      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="device-summary-grid">
        <div className="device-summary-card">
          <span>
            Total Devices
          </span>

          <strong>
            {totalDevices}
          </strong>
        </div>

        <div className="device-summary-card">
          <span>
            Active
          </span>

          <strong>
            {activeDevices}
          </strong>
        </div>

        <div className="device-summary-card">
          <span>
            Inactive
          </span>

          <strong>
            {inactiveDevices}
          </strong>
        </div>
      </div>


      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {message && (
        <div className="device-message success">
          {message}
        </div>
      )}

      {errorMessage &&
        !showForm && (
          <div className="device-message error">
            {errorMessage}
          </div>
        )}


      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div className="device-toolbar">
        <div className="device-toolbar-left">
          <div className="device-search-wrapper">
            <span className="device-search-icon">
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
              placeholder="Search device name, department..."
            />
          </div>

          <select
            className="device-filter"
            value={
              departmentFilter
            }
            onChange={(
              event
            ) =>
              setDepartmentFilter(
                event.target.value
              )
            }
            aria-label="Filter by department"
          >
            <option value="all">
              All Departments
            </option>

            {departments.map(
              (department) => (
                <option
                  key={
                    department
                  }
                  value={
                    department
                  }
                >
                  {department}
                </option>
              )
            )}
          </select>

          <select
            className="device-filter"
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
            aria-label="Filter by status"
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
        </div>

        <div className="device-toolbar-actions">
          {browserRegistered && (
            <button
              type="button"
              className="device-clear-browser-button"
              onClick={
                clearBrowserRegistration
              }
            >
              Clear This Browser
            </button>
          )}

          <button
            type="button"
            className="device-add-button"
            onClick={
              openAddDevice
            }
          >
            + Add Device
          </button>
        </div>
      </div>


      {/* =====================================================
          DEVICE TABLE
      ===================================================== */}

      <div className="devices-table-card">
        {loading ? (
          <div className="devices-loading">
            Loading devices...
          </div>
        ) : filteredDevices.length ===
          0 ? (
          <div className="devices-empty">
            No devices found.
          </div>
        ) : (
          <div className="devices-table-wrapper">
            <table className="devices-table">
              <thead>
                <tr>
                  <th>
                    Device
                  </th>

                  <th>
                    Department
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Created
                  </th>

                  <th>
                    Updated
                  </th>

                  <th className="device-actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDevices.map(
                  (device) => {
                    const busy =
                      busyDeviceId ===
                      device.id

                    const active =
                      String(
                        device.status ||
                        ''
                      ).toLowerCase() ===
                      'active'

                    return (
                      <tr
                        key={
                          device.id
                        }
                      >
                        <td>
                          <strong className="device-name-value">
                            {device.device_name}
                          </strong>
                        </td>

                        <td>
                          {device.department ||
                            '—'}
                        </td>

                        <td>
                          <span
                            className={
                              active
                                ? 'device-status active'
                                : 'device-status inactive'
                            }
                          >
                            {active
                              ? 'Active'
                              : 'Inactive'}
                          </span>
                        </td>

                        <td>
                          {formatDateTime(
                            device.created_at
                          )}
                        </td>

                        <td>
                          {formatDateTime(
                            device.updated_at
                          )}
                        </td>

                        <td>
                          <div className="device-row-actions">
                            <button
                              type="button"
                              className="device-edit-button"
                              onClick={() =>
                                openEditDevice(
                                  device
                                )
                              }
                              disabled={
                                busy
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="device-token-button"
                              onClick={() =>
                                regenerateToken(
                                  device
                                )
                              }
                              disabled={
                                busy
                              }
                            >
                              {busy
                                ? 'Please wait...'
                                : 'Regenerate Token'}
                            </button>

                            <button
                              type="button"
                              className={
                                active
                                  ? 'device-status-button deactivate'
                                  : 'device-status-button activate'
                              }
                              onClick={() =>
                                toggleDeviceStatus(
                                  device
                                )
                              }
                              disabled={
                                busy
                              }
                            >
                              {busy
                                ? 'Please wait...'
                                : active
                                ? 'Deactivate'
                                : 'Activate'}
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

      {deviceFormModal}

      {tokenModal}
    </div>
  )
}


export default AdminDevices
