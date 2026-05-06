/**
 * useCallRecords — Hook for real Supabase call records
 * Provides: real call list, stats, and methods to save/update calls
 */

import { useState, useEffect, useCallback } from 'react';
import { callRecordsService, CallRecord } from '../services/callRecordsService';

export function useCallRecords() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalCalls: 0,
    scamsBlocked: 0,
    ghostModeCalls: 0,
    estimatedSavings: 0,
    topScamTypes: [] as { type: string; count: number }[],
    safeCallsPercent: 100,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [callsResult, statsResult] = await Promise.all([
      callRecordsService.fetchAll(),
      callRecordsService.getStats(),
    ]);

    if (callsResult.error) {
      setError(callsResult.error);
    } else {
      setCalls(callsResult.data || []);
    }

    if (statsResult.data) {
      setStats(statsResult.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveCall = useCallback(async (record: Parameters<typeof callRecordsService.insert>[0]) => {
    const { data, error } = await callRecordsService.insert(record);
    if (!error && data) {
      setCalls(prev => [data, ...prev]);
      // Refresh stats
      callRecordsService.getStats().then(r => {
        if (r.data) setStats(r.data);
      });
    }
    return { data, error };
  }, []);

  const updateCall = useCallback(async (id: string, updates: Partial<CallRecord>) => {
    const { error } = await callRecordsService.update(id, updates);
    if (!error) {
      setCalls(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }
    return { error };
  }, []);

  return {
    calls,
    stats,
    loading,
    error,
    refresh,
    saveCall,
    updateCall,
  };
}
