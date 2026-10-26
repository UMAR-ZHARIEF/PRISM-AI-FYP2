import { useState, useMemo, useEffect, useRef } from 'react';
import { UserCog, Plus, X, Shield, Activity, Settings, Trash2, Edit3, Download, Cpu, Wifi, Server, CheckCircle, Power, Users, ArrowUp, ArrowDown, Camera, UserCheck, UserX, ScanFace, Check, Filter, ShieldAlert, ShieldCheck, Lock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { classColors } from '../data/mockData';
import useProfiles from '../hooks/useProfiles';
import useAuditLogs from '../hooks/useAuditLogs';
import useAiModels from '../hooks/useAiModels';
import useStudents from '../hooks/useStudents';
import useEnrolledFaces from '../hooks/useEnrolledFaces';
import useYears from '../hooks/useYears';
import useClassSections from '../hooks/useClassSections';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext.jsx';
import { SkeletonTable } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import EnrollmentCamera from '../components/EnrollmentCamera';
import './AdminPanel.css';

const PER_PAGE = 8;

// System Settings defaults: mirror the seeded values in migrations
// 0005_app_settings_and_checkout.sql, 0010_autorestart_setting.sql and
// 0012_classroom_label.sql (single app_settings row, id = 1).
const SETTINGS_DEFAULTS = {
  school_name: 'PRISM-AI Primary School',
  late_cutoff: '08:00',
  det_size: 320,
  match_threshold: 0.4,
  classroom_label: 'CLASS_1A',
  autorestart_ai: true,
};
// Face-detection input sizes the AI service accepts (pixels).
const DET_SIZE_OPTIONS = [320, 640, 960, 1280];

// Normalizes the GET /api/ai/process body for this panel. orphan/note flag
// an unsupervised AI child that survived a server restart and still holds
// the camera port (the force-stop control); autorestart_enabled and
// autorestarts_recent back the AI tab status line. Fields an older server
// does not send stay null so the UI can fall back to the settings row.
const readAiProcDetail = (d) => ({
  orphan: Boolean(d?.orphan),
  note: typeof d?.note === 'string' ? d.note : '',
  autorestartEnabled: typeof d?.autorestart_enabled === 'boolean' ? d.autorestart_enabled : null,
  autorestartsRecent: Number.isFinite(Number(d?.autorestarts_recent))
    ? Number(d.autorestarts_recent)
    : null,
});

export default function AdminPanel() {
  const [tab, setTab] = useState('users');
  const [showModal, setShowModal] = useState(false);
  const [logFilter, setLogFilter] = useState('all');

  // Toast
  const toast = useToast();

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

  // Sorting
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Form state — used for both Add and Edit modal modes
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingUserId, setEditingUserId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('teacher');
  const [formPhone, setFormPhone] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [, setFormClass] = useState(''); // formClass value is unused; only the setter resets the field
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete confirmation state
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // User Management filter
  const [roleFilter, setRoleFilter] = useState('all');

  // Face Registration state
  const [faceYearFilter, setFaceYearFilter] = useState('all');
  const [faceClassFilter, setFaceClassFilter] = useState('all');
  const [faceStatusFilter, setFaceStatusFilter] = useState('all');
  const [facePage, setFacePage] = useState(1);

  // --- Auth (admin's JWT for /api/admin/users calls) ---
  const { session, user: authUser, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Face enrollment state (admin-only panel)
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  // Active browser-camera enrollment session (null when idle):
  // { sessionId, studentName, requiredCaptures }. Set once
  // POST /api/ai/enroll/session succeeds; the EnrollmentCamera
  // component rendered in the card takes over from there.
  const [enrollSession, setEnrollSession] = useState(null);
  // Inline reason a session could not start (no consent, session
  // already active, GPU offline, helper down). Toasted and shown
  // under the picker.
  const [enrollNotice, setEnrollNotice] = useState(null);
  // Lets the per-card "Register Face" buttons scroll the operator up to the
  // enrollment card after preselecting the student in its picker.
  const enrollCardRef = useRef(null);

  // Real face-enrollment status: Set of lowercased names from
  // ai-service/edge/enrolled_students.json (served by GET /api/ai/enrolled).
  // The shared hook polls every 30s so freshly enrolled students appear
  // without a manual reload; we also refetch immediately after a successful
  // enrollment via refreshEnrolledFaces().
  const { enrolledNames: enrolledFaces, refresh: refreshEnrolledFaces } = useEnrolledFaces();

  // --- Supabase-backed data ---
  const profilesArgs = roleFilter === 'all' ? {} : { role: roleFilter };
  const { profiles, loading: profilesLoading, error: profilesError, refresh: refreshProfiles } = useProfiles(profilesArgs);
  const { logs: auditLogsData, loading: logsLoading, error: logsError } = useAuditLogs({ limit: 100 });
  const { models: aiModels, loading: modelsLoading, error: modelsError } = useAiModels();
  const { students: studentList, loading: studentsLoading, error: studentsError } = useStudents();
  // Real year / class lists for the Face Registration filters (P7): the old
  // mock years/classes arrays are gone.
  const { years } = useYears();
  const { classSections } = useClassSections();

  // --- Overview system health (best-effort single fetch) ---
  // Active Cameras = is the Express process currently supervising the Python
  // AI (GET /api/ai/process, same source the Camera page uses; staff-only, so
  // it carries the admin's JWT). System Uptime = GET /api/health
  // uptimeSeconds; /api/health itself is public — when it cannot be reached
  // at all the Express bridge is down and the card reads 'Offline'.
  const [aiProcRunning, setAiProcRunning] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(null);
  // null = still checking, true = reachable, false = unreachable ('Offline').
  const [serverOnline, setServerOnline] = useState(null);
  // Detail from the same GET /api/ai/process call (orphan force-stop control
  // and the AI tab auto-restart status line).
  const [aiProcDetail, setAiProcDetail] = useState({
    orphan: false,
    note: '',
    autorestartEnabled: null,
    autorestartsRecent: null,
  });
  // POST /api/ai/restart in flight: stop + start reloads the model, up to
  // ~30s, so every card's Restart button stays disabled until it settles.
  const [aiRestarting, setAiRestarting] = useState(false);
  // DELETE /api/ai/process (orphan force stop) in flight.
  const [killingOrphan, setKillingOrphan] = useState(false);
  // Set by the AI tab's 'Re-enroll Faces' button: switch to the Face
  // Registration tab first, then an effect scrolls to the enrollment card
  // once it has mounted. A ref keeps this out of render state so the
  // reset never counts as setState inside the effect.
  const pendingEnrollScrollRef = useRef(false);
  // Bumped after an orphan force stop so the AI tab refetches the process
  // snapshot immediately instead of waiting for the next tab open.
  const [procRefreshTick, setProcRefreshTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const token = session?.access_token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/ai/process', { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!cancelled && d) {
          setAiProcRunning(Boolean(d.running));
          setAiProcDetail(readAiProcDetail(d));
        }
      })
      .catch(() => { /* server offline — card stays at 0 */ });
    fetch('/api/health', { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return;
        setServerOnline(Boolean(d));
        if (!d) return;
        const secs = Number(d.uptimeSeconds);
        if (Number.isFinite(secs)) setUptimeSeconds(secs);
      })
      .catch(() => {
        if (cancelled) return;
        setServerOnline(false); // Express bridge unreachable — card shows 'Offline'
      });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  // AI tab opened (or an orphan force stop just ran): pull a fresh process
  // snapshot so the status line and the orphan control reflect now, not
  // page load. Same .then shape as the Overview fetch above; the setStates
  // stay inside the callbacks so they are never synchronous effect work.
  useEffect(() => {
    if (tab !== 'ai' || !isAdmin) return;
    let cancelled = false;
    const token = session?.access_token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/ai/process', { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return;
        setAiProcRunning(Boolean(d.running));
        setAiProcDetail(readAiProcDetail(d));
      })
      .catch(() => { /* bridge offline: keep the last known detail */ });
    return () => { cancelled = true; };
  }, [tab, isAdmin, procRefreshTick, session?.access_token]);

  // Derived from /api/ai/enrolled (which reads enrolled_students.json on the
  // server). Maps student.id → true if their full_name (lowercased) appears
  // in the enrolled set, false otherwise. Edge case: two students sharing a
  // name would both flip to registered if one is enrolled — acceptable at
  // FYP scale, and the camera AI has the same limitation.
  const faceStatus = useMemo(() => {
    const map = {};
    studentList.forEach(s => {
      const key = (s.full_name || '').toLowerCase().trim();
      map[s.id] = key ? enrolledFaces.has(key) : false;
    });
    return map;
  }, [studentList, enrolledFaces]);

  // Biometric consent map: studentId → 'granted' | 'refused' | 'pending'
  // PDPA s.40 requires explicit parental consent before face data can be processed.
  // Face enrolment is gated on this map in handleRegisterFace below.
  const [consentMap, setConsentMap] = useState({});
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('biometric_consents')
      .select('student_id, granted, revoked_at, created_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('AdminPanel: failed to load biometric_consents', error.message);
          return;
        }
        const map = {};
        (data || []).forEach(row => {
          if (!(row.student_id in map)) {
            map[row.student_id] = row.granted ? 'granted' : 'refused';
          }
        });
        setConsentMap(map);
      });
    return () => { cancelled = true; };
  }, [studentList.length]);

  const consentStatusFor = (studentId) => consentMap[studentId] || 'pending';

  // --- Audit log filtering (client-side on target_type) ---
  const filteredLogs = logFilter === 'all'
    ? auditLogsData
    : auditLogsData.filter(l => (l.target_type || '').toLowerCase() === logFilter);

  // Sort users
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setUserPage(1);
  };

  const sortedUsers = [...profiles].sort((a, b) => {
    if (!sortCol) return 0;
    const aVal = (a[sortCol] || '').toString().toLowerCase();
    const bVal = (b[sortCol] || '').toString().toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate users
  const totalUserPages = Math.ceil(sortedUsers.length / PER_PAGE);
  const paginatedUsers = sortedUsers.slice((userPage - 1) * PER_PAGE, userPage * PER_PAGE);

  // Paginate logs
  const totalLogPages = Math.ceil(filteredLogs.length / PER_PAGE);
  const paginatedLogs = filteredLogs.slice((logPage - 1) * PER_PAGE, logPage * PER_PAGE);

  // Reset log page when filter changes
  const handleLogFilter = (f) => {
    setLogFilter(f);
    setLogPage(1);
  };

  const handleRoleFilter = (r) => {
    setRoleFilter(r);
    setUserPage(1);
  };

  // Sort indicator (plain render function, not a component, so it is not recreated during render)
  const renderSortIcon = (col) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  // Form validation — required fields depend on the modal mode.
  const validateForm = () => {
    const errors = {};
    if (!formName.trim()) errors.name = 'Name is required';
    if (!formEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!formEmail.includes('@')) {
      errors.email = 'Email must contain @';
    }
    return errors;
  };

  const resetForm = () => {
    setEditingUserId(null);
    setFormName('');
    setFormEmail('');
    setFormRole('teacher');
    setFormPhone('');
    setFormAvatarUrl('');
    setFormClass('');
    setFormErrors({});
    setFormSubmitting(false);
  };

  const handleOpenAddUser = () => {
    setModalMode('add');
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditUser = (u) => {
    setModalMode('edit');
    setEditingUserId(u.id);
    setFormName(u.full_name || '');
    setFormEmail(u.email || '');
    setFormRole(u.role || 'teacher');
    setFormPhone(u.phone || '');
    setFormAvatarUrl(u.avatar_url || '');
    setFormClass('');
    setFormErrors({});
    setFormSubmitting(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (formSubmitting) return;
    setShowModal(false);
    resetForm();
  };

  const apiHeaders = () => {
    const token = session?.access_token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const parseApiError = async (res) => {
    try {
      const body = await res.json();
      return body?.error || `Request failed (${res.status})`;
    } catch {
      return `Request failed (${res.status})`;
    }
  };

  const handleSubmitUser = async () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!session?.access_token) {
      toast('You must be signed in as an admin to do that.', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      if (modalMode === 'add') {
        const payload = {
          email: formEmail.trim(),
          full_name: formName.trim(),
          role: formRole,
        };
        if (formPhone.trim()) payload.phone = formPhone.trim();

        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const msg = await parseApiError(res);
          toast(msg, 'error');
          setFormSubmitting(false);
          return;
        }

        // The server creates the account straight away and returns the password
        // it generated, if it generated one. Surface it so the admin can hand
        // it to the user.
        const created = await res.json().catch(() => null);
        const tempPassword = created?.temporary_password;
        toast(
          tempPassword
            ? `User created. Temporary password: ${tempPassword}. Hand it to the user; they change it after signing in.`
            : `User created for ${payload.email}.`,
          'success'
        );
        setShowModal(false);
        resetForm();
        refreshProfiles();
      } else {
        // Edit mode — PATCH only the editable fields.
        const payload = {
          email: formEmail.trim(),
          full_name: formName.trim(),
          role: formRole,
          phone: formPhone.trim() || null,
          avatar_url: formAvatarUrl.trim() || null,
        };

        const res = await fetch(`/api/admin/users/${editingUserId}`, {
          method: 'PATCH',
          headers: apiHeaders(),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const msg = await parseApiError(res);
          toast(msg, 'error');
          setFormSubmitting(false);
          return;
        }

        toast('User updated', 'success');
        setShowModal(false);
        resetForm();
        refreshProfiles();
      }
    } catch (err) {
      console.error('admin user submit failed', err);
      toast('Could not reach the server. Is the API running?', 'error');
      setFormSubmitting(false);
    }
  };

  const handleOpenDeleteUser = (u) => {
    setUserToDelete(u);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setUserToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (!session?.access_token) {
      toast('You must be signed in as an admin to do that.', 'error');
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        toast(msg, 'error');
        setDeleting(false);
        return;
      }

      toast(`Deleted ${userToDelete.full_name || 'user'}`, 'success');
      setUserToDelete(null);
      setDeleting(false);
      refreshProfiles();
    } catch (err) {
      console.error('admin user delete failed', err);
      toast('Could not reach the server. Is the API running?', 'error');
      setDeleting(false);
    }
  };

  // Face Registration helpers
  const faceFilteredStudents = studentList.filter(s => {
    if (faceYearFilter !== 'all' && s.year_num !== Number(faceYearFilter)) return false;
    const className = s.class_section?.name;
    if (faceClassFilter !== 'all' && className !== faceClassFilter) return false;
    if (faceStatusFilter === 'registered' && !faceStatus[s.id]) return false;
    if (faceStatusFilter === 'not_registered' && faceStatus[s.id]) return false;
    return true;
  });

  const totalFaces = studentList.length;
  const registeredFaces = studentList.filter(s => faceStatus[s.id]).length;
  const notRegisteredFaces = totalFaces - registeredFaces;
  const registrationRate = totalFaces > 0 ? Math.round((registeredFaces / totalFaces) * 100) : 0;

  const FACE_PER_PAGE = 12;
  const totalFacePages = Math.ceil(faceFilteredStudents.length / FACE_PER_PAGE);
  const paginatedFaceStudents = faceFilteredStudents.slice((facePage - 1) * FACE_PER_PAGE, facePage * FACE_PER_PAGE);

  // Build progress data grouped by year and class. Uses the real years and
  // class sections from Supabase (P7) — groups with no students are skipped.
  const getProgressData = () => {
    const filteredYears = faceYearFilter === 'all' ? years.map(y => y.year_num) : [Number(faceYearFilter)];
    // class_sections holds one row per section, so class names repeat across years; dedupe them.
    const filteredClasses = faceClassFilter === 'all' ? [...new Set(classSections.map(c => c.name))] : [faceClassFilter];
    const groups = [];
    filteredYears.forEach(y => {
      filteredClasses.forEach(c => {
        const classStudents = studentList.filter(s => s.year_num === y && s.class_section?.name === c);
        if (classStudents.length === 0) return;
        const reg = classStudents.filter(s => faceStatus[s.id]).length;
        groups.push({ year: y, class: c, registered: reg, total: classStudents.length, pct: Math.round((reg / classStudents.length) * 100) });
      });
    });
    return groups;
  };

  // Colour for a class name: palette map first (seed colours match it),
  // then the class section's own colour column, then plain ink.
  const classColorOf = (name) => classColors[name]
    || classSections.find(c => c.name === name)?.color
    || 'var(--ink)';

  // Class names repeat across years in class_sections — offer each once.
  const faceClassNames = useMemo(
    () => [...new Set(classSections.map(c => c.name))],
    [classSections],
  );

  const handleRegisterFace = (student) => {
    const status = consentStatusFor(student.id);
    if (status === 'pending') {
      toast(
        `Cannot enrol: no parental consent on file for ${student.full_name}. The parent must complete the Biometric Consent in the Parent Portal first.`,
        'error',
        5000,
      );
      return;
    }
    if (status === 'refused') {
      toast(
        `Parent has explicitly refused biometric processing for ${student.full_name}. Use manual attendance.`,
        'error',
        5000,
      );
      return;
    }
    if (!isAdmin) {
      toast('Face enrollment is admin-only.', 'error');
      return;
    }
    // The capture itself runs through the enrollment card's flow — preselect
    // the student there and bring the operator to it.
    setEnrollStudentId(student.id);
    enrollCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`${student.full_name} selected — click Start Enrollment when ready.`, 'info');
  };

  // The model cards used to carry a 'Retrain' stub; no in-app retraining
  // exists, so that button is gone. 'Re-enroll Faces' hands the operator to
  // the real thing instead: the enrollment card on the Face Registration
  // tab. The card only mounts with the tab, so the scroll is deferred: the
  // effect above completes it after the switch has rendered (same
  // scrollIntoView the Register Face buttons use).
  const handleReenrollFaces = () => {
    pendingEnrollScrollRef.current = true;
    setTab('faces');
  };

  useEffect(() => {
    if (!pendingEnrollScrollRef.current || tab !== 'faces') return;
    pendingEnrollScrollRef.current = false;
    enrollCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [tab]);

  // Delete the stored face embedding for a student (admin-only endpoint).
  // Re-enrolling afterwards is just the normal Register Face flow.
  const handleRemoveFace = async (student) => {
    if (!student) return;
    if (!isAdmin || !session?.access_token) {
      toast('Removing a face enrollment is admin-only.', 'error');
      return;
    }
    const ok = window.confirm(
      `Remove the enrolled face for ${student.full_name}? The camera will no longer recognize them until they are enrolled again.`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/ai/enrolled/${encodeURIComponent(student.full_name)}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (!res.ok) {
        toast(await parseApiError(res), 'error', 5000);
        return;
      }
      const body = await res.json().catch(() => ({}));
      toast(
        `Removed face enrollment for ${body.name || student.full_name}.${body.aiRunning ? ' Restart the AI to apply it to the live camera.' : ''}`,
        'success',
        5000,
      );
      refreshEnrolledFaces();
    } catch (err) {
      console.error('remove face failed', err);
      toast('Could not reach the server. Is the API running?', 'error');
    }
  };

  // Start an in-browser enrollment session for the selected student.
  // Consent stays a client-side check for instant feedback (the server
  // enforces it too). On success the EnrollmentCamera component takes
  // over and drives /api/ai/enroll/frame + /api/ai/enroll/complete.
  // Error bodies carry operator-friendly messages (GPU offline, helper
  // down, session already active), so prefer them for the toast.
  const enrollErrorMessage = async (res) => {
    try {
      const body = await res.json();
      return body?.message || body?.error || `Request failed (${res.status})`;
    } catch {
      return `Request failed (${res.status})`;
    }
  };

  // Restart the single supervised AI process (stop + start = model reload,
  // up to ~30s). Every model card carries a Restart button but they all
  // drive the same one AI process; aiRestarting disables all of them until
  // the request settles so a second click cannot double-fire it. Error
  // bodies carry operator-facing text (GPU refusals, restart already in
  // progress), so the toast repeats the server's words verbatim. The busy
  // flag clears after the try/catch, never in a finally block: a setState
  // in finally silently disables the React Compiler lint for this file.
  const handleRestartAi = async () => {
    if (aiRestarting) return;
    if (!session?.access_token) {
      toast('You must be signed in as an admin to do that.', 'error');
      return;
    }
    setAiRestarting(true);
    try {
      const res = await fetch('/api/ai/restart', {
        method: 'POST',
        headers: apiHeaders(),
      });
      if (res.ok) {
        toast('AI service restarted', 'success');
      } else {
        const msg = await enrollErrorMessage(res);
        toast(msg, 'error', 5000);
      }
    } catch (err) {
      console.error('AI restart failed', err);
      toast('Could not reach the server. Is the API running?', 'error');
    }
    setAiRestarting(false);
  };

  // Force-stop an orphaned AI process. GET /api/ai/process sets orphan=true
  // when port 5174 is held by an AI child the current server run does not
  // supervise (one that survived a server restart); DELETE /api/ai/process
  // stops whatever PID holds the port. Confirmed like remove-face, then the
  // process snapshot refreshes so the control disappears with the orphan.
  // No finally block here either (see handleRestartAi): the flag clears and
  // the refresh runs after the try/catch on every path.
  const handleForceStopOrphan = async () => {
    if (killingOrphan) return;
    if (!isAdmin || !session?.access_token) {
      toast('Stopping the AI process is admin-only.', 'error');
      return;
    }
    const ok = window.confirm(
      'Force stop the orphaned AI process? The camera stays offline until the AI service is started again.',
    );
    if (!ok) return;
    setKillingOrphan(true);
    try {
      const res = await fetch('/api/ai/process', {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (res.ok) {
        toast('Orphaned AI process stopped.', 'success');
      } else {
        const msg = await enrollErrorMessage(res);
        toast(msg, 'error', 5000);
      }
    } catch (err) {
      console.error('orphan force stop failed', err);
      toast('Could not reach the server. Is the API running?', 'error');
    }
    setKillingOrphan(false);
    setProcRefreshTick(t => t + 1);
  };

  const handleStartEnrollment = async () => {
    if (!enrollStudentId) {
      toast('Pick a student first.', 'error');
      return;
    }
    if (consentStatusFor(enrollStudentId) !== 'granted') {
      toast('This student\u2019s parent has not granted biometric consent.', 'error');
      return;
    }
    if (!session?.access_token) {
      toast('You must be signed in as an admin to do that.', 'error');
      return;
    }
    const target = studentList.find(s => s.id === enrollStudentId);
    setEnrolling(true);
    setEnrollNotice(null);
    try {
      const res = await fetch('/api/ai/enroll/session', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ student_id: enrollStudentId }),
      });
      if (!res.ok) {
        const msg = await enrollErrorMessage(res);
        toast(msg, 'error', 5000);
        setEnrollNotice(msg);
        setEnrolling(false);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setEnrollSession({
        sessionId: body.session_id,
        studentName: body.student_name || target?.full_name || 'student',
        requiredCaptures: body.required_captures || 5,
      });
      setEnrolling(false);
    } catch (err) {
      console.error('enroll session failed', err);
      const msg = 'Could not reach the server. Is the API running?';
      toast(msg, 'error');
      setEnrollNotice(msg);
      setEnrolling(false);
    }
  };

  // The camera component finished a full capture set: the server has
  // already replaced the stored face, so refresh the enrolled set and
  // return the card to its idle picker state.
  const handleEnrollSuccess = (message) => {
    setEnrollSession(null);
    setEnrollNotice(null);
    toast(message || `Enrolled ${enrollSession?.studentName || 'student'}.`, 'success', 5000);
    refreshEnrolledFaces();
  };

  const handleEnrollCancel = () => {
    setEnrollSession(null);
    toast('Enrollment cancelled.', 'info');
  };

  const classColorMap = { Bestari: 'b', Bijak: 'r', Cerdik: 'g', Cerdas: 'o', Pandai: 'y' };

  // --- System Settings (Supabase table app_settings, single row id = 1) ---
  // Staff can read the row; only admins may update it (RLS). Non-admins get
  // the form disabled with no Save/Reset buttons.
  const [settingsForm, setSettingsForm] = useState(SETTINGS_DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    // loading starts true and the effect runs once — no synchronous resets
    // needed here.
    let cancelled = false;
    supabase
      .from('app_settings')
      .select('school_name, late_cutoff, det_size, match_threshold, autorestart_ai, classroom_label')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          console.error('AdminPanel: failed to load app_settings', queryError);
          setSettingsError(queryError);
        } else if (data) {
          setSettingsForm({
            school_name: data.school_name ?? SETTINGS_DEFAULTS.school_name,
            // Postgres `time` comes back as 'HH:MM:SS'; the time input on a
            // 60s step only accepts 'HH:MM'.
            late_cutoff: (data.late_cutoff || SETTINGS_DEFAULTS.late_cutoff).slice(0, 5),
            det_size: data.det_size ?? SETTINGS_DEFAULTS.det_size,
            match_threshold: data.match_threshold ?? SETTINGS_DEFAULTS.match_threshold,
            classroom_label: data.classroom_label ?? SETTINGS_DEFAULTS.classroom_label,
            autorestart_ai: data.autorestart_ai ?? SETTINGS_DEFAULTS.autorestart_ai,
          });
        }
        // No row yet → keep the defaults in the form; saving will report
        // honestly that the record is missing until migration 0005 seeds it.
        setSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSaveSettings = async () => {
    if (!session?.access_token) {
      toast('You must be signed in as an admin to do that.', 'error');
      return;
    }
    if (!settingsForm.school_name.trim()) {
      toast('School name cannot be empty.', 'error');
      return;
    }
    setSettingsSaving(true);
    const payload = {
      school_name: settingsForm.school_name.trim(),
      late_cutoff: settingsForm.late_cutoff || SETTINGS_DEFAULTS.late_cutoff,
      det_size: Number(settingsForm.det_size),
      match_threshold: Number(settingsForm.match_threshold),
      classroom_label: settingsForm.classroom_label,
      autorestart_ai: Boolean(settingsForm.autorestart_ai),
    };
    const { data, error: updateError } = await supabase
      .from('app_settings')
      .update(payload)
      .eq('id', 1)
      .select();
    setSettingsSaving(false);
    if (updateError) {
      console.error('AdminPanel: failed to save app_settings', updateError);
      toast("Couldn't save settings. Only admins can change them.", 'error');
      return;
    }
    if (!data || data.length === 0) {
      toast('Settings were not saved — the settings record is missing from the database.', 'error', 5000);
      return;
    }
    setSettingsForm({ ...payload });
    toast('Settings saved.', 'success');
  };

  // Reset puts the migration defaults back into the form only — nothing is
  // written until the operator clicks Save Settings.
  const handleResetSettings = () => {
    setSettingsForm({ ...SETTINGS_DEFAULTS });
    toast('Form reset to defaults. Click Save Settings to keep them.', 'info');
  };

  // Server uptime from GET /api/health uptimeSeconds, e.g. '4h 12m'.
  const formatUptime = (secs) => {
    if (secs == null || !Number.isFinite(secs) || secs < 0) return '—';
    const totalMinutes = Math.floor(secs / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${Math.floor(secs)}s`;
  };

  // Latest deployed model's accuracy for the overview card (useAiModels
  // orders by deployed_at desc, so models[0] is the newest). The table
  // column is `accuracy` and already holds a percent (e.g. 95.50).
  const latestAccuracy = aiModels.length > 0 && aiModels[0].accuracy != null
    ? Math.round(Number(aiModels[0].accuracy) * 100) / 100
    : null;
  const latestAccuracyLabel = latestAccuracy != null ? `${latestAccuracy}%` : '—';

  // 'Model Accuracy Over Time' series built from the real ai_models rows:
  // x = deployed date, y = accuracy. Oldest first so the line reads left to
  // right through time.
  const accuracyHistory = useMemo(() => (
    aiModels
      .filter(m => m.deployed_at && m.accuracy != null)
      .slice()
      .reverse()
      .map((m) => {
        const d = new Date(m.deployed_at);
        return {
          date: Number.isNaN(d.getTime())
            ? (m.version || '?')
            : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          accuracy: Math.round(Number(m.accuracy) * 100) / 100,
        };
      })
  ), [aiModels]);

  // Y axis padded ±2 points around the real data, clamped to 0–100.
  const accuracyDomain = useMemo(() => {
    if (accuracyHistory.length === 0) return [0, 100];
    const values = accuracyHistory.map(p => p.accuracy);
    return [
      Math.max(0, Math.floor(Math.min(...values) - 2)),
      Math.min(100, Math.ceil(Math.max(...values) + 2)),
    ];
  }, [accuracyHistory]);

  // Auto-restart status for the AI tab line: prefer the live value from
  // GET /api/ai/process; fall back to the settings row the toggle writes.
  const autoRestartOn = aiProcDetail.autorestartEnabled != null
    ? aiProcDetail.autorestartEnabled
    : Boolean(settingsForm.autorestart_ai);

  const overviewStats = [
    { label: 'Total Users', value: profiles.length, icon: Users, variant: 's-blue', tape: 'tl' },
    { label: 'Active Cameras', value: aiProcRunning ? 1 : 0, icon: Wifi, variant: 's-green', tape: 'tr' },
    { label: 'System Uptime', value: serverOnline === false ? 'Offline' : formatUptime(uptimeSeconds), icon: Server, variant: 's-yellow', tape: 'bl' },
    { label: 'AI Accuracy', value: latestAccuracyLabel, icon: Cpu, variant: 's-orange', tape: 'br' },
  ];

  // parent has no dedicated badge style; badge-info (blue, index.css) keeps it
  // distinct from teacher's badge-teacher green without new CSS.
  const roleBadge = { admin: 'badge-admin', teacher: 'badge-teacher', parent: 'badge-info' };
  const avatarColors = ['r', 'y', 'g', 'o', 'k'];

  // --- formatters ---
  const formatTimestamp = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getInitials = (name) => (name || '?').split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>
          <span className="word k">Admin</span> <span className="word r">Panel</span>
        </h1>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid-4 admin-section-gap">
        {overviewStats.map((s, i) => (
          <div key={i} className={`stat-card ${s.variant} reveal reveal-${(i % 5) + 1}`}>
            <span className={`tape ${s.tape}`} />
            <div className="icon-box"><s.icon size={22} /></div>
            <div className="stat-info"><h3>{s.value}</h3><p>{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="admin-tabs">
        {[
          { key: 'users', label: 'User Management', icon: UserCog, color: 'r' },
          { key: 'settings', label: 'System Settings', icon: Settings, color: 'b' },
          { key: 'logs', label: 'Audit Logs', icon: Activity, color: 'g' },
          { key: 'ai', label: 'AI Model Status', icon: Shield, color: 'o' },
          { key: 'faces', label: 'Face Registration', icon: ScanFace, color: 'k' },
        ].map(t => (
          <button
            key={t.key}
            className={`admin-tab tab-${t.color} ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="card admin-card admin-users-card">
          <span className="tape tl" />
          <div className="card-header">
            <div>
              <h2>Users</h2>
            </div>
            <div className="admin-users-header-controls">
              <div className="face-filter-group">
                <Filter size={16} />
                <select value={roleFilter} onChange={e => handleRoleFilter(e.target.value)}>
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              {isAdmin && (
                <button className="btn btn-yellow" onClick={handleOpenAddUser}><Plus size={16} /> Add User</button>
              )}
            </div>
          </div>
          {profilesLoading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : profilesError ? (
            <div className="empty-state admin-empty">Could not load users. Please try again.</div>
          ) : (
            /* RS-C: the users table keeps its natural ~660px width at phone
               sizes, which used to escape the ~302px card entirely. The
               wrapper scrolls it inside the card instead — same pattern as
               the Students and Dashboard tables — so the ACTION buttons stay
               reachable via the in-card scroll. */
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('full_name')}>User {renderSortIcon('full_name')}</th>
                  <th className="sortable" onClick={() => handleSort('role')}>Role {renderSortIcon('role')}</th>
                  <th>Phone</th>
                  <th>Email</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 5 : 4} className="empty-state">No results found.</td></tr>
                ) : (
                  paginatedUsers.map((u, i) => (
                    <tr key={u.id}>
                      <td>
                        <div className="admin-user-cell">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name} className={`avatar ${avatarColors[i % avatarColors.length]}`} />
                          ) : (
                            <div className={`avatar ${avatarColors[i % avatarColors.length]}`}>{getInitials(u.full_name)}</div>
                          )}
                          {u.full_name || '—'}
                        </div>
                      </td>
                      <td><span className={`badge ${roleBadge[u.role] || 'badge-teacher'}`}>{(u.role || '').charAt(0).toUpperCase() + (u.role || '').slice(1)}</span></td>
                      <td className="mono">{u.phone || '—'}</td>
                      <td className="mono admin-cell-email">{u.email || '—'}</td>
                      {isAdmin && (
                        <td>
                          <div className="admin-action-btns">
                            <button
                              className="btn btn-outline btn-icon"
                              onClick={() => handleOpenEditUser(u)}
                              aria-label={`Edit ${u.full_name || 'user'}`}
                            >
                              <Edit3 size={14} />
                            </button>
                            {authUser?.id !== u.id && (
                              <button
                                className="btn btn-danger btn-icon"
                                onClick={() => handleOpenDeleteUser(u)}
                                aria-label={`Delete ${u.full_name || 'user'}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          )}
          {!profilesLoading && !profilesError && totalUserPages > 1 && (
            <Pagination currentPage={userPage} totalPages={totalUserPages} onPageChange={setUserPage} />
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <div className="card admin-card admin-settings-card">
          <span className="tape tr" />
          <div className="card-header">
            <div>
              <h2>System Settings</h2>
            </div>
          </div>
          {settingsLoading ? (
            <div className="admin-loading-block">
              <div className="skeleton-line w-40" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-30" />
              <div className="skeleton-line w-60" />
            </div>
          ) : settingsError ? (
            <div className="empty-state admin-empty">Could not load settings. Please try again.</div>
          ) : (
            <>
              <div className="settings-grid">
                <div className="settings-section">
                  <h3>School</h3>
                  <div className="form-group">
                    <label>School Name</label>
                    <input
                      type="text"
                      value={settingsForm.school_name}
                      onChange={e => setSettingsForm(f => ({ ...f, school_name: e.target.value }))}
                      disabled={!isAdmin || settingsSaving}
                    />
                  </div>
                  <div className="form-group">
                    <label>Late Cutoff</label>
                    <input
                      type="time"
                      value={settingsForm.late_cutoff}
                      onChange={e => setSettingsForm(f => ({ ...f, late_cutoff: e.target.value }))}
                      disabled={!isAdmin || settingsSaving}
                    />
                  </div>
                </div>

                <div className="settings-section">
                  <h3>Recognition</h3>
                  <div className="form-group">
                    <label>Detection Size</label>
                    <select
                      value={settingsForm.det_size}
                      onChange={e => setSettingsForm(f => ({ ...f, det_size: Number(e.target.value) }))}
                      disabled={!isAdmin || settingsSaving}
                    >
                      {DET_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Match Threshold</label>
                    <input
                      type="range"
                      min="0.3"
                      max="0.6"
                      step="0.01"
                      className="admin-range"
                      value={settingsForm.match_threshold}
                      onChange={e => setSettingsForm(f => ({ ...f, match_threshold: Number(e.target.value) }))}
                      disabled={!isAdmin || settingsSaving}
                    />
                    <div className="admin-range-labels">
                      <span>30%</span>
                      <span>{Math.round(settingsForm.match_threshold * 100)}% (current)</span>
                      <span>60%</span>
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <h3>AI Service</h3>
                  <div className="form-group">
                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={Boolean(settingsForm.autorestart_ai)}
                        onChange={e => setSettingsForm(f => ({ ...f, autorestart_ai: e.target.checked }))}
                        disabled={!isAdmin || settingsSaving}
                      />
                      <span>Restart AI automatically after a crash</span>
                    </label>
                    <p className="admin-check-note">
                      A crashed AI service is started again after 3 seconds.
                      GPU refusals are never retried, and the server allows at
                      most 5 restarts in any 10 minutes.
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Classroom label</label>
                    <input
                      type="text"
                      value={settingsForm.classroom_label}
                      onChange={e => setSettingsForm(f => ({ ...f, classroom_label: e.target.value }))}
                      disabled={!isAdmin || settingsSaving}
                    />
                    <p className="admin-check-note">
                      Stamped on attendance and engagement data from this camera.
                    </p>
                  </div>
                </div>
              </div>
              <p className="settings-hint">
                Recognition settings apply the next time the AI service starts;
                late cutoff applies to new AI check-ins.
              </p>
              <div className="admin-settings-footer">
                {!isAdmin && (
                  <p className="settings-readonly-note">Viewing only — ask an admin to change these.</p>
                )}
                {isAdmin && (
                  <>
                    <button className="btn btn-outline" onClick={handleResetSettings} disabled={settingsSaving}>Reset Defaults</button>
                    <button className="btn btn-green" onClick={handleSaveSettings} disabled={settingsSaving}>
                      {settingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* LOGS TAB */}
      {tab === 'logs' && !isAdmin && (
        <div className="card admin-card admin-locked-card">
          <span className="tape bl" />
          <div className="admin-locked-body">
            <div className="admin-locked-icon"><Lock size={28} /></div>
            <h2>Admin access required</h2>
            <p>
              This area is restricted to administrators. Contact the school
              admin if you need access.
            </p>
          </div>
        </div>
      )}
      {tab === 'logs' && isAdmin && (
        <div className="card admin-card admin-logs-card">
          <span className="tape bl" />
          <div className="card-header">
            <div>
              <h2>Audit Logs</h2>
            </div>
            <div className="log-filters">
              {['all', 'system', 'user', 'attendance'].map(f => (
                <button key={f} className={`btn btn-sm ${logFilter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleLogFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {logsLoading ? (
            <div className="admin-loading-block">
              <div className="skeleton-line w-40" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-30" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-40" />
            </div>
          ) : logsError ? (
            <div className="empty-state admin-empty">Could not load audit logs. Please try again.</div>
          ) : paginatedLogs.length === 0 ? (
            <div className="empty-state admin-empty">No results found.</div>
          ) : (
            <ul className="admin-timeline">
              {paginatedLogs.map((log, i) => {
                const actorName = log.actor?.full_name || 'System';
                const targetLabel = log.target_type
                  ? `${log.target_type}${log.target_id ? ` #${String(log.target_id).slice(0, 8)}` : ''}`
                  : '';
                const typeKey = (log.target_type || 'system').toLowerCase();
                return (
                  <li key={log.id} className={`admin-timeline-item type-${typeKey}`}>
                    <span className="timeline-dot" />
                    <div className="timeline-time mono">{formatTimestamp(log.created_at)}</div>
                    <div className="timeline-body">
                      <div className="timeline-head">
                        <div className="admin-user-cell">
                          <div className={`avatar ${avatarColors[i % avatarColors.length]}`}>{getInitials(actorName)}</div>
                          <strong>{actorName}</strong>
                        </div>
                        {log.target_type && (
                          <span className={`badge badge-log-${typeKey}`}>{log.target_type.charAt(0).toUpperCase() + log.target_type.slice(1)}</span>
                        )}
                      </div>
                      <p className="timeline-action">
                        {log.action}{targetLabel ? <span className="mono admin-log-target"> &bull; {targetLabel}</span> : null}
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="admin-log-metadata mono">{JSON.stringify(log.metadata, null, 0)}</pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!logsLoading && !logsError && totalLogPages > 1 && (
            <Pagination currentPage={logPage} totalPages={totalLogPages} onPageChange={setLogPage} />
          )}
        </div>
      )}

      {/* AI TAB */}
      {tab === 'ai' && !isAdmin && (
        <div className="card admin-card admin-locked-card">
          <span className="tape tr" />
          <div className="admin-locked-body">
            <div className="admin-locked-icon"><Lock size={28} /></div>
            <h2>Admin access required</h2>
            <p>
              This area is restricted to administrators. Contact the school
              admin if you need access.
            </p>
          </div>
        </div>
      )}
      {tab === 'ai' && isAdmin && (
        <div>
          {/* Live AI process line (GET /api/ai/process): running state and
              crash auto-restart status, plus the force-stop control when an
              unsupervised AI child is holding the camera port. */}
          <div className="card admin-card ai-process-card">
            <span className="tape tl" />
            <div className="ai-process-row">
              <span className={`ai-status-indicator ${aiProcRunning ? '' : 'is-stopped'}`} />
              <span className="ai-process-text">
                AI process: <strong>{aiProcRunning ? 'Running' : 'Stopped'}</strong>
              </span>
              <span className="ai-process-status mono">
                {`Auto-restart: ${autoRestartOn ? 'ON' : 'OFF'}${aiProcDetail.autorestartsRecent != null ? ` (${aiProcDetail.autorestartsRecent} recent)` : ''}`}
              </span>
              {aiProcDetail.orphan && (
                <div className="ai-orphan-box">
                  {aiProcDetail.note && <p className="ai-orphan-note">{aiProcDetail.note}</p>}
                  <button className="btn btn-danger" onClick={handleForceStopOrphan} disabled={killingOrphan}>
                    <Power size={14} /> {killingOrphan ? 'Stopping...' : 'Force stop orphaned AI'}
                  </button>
                </div>
              )}
            </div>
          </div>
          {modelsLoading ? (
            <div className="ai-status-grid">
              <div className="card admin-card"><div className="skeleton-line w-40" /><div className="skeleton-line w-60" /><div className="skeleton-line w-30" /></div>
              <div className="card admin-card"><div className="skeleton-line w-40" /><div className="skeleton-line w-60" /><div className="skeleton-line w-30" /></div>
              <div className="card admin-card"><div className="skeleton-line w-40" /><div className="skeleton-line w-60" /><div className="skeleton-line w-30" /></div>
            </div>
          ) : modelsError ? (
            <div className="card admin-card"><div className="empty-state admin-empty">Could not load AI models. Please try again.</div></div>
          ) : aiModels.length === 0 ? (
            <div className="card admin-card"><div className="empty-state admin-empty">No AI models found.</div></div>
          ) : (
            <div className="ai-status-grid">
              {aiModels.map((m, i) => {
                const tapes = ['tl', 'tr', 'br', 'bl'];
                const accuracyPct = m.accuracy != null ? Math.round(Number(m.accuracy) * 100) / 100 : null;
                const statusKey = (m.status || 'unknown').toLowerCase();
                return (
                  <div key={m.id} className="card admin-card ai-card-active">
                    <span className={`tape ${tapes[i % tapes.length]}`} />
                    <div className="ai-status-indicator" />
                    <h3>{m.name || 'Untitled Model'}</h3>
                    <p>Status: <strong className={`ai-status-${statusKey}`}>{(m.status || 'Unknown').charAt(0).toUpperCase() + (m.status || 'unknown').slice(1)}</strong></p>
                    <small className="mono">{m.version ? `${m.version} ` : ''}&bull; Deployed: {formatDate(m.deployed_at)}</small>
                    {accuracyPct != null && (
                      <div className="ai-metric admin-section-gap">
                        <span>Accuracy</span>
                        <div className="progress-bar"><div className="progress-fill fill-green" style={{ width: `${Math.min(100, accuracyPct)}%` }} /></div>
                        <strong className="mono">{accuracyPct}%</strong>
                      </div>
                    )}
                    <div className="ai-actions">
                      {/* Every card's Restart button drives the same single AI
                          process; aiRestarting keeps them from double-firing. */}
                      <button className="btn btn-outline" onClick={handleRestartAi} disabled={aiRestarting}>
                        <Power size={14} /> {aiRestarting ? 'Restarting...' : 'Restart'}
                      </button>
                      <button className="btn btn-yellow" onClick={handleReenrollFaces}>
                        <ScanFace size={14} /> Re-enroll Faces
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card admin-card admin-chart-card admin-section-gap">
            <span className="tape tl" />
            <span className="tape tr" />
            <div className="card-header">
              <div>
                <h2>Model Accuracy Over Time</h2>
              </div>
            </div>
            {accuracyHistory.length === 0 ? (
              <div className="empty-state admin-empty">No model accuracy data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                {/* Right margin keeps the last x-axis label ('30 JUN') clear of
                    the card edge instead of clipping to '3 JU'. */}
                <LineChart data={accuracyHistory} margin={{ top: 8, right: 28, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,26,18,0.18)" />
                  <XAxis dataKey="date" fontSize={12} stroke="#1F1A12" />
                  <YAxis fontSize={12} domain={accuracyDomain} stroke="#1F1A12" />
                  <Tooltip
                    contentStyle={{ background: '#FAF1DA', border: '2px solid #1F1A12', fontFamily: 'Patrick Hand' }}
                    formatter={value => [`${value}%`, 'Accuracy']}
                  />
                  <Line type="monotone" dataKey="accuracy" stroke="#E04A3F" strokeWidth={3} dot={{ fill: '#E04A3F', r: 5, stroke: '#1F1A12', strokeWidth: 1 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* FACE REGISTRATION TAB */}
      {tab === 'faces' && (
        <div className="face-reg-section">
          {studentsLoading ? (
            <div className="card admin-card">
              <div className="skeleton-line w-40" />
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-30" />
              <div className="skeleton-line w-60" />
            </div>
          ) : studentsError ? (
            <div className="card admin-card"><div className="empty-state admin-empty">Could not load students. Please try again.</div></div>
          ) : (
            <>
              {/* Enroll a new face — admin-only */}
              {isAdmin && (
                <div className="card admin-card face-enroll-card" ref={enrollCardRef}>
                  <span className="tape tl" />
                  <div className="card-header">
                    <div>
                      <h2>Enroll a new face</h2>
                    </div>
                  </div>
                  <p className="face-enroll-blurb">
                    Pick a student, then click <strong>Start Enrollment</strong>.
                    Your browser opens the camera and captures five frames.
                    Keep the student facing the camera and still until the
                    captures finish.
                  </p>
                  <div className="face-enroll-row">
                    <select
                      className="face-enroll-select"
                      value={enrollStudentId}
                      onChange={e => setEnrollStudentId(e.target.value)}
                      disabled={enrolling || Boolean(enrollSession)}
                    >
                      <option value="">— Pick a student —</option>
                      {studentList
                        .slice()
                        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                        .filter(s => consentStatusFor(s.id) === 'granted')
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} (Year {s.year_num} &middot; {s.class_section?.name || '—'})
                          </option>
                        ))}
                    </select>
                    <button
                      className="btn btn-green"
                      onClick={handleStartEnrollment}
                      disabled={enrolling || !enrollStudentId || Boolean(enrollSession)}
                    >
                      <Camera size={16} /> {enrolling ? 'Starting…' : 'Start Enrollment'}
                    </button>
                  </div>
                  {enrollNotice && !enrollSession && (
                    <div className="face-enroll-status">
                      <ScanFace size={18} /> {enrollNotice}
                    </div>
                  )}
                  {enrollSession && (
                    <EnrollmentCamera
                      sessionId={enrollSession.sessionId}
                      studentName={enrollSession.studentName}
                      requiredCaptures={enrollSession.requiredCaptures}
                      onSuccess={handleEnrollSuccess}
                      onCancel={handleEnrollCancel}
                    />
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="grid-4 face-stats-row">
                <div className="stat-card s-blue reveal reveal-1">
                  <span className="tape tl" />
                  <div className="icon-box"><Users size={22} /></div>
                  <div className="stat-info"><h3>{totalFaces}</h3><p>Total Students</p></div>
                </div>
                <div className="stat-card s-green reveal reveal-2">
                  <span className="tape tr" />
                  <div className="icon-box"><UserCheck size={22} /></div>
                  <div className="stat-info"><h3>{registeredFaces}</h3><p>Faces Registered</p></div>
                </div>
                <div className="stat-card s-red reveal reveal-3">
                  <span className="tape bl" />
                  <div className="icon-box"><UserX size={22} /></div>
                  <div className="stat-info"><h3>{notRegisteredFaces}</h3><p>Not Registered</p></div>
                </div>
                <div className="stat-card s-yellow reveal reveal-4">
                  <span className="tape br" />
                  <div className="icon-box"><ScanFace size={22} /></div>
                  <div className="stat-info"><h3>{registrationRate}%</h3><p>Registration Rate</p></div>
                </div>
              </div>

              {/* Filters */}
              <div className="card admin-card face-filters-card">
                <span className="tape tl" />
                <div className="face-filters">
                  <div className="face-filter-group">
                    <Filter size={16} />
                    <select value={faceYearFilter} onChange={e => { setFaceYearFilter(e.target.value); setFacePage(1); }}>
                      <option value="all">All Years</option>
                      {years.map(y => <option key={y.year_num} value={y.year_num}>Year {y.year_num}</option>)}
                    </select>
                  </div>
                  <div className="face-filter-group">
                    <select value={faceClassFilter} onChange={e => { setFaceClassFilter(e.target.value); setFacePage(1); }}>
                      <option value="all">All Classes</option>
                      {faceClassNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div className="face-filter-group">
                    <select value={faceStatusFilter} onChange={e => { setFaceStatusFilter(e.target.value); setFacePage(1); }}>
                      <option value="all">All Status</option>
                      <option value="registered">Registered</option>
                      <option value="not_registered">Not Registered</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="card admin-card face-progress-card">
                <span className="tape tr" />
                <div className="card-header">
                  <div><h2>Registration Progress</h2></div>
                </div>
                <div className="face-progress-list">
                  {getProgressData().map((g) => (
                    <div key={`${g.year}-${g.class}`} className="face-progress-row">
                      <div className="face-progress-label">
                        <span className="face-progress-year mono">Y{g.year}</span>
                        <span className="face-progress-class" style={{ color: classColorOf(g.class) }}>{g.class}</span>
                      </div>
                      <div className="face-progress-bar-wrap">
                        <div className="progress-bar face-progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${g.pct}%`, background: classColorOf(g.class) }}
                          />
                        </div>
                      </div>
                      <div className="face-progress-fraction mono">
                        {g.registered}/{g.total}
                      </div>
                      <div className={`face-progress-pct mono ${g.pct === 100 ? 'pct-full' : ''}`}>
                        {g.pct}%
                      </div>
                    </div>
                  ))}
                  {getProgressData().length === 0 && (
                    <div className="empty-state admin-empty">No classes match the selected filters.</div>
                  )}
                </div>
              </div>

              {/* Student Cards */}
              <div className="card admin-card face-students-card">
                <span className="tape bl" />
                <div className="card-header">
                  <div><h2>Students</h2></div>
                  <span className="face-count-label mono">{faceFilteredStudents.length} student{faceFilteredStudents.length !== 1 ? 's' : ''}</span>
                </div>
                {paginatedFaceStudents.length === 0 ? (
                  <div className="empty-state admin-empty">No students match the selected filters.</div>
                ) : (
                  <div className="face-student-grid">
                    {paginatedFaceStudents.map(s => {
                      const className = s.class_section?.name || '—';
                      const consent = consentStatusFor(s.id);
                      const consentBadge = consent === 'granted'
                        ? { cls: 'badge-consent-yes', icon: <ShieldCheck size={12} />, label: 'Consent OK' }
                        : consent === 'refused'
                          ? { cls: 'badge-consent-no', icon: <ShieldAlert size={12} />, label: 'Parent refused' }
                          : { cls: 'badge-consent-pending', icon: <ShieldAlert size={12} />, label: 'Awaiting consent' };
                      const canRegister = consent === 'granted';
                      return (
                        <div key={s.id} className={`face-student-card ${faceStatus[s.id] ? 'registered' : 'not-registered'} consent-${consent}`}>
                          <div className="face-student-top">
                            <div className={`avatar ${classColorMap[className] || 'k'}`}>
                              {getInitials(s.full_name)}
                            </div>
                            <div className="face-student-info">
                              <strong>{s.full_name}</strong>
                              <span className="face-student-meta mono">Year {s.year_num} &bull; {className}</span>
                            </div>
                          </div>
                          <div className="face-consent-row">
                            <span className={`badge ${consentBadge.cls}`}>
                              {consentBadge.icon} {consentBadge.label}
                            </span>
                          </div>
                          <div className="face-student-bottom">
                            <span className={`badge ${faceStatus[s.id] ? 'badge-face-reg' : 'badge-face-unreg'}`}>
                              {faceStatus[s.id] ? <><Check size={12} /> Registered</> : <><X size={12} /> Not Registered</>}
                            </span>
                            {/* Belt-and-braces: the route guard already keeps
                                non-admins off this page; hide the enrollment
                                mutation buttons too in case it is relaxed. */}
                            {isAdmin && (faceStatus[s.id] ? (
                              <button className="btn btn-outline btn-face-remove" onClick={() => handleRemoveFace(s)}>
                                <UserX size={14} /> Remove
                              </button>
                            ) : (
                              <button
                                className="btn btn-green btn-face-register"
                                onClick={() => handleRegisterFace(s)}
                                disabled={!canRegister}
                                title={canRegister ? '' : 'Parental consent required before enrolment'}
                              >
                                <Camera size={14} /> Register Face
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {totalFacePages > 1 && (
                  <Pagination currentPage={facePage} totalPages={totalFacePages} onPageChange={setFacePage} />
                )}
              </div>

            </>
          )}
        </div>
      )}

      {/* ADD / EDIT USER MODAL */}
      {showModal && (
        <div className="modal-overlay user-form-modal" onClick={handleCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{modalMode === 'edit' ? 'Edit User' : 'Add New User'}</h2>
              <button className="modal-close-btn" onClick={handleCloseModal} disabled={formSubmitting}><X size={20} /></button>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter full name"
                className={formErrors.name ? 'input-error' : ''}
                value={formName}
                onChange={e => setFormName(e.target.value)}
                disabled={formSubmitting}
              />
              {formErrors.name && <span className="field-error">{formErrors.name}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter email"
                className={formErrors.email ? 'input-error' : ''}
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                disabled={formSubmitting}
              />
              {formErrors.email && <span className="field-error">{formErrors.email}</span>}
            </div>
            <div className="admin-form-row-2">
              <div className="form-group">
                <label>Role</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} disabled={formSubmitting}>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Phone <span className="user-form-hint">(optional)</span></label>
                <input
                  type="tel"
                  placeholder="e.g. 012-3456789"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
            </div>
            {modalMode === 'edit' && (
              <div className="form-group">
                <label>Avatar URL <span className="user-form-hint">(optional)</span></label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formAvatarUrl}
                  onChange={e => setFormAvatarUrl(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>
            )}
            {modalMode === 'add' && (
              <p className="user-form-note">
                The account is created straight away. After saving, a temporary
                password is shown; hand it to the user so they can sign in and
                set their own.
              </p>
            )}
            <div className="admin-modal-footer">
              <button className="btn btn-outline" onClick={handleCloseModal} disabled={formSubmitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitUser} disabled={formSubmitting}>
                {formSubmitting
                  ? (modalMode === 'edit' ? 'Saving...' : 'Adding...')
                  : (modalMode === 'edit' ? 'Save Changes' : 'Add User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div className="modal-overlay user-delete-modal" onClick={handleCancelDelete}>
          <div className="modal user-delete-modal-card" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Delete User?</h2>
              <button className="modal-close-btn" onClick={handleCancelDelete} disabled={deleting}><X size={20} /></button>
            </div>
            <p className="user-delete-message">
              Delete <strong>{userToDelete.full_name || 'this user'}</strong>? This permanently
              removes their account and all data.
            </p>
            <div className="admin-modal-footer">
              <button className="btn btn-outline" onClick={handleCancelDelete} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
