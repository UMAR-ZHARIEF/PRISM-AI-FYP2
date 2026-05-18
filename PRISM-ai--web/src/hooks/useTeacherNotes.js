import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function useTeacherNotes(studentId) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchNotes() {
    if (!studentId) {
      setNotes([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('teacher_notes')
      .select('*, teacher:profiles(*)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('useTeacherNotes: failed to load notes', queryError);
          setError(queryError);
          setNotes([]);
        } else {
          setNotes(data || []);
        }
        setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [studentId, refreshTick]);

  const addNote = useCallback(async function addNote(body) {
    if (!studentId) {
      const missingErr = new Error('useTeacherNotes: studentId is required to add a note');
      console.error(missingErr);
      return { data: null, error: missingErr };
    }
    if (!user) {
      const authErr = new Error('useTeacherNotes: no authenticated user');
      console.error(authErr);
      return { data: null, error: authErr };
    }

    const { data, error: insertError } = await supabase
      .from('teacher_notes')
      .insert({
        student_id: studentId,
        teacher_id: user.id,
        body,
      })
      .select()
      .single();

    if (insertError) {
      console.error('useTeacherNotes: failed to insert note', insertError);
    } else {
      refresh();
    }

    return { data: data || null, error: insertError || null };
  }, [studentId, user, refresh]);

  return { notes, loading, error, addNote, refresh };
}

export default useTeacherNotes;
