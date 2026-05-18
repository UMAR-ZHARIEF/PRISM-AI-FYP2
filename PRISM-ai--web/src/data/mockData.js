/* ============================================================
   PRISM-AI  --  Mock Data
   Full primary-school dataset: 6 years, 5 classes, 90 students
   ============================================================ */

// ── Years ────────────────────────────────────────────────────
export const years = [1, 2, 3, 4, 5, 6];

// ── Classes & colours ────────────────────────────────────────
export const classes = ['Bestari', 'Bijak', 'Cerdik', 'Cerdas', 'Pandai'];

export const classColors = {
  Bestari: '#2F75C9',
  Bijak:   '#E04A3F',
  Cerdik:  '#4FA764',
  Cerdas:  '#EA8534',
  Pandai:  '#F2C744',
};

// ── Subjects (6 KSSR subjects) ───────────────────────────────
export const subjects = [
  { id: 'eng', name: 'English',          colour: '#2F75C9', hoursPerWeek: 5 },
  { id: 'bm',  name: 'Bahasa Melayu',    colour: '#4FA764', hoursPerWeek: 6 },
  { id: 'mat', name: 'Mathematics',      colour: '#E04A3F', hoursPerWeek: 5 },
  { id: 'sci', name: 'Science',          colour: '#EA8534', hoursPerWeek: 4 },
  { id: 'pi',  name: 'Pendidikan Islam', colour: '#F2C744', hoursPerWeek: 3 },
  { id: 'pm',  name: 'Pendidikan Moral', colour: '#1F1A12', hoursPerWeek: 3 },
];

// ── Students  (90 total: 6 years x 5 classes x 3 each) ──────
export const students = [
  // ─── Year 1 ────────────────────────────────────────────────
  // Bestari (keep originals)
  { id: 1,  name: 'Ahmad Irfan',      year: 1, class: 'Bestari', age: 7, gender: 'M', parent: 'Encik Razak',     parentEmail: 'razak@email.com',     parentPhone: '012-3456789', faceRegistered: true,  attendanceRate: 94 },
  { id: 2,  name: 'Nur Aisyah',       year: 1, class: 'Bestari', age: 7, gender: 'F', parent: 'Puan Siti',       parentEmail: 'siti@email.com',      parentPhone: '013-2345678', faceRegistered: true,  attendanceRate: 98 },
  { id: 3,  name: 'Adam Mikail',      year: 1, class: 'Bestari', age: 7, gender: 'M', parent: 'Encik Faisal',    parentEmail: 'faisal@email.com',    parentPhone: '011-9012345', faceRegistered: true,  attendanceRate: 95 },
  // Bijak
  { id: 4,  name: 'Muhammad Danish',   year: 1, class: 'Bijak',   age: 7, gender: 'M', parent: 'Encik Hakim',     parentEmail: 'hakim@email.com',     parentPhone: '014-3456789', faceRegistered: true,  attendanceRate: 82 },
  { id: 5,  name: 'Puteri Hana',       year: 1, class: 'Bijak',   age: 7, gender: 'F', parent: 'Puan Aminah',     parentEmail: 'aminah@email.com',    parentPhone: '015-4567890', faceRegistered: true,  attendanceRate: 96 },
  { id: 6,  name: 'Sofea Mariam',      year: 1, class: 'Bijak',   age: 7, gender: 'F', parent: 'Puan Mariam',     parentEmail: 'mariam@email.com',    parentPhone: '019-8901234', faceRegistered: true,  attendanceRate: 76 },
  // Cerdik
  { id: 7,  name: 'Nurul Iman',        year: 1, class: 'Cerdik',  age: 7, gender: 'F', parent: 'Puan Farah',      parentEmail: 'farah@email.com',     parentPhone: '017-6789012', faceRegistered: true,  attendanceRate: 91 },
  { id: 8,  name: 'Haziq Rahman',      year: 1, class: 'Cerdik',  age: 7, gender: 'M', parent: 'Encik Rahman',    parentEmail: 'rahman@email.com',    parentPhone: '018-7890123', faceRegistered: true,  attendanceRate: 88 },
  { id: 9,  name: 'Irdina Safiya',     year: 1, class: 'Cerdik',  age: 7, gender: 'F', parent: 'Puan Safiya',     parentEmail: 'safiya@email.com',    parentPhone: '016-4445566', faceRegistered: true,  attendanceRate: 99 },
  // Cerdas
  { id: 10, name: 'Zayn Arifin',       year: 1, class: 'Cerdas',  age: 7, gender: 'M', parent: 'Encik Arif',      parentEmail: 'arif@email.com',      parentPhone: '013-1112233', faceRegistered: true,  attendanceRate: 97 },
  { id: 11, name: 'Maisarah Noor',     year: 1, class: 'Cerdas',  age: 7, gender: 'F', parent: 'Puan Noor',       parentEmail: 'noor@email.com',      parentPhone: '014-2223344', faceRegistered: false, attendanceRate: 89 },
  { id: 12, name: 'Harith Danial',     year: 1, class: 'Cerdas',  age: 7, gender: 'M', parent: 'Encik Danial',    parentEmail: 'danial@email.com',    parentPhone: '015-3334455', faceRegistered: true,  attendanceRate: 93 },
  // Pandai
  { id: 13, name: 'Arif Zulkifli',     year: 1, class: 'Pandai',  age: 7, gender: 'M', parent: 'Encik Zul',       parentEmail: 'zul@email.com',       parentPhone: '016-5678901', faceRegistered: false, attendanceRate: 72 },
  { id: 14, name: 'Alia Husna',        year: 1, class: 'Pandai',  age: 7, gender: 'F', parent: 'Puan Husna',      parentEmail: 'husna@email.com',     parentPhone: '012-0123456', faceRegistered: true,  attendanceRate: 85 },
  { id: 15, name: 'Rayyan Iskandar',   year: 1, class: 'Pandai',  age: 7, gender: 'M', parent: 'Encik Iskandar',  parentEmail: 'iskandar@email.com',  parentPhone: '017-5556677', faceRegistered: false, attendanceRate: 80 },

  // ─── Year 2 ────────────────────────────────────────────────
  // Bestari
  { id: 16, name: 'Aiman Hariz',       year: 2, class: 'Bestari', age: 8, gender: 'M', parent: 'Encik Hariz',     parentEmail: 'hariz@email.com',     parentPhone: '012-7711001', faceRegistered: true,  attendanceRate: 93 },
  { id: 17, name: 'Nur Dania',         year: 2, class: 'Bestari', age: 8, gender: 'F', parent: 'Puan Rozana',     parentEmail: 'rozana@email.com',    parentPhone: '013-7711002', faceRegistered: true,  attendanceRate: 96 },
  { id: 18, name: 'Farhan Aqil',       year: 2, class: 'Bestari', age: 8, gender: 'M', parent: 'Encik Aqil',      parentEmail: 'aqil@email.com',      parentPhone: '014-7711003', faceRegistered: false, attendanceRate: 87 },
  // Bijak
  { id: 19, name: 'Aisyah Humaira',    year: 2, class: 'Bijak',   age: 8, gender: 'F', parent: 'Puan Humaira',    parentEmail: 'humaira@email.com',   parentPhone: '015-7711004', faceRegistered: true,  attendanceRate: 91 },
  { id: 20, name: 'Irfan Hakimi',      year: 2, class: 'Bijak',   age: 8, gender: 'M', parent: 'Encik Hakimi',    parentEmail: 'hakimi@email.com',    parentPhone: '016-7711005', faceRegistered: true,  attendanceRate: 88 },
  { id: 21, name: 'Nur Izzati',        year: 2, class: 'Bijak',   age: 8, gender: 'F', parent: 'Puan Izzati',     parentEmail: 'izzati@email.com',    parentPhone: '017-7711006', faceRegistered: true,  attendanceRate: 94 },
  // Cerdik
  { id: 22, name: 'Danish Hakim',      year: 2, class: 'Cerdik',  age: 8, gender: 'M', parent: 'Encik Nazri',     parentEmail: 'nazri@email.com',     parentPhone: '018-7711007', faceRegistered: true,  attendanceRate: 90 },
  { id: 23, name: 'Sofiya Batrisyia',  year: 2, class: 'Cerdik',  age: 8, gender: 'F', parent: 'Puan Batrisyia',  parentEmail: 'batrisyia@email.com', parentPhone: '019-7711008', faceRegistered: false, attendanceRate: 85 },
  { id: 24, name: 'Zafran Idris',      year: 2, class: 'Cerdik',  age: 8, gender: 'M', parent: 'Encik Idris',     parentEmail: 'idris@email.com',     parentPhone: '011-7711009', faceRegistered: true,  attendanceRate: 92 },
  // Cerdas
  { id: 25, name: 'Alya Zahira',       year: 2, class: 'Cerdas',  age: 8, gender: 'F', parent: 'Puan Zahira',     parentEmail: 'zahira@email.com',    parentPhone: '012-7711010', faceRegistered: true,  attendanceRate: 97 },
  { id: 26, name: 'Mikhail Aiman',     year: 2, class: 'Cerdas',  age: 8, gender: 'M', parent: 'Encik Aiman',     parentEmail: 'aiman@email.com',     parentPhone: '013-7711011', faceRegistered: true,  attendanceRate: 86 },
  { id: 27, name: 'Nabilah Fikri',     year: 2, class: 'Cerdas',  age: 8, gender: 'F', parent: 'Puan Fikri',      parentEmail: 'fikri@email.com',     parentPhone: '014-7711012', faceRegistered: true,  attendanceRate: 93 },
  // Pandai
  { id: 28, name: 'Hazim Syahmi',      year: 2, class: 'Pandai',  age: 8, gender: 'M', parent: 'Encik Syahmi',    parentEmail: 'syahmi@email.com',    parentPhone: '015-7711013', faceRegistered: false, attendanceRate: 78 },
  { id: 29, name: 'Aisya Irdina',      year: 2, class: 'Pandai',  age: 8, gender: 'F', parent: 'Puan Irdina',     parentEmail: 'irdina@email.com',    parentPhone: '016-7711014', faceRegistered: true,  attendanceRate: 89 },
  { id: 30, name: 'Luqman Nul Hakim',  year: 2, class: 'Pandai',  age: 8, gender: 'M', parent: 'Encik Luqman',    parentEmail: 'luqman@email.com',    parentPhone: '017-7711015', faceRegistered: true,  attendanceRate: 83 },

  // ─── Year 3 ────────────────────────────────────────────────
  // Bestari
  { id: 31, name: 'Haris Afiq',        year: 3, class: 'Bestari', age: 9, gender: 'M', parent: 'Encik Afiq',      parentEmail: 'afiq@email.com',      parentPhone: '012-7722001', faceRegistered: true,  attendanceRate: 95 },
  { id: 32, name: 'Nur Aqilah',        year: 3, class: 'Bestari', age: 9, gender: 'F', parent: 'Puan Aqilah',     parentEmail: 'aqilah@email.com',    parentPhone: '013-7722002', faceRegistered: true,  attendanceRate: 92 },
  { id: 33, name: 'Imran Faiz',        year: 3, class: 'Bestari', age: 9, gender: 'M', parent: 'Encik Faiz',      parentEmail: 'faiz@email.com',      parentPhone: '014-7722003', faceRegistered: true,  attendanceRate: 89 },
  // Bijak
  { id: 34, name: 'Balqis Amani',      year: 3, class: 'Bijak',   age: 9, gender: 'F', parent: 'Puan Amani',      parentEmail: 'amani@email.com',     parentPhone: '015-7722004', faceRegistered: false, attendanceRate: 86 },
  { id: 35, name: 'Qayyum Rizqi',      year: 3, class: 'Bijak',   age: 9, gender: 'M', parent: 'Encik Rizqi',     parentEmail: 'rizqi@email.com',     parentPhone: '016-7722005', faceRegistered: true,  attendanceRate: 91 },
  { id: 36, name: 'Dhia Batrisyia',    year: 3, class: 'Bijak',   age: 9, gender: 'F', parent: 'Puan Dhia',       parentEmail: 'dhia@email.com',      parentPhone: '017-7722006', faceRegistered: true,  attendanceRate: 94 },
  // Cerdik
  { id: 37, name: 'Amirul Hazwan',     year: 3, class: 'Cerdik',  age: 9, gender: 'M', parent: 'Encik Hazwan',    parentEmail: 'hazwan@email.com',    parentPhone: '018-7722007', faceRegistered: true,  attendanceRate: 88 },
  { id: 38, name: 'Fatin Najwa',       year: 3, class: 'Cerdik',  age: 9, gender: 'F', parent: 'Puan Najwa',      parentEmail: 'najwa@email.com',     parentPhone: '019-7722008', faceRegistered: true,  attendanceRate: 97 },
  { id: 39, name: 'Syafiq Nabil',      year: 3, class: 'Cerdik',  age: 9, gender: 'M', parent: 'Encik Nabil',     parentEmail: 'nabil@email.com',     parentPhone: '011-7722009', faceRegistered: false, attendanceRate: 82 },
  // Cerdas
  { id: 40, name: 'Yasmin Adriana',    year: 3, class: 'Cerdas',  age: 9, gender: 'F', parent: 'Puan Adriana',    parentEmail: 'adriana@email.com',   parentPhone: '012-7722010', faceRegistered: true,  attendanceRate: 96 },
  { id: 41, name: 'Azlan Haiqal',      year: 3, class: 'Cerdas',  age: 9, gender: 'M', parent: 'Encik Haiqal',    parentEmail: 'haiqal@email.com',    parentPhone: '013-7722011', faceRegistered: true,  attendanceRate: 90 },
  { id: 42, name: 'Insyirah Damia',    year: 3, class: 'Cerdas',  age: 9, gender: 'F', parent: 'Puan Damia',      parentEmail: 'damia@email.com',     parentPhone: '014-7722012', faceRegistered: true,  attendanceRate: 87 },
  // Pandai
  { id: 43, name: 'Muaz Wafiq',        year: 3, class: 'Pandai',  age: 9, gender: 'M', parent: 'Encik Wafiq',     parentEmail: 'wafiq@email.com',     parentPhone: '015-7722013', faceRegistered: true,  attendanceRate: 93 },
  { id: 44, name: 'Nur Athirah',       year: 3, class: 'Pandai',  age: 9, gender: 'F', parent: 'Puan Athirah',    parentEmail: 'athirah@email.com',   parentPhone: '016-7722014', faceRegistered: false, attendanceRate: 79 },
  { id: 45, name: 'Hafiz Irfan',       year: 3, class: 'Pandai',  age: 9, gender: 'M', parent: 'Encik Hafiz',     parentEmail: 'hafizp@email.com',    parentPhone: '017-7722015', faceRegistered: true,  attendanceRate: 85 },

  // ─── Year 4 ────────────────────────────────────────────────
  // Bestari
  { id: 46, name: 'Amsyar Rizwan',     year: 4, class: 'Bestari', age: 10, gender: 'M', parent: 'Encik Rizwan',    parentEmail: 'rizwan@email.com',    parentPhone: '012-7733001', faceRegistered: true,  attendanceRate: 91 },
  { id: 47, name: 'Qistina Raihana',   year: 4, class: 'Bestari', age: 10, gender: 'F', parent: 'Puan Raihana',    parentEmail: 'raihana@email.com',   parentPhone: '013-7733002', faceRegistered: true,  attendanceRate: 95 },
  { id: 48, name: 'Uwais Hadif',       year: 4, class: 'Bestari', age: 10, gender: 'M', parent: 'Encik Hadif',     parentEmail: 'hadif@email.com',     parentPhone: '014-7733003', faceRegistered: true,  attendanceRate: 88 },
  // Bijak
  { id: 49, name: 'Alif Syazwan',      year: 4, class: 'Bijak',   age: 10, gender: 'M', parent: 'Encik Syazwan',   parentEmail: 'syazwan@email.com',   parentPhone: '015-7733004', faceRegistered: false, attendanceRate: 84 },
  { id: 50, name: 'Siti Khadijah',     year: 4, class: 'Bijak',   age: 10, gender: 'F', parent: 'Puan Khadijah',   parentEmail: 'khadijah@email.com',  parentPhone: '016-7733005', faceRegistered: true,  attendanceRate: 92 },
  { id: 51, name: 'Darwisy Aqmal',     year: 4, class: 'Bijak',   age: 10, gender: 'M', parent: 'Encik Aqmal',     parentEmail: 'aqmal@email.com',     parentPhone: '017-7733006', faceRegistered: true,  attendanceRate: 90 },
  // Cerdik
  { id: 52, name: 'Nur Farahiyah',     year: 4, class: 'Cerdik',  age: 10, gender: 'F', parent: 'Puan Farahiyah',  parentEmail: 'farahiyah@email.com', parentPhone: '018-7733007', faceRegistered: true,  attendanceRate: 96 },
  { id: 53, name: 'Izzul Hakim',       year: 4, class: 'Cerdik',  age: 10, gender: 'M', parent: 'Encik Izzul',     parentEmail: 'izzul@email.com',     parentPhone: '019-7733008', faceRegistered: true,  attendanceRate: 87 },
  { id: 54, name: 'Adlina Safwan',     year: 4, class: 'Cerdik',  age: 10, gender: 'F', parent: 'Puan Safwan',     parentEmail: 'safwan@email.com',    parentPhone: '011-7733009', faceRegistered: false, attendanceRate: 93 },
  // Cerdas
  { id: 55, name: 'Naufal Azhari',     year: 4, class: 'Cerdas',  age: 10, gender: 'M', parent: 'Encik Azhari',    parentEmail: 'azhari@email.com',    parentPhone: '012-7733010', faceRegistered: true,  attendanceRate: 89 },
  { id: 56, name: 'Iman Qalesya',      year: 4, class: 'Cerdas',  age: 10, gender: 'F', parent: 'Puan Qalesya',    parentEmail: 'qalesya@email.com',   parentPhone: '013-7733011', faceRegistered: true,  attendanceRate: 95 },
  { id: 57, name: 'Adham Fitri',       year: 4, class: 'Cerdas',  age: 10, gender: 'M', parent: 'Encik Fitri',     parentEmail: 'fitri@email.com',     parentPhone: '014-7733012', faceRegistered: true,  attendanceRate: 86 },
  // Pandai
  { id: 58, name: 'Zara Umairah',      year: 4, class: 'Pandai',  age: 10, gender: 'F', parent: 'Puan Umairah',    parentEmail: 'umairah@email.com',   parentPhone: '015-7733013', faceRegistered: true,  attendanceRate: 91 },
  { id: 59, name: 'Harraz Zikri',      year: 4, class: 'Pandai',  age: 10, gender: 'M', parent: 'Encik Zikri',     parentEmail: 'zikri@email.com',     parentPhone: '016-7733014', faceRegistered: false, attendanceRate: 77 },
  { id: 60, name: 'Aleesya Batrisyia', year: 4, class: 'Pandai',  age: 10, gender: 'F', parent: 'Puan Aleesya',    parentEmail: 'aleesya@email.com',   parentPhone: '017-7733015', faceRegistered: true,  attendanceRate: 88 },

  // ─── Year 5 ────────────────────────────────────────────────
  // Bestari
  { id: 61, name: 'Danial Hakim',      year: 5, class: 'Bestari', age: 11, gender: 'M', parent: 'Encik Hakim B',   parentEmail: 'hakimb@email.com',    parentPhone: '012-7744001', faceRegistered: true,  attendanceRate: 94 },
  { id: 62, name: 'Puteri Aisya',      year: 5, class: 'Bestari', age: 11, gender: 'F', parent: 'Puan Aisya',      parentEmail: 'aisya@email.com',     parentPhone: '013-7744002', faceRegistered: true,  attendanceRate: 97 },
  { id: 63, name: 'Amir Hamzah',       year: 5, class: 'Bestari', age: 11, gender: 'M', parent: 'Encik Hamzah',    parentEmail: 'hamzah@email.com',    parentPhone: '014-7744003', faceRegistered: true,  attendanceRate: 90 },
  // Bijak
  { id: 64, name: 'Nadia Syafiqah',    year: 5, class: 'Bijak',   age: 11, gender: 'F', parent: 'Puan Syafiqah',   parentEmail: 'syafiqah@email.com',  parentPhone: '015-7744004', faceRegistered: true,  attendanceRate: 92 },
  { id: 65, name: 'Aqil Darwish',      year: 5, class: 'Bijak',   age: 11, gender: 'M', parent: 'Encik Darwish',   parentEmail: 'darwish@email.com',   parentPhone: '016-7744005', faceRegistered: false, attendanceRate: 83 },
  { id: 66, name: 'Husna Qamarina',    year: 5, class: 'Bijak',   age: 11, gender: 'F', parent: 'Puan Qamarina',   parentEmail: 'qamarina@email.com',  parentPhone: '017-7744006', faceRegistered: true,  attendanceRate: 95 },
  // Cerdik
  { id: 67, name: 'Zarif Imran',       year: 5, class: 'Cerdik',  age: 11, gender: 'M', parent: 'Encik Imran',     parentEmail: 'imran@email.com',     parentPhone: '018-7744007', faceRegistered: true,  attendanceRate: 87 },
  { id: 68, name: 'Ain Sofea',         year: 5, class: 'Cerdik',  age: 11, gender: 'F', parent: 'Puan Sofea',      parentEmail: 'sofea@email.com',     parentPhone: '019-7744008', faceRegistered: true,  attendanceRate: 96 },
  { id: 69, name: 'Firdaus Syahmi',    year: 5, class: 'Cerdik',  age: 11, gender: 'M', parent: 'Encik Syahmi B',  parentEmail: 'syahmib@email.com',   parentPhone: '011-7744009', faceRegistered: false, attendanceRate: 81 },
  // Cerdas
  { id: 70, name: 'Nurin Jazlina',     year: 5, class: 'Cerdas',  age: 11, gender: 'F', parent: 'Puan Jazlina',    parentEmail: 'jazlina@email.com',   parentPhone: '012-7744010', faceRegistered: true,  attendanceRate: 93 },
  { id: 71, name: 'Ashraf Hariz',      year: 5, class: 'Cerdas',  age: 11, gender: 'M', parent: 'Encik Hariz B',   parentEmail: 'harizb@email.com',    parentPhone: '013-7744011', faceRegistered: true,  attendanceRate: 89 },
  { id: 72, name: 'Syahirah Amani',    year: 5, class: 'Cerdas',  age: 11, gender: 'F', parent: 'Puan Amani B',    parentEmail: 'amanib@email.com',    parentPhone: '014-7744012', faceRegistered: true,  attendanceRate: 91 },
  // Pandai
  { id: 73, name: 'Rizqi Azfar',       year: 5, class: 'Pandai',  age: 11, gender: 'M', parent: 'Encik Azfar',     parentEmail: 'azfar@email.com',     parentPhone: '015-7744013', faceRegistered: true,  attendanceRate: 86 },
  { id: 74, name: 'Dina Farzana',      year: 5, class: 'Pandai',  age: 11, gender: 'F', parent: 'Puan Farzana',    parentEmail: 'farzana@email.com',   parentPhone: '016-7744014', faceRegistered: false, attendanceRate: 74 },
  { id: 75, name: 'Wafiq Anuar',       year: 5, class: 'Pandai',  age: 11, gender: 'M', parent: 'Encik Anuar',     parentEmail: 'anuar@email.com',     parentPhone: '017-7744015', faceRegistered: true,  attendanceRate: 90 },

  // ─── Year 6 ────────────────────────────────────────────────
  // Bestari
  { id: 76, name: 'Hakim Zafran',      year: 6, class: 'Bestari', age: 12, gender: 'M', parent: 'Encik Zafran',    parentEmail: 'zafran@email.com',    parentPhone: '012-7755001', faceRegistered: true,  attendanceRate: 92 },
  { id: 77, name: 'Amira Syahindah',   year: 6, class: 'Bestari', age: 12, gender: 'F', parent: 'Puan Syahindah',  parentEmail: 'syahindah@email.com', parentPhone: '013-7755002', faceRegistered: true,  attendanceRate: 98 },
  { id: 78, name: 'Fahmi Amsyar',      year: 6, class: 'Bestari', age: 12, gender: 'M', parent: 'Encik Amsyar',    parentEmail: 'amsyar@email.com',    parentPhone: '014-7755003', faceRegistered: true,  attendanceRate: 87 },
  // Bijak
  { id: 79, name: 'Sarah Nabilah',     year: 6, class: 'Bijak',   age: 12, gender: 'F', parent: 'Puan Nabilah',    parentEmail: 'nabilah@email.com',   parentPhone: '015-7755004', faceRegistered: true,  attendanceRate: 94 },
  { id: 80, name: 'Aizat Haiqal',      year: 6, class: 'Bijak',   age: 12, gender: 'M', parent: 'Encik Haiqal B',  parentEmail: 'haiqalb@email.com',   parentPhone: '016-7755005', faceRegistered: false, attendanceRate: 85 },
  { id: 81, name: 'Batrisyia Izzah',   year: 6, class: 'Bijak',   age: 12, gender: 'F', parent: 'Puan Izzah',      parentEmail: 'izzah@email.com',     parentPhone: '017-7755006', faceRegistered: true,  attendanceRate: 91 },
  // Cerdik
  { id: 82, name: 'Naqib Umar',        year: 6, class: 'Cerdik',  age: 12, gender: 'M', parent: 'Encik Umar',      parentEmail: 'umar@email.com',      parentPhone: '018-7755007', faceRegistered: true,  attendanceRate: 88 },
  { id: 83, name: 'Maryam Insyirah',   year: 6, class: 'Cerdik',  age: 12, gender: 'F', parent: 'Puan Insyirah',   parentEmail: 'insyirah@email.com',  parentPhone: '019-7755008', faceRegistered: true,  attendanceRate: 96 },
  { id: 84, name: 'Zulhilmi Azman',    year: 6, class: 'Cerdik',  age: 12, gender: 'M', parent: 'Encik Azman',     parentEmail: 'azman@email.com',     parentPhone: '011-7755009', faceRegistered: false, attendanceRate: 79 },
  // Cerdas
  { id: 85, name: 'Afiqah Damia',      year: 6, class: 'Cerdas',  age: 12, gender: 'F', parent: 'Puan Damia B',    parentEmail: 'damiab@email.com',    parentPhone: '012-7755010', faceRegistered: true,  attendanceRate: 93 },
  { id: 86, name: 'Syamil Aidil',      year: 6, class: 'Cerdas',  age: 12, gender: 'M', parent: 'Encik Aidil',     parentEmail: 'aidil@email.com',     parentPhone: '013-7755011', faceRegistered: true,  attendanceRate: 90 },
  { id: 87, name: 'Nurhanani Aqilah',  year: 6, class: 'Cerdas',  age: 12, gender: 'F', parent: 'Puan Aqilah B',   parentEmail: 'aqilahb@email.com',   parentPhone: '014-7755012', faceRegistered: true,  attendanceRate: 86 },
  // Pandai
  { id: 88, name: 'Luqman Afif',       year: 6, class: 'Pandai',  age: 12, gender: 'M', parent: 'Encik Afif',      parentEmail: 'afif@email.com',      parentPhone: '015-7755013', faceRegistered: true,  attendanceRate: 91 },
  { id: 89, name: 'Aqeela Zahra',      year: 6, class: 'Pandai',  age: 12, gender: 'F', parent: 'Puan Zahra',      parentEmail: 'zahra@email.com',     parentPhone: '016-7755014', faceRegistered: false, attendanceRate: 75 },
  { id: 90, name: 'Fikri Afdhal',      year: 6, class: 'Pandai',  age: 12, gender: 'M', parent: 'Encik Afdhal',    parentEmail: 'afdhal@email.com',    parentPhone: '017-7755015', faceRegistered: true,  attendanceRate: 84 },
];

// ── Users (teachers, admin, assistant) ───────────────────────
export const users = [
  // Homeroom teachers  --  one per year x class  (30 total)
  // Year 1 (keep originals)
  { id: 1,  name: 'Cikgu Fatimah',   email: 'fatimah@prismai.edu',   role: 'homeroom', year: 1, class: 'Bestari', subject: null, years: null, status: 'active' },
  { id: 2,  name: 'Cikgu Noraini',   email: 'noraini@prismai.edu',   role: 'homeroom', year: 1, class: 'Bijak',   subject: null, years: null, status: 'active' },
  { id: 3,  name: 'Cikgu Zainab',    email: 'zainab@prismai.edu',    role: 'homeroom', year: 1, class: 'Cerdik',  subject: null, years: null, status: 'active' },
  { id: 4,  name: 'Cikgu Liyana',    email: 'liyana@prismai.edu',    role: 'homeroom', year: 1, class: 'Cerdas',  subject: null, years: null, status: 'active' },
  { id: 5,  name: 'Cikgu Aishah',    email: 'aishah@prismai.edu',    role: 'homeroom', year: 1, class: 'Pandai',  subject: null, years: null, status: 'active' },
  // Year 2
  { id: 6,  name: 'Cikgu Salina',    email: 'salina@prismai.edu',    role: 'homeroom', year: 2, class: 'Bestari', subject: null, years: null, status: 'active' },
  { id: 7,  name: 'Cikgu Halimah',   email: 'halimah@prismai.edu',   role: 'homeroom', year: 2, class: 'Bijak',   subject: null, years: null, status: 'active' },
  { id: 8,  name: 'Cikgu Rohani',    email: 'rohani@prismai.edu',    role: 'homeroom', year: 2, class: 'Cerdik',  subject: null, years: null, status: 'active' },
  { id: 9,  name: 'Cikgu Maziah',    email: 'maziah@prismai.edu',    role: 'homeroom', year: 2, class: 'Cerdas',  subject: null, years: null, status: 'active' },
  { id: 10, name: 'Cikgu Jamilah',   email: 'jamilah@prismai.edu',   role: 'homeroom', year: 2, class: 'Pandai',  subject: null, years: null, status: 'active' },
  // Year 3
  { id: 11, name: 'Cikgu Rashidah',  email: 'rashidah@prismai.edu',  role: 'homeroom', year: 3, class: 'Bestari', subject: null, years: null, status: 'active' },
  { id: 12, name: 'Cikgu Normala',   email: 'normala@prismai.edu',   role: 'homeroom', year: 3, class: 'Bijak',   subject: null, years: null, status: 'active' },
  { id: 13, name: 'Cikgu Kamariah',  email: 'kamariah@prismai.edu',  role: 'homeroom', year: 3, class: 'Cerdik',  subject: null, years: null, status: 'active' },
  { id: 14, name: 'Cikgu Azizah',    email: 'azizah@prismai.edu',    role: 'homeroom', year: 3, class: 'Cerdas',  subject: null, years: null, status: 'active' },
  { id: 15, name: 'Cikgu Norsiah',   email: 'norsiah@prismai.edu',   role: 'homeroom', year: 3, class: 'Pandai',  subject: null, years: null, status: 'active' },
  // Year 4
  { id: 16, name: 'Cikgu Hasnah',    email: 'hasnah@prismai.edu',    role: 'homeroom', year: 4, class: 'Bestari', subject: null, years: null, status: 'active' },
  { id: 17, name: 'Cikgu Saripah',   email: 'saripah@prismai.edu',   role: 'homeroom', year: 4, class: 'Bijak',   subject: null, years: null, status: 'active' },
  { id: 18, name: 'Cikgu Ramlah',    email: 'ramlah@prismai.edu',    role: 'homeroom', year: 4, class: 'Cerdik',  subject: null, years: null, status: 'active' },
  { id: 19, name: 'Cikgu Fauziah',   email: 'fauziah@prismai.edu',   role: 'homeroom', year: 4, class: 'Cerdas',  subject: null, years: null, status: 'active' },
  { id: 20, name: 'Cikgu Zaleha',    email: 'zaleha@prismai.edu',    role: 'homeroom', year: 4, class: 'Pandai',  subject: null, years: null, status: 'active' },
  // Year 5
  { id: 21, name: 'Cikgu Suraya',    email: 'suraya@prismai.edu',    role: 'homeroom', year: 5, class: 'Bestari', subject: null, years: null, status: 'active' },
  { id: 22, name: 'Cikgu Wan Nora',  email: 'wannora@prismai.edu',   role: 'homeroom', year: 5, class: 'Bijak',   subject: null, years: null, status: 'active' },
  { id: 23, name: 'Cikgu Rubiah',    email: 'rubiah@prismai.edu',    role: 'homeroom', year: 5, class: 'Cerdik',  subject: null, years: null, status: 'active' },
  { id: 24, name: 'Cikgu Sharifah',  email: 'sharifah@prismai.edu',  role: 'homeroom', year: 5, class: 'Cerdas',  subject: null, years: null, status: 'active' },
  { id: 25, name: 'Cikgu Latifah',   email: 'latifah@prismai.edu',   role: 'homeroom', year: 5, class: 'Pandai',  subject: null, years: null, status: 'active' },
  // Year 6
  { id: 26, name: 'Cikgu Habibah',   email: 'habibah@prismai.edu',   role: 'homeroom', year: 6, class: 'Bestari', subject: null, years: null, status: 'active' },
  { id: 27, name: 'Cikgu Rokiah',    email: 'rokiah@prismai.edu',    role: 'homeroom', year: 6, class: 'Bijak',   subject: null, years: null, status: 'active' },
  { id: 28, name: 'Cikgu Mariam',    email: 'mariam@prismai.edu',    role: 'homeroom', year: 6, class: 'Cerdik',  subject: null, years: null, status: 'active' },
  { id: 29, name: 'Cikgu Asmah',     email: 'asmah@prismai.edu',     role: 'homeroom', year: 6, class: 'Cerdas',  subject: null, years: null, status: 'active' },
  { id: 30, name: 'Cikgu Rosminah',  email: 'rosminah@prismai.edu',  role: 'homeroom', year: 6, class: 'Pandai',  subject: null, years: null, status: 'active' },

  // Subject teachers  --  2 per subject (Year 1-3, Year 4-6)  (12 total)
  { id: 31, name: 'Cikgu Hafiz',     email: 'hafiz.s@prismai.edu',   role: 'subject', year: null, class: null, subject: 'eng', years: [1, 2, 3], status: 'active' },
  { id: 32, name: 'Cikgu Kamarul',   email: 'kamarul@prismai.edu',   role: 'subject', year: null, class: null, subject: 'eng', years: [4, 5, 6], status: 'active' },
  { id: 33, name: 'Cikgu Saadiah',   email: 'saadiah@prismai.edu',   role: 'subject', year: null, class: null, subject: 'bm',  years: [1, 2, 3], status: 'active' },
  { id: 34, name: 'Cikgu Lokman',    email: 'lokman@prismai.edu',    role: 'subject', year: null, class: null, subject: 'bm',  years: [4, 5, 6], status: 'active' },
  { id: 35, name: 'Cikgu Rizal',     email: 'rizal@prismai.edu',     role: 'subject', year: null, class: null, subject: 'mat', years: [1, 2, 3], status: 'active' },
  { id: 36, name: 'Cikgu Norazlina', email: 'norazlina@prismai.edu', role: 'subject', year: null, class: null, subject: 'mat', years: [4, 5, 6], status: 'active' },
  { id: 37, name: 'Cikgu Syukri',    email: 'syukri@prismai.edu',    role: 'subject', year: null, class: null, subject: 'sci', years: [1, 2, 3], status: 'active' },
  { id: 38, name: 'Cikgu Badriah',   email: 'badriah@prismai.edu',   role: 'subject', year: null, class: null, subject: 'sci', years: [4, 5, 6], status: 'active' },
  { id: 39, name: 'Ustaz Ismail',    email: 'ismail@prismai.edu',    role: 'subject', year: null, class: null, subject: 'pi',  years: [1, 2, 3], status: 'active' },
  { id: 40, name: 'Ustazah Hamidah', email: 'hamidah@prismai.edu',   role: 'subject', year: null, class: null, subject: 'pi',  years: [4, 5, 6], status: 'active' },
  { id: 41, name: 'Cikgu Pavithra',  email: 'pavithra@prismai.edu',  role: 'subject', year: null, class: null, subject: 'pm',  years: [1, 2, 3], status: 'active' },
  { id: 42, name: 'Cikgu Rajesh',    email: 'rajesh@prismai.edu',    role: 'subject', year: null, class: null, subject: 'pm',  years: [4, 5, 6], status: 'active' },

  // Admin + assistant
  { id: 43, name: 'Admin Hafiz',     email: 'hafiz@prismai.edu',     role: 'admin',     year: null, class: null, subject: null, years: null, status: 'active' },
  { id: 44, name: 'Kak Rina',        email: 'rina@prismai.edu',      role: 'assistant', year: null, class: null, subject: null, years: null, status: 'active' },
];

// ── Attendance Today  (90 records) ───────────────────────────
// Deterministic status assignment using student ID as seed
function assignTodayStatus(student) {
  // Simple hash: use student ID to deterministically pick status
  const seed = (student.id * 7 + 13) % 100;
  let status, timeIn;

  if (seed < 75) {
    status = 'present';
    // Spread arrival times between 07:20 and 07:55
    const minuteOffset = ((student.id * 3 + 5) % 36); // 0-35
    const hour = 7;
    const minute = 20 + minuteOffset;
    const displayMin = minute < 60 ? minute : minute - 60;
    const displayHour = minute < 60 ? hour : hour + 1;
    const ampm = displayHour < 12 ? 'AM' : 'PM';
    timeIn = `${String(displayHour).padStart(2, '0')}:${String(displayMin).padStart(2, '0')} ${ampm}`;
  } else if (seed < 90) {
    status = 'late';
    const minuteOffset = ((student.id * 5 + 2) % 26); // 0-25
    const minute = 5 + minuteOffset;
    timeIn = `08:${String(minute).padStart(2, '0')} AM`;
  } else {
    status = 'absent';
    timeIn = '-';
  }

  return { status, timeIn };
}

// Override Year 1 Bestari to keep original statuses
const todayOverrides = {
  1: { status: 'present', timeIn: '07:45 AM' },  // Ahmad Irfan
  2: { status: 'present', timeIn: '07:50 AM' },  // Nur Aisyah
  3: { status: 'present', timeIn: '07:48 AM' },  // Adam Mikail
};

export const attendanceToday = students.map(s => {
  const override = todayOverrides[s.id];
  const { status, timeIn } = override || assignTodayStatus(s);
  return {
    studentId: s.id,
    name: s.name,
    year: s.year,
    class: s.class,
    status,
    timeIn,
    timeOut: '-',
  };
});

// ── Class Attendance  (30 records: per year x class) ─────────
export const classAttendance = (() => {
  const result = [];
  for (const yr of years) {
    for (const cls of classes) {
      const classStudents = attendanceToday.filter(a => a.year === yr && a.class === cls);
      result.push({
        year: yr,
        class: cls,
        total: classStudents.length,
        present: classStudents.filter(a => a.status === 'present').length,
        absent:  classStudents.filter(a => a.status === 'absent').length,
        late:    classStudents.filter(a => a.status === 'late').length,
      });
    }
  }
  return result;
})();

// ── Weekly Attendance (school-wide aggregate, ~90/day) ───────
export const weeklyAttendance = [
  { day: 'Mon', present: 78, absent: 6,  late: 6 },
  { day: 'Tue', present: 75, absent: 8,  late: 7 },
  { day: 'Wed', present: 80, absent: 5,  late: 5 },
  { day: 'Thu', present: 82, absent: 4,  late: 4 },
  { day: 'Fri', present: 72, absent: 10, late: 8 },
];

// ── Monthly Attendance (12 months, scaled to 90 students) ────
// ~22 school days/month, 90 students = ~1980 student-days/month
export const monthlyAttendance = [
  { month: 'Jan',  present: 1782, absent: 119, late: 79  },
  { month: 'Feb',  present: 1744, absent: 138, late: 98  },
  { month: 'Mar',  present: 1801, absent: 99,  late: 80  },
  { month: 'Apr',  present: 1762, absent: 128, late: 90  },
  { month: 'May',  present: 1790, absent: 108, late: 82  },
  { month: 'Jun',  present: 1720, absent: 160, late: 100 },
  { month: 'Jul',  present: 1810, absent: 95,  late: 75  },
  { month: 'Aug',  present: 1795, absent: 105, late: 80  },
  { month: 'Sep',  present: 1770, absent: 120, late: 90  },
  { month: 'Oct',  present: 1815, absent: 90,  late: 75  },
  { month: 'Nov',  present: 1780, absent: 115, late: 85  },
  { month: 'Dec',  present: 1700, absent: 170, late: 110 },
];

// ── Daily Arrival Times (scaled to 90 students) ─────────────
export const dailyArrivalTimes = [
  { time: '07:00', count: 0  },
  { time: '07:10', count: 3  },
  { time: '07:15', count: 5  },
  { time: '07:20', count: 8  },
  { time: '07:25', count: 10 },
  { time: '07:30', count: 14 },
  { time: '07:35', count: 12 },
  { time: '07:40', count: 10 },
  { time: '07:45', count: 8  },
  { time: '07:50', count: 6  },
  { time: '07:55', count: 4  },
  { time: '08:00', count: 0  },
  { time: '08:05', count: 3  },
  { time: '08:10', count: 3  },
  { time: '08:15', count: 2  },
  { time: '08:20', count: 1  },
  { time: '08:25', count: 1  },
  { time: '08:30', count: 0  },
];

// ── Attendance History (30-day, deterministic per student) ────
function generateAttendanceHistory(studentList) {
  const history = {};
  // Base date: 2026-05-11 (today). Go back 30 calendar days.
  const baseDate = new Date(2026, 4, 11); // May 11, 2026

  // Simple deterministic pseudo-random using student ID + day offset
  function seededValue(studentId, dayOffset, salt) {
    return ((studentId * 131 + dayOffset * 97 + salt * 53) % 1000) / 1000;
  }

  for (const student of studentList) {
    const records = [];
    for (let d = 1; d <= 30; d++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - d);

      // Skip weekends (0 = Sunday, 6 = Saturday)
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;

      const dateStr = date.toISOString().split('T')[0];
      const rand = seededValue(student.id, d, 7);

      // Map attendanceRate to per-day probability
      // If attendanceRate is 94, ~94% present, ~3% late, ~3% absent
      const presentThreshold = student.attendanceRate / 100;
      const lateThreshold = presentThreshold + (1 - presentThreshold) * 0.5;

      let status, timeIn;
      if (rand < presentThreshold) {
        status = 'present';
        const minOffset = Math.floor(seededValue(student.id, d, 19) * 36); // 0-35
        const min = 20 + minOffset;
        timeIn = `07:${String(min).padStart(2, '0')} AM`;
      } else if (rand < lateThreshold) {
        status = 'late';
        const minOffset = Math.floor(seededValue(student.id, d, 31) * 26); // 0-25
        const min = 5 + minOffset;
        timeIn = `08:${String(min).padStart(2, '0')} AM`;
      } else {
        status = 'absent';
        timeIn = '-';
      }

      records.push({ date: dateStr, status, timeIn });
    }
    history[student.id] = records;
  }
  return history;
}

export const attendanceHistory = generateAttendanceHistory(students);

// ── Notifications ────────────────────────────────────────────
export const notifications = [
  { id: 1,  type: 'alert',   message: 'Arif Zulkifli (Year 1 Pandai) marked absent',                 time: '8:30 AM', read: false },
  { id: 2,  type: 'warning', message: 'Muhammad Danish (Year 1 Bijak) arrived late at 8:12 AM',       time: '8:12 AM', read: false },
  { id: 3,  type: 'alert',   message: 'Sofea Mariam (Year 1 Bijak) marked absent',                    time: '8:30 AM', read: false },
  { id: 4,  type: 'info',    message: 'Unrecognized face detected at main entrance',                   time: '8:05 AM', read: false },
  { id: 5,  type: 'warning', message: 'Hazim Syahmi (Year 2 Pandai) arrived late at 8:17 AM',         time: '8:17 AM', read: true },
  { id: 6,  type: 'success', message: 'All Year 1 Bestari students present today',                    time: '8:00 AM', read: true },
  { id: 7,  type: 'info',    message: 'AI model accuracy updated to 95.5%',                            time: '7:30 AM', read: true },
  { id: 8,  type: 'warning', message: 'Aqeela Zahra (Year 6 Pandai) arrived late at 8:22 AM',         time: '8:22 AM', read: false },
  { id: 9,  type: 'alert',   message: 'Zulhilmi Azman (Year 6 Cerdik) marked absent',                 time: '8:30 AM', read: false },
  { id: 10, type: 'info',    message: 'Weekly attendance report ready for download',                   time: '9:00 AM', read: true },
];

// ── Recent Activity ──────────────────────────────────────────
export const recentActivity = [
  { id: 1,  user: 'System',         action: 'Ahmad Irfan (Year 1 Bestari) checked in via face recognition',   timestamp: '07:45 AM', type: 'success' },
  { id: 2,  user: 'System',         action: 'Puteri Hana (Year 1 Bijak) checked in via face recognition',     timestamp: '07:30 AM', type: 'success' },
  { id: 3,  user: 'System',         action: 'Hakim Zafran (Year 6 Bestari) checked in via face recognition',  timestamp: '07:32 AM', type: 'success' },
  { id: 4,  user: 'System',         action: 'Unrecognized face detected at main entrance',                    timestamp: '08:05 AM', type: 'info' },
  { id: 5,  user: 'Cikgu Fatimah',  action: 'Marked Arif Zulkifli (Year 1 Pandai) as absent',                timestamp: '08:30 AM', type: 'danger' },
  { id: 6,  user: 'System',         action: 'Muhammad Danish (Year 1 Bijak) checked in (late)',               timestamp: '08:12 AM', type: 'warning' },
  { id: 7,  user: 'System',         action: 'Hazim Syahmi (Year 2 Pandai) checked in (late)',                 timestamp: '08:17 AM', type: 'warning' },
  { id: 8,  user: 'Cikgu Noraini',  action: 'Updated attendance for Sofea Mariam (Year 1 Bijak)',             timestamp: '08:32 AM', type: 'danger' },
  { id: 9,  user: 'Admin Hafiz',    action: 'Generated weekly report for all years',                          timestamp: '09:00 AM', type: 'info' },
  { id: 10, user: 'System',         action: 'Notification sent to Encik Zul (Year 1 Pandai absence alert)',   timestamp: '08:31 AM', type: 'info' },
  { id: 11, user: 'System',         action: 'Aqeela Zahra (Year 6 Pandai) checked in (late)',                 timestamp: '08:22 AM', type: 'warning' },
  { id: 12, user: 'Cikgu Habibah',  action: 'Marked Zulhilmi Azman (Year 6 Cerdik) as absent',               timestamp: '08:30 AM', type: 'danger' },
];

// ── Audit Logs ───────────────────────────────────────────────
export const auditLogs = [
  { id: 1, user: 'Cikgu Fatimah',  action: 'Marked Arif Zulkifli (Year 1 Pandai) as absent',           timestamp: '2026-05-11 08:30 AM', type: 'attendance' },
  { id: 2, user: 'System',         action: 'Face recognition detected Muhammad Danish (Year 1 Bijak) - late', timestamp: '2026-05-11 08:12 AM', type: 'system' },
  { id: 3, user: 'Admin Hafiz',    action: 'Added new student: Fikri Afdhal (Year 6 Pandai)',           timestamp: '2026-05-10 10:00 AM', type: 'user' },
  { id: 4, user: 'System',         action: 'AI model restarted successfully',                            timestamp: '2026-05-10 07:00 AM', type: 'system' },
  { id: 5, user: 'Cikgu Noraini',  action: 'Updated attendance for Puteri Hana (Year 1 Bijak)',         timestamp: '2026-05-09 09:15 AM', type: 'attendance' },
  { id: 6, user: 'Admin Hafiz',    action: 'Updated notification settings for Year 4-6',                timestamp: '2026-05-09 08:00 AM', type: 'user' },
  { id: 7, user: 'System',         action: 'Backup completed successfully',                              timestamp: '2026-05-08 11:00 PM', type: 'system' },
  { id: 8, user: 'Cikgu Zainab',   action: 'Registered face for Irdina Safiya (Year 1 Cerdik)',         timestamp: '2026-05-08 09:30 AM', type: 'user' },
  { id: 9, user: 'Cikgu Habibah',  action: 'Marked Zulhilmi Azman (Year 6 Cerdik) as absent',          timestamp: '2026-05-07 08:35 AM', type: 'attendance' },
  { id: 10, user: 'System',        action: 'Weekly attendance summary generated for all 6 years',       timestamp: '2026-05-07 06:00 AM', type: 'system' },
];

// ── School Events ────────────────────────────────────────────
export const schoolEvents = [
  { id: 1, title: 'Parent-Teacher Meeting',     date: '2026-05-20', type: 'meeting' },
  { id: 2, title: 'Sports Day',                 date: '2026-06-05', type: 'event' },
  { id: 3, title: 'School Holiday - Hari Raya', date: '2026-06-15', type: 'holiday' },
  { id: 4, title: 'Annual Concert',             date: '2026-06-25', type: 'event' },
  { id: 5, title: 'Term 1 Report Card Day',     date: '2026-06-30', type: 'meeting' },
];

// ── AI Model History ─────────────────────────────────────────
export const aiModelHistory = [
  { date: 'Week 1', accuracy: 91.2 },
  { date: 'Week 2', accuracy: 92.8 },
  { date: 'Week 3', accuracy: 93.5 },
  { date: 'Week 4', accuracy: 94.1 },
  { date: 'Week 5', accuracy: 95.0 },
  { date: 'Week 6', accuracy: 95.5 },
];

// ── Parent-Child Data (Ahmad Irfan, Year 1 Bestari) ──────────
export const parentChildData = {
  parent: { name: 'Encik Razak', email: 'razak@email.com', phone: '012-3456789' },
  child:  { name: 'Ahmad Irfan', year: 1, class: 'Bestari', age: 7, gender: 'M', attendanceRate: 94, faceRegistered: true },
  weeklyStats: { present: 4, absent: 0, late: 1, onTimeRate: 80 },
  attendanceHistory: [
    { date: '2026-05-09', status: 'present', timeIn: '07:45 AM', timeOut: '12:00 PM' },
    { date: '2026-05-08', status: 'present', timeIn: '07:50 AM', timeOut: '12:05 PM' },
    { date: '2026-05-07', status: 'late',    timeIn: '08:10 AM', timeOut: '12:00 PM' },
    { date: '2026-05-06', status: 'present', timeIn: '07:40 AM', timeOut: '12:00 PM' },
    { date: '2026-05-05', status: 'present', timeIn: '07:42 AM', timeOut: '12:00 PM' },
    { date: '2026-05-02', status: 'absent',  timeIn: '-',        timeOut: '-' },
    { date: '2026-05-01', status: 'present', timeIn: '07:55 AM', timeOut: '12:10 PM' },
    { date: '2026-04-30', status: 'present', timeIn: '07:35 AM', timeOut: '12:00 PM' },
    { date: '2026-04-29', status: 'present', timeIn: '07:42 AM', timeOut: '12:00 PM' },
    { date: '2026-04-28', status: 'present', timeIn: '07:38 AM', timeOut: '12:05 PM' },
    { date: '2026-04-25', status: 'late',    timeIn: '08:05 AM', timeOut: '12:00 PM' },
    { date: '2026-04-24', status: 'present', timeIn: '07:50 AM', timeOut: '12:00 PM' },
    { date: '2026-04-23', status: 'present', timeIn: '07:30 AM', timeOut: '12:10 PM' },
    { date: '2026-04-22', status: 'present', timeIn: '07:45 AM', timeOut: '12:00 PM' },
  ],
  notifications: [
    { id: 1, message: 'Ahmad Irfan checked in at 07:45 AM',     time: '07:45 AM', date: '2026-05-09' },
    { id: 2, message: 'Ahmad Irfan checked in at 07:50 AM',     time: '07:50 AM', date: '2026-05-08' },
    { id: 3, message: 'Ahmad Irfan arrived late at 08:10 AM',   time: '08:10 AM', date: '2026-05-07' },
    { id: 4, message: 'Ahmad Irfan was absent today',           time: '08:30 AM', date: '2026-05-02' },
    { id: 5, message: 'Ahmad Irfan arrived late at 08:05 AM',   time: '08:05 AM', date: '2026-04-25' },
  ],
  announcements: [
    { id: 1, title: 'Parent-Teacher Meeting',  message: 'Please join us on May 20th for the annual parent-teacher meeting at 10:00 AM.',     date: '2026-05-10' },
    { id: 2, title: 'Sports Day Preparation',  message: 'Students are required to bring sports attire starting next week for practice.',      date: '2026-05-05' },
    { id: 3, title: 'Hari Raya Holiday',       message: 'School will be closed from June 15-18 for Hari Raya celebrations.',                 date: '2026-05-01' },
  ],
};
