# PRISM-AI — Students & Classes Expansion Ideas

Compiled 2026-05-07. Scope: **frontend / mock-data only** unless explicitly noted. All shapes are designed to map 1:1 to a real DB schema in Phase 3 (Supabase).

---

## Current state (baseline)

### Students
- 15 students in `mockData.js` → grid of paper-polaroid cards on `/dashboard/students`.
- Per card: avatar, name, class, age, gender, parent (single), parent email/phone, attendance %, face-registered status.
- Page features: search, class filter, face-status filter, view/edit modal, Add Student / Import CSV buttons.
- 4 stat tiles: Total Students, Face Registered, Avg Attendance, Classes.

### Classes
- 5 classes (Bestari, Bijak, Cerdik, Cerdas, Pandai) — defined as a string array + colour map in `mockData.js`.
- **No dedicated Classes page exists.** Classes only appear as:
  - Filter dropdown values in Dashboard, Students, Reports.
  - "Attendance by Class" widget on Dashboard.
  - "Class Comparison" chart on Reports.
  - `class` field on student / user records.

---

## 1. Students — 7 expansion ideas

| # | Idea | Why it lands | UI scope | What "real" adds (Phase 3) |
|---|---|---|---|---|
| **S1** | **Full student profile page** (`/dashboard/students/:id`) — replaces the modal. Sections: profile, parents, attendance calendar, subjects + grades, behavior log, pickup permissions, photos | Biggest visual win; turns a card into a real record | Medium | Just a frontend route — no backend cost |
| **S2** | **Multiple parents/guardians** (father, mother, emergency contact) with email/phone each | Realistic for Malaysian schools; ties to "Instant Parent Alerts" feature | Small | Separate `guardians` table, FK to student |
| **S3** | **Authorized pickup persons** — list of adults with face-registered photos and time windows (Mum Mon–Fri, Grandpa Wed) | Plays directly to the *Safety* feature card on Landing | Small-Medium | DB relations + encrypted face embeddings, time-window logic, real auth check at gate |
| **S4** | **Per-student attendance calendar + pattern insights** — "frequently late on Mondays", "98% punctuality this month" | Ties to AI-analytics angle in the proposal | Medium | None — reuses existing attendance data |
| **S5** | **Face registration UI** — multi-angle photo upload, "Train model" progress bar, retrain when child grows | Most visually demoable AI workflow | Medium | Real Python backend running MTCNN + ArcFace, image storage, model retrain pipeline |
| **S6** | **Sibling links** — if Ahmad and Aisyah are siblings, jump between profiles | Cheap; warmth | Small | None — `students[].siblingIds: []` |
| **S7** | **Grades + per-subject performance** — small bar chart per subject, term grades | Big if paired with subjects expansion | Medium | DB `grades` table, exam-entry workflow |

### Suggested mock-data shapes (Students)

```js
// students[i] becomes:
{
  id: 1,
  name: 'Ahmad Irfan',
  class: 'Bestari',
  age: 5,
  gender: 'M',
  joinedAt: '2024-09-01',
  // S2 — multiple guardians
  guardians: [
    { relation: 'father', name: 'Encik Razak', email: 'razak@email.com', phone: '012-3456789', primary: true },
    { relation: 'mother', name: 'Puan Sarah', email: 'sarah@email.com', phone: '012-9876543' },
    { relation: 'emergency', name: 'Mak Long', phone: '019-1112222' },
  ],
  // S3 — pickup permissions
  pickupAuthorized: [
    { name: 'Encik Razak', relation: 'father', faceRegistered: true, days: ['Mon','Tue','Wed','Thu','Fri'] },
    { name: 'Puan Sarah', relation: 'mother', faceRegistered: true, days: ['Mon','Wed','Fri'] },
    { name: 'Pak Cik Hakim', relation: 'uncle', faceRegistered: false, days: ['Tue'], oneTime: '2026-05-09' },
  ],
  // S5 — face registration meta
  face: {
    registered: true,
    photosCount: 5,
    lastTrainedAt: '2026-04-12',
    confidence: 0.96,
  },
  // S6 — sibling links
  siblingIds: [9],
  // S7 — grades per subject
  grades: {
    'English':           { mark: 87, grade: 'A', trend: '+2' },
    'Bahasa Melayu':     { mark: 92, grade: 'A', trend: '+1' },
    'Mathematics':       { mark: 78, grade: 'B', trend: '-3' },
    'Science':           { mark: 85, grade: 'A', trend: '+5' },
    'Pendidikan Islam':  { mark: 90, grade: 'A', trend: '+0' },
    'Pendidikan Moral':  { mark: 88, grade: 'A', trend: '+2' },
  },
  // Existing fields kept
  faceRegistered: true,
  attendanceRate: 94,
}
```

---

## 2. Classes — 7 expansion ideas

| # | Idea | Why it lands | UI scope | What "real" adds (Phase 3) |
|---|---|---|---|---|
| **C1** | **Dedicated Classes page** (`/dashboard/classes`) — grid of 5 class cards (teacher, room, count, attendance rate, today's status) | Currently classes have no home of their own — biggest missing piece | Medium | Just a frontend route |
| **C2** | **Class detail page** (`/dashboard/classes/:name`) — teacher, roster with photos, today's attendance, weekly trend, announcements, average grades | Pairs with C1; turns class into a first-class entity | Medium | None |
| **C3** | **Seating chart** — visual classroom layout, drag-drop students to desks; camera "sees" who sits where | Visually striking; perfect tie to face recognition | Medium-Large | DB: persist `studentId → seatId`, camera-pose mapping |
| **C4** | **Class timetable** (the 6 subjects: English, Bahasa Melayu, Science, Mathematics, Pendidikan Islam, Pendidikan Moral) — weekly grid, colour-coded subject blocks | Gives subjects a home; demos M aesthetic gorgeously | Medium | DB: `timetable` table, period ↔ subject ↔ teacher |
| **C5** | **Class teacher + subject teachers** — Cikgu Fatimah is *form teacher* of Bestari; subject teachers swap in by period | Realistic; adds depth to AdminPanel | Small-Medium | DB: many-to-many `users ↔ subjects ↔ classes` |
| **C6** | **Per-class announcements + broadcast** — teacher posts a notice → all 3 parents in that class get it | Adds messaging without a full chat system | Medium | Real push: WhatsApp/SMS API integration |
| **C7** | **Behavior heatmap** — who's been late/absent/in trouble this week, colour-coded grid by student × day | Actionable; shows AI predictive analytics | Medium | DB: `incidents` table |

### Suggested mock-data shapes (Classes)

```js
// New: classes-as-objects (currently just a string array)
export const classDetails = {
  Bestari: {
    name: 'Bestari',
    formTeacher: 'Cikgu Fatimah',
    formTeacherEmail: 'fatimah@prismai.edu',
    room: 'Block A, Room 5A',
    roomPhotoUrl: '/rooms/A-5A.jpg',
    capacity: 25,
    studentIds: [1, 2, 9],
    color: '#2F75C9',
    // C3 — seating chart
    seating: { rows: 5, cols: 5, layout: { '0-0': 1, '0-1': 2, '0-2': 9 /* ... */ } },
    // C4 — timetable
    timetable: [
      { day: 'Mon', period: 1, time: '07:30-08:30', subject: 'Mathematics',     teacher: 'Cikgu Hafiz' },
      { day: 'Mon', period: 2, time: '08:30-09:30', subject: 'English',         teacher: 'Cikgu Fatimah' },
      { day: 'Mon', period: 3, time: '09:30-10:30', subject: 'Bahasa Melayu',   teacher: 'Cikgu Fatimah' },
      // ... etc
    ],
    // C6 — class announcements
    announcements: [
      { id: 1, title: 'Field trip Friday', body: 'Bring extra water...', date: '2026-05-12' },
    ],
  },
  // ... other classes
};

// New: subjects (the 6 KSSR subjects)
export const subjects = [
  { id: 'eng', name: 'English',          colour: '#2F75C9', hoursPerWeek: 5 },
  { id: 'bm',  name: 'Bahasa Melayu',    colour: '#4FA764', hoursPerWeek: 6 },
  { id: 'mat', name: 'Mathematics',      colour: '#E04A3F', hoursPerWeek: 5 },
  { id: 'sci', name: 'Science',          colour: '#EA8534', hoursPerWeek: 4 },
  { id: 'pi',  name: 'Pendidikan Islam', colour: '#F2C744', hoursPerWeek: 3 },
  { id: 'pm',  name: 'Pendidikan Moral', colour: '#1F1A12', hoursPerWeek: 3 },
];
```

---

## 3. Suggested bundles (pick one)

| Bundle | What's in it | Effort | Best for |
|---|---|---|---|
| **A · "The student record"** | S1 + S2 + S3 | 2-3 hrs | Mapping cleanly to the *Safety* feature on Landing. Three connected pieces that turn a student into a rich record. |
| **B · "The classroom"** | C1 + C2 + C4 (with the 6 subjects) | 2-3 hrs | Adds a whole new section of the app and gives subjects their natural home. |
| **C · "AI flex"** | S5 + C3 + S4 | 3-4 hrs | Most demoable: tells the AI story end-to-end, looks impressive on the FYP poster. |
| **D · "Everything important"** | A + B together | 4-5 hrs | Maximum surface area; misses the AI-flex visuals. |
| **E · "Full chef's kiss"** | A + B + C | 6-8 hrs | Everything. Only if you have time to spare before submission. |

---

## 4. Notes

- **All UI-only.** No real backend, no DB, no real face recognition. Mock data only — but designed to map 1:1 to a future Supabase schema.
- **Voice & copy.** Per `DESIGN_SYSTEM.md` §11 — none of these expansions invent new copy unless the source product would have it. Keep terminology consistent (Pupil/Student, Class, Teacher, etc.).
- **M visuals.** Every new screen follows the rules in `DESIGN_SYSTEM.md` (cut-paper word headlines, tape strips, palette, fonts, slight rotations).
- **Routing.** New pages get added to `App.jsx` under the existing `<DashboardLayout>` wrapper so the sidebar/topbar stays consistent.
- **Sidebar updates.** Bundle B / C add new sidebar items under "Management" or a new "Curriculum" section.

---

## 5. Open questions before implementing

1. **Bundle pick** — which bundle (A / B / C / D / E), or à la carte?
2. **Profile page route** — replace the modal entirely, or keep modal *and* add the page?
3. **Subjects palette** — use the M crayon set as listed above, or assign different colours to each subject?
4. **Seating chart fidelity** — simple grid (drag-drop), or also include camera/door icons + room compass?
5. **Announcements scope** — class-only, or also extend the existing dashboard "Notifications" widget?

---

*Source-of-truth living document. Update when scope changes.*
