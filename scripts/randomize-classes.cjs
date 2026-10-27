/**
 * PRISM-AI — Randomize Class Assignments
 *
 * Randomly assigns teachers to all 30 class sections in Supabase.
 * Uses the secret service role key to update class_sections.homeroom_teacher_id.
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

async function randomizeClasses() {
  console.log('🔄 Fetching class sections and teachers from Supabase...\n');

  // 1. Fetch all class sections
  const { data: sections, error: sErr } = await supabase
    .from('class_sections')
    .select('id, year_num, name, homeroom_teacher_id')
    .order('year_num', { ascending: true })
    .order('name', { ascending: true });

  if (sErr) {
    console.error('Failed to fetch class_sections:', sErr.message);
    process.exit(1);
  }

  // 2. Fetch all teacher profiles
  const { data: teachers, error: tErr } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'teacher');

  if (tErr) {
    console.error('Failed to fetch teachers:', tErr.message);
    process.exit(1);
  }

  if (teachers.length < sections.length) {
    console.error(`Not enough teachers (${teachers.length}) for ${sections.length} classes.`);
    process.exit(1);
  }

  console.log(`Found ${sections.length} class sections and ${teachers.length} teachers.`);

  // 3. Shuffle teachers randomly
  const shuffledTeachers = shuffle(teachers);

  console.log('\n🎲 Randomly assigning unique teachers to classes...\n');

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const newTeacher = shuffledTeachers[i];

    let success = false;
    let attempts = 0;
    while (!success && attempts < 3) {
      attempts++;
      const { error } = await supabase
        .from('class_sections')
        .update({ homeroom_teacher_id: newTeacher.id })
        .eq('id', section.id);

      if (error) {
        console.warn(`  [Retry ${attempts}] for Year ${section.year_num} ${section.name}:`, error.message);
        await new Promise((r) => setTimeout(r, 200));
      } else {
        success = true;
        console.log(`  ✓ Year ${section.year_num} ${section.name.padEnd(8)} → ${newTeacher.full_name}`);
      }
    }
  }

  // 4. Fetch updated class sections to confirm
  console.log('\n✅ Verification of new assignments in database:');
  const { data: verified, error: vErr } = await supabase
    .from('class_sections')
    .select('year_num, name, profiles:homeroom_teacher_id(full_name)')
    .order('year_num', { ascending: true })
    .order('name', { ascending: true });

  if (vErr) {
    console.error('Verification query failed:', vErr.message);
  } else {
    console.table(
      verified.map((r) => ({
        Class: `Year ${r.year_num} ${r.name}`,
        'Assigned Teacher': r.profiles?.full_name || 'None',
      }))
    );
  }

  console.log('\n🎉 Successfully randomized class assignments in the database!');
}

randomizeClasses().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
