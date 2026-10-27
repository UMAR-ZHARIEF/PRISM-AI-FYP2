import { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Camera, AlertTriangle, Search, Activity, ArrowUp, ArrowDown, UserCheck, X,
  CalendarDays, Server, Cpu, Wifi, Shield, Power, Download, ScanFace, Settings,
  UserCog, Users, CheckCircle2, ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { classColors } from '../data/mockData';
import { useToast } from '../components/Toast';
import { useYear, ScopeContext } from '../layouts/DashboardLayout';
import Pagination from '../components/Pagination';
import { SkeletonCard, SkeletonTable, SkeletonChart } from '../components/Skeleton';
import useStudents from '../hooks/useStudents';
import useClassSections from '../hooks/useClassSections';
import useAttendance from '../hooks/useAttendance';
import useEngagement, { computeEngagementStats } from '../hooks/useEngagement';
import useProfiles from '../hooks/useProfiles';
import useEnrolledFaces from '../hooks/useEnrolledFaces';
import Papa from 'papaparse';
import './Engagement.css';
import useNotifications from '../hooks/useNotifications';
import useSchoolEvents from '../hooks/useSchoolEvents';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

// ISO date helper (YYYY-MM-DD) in local time.
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Bucket an arrival time string (HH:MM[:SS]) into a coarse half-hour label.
function bucketArrival(t) {
  if (!t || typeof t !== 'string') return null;
  const parts = t.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (Number.isNaN(h)) return null;
  const half = m >= 30 ? 30 : 0;
  return `${String(h).padStart(2, '0')}:${String(half).padStart(2, '0')}`;
}

// Relative "5m ago" label from an ISO timestamp (same shape as StudentProfile's).
function timeAgo(iso) {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toast = useToast();
  const navigate = useNavigate();
  const PER_PAGE = 8;

  // Bulk "Mark All Present" progress (null total = idle).
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Per-row Edit modal state — holds the raw attendance record being edited.
  const [editRecord, setEditRecord] = useState(null);
  const [editStatus, setEditStatus] = useState('present');
  const [editTimeOut, setEditTimeOut] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Year context (safe fallback if context not yet available)
  let yearCtx;
  try { yearCtx = useYear(); } catch { yearCtx = { selectedYear: null }; }
  const { selectedYear } = yearCtx;

  // Today and the 7-day window ending today (anchored to local-time date math).
  const today = useMemo(() => isoDate(new Date()), []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6); // 7-day window inclusive of today
    return isoDate(d);
  }, []);

  // AI status polling — Hazwan's Express bridge tells us if the
  // face_recognition.py edge service is online and pushing detections.
  // This is independent of the Supabase data layer below; it only powers
  // the "AI Online / AI Offline" badge on the Live Camera Feed card.
  const [aiStatus, setAiStatus] = useState('offline');
  const [liveAiCount, setLiveAiCount] = useState(0);
  const [serverOnline, setServerOnline] = useState(true);
  const fetchAiStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerOnline(true);
        setAiStatus(data.aiStatus || 'offline');
        setLiveAiCount(data.studentsTracked || 0);
      } else {
        setServerOnline(false);
        setAiStatus('offline');
      }
    } catch {
      // Express bridge not running — AI is offline as far as the UI is concerned.
      setServerOnline(false);
      setAiStatus('offline');
    }
  }, []);
  useEffect(() => {
    fetchAiStatus();
    const interval = setInterval(fetchAiStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchAiStatus]);

  // Data hooks. Year filter only matters for student/section enumeration;
  // attendance is filtered to year client-side via student.year_num.
  const hookYear = selectedYear || undefined;
  const { students: dbStudents, loading: studentsLoading } = useStudents({ year: hookYear });
  const { classSections, loading: sectionsLoading } = useClassSections({ year: hookYear });
  const { records: weekRecords, loading: attendanceLoading, refresh: refreshAttendance } = useAttendance({ fromDate: weekAgo, toDate: today });
  // Today's emotion-engine summary — powers the compact engagement card below
  // (green >70%, yellow 40-70%, red <40% class attentive average).
  const { summaries: engagementSummaries, loading: engagementLoading } = useEngagement(today);
  const engagementStats = computeEngagementStats(engagementSummaries);
  const engagementTone = engagementStats.attentiveAvg == null ? ''
    : engagementStats.attentiveAvg > 70 ? 'g'
    : engagementStats.attentiveAvg >= 40 ? 'y'
    : 'r';
  // Notifications for the panel at the bottom — same rows the topbar bell reads
  // (RLS already scopes them to the signed-in user). Loads independently, so it
  // never blocks the page skeleton below.
  const { notifications, unreadCount, loading: notifLoading } = useNotifications();

  // Upcoming school events (school_events table): today through the next 30
  // days, trimmed to the next few for the compact card beside Recent Activity.
  // Loads independently, like the notifications above.
  const eventsToDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return isoDate(d);
  }, []);
  const { events: schoolEvents, loading: eventsLoading } = useSchoolEvents({ fromDate: today, toDate: eventsToDate });
  const upcomingEvents = useMemo(() => schoolEvents.slice(0, 5), [schoolEvents]);

  // Realtime: when any attendance_records row changes (AI camera insert, manual
  // mark, edit, delete), pull a fresh copy through the hook so the dashboard
  // updates without waiting for a poll. This is data-layer only; the AI
  // online/offline badge above keeps its own /api/health polling.
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        () => {
          if (refreshAttendance) refreshAttendance();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAttendance]);

  const loading = studentsLoading || sectionsLoading || attendanceLoading;

  // Year-scoped attendance: when a year is selected, drop records whose
  // joined student is in a different year.
  const yearRecords = useMemo(() => {
    if (!selectedYear) return weekRecords;
    return weekRecords.filter(r => r.student?.year_num === selectedYear);
  }, [weekRecords, selectedYear]);

  // ---------- View scope (My Classes vs All School) -----------------------
  // Admins always see all-school data; teachers (the only other role) default
  // to their homeroom(s) and can opt in to all-school via a toggle.
  const { session, profile, user } = useAuth();
  const role = profile?.role;
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';

  // null == "no client-side filter" (admin / non-teacher).
  // [] (empty array) == teacher with no homeroom assignment.
  const myClassSectionIds = useMemo(() => {
    if (!isTeacher || !profile?.id) return null;
    return classSections
      .filter(s => s.homeroom_teacher_id === profile.id)
      .map(s => s.id);
  }, [classSections, isTeacher, profile?.id]);

  const hasHomeroom = Array.isArray(myClassSectionIds) && myClassSectionIds.length > 0;

  // Shared view scope from the layout (ScopeContext): the "My Classes" vs
  // "All School" choice now survives navigation between pages. Safe fallback
  // mirrors the year context pattern above; falls back to all-school.
  const scopeCtx = useContext(ScopeContext) || {};
  const viewScope = scopeCtx.scope || 'all';
  const setViewScope = useMemo(() => scopeCtx.setScope || (() => {}), [scopeCtx.setScope]);

  // If the teacher loads in before classSections resolve, snap to "all" once
  // we discover they have no homeroom (and keep them there).
  useEffect(() => {
    if (isTeacher && myClassSectionIds && myClassSectionIds.length === 0) {
      setViewScope('all');
    }
  }, [isTeacher, myClassSectionIds, setViewScope]);

  // Whether we should actually narrow the client-side data right now.
  const scopeToMine = viewScope === 'mine' && hasHomeroom;
  const myClasses = useMemo(() => {
    if (!profile?.id) return [];
    return classSections.filter(s => s.homeroom_teacher_id === profile.id);
  }, [classSections, profile?.id]);
  const assignedClassLabel = myClasses.map(c => `Year ${c.year_num} ${c.name}`).join(', ');

  // Class sections narrowed to the teacher's homerooms while "My Classes" is
  // active; pass-through otherwise. Drives the class-breakdown panel AND the
  // Today's Attendance class filter, so the dropdown never offers classes
  // outside the current view scope.
  const scopedSections = useMemo(() => (
    scopeToMine
      ? classSections.filter(s => myClassSectionIds.includes(s.id))
      : classSections
  ), [classSections, myClassSectionIds, scopeToMine]);

  // Scoped students + records. When not scoping, these are pass-throughs.
  const scopedStudents = useMemo(() => {
    if (!scopeToMine) return dbStudents;
    const allow = new Set(myClassSectionIds);
    return dbStudents.filter(s => allow.has(s.class_section_id));
  }, [dbStudents, myClassSectionIds, scopeToMine]);

  const scopedRecords = useMemo(() => {
    if (!scopeToMine) return yearRecords;
    const allow = new Set(myClassSectionIds);
    return yearRecords.filter(r => allow.has(r.student?.class_section_id));
  }, [yearRecords, myClassSectionIds, scopeToMine]);

  // Today's records only.
  const todayRecords = useMemo(
    () => scopedRecords.filter(r => r.date === today),
    [scopedRecords, today]
  );

  // Today's counts straight off the records.
  const present = useMemo(() => todayRecords.filter(r => r.status === 'present').length, [todayRecords]);
  const absent = useMemo(() => todayRecords.filter(r => r.status === 'absent').length, [todayRecords]);
  const late = useMemo(() => todayRecords.filter(r => r.status === 'late').length, [todayRecords]);

  // Total students for the selected year / scope.
  const totalStudents = scopedStudents.length;
  const attendanceRate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;

  // Active teachers count for admin executive KPI
  const { profiles: teacherProfiles } = useProfiles({ role: 'teacher' });
  const activeTeacherCount = teacherProfiles?.length || 15;

  // Biometric enrolment status & coverage rate
  const { enrolledNames, enrolled: enrolledList } = useEnrolledFaces();
  const enrolledStudentsCount = useMemo(() => {
    if (!scopedStudents || scopedStudents.length === 0) return enrolledList?.length || 0;
    return scopedStudents.filter(s => enrolledNames.has((s.full_name || '').toLowerCase().trim())).length;
  }, [scopedStudents, enrolledNames, enrolledList]);

  const unenrolledCount = Math.max(0, (scopedStudents?.length || 0) - enrolledStudentsCount);
  const biometricCoverageRate = scopedStudents?.length > 0
    ? Math.round((enrolledStudentsCount / scopedStudents.length) * 100)
    : 0;

  // Biometric parental consent tracking
  const [pendingConsentCount, setPendingConsentCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    supabase
      .from('biometric_consents')
      .select('student_id, granted, revoked_at')
      .is('revoked_at', null)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const grantedSet = new Set((data || []).filter(r => r.granted).map(r => r.student_id));
        const pending = (scopedStudents || []).filter(s => !grantedSet.has(s.id)).length;
        setPendingConsentCount(pending);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin, scopedStudents]);

  // Restart AI engine handler for admin
  const [restartingAi, setRestartingAi] = useState(false);
  const handleRestartAi = async () => {
    if (restartingAi) return;
    setRestartingAi(true);
    try {
      const token = session?.access_token;
      const res = await fetch('/api/ai/restart', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        toast('AI Edge recognition service restarted', 'success');
        fetchAiStatus();
      } else {
        toast('Could not restart AI engine', 'error');
      }
    } catch {
      toast('Network error connecting to bridge server', 'error');
    } finally {
      setRestartingAi(false);
    }
  };

  // Class-by-class stats — single attendance pass, grouped client-side by class_section_id.
  const filteredClassAttendance = useMemo(() => {
    const byClass = new Map();
    for (const r of todayRecords) {
      const id = r.student?.class_section_id;
      if (!id) continue;
      if (!byClass.has(id)) byClass.set(id, { present: 0, absent: 0, late: 0 });
      const bucket = byClass.get(id);
      if (r.status === 'present') bucket.present += 1;
      else if (r.status === 'absent') bucket.absent += 1;
      else if (r.status === 'late') bucket.late += 1;
    }
    // Total students per section, scoped to current year + view scope.
    const totalsBySection = new Map();
    for (const s of scopedStudents) {
      const id = s.class_section_id;
      if (!id) continue;
      totalsBySection.set(id, (totalsBySection.get(id) || 0) + 1);
    }
    // Rendered sections follow the current view scope (teacher's homerooms
    // while "My Classes" is active).
    return scopedSections.map(section => {
      const counts = byClass.get(section.id) || { present: 0, absent: 0, late: 0 };
      const totalForSection = totalsBySection.get(section.id) || (counts.present + counts.absent + counts.late);
      return {
        id: section.id,
        class: section.name,
        year: section.year_num,
        present: counts.present,
        absent: counts.absent,
        late: counts.late,
        total: totalForSection,
      };
    });
  }, [todayRecords, scopedStudents, scopedSections]);

  // Weekly chart data: last 7 days, present/absent/late counts per day.
  const weeklyAttendance = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = isoDate(d);
      const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
      days.push({ iso, day: label, present: 0, absent: 0, late: 0 });
    }
    const byIso = new Map(days.map(d => [d.iso, d]));
    for (const r of scopedRecords) {
      const bucket = byIso.get(r.date);
      if (!bucket) continue;
      if (r.status === 'present') bucket.present += 1;
      else if (r.status === 'absent') bucket.absent += 1;
      else if (r.status === 'late') bucket.late += 1;
    }
    return days;
  }, [scopedRecords]);

  // Arrival time distribution for today (half-hour buckets, sorted by time).
  const dailyArrivalTimes = useMemo(() => {
    const buckets = new Map();
    for (const r of todayRecords) {
      const key = bucketArrival(r.arrival_time);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => ({ time, count }));
  }, [todayRecords]);

  // Recent activity: today's records replayed newest-first. Rows with no human
  // marker are AI camera check-ins (the edge service writes marked_by = null);
  // everything else was marked manually — we don't join the marker's profile,
  // so those lines are phrased without an actor.
  const recentActivity = useMemo(() => {
    return todayRecords.map(r => {
      const name = r.student?.full_name || 'Unknown student';
      const cls = r.student?.class_section?.name || '';
      const where = r.student?.year_num
        ? ` (Year ${r.student.year_num}${cls ? ` ${cls}` : ''})`
        : (cls ? ` (${cls})` : '');
      const time = (r.arrival_time || '').slice(0, 5) || (r.marked_at ? new Date(r.marked_at).toTimeString().slice(0, 5) : '');
      const isAI = !r.marked_by;
      return {
        id: r.id || r.student_id,
        user: isAI ? 'System' : null,
        action: isAI
          ? `${name}${where} checked in via face recognition`
          : `Marked ${name}${where} as ${r.status}`,
        time,
        type: r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'danger',
      };
    })
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 12);
  }, [todayRecords]);

  // Flatten today's records into the legacy row shape so the table renders unchanged.
  // `record` keeps the raw Supabase row so the per-row Edit modal can update by id.
  // Time Out reads time_out (added by migration 0005_app_settings_and_checkout.sql).
  const todayRows = useMemo(() => todayRecords.map(r => ({
    studentId: r.student_id,
    name: r.student?.full_name || '',
    class: r.student?.class_section?.name || '',
    year: r.student?.year_num,
    status: r.status,
    // HH:MM (24h) everywhere — Postgres returns time columns as HH:MM:SS.
    timeIn: (r.arrival_time || '').slice(0, 5),
    timeOut: (r.time_out || '').slice(0, 5),
    record: r,
  })), [todayRecords]);

  // Export School Report (MOE format CSV) for Administrator
  const handleExportSchoolReport = () => {
    if (todayRows.length === 0) {
      toast('No attendance records available for today', 'info');
      return;
    }
    const csvRows = todayRows.map(r => ({
      'Date': today,
      'Student Name': r.name,
      'Class': r.class || 'N/A',
      'Year': r.year != null ? `Year ${r.year}` : 'N/A',
      'Status': (r.status || 'absent').toUpperCase(),
      'Arrival Time': r.timeIn || '—',
      'Departure Time': r.timeOut || '—',
    }));
    const csv = Papa.unparse(csvRows);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PRISM-AI_MOE_Attendance_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Exported MOE School Attendance report (${todayRows.length} records)`, 'success');
  };

  // School Watchlist (top at-risk students flagged by emotion or attendance)
  const watchlist = useMemo(() => {
    const fromEngagement = (engagementSummaries || [])
      .filter(s => s.atRisk || (typeof s.disengagedPct === 'number' && s.disengagedPct >= 40) || (typeof s.attentivePct === 'number' && s.attentivePct < 60))
      .map(s => ({
        id: String(s.id),
        name: s.name,
        className: s.className,
        score: s.disengagedPct != null ? `${s.disengagedPct}% disengaged` : 'At Risk',
        band: (s.atRisk || (s.disengagedPct != null && s.disengagedPct >= 50)) ? 'high' : 'watch',
      }));

    if (fromEngagement.length > 0) return fromEngagement.slice(0, 5);

    return todayRows
      .filter(r => r.status === 'absent' || r.status === 'late')
      .slice(0, 5)
      .map(r => ({
        id: String(r.studentId || r.name),
        name: r.name,
        className: r.class,
        score: r.status === 'absent' ? 'Absent Today' : `Late (${r.timeIn || '—'})`,
        band: r.status === 'absent' ? 'high' : 'watch',
      }));
  }, [engagementSummaries, todayRows]);

  // Class filter options come from the real class_sections table (P7),
  // narrowed to the current view scope (see scopedSections) and deduped by
  // name — the same names the table's class chips and classColors use.
  const classFilterOptions = useMemo(() => {
    const seen = new Set();
    const names = [];
    for (const s of scopedSections) {
      if (!s.name || seen.has(s.name)) continue;
      seen.add(s.name);
      names.push(s.name);
    }
    return names;
  }, [scopedSections]);

  const filtered = todayRows.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === 'all' || a.class === filterClass;
    return matchSearch && matchClass;
  }).sort((a, b) => {
    if (!sortCol) return 0;
    const av = a[sortCol] || '';
    const bv = b[sortCol] || '';
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, filterClass]);

  // If the active class filter falls outside the visible options (scope
  // switched to "mine" and the class isn't one of the teacher's homerooms),
  // fall back to All Classes so the select never holds a phantom value.
  useEffect(() => {
    if (filterClass !== 'all' && !classFilterOptions.includes(filterClass)) {
      setFilterClass('all');
    }
  }, [classFilterOptions, filterClass]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const teacherStatCards = [
    { label: 'Total Students', value: totalStudents, tone: 's-blue',   change: `${totalStudents} enrolled` },
    { label: 'Present',        value: present,       tone: 's-green',  change: `${attendanceRate}% attendance` },
    { label: 'Absent',         value: absent,        tone: 's-red',    change: `${absent} students away` },
    { label: 'Late',           value: late,          tone: 's-orange', change: `${late} arrived late` },
  ];

  const adminStatCards = [
    {
      label: 'Overall School Attendance',
      value: `${attendanceRate}%`,
      tone: attendanceRate >= 90 ? 's-green' : attendanceRate >= 75 ? 's-orange' : 's-red',
      change: `${present} present / ${totalStudents} students today`,
    },
    {
      label: 'Total Enrolled Students',
      value: totalStudents,
      tone: 's-blue',
      change: `${classSections?.length || 0} classes across all grades`,
    },
    {
      label: 'Active Teaching Staff',
      value: activeTeacherCount,
      tone: 's-yellow',
      change: 'Assigned homeroom teachers',
    },
    {
      label: 'Biometric Coverage',
      value: `${biometricCoverageRate}%`,
      tone: biometricCoverageRate >= 80 ? 's-green' : 's-orange',
      change: `${enrolledStudentsCount}/${totalStudents} enrolled (${unenrolledCount} pending)`,
    },
  ];

  const statCards = isAdmin ? adminStatCards : teacherStatCards;

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <div>
            <h1><span className="word k">Dashboard</span></h1>
            <p className="page-subtitle">Loading...</p>
          </div>
        </div>
        <div className="grid-4 section-gap">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
        <div className="dashboard-grid section-gap"><SkeletonChart /><SkeletonChart /></div>
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  const noAttendanceToday = todayRecords.length === 0;

  // ---------- Bulk: Mark All Present (P1) ---------------------------------
  // Marks the FULL roster in the current view scope (not just students who
  // already have a record today — the whole point on a quiet morning) plus
  // the class filter; the search box is a table-local nicety and does not
  // narrow the bulk write. Same row shape as hooks/useMarkAttendance.js;
  // RLS naturally limits teachers to their own classes' records.
  const handleMarkAllPresent = async () => {
    if (bulkBusy) return;
    const roster = scopedStudents.filter(
      s => filterClass === 'all' || s.class_section?.name === filterClass
    );
    if (roster.length === 0) {
      toast('No students in this view yet — nothing to mark', 'info');
      return;
    }
    const scopeLabel = filterClass === 'all'
      ? 'all students in this view'
      : `all students in ${filterClass}`;
    const confirmed = window.confirm(
      `Mark ${scopeLabel} present for today (${roster.length} student${roster.length === 1 ? '' : 's'})? This overwrites any existing status.`
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setBulkProgress({ done: 0, total: roster.length });

    // Keep any existing arrival time (e.g. an earlier AI check-in) when the
    // record already exists; new rows start with no arrival time.
    const arrivalByStudent = new Map(
      todayRecords.map(r => [r.student_id, r.arrival_time ?? null])
    );

    // Intentional: everyone is stamped 'present' regardless of arrival time —
    // that is the button's contract. Late status is only derived on the AI
    // camera path (checked against app_settings.late_cutoff); per-row fixes
    // go through the Edit modal instead.
    const rows = roster.map(s => ({
      student_id: s.id,
      date: today,
      status: 'present',
      arrival_time: arrivalByStudent.get(s.id) ?? null, // keep any AI check-in time
      notes: 'Marked all present (bulk)',
      marked_by: user ? user.id : null,
      marked_at: new Date().toISOString(),
    }));

    // Chunked upsert so one oversized payload can't fail the whole batch.
    // savedIds tracks exactly which students were persisted, so notifications
    // below only go out for real successes.
    const CHUNK = 50;
    const savedIds = [];
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error: upsertError } = await supabase
        .from('attendance_records')
        .upsert(chunk, { onConflict: 'student_id,date' });
      if (upsertError) {
        failed += chunk.length;
        console.error('Mark All Present: chunk failed', upsertError);
      } else {
        ok += chunk.length;
        chunk.forEach(r => savedIds.push(r.student_id));
      }
      setBulkProgress({ done: Math.min(i + CHUNK, rows.length), total: rows.length });
    }

    // One audit row for the whole action (audit_logs INSERT is open to any
    // authenticated user, so this never blocks the UI on RLS).
    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_id: user ? user.id : null,
      action: 'attendance.bulk_present',
      metadata: { count: ok, classFilter: filterClass },
    });
    if (auditError) console.warn('Mark All Present: audit log insert failed:', auditError.message);

    // Fire-and-forget notification fanout: one row per recipient per saved
    // student (homeroom teacher + every linked parent). Single batched pass —
    // one parent_students lookup for the whole roster, then one insert —
    // mirroring the per-recipient pattern in useMarkAttendance. Failures are
    // logged, never surfaced to the caller. homeroom_teacher_id rides in on
    // useStudents' class_section embed.
    if (savedIds.length > 0) {
      (async () => {
        try {
          const { data: links, error: linkError } = await supabase
            .from('parent_students')
            .select('student_id, parent_id')
            .in('student_id', savedIds);
          if (linkError) throw linkError;

          const parentsByStudent = new Map();
          (links || []).forEach((l) => {
            if (!l.parent_id) return;
            if (!parentsByStudent.has(l.student_id)) parentsByStudent.set(l.student_id, []);
            parentsByStudent.get(l.student_id).push(l.parent_id);
          });

          const actorName = profile?.full_name || user?.email || 'Staff';
          const rosterById = new Map(roster.map(s => [s.id, s]));
          const notifRows = [];
          for (const sid of savedIds) {
            const s = rosterById.get(sid);
            if (!s) continue;
            const recipients = new Set();
            if (s.class_section?.homeroom_teacher_id) recipients.add(s.class_section.homeroom_teacher_id);
            (parentsByStudent.get(sid) || []).forEach((pid) => recipients.add(pid));
            recipients.forEach((rid) => notifRows.push({
              recipient_id: rid,
              scope: 'user',
              type: 'attendance',
              title: `${s.full_name} marked present`,
              body: `Marked all present (bulk) by ${actorName} on ${today}.`,
            }));
          }
          if (notifRows.length === 0) return;
          const { error: nErr } = await supabase.from('notifications').insert(notifRows);
          if (nErr) console.warn('[Mark All Present notification fanout] insert failed:', nErr.message);
        } catch (e) {
          console.warn('[Mark All Present notification fanout] failed:', e);
        }
      })();
    }

    setBulkBusy(false);
    setBulkProgress({ done: 0, total: 0 });

    if (failed === 0) {
      toast(`Marked ${ok} student${ok === 1 ? '' : 's'} present`, 'success');
    } else if (ok > 0) {
      toast(`Marked ${ok} present, but ${failed} could not be saved — please try again`, 'warning');
    } else {
      toast('Could not mark anyone present — please try again', 'error');
    }
    if (ok > 0 && refreshAttendance) refreshAttendance();
  };

  // ---------- Per-row Edit (P1) --------------------------------------------
  const openEditModal = (record) => {
    setEditRecord(record);
    setEditStatus(record.status);
    // time inputs want HH:MM; Postgres returns HH:MM:SS.
    setEditTimeOut((record.time_out || '').slice(0, 5));
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setEditRecord(null);
    setEditStatus('present');
    setEditTimeOut('');
  };

  const handleSaveEdit = async () => {
    if (!editRecord || editSaving) return;
    setEditSaving(true);
    const prevStatus = editRecord.status;
    const payload = {
      status: editStatus,
      marked_by: user ? user.id : null,
      marked_at: new Date().toISOString(),
    };
    // Departure is optional: only write time_out when a value was provided,
    // so editing just the status never disturbs an existing checkout.
    if (editTimeOut) payload.time_out = editTimeOut;

    const { error: updateError } = await supabase
      .from('attendance_records')
      .update(payload)
      .eq('id', editRecord.id);

    setEditSaving(false);
    if (updateError) {
      console.error('Edit attendance: update failed', updateError);
      toast('Could not save that change — please try again', 'error');
      return;
    }

    // Audit trail row for this edit (same shape as the bulk action's audit
    // above; audit_logs INSERT is open to any authenticated user).
    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_id: user ? user.id : null,
      action: 'attendance.edit',
      metadata: {
        student: editRecord.student?.full_name || 'Unknown student',
        status: editStatus,
        time_out: editTimeOut || null,
      },
    });
    if (auditError) console.warn('Edit attendance: audit log insert failed:', auditError.message);

    // Notify the student's homeroom teacher + linked parents only when the
    // status actually changed — a checkout-time-only edit is not fanout-worthy.
    // Same fire-and-forget fanout pattern as useMarkAttendance.
    if (editStatus !== prevStatus) {
      (async () => {
        try {
          const { data: ctx } = await supabase
            .from('students')
            .select('full_name, class_section:class_sections(homeroom_teacher_id), parent_links:parent_students(parent_id)')
            .eq('id', editRecord.student_id)
            .maybeSingle();
          if (!ctx) return;

          const recipients = new Set();
          if (ctx.class_section?.homeroom_teacher_id) {
            recipients.add(ctx.class_section.homeroom_teacher_id);
          }
          (ctx.parent_links || []).forEach((l) => {
            if (l.parent_id) recipients.add(l.parent_id);
          });
          if (recipients.size === 0) return;

          const notifRows = Array.from(recipients).map((rid) => ({
            recipient_id: rid,
            scope: 'user',
            type: 'attendance',
            title: `${ctx.full_name} attendance updated`,
            body: `Status changed from ${prevStatus} to ${editStatus} on ${editRecord.date}.`,
          }));
          const { error: nErr } = await supabase.from('notifications').insert(notifRows);
          if (nErr) console.warn('[Edit attendance notification fanout] insert failed:', nErr.message);
        } catch (e) {
          console.warn('[Edit attendance notification fanout] failed:', e);
        }
      })();
    }

    toast('Attendance updated', 'success');
    setEditRecord(null);
    setEditStatus('present');
    setEditTimeOut('');
    if (refreshAttendance) refreshAttendance();
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1><span className="word k">{isAdmin ? 'School Overview' : 'Dashboard'}</span>{selectedYear ? <span className="year-badge">Year {selectedYear}</span> : <span className="year-badge year-badge-all">All Years</span>}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? `Executive Management Console • ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
              : (isTeacher && hasHomeroom
                ? `Assigned Class: ${assignedClassLabel}`
                : (isTeacher ? 'No class assigned yet — please contact admin' : new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))}
          </p>
          {isTeacher && hasHomeroom && (
            <div className="scope-toggle" role="region" aria-label="Assigned Class">
              <span className="tape tl" />
              <span className="scope-pill is-active" style={{ cursor: 'default' }}>
                {myClasses.length > 1 ? `Classes (${myClasses.length}): ${assignedClassLabel}` : `Class: ${assignedClassLabel}`}
              </span>
            </div>
          )}
          {isTeacher && !hasHomeroom && (
            <p className="scope-note">You are not assigned to any class in the database. Please contact an administrator.</p>
          )}
        </div>
        <div className="page-header-actions">
          {isAdmin ? (
            <>
              <button className="btn btn-outline" onClick={handleExportSchoolReport}>
                <Download size={16} /> Export MOE Report
              </button>
              <button className="btn btn-yellow" onClick={() => navigate('/dashboard/admin?tab=faces')}>
                <ScanFace size={16} /> Quick Face Enroll
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/admin?tab=settings')}>
                <Settings size={16} /> System Controls
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={handleMarkAllPresent} disabled={bulkBusy}>
                <UserCheck size={16} /> {bulkBusy ? `Marking ${bulkProgress.done}/${bulkProgress.total}...` : 'Mark All Present'}
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/attendance')}><UserCheck size={16} /> Manual Attendance</button>
            </>
          )}
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid-4 section-gap">
        {statCards.map((s, i) => (
          <div key={i} className={`stat-card ${s.tone} reveal reveal-${i + 1}`}>
            <span className={`tape ${i % 2 === 0 ? 'tl' : 'tr'}`} />
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
              <small className="stat-change">{s.change}</small>
            </div>
          </div>
        ))}
      </div>

      {noAttendanceToday && (
        <div className="card section-gap dashboard-empty-today">
          <span className="tape tl" />
          <p>No attendance recorded yet today</p>
        </div>
      )}

      {/* CAMERA / INFRASTRUCTURE + CLASS BREAKDOWN */}
      <div className="dashboard-grid section-gap">
        {isAdmin ? (
          <div className="card tilt-l admin-system-card">
            <span className="tape tr" />
            <div className="card-header">
              <div>
                <h2>AI & System Infrastructure</h2>
                <p className="card-subtitle-small">Classroom camera pipeline & biometric engine</p>
              </div>
              <span className={`live-badge ${aiStatus === 'online' ? '' : 'live-badge-off'}`}>
                <span className="live-dot" /> {aiStatus === 'online' ? 'Camera Online (30 FPS)' : 'AI Standby'}
              </span>
            </div>

            <div className="admin-infra-grid">
              <div className="infra-node">
                <div className="infra-icon-wrap"><Server size={20} className="node-icon server-icon" /></div>
                <div className="infra-info">
                  <span className="infra-label">Express Bridge</span>
                  <strong className="infra-val mono">{serverOnline ? 'Port 3001 • Online' : 'Offline'}</strong>
                </div>
              </div>

              <div className="infra-node">
                <div className="infra-icon-wrap"><Cpu size={20} className="node-icon gpu-icon" /></div>
                <div className="infra-info">
                  <span className="infra-label">AI Engine</span>
                  <strong className="infra-val mono">{aiStatus === 'online' ? 'DirectML GPU Active' : 'GPU Standby'}</strong>
                </div>
              </div>

              <div className="infra-node">
                <div className="infra-icon-wrap"><ScanFace size={20} className="node-icon face-icon" /></div>
                <div className="infra-info">
                  <span className="infra-label">Face Database</span>
                  <strong className="infra-val mono">{enrolledStudentsCount} Indexed Faces</strong>
                </div>
              </div>

              <div className="infra-node">
                <div className="infra-icon-wrap"><Activity size={20} className="node-icon speed-icon" /></div>
                <div className="infra-info">
                  <span className="infra-label">Realtime Speed</span>
                  <strong className="infra-val mono">{aiStatus === 'online' ? '30 FPS • ~33ms' : 'Idle'}</strong>
                </div>
              </div>
            </div>

            {(unenrolledCount > 0 || pendingConsentCount > 0) && (
              <div className="admin-enroll-alert">
                <div className="alert-content">
                  <AlertTriangle size={18} className="alert-icon" />
                  <span>
                    <strong>{unenrolledCount} student{unenrolledCount === 1 ? '' : 's'}</strong> need face registration
                    {pendingConsentCount > 0 ? ` (${pendingConsentCount} pending parental consent)` : ''}.
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-yellow"
                  onClick={() => navigate('/dashboard/admin?tab=faces')}
                >
                  Enroll Faces
                </button>
              </div>
            )}

            <div className="admin-infra-footer">
              <button
                className="btn btn-outline btn-sm"
                onClick={handleRestartAi}
                disabled={restartingAi}
              >
                <Power size={14} /> {restartingAi ? 'Restarting AI...' : 'Restart AI Engine'}
              </button>
              <Link to="/dashboard/admin?tab=ai" className="infra-diag-link">
                View Full Diagnostics &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="card tilt-l">
            <span className="tape tr" />
            <div className="card-header">
              <h2>Take Attendance (Camera)</h2>
              <span className={`live-badge ${aiStatus === 'online' ? '' : 'live-badge-off'}`}><span className="live-dot" /> {aiStatus === 'online' ? 'AI Online' : 'AI Offline'}</span>
            </div>
            <div className="camera-feed">
              <Camera size={56} />
              <p>{aiStatus === 'online' ? 'AI Face Recognition is actively detecting students' : 'Start face_recognition.py to begin detection'}</p>
              <small>{aiStatus === 'online' ? `Sending data every 10 seconds — ${liveAiCount} student(s) detected` : 'Waiting for AI connection...'}</small>
            </div>
          </div>
        )}

        <div className="card tilt-r">
          <span className="tape tl" />
          <div className="card-header">
            <h2>Attendance by Class</h2>
            {isAdmin && (
              <Link to="/dashboard/comparison" className="class-compare-link">
                Compare Classes &rarr;
              </Link>
            )}
          </div>
          <div className="class-breakdown">
            {filteredClassAttendance.length === 0 ? (
              <div className="empty-state">No classes to display.</div>
            ) : filteredClassAttendance.map((c, i) => {
              const rate = c.total > 0 ? Math.round((c.present / c.total) * 100) : 0;
              const linkYear = selectedYear || c.year || 1;
              return (
                <div key={c.id || i} className={`class-card class-card-${i % 4}`} style={{ '--cc': classColors[c.class] }}>
                  <div className="class-card-header">
                    <Link to={`/dashboard/class/${linkYear}/${c.class}`} className="class-link" style={{ color: classColors[c.class] }}>
                      <strong>{!selectedYear && c.year ? `Y${c.year} ` : ''}{c.class}</strong>
                    </Link>
                    <span className="class-rate mono">{rate}%</span>
                  </div>
                  <div className="class-counts">
                    <span className="cc-present">{c.present} present</span>
                    <span className="cc-absent">{c.absent} absent</span>
                    <span className="cc-late">{c.late} late</span>
                  </div>
                  <div className="class-progress">
                    <div className="class-progress-fill" style={{ width: `${rate}%`, background: classColors[c.class] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ENGAGEMENT OVERVIEW — today's emotion-engine summary */}
        <div className="card tilt-l">
          <span className="tape tr" />
          <div className="card-header">
            <h2>Class Engagement</h2>
            <Activity size={18} aria-hidden="true" />
          </div>
          {engagementLoading ? (
            <p className="eng-overview-empty">Loading engagement…</p>
          ) : engagementStats.attentiveAvg == null ? (
            <p className="eng-overview-empty">No engagement data yet today.</p>
          ) : (
            <div className="eng-overview">
              <span className={`eng-overview-number mono tone-${engagementTone}`}>{engagementStats.attentiveAvg}%</span>
              <span className="eng-overview-label">% Attentive</span>
              <div className="eng-bar">
                <div className={`eng-bar-fill tone-${engagementTone}`} style={{ width: `${engagementStats.attentiveAvg}%` }} />
              </div>
              <div className="eng-overview-foot">
                {engagementStats.atRiskCount > 0 && (
                  <span className="badge badge-absent">{engagementStats.atRiskCount} at risk</span>
                )}
                <Link to="/dashboard/engagement" className="eng-overview-link">View details</Link>
              </div>
            </div>
          )}
        </div>

        {/* SCHOOL WATCHLIST — at risk student overview */}
        <div className="card tilt-r">
          <span className="tape bl" />
          <div className="card-header">
            <h2>School Watchlist</h2>
            <AlertTriangle size={18} aria-hidden="true" />
          </div>
          {watchlist.length === 0 ? (
            <p className="eng-overview-empty">No students currently flagged at risk.</p>
          ) : (
            <div className="watchlist">
              {watchlist.map((w) => (
                <Link key={w.id} to={`/dashboard/students/${w.id}`} className="watchlist-row">
                  <span className="watchlist-name">{w.name}</span>
                  {w.className && <span className="watchlist-class mono">{w.className}</span>}
                  {w.score != null && <span className="watchlist-score mono">{w.score}</span>}
                  <span className={`badge ${w.band === 'high' ? 'badge-absent' : 'badge-yellow'}`}>
                    {w.band === 'high' ? 'High' : 'Watch'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CHARTS */}
      <div className="dashboard-grid section-gap">
        <div className="card tilt-r">
          <span className="tape bl" />
          <div className="card-header"><h2>Arrival Time Distribution</h2></div>
          {dailyArrivalTimes.length === 0 ? (
            <div className="empty-state">No arrival data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyArrivalTimes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F1A12" strokeOpacity={0.18} />
                <XAxis dataKey="time" fontSize={11} stroke="#1F1A12" />
                <YAxis fontSize={11} stroke="#1F1A12" />
                <Tooltip />
                <Bar dataKey="count" fill="#EA8534" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card tilt-l">
          <span className="tape br" />
          <div className="card-header"><h2>Weekly Trend</h2></div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1A12" strokeOpacity={0.18} />
              <XAxis dataKey="day" fontSize={11} stroke="#1F1A12" />
              <YAxis fontSize={11} stroke="#1F1A12" />
              <Tooltip />
              <Line type="monotone" dataKey="present" stroke="#4FA764" strokeWidth={3} dot={{ fill: '#4FA764', r: 5 }} />
              <Line type="monotone" dataKey="absent"  stroke="#E04A3F" strokeWidth={3} dot={{ fill: '#E04A3F', r: 5 }} />
              <Line type="monotone" dataKey="late"    stroke="#EA8534" strokeWidth={3} dot={{ fill: '#EA8534', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ATTENDANCE TABLE */}
      <div className="card section-gap dashboard-table-card">
        <span className="tape tl" />
        <div className="card-header">
          <h2>Today's Attendance</h2>
          <div className="filter-row">
            <select
              className="search-input filter-select"
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {classFilterOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                className="search-input search-input-with-icon"
                placeholder="Search student..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>Student <SortIcon col="name" /></th>
              <th className="sortable" onClick={() => handleSort('class')}>Class <SortIcon col="class" /></th>
              <th className="sortable" onClick={() => handleSort('status')}>Status <SortIcon col="status" /></th>
              <th className="sortable" onClick={() => handleSort('timeIn')}>Time In <SortIcon col="timeIn" /></th>
              <th>Time Out</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No students match your search or filter.</td></tr>
            ) : paged.map((a, idx) => {
              const colors = ['r', 'y', 'g', 'o', 'k'];
              const c = colors[idx % colors.length];
              return (
                <tr key={a.studentId}>
                  <td>
                    <div className="student-cell">
                      <div className={`avatar ${c}`}>{a.name.split(' ').map(n => n[0]).join('')}</div>
                      {a.name}
                    </div>
                  </td>
                  <td><Link to={`/dashboard/class/${selectedYear || a.year || 1}/${a.class}`} className="class-link"><span className="class-chip mono" style={{ borderColor: classColors[a.class], color: classColors[a.class] }}>{a.class}</span></Link></td>
                  <td><span className={`badge badge-${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span></td>
                  <td className="mono">{a.timeIn}</td>
                  <td className="mono">{a.timeOut || '—'}</td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => openEditModal(a.record)}>Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-footer mono">
          <span>Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} students</span>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* ACTIVITY + NOTIFICATIONS + SCHOOL EVENTS */}
      <div className="dashboard-grid">
        <div className="card tilt-l">
          <span className="tape tr" />
          <div className="card-header">
            <h2><Activity size={20} /> Recent Activity</h2>
          </div>
          <div className="activity-timeline">
            {recentActivity.length === 0 ? (
              <div className="empty-state">No activity yet today.</div>
            ) : recentActivity.map(a => (
              <div key={a.id} className="timeline-item">
                <div className={`timeline-dot dot-${a.type}`} />
                <div className="timeline-content">
                  <p>{a.user ? <><strong>{a.user}</strong> &mdash; </> : null}{a.action}</p>
                  <small className="mono">{a.time ? a.time.slice(0, 5) : '—'}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card tilt-r">
          <span className="tape bl" />
          <div className="card-header">
            <h2>Notifications</h2>
            {unreadCount > 0 && <span className="badge badge-absent">{unreadCount}</span>}
          </div>
          <div className="notif-list">
            {notifLoading ? (
              <div className="empty-state">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">No notifications yet.</div>
            ) : notifications.slice(0, 10).map(n => (
              <div key={n.id} className={`notif-item notif-${n.type}`}>
                <AlertTriangle size={18} />
                <div>
                  <p>{n.title && <strong>{n.title}</strong>}{n.title && n.body ? ' — ' : ''}{n.body}</p>
                  <small className="mono">{timeAgo(n.created_at)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card tilt-l">
          <span className="tape bl" />
          <div className="card-header">
            <h2><CalendarDays size={20} /> School Events</h2>
          </div>
          <div className="activity-timeline">
            {eventsLoading ? (
              <div className="empty-state">Loading events...</div>
            ) : upcomingEvents.length === 0 ? (
              <div className="empty-state">No upcoming events on the school calendar.</div>
            ) : upcomingEvents.map(ev => {
              const when = ev.event_date
                ? new Date(ev.event_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                : '';
              return (
                <div key={ev.id} className="timeline-item">
                  <div className="timeline-dot dot-info" />
                  <div className="timeline-content">
                    <p>{ev.title}</p>
                    <small className="mono">{when}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* EDIT ATTENDANCE MODAL (P1) */}
      {editRecord && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal attendance-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="attendance-edit-header">
              <h2>Edit Attendance</h2>
              <button type="button" className="attendance-edit-close" onClick={closeEditModal} disabled={editSaving} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <p className="attendance-edit-sub">
              {editRecord.student?.full_name || 'Student'}
              {editRecord.student?.class_section?.name ? ` — ${editRecord.student.class_section.name}` : ''}
            </p>
            <p className="attendance-edit-readonly mono">
              Arrival: {editRecord.arrival_time ? editRecord.arrival_time.slice(0, 5) : 'not recorded'}
            </p>
            <div className="form-group">
              <label>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} disabled={editSaving}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>
            <div className="form-group">
              <label>Departure time (optional)</label>
              <input
                type="time"
                value={editTimeOut}
                onChange={e => setEditTimeOut(e.target.value)}
                disabled={editSaving}
              />
            </div>
            <div className="attendance-edit-actions">
              <button type="button" className="btn btn-outline" onClick={closeEditModal} disabled={editSaving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
