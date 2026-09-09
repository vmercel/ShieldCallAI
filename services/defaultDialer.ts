/**
 * Phone-app setup. iOS has no default-dialer toggle, so we never dump
 * the user into Settings as the first step. Android gets ROLE_DIALER.
 */
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

const ANDROID_PACKAGE = 'com.shieldcallai.app';

export function hostAppLabel(): string {
  return Constants.appOwnership === 'expo' ? 'Expo Go' : 'ShieldCall';
}

export function deniedSettingsHint(): string {
  return `In Settings tap ${hostAppLabel()}, then turn on Contacts and Microphone. Come back here when that is done.`;
}

/** Kept so Fast Refresh of Settings cannot crash on a removed export. */
export function defaultDialerHelp(): string {
  if (Platform.OS === 'android') {
    return 'Set ShieldCall as the default Phone app so incoming and outgoing calls open here.';
  }
  return 'Tap Set up calling. Allow Contacts and Microphone. That is the whole setup.';
}

export async function promptDefaultDialer(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (typeof (Linking as { sendIntent?: Function }).sendIntent === 'function') {
      const sendIntent = (Linking as { sendIntent: Function }).sendIntent;
      try {
        await sendIntent('android.app.role.action.REQUEST_ROLE', [
          { key: 'android.app.extra.ROLE_NAME', value: 'android.app.role.DIALER' },
        ]);
        return true;
      } catch {
        await sendIntent('android.telecom.action.CHANGE_DEFAULT_DIALER', [
          { key: 'android.telecom.extra.CHANGE_DEFAULT_DIALER_PACKAGE_NAME', value: ANDROID_PACKAGE },
        ]);
        return true;
      }
    }
  } catch (e) {
    console.warn('promptDefaultDialer', e);
  }
  return false;
}

export async function openHostAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
