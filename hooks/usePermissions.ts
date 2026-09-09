/**
 * CALLSHIELD usePermissions Hook
 *
 * Manages the full permissions lifecycle:
 * - Checks current status on mount
 * - Provides request functions
 * - Tracks per-permission state
 * - Drives the permission request screen in onboarding
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  checkAllPermissions,
  requestAllPermissions,
  requestContactsPermission,
  requestNotificationsPermission,
  werePermissionsRequested,
  PermissionsState,
  PermissionStatus,
} from '../services/permissionsService';

interface UsePermissionsReturn {
  permissions: PermissionsState;
  isLoading: boolean;
  allGranted: boolean;
  needsRequest: boolean;
  requestAll: () => Promise<PermissionsState>;
  requestContacts: () => Promise<PermissionStatus>;
  requestNotifications: () => Promise<PermissionStatus>;
  refresh: () => Promise<void>;
  wereRequested: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionsState>({
    microphone: 'undetermined',
    contacts: 'undetermined',
    notifications: 'undetermined',
    phone: 'undetermined',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [wereRequested, setWereRequested] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [state, requested] = await Promise.all([
        checkAllPermissions(),
        werePermissionsRequested(),
      ]);
      setPermissions(state);
      setWereRequested(requested);
    } catch {}
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestAll = useCallback(async (): Promise<PermissionsState> => {
    const result = await requestAllPermissions();
    setPermissions(result);
    setWereRequested(true);
    return result;
  }, []);

  const requestContacts = useCallback(async (): Promise<PermissionStatus> => {
    const status = await requestContactsPermission();
    setPermissions(prev => ({ ...prev, contacts: status }));
    return status;
  }, []);

  const requestNotifications = useCallback(async (): Promise<PermissionStatus> => {
    const status = await requestNotificationsPermission();
    setPermissions(prev => ({ ...prev, notifications: status }));
    return status;
  }, []);

  // On web, everything is "granted" or unavailable
  const effectivePermissions: PermissionsState = Platform.OS === 'web'
    ? { microphone: 'granted', contacts: 'granted', notifications: 'granted', phone: 'granted' }
    : permissions;

  const allGranted = effectivePermissions.contacts === 'granted'
    && effectivePermissions.notifications === 'granted';

  // Needs request if any non-microphone permission is undetermined
  const needsRequest = !wereRequested && (
    effectivePermissions.contacts === 'undetermined' ||
    effectivePermissions.notifications === 'undetermined'
  );

  return {
    permissions: effectivePermissions,
    isLoading,
    allGranted,
    needsRequest,
    requestAll,
    requestContacts,
    requestNotifications,
    refresh,
    wereRequested,
  };
}
