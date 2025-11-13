import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { matchedRange, highlightRange, rangeToHtml } from '../utils/dom';

type RangeResult = {
  id: string;
  snippet: string;
  success: boolean;
  message?: string;
};

type Options = {
  maxRetries?: number;
  baseDelay?: number;
  maxTotalDelay?: number;
};

export function useRangeMatching(
  contentRef: RefObject<HTMLElement | null>,
  annotations: AnnotationItem[] | undefined,
  ready: boolean,
  options: Options = {}
) {
  const [rangeResults, setRangeResults] = useState<RangeResult[]>([]);
  const [renderedHtmlMap, setRenderedHtmlMap] = useState<Record<string, string>>({});
  const timersRef = useRef<number[]>([]);

  function updateRangeResult(id: string, patch: Partial<RangeResult>) {
    setRangeResults(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) {
        return [...prev, { id, snippet: patch.snippet ?? '', success: patch.success ?? false, message: patch.message }];
      }
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }



  useEffect(() => {
    if (!ready) return;
    const container = contentRef.current;
    if (!container) return;

    // clear previous timers when rerunning
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    // clear previously rendered HTML for annotations when rerunning
    setRenderedHtmlMap({});

    annotations?.forEach(ann => {
      updateRangeResult(ann.id, { success: false, snippet: ann.text.substring(0, 120) });

      const tryRestore = () => {
        const range = matchedRange(container, ann.text);
        const html = rangeToHtml(range);
        if (range) {
          highlightRange(range, ann.color || '#ffff00', ann.id);
          try {
            setRenderedHtmlMap(prev => ({ ...prev, [ann.id]: html }));
            updateRangeResult(ann.id, { message: 'Restored' });
          } catch (err) {
            // still mark success, but note failure to render HTML
            updateRangeResult(ann.id, { message: 'Restored (rangeToHtml failed)' });
          }
          updateRangeResult(ann.id, { success: true });
        } else {
          const msg = `Could not restore highlight. Container content length: ${container.innerHTML.length}`;
          updateRangeResult(ann.id, { success: false, message: msg });
        }
      };

      if (container.innerHTML.trim().length > 0) {
        tryRestore();
      } else {
        const t = window.setTimeout(tryRestore, 500);
        timersRef.current.push(t);
      }
    });

    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, [ready, annotations, contentRef]);

  const allMatched = (annotations || []).every(a => {
    const r = rangeResults.find(rr => rr.id === a.id);
    return !!(r && r.success === true);
  });

  const annotationsWithRendered = (annotations || []).map(a => ({
    ...a,
    html: renderedHtmlMap[a.id] ?? a.html,
  }));
  return { rangeResults, allMatched, annotations: annotationsWithRendered } as const;
}

type ScriptLike = { src?: string } | string;

type Result = {
  totalTime: number;
  error?: string | null;
  success: boolean;
};

export function useScriptExecutionTracker(scripts: ScriptLike[] = []): Result {
  const [totalTime, setTotalTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (scripts.length === 0) {
      setTotalTime(0);
      setSuccess(true);
      return;
    }
    let done = false;
    const startTime = Date.now();
    const signaled = new Set<string>();
    const STALL_TIMEOUT = 3000;
    let lastSeenCount = 0;
    let lastChangeTime = Date.now();

    const logAndFinish = (reason: string) => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - startTime;
      try {
        // avoid throwing from console in exotic environments
        console.log(`Scripts finished (${reason}). Signals: ${signaled.size}. Elapsed: ${elapsed} ms`);
      } catch { }
      setTotalTime(elapsed);
      setSuccess(true);
      cleanup();
    };

    const populateFromFallback = () => {
      try {
        const arr = (window as unknown as { __proxy_script_executed?: string[] }).__proxy_script_executed;
        if (Array.isArray(arr)) {
          for (const u of arr) {
            try {
              signaled.add(String(u));
            } catch {
              signaled.add(String(u));
            }
          }
          lastSeenCount = signaled.size;
          lastChangeTime = Date.now();
        }
      } catch (e) {
        // Non-fatal
      }
    };

    populateFromFallback();

    const onProxyEvent = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail;
        const key = detail && detail.url ? String(detail.url) : `signal-${Date.now()}-${Math.random()}`;
        if (!signaled.has(key)) {
          signaled.add(key);
          lastChangeTime = Date.now();
          lastSeenCount = signaled.size;
        }
      } catch (e) {
        try { console.error('Error handling proxy:script-executed event', e); } catch { }
        setError(String(e instanceof Error ? e.message : e));
      }
    };

    const intervalId = window.setInterval(() => {
      try {
        const arr = (window as unknown as { __proxy_script_executed?: string[] }).__proxy_script_executed;
        if (Array.isArray(arr)) {
          for (const u of arr) signaled.add(String(u));
          if (signaled.size !== lastSeenCount) {
            lastSeenCount = signaled.size;
            lastChangeTime = Date.now();
          }

          if (!done && Date.now() - lastChangeTime >= STALL_TIMEOUT) {
            console.log(`No new execution for ${STALL_TIMEOUT}ms`);
            logAndFinish('stall timeout');
            return;
          }
        }
      } catch (e) {
        try { console.error('Error while polling __proxy_script_executed', e); } catch { }
        setError(String(e instanceof Error ? e.message : e));
        logAndFinish('error');
      }
    }, 1000);

    const cleanup = () => {
      try { window.removeEventListener('proxy:script-executed', onProxyEvent as EventListener); } catch { }
      try { if (intervalId) clearInterval(intervalId); } catch { }
    };

    window.addEventListener('proxy:script-executed', onProxyEvent as EventListener);

    return () => {
      cleanup();
    };
  }, [scripts]);

  return { totalTime, error, success };
}

type Script = {
  src?: string;
  content?: string;
  type?: string;
  async?: boolean;
  defer?: boolean;
}

export function useScriptLoader(
  scripts: Script[],
  pageUrl?: string,
  apiBase?: string
) {
  const loadedScripts = useRef<Set<string>>(new Set());
  const scriptsLoaded = useRef(0);

  useEffect(() => {
    // Custom scripts to inject - conditionally based on the site
    const siteSpecificScripts: Script[] = [];

    // Only inject MathJax for Springer sites
    if (pageUrl && pageUrl.includes('link.springer.com')) {
      const mathjaxUrl = 'cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js';
      const src = apiBase ? `${apiBase}/proxy/${mathjaxUrl}` : mathjaxUrl;
      siteSpecificScripts.push({
        src,
        type: 'text/javascript',
        async: false,
        defer: false
      });
    }

    // Combine custom scripts with page scripts
    const allScripts = [...siteSpecificScripts, ...scripts];

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const waitForLoadOrError = (el: HTMLScriptElement) => new Promise<void>((resolve) => {
      const onLoad = () => resolve();
      const onError = (ev?: Event) => {
        console.error('Script load error for', el.src, ev)
        resolve();
      };
      el.addEventListener('load', onLoad, { once: true });
      el.addEventListener('error', onError as EventListener, { once: true });
    });

    // Load a single script. Returns when the script has loaded (or failed).
    const createdInlineScripts: HTMLScriptElement[] = [];

    const loadScript = async (script: Script, index: number): Promise<void> => {
      if (script.src && loadedScripts.current.has(script.src)) {
        return;
      }

      const scriptElement = document.createElement('script');

      if (script.type) scriptElement.type = script.type;
      if (script.async) scriptElement.async = true;
      if (script.defer) scriptElement.defer = true;

      if (script.src) {
        const src = script.src as string;
        scriptElement.src = src;

        // Add crossorigin attribute for better CORS handling on mobile
        try {
          if (apiBase && src.startsWith(apiBase)) {
            // Proxied script, same origin
          } else if (!src.includes(window.location.origin)) {
            scriptElement.crossOrigin = 'anonymous';
          }
        } catch (e) {
          // ignore if checking window.location fails in some envs
        }

        document.head.appendChild(scriptElement);

        // Await either load or error, but don't throw on error
        await waitForLoadOrError(scriptElement);

        // Mark as loaded and allow a small initialization period
        scriptsLoaded.current++;
        loadedScripts.current.add(src);
        await sleep(50);
      } else if (script.content) {
        // For inline script content we need to append an actual script
        // element to the document so the browser executes it. Creating a
        // script element with textContent and appending to head triggers
        // execution. Keep references so we can cleanup on unmount.
        try {
          scriptElement.textContent = script.content;
          document.head.appendChild(scriptElement);
          createdInlineScripts.push(scriptElement);
          scriptsLoaded.current++;
          // Yield to allow immediate execution
          await sleep(0);
        } catch (e) {
          console.error('Failed to execute inline script', e);
        }
      }
    };

    // Load scripts sequentially to maintain execution order
    const loadAllScripts = async () => {
      try {
        for (let i = 0; i < allScripts.length; i++) {
          await loadScript(allScripts[i], i);
        }
      } catch (error) {
        console.error('Error loading scripts:', error);
      }
    };

    loadAllScripts();

    // Cleanup function to remove scripts and marker on unmount
    return () => {
      // Clean up all external scripts we may have injected
      [...siteSpecificScripts, ...scripts].forEach(script => {
        if (script.src) {
          const existingScript = document.querySelector(`script[src="${script.src}"]`);
          if (existingScript) {
            existingScript.remove();
          }
        }
      });

      // Remove any inline script elements we created
      createdInlineScripts.forEach(s => {
        try { s.remove(); } catch { }
      });

      // Remove the marker element
      const marker = document.getElementById('scripts-dom-ready-marker');
      if (marker) {
        marker.remove();
      }
    };
  }, [scripts, pageUrl, apiBase]);
}