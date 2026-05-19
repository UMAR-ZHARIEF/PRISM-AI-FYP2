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
import ParentConsent from './pages/ParentConsent';
import ClassDetail from './pages/ClassDetail';
import Attendance from './pages/Attendance';
import StudentProfile from './pages/StudentProfile';
import ClassComparison from './pages/ClassComparison';
import Camera from './pages/Camera';
import LegalPage from './pages/legal/LegalPage';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/biometric-consent" element={<LegalPage kind="biometric" />} />
        <Route path="/parent" element={<ProtectedRoute requireRole="parent"><ParentPortal /></ProtectedRoute>} />
        <Route path="/parent/consent/:studentId" element={<ProtectedRoute requireRole="parent"><ParentConsent /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute requireRole={['admin', 'teacher', 'assistant']}><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:studentId" element={<StudentProfile />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="camera" element={<Camera />} />
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
