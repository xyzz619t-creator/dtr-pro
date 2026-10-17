import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import './AdminSchedule.css'

const ALLOWED_DUTY_HOURS = [9, 12]
const WEEKDAY_LABELS = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

function createEmptyPattern() {
  return {
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
    7: '',
  }
}

function createEmptyShiftPattern() {
  return {
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
    7: '',
  }
}

function normalizeScheduleType(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'rotation'
    ? 'rotation'
    : 'weekly'
}

function normalizeDateString(value) {
  return String(value || '').slice(0, 10)
}

function dateSerial(value) {
  const [year, month, day] = normalizeDateString(value)
    .split('-')
    .map(Number)

  if (!year || !month || !day) {
    return null
  }

  return Math.floor(
    Date.UTC(year, month - 1, day) / 86400000
  )
}

function getRotationCycleDay(
  dutyDate,
  anchorDate,
  cycleLength
) {
  const dutySerial = dateSerial(dutyDate)
  const anchorSerial = dateSerial(anchorDate)
  const length = Number(cycleLength)

  if (
    dutySerial === null ||
    anchorSerial === null ||
    !Number.isInteger(length) ||
    length < 2
  ) {
    return null
  }

  const difference = dutySerial - anchorSerial
  return (((difference % length) + length) % length) + 1
}

function AdminSchedule() {
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [schedulesByEmployee, setSchedulesByEmployee] = useState({})

  const [searchTerm, setSearchTerm] = useState('')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`
  })

  const [dirtyOverrideEmployeeIds, setDirtyOverrideEmployeeIds] =
    useState([])
  const [loading, setLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [baseSaving, setBaseSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [baseEditor, setBaseEditor] = useState(null)

  const rosterScrollRef = useRef(null)
  const horizontalScrollRef = useRef(null)
  const [horizontalScrollWidth, setHorizontalScrollWidth] =
    useState(0)

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoading(true)
    setErrorMessage('')

    try {
      const { data, error } = await supabase.rpc(
        'admin_list_schedule_master_scoped'
      )

      if (error) throw error
      if (data?.success !== true) {
        throw new Error(
          data?.message || 'Unable to load schedule data.'
        )
      }

      setEmployees(
        Array.isArray(data?.employees) ? data.employees : []
      )
      setShifts(Array.isArray(data?.shifts) ? data.shifts : [])
    } catch (error) {
      console.error('Initial schedule load error:', error)
      setEmployees([])
      setShifts([])
      setErrorMessage(
        `Unable to load schedule data: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }

  const days = useMemo(() => {
    if (!selectedMonth) return []

    const [year, month] = selectedMonth.split('-').map(Number)
    const totalDays = new Date(year, month, 0).getDate()
    const result = []

    for (let day = 1; day <= totalDays; day += 1) {
      const dateObject = new Date(year, month - 1, day)
      const jsWeekday = dateObject.getDay()
      const weekday = jsWeekday === 0 ? 7 : jsWeekday
      const date = `${year}-${String(month).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`

      result.push({
        day,
        date,
        weekday,
        weekdayName: dateObject.toLocaleDateString('en-US', {
          weekday: 'short',
        }),
      })
    }

    return result
  }, [selectedMonth])

  function getShiftById(shiftId) {
    return shifts.find(
      (shift) => String(shift.id) === String(shiftId)
    )
  }

  function getShiftTypeFromShift(shift) {
    if (!shift) return null
    if (shift.crosses_midnight === true) return 'night'

    const name = String(
      shift.name || shift.shift_name || ''
    ).toLowerCase()

    return name.includes('night') ? 'night' : 'morning'
  }

  function getShiftTypeById(shiftId) {
    return getShiftTypeFromShift(getShiftById(shiftId))
  }

  function getShiftName(shiftId) {
    const shift = getShiftById(shiftId)
    return shift?.name || shift?.shift_name || ''
  }

  function isAllowedDutyHours(hours) {
    return ALLOWED_DUTY_HOURS.includes(Number(hours))
  }

  function getDutyTimes(shiftId, hours) {
    const shiftType = getShiftTypeById(shiftId)
    const numericHours = Number(hours)

    if (
      !shiftType ||
      !isAllowedDutyHours(numericHours)
    ) {
      return null
    }

    if (shiftType === 'morning') {
      if (numericHours === 9) {
        return {
          start: '07:00:00',
          end: '16:00:00',
          nextDay: false,
        }
      }

      return {
        start: '07:00:00',
        end: '19:00:00',
        nextDay: false,
      }
    }

    if (numericHours === 9) {
      return {
        start: '19:00:00',
        end: '04:00:00',
        nextDay: true,
      }
    }

    return {
      start: '19:00:00',
      end: '07:00:00',
      nextDay: true,
    }
  }

  function createEmployeeSchedule(employeeId) {
    return {
      employeeId,
      scheduleType: 'weekly',
      rotationAnchorDate: '',
      rotationCycleLength: 4,
      weeklyPattern: createEmptyPattern(),
      weeklyShiftPattern: createEmptyShiftPattern(),
      rotationPattern: {},
      overrides: {},
      defaultShiftId: '',
      monthSchedule: {},
    }
  }

  function getBaseEntryForDate(schedule, day) {
    if (!schedule || !day) {
      return {
        hours: '',
        isWorking: false,
        shiftId: '',
        source: 'none',
      }
    }

    if (schedule.scheduleType === 'rotation') {
      const cycleDay = getRotationCycleDay(
        day.date,
        schedule.rotationAnchorDate,
        schedule.rotationCycleLength
      )
      const row = cycleDay
        ? schedule.rotationPattern[cycleDay]
        : null

      if (row?.isWorking && isAllowedDutyHours(row.dutyHours)) {
        return {
          hours: Number(row.dutyHours),
          isWorking: true,
          shiftId: row.shiftId || schedule.defaultShiftId || '',
          source: 'rotation',
          cycleDay,
        }
      }

      return {
        hours: '',
        isWorking: false,
        shiftId: '',
        source: 'rotation',
        cycleDay,
      }
    }

    const hours = schedule.weeklyPattern[day.weekday]
    const shiftId =
      schedule.weeklyShiftPattern[day.weekday] ||
      schedule.defaultShiftId ||
      ''

    return {
      hours: isAllowedDutyHours(hours) ? Number(hours) : '',
      isWorking: isAllowedDutyHours(hours),
      shiftId,
      source: 'weekly',
    }
  }

  function buildMonthSchedule(schedule) {
    const monthSchedule = {}

    for (const day of days) {
      const base = getBaseEntryForDate(schedule, day)
      const override = schedule.overrides[day.date]

      if (override) {
        const isWorking =
          override.status === 'scheduled' &&
          isAllowedDutyHours(override.dutyHours)

        monthSchedule[day.date] = {
          hours: isWorking ? Number(override.dutyHours) : '',
          isWorking,
          shiftId: isWorking ? override.shiftId || '' : '',
          baseHours: base.hours,
          baseIsWorking: base.isWorking,
          baseShiftId: base.shiftId,
          hasOverride: true,
          source: 'override',
        }
      } else {
        monthSchedule[day.date] = {
          hours: base.hours,
          isWorking: base.isWorking,
          shiftId: base.shiftId,
          baseHours: base.hours,
          baseIsWorking: base.isWorking,
          baseShiftId: base.shiftId,
          hasOverride: false,
          source: base.source,
        }
      }
    }

    return monthSchedule
  }

  useEffect(() => {
    if (
      employees.length === 0 ||
      shifts.length === 0 ||
      days.length === 0
    ) {
      return
    }

    loadScheduleEngine()
  }, [employees, shifts, selectedMonth])

  async function loadScheduleEngine(clearMessages = true) {
    if (employees.length === 0 || days.length === 0) return

    setScheduleLoading(true)
    if (clearMessages) {
      setMessage('')
      setErrorMessage('')
    }

    try {
      const firstDate = days[0].date
      const lastDate = days[days.length - 1].date
      const { data, error } = await supabase.rpc(
        'admin_get_schedule_engine_scoped',
        {
          p_start_date: firstDate,
          p_end_date: lastDate,
        }
      )

      if (error) throw error
      if (data?.success !== true) {
        throw new Error(
          data?.message || 'Unable to load schedule engine.'
        )
      }

      const configs = Array.isArray(data?.configs)
        ? data.configs
        : []
      const weeklyRows = Array.isArray(data?.weekly_patterns)
        ? data.weekly_patterns
        : []
      const rotationRows = Array.isArray(data?.rotation_patterns)
        ? data.rotation_patterns
        : []
      const overrideRows = Array.isArray(data?.overrides)
        ? data.overrides
        : []

      const activeIds = new Set(
        employees.map((employee) => String(employee.id))
      )
      const nextSchedules = {}

      for (const employee of employees) {
        nextSchedules[employee.id] = createEmployeeSchedule(
          employee.id
        )
      }

      for (const config of configs) {
        if (!activeIds.has(String(config.employee_id))) continue
        const schedule = nextSchedules[config.employee_id]
        if (!schedule) continue

        schedule.scheduleType = normalizeScheduleType(
          config.schedule_type
        )
        schedule.rotationAnchorDate = normalizeDateString(
          config.rotation_anchor_date
        )
        schedule.rotationCycleLength =
          Number(config.rotation_cycle_length) || 4
      }

      for (const row of weeklyRows) {
        if (!activeIds.has(String(row.employee_id))) continue
        const schedule = nextSchedules[row.employee_id]
        if (!schedule) continue

        const weekday = Number(row.weekday)
        if (weekday < 1 || weekday > 7) continue

        if (
          row.is_working === true &&
          isAllowedDutyHours(row.duty_hours)
        ) {
          schedule.weeklyPattern[weekday] = String(
            Number(row.duty_hours)
          )
          schedule.weeklyShiftPattern[weekday] = row.shift_id || ''

          if (!schedule.defaultShiftId && row.shift_id) {
            schedule.defaultShiftId = row.shift_id
          }
        } else {
          schedule.weeklyPattern[weekday] = ''
          schedule.weeklyShiftPattern[weekday] = ''
        }
      }

      for (const row of rotationRows) {
        if (!activeIds.has(String(row.employee_id))) continue
        const schedule = nextSchedules[row.employee_id]
        if (!schedule) continue

        const cycleDay = Number(row.cycle_day)
        if (!Number.isInteger(cycleDay) || cycleDay < 1) continue

        schedule.rotationPattern[cycleDay] = {
          cycleDay,
          isWorking:
            row.is_working === true &&
            isAllowedDutyHours(row.duty_hours),
          dutyHours:
            row.is_working === true &&
            isAllowedDutyHours(row.duty_hours)
              ? Number(row.duty_hours)
              : '',
          shiftId: row.shift_id || '',
        }

        if (
          !schedule.defaultShiftId &&
          row.is_working === true &&
          row.shift_id
        ) {
          schedule.defaultShiftId = row.shift_id
        }
      }

      for (const row of overrideRows) {
        if (!activeIds.has(String(row.employee_id))) continue
        const schedule = nextSchedules[row.employee_id]
        if (!schedule) continue

        const dutyDate = normalizeDateString(row.duty_date)
        if (!dutyDate) continue

        schedule.overrides[dutyDate] = {
          dutyDate,
          status:
            String(row.status || '').toLowerCase() === 'off'
              ? 'off'
              : 'scheduled',
          dutyHours: isAllowedDutyHours(row.duty_hours)
            ? Number(row.duty_hours)
            : '',
          shiftId: row.shift_id || '',
          notes: row.notes || '',
        }
      }

      for (const employee of employees) {
        const schedule = nextSchedules[employee.id]
        schedule.monthSchedule = buildMonthSchedule(schedule)
      }

      setSchedulesByEmployee(nextSchedules)
      setDirtyOverrideEmployeeIds([])
    } catch (error) {
      console.error('Schedule engine load error:', error)
      setErrorMessage(
        `Unable to load employee schedules: ${error.message}`
      )
    } finally {
      setScheduleLoading(false)
    }
  }

  const filteredEmployees = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return employees.filter((employee) => {
      if (keyword) {
        const searchableText = [
          employee.employee_code,
          employee.first_name,
          employee.last_name,
          employee.department,
          employee.position,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!searchableText.includes(keyword)) return false
      }

      if (shiftFilter !== 'all') {
        const schedule = schedulesByEmployee[employee.id]
        const type = getShiftTypeById(schedule?.defaultShiftId)
        if (type !== shiftFilter) return false
      }

      return true
    })
  }, [
    employees,
    searchTerm,
    shiftFilter,
    schedulesByEmployee,
    shifts,
  ])

  useEffect(() => {
    const roster = rosterScrollRef.current
    if (!roster) return

    function updateScrollWidth() {
      setHorizontalScrollWidth(roster.scrollWidth)
      if (horizontalScrollRef.current) {
        horizontalScrollRef.current.scrollLeft = roster.scrollLeft
      }
    }

    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(roster)

    const table = roster.querySelector('.roster-table')
    if (table) resizeObserver.observe(table)

    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [days, filteredEmployees, schedulesByEmployee, scheduleLoading])

  function handleRosterScroll() {
    if (
      !rosterScrollRef.current ||
      !horizontalScrollRef.current
    ) {
      return
    }

    horizontalScrollRef.current.scrollLeft =
      rosterScrollRef.current.scrollLeft
  }

  function handleHorizontalScroll() {
    if (
      !rosterScrollRef.current ||
      !horizontalScrollRef.current
    ) {
      return
    }

    rosterScrollRef.current.scrollLeft =
      horizontalScrollRef.current.scrollLeft
  }

  function markOverrideDirty(employeeId) {
    setDirtyOverrideEmployeeIds((previous) => {
      if (previous.includes(employeeId)) return previous
      return [...previous, employeeId]
    })
  }

  function changeMonthDay(employeeId, date, value) {
    if (value && !isAllowedDutyHours(value)) {
      setErrorMessage(
        'Duty hours must be either 9 hours or 12 hours.'
      )
      return
    }

    const selectedDay = days.find((day) => day.date === date)
    const employeeSchedule = schedulesByEmployee[employeeId]

    if (!selectedDay || !employeeSchedule) return

    const base = getBaseEntryForDate(
      employeeSchedule,
      selectedDay
    )
    const selectedHours = value ? Number(value) : ''
    const baseHours = base.isWorking ? Number(base.hours) : ''
    const matchesBase =
      String(selectedHours) === String(baseHours)

    let overrideShiftId = ''

    if (selectedHours && !matchesBase) {
      overrideShiftId =
        base.shiftId || employeeSchedule.defaultShiftId || ''

      if (!overrideShiftId) {
        setErrorMessage(
          'Configure a base shift for this employee before adding a working-day override.'
        )
        return
      }

      if (!getDutyTimes(overrideShiftId, selectedHours)) {
        setErrorMessage(
          'The selected shift cannot be used with those duty hours.'
        )
        return
      }
    }

    setSchedulesByEmployee((previous) => {
      const current = previous[employeeId]
      if (!current) return previous

      const overrides = {
        ...current.overrides,
      }

      if (matchesBase) {
        delete overrides[date]
      } else if (!selectedHours) {
        overrides[date] = {
          dutyDate: date,
          status: 'off',
          dutyHours: '',
          shiftId: '',
          notes: 'Specific-date OFF override',
        }
      } else {
        overrides[date] = {
          dutyDate: date,
          status: 'scheduled',
          dutyHours: selectedHours,
          shiftId: overrideShiftId,
          notes: `${selectedHours} hour specific-date override`,
        }
      }

      const next = {
        ...current,
        overrides,
      }
      next.monthSchedule = buildMonthSchedule(next)

      return {
        ...previous,
        [employeeId]: next,
      }
    })

    markOverrideDirty(employeeId)
    setMessage('')
    setErrorMessage('')
  }

  function clearVisibleOverrides() {
    if (filteredEmployees.length === 0) return

    const confirmed = window.confirm(
      `Remove all specific-date overrides in ${getMonthTitle()} for ${filteredEmployees.length} visible employee(s)? Base weekly/rotation schedules will remain unchanged.`
    )

    if (!confirmed) return

    const visibleIds = filteredEmployees.map(
      (employee) => employee.id
    )

    setSchedulesByEmployee((previous) => {
      const updated = { ...previous }

      for (const employeeId of visibleIds) {
        const current = updated[employeeId]
        if (!current) continue

        const next = {
          ...current,
          overrides: {},
        }
        next.monthSchedule = buildMonthSchedule(next)
        updated[employeeId] = next
      }

      return updated
    })

    for (const employeeId of visibleIds) {
      markOverrideDirty(employeeId)
    }

    setMessage('')
    setErrorMessage('')
  }

  async function saveOverrides() {
    if (dirtyOverrideEmployeeIds.length === 0) {
      setMessage('No specific-date changes to save.')
      return
    }

    if (!selectedMonth || days.length === 0) {
      setErrorMessage('Please select a month.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      const overrideRows = []

      for (const employeeId of dirtyOverrideEmployeeIds) {
        const schedule = schedulesByEmployee[employeeId]
        if (!schedule) continue

        for (const day of days) {
          const item = schedule.overrides[day.date]
          if (!item) continue

          if (item.status === 'off') {
            overrideRows.push({
              employee_id: employeeId,
              duty_date: day.date,
              status: 'off',
              shift_id: null,
              duty_hours: null,
              scheduled_start_time: null,
              scheduled_end_time: null,
              scheduled_end_next_day: false,
              notes: item.notes || 'Specific-date OFF override',
            })
            continue
          }

          if (!isAllowedDutyHours(item.dutyHours)) {
            throw new Error(
              'A specific-date override contains invalid duty hours.'
            )
          }

          const shiftId = item.shiftId || schedule.defaultShiftId
          const times = getDutyTimes(shiftId, item.dutyHours)

          if (!shiftId || !times) {
            throw new Error(
              'A working-day override is missing a valid shift.'
            )
          }

          overrideRows.push({
            employee_id: employeeId,
            duty_date: day.date,
            status: 'scheduled',
            shift_id: shiftId,
            duty_hours: Number(item.dutyHours),
            scheduled_start_time: times.start,
            scheduled_end_time: times.end,
            scheduled_end_next_day: times.nextDay,
            notes:
              item.notes ||
              `${item.dutyHours} hour specific-date override`,
          })
        }
      }

      const { data, error } = await supabase.rpc(
        'admin_save_schedule_overrides_bulk_scoped',
        {
          p_employee_ids: dirtyOverrideEmployeeIds,
          p_start_date: days[0].date,
          p_end_date: days[days.length - 1].date,
          p_override_rows: overrideRows,
        }
      )

      if (error) throw error
      if (data?.success !== true) {
        throw new Error(
          data?.message || 'Unable to save specific-date overrides.'
        )
      }

      await loadScheduleEngine(false)
      setMessage(
        'Specific-date changes saved. Base weekly/rotation schedules were not changed.'
      )
    } catch (error) {
      console.error('Schedule override save error:', error)
      setErrorMessage(
        `Unable to save specific-date changes: ${error.message}`
      )
    } finally {
      setSaving(false)
    }
  }

  function getBaseEditorPattern(schedule, cycleLength) {
    const result = {}
    for (let cycleDay = 1; cycleDay <= cycleLength; cycleDay += 1) {
      const row = schedule?.rotationPattern?.[cycleDay]
      result[cycleDay] =
        row?.isWorking && isAllowedDutyHours(row.dutyHours)
          ? String(row.dutyHours)
          : ''
    }
    return result
  }

  function openBaseEditor(employee) {
    const schedule =
      schedulesByEmployee[employee.id] ||
      createEmployeeSchedule(employee.id)
    const cycleLength = Math.max(
      2,
      Math.min(31, Number(schedule.rotationCycleLength) || 4)
    )

    setBaseEditor({
      employeeId: employee.id,
      employeeName: `${employee.first_name || ''} ${
        employee.last_name || ''
      }`.trim(),
      scheduleType: schedule.scheduleType,
      shiftId: schedule.defaultShiftId || '',
      weeklyPattern: {
        ...schedule.weeklyPattern,
      },
      rotationAnchorDate:
        schedule.rotationAnchorDate || days[0]?.date || '',
      rotationCycleLength: cycleLength,
      rotationPattern: getBaseEditorPattern(
        schedule,
        cycleLength
      ),
    })

    setMessage('')
    setErrorMessage('')
  }

  function updateBaseEditorCycleLength(nextValue) {
    const nextLength = Math.max(
      2,
      Math.min(31, Number(nextValue) || 2)
    )

    setBaseEditor((current) => {
      if (!current) return current

      const rotationPattern = {}
      for (let day = 1; day <= nextLength; day += 1) {
        rotationPattern[day] = current.rotationPattern[day] || ''
      }

      return {
        ...current,
        rotationCycleLength: nextLength,
        rotationPattern,
      }
    })
  }

  async function saveBaseSchedule() {
    if (!baseEditor) return

    const workingValues =
      baseEditor.scheduleType === 'weekly'
        ? Object.values(baseEditor.weeklyPattern)
        : Object.values(baseEditor.rotationPattern)
    const hasWorkingDays = workingValues.some(Boolean)

    if (hasWorkingDays && !baseEditor.shiftId) {
      setErrorMessage(
        'Select a shift before saving working days.'
      )
      return
    }

    setBaseSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      if (baseEditor.scheduleType === 'weekly') {
        const weeklyRows = []

        for (let weekday = 1; weekday <= 7; weekday += 1) {
          const hours = baseEditor.weeklyPattern[weekday]

          if (!hours) {
            weeklyRows.push({
              weekday,
              is_working: false,
              shift_id: null,
              duty_hours: null,
              scheduled_start_time: null,
              scheduled_end_time: null,
              scheduled_end_next_day: false,
            })
            continue
          }

          if (!isAllowedDutyHours(hours)) {
            throw new Error(
              'Weekly duty hours must be 9 or 12.'
            )
          }

          const times = getDutyTimes(baseEditor.shiftId, hours)
          if (!times) {
            throw new Error('Invalid weekly shift or duty hours.')
          }

          weeklyRows.push({
            weekday,
            is_working: true,
            shift_id: baseEditor.shiftId,
            duty_hours: Number(hours),
            scheduled_start_time: times.start,
            scheduled_end_time: times.end,
            scheduled_end_next_day: times.nextDay,
          })
        }

        const { data, error } = await supabase.rpc(
          'admin_save_weekly_schedule_base_scoped',
          {
            p_employee_id: baseEditor.employeeId,
            p_weekly_rows: weeklyRows,
          }
        )

        if (error) throw error
        if (data?.success !== true) {
          throw new Error(
            data?.message || 'Unable to save weekly base schedule.'
          )
        }
      } else {
        const cycleLength = Number(
          baseEditor.rotationCycleLength
        )

        if (
          !baseEditor.rotationAnchorDate ||
          !Number.isInteger(cycleLength) ||
          cycleLength < 2 ||
          cycleLength > 31
        ) {
          throw new Error(
            'Rotation requires an anchor date and a cycle length from 2 to 31 days.'
          )
        }

        const rotationRows = []
        for (let cycleDay = 1; cycleDay <= cycleLength; cycleDay += 1) {
          const hours = baseEditor.rotationPattern[cycleDay]

          if (!hours) {
            rotationRows.push({
              cycle_day: cycleDay,
              is_working: false,
              shift_id: null,
              duty_hours: null,
              scheduled_start_time: null,
              scheduled_end_time: null,
              scheduled_end_next_day: false,
            })
            continue
          }

          if (!isAllowedDutyHours(hours)) {
            throw new Error(
              'Rotation duty hours must be 9 or 12.'
            )
          }

          const times = getDutyTimes(baseEditor.shiftId, hours)
          if (!times) {
            throw new Error('Invalid rotation shift or duty hours.')
          }

          rotationRows.push({
            cycle_day: cycleDay,
            is_working: true,
            shift_id: baseEditor.shiftId,
            duty_hours: Number(hours),
            scheduled_start_time: times.start,
            scheduled_end_time: times.end,
            scheduled_end_next_day: times.nextDay,
          })
        }

        const { data, error } = await supabase.rpc(
          'admin_save_schedule_base_scoped',
          {
            p_employee_id: baseEditor.employeeId,
            p_schedule_type: 'rotation',
            p_rotation_anchor_date: baseEditor.rotationAnchorDate,
            p_rotation_cycle_length: cycleLength,
            p_rotation_rows: rotationRows,
          }
        )

        if (error) throw error
        if (data?.success !== true) {
          throw new Error(
            data?.message || 'Unable to save rotation base schedule.'
          )
        }
      }

      setBaseEditor(null)
      await loadScheduleEngine(false)
      setMessage(
        'Base schedule saved. Existing specific-date overrides remain in place.'
      )
    } catch (error) {
      console.error('Base schedule save error:', error)
      setErrorMessage(
        `Unable to save base schedule: ${error.message}`
      )
    } finally {
      setBaseSaving(false)
    }
  }

  function handleMonthChange(event) {
    const nextMonth = event.target.value

    if (dirtyOverrideEmployeeIds.length > 0) {
      const confirmed = window.confirm(
        'You have unsaved specific-date changes. Change month and discard those changes?'
      )
      if (!confirmed) return
    }

    setDirtyOverrideEmployeeIds([])
    setSelectedMonth(nextMonth)
    setMessage('')
    setErrorMessage('')
  }

  function getMonthTitle() {
    if (!selectedMonth) return ''
    const [year, month] = selectedMonth.split('-').map(Number)

    return new Date(year, month - 1, 1).toLocaleDateString(
      'en-US',
      {
        month: 'long',
        year: 'numeric',
      }
    )
  }

  if (loading) {
    return (
      <div className="admin-schedule-page">
        <div className="admin-schedule-loading">
          Loading schedule...
        </div>
      </div>
    )
  }

  return (
    <div className="admin-schedule-page">
      <div className="schedule-stage-banner">
        <strong>Stage 2 schedule engine test</strong>
        <span>
          Weekly/Rotation bases and specific-date overrides are stored in the new engine. The employee DTR remains on the current live resolver until Stage 3.
        </span>
      </div>

      <div className="schedule-controls">
        <div className="control-group schedule-search-group">
          <label>Search Employee</label>
          <div className="schedule-search-box">
            <span>🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search code, name, department or position..."
            />
          </div>
        </div>

        <div className="control-group">
          <label>Shift Filter</label>
          <select
            value={shiftFilter}
            onChange={(event) => setShiftFilter(event.target.value)}
          >
            <option value="all">All Shifts</option>
            <option value="morning">Morning</option>
            <option value="night">Night</option>
          </select>
        </div>

        <div className="control-group">
          <label>Month</label>
          <input
            className="schedule-month-input"
            type="month"
            value={selectedMonth}
            onChange={handleMonthChange}
          />
        </div>
      </div>

      {errorMessage && (
        <div className="schedule-message schedule-error-message">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="schedule-message">{message}</div>
      )}

      <div className="schedule-month-heading">
        <div className="schedule-month-center">
          <h2>{getMonthTitle()}</h2>
          <p>
            Calendar edits affect only that exact date. Unchanged dates continue from the employee&apos;s Weekly or Rotation base schedule.
          </p>
        </div>

        <div className="schedule-month-actions">
          <button
            type="button"
            className="clear-button"
            onClick={clearVisibleOverrides}
            disabled={saving || filteredEmployees.length === 0}
          >
            Clear Overrides
          </button>

          <button
            type="button"
            className="save-button"
            onClick={saveOverrides}
            disabled={
              saving || dirtyOverrideEmployeeIds.length === 0
            }
          >
            {saving
              ? 'Saving...'
              : dirtyOverrideEmployeeIds.length > 0
              ? `Save Date Changes (${dirtyOverrideEmployeeIds.length})`
              : 'Save Date Changes'}
          </button>
        </div>
      </div>

      <div className="schedule-roster-area">
        {scheduleLoading ? (
          <div className="schedule-empty">
            Loading employee schedules...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="schedule-empty">
            No employees match the current search or shift filter.
          </div>
        ) : (
          <>
            <div
              ref={rosterScrollRef}
              className="roster-wrapper"
              onScroll={handleRosterScroll}
            >
              <table className="roster-table">
                <thead>
                  <tr>
                    <th className="employee-column">Employee</th>
                    {days.map((day) => (
                      <th
                        key={day.date}
                        className={day.weekday >= 6 ? 'weekend' : ''}
                      >
                        <div>{day.day}</div>
                        <small>{day.weekdayName}</small>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => {
                    const employeeSchedule =
                      schedulesByEmployee[employee.id] ||
                      createEmployeeSchedule(employee.id)
                    const isDirty =
                      dirtyOverrideEmployeeIds.includes(employee.id)
                    const shiftName = getShiftName(
                      employeeSchedule.defaultShiftId
                    )

                    return (
                      <tr key={employee.id}>
                        <td className="employee-cell">
                          <div className="employee-roster-name">
                            <strong>
                              {employee.first_name}{' '}
                              {employee.last_name}
                            </strong>
                            {isDirty && (
                              <span className="schedule-dirty-badge">
                                Unsaved
                              </span>
                            )}
                          </div>

                          <small>
                            {employee.employee_code}
                            {employee.department
                              ? ` • ${employee.department}`
                              : ''}
                          </small>

                          <div className="schedule-base-summary">
                            <span className="schedule-base-type">
                              {employeeSchedule.scheduleType ===
                              'rotation'
                                ? 'Rotation'
                                : 'Weekly'}
                            </span>
                            <span className="schedule-base-shift">
                              {shiftName || 'No shift'}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="schedule-configure-button"
                            onClick={() => openBaseEditor(employee)}
                            disabled={saving || baseSaving}
                          >
                            Configure Base
                          </button>
                        </td>

                        {days.map((day) => {
                          const item =
                            employeeSchedule.monthSchedule[day.date] || {
                              hours: '',
                              hasOverride: false,
                            }
                          const rawValue = item.hours || ''
                          const value = isAllowedDutyHours(rawValue)
                            ? String(rawValue)
                            : ''

                          const classNames = [
                            value ? 'duty-cell' : 'off-cell',
                            item.hasOverride ? 'override-cell' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')

                          return (
                            <td
                              key={day.date}
                              className={classNames}
                              title={
                                item.hasOverride
                                  ? 'Specific-date override'
                                  : `Base ${employeeSchedule.scheduleType} schedule`
                              }
                            >
                              <select
                                value={value}
                                disabled={saving || baseSaving}
                                onChange={(event) =>
                                  changeMonthDay(
                                    employee.id,
                                    day.date,
                                    event.target.value
                                  )
                                }
                              >
                                <option value="">OFF</option>
                                <option value="9">9</option>
                                <option value="12">12</option>
                              </select>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div
              ref={horizontalScrollRef}
              className="schedule-horizontal-scroll"
              onScroll={handleHorizontalScroll}
            >
              <div
                className="schedule-horizontal-scroll-inner"
                style={{ width: `${horizontalScrollWidth}px` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="schedule-legend">
        <div>
          <span className="legend-duty">9</span>
          9-hour duty
        </div>
        <div>
          <span className="legend-duty">12</span>
          12-hour duty
        </div>
        <div>
          <span className="legend-off">OFF</span>
          Day off
        </div>
        <div>
          <span className="legend-override">●</span>
          Specific-date override
        </div>
        <div>
          <span className="legend-night">🌙</span>
          Night shift ends next day
        </div>
      </div>

      {baseEditor && (
        <div
          className="schedule-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !baseSaving) {
              setBaseEditor(null)
            }
          }}
        >
          <div className="schedule-modal">
            <div className="schedule-modal-header">
              <div>
                <h3>Configure Base Schedule</h3>
                <p>{baseEditor.employeeName}</p>
              </div>
              <button
                type="button"
                className="schedule-modal-close"
                onClick={() => setBaseEditor(null)}
                disabled={baseSaving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="schedule-modal-body">
              <div className="schedule-base-form-row">
                <label>
                  <span>Schedule Type</span>
                  <select
                    value={baseEditor.scheduleType}
                    onChange={(event) =>
                      setBaseEditor((current) => ({
                        ...current,
                        scheduleType: event.target.value,
                      }))
                    }
                    disabled={baseSaving}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="rotation">Rotation</option>
                  </select>
                </label>

                <label>
                  <span>Shift</span>
                  <select
                    value={baseEditor.shiftId}
                    onChange={(event) =>
                      setBaseEditor((current) => ({
                        ...current,
                        shiftId: event.target.value,
                      }))
                    }
                    disabled={baseSaving}
                  >
                    <option value="">Select Shift</option>
                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name || shift.shift_name || 'Shift'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {baseEditor.scheduleType === 'weekly' ? (
                <div className="schedule-pattern-section">
                  <div className="schedule-pattern-heading">
                    <strong>Weekly Pattern</strong>
                    <span>
                      This base repeats every Monday through Sunday.
                    </span>
                  </div>

                  <div className="schedule-pattern-grid weekly-grid">
                    {Object.entries(WEEKDAY_LABELS).map(
                      ([weekday, label]) => (
                        <label
                          key={weekday}
                          className="schedule-pattern-card"
                        >
                          <span>{label}</span>
                          <select
                            value={
                              baseEditor.weeklyPattern[weekday] || ''
                            }
                            onChange={(event) =>
                              setBaseEditor((current) => ({
                                ...current,
                                weeklyPattern: {
                                  ...current.weeklyPattern,
                                  [weekday]: event.target.value,
                                },
                              }))
                            }
                            disabled={baseSaving}
                          >
                            <option value="">OFF</option>
                            <option value="9">9 Hours</option>
                            <option value="12">12 Hours</option>
                          </select>
                        </label>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="schedule-pattern-section">
                  <div className="schedule-base-form-row rotation-config-row">
                    <label>
                      <span>Anchor Date</span>
                      <input
                        type="date"
                        value={baseEditor.rotationAnchorDate}
                        onChange={(event) =>
                          setBaseEditor((current) => ({
                            ...current,
                            rotationAnchorDate: event.target.value,
                          }))
                        }
                        disabled={baseSaving}
                      />
                    </label>

                    <label>
                      <span>Cycle Length</span>
                      <input
                        type="number"
                        min="2"
                        max="31"
                        value={baseEditor.rotationCycleLength}
                        onChange={(event) =>
                          updateBaseEditorCycleLength(
                            event.target.value
                          )
                        }
                        disabled={baseSaving}
                      />
                    </label>
                  </div>

                  <div className="schedule-pattern-heading">
                    <strong>Rotation Pattern</strong>
                    <span>
                      The cycle repeats continuously from the anchor date. A one-day calendar override never shifts the cycle.
                    </span>
                  </div>

                  <div className="schedule-pattern-grid rotation-grid">
                    {Array.from(
                      {
                        length: Number(
                          baseEditor.rotationCycleLength
                        ),
                      },
                      (_, index) => index + 1
                    ).map((cycleDay) => (
                      <label
                        key={cycleDay}
                        className="schedule-pattern-card"
                      >
                        <span>Day {cycleDay}</span>
                        <select
                          value={
                            baseEditor.rotationPattern[cycleDay] || ''
                          }
                          onChange={(event) =>
                            setBaseEditor((current) => ({
                              ...current,
                              rotationPattern: {
                                ...current.rotationPattern,
                                [cycleDay]: event.target.value,
                              },
                            }))
                          }
                          disabled={baseSaving}
                        >
                          <option value="">OFF</option>
                          <option value="9">9 Hours</option>
                          <option value="12">12 Hours</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="schedule-modal-footer">
              <button
                type="button"
                className="clear-button"
                onClick={() => setBaseEditor(null)}
                disabled={baseSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-button"
                onClick={saveBaseSchedule}
                disabled={baseSaving}
              >
                {baseSaving ? 'Saving Base...' : 'Save Base Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSchedule
