import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  supabase,
} from '../lib/supabase'

import AdminEmployees from './AdminEmployees'
import AdminSchedule from './AdminSchedule'
import AdminLeave from './AdminLeave'
import AdminHolidays from './AdminHolidays'
import AdminComOff from './AdminComOff'
import AdminReports from './AdminReports'

import './AdminDashboard.css'


// ===========================================================
// STORAGE
// ===========================================================

const THEME_STORAGE_KEY =
  'dtr-admin-theme'

const SIDEBAR_STORAGE_KEY =
  'dtr-admin-sidebar-collapsed'


// ===========================================================
// ADMIN DASHBOARD
// ===========================================================

function AdminDashboard({
  adminUser,
  onEmployeeDtr,
  onLogout,
}) {
  // =========================================================
  // ACTIVE PAGE
  // =========================================================

  const [
    activePage,
    setActivePage,
  ] = useState('employees')


  // =========================================================
  // SIDEBAR
  // =========================================================

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(() => {
    return (
      localStorage.getItem(
        SIDEBAR_STORAGE_KEY
      ) === 'true'
    )
  })


  // =========================================================
  // PROFILE
  // =========================================================

  const [
    adminProfile,
    setAdminProfile,
  ] = useState(null)


  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false)


  const profileMenuRef =
    useRef(null)


  // =========================================================
  // THEME
  //
  // First-time default:
  // System
  //
  // After user touches switch:
  // Light / Dark is saved manually.
  // =========================================================

  const [
    themePreference,
    setThemePreference,
  ] = useState(() => {
    const saved =
      localStorage.getItem(
        THEME_STORAGE_KEY
      )

    if (
      saved === 'light' ||
      saved === 'dark'
    ) {
      return saved
    }

    // Old Classic Dark preference becomes normal Dark.
    if (
      saved === 'classic-dark'
    ) {
      return 'dark'
    }

    return 'system'
  })


  const [
    systemDark,
    setSystemDark,
  ] = useState(() => {
    return window
      .matchMedia(
        '(prefers-color-scheme: dark)'
      )
      .matches
  })


  // =========================================================
  // LOAD ADMIN PROFILE
  // =========================================================

  useEffect(() => {
    async function loadAdminProfile() {
      if (!adminUser?.id) {
        return
      }


      try {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              'admin_profiles'
            )
            .select(`
              id,
              first_name,
              last_name,
              role,
              status
            `)
            .eq(
              'id',
              adminUser.id
            )
            .maybeSingle()


        if (error) {
          console.error(
            'Admin profile error:',
            error
          )

          return
        }


        setAdminProfile(
          data || null
        )
      } catch (error) {
        console.error(
          'Admin profile error:',
          error
        )
      }
    }


    loadAdminProfile()
  }, [
    adminUser?.id,
  ])


  // =========================================================
  // WATCH DEVICE / WINDOWS THEME
  // =========================================================

  useEffect(() => {
    const media =
      window.matchMedia(
        '(prefers-color-scheme: dark)'
      )


    function handleSystemTheme(
      event
    ) {
      setSystemDark(
        event.matches
      )
    }


    if (
      media.addEventListener
    ) {
      media.addEventListener(
        'change',
        handleSystemTheme
      )
    } else {
      media.addListener(
        handleSystemTheme
      )
    }


    return () => {
      if (
        media.removeEventListener
      ) {
        media.removeEventListener(
          'change',
          handleSystemTheme
        )
      } else {
        media.removeListener(
          handleSystemTheme
        )
      }
    }
  }, [])


  // =========================================================
  // CLOSE PROFILE WHEN CLICKING OUTSIDE
  // =========================================================

  useEffect(() => {
    function handleOutsideClick(
      event
    ) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(
          event.target
        )
      ) {
        setProfileOpen(false)
      }
    }


    document.addEventListener(
      'mousedown',
      handleOutsideClick
    )


    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      )
    }
  }, [])


  // =========================================================
  // RESOLVED THEME
  // =========================================================

  const resolvedTheme =
    themePreference === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : themePreference


  // =========================================================
  // CHANGE THEME
  // =========================================================

  function changeTheme(
    theme
  ) {
    setThemePreference(
      theme
    )

    localStorage.setItem(
      THEME_STORAGE_KEY,
      theme
    )
  }


  // =========================================================
  // LIGHT / DARK SWITCH
  // =========================================================

  function toggleLightDarkTheme() {
    const next =
      resolvedTheme === 'dark'
        ? 'light'
        : 'dark'

    changeTheme(next)
  }


  // =========================================================
  // SIDEBAR
  // =========================================================

  function toggleSidebar() {
    setSidebarCollapsed(
      (previous) => {
        const next =
          !previous

        localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          String(next)
        )

        return next
      }
    )

    setProfileOpen(false)
  }


  // =========================================================
  // OPEN PAGE
  // =========================================================

  function openPage(
    page
  ) {
    setActivePage(page)
    setProfileOpen(false)
  }


  // =========================================================
  // ADMIN DETAILS
  // =========================================================

  const firstName =
    adminProfile?.first_name ||
    adminUser
      ?.user_metadata
      ?.first_name ||
    adminUser
      ?.email
      ?.split('@')[0] ||
    'Administrator'


  const lastName =
    adminProfile?.last_name ||
    adminUser
      ?.user_metadata
      ?.last_name ||
    ''


  const role =
    adminProfile?.role ||
    'Administrator'


  const email =
    adminUser?.email ||
    ''


  // =========================================================
  // INITIALS
  // =========================================================

  const initials =
    useMemo(() => {
      const first =
        firstName
          ?.charAt(0) ||
        'A'

      const last =
        lastName
          ?.charAt(0) ||
        ''

      return (
        `${first}${last}`
          .toUpperCase()
      )
    }, [
      firstName,
      lastName,
    ])


  // =========================================================
  // NAV CLASS
  // =========================================================

  function getNavClass(
    page
  ) {
    return (
      activePage === page
        ? 'admin-nav-item active'
        : 'admin-nav-item'
    )
  }


  // =========================================================
  // PAGE CONTENT
  // =========================================================

  function renderPage() {
    switch (activePage) {
      case 'employees':
        return (
          <AdminEmployees />
        )

      case 'schedules':
        return (
          <AdminSchedule />
        )

      case 'leave':
        return (
          <AdminLeave />
        )

      case 'holidays':
        return (
          <AdminHolidays />
        )

      case 'comoff':
        return (
          <AdminComOff />
        )

      case 'reports':
        return (
          <AdminReports />
        )

      default:
        return (
          <AdminEmployees />
        )
    }
  }


  // =========================================================
  // NAVIGATION
  // =========================================================

  const navigationItems = [
    {
      id: 'employees',
      label: 'Employees',
      icon: '👥',
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: '🗓️',
    },
    {
      id: 'leave',
      label: 'Leave',
      icon: '📝',
    },
    {
      id: 'holidays',
      label: 'Holidays',
      icon: '★',
    },
    {
      id: 'comoff',
      label: 'Com-off',
      icon: '↻',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '📊',
    },
  ]


  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      className={
        sidebarCollapsed
          ? 'admin-dashboard sidebar-collapsed'
          : 'admin-dashboard'
      }

      data-admin-theme={
        resolvedTheme
      }

      data-theme-preference={
        themePreference
      }
    >

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="admin-dashboard-header">

        <img
          src="/dtr-pro-logo.png"
          alt="Katrina Coffee & Cakes"
          className="admin-dashboard-logo"
        />


        <button
          type="button"
          className="admin-secondary-button"
          onClick={onEmployeeDtr}
        >
          Employee DTR
        </button>

      </header>


      {/* =====================================================
          BODY
      ===================================================== */}

      <div className="admin-dashboard-body">

        {/* ===================================================
            SIDEBAR
        =================================================== */}

        <aside
          className={
            sidebarCollapsed
              ? 'admin-sidebar collapsed'
              : 'admin-sidebar'
          }
        >

          {/* =================================================
              COLLAPSE BUTTON
          ================================================= */}

          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={
              sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            title={
              sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
          >
            {sidebarCollapsed
              ? '›'
              : '‹'}
          </button>


          {/* =================================================
              NAVIGATION
          ================================================= */}

          <div className="admin-sidebar-main">

            <nav className="admin-sidebar-nav">

              {navigationItems.map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      getNavClass(
                        item.id
                      )
                    }
                    onClick={() =>
                      openPage(
                        item.id
                      )
                    }
                    title={
                      sidebarCollapsed
                        ? item.label
                        : undefined
                    }
                  >

                    <span className="admin-nav-icon">
                      {item.icon}
                    </span>


                    <span className="admin-nav-label">
                      {item.label}
                    </span>

                  </button>
                )
              )}

            </nav>

          </div>


          {/* =================================================
              ACCOUNT / PROFILE
          ================================================= */}

          <div
            className="admin-profile-area"
            ref={profileMenuRef}
          >

            {/* ===============================================
                ACCOUNT POPOVER
            =============================================== */}

            {profileOpen && (
              <div className="admin-profile-popover">

                {/* ===========================================
                    PROFILE
                =========================================== */}

                <div className="admin-profile-popover-header">

                  <div className="admin-profile-avatar large">
                    {initials}
                  </div>


                  <div className="admin-profile-info">

                    <strong>
                      {firstName}
                      {lastName
                        ? ` ${lastName}`
                        : ''}
                    </strong>


                    {email && (
                      <span>
                        {email}
                      </span>
                    )}


                    <small>
                      {role}
                    </small>

                  </div>

                </div>


                {/* ===========================================
                    THEME / APPEARANCE
                =========================================== */}

                <div className="admin-account-theme">

                  <div className="admin-account-theme-text">

                    <strong>
                      Theme
                    </strong>

                    <span>
                      Appearance
                    </span>

                  </div>


                  <button
                    type="button"
                    className={
                      resolvedTheme === 'dark'
                        ? 'admin-appearance-switch dark'
                        : 'admin-appearance-switch light'
                    }
                    onClick={
                      toggleLightDarkTheme
                    }
                    aria-label="Toggle light or dark appearance"
                    title={
                      themePreference === 'system'
                        ? 'Following system appearance. Click to choose manually.'
                        : `Current appearance: ${resolvedTheme}`
                    }
                  >

                    <span className="admin-appearance-thumb" />

                    <span className="admin-appearance-label">
                      {resolvedTheme === 'dark'
                        ? 'DARK'
                        : 'LIGHT'}
                    </span>

                  </button>

                </div>


                {/* ===========================================
                    LOG OUT
                =========================================== */}

                <button
                  type="button"
                  className="admin-profile-logout"
                  onClick={onLogout}
                >

                  <span className="admin-logout-icon">
                    ↪
                  </span>

                  <span>
                    Log out
                  </span>

                </button>

              </div>
            )}


            {/* ===============================================
                PROFILE BUTTON
            =============================================== */}

            <button
              type="button"
              className="admin-profile-button"
              onClick={() =>
                setProfileOpen(
                  (previous) =>
                    !previous
                )
              }
              title={
                sidebarCollapsed
                  ? `${firstName} - ${role}`
                  : undefined
              }
            >

              <div className="admin-profile-avatar">
                {initials}
              </div>


              <div className="admin-profile-button-text">

                <strong>
                  {firstName}
                </strong>

                <span>
                  {role}
                </span>

              </div>


              <span className="admin-profile-more">
                ⋮
              </span>

            </button>

          </div>

        </aside>


        {/* ===================================================
            PAGE
        =================================================== */}

        <main className="admin-main-content">
          {renderPage()}
        </main>

      </div>

    </div>
  )
}


export default AdminDashboard