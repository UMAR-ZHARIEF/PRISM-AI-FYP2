/**
 * PRISM-AI — Assign 30 Classes across 15 Teachers with Multiple Classes
 *
 * Randomly selects 15 teachers and distributes all 30 class sections among them.
 * Some teachers will have 4 classes, some 3 classes, some 2 classes, etc.
 */

const path = require('path');
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const { createClient } = require(path.join(__dirname, '../server/node_modules/@supabase/supabase-js'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Error: SUPABASE_URL or SUPABASE_SECRET_KEY missing in server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fisher-Yates shuffle
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate an array of 15 integers summing to 30, with values in [1, 4],
// ensuring at least one 4, at least one 3, and at least one 2.
function generateClassDistribution(totalClasses = 30, numTeachers = 15) {
  while (true) {
    const counts = new Array(numTeachers).fill(1);
    let remaining = totalClasses - numTeachers; // 15 left to give out

    while (remaining > 0) {
      const idx = Math.floor(Math.random() * numTeachers);
      if (counts[idx] < 4) {
        counts[idx]++;
        remaining--;
      }
    }

    const has4 = counts.some(c => c === 4);
    const has3 = counts.some(c => c === 3);
    const has2 = counts.some(c => c === 2);

    if (has4 && has3 && has2) {
      // Sort in descending order or shuffle
      return shuffle(counts);
    }
  }
}

async function run() {
  console.log('🔄 Fetching class sections, teachers, and auth emails from Supabase...\n');

  // 1. Fetch all class sections
  const { data: sections, error: sErr } = await supabase
    .from('class_sections')
    .select('id, year_num, name, homeroom_teacher_id')
    .order('year_num', { ascending: true })
    .order('name', { ascending: true });

  if (sErr || !sections || sections.length === 0) {
    console.error('Failed to fetch class_sections:', sErr?.message);
    process.exit(1);
  }

  // 2. Fetch all teacher profiles
  const { data: teachers, error: tErr } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'teacher');

  if (tErr || !teachers || teachers.length < 15) {
    console.error(`Not enough teachers (${teachers?.length}) found. Need at least 15.`);
    process.exit(1);
  }

  // 3. Fetch user emails from auth
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const emailById = {};
  if (!uErr && users) {
    users.forEach(u => { emailById[u.id] = u.email; });
  }

  console.log(`Found ${sections.length} classes and ${teachers.length} teachers.`);

  // 4. Randomly pick 15 teachers
  const shuffledTeachers = shuffle(teachers);
  const selected15Teachers = shuffledTeachers.slice(0, 15);

  // 5. Generate distribution of classes (e.g. 4s, 3s, 2s, 1s)
  const distribution = generateClassDistribution(sections.length, 15);
  console.log('Class count distribution across the 15 teachers:', distribution.join(', '));

  // 6. Shuffle sections so classes are assigned randomly across years and names
  const shuffledSections = shuffle(sections);

  // 7. Assign sections to teachers
  const assignments = []; // { teacher, classes: [] }
  let sectionIndex = 0;

  for (let i = 0; i < selected15Teachers.length; i++) {
    const teacher = selected15Teachers[i];
    const count = distribution[i];
    const assignedClasses = shuffledSections.slice(sectionIndex, sectionIndex + count);
    sectionIndex += count;

    assignments.push({
      teacher,
      email: emailById[teacher.id] || '(unknown)',
      classes: assignedClasses,
    });
  }

  console.log('\n📝 Updating database assignments in Supabase...\n');

  for (const item of assignments) {
    for (const cls of item.classes) {
      const { error: updateErr } = await supabase
        .from('class_sections')
        .update({ homeroom_teacher_id: item.teacher.id })
        .eq('id', cls.id);

      if (updateErr) {
        console.error(`Failed to assign class ${cls.year_num} ${cls.name} to ${item.teacher.full_name}:`, updateErr.message);
      }
    }
  }

  console.log('✅ Successfully assigned all 30 classes across 15 teachers!\n');
  console.log('=== ASSIGNMENT SUMMARY ===\n');

  // Sort assignments: teachers with most classes first
  assignments.sort((a, b) => b.classes.length - a.classes.length);

  assignments.forEach((a, idx) => {
    const classList = a.classes
      .map(c => `Year ${c.year_num} ${c.name}`)
      .sort()
      .join(', ');
    console.log(`${idx + 1}. ${a.teacher.full_name} (${a.email}) — ${a.classes.length} Classes: [${classList}]`);
  });
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
