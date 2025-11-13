import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { matchedRange, highlightRange, rangeToHtml, findBestTextNode } from '../utils/dom';

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

type Result = {
  totalTime: number;
  error?: string | null;
  success: boolean;
  numberOfScripts?: number;
  executedScripts: number;
  kvData: { numberOfScripts?: number; numberOfSuccess?: number } | null;
};

export function useRangeMatching(
  contentRef: RefObject<HTMLElement | null>,
  annotations: AnnotationItem[] | undefined,
  ready: boolean,
  pageUrl: string,
  apiBase: string,
  executedScripts?: number,
  kvData?: { numberOfScripts?: number; numberOfSuccess?: number } | null,
  options: Options = {}
) {
  const [rangeResults, setRangeResults] = useState<RangeResult[]>([]);
  const [renderedHtmlMap, setRenderedHtmlMap] = useState<Record<string, string>>({});
  const [isMatching, setIsMatching] = useState(false);
  const timersRef = useRef<number[]>([]);
  const pendingMatchesRef = useRef(0);

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
    // Clear previous results
    setRangeResults([]);

    // Set isMatching to true when starting
    setIsMatching(true);
    pendingMatchesRef.current = annotations?.length || 0;

    // Wait for DOM to stabilize after scripts execute
    const waitForDOMStability = (callback: () => void, maxWaitTime: number = 3000) => {
      let mutationTimeout: number | null = null;
      let totalWaitTimer: number | null = null;
      let lastMutationTime = Date.now();
      const STABILITY_THRESHOLD = 500; // Wait 500ms of no mutations before considering DOM stable

      const observer = new MutationObserver(() => {
        lastMutationTime = Date.now();

        // Clear previous timeout
        if (mutationTimeout !== null) {
          clearTimeout(mutationTimeout);
        }

        // Set new timeout to check stability
        mutationTimeout = window.setTimeout(() => {
          observer.disconnect();
          if (totalWaitTimer !== null) {
            clearTimeout(totalWaitTimer);
          }
          callback();
        }, STABILITY_THRESHOLD);
      });

      // Start observing
      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });

      // Set maximum wait time
      totalWaitTimer = window.setTimeout(() => {
        observer.disconnect();
        if (mutationTimeout !== null) {
          clearTimeout(mutationTimeout);
        }
        callback();
      }, maxWaitTime);

      // Store timer refs for cleanup
      timersRef.current.push(totalWaitTimer);
      if (mutationTimeout !== null) {
        timersRef.current.push(mutationTimeout);
      }

      // Initial check - if DOM hasn't changed recently, callback immediately
      const initialStableTimer = window.setTimeout(() => {
        if (Date.now() - lastMutationTime >= STABILITY_THRESHOLD) {
          observer.disconnect();
          if (totalWaitTimer !== null) {
            clearTimeout(totalWaitTimer);
          }
          if (mutationTimeout !== null) {
            clearTimeout(mutationTimeout);
          }
          callback();
        }
      }, 100);

      timersRef.current.push(initialStableTimer);
    };

    annotations?.forEach(ann => {
      const tryRestore = () => {
        const range = matchedRange(container, ann.text);
        const html = rangeToHtml(range);
        if (range) {
          highlightRange(range, ann.color || '#ffff00', ann.id);
          try {
            setRenderedHtmlMap(prev => ({ ...prev, [ann.id]: html }));
            updateRangeResult(ann.id, { success: true, snippet: ann.text.substring(0, 120), message: 'Restored' });
          } catch (err) {
            // still mark success, but note failure to render HTML
            updateRangeResult(ann.id, { success: true, snippet: ann.text.substring(0, 120), message: 'Restored (rangeToHtml failed)' });
          }
        } else {
          const msg = `Could not restore highlight. Container content length: ${container.innerHTML.length}`;
          updateRangeResult(ann.id, { success: false, snippet: ann.text.substring(0, 120), message: msg });
        }

        // Decrement pending matches counter
        pendingMatchesRef.current--;
        if (pendingMatchesRef.current <= 0) {
          setIsMatching(false);
        }
      };

      if (container.innerHTML.trim().length > 0) {
        // Wait for DOM to stabilize before trying to match ranges
        waitForDOMStability(tryRestore);
      } else {
        const t = window.setTimeout(() => waitForDOMStability(tryRestore), 500);
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

  // Update KV when all ranges are successfully matched (only once)
  const hasUpdatedKVRef = useRef(false);
  useEffect(() => {
    // Only update if all matched, not currently matching, and haven't updated yet
    if (!allMatched || isMatching || hasUpdatedKVRef.current) return;
    if (!annotations || annotations.length === 0) return;

    const updateKV = async () => {
      try {
        // Use fetched KV data or create new object
        const currentData = kvData ? { ...kvData } : { numberOfScripts: undefined, numberOfSuccess: 0 };

        // Set numberOfScripts if not already set
        if (currentData.numberOfScripts === undefined && executedScripts && executedScripts > 0) {
          currentData.numberOfScripts = executedScripts;
        }

        // Increment numberOfSuccess
        currentData.numberOfSuccess = (currentData.numberOfSuccess || 0) + 1;

        // Write back to KV
        await fetch(`${apiBase}/kv/set?key=${encodeURIComponent(pageUrl)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: currentData })
        });

        console.log(`Updated KV for ${pageUrl}:`, currentData);
        hasUpdatedKVRef.current = true;
      } catch (e) {
        console.error('Failed to update KV:', e);
      }
    };

    updateKV();
  }, [allMatched, isMatching, apiBase, executedScripts, kvData, pageUrl, annotations]);

  // Reset the KV update flag when ready changes (new page load)
  useEffect(() => {
    hasUpdatedKVRef.current = false;
  }, [ready]);

  const annotationsWithRendered = (annotations || []).map(a => ({
    ...a,
    html: renderedHtmlMap[a.id] ?? a.html,
  }));
  return { rangeResults, allMatched, isMatching, matchedAnnotations: annotationsWithRendered } as const;
}

export function useScriptExecutionTracker(
  pageUrl?: string,
  apiBase?: string
): Result {
  const [totalTime, setTotalTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [numberOfScripts, setNumberOfScripts] = useState<number | undefined>(undefined);
  const [executedScripts, setExecutedScripts] = useState(0);
  const [kvData, setKvData] = useState<{ numberOfScripts?: number; numberOfSuccess?: number } | null>(null);

  useEffect(() => {
    let done = false;
    const startTime = Date.now();
    const signaled = new Set<string>();
    const STALL_TIMEOUT = 3000;
    let lastSeenCount = 0;
    let lastChangeTime = Date.now();

    // Fetch numberOfScripts from KV API if available
    const fetchKVData = async () => {
      if (!pageUrl || !apiBase) return;

      try {
        console.log(`${apiBase}/kv/get?key=${encodeURIComponent(pageUrl)}`);
        const response = await fetch(`${apiBase}/kv/get?key=${encodeURIComponent(pageUrl)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.value && typeof data.value === 'object') {
            setKvData(data.value);
            if ('numberOfScripts' in data.value) {
              setNumberOfScripts(data.value.numberOfScripts);
              console.log(`Loaded numberOfScripts: ${data.value.numberOfScripts} for ${pageUrl}`);
            }
          }
        } else if (response.status === 404) {
          // Key not found is expected on first load - silently ignore
          console.log('KV data not found (first load)');
        }
      } catch (e) {
        console.log(e);
      }
    };

    fetchKVData();

    const logAndFinish = (reason: string) => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - startTime;
      try {
        console.log(`Scripts finished (${reason}). Signals: ${signaled.size}. Elapsed: ${elapsed} ms`);
      } catch { }
      setTotalTime(elapsed);
      setExecutedScripts(signaled.size);
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
          setExecutedScripts(signaled.size);
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
          setExecutedScripts(signaled.size);
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
            setExecutedScripts(signaled.size);
          }

          // If we have numberOfScripts, check if we've reached it
          if (numberOfScripts !== undefined) {
            if (!done && signaled.size >= numberOfScripts) {
              console.log(`Reached expected number of scripts: ${numberOfScripts}`);
              logAndFinish('expected scripts reached');
              return;
            }
          } else {
            // Fall back to STALL_TIMEOUT if we don't have numberOfScripts
            if (!done && Date.now() - lastChangeTime >= STALL_TIMEOUT) {
              console.log(`No new execution for ${STALL_TIMEOUT}ms`);
              logAndFinish('stall timeout');
              return;
            }
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
  }, [pageUrl, apiBase, numberOfScripts]);

  return { totalTime, error, success, numberOfScripts, executedScripts, kvData };
}



// export function useScriptLoader(
//   pageUrl?: string,
//   apiBase?: string
// ) {
//   const executedScripts = useRef<HTMLScriptElement[]>([]);
//   const hasExecuted = useRef(false);

//   useEffect(() => {
//     if (hasExecuted.current) return;
//     hasExecuted.current = true;

//     const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

//     const waitForLoadOrError = (el: HTMLScriptElement) => new Promise<void>((resolve) => {
//       const onLoad = () => resolve();
//       const onError = (ev?: Event) => {
//         console.error('Script load error for', el.src, ev)
//         resolve();
//       };
//       el.addEventListener('load', onLoad, { once: true });
//       el.addEventListener('error', onError as EventListener, { once: true });
//     });

//     // Execute scripts by finding them in the DOM and replacing them with clones
//     const executeAllScripts = async () => {
//       try {
//         // Wait for the DOM to be ready
//         await sleep(100);

//         // Find all script elements in the cloned content
//         const existingScripts = document.querySelectorAll('.cloned-content script');
//         console.log('Found scripts to execute:', existingScripts.length);

//         for (const oldScript of Array.from(existingScripts)) {
//           const scriptElement = document.createElement('script');

//           // Copy all attributes
//           Array.from(oldScript.attributes).forEach(attr => {
//             scriptElement.setAttribute(attr.name, attr.value);
//           });

//           const src = oldScript.getAttribute('src');
//           const hasContent = oldScript.textContent && oldScript.textContent.trim();

//           if (src) {
//             // External script - wait for it to load
//             await waitForLoadOrError(scriptElement);
//             await sleep(50);
//           } else if (hasContent) {
//             // Inline script - copy content
//             scriptElement.textContent = oldScript.textContent;
//             await sleep(0);
//           }

//           // Replace the old (inert) script with the new (executable) one
//           oldScript.parentNode?.replaceChild(scriptElement, oldScript);
//           executedScripts.current.push(scriptElement);
//         }

//         // Also inject site-specific scripts if needed
//         if (pageUrl && pageUrl.includes('link.springer.com')) {
//           const mathjaxUrl = 'cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js';
//           const src = apiBase ? `${apiBase}/proxy/${mathjaxUrl}` : mathjaxUrl;

//           const mathjaxScript = document.createElement('script');
//           mathjaxScript.src = src;
//           mathjaxScript.type = 'text/javascript';
//           document.head.appendChild(mathjaxScript);
//           executedScripts.current.push(mathjaxScript);
//           await waitForLoadOrError(mathjaxScript);
//         }
//       } catch (error) {
//         console.error('Error executing scripts:', error);
//       }
//     };

//     executeAllScripts();

//     // Cleanup function
//     return () => {
//       executedScripts.current.forEach(s => {
//         try { s.remove(); } catch { }
//       });
//       executedScripts.current = [];
//       hasExecuted.current = false;
//     };
//   }, [scripts, pageUrl, apiBase]);
// }

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
  const [containerReady, setContainerReady] = useState(false);
  useEffect(() => {
    if (!contentReady) {
      setContainerReady(false);
      return;
    }

    const clonedContent = clonedRef.current?.querySelector('.cloned-content') as HTMLDivElement;
    if (clonedContent) {
      contentRef.current = clonedContent;
    }

    const findOptimalContainer = () => {
      if (!clonedContent) return;
      const optimalElement = findBestTextNode(clonedContent as Element, 0.9, 20);

      if (optimalElement) {
        contentRef.current = optimalElement as HTMLDivElement;
      }
    };

    findOptimalContainer();
    setContainerReady(true);
  }, [contentReady, clonedRef]);
  return { ref: contentRef, ready: containerReady };
}