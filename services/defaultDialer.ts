/**
 * Ask the OS to treat ShieldCall as the Phone app (Truecaller-style).
 * Android 10+: ROLE_DIALER. Older Android: CHANGE_DEFAULT_DIALER.
 * iOS: CallKit default-calling is a native binary setting; Expo Go cannot
 * become the system Phone app. We open Settings and tell the user.
 */
import { Linking, Platform } from 'react-native';

const ANDROID_PACKAGE = 'com.shieldcallai.app';

export async function promptDefaultDialer(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && typeof (Linking as { sendIntent?: Function }).sendIntent === 'function') {
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
    await Linking.openSettings();
    return true;
  } catch (e) {
    console.warn('promptDefaultDialer', e);
    try {
      await Linking.openSettings();
      return true;
    } catch {
      return false;
    }
  }
}

export function defaultDialerHelp(): string {
  if (Platform.OS === 'android') {
    return 'Set ShieldCall as the default Phone app so incoming and outgoing calls open here.';
  }
  return 'iOS only allows a CallKit app (a development or App Store build) to handle calls. Expo Go cannot be the system Phone app. Open Settings, then grant Contacts and Microphone to this app.';
}
