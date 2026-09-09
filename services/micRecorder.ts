/**
 * Single iOS/Android recorder. expo-av allows only one prepared Recording.
 * Every caller must go through this so Dialer, Live Call, and Ghost do not collide.
 */
import { Audio } from 'expo-av';

const RECORD_OPTS = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

let current: Audio.Recording | null = null;
let chain: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

export async function enableMicSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: true,
  });
}

export async function startExclusiveRecording(): Promise<Audio.Recording> {
  return enqueue(async () => {
    if (current) {
      try { await current.stopAndUnloadAsync(); } catch {}
      current = null;
      await new Promise(r => setTimeout(r, 120));
    }
    await enableMicSession();
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(RECORD_OPTS);
    await rec.startAsync();
    current = rec;
    return rec;
  });
}

export async function stopExclusiveRecording(rec?: Audio.Recording | null): Promise<string | null> {
  return enqueue(async () => {
    const target = rec ?? current;
    if (!target) return null;
    if (current === target) current = null;
    try {
      await target.stopAndUnloadAsync();
      return target.getURI() ?? null;
    } catch {
      return null;
    }
  });
}

export async function forceReleaseMic(): Promise<void> {
  return enqueue(async () => {
    if (!current) return;
    try { await current.stopAndUnloadAsync(); } catch {}
    current = null;
  });
}
