import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'callshield_onboarded';
const GHOST_MODE_KEY = 'callshield_ghost_mode';
const PERSONA_KEY = 'callshield_persona';

export const StorageService = {
  async isOnboarded(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(ONBOARDING_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setOnboarded(): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
  },

  async getGhostMode(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(GHOST_MODE_KEY);
      return val !== 'false';
    } catch {
      return true;
    }
  },

  async setGhostMode(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(GHOST_MODE_KEY, enabled ? 'true' : 'false');
    } catch {}
  },

  async getPersona(): Promise<string> {
    try {
      const val = await AsyncStorage.getItem(PERSONA_KEY);
      return val || 'Alex';
    } catch {
      return 'Alex';
    }
  },

  async setPersona(name: string): Promise<void> {
    try {
      await AsyncStorage.setItem(PERSONA_KEY, name);
    } catch {}
  },
};
