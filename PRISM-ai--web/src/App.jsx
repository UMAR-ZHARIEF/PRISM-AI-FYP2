import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Landing from './pages/Landing';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';
import ParentPortal from './pages/ParentPortal';
import ClassDetail from './pages/ClassDetail';
import Attendance from './pages/Attendance';
import StudentProfile from './pages/StudentProfile';
import ClassComparison from './pages/ClassComparison';

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/parent" element={<ParentPortal />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:studentId" element={<StudentProfile />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="camera" element={<div className="camera-placeholder" style={{ padding: '48px 32px', textAlign: 'center' }}><h1><span className="word k">Live</span>{' '}<span className="word r">Camera</span></h1><p className="page-subtitle" style={{ marginTop: 12 }}>Camera feed will be available when the AI face recognition module is connected.</p><div className="card" style={{ maxWidth: 600, margin: '40px auto', padding: '60px 32px' }}><span className="tape tl" /><p style={{ fontSize: 64, marginBottom: 16 }}>📷</p><h3>No Camera Connected</h3><p style={{ color: 'var(--ink-soft)', marginTop: 8 }}>Connect the PRISM-AI face recognition hardware to enable live attendance tracking.</p></div></div>} />
          <Route path="class/:year/:className" element={<ClassDetail />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance/:year/:className" element={<Attendance />} />
          <Route path="comparison" element={<ClassComparison />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
