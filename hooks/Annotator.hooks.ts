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
  const executedScripts = useRef<HTMLScriptElement[]>([]);
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

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

    // Execute scripts by finding them in the DOM and replacing them with clones
    const executeAllScripts = async () => {
      try {
        // Wait for the DOM to be ready
        await sleep(100);

        // Find all script elements in the cloned content
        const existingScripts = document.querySelectorAll('.cloned-content script');
        console.log('Found scripts to execute:', existingScripts.length);

        for (const oldScript of Array.from(existingScripts)) {
          const scriptElement = document.createElement('script');

          // Copy all attributes
          Array.from(oldScript.attributes).forEach(attr => {
            scriptElement.setAttribute(attr.name, attr.value);
          });

          const src = oldScript.getAttribute('src');
          const hasContent = oldScript.textContent && oldScript.textContent.trim();

          if (src) {
            // External script - wait for it to load
            await waitForLoadOrError(scriptElement);
            await sleep(50);
          } else if (hasContent) {
            // Inline script - copy content
            scriptElement.textContent = oldScript.textContent;
            await sleep(0);
          }

          // Replace the old (inert) script with the new (executable) one
          oldScript.parentNode?.replaceChild(scriptElement, oldScript);
          executedScripts.current.push(scriptElement);
        }

        // Also inject site-specific scripts if needed
        if (pageUrl && pageUrl.includes('link.springer.com')) {
          const mathjaxUrl = 'cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js';
          const src = apiBase ? `${apiBase}/proxy/${mathjaxUrl}` : mathjaxUrl;

          const mathjaxScript = document.createElement('script');
          mathjaxScript.src = src;
          mathjaxScript.type = 'text/javascript';
          document.head.appendChild(mathjaxScript);
          executedScripts.current.push(mathjaxScript);
          await waitForLoadOrError(mathjaxScript);
        }
      } catch (error) {
        console.error('Error executing scripts:', error);
      }
    };

    executeAllScripts();

    // Cleanup function
    return () => {
      executedScripts.current.forEach(s => {
        try { s.remove(); } catch { }
      });
      executedScripts.current = [];
      hasExecuted.current = false;
    };
  }, [scripts, pageUrl, apiBase]);
}

export function useClickHref(
  contentRef: RefObject<HTMLElement | null>,
  onExternalHref: (href: string) => void
) {
  useEffect(() => {
    const el = contentRef?.current;
    if (!el) return;

    const onClick = (e: MouseEvent) => {
      // Only handle primary button clicks without modifier keys
      if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const target = e.target as Element | null;
      if (!target) return;

      // Find nearest anchor
      const anchor = (target as Element).closest ? (target as Element).closest('a[href]') as HTMLAnchorElement | null : null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore anchors that are javascript: or anchor links
      if (href.startsWith('javascript:') || href.startsWith('#')) return;

      try {
        const linkUrl = new URL(href, window.location.href);

        // If same origin, let the browser handle it
        if (linkUrl.origin === window.location.origin) return;

        // External link: notify by calling the callback
        e.preventDefault();
        onExternalHref(linkUrl.href);
      } catch (err) {
        // If URL parsing fails, don't intercept
        return;
      }
    };

    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [contentRef, onExternalHref]);
}

export function useOptimalContentContainer(
  clonedRef: RefObject<HTMLDivElement | null>,
  contentReady: boolean
) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!contentReady) return;

    const findOptimalContainer = async () => {
      const clonedContent = clonedRef.current?.querySelector('.cloned-content');
      if (!clonedContent) {
        console.warn('No .cloned-content found in wrapper');
        return;
      }

      const { findBestTextNode } = await import('../utils/dom');
      const optimalElement = findBestTextNode(clonedContent as Element, 0.9, 20);

      if (optimalElement) {
        (contentRef as React.RefObject<HTMLDivElement | null>).current = optimalElement as HTMLDivElement;
      } else {
        (contentRef as React.RefObject<HTMLDivElement | null>).current = clonedContent as HTMLDivElement;
      }
    };

    findOptimalContainer();
  }, [contentReady, clonedRef]);
  return contentRef;
}