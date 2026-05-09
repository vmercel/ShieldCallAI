/**
 * CALLSHIELD Settings Context
 *
 * Global settings state shared across all screens.
 * Persists to AsyncStorage under 'callshield_settings_v1'.
 * Screens that previously managed settings locally now consume this context
 * so that behavior-wiring code (live-call, ghost-mode, incoming-call) can
 * read settings without prop-drilling.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEY = 'callshield_settings_v1';

export interface AppSettings {
  deepfakeDetect: boolean;       // Controls AcousticSentinel on/off
  communityFeed: boolean;        // Controls community threat DB lookup
  quietHours: boolean;           // Auto-screens all calls 10 PM – 8 AM
  federatedLearning: boolean;    // Encrypted gradient sharing (aspirational)
  autoScreenUnknown: boolean;    // Routes unknown callers to Ghost Mode
}

export const DEFAULT_SETTINGS: AppSettings = {
  deepfakeDetect: true,
  communityFeed: true,
  quietHours: false,
  federatedLearning: false,
  autoScreenUnknown: true,
};

interface SettingsContextType {
  settings: AppSettings;
  isLoaded: boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then(raw => {
        if (raw) {
          try {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoaded, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
