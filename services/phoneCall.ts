/**
 * Place and track real carrier calls.
 * CallKit startCall records the call in Recents. Linking tel: rings the PSTN.
 * Expo Go / Simulator may not complete tel:; live analysis still opens.
 */
import { Linking, Platform } from 'react-native';
import { reportCallConnected, startOutgoingCall } from './callKitService';

export function toDialable(number: string): string {
  const trimmed = (number || '').trim();
  if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '');
  return trimmed.replace(/\D/g, '');
}

export function telHref(number: string): string {
  return `tel:${toDialable(number)}`;
}

export async function placeRealCall(opts: {
  name: string;
  number: string;
}): Promise<{ uuid: string; placed: boolean }> {
  const uuid = startOutgoingCall({
    callerName: opts.name,
    callerNumber: opts.number,
  });
  const href = telHref(opts.number);
  try {
    const can = await Linking.canOpenURL(href);
    if (can) {
      await Linking.openURL(href);
      reportCallConnected(uuid);
      return { uuid, placed: true };
    }
  } catch (e) {
    console.warn('placeRealCall', e);
  }
  if (Platform.OS === 'web') {
    return { uuid, placed: false };
  }
  try {
    await Linking.openURL(href);
    reportCallConnected(uuid);
    return { uuid, placed: true };
  } catch (e) {
    console.warn('placeRealCall fallback', e);
    return { uuid, placed: false };
  }
}
