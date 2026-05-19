import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function useMarkAttendance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const markAttendance = useCallback(async function markAttendance(payload) {
    const { studentId, date, status, arrivalTime, notes } = payload || {};

    if (!studentId || !date || !status) {
      const missingErr = new Error('useMarkAttendance: studentId, date, and status are required');
      console.error(missingErr);
      setError(missingErr);
      return { data: null, error: missingErr };
    }

    setLoading(true);
    setError(null);

    const row = {
      student_id: studentId,
      date,
      status,
      arrival_time: arrivalTime ?? null,
      notes: notes ?? null,
      marked_by: user ? user.id : null,
      marked_at: new Date().toISOString(),
    };

    const { data, error: upsertError } = await supabase
      .from('attendance_records')
      .upsert(row, { onConflict: 'student_id,date' })
      .select()
      .single();

    if (upsertError) {
      console.error('useMarkAttendance: failed to upsert attendance', upsertError);
      setError(upsertError);
    } else {
      // Fire-and-forget notification fanout to homeroom teacher + linked
      // parents. Wrapped in its own try/catch so any failure here is logged
      // but never blocks the caller or surfaces as an attendance error.
      (async () => {
        try {
          const { data: ctx } = await supabase
            .from('students')
            .select('full_name, class_section:class_sections(homeroom_teacher_id), parent_links:parent_students(parent_id)')
            .eq('id', studentId)
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

          const rows = Array.from(recipients).map((rid) => ({
            recipient_id: rid,
            scope: 'user',
            type: 'attendance',
            title: `${ctx.full_name} marked ${status}`,
            body: `Manually marked ${status} on ${date}${arrivalTime ? ` at ${arrivalTime}` : ''}.`,
          }));
          const { error: nErr } = await supabase.from('notifications').insert(rows);
          if (nErr) {
            console.warn('[markAttendance notification fanout] insert failed:', nErr.message);
          }
        } catch (e) {
          console.warn('[markAttendance notification fanout] failed:', e);
        }
      })();
    }

    setLoading(false);
    return { data: data || null, error: upsertError || null };
  }, [user]);

  return { markAttendance, loading, error };
}

export default useMarkAttendance;
