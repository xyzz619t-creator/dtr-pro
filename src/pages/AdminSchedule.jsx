import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  supabase,
} from '../lib/supabase'

import './AdminSchedule.css'


// ===========================================================
// ALLOWED DUTY HOURS
// ===========================================================

const ALLOWED_DUTY_HOURS = [
  9,
  12,
]


// ===========================================================
// EMPTY WEEKLY PATTERN
// Monday = 1
// Sunday = 7
// ===========================================================

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


function AdminSchedule() {
  // =========================================================
  // MASTER DATA
  // =========================================================

  const [
    employees,
    setEmployees,
  ] = useState([])

  const [
    shifts,
    setShifts,
  ] = useState([])


  // =========================================================
  // SCHEDULE DATA
  // =========================================================

  const [
    schedulesByEmployee,
    setSchedulesByEmployee,
  ] = useState({})


  // =========================================================
  // FILTERS
  // =========================================================

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('')

  const [
    shiftFilter,
    setShiftFilter,
  ] = useState('all')

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(() => {
    const now =
      new Date()

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    )}`
  })


  // =========================================================
  // CHANGES
  // =========================================================

  const [
    dirtyEmployeeIds,
    setDirtyEmployeeIds,
  ] = useState([])


  // =========================================================
  // UI
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    scheduleLoading,
    setScheduleLoading,
  ] = useState(false)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')


  // =========================================================
  // HORIZONTAL SCROLL
  // =========================================================

  const rosterScrollRef =
    useRef(null)

  const horizontalScrollRef =
    useRef(null)

  const [
    horizontalScrollWidth,
    setHorizontalScrollWidth,
  ] = useState(0)


  // =========================================================
  // LOAD MASTER DATA
  // =========================================================

  useEffect(() => {
    loadInitialData()
  }, [])


  async function loadInitialData() {
    setLoading(true)
    setErrorMessage('')

    try {
      const [
        employeeResult,
        shiftResult,
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
            .eq(
              'status',
              'active'
            )
            .order(
              'first_name'
            ),

          supabase
            .from(
              'shifts'
            )
            .select('*')
            .order(
              'name'
            ),
        ])


      if (
        employeeResult.error
      ) {
        throw employeeResult.error
      }


      if (
        shiftResult.error
      ) {
        throw shiftResult.error
      }


      setEmployees(
        employeeResult.data ||
        []
      )

      setShifts(
        shiftResult.data ||
        []
      )
    } catch (error) {
      console.error(
        'Initial schedule load error:',
        error
      )

      setErrorMessage(
        `Unable to load schedule data: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }


  // =========================================================
  // MONTH DAYS
  // =========================================================

  const days =
    useMemo(() => {
      if (!selectedMonth) {
        return []
      }


      const [
        year,
        month,
      ] =
        selectedMonth
          .split('-')
          .map(Number)


      const totalDays =
        new Date(
          year,
          month,
          0
        ).getDate()


      const result = []


      for (
        let day = 1;
        day <= totalDays;
        day++
      ) {
        const dateObject =
          new Date(
            year,
            month - 1,
            day
          )


        const jsWeekday =
          dateObject.getDay()


        const weekday =
          jsWeekday === 0
            ? 7
            : jsWeekday


        const date =
          `${year}-${String(
            month
          ).padStart(
            2,
            '0'
          )}-${String(
            day
          ).padStart(
            2,
            '0'
          )}`


        result.push({
          day,
          date,
          weekday,

          weekdayName:
            dateObject
              .toLocaleDateString(
                'en-US',
                {
                  weekday:
                    'short',
                }
              ),
        })
      }


      return result
    }, [
      selectedMonth,
    ])


  // =========================================================
  // SHIFT HELPERS
  // =========================================================

  function getShiftById(
    shiftId
  ) {
    return shifts.find(
      (shift) =>
        String(
          shift.id
        ) ===
        String(
          shiftId
        )
    )
  }


  function getShiftTypeFromShift(
    shift
  ) {
    if (!shift) {
      return null
    }


    if (
      shift.crosses_midnight ===
      true
    ) {
      return 'night'
    }


    const name =
      String(
        shift.name ||
        shift.shift_name ||
        ''
      ).toLowerCase()


    if (
      name.includes(
        'night'
      )
    ) {
      return 'night'
    }


    return 'morning'
  }


  function getShiftTypeById(
    shiftId
  ) {
    return getShiftTypeFromShift(
      getShiftById(
        shiftId
      )
    )
  }


  // =========================================================
  // VALID DUTY HOURS
  // =========================================================

  function isAllowedDutyHours(
    hours
  ) {
    return ALLOWED_DUTY_HOURS.includes(
      Number(hours)
    )
  }


  // =========================================================
  // GET DUTY TIMES
  // =========================================================

  function getDutyTimes(
    shiftId,
    hours
  ) {
    const shift =
      getShiftById(
        shiftId
      )


    const shiftType =
      getShiftTypeFromShift(
        shift
      )


    const numericHours =
      Number(hours)


    if (
      !shiftType ||
      !isAllowedDutyHours(
        numericHours
      )
    ) {
      return null
    }


    // =======================================================
    // MORNING
    // =======================================================

    if (
      shiftType ===
      'morning'
    ) {
      if (
        numericHours ===
        9
      ) {
        return {
          start:
            '07:00:00',

          end:
            '16:00:00',

          nextDay:
            false,
        }
      }


      if (
        numericHours ===
        12
      ) {
        return {
          start:
            '07:00:00',

          end:
            '19:00:00',

          nextDay:
            false,
        }
      }
    }


    // =======================================================
    // NIGHT
    // =======================================================

    if (
      shiftType ===
      'night'
    ) {
      if (
        numericHours ===
        9
      ) {
        return {
          start:
            '19:00:00',

          end:
            '04:00:00',

          nextDay:
            true,
        }
      }


      if (
        numericHours ===
        12
      ) {
        return {
          start:
            '19:00:00',

          end:
            '07:00:00',

          nextDay:
            true,
        }
      }
    }


    return null
  }


  // =========================================================
  // TIME HELPERS
  // =========================================================

  function timeToMinutes(
    time
  ) {
    const [
      hours,
      minutes,
    ] =
      String(time)
        .substring(
          0,
          5
        )
        .split(':')
        .map(Number)


    return (
      hours * 60 +
      minutes
    )
  }


  function calculateHours(
    start,
    end,
    nextDay
  ) {
    if (
      !start ||
      !end
    ) {
      return ''
    }


    const startMinutes =
      timeToMinutes(
        start
      )


    let endMinutes =
      timeToMinutes(
        end
      )


    if (nextDay) {
      endMinutes +=
        1440
    }


    const totalHours =
      (
        endMinutes -
        startMinutes
      ) / 60


    if (
      isAllowedDutyHours(
        totalHours
      )
    ) {
      return String(
        totalHours
      )
    }


    return ''
  }


  // =========================================================
  // LOAD SCHEDULES
  // =========================================================

  useEffect(() => {
    if (
      employees.length ===
        0 ||
      shifts.length ===
        0 ||
      days.length ===
        0
    ) {
      return
    }


    loadAllSchedules()
  }, [
    employees,
    shifts,
    selectedMonth,
  ])


  async function loadAllSchedules(
    clearMessages = true
  ) {
    if (
      employees.length ===
        0 ||
      days.length ===
        0
    ) {
      return
    }


    setScheduleLoading(
      true
    )


    if (
      clearMessages
    ) {
      setMessage('')
      setErrorMessage('')
    }


    try {
      const firstDate =
        days[0].date


      const lastDate =
        days[
          days.length - 1
        ].date


      const [
        patternResult,
        datedResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'employee_weekly_schedule_patterns'
            )
            .select(`
              employee_id,
              weekday,
              is_working,
              shift_id,
              duty_hours,
              scheduled_start_time,
              scheduled_end_time,
              scheduled_end_next_day,
              status
            `)
            .eq(
              'status',
              'active'
            ),

          supabase
            .from(
              'employee_schedules'
            )
            .select(`
              employee_id,
              duty_date,
              shift_id,
              status,
              scheduled_start_time,
              scheduled_end_time,
              scheduled_end_next_day
            `)
            .eq(
              'status',
              'scheduled'
            )
            .gte(
              'duty_date',
              firstDate
            )
            .lte(
              'duty_date',
              lastDate
            ),
        ])


      if (
        patternResult.error
      ) {
        throw patternResult.error
      }


      if (
        datedResult.error
      ) {
        throw datedResult.error
      }


      const activeIds =
        new Set(
          employees.map(
            (employee) =>
              String(
                employee.id
              )
          )
        )


      const nextSchedules = {}


      // =====================================================
      // INITIALIZE EMPLOYEES
      // =====================================================

      for (
        const employee of
        employees
      ) {
        nextSchedules[
          employee.id
        ] = {
          shiftId:
            '',

          weeklyPattern:
            createEmptyPattern(),

          monthSchedule:
            {},
        }
      }


      // =====================================================
      // APPLY WEEKLY PATTERNS
      // =====================================================

      for (
        const row of
        patternResult.data ||
        []
      ) {
        if (
          !activeIds.has(
            String(
              row.employee_id
            )
          )
        ) {
          continue
        }


        const employeeSchedule =
          nextSchedules[
            row.employee_id
          ]


        if (
          !employeeSchedule
        ) {
          continue
        }


        const dutyHours =
          Number(
            row.duty_hours
          )


        if (
          row.is_working &&
          isAllowedDutyHours(
            dutyHours
          )
        ) {
          employeeSchedule
            .weeklyPattern[
              row.weekday
            ] =
              String(
                dutyHours
              )


          if (
            !employeeSchedule
              .shiftId &&
            row.shift_id
          ) {
            employeeSchedule
              .shiftId =
                row.shift_id
          }
        } else {
          employeeSchedule
            .weeklyPattern[
              row.weekday
            ] = ''
        }
      }


      // =====================================================
      // DATED SCHEDULE SHIFT
      // =====================================================

      for (
        const row of
        datedResult.data ||
        []
      ) {
        if (
          !activeIds.has(
            String(
              row.employee_id
            )
          )
        ) {
          continue
        }


        const employeeSchedule =
          nextSchedules[
            row.employee_id
          ]


        if (
          employeeSchedule &&
          !employeeSchedule
            .shiftId &&
          row.shift_id
        ) {
          employeeSchedule
            .shiftId =
              row.shift_id
        }
      }


      // =====================================================
      // GENERATE MONTH
      // =====================================================

      for (
        const employee of
        employees
      ) {
        const employeeSchedule =
          nextSchedules[
            employee.id
          ]


        for (
          const day of
          days
        ) {
          const hours =
            employeeSchedule
              .weeklyPattern[
                day.weekday
              ]


          employeeSchedule
            .monthSchedule[
              day.date
            ] = {
              hours:
                hours
                  ? Number(
                      hours
                    )
                  : '',

              isWorking:
                Boolean(
                  hours
                ),
            }
        }
      }


      // =====================================================
      // OVERLAY DATED SCHEDULES
      // =====================================================

      for (
        const row of
        datedResult.data ||
        []
      ) {
        const employeeSchedule =
          nextSchedules[
            row.employee_id
          ]


        if (
          !employeeSchedule
        ) {
          continue
        }


        const hours =
          calculateHours(
            row.scheduled_start_time,
            row.scheduled_end_time,
            row.scheduled_end_next_day
          )


        if (!hours) {
          continue
        }


        employeeSchedule
          .monthSchedule[
            row.duty_date
          ] = {
            hours:
              Number(
                hours
              ),

            isWorking:
              true,
          }
      }


      setSchedulesByEmployee(
        nextSchedules
      )


      setDirtyEmployeeIds(
        []
      )
    } catch (error) {
      console.error(
        'Schedule loading error:',
        error
      )


      setErrorMessage(
        `Unable to load employee schedules: ${error.message}`
      )
    } finally {
      setScheduleLoading(
        false
      )
    }
  }


  // =========================================================
  // FILTER EMPLOYEES
  // =========================================================

  const filteredEmployees =
    useMemo(() => {
      const keyword =
        searchTerm
          .trim()
          .toLowerCase()


      return employees.filter(
        (employee) => {
          if (keyword) {
            const searchableText =
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


            if (
              !searchableText.includes(
                keyword
              )
            ) {
              return false
            }
          }


          if (
            shiftFilter !==
            'all'
          ) {
            const employeeSchedule =
              schedulesByEmployee[
                employee.id
              ]


            const type =
              getShiftTypeById(
                employeeSchedule
                  ?.shiftId
              )


            if (
              type !==
              shiftFilter
            ) {
              return false
            }
          }


          return true
        }
      )
    }, [
      employees,
      searchTerm,
      shiftFilter,
      schedulesByEmployee,
      shifts,
    ])


  // =========================================================
  // HORIZONTAL SCROLL WIDTH
  // =========================================================

  useEffect(() => {
    const roster =
      rosterScrollRef.current


    if (!roster) {
      return
    }


    function updateScrollWidth() {
      setHorizontalScrollWidth(
        roster.scrollWidth
      )


      if (
        horizontalScrollRef.current
      ) {
        horizontalScrollRef.current.scrollLeft =
          roster.scrollLeft
      }
    }


    updateScrollWidth()


    const resizeObserver =
      new ResizeObserver(
        updateScrollWidth
      )


    resizeObserver.observe(
      roster
    )


    const table =
      roster.querySelector(
        '.roster-table'
      )


    if (table) {
      resizeObserver.observe(
        table
      )
    }


    window.addEventListener(
      'resize',
      updateScrollWidth
    )


    return () => {
      resizeObserver.disconnect()

      window.removeEventListener(
        'resize',
        updateScrollWidth
      )
    }
  }, [
    days,
    filteredEmployees,
    schedulesByEmployee,
    scheduleLoading,
  ])


  // =========================================================
  // SYNC ROSTER -> HORIZONTAL BAR
  // =========================================================

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


  // =========================================================
  // SYNC HORIZONTAL BAR -> ROSTER
  // =========================================================

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


  // =========================================================
  // DIRTY EMPLOYEE
  // =========================================================

  function markEmployeeDirty(
    employeeId
  ) {
    setDirtyEmployeeIds(
      (previous) => {
        if (
          previous.includes(
            employeeId
          )
        ) {
          return previous
        }


        return [
          ...previous,
          employeeId,
        ]
      }
    )
  }


  // =========================================================
  // CHANGE SHIFT
  // =========================================================

  function changeEmployeeShift(
    employeeId,
    shiftId
  ) {
    setSchedulesByEmployee(
      (previous) => {
        const current =
          previous[
            employeeId
          ] || {
            shiftId:
              '',

            weeklyPattern:
              createEmptyPattern(),

            monthSchedule:
              {},
          }


        return {
          ...previous,

          [employeeId]: {
            ...current,
            shiftId,
          },
        }
      }
    )


    markEmployeeDirty(
      employeeId
    )


    setMessage('')
    setErrorMessage('')
  }


  // =========================================================
  // CHANGE MONTH DAY
  // =========================================================

  function changeMonthDay(
    employeeId,
    date,
    value
  ) {
    const selectedDay =
      days.find(
        (day) =>
          day.date ===
          date
      )


    if (!selectedDay) {
      return
    }


    if (
      value &&
      !isAllowedDutyHours(
        value
      )
    ) {
      setErrorMessage(
        'Duty hours must be either 9 hours or 12 hours.'
      )

      return
    }


    const employeeSchedule =
      schedulesByEmployee[
        employeeId
      ]


    if (
      value &&
      !employeeSchedule
        ?.shiftId
    ) {
      setErrorMessage(
        'Please select a shift for the employee before adding duty hours.'
      )

      return
    }


    const weekday =
      selectedDay.weekday


    setSchedulesByEmployee(
      (previous) => {
        const current =
          previous[
            employeeId
          ] || {
            shiftId:
              '',

            weeklyPattern:
              createEmptyPattern(),

            monthSchedule:
              {},
          }


        const updatedPattern = {
          ...current.weeklyPattern,

          [weekday]:
            value,
        }


        const updatedMonth = {
          ...current.monthSchedule,
        }


        for (
          const day of
          days
        ) {
          if (
            day.weekday !==
            weekday
          ) {
            continue
          }


          updatedMonth[
            day.date
          ] = {
            hours:
              value
                ? Number(
                    value
                  )
                : '',

            isWorking:
              Boolean(
                value
              ),
          }
        }


        return {
          ...previous,

          [employeeId]: {
            ...current,

            weeklyPattern:
              updatedPattern,

            monthSchedule:
              updatedMonth,
          },
        }
      }
    )


    markEmployeeDirty(
      employeeId
    )


    setMessage('')
    setErrorMessage('')
  }


  // =========================================================
  // CLEAR VISIBLE
  // =========================================================

  function clearVisibleSchedules() {
    if (
      filteredEmployees.length ===
      0
    ) {
      return
    }


    const confirmed =
      window.confirm(
        `Clear the repeating schedule for ${filteredEmployees.length} visible employee(s)?`
      )


    if (!confirmed) {
      return
    }


    const visibleIds =
      filteredEmployees.map(
        (employee) =>
          employee.id
      )


    setSchedulesByEmployee(
      (previous) => {
        const updated = {
          ...previous,
        }


        for (
          const employeeId of
          visibleIds
        ) {
          const current =
            updated[
              employeeId
            ] || {
              shiftId:
                '',

              weeklyPattern:
                createEmptyPattern(),

              monthSchedule:
                {},
            }


          const clearedMonth = {}


          for (
            const day of
            days
          ) {
            clearedMonth[
              day.date
            ] = {
              hours:
                '',

              isWorking:
                false,
            }
          }


          updated[
            employeeId
          ] = {
            ...current,

            weeklyPattern:
              createEmptyPattern(),

            monthSchedule:
              clearedMonth,
          }
        }


        return updated
      }
    )


    for (
      const employeeId of
      visibleIds
    ) {
      markEmployeeDirty(
        employeeId
      )
    }


    setMessage('')
    setErrorMessage('')
  }


  // =========================================================
  // SAVE
  // =========================================================

  async function saveSchedule() {
    if (
      dirtyEmployeeIds.length ===
      0
    ) {
      setMessage(
        'No schedule changes to save.'
      )

      return
    }


    if (
      !selectedMonth ||
      days.length ===
        0
    ) {
      setErrorMessage(
        'Please select a month.'
      )

      return
    }


    setSaving(true)

    setMessage('')
    setErrorMessage('')


    try {
      const patternRows = []
      const scheduleRows = []


      for (
        const employeeId of
        dirtyEmployeeIds
      ) {
        const employee =
          employees.find(
            (item) =>
              String(
                item.id
              ) ===
              String(
                employeeId
              )
          )


        const employeeSchedule =
          schedulesByEmployee[
            employeeId
          ]


        if (
          !employeeSchedule
        ) {
          continue
        }


        const hasWorkingDays =
          Object.values(
            employeeSchedule
              .weeklyPattern
          ).some(Boolean)


        if (
          hasWorkingDays &&
          !employeeSchedule
            .shiftId
        ) {
          throw new Error(
            `Please select a shift for ${employee?.first_name || 'employee'} ${employee?.last_name || ''}.`
          )
        }


        // ===================================================
        // WEEKLY PATTERN
        // ===================================================

        for (
          let weekday = 1;
          weekday <= 7;
          weekday++
        ) {
          const hours =
            employeeSchedule
              .weeklyPattern[
                weekday
              ]


          if (!hours) {
            patternRows.push({
              employee_id:
                employeeId,

              weekday,

              is_working:
                false,

              shift_id:
                null,

              duty_hours:
                null,

              scheduled_start_time:
                null,

              scheduled_end_time:
                null,

              scheduled_end_next_day:
                false,

              status:
                'active',
            })


            continue
          }


          if (
            !isAllowedDutyHours(
              hours
            )
          ) {
            throw new Error(
              `Invalid duty hours for ${employee?.first_name || 'employee'} ${employee?.last_name || ''}. Only 9 or 12 hours are allowed.`
            )
          }


          const times =
            getDutyTimes(
              employeeSchedule
                .shiftId,
              hours
            )


          if (!times) {
            throw new Error(
              `Invalid shift or duty hours for ${employee?.first_name || 'employee'} ${employee?.last_name || ''}.`
            )
          }


          patternRows.push({
            employee_id:
              employeeId,

            weekday,

            is_working:
              true,

            shift_id:
              employeeSchedule
                .shiftId,

            duty_hours:
              Number(
                hours
              ),

            scheduled_start_time:
              times.start,

            scheduled_end_time:
              times.end,

            scheduled_end_next_day:
              times.nextDay,

            status:
              'active',
          })
        }


        // ===================================================
        // MONTH DATED SCHEDULE
        // ===================================================

        for (
          const day of
          days
        ) {
          const item =
            employeeSchedule
              .monthSchedule[
                day.date
              ]


          if (
            !item ||
            !item.isWorking ||
            !item.hours
          ) {
            continue
          }


          if (
            !isAllowedDutyHours(
              item.hours
            )
          ) {
            continue
          }


          const times =
            getDutyTimes(
              employeeSchedule
                .shiftId,
              item.hours
            )


          if (!times) {
            continue
          }


          scheduleRows.push({
            employee_id:
              employeeId,

            shift_id:
              employeeSchedule
                .shiftId,

            duty_date:
              day.date,

            status:
              'scheduled',

            scheduled_start_time:
              times.start,

            scheduled_end_time:
              times.end,

            scheduled_end_next_day:
              times.nextDay,

            notes:
              `${item.hours} hour duty`,
          })
        }
      }


      // =====================================================
      // SAVE WEEKLY PATTERNS
      // =====================================================

      if (
        patternRows.length >
        0
      ) {
        const {
          error:
            patternError,
        } =
          await supabase
            .from(
              'employee_weekly_schedule_patterns'
            )
            .upsert(
              patternRows,
              {
                onConflict:
                  'employee_id,weekday',
              }
            )


        if (
          patternError
        ) {
          throw patternError
        }
      }


      // =====================================================
      // DELETE OLD MONTH
      // =====================================================

      const firstDate =
        days[0].date


      const lastDate =
        days[
          days.length - 1
        ].date


      const {
        error:
          deleteError,
      } =
        await supabase
          .from(
            'employee_schedules'
          )
          .delete()
          .in(
            'employee_id',
            dirtyEmployeeIds
          )
          .eq(
            'status',
            'scheduled'
          )
          .gte(
            'duty_date',
            firstDate
          )
          .lte(
            'duty_date',
            lastDate
          )


      if (
        deleteError
      ) {
        throw deleteError
      }


      // =====================================================
      // INSERT CURRENT MONTH
      // =====================================================

      if (
        scheduleRows.length >
        0
      ) {
        const {
          error:
            insertError,
        } =
          await supabase
            .from(
              'employee_schedules'
            )
            .insert(
              scheduleRows
            )


        if (
          insertError
        ) {
          throw insertError
        }
      }


      await loadAllSchedules(
        false
      )


      setMessage(
        'Schedule changes saved successfully. Weekly patterns will continue automatically into future months.'
      )
    } catch (error) {
      console.error(
        'Schedule saving error:',
        error
      )


      setErrorMessage(
        `Unable to save schedule: ${error.message}`
      )
    } finally {
      setSaving(false)
    }
  }


  // =========================================================
  // MONTH CHANGE
  // =========================================================

  function handleMonthChange(
    event
  ) {
    const nextMonth =
      event.target.value


    if (
      dirtyEmployeeIds.length >
      0
    ) {
      const confirmed =
        window.confirm(
          'You have unsaved schedule changes. Change month and discard those changes?'
        )


      if (!confirmed) {
        return
      }
    }


    setDirtyEmployeeIds(
      []
    )

    setSelectedMonth(
      nextMonth
    )

    setMessage('')
    setErrorMessage('')
  }


  // =========================================================
  // MONTH TITLE
  // =========================================================

  function getMonthTitle() {
    if (
      !selectedMonth
    ) {
      return ''
    }


    const [
      year,
      month,
    ] =
      selectedMonth
        .split('-')
        .map(Number)


    return new Date(
      year,
      month - 1,
      1
    ).toLocaleDateString(
      'en-US',
      {
        month:
          'long',

        year:
          'numeric',
      }
    )
  }


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="admin-schedule-page">

        <div className="admin-schedule-loading">
          Loading schedule...
        </div>

      </div>
    )
  }


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="admin-schedule-page">

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <div className="schedule-controls">

        <div className="control-group schedule-search-group">

          <label>
            Search Employee
          </label>


          <div className="schedule-search-box">

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

              placeholder="Search code, name, department or position..."
            />

          </div>

        </div>


        <div className="control-group">

          <label>
            Shift Filter
          </label>


          <select
            value={
              shiftFilter
            }

            onChange={(
              event
            ) =>
              setShiftFilter(
                event.target.value
              )
            }
          >

            <option value="all">
              All Shifts
            </option>

            <option value="morning">
              Morning
            </option>

            <option value="night">
              Night
            </option>

          </select>

        </div>


        <div className="control-group">

          <label>
            Month
          </label>


          <input
            className="schedule-month-input"
            type="month"

            value={
              selectedMonth
            }

            onChange={
              handleMonthChange
            }
          />

        </div>

      </div>


      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {errorMessage && (

        <div className="schedule-message schedule-error-message">
          {errorMessage}
        </div>

      )}


      {message && (

        <div className="schedule-message">
          {message}
        </div>

      )}


      {/* =====================================================
          MONTH HEADING + ACTIONS
      ===================================================== */}

      <div className="schedule-month-heading">

        <div className="schedule-month-center">

          <h2>
            {getMonthTitle()}
          </h2>


          <p>
            Changing one weekday updates every matching weekday for that employee and continues into future months.
          </p>

        </div>


        <div className="schedule-month-actions">

          <button
            type="button"
            className="clear-button"

            onClick={
              clearVisibleSchedules
            }

            disabled={
              saving ||
              filteredEmployees.length ===
                0
            }
          >
            Clear Visible
          </button>


          <button
            type="button"
            className="save-button"

            onClick={
              saveSchedule
            }

            disabled={
              saving ||
              dirtyEmployeeIds.length ===
                0
            }
          >

            {saving
              ? 'Saving...'
              : dirtyEmployeeIds.length >
                0
              ? `Save Changes (${dirtyEmployeeIds.length})`
              : 'Save Changes'}

          </button>

        </div>

      </div>


      {/* =====================================================
          ROSTER
      ===================================================== */}

      <div className="schedule-roster-area">

        {scheduleLoading ? (

          <div className="schedule-empty">
            Loading employee schedules...
          </div>

        ) : filteredEmployees.length ===
          0 ? (

          <div className="schedule-empty">
            No employees match the current search or shift filter.
          </div>

        ) : (
          <>

            {/* ===============================================
                TABLE SCROLL AREA
            =============================================== */}

            <div
              ref={
                rosterScrollRef
              }

              className="roster-wrapper"

              onScroll={
                handleRosterScroll
              }
            >

              <table className="roster-table">

                <thead>

                  <tr>

                    <th className="employee-column">
                      Employee
                    </th>


                    {days.map(
                      (day) => (

                        <th
                          key={
                            day.date
                          }

                          className={
                            day.weekday >= 6
                              ? 'weekend'
                              : ''
                          }
                        >

                          <div>
                            {day.day}
                          </div>


                          <small>
                            {day.weekdayName}
                          </small>

                        </th>

                      )
                    )}

                  </tr>

                </thead>


                <tbody>

                  {filteredEmployees.map(
                    (employee) => {
                      const employeeSchedule =
                        schedulesByEmployee[
                          employee.id
                        ] || {
                          shiftId:
                            '',

                          weeklyPattern:
                            createEmptyPattern(),

                          monthSchedule:
                            {},
                        }


                      const isDirty =
                        dirtyEmployeeIds.includes(
                          employee.id
                        )


                      return (
                        <tr
                          key={
                            employee.id
                          }
                        >

                          {/* =================================
                              EMPLOYEE
                          ================================= */}

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


                            <select
                              className="employee-shift-select"

                              value={
                                employeeSchedule
                                  .shiftId ||
                                ''
                              }

                              onChange={(
                                event
                              ) =>
                                changeEmployeeShift(
                                  employee.id,
                                  event.target.value
                                )
                              }

                              disabled={
                                saving
                              }
                            >

                              <option value="">
                                Select Shift
                              </option>


                              {shifts.map(
                                (shift) => (

                                  <option
                                    key={
                                      shift.id
                                    }

                                    value={
                                      shift.id
                                    }
                                  >
                                    {shift.name ||
                                      shift.shift_name ||
                                      'Shift'}
                                  </option>

                                )
                              )}

                            </select>

                          </td>


                          {/* =================================
                              DAYS
                          ================================= */}

                          {days.map(
                            (day) => {
                              const rawValue =
                                employeeSchedule
                                  .monthSchedule[
                                    day.date
                                  ]?.hours ||
                                ''


                              const value =
                                isAllowedDutyHours(
                                  rawValue
                                )
                                  ? String(
                                      rawValue
                                    )
                                  : ''


                              return (
                                <td
                                  key={
                                    day.date
                                  }

                                  className={
                                    value
                                      ? 'duty-cell'
                                      : 'off-cell'
                                  }
                                >

                                  <select
                                    value={
                                      value
                                    }

                                    disabled={
                                      saving ||
                                      !employeeSchedule
                                        .shiftId
                                    }

                                    title={
                                      !employeeSchedule
                                        .shiftId
                                        ? 'Select a shift first'
                                        : ''
                                    }

                                    onChange={(
                                      event
                                    ) =>
                                      changeMonthDay(
                                        employee.id,
                                        day.date,
                                        event.target.value
                                      )
                                    }
                                  >

                                    <option value="">
                                      OFF
                                    </option>

                                    <option value="9">
                                      9
                                    </option>

                                    <option value="12">
                                      12
                                    </option>

                                  </select>

                                </td>
                              )
                            }
                          )}

                        </tr>
                      )
                    }
                  )}

                </tbody>

              </table>

            </div>


            {/* ===============================================
                ALWAYS VISIBLE HORIZONTAL SCROLLBAR
            =============================================== */}

            <div
              ref={
                horizontalScrollRef
              }

              className="schedule-horizontal-scroll"

              onScroll={
                handleHorizontalScroll
              }
            >

              <div
                className="schedule-horizontal-scroll-inner"

                style={{
                  width:
                    `${horizontalScrollWidth}px`,
                }}
              />

            </div>

          </>
        )}

      </div>


      {/* =====================================================
          LEGEND
      ===================================================== */}

      <div className="schedule-legend">

        <div>

          <span className="legend-duty">
            9
          </span>

          9-hour duty

        </div>


        <div>

          <span className="legend-duty">
            12
          </span>

          12-hour duty

        </div>


        <div>

          <span className="legend-off">
            OFF
          </span>

          Day off

        </div>


        <div>

          <span className="legend-night">
            🌙
          </span>

          Night shift ends next day

        </div>

      </div>

    </div>
  )
}


export default AdminSchedule