/**
 * Phone client for shieldcall-core.
 * Opens a call, sends each analyzed chunk, closes on hang-up.
 * Fail-open: if core is down, returns null and the UI keeps local/Claude scoring.
 */
import { useCallback, useRef, useState } from 'react';
import {
  sidecarBaseUrl,
  sidecarChunk,
  sidecarCloseCall,
  sidecarHealth,
  sidecarOpenCall,
  SidecarEvent,
} from '../services/shieldcallSidecar';

const OPEN_TIMEOUT_MS = 5000;
const CHUNK_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

export type CoreStatus = 'off' | 'on' | 'lost';

export function useDetectorCore() {
  const callIdRef = useRef<string | null>(null);
  const statusRef = useRef<CoreStatus>('off');
  const urlRef = useRef(sidecarBaseUrl());
  const [status, setStatus] = useState<CoreStatus>('off');
  const [endpoint, setEndpoint] = useState(urlRef.current);

  const setCore = (next: CoreStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const open = useCallback(async (preferredId?: string): Promise<string | null> => {
    const url = sidecarBaseUrl();
    urlRef.current = url;
    setEndpoint(url);
    try {
      const health = await withTimeout(sidecarHealth(url), OPEN_TIMEOUT_MS);
      if (!health.live) {
        setCore('off');
        return null;
      }
      const opened = await withTimeout(sidecarOpenCall(preferredId, url), OPEN_TIMEOUT_MS);
      callIdRef.current = opened.call_id;
      setCore(opened.shed ? 'lost' : 'on');
      return opened.call_id;
    } catch (e) {
      console.warn('shieldcall-core open failed', url, e);
      setCore('off');
      callIdRef.current = null;
      return null;
    }
  }, []);

  const analyzeChunk = useCallback(async (text: string, t = 0): Promise<SidecarEvent | null> => {
    if (!text.trim()) return null;
    if (!callIdRef.current || statusRef.current === 'off') {
      await open();
    }
    const cid = callIdRef.current;
    if (!cid) return null;
    try {
      const ev = await withTimeout(
        sidecarChunk(cid, { text, t }, urlRef.current),
        CHUNK_TIMEOUT_MS,
      );
      setCore('on');
      return ev;
    } catch (e) {
      console.warn('shieldcall-core chunk failed', e);
      setCore('lost');
      return null;
    }
  }, [open]);

  const close = useCallback(async () => {
    const cid = callIdRef.current;
    callIdRef.current = null;
    if (!cid) return;
    try {
      await withTimeout(sidecarCloseCall(cid, urlRef.current), OPEN_TIMEOUT_MS);
    } catch {
      // fail-open: hanging up the phone must not wait on core
    }
    setCore('off');
  }, []);

  return { open, analyzeChunk, close, statusRef, status, endpoint };
}
