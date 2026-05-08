/**
 * useCallRecords — Hook for real Supabase call records
 * Provides: real call list, stats, network error handling, and methods to save/update calls
 */

import { useState, useEffect, useCallback } from 'react';
import { callRecordsService, CallRecord } from '../services/callRecordsService';

export type NetworkStatus = 'idle' | 'loading' | 'success' | 'error' | 'offline';

export function useCallRecords() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('idle');

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
    setNetworkStatus('loading');

    try {
      const [callsResult, statsResult] = await Promise.all([
        callRecordsService.fetchAll(),
        callRecordsService.getStats(),
      ]);

      if (callsResult.error) {
        // Distinguish network vs auth errors
        const isOffline = callsResult.error.toLowerCase().includes('network') ||
          callsResult.error.toLowerCase().includes('failed to fetch') ||
          callsResult.error.toLowerCase().includes('fetch');
        setError(callsResult.error);
        setNetworkStatus(isOffline ? 'offline' : 'error');
      } else {
        setCalls(callsResult.data || []);
        setNetworkStatus('success');
      }

      if (statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to load calls';
      setError(msg);
      setNetworkStatus(
        msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')
          ? 'offline'
          : 'error'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveCall = useCallback(async (record: Parameters<typeof callRecordsService.insert>[0]) => {
    const { data, error } = await callRecordsService.insert(record);
    if (!error && data) {
      setCalls(prev => [data, ...prev]);
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
    networkStatus,
    refresh,
    saveCall,
    updateCall,
  };
}
