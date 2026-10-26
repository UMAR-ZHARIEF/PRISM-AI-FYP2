import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileBarChart, Settings, Bell, Menu, X, LogOut,
  Camera, UserCog, ChevronDown, Video, ClipboardCheck, BarChart3, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useYears from '../hooks/useYears';
import useNotifications from '../hooks/useNotifications';
import { YearContext, ScopeContext } from './dashboardContexts';
import './DashboardLayout.css';

const sidebarSections = [
  {
    label: 'Main',
    links: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/dashboard/camera', label: 'Live Camera', icon: Video },
    ]
  },
  {
    label: 'Management',
    links: [
      { path: '/dashboard/students', label: 'Students', icon: Users },
      { path: '/dashboard/reports', label: 'Reports', icon: FileBarChart },
      { path: '/dashboard/engagement', label: 'Engagement', icon: Activity },
      { path: '/dashboard/attendance', label: 'Take Attendance', icon: ClipboardCheck },
      { path: '/dashboard/comparison', label: 'Compare Classes', icon: BarChart3 },
    ]
  },
  {
    label: 'System',
    adminOnly: true,
    links: [
      { path: '/dashboard/admin', label: 'Admin Panel', icon: UserCog },
    ]
  },
];

// Sidebar highlight rule: exact match for the Dashboard root, prefix match for
// everything else. Class Detail pages (/dashboard/class/...) are a prefix of
// no sidebar path, so they highlight the closest related section, Students.
function isSidebarLinkActive(link, pathname) {
  if (pathname.startsWith('/dashboard/class')) {
    return link.path === '/dashboard/students';
  }
  return link.path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(link.path);
}

export default function DashboardLayout() {
  // Start collapsed on phones so the sidebar never covers the page on first load.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const userRef = useRef(null);

  const { years, loading: yearsLoading } = useYears();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const { user, profile, signOut } = useAuth();

  const role = profile?.role;

  // Shared view scope for the pages below (see ScopeContext above). The user's
  // explicit pick wins once made; until then the scope derives from the role:
  // teachers default to 'mine', admins (and any other role) to 'all'. Deriving
  // (instead of a defaulting effect) means the right scope applies the moment
  // the async profile resolves.
  const [scopePick, setScope] = useState(null);
  const scope = scopePick ?? (role === 'teacher' ? 'mine' : 'all');

  const displayName = profile?.full_name || user?.email || 'Staff';
  const avatarInitials = useMemo(() => {
    const source = profile?.full_name || user?.email || '··';
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profile, user]);
  const roleLabel = useMemo(() => {
    if (!role) return 'Staff';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [role]);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate('/');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path.includes('students/') && path !== '/dashboard/students') return 'Student Profile';
    if (path.includes('students')) return 'Students';
    if (path.includes('reports')) return 'Reports';
    if (path.includes('engagement')) return 'Engagement';
    if (path.includes('admin')) return 'Admin Panel';
    if (path.includes('camera')) return 'Live Camera';
    if (path.includes('class/')) return 'Class Detail';
    if (path.includes('attendance')) return 'Attendance';
    if (path.includes('comparison')) return 'Compare Classes';
    return 'Dashboard';
  };

  // The year filter only feeds dashboard pages; admin and camera ignore it.
  const showYearDropdown =
    location.pathname !== '/dashboard/admin' && location.pathname !== '/dashboard/camera';

  return (
    <div className="dashboard-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            <Camera size={24} />
            {sidebarOpen && <span>PRISM-AI</span>}
          </Link>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {sidebarSections.map(section => {
            if (section.adminOnly && role !== 'admin') return null;
            return (
              <div key={section.label} className="sidebar-section">
                {sidebarOpen && <span className="sidebar-section-label">{section.label}</span>}
                {section.links.map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`sidebar-link ${isSidebarLinkActive(link, location.pathname) ? 'active' : ''}`}
                  >
                    <link.icon size={20} />
                    {sidebarOpen && <span>{link.label}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-link sidebar-logout" onClick={handleSignOut}>
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={`dashboard-main ${sidebarOpen ? '' : 'expanded'}`}>
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <Link to="/dashboard">Home</Link>
              <span>/</span>
              <span className="breadcrumb-current">{getPageTitle()}</span>
            </div>
            {showYearDropdown && (
              <select
                className="year-dropdown"
                value={selectedYear ?? ''}
                onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                disabled={yearsLoading && years.length === 0}
              >
                <option value="">{yearsLoading && years.length === 0 ? 'Loading…' : 'All Years'}</option>
                {years.map(y => (
                  <option key={y.year_num} value={y.year_num}>{y.label || `Year ${y.year_num}`}</option>
                ))}
              </select>
            )}
          </div>

          <div className="topbar-right">
            <div className="topbar-dropdown" ref={notifRef}>
              <button className="topbar-btn" onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="dropdown-panel notif-panel">
                  <div className="dropdown-header">
                    <h4>Notifications</h4>
                    <button className="text-btn" onClick={() => markAllRead()}>Mark all read</button>
                  </div>
                  <div className="dropdown-list">
                    {notifications.slice(0, 5).map(n => (
                      <div key={n.id} className={`dropdown-item notif-${n.type}`}>
                        <div className={`notif-dot dot-${n.type}`} />
                        <div>
                          <p>{n.body}</p>
                          <small>{n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="topbar-dropdown" ref={userRef}>
              <button className="topbar-user" onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}>
                <div className="avatar">{avatarInitials}</div>
                <div className="user-info">
                  <span className="user-name">{displayName}</span>
                  <small>{roleLabel}</small>
                </div>
                <ChevronDown size={14} />
              </button>
              {userMenuOpen && (
                <div className="dropdown-panel user-panel">
                  <Link to="/dashboard/admin" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    <Settings size={16} /> Settings
                  </Link>
                  <div className="dropdown-divider" />
                  <button type="button" className="dropdown-item text-danger" onClick={handleSignOut}>
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <YearContext.Provider value={{ selectedYear, setSelectedYear }}>
            <ScopeContext.Provider value={{ scope, setScope }}>
              <Outlet />
            </ScopeContext.Provider>
          </YearContext.Provider>
        </main>
      </div>
    </div>
  );
}
