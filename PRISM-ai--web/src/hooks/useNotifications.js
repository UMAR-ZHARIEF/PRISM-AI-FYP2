import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function useNotifications() {
  const { user } = useAuth();
  const userId = user ? user.id : null;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(function refresh() {
    setRefreshTick(function bump(n) { return n + 1; });
  }, []);

  useEffect(function fetchNotifications() {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // RLS (notifications_select_for_me) already restricts rows to:
    //   - scope='user' AND recipient_id = auth.uid()   (direct messages to me)
    //   - scope='global'                               (broadcasts to everyone)
    //   - scope='role:<my_role>'                       (role-targeted broadcasts)
    // so we deliberately do NOT filter by recipient_id on the client.
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .then(function handleResult({ data, error: queryError }) {
        if (cancelled) return;
        if (queryError) {
          console.error('useNotifications: failed to load notifications', queryError);
          setError(queryError);
          setNotifications([]);
        } else {
          setNotifications(data || []);
        }
        setLoading(false);
      });

    return function cleanup() {
      cancelled = true;
    };
  }, [userId, refreshTick]);

  // Broadcast rows (scope <> 'user') have no per-user read state under
  // Option B, so the unread badge only counts direct messages.
  const unreadCount = useMemo(function computeUnread() {
    return notifications.filter(function isUnread(n) {
      return n.scope === 'user' && !n.read_at;
    }).length;
  }, [notifications]);

  const markRead = useCallback(async function markRead(id) {
    if (!id) return { data: null, error: new Error('markRead: id is required') };

    // Guard: only direct messages have per-user read state.
    const target = notifications.find(function byId(n) { return n.id === id; });
    if (target && target.scope !== 'user') {
      return { data: null, error: new Error('markRead: broadcast rows cannot be marked read per-user') };
    }

    const nowIso = new Date().toISOString();
    const { data, error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('id', id)
      .eq('scope', 'user')
      .select()
      .single();

    if (updateError) {
      console.error('useNotifications: failed to mark notification read', updateError);
      return { data: null, error: updateError };
    }

    setNotifications(function applyRead(prev) {
      return prev.map(function updateRow(n) {
        return n.id === id ? { ...n, read_at: nowIso } : n;
      });
    });

    return { data: data || null, error: null };
  }, [notifications]);

  const markAllRead = useCallback(async function markAllRead() {
    if (!userId) return { data: null, error: new Error('markAllRead: no authenticated user') };

    const nowIso = new Date().toISOString();
    // Scope the update server-side to direct messages only; broadcasts
    // are skipped because they don't carry per-user read state.
    const { data, error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('scope', 'user')
      .eq('recipient_id', userId)
      .is('read_at', null)
      .select();

    if (updateError) {
      console.error('useNotifications: failed to mark all read', updateError);
      return { data: null, error: updateError };
    }

    setNotifications(function applyAllRead(prev) {
      return prev.map(function updateRow(n) {
        if (n.scope !== 'user') return n;
        return n.read_at ? n : { ...n, read_at: nowIso };
      });
    });

    return { data: data || [], error: null };
  }, [userId]);

  return { notifications, unreadCount, loading, error, markRead, markAllRead, refresh };
}

export default useNotifications;
