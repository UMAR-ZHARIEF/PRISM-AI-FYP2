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
    }

    setLoading(false);
    return { data: data || null, error: upsertError || null };
  }, [user]);

  return { markAttendance, loading, error };
}

export default useMarkAttendance;
