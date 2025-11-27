import { useEffect, useState, useRef } from 'react';

export function useLoggerSignals() {
  const [signals, setSignals] = useState<string[]>([]);
  const nextIdRef = useRef(0);

  useEffect(() => {
    type ProxyEventDetail = { url?: string; href?: string } & Record<string, unknown>;

    const onProxy = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail as unknown;
        let key: string | undefined;
        if (!detail) {
          key = `signal-${Date.now()}-${++nextIdRef.current}`;
        } else if (typeof detail === 'string') {
          key = detail;
        } else if (typeof detail === 'object' && detail !== null) {
          const d = detail as ProxyEventDetail;
          if (typeof d.url === 'string' && d.url.length > 0) key = d.url;
          else if (typeof d.href === 'string' && d.href.length > 0) key = d.href;
          else {
            // fallback: make a unique synthetic id to avoid repeated '[object Object]'
            key = `signal-${Date.now()}-${++nextIdRef.current}`;
          }
        } else {
          key = String(detail || `signal-${Date.now()}-${++nextIdRef.current}`);
        }

        setSignals(prev => [...prev, key!]);
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('proxy:script-executed', onProxy as EventListener);

    // populate from fallback array if present
    try {
      const arr = (window as Window & { __proxy_script_executed?: unknown[] }).__proxy_script_executed;
      if (Array.isArray(arr)) setSignals(prev => [...prev, ...arr.map(String)]);
    } catch { }

    return () => {
      window.removeEventListener('proxy:script-executed', onProxy as EventListener);
    };
  }, []);

  return signals;
}