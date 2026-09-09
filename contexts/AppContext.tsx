import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StorageService } from '../services/storageService';

interface AppContextType {
  isOnboarded: boolean;
  isReady: boolean;
  ghostModeEnabled: boolean;
  personaName: string;
  shieldActive: boolean;
  setOnboarded: () => Promise<void>;
  setGhostMode: (enabled: boolean) => Promise<void>;
  setPersonaName: (name: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [ghostModeEnabled, setGhostModeEnabled] = useState(true);
  const [personaName, setPersonaNameState] = useState('Alex');
  const [shieldActive] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [onboarded, ghost, persona] = await Promise.all([
          StorageService.isOnboarded(),
          StorageService.getGhostMode(),
          StorageService.getPersona(),
        ]);
        setIsOnboarded(onboarded);
        setGhostModeEnabled(ghost);
        setPersonaNameState(persona);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setOnboarded = async () => {
    await StorageService.setOnboarded();
    setIsOnboarded(true);
  };

  const setGhostMode = async (enabled: boolean) => {
    await StorageService.setGhostMode(enabled);
    setGhostModeEnabled(enabled);
  };

  const setPersonaName = async (name: string) => {
    await StorageService.setPersona(name);
    setPersonaNameState(name);
  };

  return (
    <AppContext.Provider value={{ isOnboarded, isReady, ghostModeEnabled, personaName, shieldActive, setOnboarded, setGhostMode, setPersonaName }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
