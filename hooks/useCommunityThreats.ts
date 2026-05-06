/**
 * useCommunityThreats — Hook for real Supabase community threat data
 */

import { useState, useEffect, useCallback } from 'react';
import { communityThreatsService, CommunityThreat } from '../services/communityThreatsService';

export function useCommunityThreats() {
  const [threats, setThreats] = useState<CommunityThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await communityThreatsService.fetchTop(10);
    if (error) setError(error);
    else setThreats(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reportNumber = useCallback(async (phoneNumber: string, scamType?: string) => {
    const { error } = await communityThreatsService.reportNumber(phoneNumber, scamType);
    if (!error) refresh();
    return { error };
  }, [refresh]);

  return { threats, loading, error, refresh, reportNumber };
}
