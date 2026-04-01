export const classes = ['Cempaka', 'Melati', 'Dahlia', 'Kenanga'];

export const classColors = { Cempaka: '#1E40AF', Melati: '#3B82F6', Dahlia: '#22C55E', Kenanga: '#F59E0B' };

export const students = [
  { id: 1, name: 'Ahmad Irfan', class: 'Cempaka', age: 5, gender: 'M', parent: 'Encik Razak', parentEmail: 'razak@email.com', parentPhone: '012-3456789', faceRegistered: true, attendanceRate: 94 },
  { id: 2, name: 'Nur Aisyah', class: 'Cempaka', age: 5, gender: 'F', parent: 'Puan Siti', parentEmail: 'siti@email.com', parentPhone: '013-2345678', faceRegistered: true, attendanceRate: 98 },
  { id: 3, name: 'Muhammad Danish', class: 'Melati', age: 6, gender: 'M', parent: 'Encik Hakim', parentEmail: 'hakim@email.com', parentPhone: '014-3456789', faceRegistered: true, attendanceRate: 82 },
  { id: 4, name: 'Puteri Hana', class: 'Melati', age: 6, gender: 'F', parent: 'Puan Aminah', parentEmail: 'aminah@email.com', parentPhone: '015-4567890', faceRegistered: true, attendanceRate: 96 },
  { id: 5, name: 'Arif Zulkifli', class: 'Cempaka', age: 5, gender: 'M', parent: 'Encik Zul', parentEmail: 'zul@email.com', parentPhone: '016-5678901', faceRegistered: false, attendanceRate: 72 },
  { id: 6, name: 'Nurul Iman', class: 'Dahlia', age: 4, gender: 'F', parent: 'Puan Farah', parentEmail: 'farah@email.com', parentPhone: '017-6789012', faceRegistered: true, attendanceRate: 91 },
  { id: 7, name: 'Haziq Rahman', class: 'Dahlia', age: 4, gender: 'M', parent: 'Encik Rahman', parentEmail: 'rahman@email.com', parentPhone: '018-7890123', faceRegistered: true, attendanceRate: 88 },
  { id: 8, name: 'Sofea Mariam', class: 'Melati', age: 6, gender: 'F', parent: 'Puan Mariam', parentEmail: 'mariam@email.com', parentPhone: '019-8901234', faceRegistered: true, attendanceRate: 76 },
  { id: 9, name: 'Adam Mikail', class: 'Cempaka', age: 5, gender: 'M', parent: 'Encik Faisal', parentEmail: 'faisal@email.com', parentPhone: '011-9012345', faceRegistered: true, attendanceRate: 95 },
  { id: 10, name: 'Alia Husna', class: 'Dahlia', age: 4, gender: 'F', parent: 'Puan Husna', parentEmail: 'husna@email.com', parentPhone: '012-0123456', faceRegistered: true, attendanceRate: 85 },
  { id: 11, name: 'Zayn Arifin', class: 'Kenanga', age: 5, gender: 'M', parent: 'Encik Arif', parentEmail: 'arif@email.com', parentPhone: '013-1112233', faceRegistered: true, attendanceRate: 97 },
  { id: 12, name: 'Maisarah Noor', class: 'Kenanga', age: 5, gender: 'F', parent: 'Puan Noor', parentEmail: 'noor@email.com', parentPhone: '014-2223344', faceRegistered: false, attendanceRate: 89 },
  { id: 13, name: 'Harith Danial', class: 'Kenanga', age: 5, gender: 'M', parent: 'Encik Danial', parentEmail: 'danial@email.com', parentPhone: '015-3334455', faceRegistered: true, attendanceRate: 93 },
  { id: 14, name: 'Irdina Safiya', class: 'Dahlia', age: 4, gender: 'F', parent: 'Puan Safiya', parentEmail: 'safiya@email.com', parentPhone: '016-4445566', faceRegistered: true, attendanceRate: 99 },
  { id: 15, name: 'Rayyan Iskandar', class: 'Melati', age: 6, gender: 'M', parent: 'Encik Iskandar', parentEmail: 'iskandar@email.com', parentPhone: '017-5556677', faceRegistered: false, attendanceRate: 80 },
];

export const attendanceToday = [
  { studentId: 1, name: 'Ahmad Irfan', class: 'Cempaka', status: 'present', timeIn: '07:45 AM', timeOut: '-' },
  { studentId: 2, name: 'Nur Aisyah', class: 'Cempaka', status: 'present', timeIn: '07:50 AM', timeOut: '-' },
  { studentId: 3, name: 'Muhammad Danish', class: 'Melati', status: 'late', timeIn: '08:20 AM', timeOut: '-' },
  { studentId: 4, name: 'Puteri Hana', class: 'Melati', status: 'present', timeIn: '07:30 AM', timeOut: '-' },
  { studentId: 5, name: 'Arif Zulkifli', class: 'Cempaka', status: 'absent', timeIn: '-', timeOut: '-' },
  { studentId: 6, name: 'Nurul Iman', class: 'Dahlia', status: 'present', timeIn: '07:55 AM', timeOut: '-' },
  { studentId: 7, name: 'Haziq Rahman', class: 'Dahlia', status: 'present', timeIn: '07:40 AM', timeOut: '-' },
  { studentId: 8, name: 'Sofea Mariam', class: 'Melati', status: 'absent', timeIn: '-', timeOut: '-' },
  { studentId: 9, name: 'Adam Mikail', class: 'Cempaka', status: 'present', timeIn: '07:48 AM', timeOut: '-' },
  { studentId: 10, name: 'Alia Husna', class: 'Dahlia', status: 'late', timeIn: '08:15 AM', timeOut: '-' },
  { studentId: 11, name: 'Zayn Arifin', class: 'Kenanga', status: 'present', timeIn: '07:35 AM', timeOut: '-' },
  { studentId: 12, name: 'Maisarah Noor', class: 'Kenanga', status: 'present', timeIn: '07:52 AM', timeOut: '-' },
  { studentId: 13, name: 'Harith Danial', class: 'Kenanga', status: 'present', timeIn: '07:42 AM', timeOut: '-' },
  { studentId: 14, name: 'Irdina Safiya', class: 'Dahlia', status: 'present', timeIn: '07:28 AM', timeOut: '-' },
  { studentId: 15, name: 'Rayyan Iskandar', class: 'Melati', status: 'late', timeIn: '08:25 AM', timeOut: '-' },
];

export const weeklyAttendance = [
  { day: 'Mon', present: 13, absent: 1, late: 1 },
  { day: 'Tue', present: 11, absent: 2, late: 2 },
  { day: 'Wed', present: 12, absent: 2, late: 1 },
  { day: 'Thu', present: 14, absent: 0, late: 1 },
  { day: 'Fri', present: 10, absent: 2, late: 3 },
];

export const monthlyAttendance = [
  { week: 'Week 1', rate: 92 },
  { week: 'Week 2', rate: 88 },
  { week: 'Week 3', rate: 95 },
  { week: 'Week 4', rate: 91 },
];

export const dailyArrivalTimes = [
  { time: '07:00', count: 0 },
  { time: '07:15', count: 1 },
  { time: '07:30', count: 3 },
  { time: '07:35', count: 2 },
  { time: '07:40', count: 2 },
  { time: '07:45', count: 2 },
  { time: '07:50', count: 2 },
  { time: '07:55', count: 1 },
  { time: '08:00', count: 0 },
  { time: '08:15', count: 1 },
  { time: '08:20', count: 1 },
  { time: '08:25', count: 1 },
];

export const classAttendance = [
  { class: 'Cempaka', total: 4, present: 3, absent: 1, late: 0 },
  { class: 'Melati', total: 4, present: 1, absent: 1, late: 2 },
  { class: 'Dahlia', total: 4, present: 3, absent: 0, late: 1 },
  { class: 'Kenanga', total: 3, present: 3, absent: 0, late: 0 },
];

export const notifications = [
  { id: 1, type: 'warning', message: 'Muhammad Danish arrived late at 8:20 AM', time: '8:20 AM' },
  { id: 2, type: 'danger', message: 'Arif Zulkifli is absent today', time: '8:30 AM' },
  { id: 3, type: 'danger', message: 'Sofea Mariam is absent today', time: '8:30 AM' },
  { id: 4, type: 'info', message: 'Unrecognized face detected at entrance', time: '8:05 AM' },
  { id: 5, type: 'warning', message: 'Alia Husna arrived late at 8:15 AM', time: '8:15 AM' },
  { id: 6, type: 'success', message: 'All Kenanga class students present today', time: '8:00 AM' },
  { id: 7, type: 'info', message: 'AI model accuracy updated to 95.5%', time: '7:30 AM' },
  { id: 8, type: 'warning', message: 'Rayyan Iskandar arrived late at 8:25 AM', time: '8:25 AM' },
];

export const recentActivity = [
  { id: 1, user: 'System', action: 'Ahmad Irfan checked in via face recognition', timestamp: '07:45 AM', type: 'success' },
  { id: 2, user: 'System', action: 'Puteri Hana checked in via face recognition', timestamp: '07:30 AM', type: 'success' },
  { id: 3, user: 'System', action: 'Unrecognized face detected at main entrance', timestamp: '08:05 AM', type: 'info' },
  { id: 4, user: 'Cikgu Fatimah', action: 'Marked Arif Zulkifli as absent', timestamp: '08:30 AM', type: 'danger' },
  { id: 5, user: 'System', action: 'Muhammad Danish checked in (late)', timestamp: '08:20 AM', type: 'warning' },
  { id: 6, user: 'System', action: 'Alia Husna checked in (late)', timestamp: '08:15 AM', type: 'warning' },
  { id: 7, user: 'Cikgu Noraini', action: 'Updated attendance for Sofea Mariam', timestamp: '08:32 AM', type: 'danger' },
  { id: 8, user: 'Admin Hafiz', action: 'Generated weekly report', timestamp: '09:00 AM', type: 'info' },
  { id: 9, user: 'System', action: 'Notification sent to Encik Zul (absence alert)', timestamp: '08:31 AM', type: 'info' },
  { id: 10, user: 'System', action: 'Rayyan Iskandar checked in (late)', timestamp: '08:25 AM', type: 'warning' },
];

export const users = [
  { id: 1, name: 'Cikgu Fatimah', email: 'fatimah@prismai.edu', role: 'teacher', class: 'Cempaka', status: 'active' },
  { id: 2, name: 'Cikgu Noraini', email: 'noraini@prismai.edu', role: 'teacher', class: 'Melati', status: 'active' },
  { id: 3, name: 'Cikgu Zainab', email: 'zainab@prismai.edu', role: 'teacher', class: 'Dahlia', status: 'active' },
  { id: 4, name: 'Cikgu Liyana', email: 'liyana@prismai.edu', role: 'teacher', class: 'Kenanga', status: 'active' },
  { id: 5, name: 'Admin Hafiz', email: 'hafiz@prismai.edu', role: 'admin', class: null, status: 'active' },
  { id: 6, name: 'Kak Rina', email: 'rina@prismai.edu', role: 'assistant', class: null, status: 'active' },
];

export const auditLogs = [
  { id: 1, user: 'Cikgu Fatimah', action: 'Marked Arif Zulkifli as absent', timestamp: '2026-03-26 08:30 AM', type: 'attendance' },
  { id: 2, user: 'System', action: 'Face recognition detected Muhammad Danish (late)', timestamp: '2026-03-26 08:20 AM', type: 'system' },
  { id: 3, user: 'Admin Hafiz', action: 'Added new student: Rayyan Iskandar', timestamp: '2026-03-25 10:00 AM', type: 'user' },
  { id: 4, user: 'System', action: 'AI model restarted successfully', timestamp: '2026-03-25 07:00 AM', type: 'system' },
  { id: 5, user: 'Cikgu Noraini', action: 'Updated attendance for Puteri Hana', timestamp: '2026-03-24 09:15 AM', type: 'attendance' },
  { id: 6, user: 'Admin Hafiz', action: 'Updated notification settings', timestamp: '2026-03-24 08:00 AM', type: 'user' },
  { id: 7, user: 'System', action: 'Backup completed successfully', timestamp: '2026-03-23 11:00 PM', type: 'system' },
  { id: 8, user: 'Cikgu Zainab', action: 'Registered face for Irdina Safiya', timestamp: '2026-03-23 09:30 AM', type: 'user' },
];

export const schoolEvents = [
  { id: 1, title: 'Parent-Teacher Meeting', date: '2026-04-02', type: 'meeting' },
  { id: 2, title: 'Sports Day', date: '2026-04-10', type: 'event' },
  { id: 3, title: 'School Holiday - Hari Raya', date: '2026-04-15', type: 'holiday' },
  { id: 4, title: 'Annual Concert', date: '2026-04-25', type: 'event' },
  { id: 5, title: 'Term 1 Report Card Day', date: '2026-04-30', type: 'meeting' },
];

export const aiModelHistory = [
  { date: 'Week 1', accuracy: 91.2 },
  { date: 'Week 2', accuracy: 92.8 },
  { date: 'Week 3', accuracy: 93.5 },
  { date: 'Week 4', accuracy: 94.1 },
  { date: 'Week 5', accuracy: 95.0 },
  { date: 'Week 6', accuracy: 95.5 },
];

export const parentChildData = {
  parent: { name: 'Encik Razak', email: 'razak@email.com' },
  child: { name: 'Ahmad Irfan', class: 'Cempaka', age: 5 },
  weeklyStats: { present: 4, absent: 0, late: 1, onTimeRate: 80 },
  attendanceHistory: [
    { date: '2026-03-26', status: 'present', timeIn: '07:45 AM', timeOut: '12:00 PM' },
    { date: '2026-03-25', status: 'present', timeIn: '07:50 AM', timeOut: '12:05 PM' },
    { date: '2026-03-24', status: 'late', timeIn: '08:10 AM', timeOut: '12:00 PM' },
    { date: '2026-03-21', status: 'present', timeIn: '07:40 AM', timeOut: '12:00 PM' },
    { date: '2026-03-20', status: 'absent', timeIn: '-', timeOut: '-' },
    { date: '2026-03-19', status: 'present', timeIn: '07:55 AM', timeOut: '12:10 PM' },
    { date: '2026-03-18', status: 'present', timeIn: '07:35 AM', timeOut: '12:00 PM' },
    { date: '2026-03-17', status: 'present', timeIn: '07:42 AM', timeOut: '12:00 PM' },
    { date: '2026-03-14', status: 'present', timeIn: '07:38 AM', timeOut: '12:05 PM' },
    { date: '2026-03-13', status: 'late', timeIn: '08:05 AM', timeOut: '12:00 PM' },
    { date: '2026-03-12', status: 'present', timeIn: '07:50 AM', timeOut: '12:00 PM' },
    { date: '2026-03-11', status: 'present', timeIn: '07:30 AM', timeOut: '12:10 PM' },
    { date: '2026-03-10', status: 'present', timeIn: '07:45 AM', timeOut: '12:00 PM' },
    { date: '2026-03-07', status: 'absent', timeIn: '-', timeOut: '-' },
  ],
  notifications: [
    { id: 1, message: 'Ahmad Irfan checked in at 07:45 AM', time: '07:45 AM', date: '2026-03-26' },
    { id: 2, message: 'Ahmad Irfan checked in at 07:50 AM', time: '07:50 AM', date: '2026-03-25' },
    { id: 3, message: 'Ahmad Irfan arrived late at 08:10 AM', time: '08:10 AM', date: '2026-03-24' },
    { id: 4, message: 'Ahmad Irfan was absent today', time: '08:30 AM', date: '2026-03-20' },
    { id: 5, message: 'Ahmad Irfan arrived late at 08:05 AM', time: '08:05 AM', date: '2026-03-13' },
    { id: 6, message: 'Ahmad Irfan was absent today', time: '08:30 AM', date: '2026-03-07' },
  ],
  announcements: [
    { id: 1, title: 'Parent-Teacher Meeting', message: 'Please join us on April 2nd for the annual parent-teacher meeting at 10:00 AM.', date: '2026-03-25' },
    { id: 2, title: 'Sports Day Preparation', message: 'Students are required to bring sports attire starting next week for practice.', date: '2026-03-22' },
    { id: 3, title: 'Hari Raya Holiday', message: 'School will be closed from April 15-18 for Hari Raya celebrations.', date: '2026-03-20' },
  ],
};
