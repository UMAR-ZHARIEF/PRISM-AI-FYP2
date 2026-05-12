# PRISM-AI Website Requirements (UI)

## Project Overview

**PRISM-AI: A Primary School Intelligent Student Management and Predictive Analytics Ecosystem**

A web-based dashboard for teachers and an automated reporting system for parents, integrated with an AI-powered face recognition attendance system, emotion analytics, and predictive intervention.

---

## Technology Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Language   | Python 3.12 (AI/ML), JavaScript (Web) |
| AI         | PyTorch (Optimized for Apple Silicon MPS) |
| Backend    | Express.js (Node.js)                |
| Database   | Supabase (PostgreSQL)               |
| Frontend   | React.js (Vite)                     |
| Runtime    | Node.js                             |

---

## UI Reference Sites

- **Illumine Digital Attendance** — https://illumine.app/digital-attendance
- **EarlyEdu AI Resources** — https://earlyedu.ai/resources-detail.html

---

## Design System

| Aspect           | Guideline                                                            |
| ---------------- | -------------------------------------------------------------------- |
| Color Scheme     | Navy blue primary (`#1E40AF`), green for present, red for absent, yellow for late |
| Typography       | Inter (sans-serif), clean and readable                               |
| Layout           | Responsive design — mobile, tablet, desktop                         |
| Icons            | Lucide React icon library                                            |
| Spacing          | Consistent padding and margins using 4px/8px grid system            |
| Accessibility    | WCAG 2.1 compliant — proper contrast, alt text, keyboard navigation |

### CSS Variables

```css
--primary: #1E40AF        /* Navy blue */
--primary-light: #3B82F6  /* Medium blue */
--primary-dark: #1E3A8A   /* Dark navy */
--secondary: #EFF6FF      /* Light blue tint */
--success: #22C55E        /* Green — present */
--danger: #EF4444         /* Red — absent */
--warning: #F59E0B        /* Amber — late */
--info: #3B82F6           /* Blue — informational */
--bg: #F8F9FC             /* Page background */
--text: #1E293B           /* Dark text */
--text-light: #64748B     /* Muted text */
--border: #E2E8F0         /* Borders */
```

---

## Pages & UI Requirements

### 1. Landing Page

| Section             | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| Hero Section        | Headline about AI-powered attendance, subtitle, and CTA button ("Get Started") |
| Feature Cards       | 3-column card layout highlighting key benefits (Automated Attendance, Real-Time Alerts, Parent Reports) |
| How It Works        | Step-by-step visual guide (Camera Capture → Face Recognition → Attendance Logged → Parent Notified) |
| FAQ Section         | Accordion-style expandable Q&A                                              |
| Footer              | Navigation links, contact info                                              |

**UI Reference:** Illumine — hero section, feature cards, FAQ accordion

---

### 2. Login Page

| Element          | Description                                       |
| ---------------- | ------------------------------------------------- |
| Login Form       | Email and password fields (no default values)     |
| Role Selection   | Teacher / Admin / Parent toggle or dropdown       |
| Forgot Password  | Link to password reset                            |
| Branding         | Logo and app name (PRISM-AI)                      |

---

### 3. Teacher Dashboard

| Section                  | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| Sidebar Navigation       | Links to Attendance, Students, Reports, Settings                         |
| Attendance Overview      | Dynamic date, total present/absent/late count with status cards          |
| Live Camera Feed         | Embedded video feed showing real-time face recognition                   |
| Student Attendance Table | Searchable, sortable table with columns: Name, Photo, Status, Time In, Time Out |
| Quick Actions            | Buttons for Manual Check-In, Mark Late, Mark Absent                      |
| Notifications Panel      | Alerts for unrecognized faces, late arrivals, absent students            |

**UI Reference:** Illumine — check-in/check-out tracking, safety compliance alerts, ratio monitoring

---

### 4. Student Management Page

| Section              | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| Student List         | Grid or table view of all enrolled students with photos              |
| Search & Filter      | Search by name, filter by class/group                                |
| Student Profile Card | Photo, name, class, parent contact, attendance summary               |
| Add/Edit Student     | Modal form to register new student or edit existing info             |
| Face Registration    | Upload or capture student face photo for AI recognition              |

---

### 5. Attendance Reports Page

| Section                | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| Date Range Picker      | Select custom date range for report                                |
| Summary Cards          | Total attendance rate, most absent students, trends                 |
| Attendance Chart       | Bar or line chart showing daily/weekly/monthly attendance trends    |
| Detailed Table         | Exportable table with per-student attendance records               |
| Export Options         | Download as PDF or CSV                                             |

---

### 6. Parent Portal

| Section                  | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| Child Overview           | Photo, name, class, today's attendance status                      |
| Attendance History       | Calendar view or list showing check-in/check-out times             |
| Notifications            | Alerts for arrival, departure, and absence                         |
| Contact Teacher          | Message or email link to teacher                                   |

---

### 7. Admin Panel

| Section              | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| User Management      | Add/edit/remove teachers and parents, assign roles                   |
| System Settings      | Configure camera settings, notification preferences, school info     |
| Audit Logs           | Activity logs for attendance modifications                           |
| AI Model Status      | Status indicator for face recognition model (active/inactive/error)  |

---

## Shared UI Components

| Component            | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| Navigation Bar       | Top bar with logo, page links, profile dropdown, notification bell   |
| Sidebar              | Collapsible sidebar for dashboard navigation                         |
| Cards                | Rounded cards with icon, title, value (for stats/metrics)            |
| Tables               | Sortable, searchable, paginated tables                               |
| Modals               | For forms (add student, edit profile, confirm actions)               |
| Alerts/Toasts        | Success, error, and info notifications                               |
| Buttons              | Primary (filled), Secondary (outlined), Danger (red) — with hover, active, and disabled states |
| Category Badges      | Colored labels for status (Present, Absent, Late)                    |

**UI Reference:** EarlyEdu — category badges, card grid layout, filtering tabs, pagination controls

---

## Phase 1 UI Polish (High Priority) — COMPLETED

| # | Issue | Scope | Status |
|---|-------|-------|--------|
| 1 | Dashboard date hardcoded | Dashboard.jsx | Done — dynamic `new Date()` formatting |
| 2 | Inconsistent color usage | All pages | Done — hex values replaced with CSS variables |
| 3 | Excessive inline styles | All pages | Done — moved to CSS classes |
| 4 | Missing button states | index.css | Done — hover, active, disabled for all variants |
| 5 | Login default credentials | Login.jsx | Done — removed `defaultValue` from inputs |

---

## Phase 2 UI Improvements — COMPLETED

| # | Improvement | Scope | Status |
|---|-------------|-------|--------|
| 1 | Table pagination | Dashboard, Students, Reports, AdminPanel | Done — `<Pagination>` component created and integrated |
| 2 | Table sorting | Dashboard, Students, Reports, AdminPanel | Done — clickable column headers with ArrowUp/ArrowDown icons |
| 3 | Toast/alert notifications | Global | Done — `<Toast>` component with `useToast()` hook |
| 4 | Loading/skeleton states | All pages | Done — `<SkeletonCard>`, `<SkeletonChart>`, `<SkeletonTable>` components |
| 5 | Empty states | All pages | Done — "No results" UI for empty search/filter |
| 6 | Form validation | Students, AdminPanel modals | Done — inline error messages for required fields |
| 7 | Mobile responsive audit | All pages | Pending |
| 8 | Login role selection | Login.jsx | Pending |

---

## Phase 3 — New Pages: Class Detail + Attendance Taking (2026-05-11) — COMPLETED

### New files created

| File | Lines | Purpose |
|---|---|---|
| `src/pages/ClassDetail.jsx` | 210 | Class detail page: header with teacher info, stat cards (total/present/absent/late), student cards with status badges + attendance rate bars, weekly attendance Recharts bar chart, "Take Attendance" button |
| `src/pages/ClassDetail.css` | 361 | Styling — paper backgrounds, cut-paper clip-paths, student card grid, chart card, responsive |
| `src/pages/Attendance.jsx` | 318 | Attendance taking: class picker view (5 cards with teacher/student count/marked status) + marking view (student list with Present/Absent/Late toggle buttons, submit with toast, session-level state persistence) |
| `src/pages/Attendance.css` | 384 | Styling — class picker grid, student rows as paper slips, toggle button states, progress bar |

### Existing files modified

| File | Change |
|---|---|
| `src/App.jsx` | Added imports + 3 routes: `class/:className`, `attendance`, `attendance/:className` |
| `src/layouts/DashboardLayout.jsx` | Added "Take Attendance" sidebar link (ClipboardCheck icon) + `getPageTitle()` for new paths |
| `src/pages/Dashboard.jsx` | Made class names clickable `<Link>` to class detail in Attendance by Class section + table |

### Routes (updated in Phase 4 to include year param)

| Route | Component | Purpose |
|---|---|---|
| `/dashboard/class/:year/:className` | ClassDetail | Class overview (e.g. `/dashboard/class/1/Bestari`) |
| `/dashboard/attendance` | Attendance | Class picker — select which class to mark |
| `/dashboard/attendance/:year/:className` | Attendance | Marking interface for a specific class |

### Navigation flow (updated in Phase 4)

```
Dashboard → click class name → /dashboard/class/1/Bestari (Class Detail)
  → click "Take Attendance" → /dashboard/attendance/1/Bestari (Marking)
  → mark Present/Absent/Late → Submit → toast "Saved"

Sidebar → "Take Attendance" → /dashboard/attendance (Class Picker)
  → click class card → /dashboard/attendance/1/Bijak (Marking)
```

### Edge cases handled
- Invalid class name → "Class Not Found" page with back button
- Attendance pre-populated from `attendanceToday` mock data
- Submit disabled until all students marked
- Session-level state (survives navigation, resets on browser refresh)

### Playwright verification (2026-05-11)
- Dashboard: sidebar "Take Attendance" present, class names clickable ✅
- Class Detail (Bestari): 3 students, 3 present, chart renders ✅
- Class Detail (Pandai): 0 present / 1 absent / 2 late ✅
- Class Not Found: friendly error page ✅
- Attendance Picker: 5 class cards ✅
- Attendance Marking (Bijak): toggles pre-populated, submit works ✅
- Students page: no regression ✅
- Console errors: zero ✅

---

## Phase 4 — Year 1-6 Scale-Up, Student Profile, Class Comparison, Face Registration (2026-05-11) — COMPLETED

### 4A. Data Model Overhaul

`src/data/mockData.js` completely rewritten to support Year 1-6 primary school scale.

| Data | Before | After |
|---|---|---|
| Students | 15 (kindergarten, ages 4-6) | 90 (6 years × 5 classes × 3, ages 7-12) |
| Teachers | 7 (5 teachers + 1 admin + 1 assistant) | 44 (30 homeroom + 12 subject + 1 admin + 1 assistant) |
| Classes | 5 (flat) | 30 class-groups (6 years × 5 class names) |
| Attendance records | 15/day | 90/day |
| Class attendance | 5 entries | 30 entries (per year×class) |

**New exports added:**
- `years` — `[1, 2, 3, 4, 5, 6]`
- `subjects` — 6 KSSR subjects: English, Bahasa Melayu, Mathematics, Science, Pendidikan Islam, Pendidikan Moral
- `attendanceHistory` — 20 school-day records per student (deterministic, seeded by student ID)

**Structural changes to existing exports:**
- All student/attendance records now include `year` field
- `users` now has `role: 'homeroom'|'subject'|'admin'|'assistant'`, with `year`, `class`, `subject`, `years` fields
- Homeroom teachers: 1 per year×class (30 total)
- Subject teachers: 2 per subject (1 for Year 1-3, 1 for Year 4-6, 12 total)
- Year 1 original data preserved (Ahmad Irfan, Nur Aisyah, Adam Mikail in Bestari; Cikgu Fatimah etc.)

### 4B. Primary School Audit

All kindergarten/preschool references removed:
- Student ages updated to 7-12 (primary school)
- ParentPortal.css: "Kindergarten" → "Primary school"
- package.json: "ai-kams-web" → "prism-ai-web"

### 4C. New Files Created

| File | Lines | Purpose |
|---|---|---|
| `src/pages/StudentProfile.jsx` | ~300 | Student profile: avatar, info cards (personal, parent, homeroom teacher), attendance rate, today's status, attendance calendar, teacher notes with Add Note form |
| `src/pages/StudentProfile.css` | ~350 | Styling — notepad ruled-line effect, responsive cards, paper textures |
| `src/components/AttendanceCalendar.jsx` | ~180 | Reusable month-view calendar: Mon-Fri grid, color-coded cells (green/red/orange), prev/next navigation, tooltips, monthly stats |
| `src/components/AttendanceCalendar.css` | ~200 | Styling — paper-square cells, status borders, tooltip |
| `src/pages/ClassComparison.jsx` | ~350 | Compare classes: year dropdown + class checkboxes, attendance rate bar chart, today's breakdown stacked bars, demographics (age + gender), summary table |
| `src/pages/ClassComparison.css` | ~400 | Styling — filter bar, chart cards, demographic cards, summary table |

### 4D. Existing Files Modified

| File | Changes |
|---|---|
| `src/data/mockData.js` | Complete rewrite (see 4A above) |
| `src/App.jsx` | Added routes: `students/:studentId`, `comparison`, `camera`. Updated class/attendance routes to include `:year` param |
| `src/layouts/DashboardLayout.jsx` | Added "Compare Classes" sidebar link (BarChart3 icon). Added persistent year dropdown in topbar with `YearContext` provider. Fixed year filter type (string → number). Added `getPageTitle()` for new routes |
| `src/pages/Dashboard.jsx` | Consumes `YearContext` for year filtering. Stats, table, class breakdown all filter by selected year. Class links updated to `/dashboard/class/{year}/{class}` |
| `src/pages/Students.jsx` | Added year filter. Student names clickable as `<Link>` to `/dashboard/students/{id}` |
| `src/pages/Reports.jsx` | Added year filter. Stats, charts, needs-attention/perfect-attendance lists filter by year |
| `src/pages/ClassDetail.jsx` | Accepts `:year` param. Filters students/attendance by year+class. Teacher lookup by year+class |
| `src/pages/Attendance.jsx` | Accepts `:year` param. Year filter in picker view. Class cards scoped to selected year |
| `src/pages/AdminPanel.jsx` + `.css` | Added "Face Registration" tab: stats cards (total/registered/pending/rate), per-class progress bars, student list with Register/Remove toggle, camera capture placeholder, year filter |

### 4E. Route Summary (Final)

| Route | Component | New/Modified |
|---|---|---|
| `/dashboard` | Dashboard | Modified (year filter) |
| `/dashboard/students` | Students | Modified (year filter, clickable names) |
| `/dashboard/students/:studentId` | StudentProfile | **New** |
| `/dashboard/reports` | Reports | Modified (year filter) |
| `/dashboard/class/:year/:className` | ClassDetail | Modified (year param) |
| `/dashboard/attendance` | Attendance | Modified (year filter) |
| `/dashboard/attendance/:year/:className` | Attendance | Modified (year param) |
| `/dashboard/comparison` | ClassComparison | **New** |
| `/dashboard/camera` | Inline placeholder | **New** (placeholder for AI camera module) |
| `/dashboard/admin` | AdminPanel | Modified (Face Registration tab) |

### 4F. Sidebar (Final)

```
Main
  Dashboard
  Live Camera

Management
  Students
  Reports
  Take Attendance
  Compare Classes        ← NEW (Phase 4)

System (admin only)
  Admin Panel            (now has 5 tabs including Face Registration)
```

### 4G. Bugs Found & Fixed

| Bug | Cause | Fix | File |
|---|---|---|---|
| Year filter shows 0 students | Dropdown stored year as string, data uses number. `'3' !== 3` | `setSelectedYear(e.target.value ? Number(e.target.value) : null)` | `DashboardLayout.jsx` |
| `/dashboard/camera` blank page | No route defined but sidebar link existed | Added inline placeholder component | `App.jsx` |

### 4H. Playwright Verification (2026-05-11)

**63 tests across 5 parallel agents — 60 pass, 2 fail (bugs, now fixed), 1 fail (camera route, now fixed)**

| Agent | Scope | Pass | Fail |
|---|---|---|---|
| Dashboard + Reports | Stats, year filter, charts, table interactions | 11 | 0 (after fix) |
| Students + Profile | Filters, search, calendar, notes, edge cases | 13 | 0 |
| Class Detail + Attendance | Year params, marking, submit, invalid routes | 13 | 0 |
| Comparison + Face Registration | Charts, class toggles, camera animation, filters | 13 | 0 |
| Navigation + Regression | Sidebar flow, landing, login, parent portal, mobile, all admin tabs | 13 | 0 (after fix) |

**Post-fix verification:**
- Year filter Year 1: 15 students ✅
- Year filter Year 3: 15 students ✅
- Year filter Year 6: 15 students ✅
- Year filter All Years: 90 students ✅
- Camera placeholder page renders ✅
- Console errors: zero across all pages ✅
