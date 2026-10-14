import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AdminSettings.css'

const normalize = (value) => String(value || '').trim().toLowerCase()
const titleCase = (value) => {
  const text = normalize(value)
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—'
}
const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [savingMode, setSavingMode] = useState(false)
  const [overview, setOverview] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [auditRows, setAuditRows] = useState([])
  const [selectedMode, setSelectedMode] = useState('break_only')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    setMessage('')
    setErrorMessage('')

    try {
      const [overviewResult, accountsResult, auditResult] = await Promise.all([
        supabase.rpc('settings_get_overview'),
        supabase.rpc('settings_list_admin_accounts'),
        supabase.rpc('settings_list_dtr_mode_audit'),
      ])

      if (overviewResult.error) throw overviewResult.error
      if (accountsResult.error) throw accountsResult.error
      if (auditResult.error) throw auditResult.error

      if (overviewResult.data?.success === false) {
        throw new Error(overviewResult.data.message || 'Unable to load Settings.')
      }
      if (accountsResult.data?.success === false) {
        throw new Error(accountsResult.data.message || 'Unable to load admin accounts.')
      }
      if (auditResult.data?.success === false) {
        throw new Error(auditResult.data.message || 'Unable to load DTR mode history.')
      }

      setOverview(overviewResult.data)
      setAccounts(Array.isArray(accountsResult.data?.accounts) ? accountsResult.data.accounts : [])
      setAuditRows(Array.isArray(auditResult.data?.rows) ? auditResult.data.rows : [])
      setSelectedMode(overviewResult.data?.dtr?.mode || 'break_only')
    } catch (error) {
      console.error('Settings load error:', error)
      setOverview(null)
      setAccounts([])
      setAuditRows([])
      setErrorMessage(error?.message || 'Unable to load Settings.')
    } finally {
      setLoading(false)
    }
  }

  const access = overview?.access || {}
  const role = normalize(access.role)
  const canView = Boolean(access.can_view_settings)
  const canManageAccounts = Boolean(access.can_manage_accounts)
  const canChangeDtrMode = Boolean(access.can_change_dtr_mode)

  const counts = useMemo(() => {
    const active = accounts.filter((item) => normalize(item.status) === 'active').length
    return {
      total: accounts.length,
      active,
      inactive: accounts.length - active,
    }
  }, [accounts])

  async function saveMode() {
    if (!canChangeDtrMode) {
      setErrorMessage('Only an Administrator can change DTR mode.')
      return
    }

    setSavingMode(true)
    setMessage('')
    setErrorMessage('')

    try {
      const { data, error } = await supabase.rpc('administrator_set_dtr_mode', {
        p_mode: selectedMode,
      })
      if (error) throw error
      if (data?.success === false) throw new Error(data.message || 'Unable to update DTR mode.')

      setMessage(data?.message || 'DTR mode updated successfully.')
      await loadSettings()
    } catch (error) {
      console.error('DTR mode update error:', error)
      setErrorMessage(error?.message || 'Unable to update DTR mode.')
    } finally {
      setSavingMode(false)
    }
  }

  if (loading) {
    return <div className="admin-settings-page"><div className="settings-state-card">Loading Settings...</div></div>
  }

  if (!overview || !canView) {
    return (
      <div className="admin-settings-page">
        <div className="settings-state-card settings-denied">
          <div className="settings-state-icon">⚙</div>
          <h2>Settings Access Required</h2>
          <p>Settings can only be viewed by Administrator, Manager, or Supervisor accounts.</p>
          {errorMessage && <div className="settings-alert error">{errorMessage}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-settings-page">
      <div className="settings-header">
        <div>
          <h1>Settings</h1>
          <p>Administrative accounts and DTR operating mode.</p>
        </div>
        <span className="settings-chip">{titleCase(role)}</span>
      </div>

      {message && <div className="settings-alert success">{message}</div>}
      {errorMessage && <div className="settings-alert error">{errorMessage}</div>}

      <div className="settings-stats">
        <Stat label="Admin Accounts" value={counts.total} />
        <Stat label="Active" value={counts.active} className="active" />
        <Stat label="Inactive" value={counts.inactive} className="inactive" />
        <Stat label="DTR Mode" value={overview?.dtr?.mode === 'full_dtr' ? 'Full DTR' : 'Break Mode'} compact />
      </div>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <h2>DTR Mode</h2>
            <p>Choose Break Mode or the complete Time In / Break / Time Out workflow.</p>
          </div>
          {!canChangeDtrMode && <span className="settings-chip">Read Only</span>}
        </div>

        <div className="settings-mode-grid">
          <ModeCard
            value="break_only"
            title="Break Mode"
            description="Break Start and Break End only."
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            disabled={!canChangeDtrMode || savingMode}
            features={[['Time In', false], ['Break Start', true], ['Break End', true], ['Time Out', false]]}
          />
          <ModeCard
            value="full_dtr"
            title="Full DTR"
            description="Complete attendance workflow."
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            disabled={!canChangeDtrMode || savingMode}
            features={[['Time In', true], ['Break Start', true], ['Break End', true], ['Time Out', true]]}
          />
        </div>

        <div className="settings-mode-footer">
          <span>Current database mode: <strong>{overview?.dtr?.mode === 'full_dtr' ? 'Full DTR' : 'Break Mode'}</strong></span>
          {canChangeDtrMode ? (
            <button
              type="button"
              className="settings-primary"
              onClick={saveMode}
              disabled={savingMode || selectedMode === overview?.dtr?.mode}
            >
              {savingMode ? 'Applying...' : 'Apply DTR Mode'}
            </button>
          ) : (
            <span className="settings-note">Only an Administrator can change DTR mode.</span>
          )}
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <h2>Admin Accounts</h2>
            <p>Administrator can manage accounts. Manager and Supervisor are view-only.</p>
          </div>
          <div className="settings-head-actions">
            {!canManageAccounts && <span className="settings-chip">Read Only</span>}
            {canManageAccounts && (
              <button type="button" className="settings-primary" disabled title="Enabled in the next stage">
                + Add Account
              </button>
            )}
          </div>
        </div>

        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan="6" className="settings-empty">No administrative accounts found.</td></tr>
              ) : accounts.map((account) => {
                const name = `${account.first_name || ''} ${account.last_name || ''}`.trim() || account.email || 'Admin User'
                const status = normalize(account.status)
                return (
                  <tr key={account.id}>
                    <td>
                      <div className="settings-user">
                        <div className="settings-avatar">{(account.first_name || account.email || 'A').charAt(0).toUpperCase()}</div>
                        <div><strong>{name}</strong><span>{account.email || 'No email'}</span></div>
                      </div>
                    </td>
                    <td>{titleCase(account.role)}</td>
                    <td>{account.department || 'All Departments'}</td>
                    <td><span className={`settings-status ${status === 'active' ? 'active' : 'inactive'}`}>{status === 'active' ? 'Active' : 'Inactive'}</span></td>
                    <td>{formatDateTime(account.last_active_at)}</td>
                    <td>
                      {canManageAccounts ? (
                        <div className="settings-row-actions">
                          <button type="button" disabled>Edit</button>
                          <button type="button" disabled>Manage</button>
                        </div>
                      ) : <span className="settings-note">View only</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {canManageAccounts && <p className="settings-note settings-stage-note">Add / Edit / Deactivate / Delete will be connected in Stage 3.</p>}
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <h2>DTR Mode History</h2>
            <p>Audit history of Administrator changes to the kiosk operating mode.</p>
          </div>
        </div>

        <div className="settings-table-wrap">
          <table className="settings-table settings-audit-table">
            <thead>
              <tr><th>Changed By</th><th>Role</th><th>Previous</th><th>New Mode</th><th>Changed</th></tr>
            </thead>
            <tbody>
              {auditRows.length === 0 ? (
                <tr><td colSpan="5" className="settings-empty">No DTR mode changes recorded yet.</td></tr>
              ) : auditRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.admin_name || 'Administrator'}</td>
                  <td>{titleCase(row.admin_role)}</td>
                  <td>{row.previous_mode === 'full_dtr' ? 'Full DTR' : 'Break Mode'}</td>
                  <td>{row.new_mode === 'full_dtr' ? 'Full DTR' : 'Break Mode'}</td>
                  <td>{formatDateTime(row.changed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, className = '', compact = false }) {
  return (
    <div className="settings-stat">
      <span>{label}</span>
      <strong className={`${className} ${compact ? 'compact' : ''}`}>{value}</strong>
    </div>
  )
}

function ModeCard({ value, title, description, selectedMode, setSelectedMode, disabled, features }) {
  const selected = selectedMode === value
  return (
    <label className={`settings-mode-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
      <input
        type="radio"
        name="dtrMode"
        value={value}
        checked={selected}
        onChange={() => setSelectedMode(value)}
        disabled={disabled}
      />
      <div>
        <div className="settings-mode-title">{title}</div>
        <div className="settings-mode-description">{description}</div>
        <div className="settings-features">
          {features.map(([label, enabled]) => (
            <span key={label} className={enabled ? 'on' : 'off'}>{enabled ? '✓' : '✕'} {label}</span>
          ))}
        </div>
      </div>
    </label>
  )
}

export default AdminSettings
