import { useEffect, useState } from 'react';

export function useLoggerSignals() {
  const [signals, setSignals] = useState<string[]>([]);

  useEffect(() => {
    const onProxy = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail;
        const key = detail && detail.url ? String(detail.url) : String(detail || 'signal');
        setSignals(prev => [...prev, key]);
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