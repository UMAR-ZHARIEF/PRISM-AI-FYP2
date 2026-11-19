/**
 * PRISM-AI — Parent Absence Email Digest (daily, once per local school day)
 *
 * Exported entry point: runAbsenceDigest({ force }) — called by the 60s
 * scheduler in server/server.js (in-process timer) and by the demo/test
 * endpoint POST /api/digest/run (admin only).
 *
 * What it does, in order:
 *   1. Idempotence gate — reads the absence_email_last_sent marker
 *      (app_settings, migration 0016). Already equal to today's local date?
 *      Return { skipped: true } without doing anything, unless force.
 *   2. Day window — local midnight (same approach as the notification
 *      fanout in server.js: a bare 'YYYY-MM-DD' would mean UTC midnight,
 *      08:00 MYT, and miss the early-morning window).
 *   3. Query attendance_records with status='absent' marked within the
 *      window, joined to students (full_name, year_num), class_sections
 *      (name) and parent_students (parent_id, relationship). READ only:
 *      'absent' rows are written from the browser, never by the AI, so no
 *      write path is touched. PRIVACY HARD RULE: the select deliberately
 *      pulls no engagement, risk or teacher-note data, so none of it can
 *      leak into any email (parents are blocked from those by migrations
 *      0007/0008; the email must not leak them either).
 *   4. Parent emails live ONLY in auth.users (profiles has no email
 *      column), so they are resolved through the same paged
 *      supabase.auth.admin.listUsers id→email map as /api/admin/users/list.
 *   5. One email per parent (parent_students is many-to-many; ALL linked
 *      parents are notified, matching the in-app fanout), one paragraph
 *      per absent child.
 *   6. Sending: nodemailer + Gmail SMTP (forprojectdump@gmail.com, app
 *      password from GMAIL_APP_PASSWORD). If that env var is unset the
 *      module runs in DRY mode: every composed email is logged in full
 *      and nothing leaves the machine — the safe default and the
 *      pre-password test path. nodemailer is required lazily so a
 *      password-less install never crashes this module at load time.
 *
 * Marker contract: after a completed run (real sends all attempted, a
 * no-absence day, or a completed dry run) the marker is set to today so
 * neither the scheduler nor a restart re-fires the day. A dry run marks
 * the day too — otherwise the scheduler would re-compose and re-log the
 * same emails every 60s tick until midnight. Adding the real password
 * later still allows a real same-day send through POST /api/digest/run
 * (force) or by waiting for the next school day.
 *
 * Failure handling mirrors the notification fanout: every phase is
 * guarded, per-email failures are logged and never crash the server, and
 * nothing here ever throws to the caller — failures come back inside the
 * returned object with markerUpdated: false so the scheduler retries on
 * the next tick.
 */

// Client is injected once by server.js (init) right after it builds the
// service-role Supabase client; env-based re-creation here would duplicate
// that setup. Null client → every run returns a guarded error result.
let supabase = null;
function init(client) {
  supabase = client;
}

const GMAIL_USER = 'forprojectdump@gmail.com';
const GMAIL_FROM = `PRISM-AI School Attendance System <${GMAIL_USER}>`;

// YYYY-MM-DD in LOCAL time — same logic as localDateStr() in server.js
// (toISOString would give the UTC date — wrong before 8 AM MYT).
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Paged auth.users → id→email map (same pattern as /api/admin/users/list).
async function loadParentEmailMap() {
  const emailById = new Map();
  const perPage = 1000;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
    for (const u of data.users) emailById.set(u.id, u.email);
    if (data.users.length < perPage) break;
    page += 1;
    if (page > 50) break; // safety: 50,000 users max (same cap as the list endpoint)
  }
  return emailById;
}

function composeBody(dateStr, children) {
  const lines = [];
  lines.push('Dear Parent/Guardian,', '');
  // One paragraph per absent child, in the order the query returned them.
  for (const c of children) {
    lines.push(`${c.fullName} (Year ${c.yearNum} ${c.className}) was marked absent on ${dateStr}.`, '');
  }
  lines.push('Details are available in the PRISM-AI parent portal.', '');
  lines.push('PRISM-AI School Attendance System');
  return lines.join('\n');
}

async function markDaySent(day) {
  try {
    const { error } = await supabase
      .from('app_settings')
      .update({ absence_email_last_sent: day, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;
    console.log(`[digest] marker updated: absence_email_last_sent = ${day}`);
    return true;
  } catch (e) {
    console.warn(`[digest] marker update FAILED for ${day} (day may re-fire):`, e.message);
    return false;
  }
}

async function runAbsenceDigest({ force = false } = {}) {
  const now = new Date();
  const day = localDateStr(now);
  const base = { day, force };

  try {
    if (!supabase) {
      console.warn('[digest] run aborted: Supabase not configured');
      return { ...base, sent: 0, skipped: false, error: 'Supabase not configured', markerUpdated: false };
    }

    // ── 1. Idempotence gate (fresh read; the scheduler's 60s-cached copy is
    //       only a pre-filter — this is the authoritative check) ──────────
    const { data: markerRow, error: markerErr } = await supabase
      .from('app_settings')
      .select('absence_email_last_sent')
      .eq('id', 1)
      .maybeSingle();
    if (markerErr) throw new Error(`marker read failed: ${markerErr.message}`);
    const lastSent = markerRow?.absence_email_last_sent ?? null;
    if (!force && lastSent === day) {
      console.log(`[digest] skip: day ${day} already sent (marker) — force=${force}`);
      return { ...base, sent: 0, skipped: true, reason: 'already-sent-today', markerUpdated: false };
    }

    // ── 2. Local school-day window: local midnight → now ─────────────────
    const dayStartIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // ── 3. Absences of the day + children + classes + ALL linked parents ──
    //       parent_students has no direct FK to attendance_records (the link
    //       is attendance_records.student_id → students ← parent_students),
    //       so it embeds nested under the students hop — the same proven
    //       students→parent_students embed the notification fanout uses.
    //       Privacy hard rule: this select is the whole payload — no
    //       engagement, risk or teacher-note columns exist in it.
    const { data: records, error: recErr } = await supabase
      .from('attendance_records')
      .select(`
        marked_at,
        student:students(
          full_name, year_num,
          class_section:class_sections(name),
          parent_links:parent_students(parent_id, relationship)
        )
      `)
      .eq('status', 'absent')
      .gte('marked_at', dayStartIso);
    if (recErr) throw new Error(`absence query failed: ${recErr.message}`);

    if (!records || records.length === 0) {
      console.log(`[digest] day ${day}: no absences — marking the day sent so the scheduler does not retry`);
      const markerUpdated = await markDaySent(day);
      return { ...base, sent: 0, skipped: false, reason: 'no-absences', markerUpdated };
    }

    // ── 4. Group by parent; resolve emails from auth.users ────────────────
    const childrenByParent = new Map(); // parentId → [{ fullName, yearNum, className }]
    const relationshipByParent = new Map();
    for (const rec of records) {
      const st = rec.student;
      if (!st) continue; // student row deleted after the absence landed
      for (const link of st.parent_links || []) {
        if (!link.parent_id) continue;
        if (!childrenByParent.has(link.parent_id)) {
          childrenByParent.set(link.parent_id, []);
          relationshipByParent.set(link.parent_id, link.relationship || null);
        }
        childrenByParent.get(link.parent_id).push({
          fullName: st.full_name,
          yearNum: st.year_num,
          className: st.class_section?.name || 'Unknown class',
        });
      }
    }

    const emailById = await loadParentEmailMap();
    const mails = []; // { to, parentId, childCount, subject, body }
    const unresolved = [];
    for (const [parentId, children] of childrenByParent) {
      const to = emailById.get(parentId) || null;
      if (!to) {
        unresolved.push(parentId);
        console.warn(`[digest] parent ${parentId} has no email in auth.users — skipped (${children.length} absent child/children)`);
        continue;
      }
      mails.push({
        to,
        parentId,
        childCount: children.length,
        subject: `PRISM-AI absence notice for ${day}`,
        body: composeBody(day, children),
      });
    }

    if (mails.length === 0) {
      console.warn(`[digest] day ${day}: ${records.length} absence(s) but zero resolvable parent emails — marking the day sent`);
      const markerUpdated = await markDaySent(day);
      return { ...base, sent: 0, skipped: false, reason: 'no-resolvable-parent-emails', unresolvedParents: unresolved, markerUpdated };
    }

    // ── 5. Send (or dry-run when GMAIL_APP_PASSWORD is unset) ─────────────
    const dry = !process.env.GMAIL_APP_PASSWORD;
    const mode = dry ? 'dry' : 'smtp';
    console.log(`[digest] run start: day=${day} mode=${mode} force=${force} absences=${records.length} recipients=${mails.length}`);

    const perEmail = [];
    if (dry) {
      // Safe default: no SMTP attempt, every composed email logged in full.
      for (const m of mails) {
        console.log(`[digest] DRY email → ${m.to} (parent ${m.parentId}, ${m.childCount} child/children)\n[digest] DRY subject: ${m.subject}\n[digest] DRY body:\n${m.body}`);
        perEmail.push({ to: m.to, ok: true, dry: true });
      }
    } else {
      // Lazy require: a password-less install never loads nodemailer.
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      for (const m of mails) {
        try {
          await transporter.sendMail({ from: GMAIL_FROM, to: m.to, subject: m.subject, text: m.body });
          perEmail.push({ to: m.to, ok: true });
          console.log(`[digest] sent to ${m.to} (${m.childCount} child/children)`);
        } catch (e) {
          perEmail.push({ to: m.to, ok: false, error: e.message });
          console.warn(`[digest] send FAILED to ${m.to}:`, e.message);
        }
      }
    }

    const sent = perEmail.filter((r) => r.ok).length;
    const failed = perEmail.length - sent;

    // ── 6. Marker: the DB/local phase succeeded above and every email was
    //       attempted (per-email catches keep the loop running), so the day
    //       is complete even with individual send failures logged.
    const markerUpdated = await markDaySent(day);

    console.log(`[digest] run done: day=${day} mode=${mode} sent=${sent} failed=${failed} unresolvedParents=${unresolved.length} markerUpdated=${markerUpdated}`);

    const result = { ...base, mode, sent, failed, recipients: mails.map((m) => m.to), perEmail, markerUpdated };
    if (dry) {
      result.dryRun = true;
      result.bodies = mails.map((m) => ({ to: m.to, subject: m.subject, body: m.body }));
    }
    if (unresolved.length > 0) result.unresolvedParents = unresolved;
    return result;
  } catch (e) {
    // Never throw to the caller (scheduler tick / endpoint): report inside
    // the result and leave the marker untouched so the day can retry.
    console.warn(`[digest] run FAILED for day ${day} (no marker update):`, e.message);
    return { ...base, sent: 0, skipped: false, error: e.message, markerUpdated: false };
  }
}

module.exports = { runAbsenceDigest, init };
