import { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileBarChart, Settings, Bell, Menu, X, LogOut,
  Camera, UserCog, Search, ChevronDown, User, Video, ClipboardCheck, BarChart3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useYears from '../hooks/useYears';
import useNotifications from '../hooks/useNotifications';
import './DashboardLayout.css';

export const YearContext = createContext();
export const useYear = () => useContext(YearContext);

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

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const role = profile?.role || 'admin';

  const displayName = profile?.full_name || user?.email || 'Admin Hafiz';
  const avatarInitials = useMemo(() => {
    const source = profile?.full_name || user?.email || 'AH';
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AH';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profile, user]);
  const roleLabel = useMemo(() => {
    if (!role) return 'Administrator';
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
    if (path.includes('admin')) return 'Admin Panel';
    if (path.includes('camera')) return 'Live Camera';
    if (path.includes('class/')) return 'Class Detail';
    if (path.includes('attendance')) return 'Attendance';
    if (path.includes('comparison')) return 'Compare Classes';
    return 'Dashboard';
  };

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
                    className={`sidebar-link ${(link.path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(link.path)) ? 'active' : ''}`}
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
          </div>

          <div className="topbar-right">
            <div className="topbar-search">
              <Search size={16} />
              <input type="text" placeholder="Search..." />
            </div>

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
                          <p>{n.body || n.message}</p>
                          <small>{n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : n.time}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="dropdown-footer">
                    <Link to="/dashboard">View all notifications</Link>
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
                  <Link to="/dashboard" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    <User size={16} /> Profile
                  </Link>
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
            <Outlet />
          </YearContext.Provider>
        </main>

        <footer className="dashboard-footer">
          <p>PRISM-AI &copy; 2026 &mdash; Final Year Project, UniKL</p>
        </footer>
      </div>
    </div>
  );
}
