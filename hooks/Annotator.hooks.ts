import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { matchedRange, highlightRange, rangeToHtml, findBestTextNode } from '../utils/dom';
import { getPage, createOrUpdatePage } from '../utils/database';

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
  // Track which annotations have been successfully matched to avoid re-matching
  const matchedAnnotationIdsRef = useRef<Set<string>>(new Set());
  // Track the last ready state and annotation set to prevent duplicate runs
  const lastProcessedRef = useRef<{ ready: boolean; annotationIds: string[] }>({ ready: false, annotationIds: [] });

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
    if (!annotations || annotations.length === 0) return;

    // Check if we should skip this matching run
    const currentAnnotationIds = annotations.map(a => a.id).sort();
    const lastAnnotationIds = lastProcessedRef.current.annotationIds;
    const sameAnnotations = currentAnnotationIds.length === lastAnnotationIds.length &&
      currentAnnotationIds.every((id, idx) => id === lastAnnotationIds[idx]);

    // Skip if we've already processed these exact annotations when ready was true
    if (lastProcessedRef.current.ready && sameAnnotations) {
      return;
    }

    // Update tracking
    lastProcessedRef.current = { ready, annotationIds: currentAnnotationIds };

    // clear previous timers when rerunning
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    // Only clear data for annotations that are no longer in the list
    const currentIds = new Set(currentAnnotationIds);
    setRenderedHtmlMap(prev => {
      const filtered: Record<string, string> = {};
      for (const id of Object.keys(prev)) {
        if (currentIds.has(id)) {
          filtered[id] = prev[id];
        }
      }
      return filtered;
    });

    // Only keep results for current annotations
    setRangeResults(prev => {
      const filtered = prev.filter(r => currentIds.has(r.id));

      // For annotations that are already matched but don't have results yet, add them
      const existingResultIds = new Set(filtered.map(r => r.id));
      const alreadyMatchedWithoutResults = annotations
        .filter(a => matchedAnnotationIdsRef.current.has(a.id) && !existingResultIds.has(a.id))
        .map(a => ({
          id: a.id,
          snippet: a.text.substring(0, 120),
          success: true,
          message: 'Already matched'
        }));

      return [...filtered, ...alreadyMatchedWithoutResults];
    });

    // Only match annotations that haven't been successfully matched yet
    const annotationsToMatch = annotations.filter(a => !matchedAnnotationIdsRef.current.has(a.id));

    if (annotationsToMatch.length === 0) {
      // All annotations already matched
      setIsMatching(false);
      return;
    }

    // Set isMatching to true when starting
    setIsMatching(true);
    pendingMatchesRef.current = annotationsToMatch.length;

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

    annotationsToMatch.forEach(ann => {
      const tryRestore = () => {
        const range = matchedRange(container, ann.text);
        const html = rangeToHtml(range);
        if (range) {
          highlightRange(range, ann.color || '#ffff00', ann.id);
          // Mark as successfully matched
          matchedAnnotationIdsRef.current.add(ann.id);
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

  // Reset tracking when pageUrl changes (new page)
  useEffect(() => {
    matchedAnnotationIdsRef.current.clear();
    lastProcessedRef.current = { ready: false, annotationIds: [] };
    setRangeResults([]);
    setRenderedHtmlMap({});
  }, [pageUrl]);

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
        // Prepare currentData either from kvData or by fetching latest KV to avoid overwriting newer values
        let currentData: { numberOfScripts?: number; numberOfSuccess?: number } | null = null;
        if (kvData && typeof kvData === 'object') {
          currentData = { ...kvData };
        } else {
          // fetch latest from pages API to merge safely
          try {
            const page = await getPage(pageUrl);
            if (page) {
              currentData = {
                numberOfScripts: page.number_of_scripts,
                numberOfSuccess: page.number_of_annotations
              };
            }
          } catch (e) {
            // ignore fetch failures; we'll create a new object below
          }
        }

        if (!currentData) currentData = { numberOfScripts: undefined, numberOfSuccess: 0 };

        // Set or update numberOfScripts conservatively: only increase to the observed executedScripts
        if (typeof executedScripts === 'number' && executedScripts > 0) {
          if (currentData.numberOfScripts === undefined || executedScripts > (currentData.numberOfScripts || 0)) {
            currentData.numberOfScripts = executedScripts;
          }
        }

        // Increment numberOfSuccess (number of times annotations were successfully matched)
        currentData.numberOfSuccess = (currentData.numberOfSuccess || 0) + 1;

        // Update page in database
        const page = await getPage(pageUrl);
        if (page) {
          await createOrUpdatePage(
            pageUrl,
            page.title,
            currentData.numberOfScripts || 0
          );
        }

        console.log(`Updated page for ${pageUrl}:`, currentData);
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

  // Use a ref to track expected scripts to avoid effect re-running when it's set
  const numberOfScriptsRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let done = false;
    const startTime = Date.now();
    const signaled = new Set<string>();
    const STALL_TIMEOUT = 3000;
    let lastSeenCount = 0;
    let lastChangeTime = Date.now();

    // Fetch numberOfScripts from pages API if available
    const fetchPageData = async () => {
      if (!pageUrl || !apiBase) return;

      try {
        const page = await getPage(pageUrl);
        if (page) {
          const data = {
            numberOfScripts: page.number_of_scripts,
            numberOfSuccess: page.number_of_annotations
          };
          setKvData(data);
          if (page.number_of_scripts > 0) {
            numberOfScriptsRef.current = page.number_of_scripts;
            setNumberOfScripts(page.number_of_scripts);
            console.log(`Expecting ${page.number_of_scripts} scripts for ${pageUrl}`);
          }
        } else {
          // Page not found is expected on first load - silently ignore
          console.log('Page data not found (first load)');
        }
      } catch (e) {
        console.log(e);
      }
    };

    fetchPageData();

    // Hard timeout: after 10s, give up waiting for more signals and hand off to range-matching
    const HARD_TIMEOUT = 10000;
    const hardTimer = window.setTimeout(async () => {
      try {
        if (done) return;
        console.log(`Hard timeout after ${HARD_TIMEOUT}ms waiting for script signals`);

        // If we expected more scripts than we've seen, update page with the observed value
        if (pageUrl && apiBase) {
          try {
            // Fetch current page data
            const page = await getPage(pageUrl);
            let current: { numberOfScripts?: number; numberOfSuccess?: number } | null = null;
            if (page) {
              current = {
                numberOfScripts: page.number_of_scripts,
                numberOfSuccess: page.number_of_annotations
              };
            }

            const currentCount = current && typeof current.numberOfScripts === 'number' ? current.numberOfScripts : undefined;
            if (typeof currentCount === 'number') {
              if (signaled.size > currentCount) {
                // Observed more than stored -> update upward
                if (page) {
                  await createOrUpdatePage(
                    pageUrl,
                    page.title,
                    signaled.size
                  );
                  console.log(`Page updated for ${pageUrl}: ${signaled.size} scripts`);
                }
              } else {
                // Do not lower stored expected scripts — skip to avoid overwriting a correct higher value
                console.log(`Skipping page update on hard timeout: stored ${currentCount} >= observed ${signaled.size}`);
              }
            } else {
              // No stored count — create page with observed count so future loads will expect the observed number
              if (page) {
                await createOrUpdatePage(
                  pageUrl,
                  page.title,
                  signaled.size
                );
                console.log(`Page initialized for ${pageUrl}: ${signaled.size} scripts`);
              }
            }
          } catch (e) {
            console.warn('Hard timeout page handling error', e);
          }
        }

        // finish and let range-matching proceed
        logAndFinish('hard timeout');
      } catch (e) {
        console.warn('Hard timeout handler error', e);
        logAndFinish('hard timeout');
      }
    }, HARD_TIMEOUT);

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
      try { clearTimeout(hardTimer); } catch { }
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
          if (numberOfScriptsRef.current !== undefined) {
            if (!done && signaled.size >= numberOfScriptsRef.current) {
              console.log(`Reached expected number of scripts: ${numberOfScriptsRef.current}`);
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
  }, [pageUrl, apiBase]); // Removed numberOfScripts from dependencies - it's managed via ref to prevent re-runs

  return { totalTime, error, success, numberOfScripts, executedScripts, kvData };
}



export function useScriptLoader(
  scripts: Array<{ id?: string; src?: string; content?: string; type?: string; async?: boolean; defer?: boolean; location?: 'head' | 'body' }>,
  pageUrl?: string,
  apiBase?: string
) {
  const executedScripts = useRef<HTMLScriptElement[]>([]);

  useEffect(() => {
    if (!scripts || scripts.length === 0) return;

    let cancelled = false;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const waitForLoadOrError = (el: HTMLScriptElement) => new Promise<void>((resolve) => {
      const onLoad = () => resolve();
      const onError = (ev?: Event) => {
        console.error('Script load error for', el.src, ev);
        resolve();
      };
      el.addEventListener('load', onLoad, { once: true });
      el.addEventListener('error', onError as EventListener, { once: true });
    });

    const pushProxySignal = (u: string) => {
      try {
        const w = window as unknown as { __proxy_script_executed?: string[] };
        w.__proxy_script_executed = w.__proxy_script_executed || [];
        w.__proxy_script_executed.push(u);
        const ev = new CustomEvent('proxy:script-executed', { detail: { url: u } });
        window.dispatchEvent(ev);
      } catch { }
    };

    // Injected as the very first script, before any cloned scripts run.
    // Patches all the common ways JS can load root-relative resources so that
    //   /some/path  →  /_proxy/{slug}/some/path
    // The slug is always the first segment of window.location.pathname.
    const ROOT_RELATIVE_INTERCEPTOR = `(function(){
      if(window.__proxyRootRewritePatched)return;
      window.__proxyRootRewritePatched=true;
      var slug=window.location.pathname.split('/').filter(Boolean)[0];
      if(!slug)return;
      var base='/_proxy/'+slug;
      function rw(u){
        if(!u||typeof u!=='string')return u;
        if(u.startsWith('/')&&!u.startsWith('//')&&!u.startsWith('/_proxy/')&&!u.startsWith('/_next/')&&!u.startsWith('/api/'))
          return base+u;
        return u;
      }
      // Blocked third-party domains — scripts from these hosts require their
      // own origin / HTTPS and will always fail or error in our proxy context.
      var BLOCKED=['googletagmanager.com','google-analytics.com','hotjar.com',
        'static.hotjar.com','script.hotjar.com','doubleclick.net',
        'googlesyndication.com','connect.facebook.net','cdn.cookielaw.org',
        'onetrust.com','cookiebot.com'];
      function isBlocked(u){
        try{var h=new NativeURL(u).hostname;return BLOCKED.some(function(d){return h===d||h.endsWith('.'+d);});}catch(e){return false;}
      }
      // HTMLScriptElement.src — rewrite root-relative AND block tracker domains
      var sDesc=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
      Object.defineProperty(HTMLScriptElement.prototype,'src',{get:sDesc.get,set:function(v){
        if(typeof v==='string'&&isBlocked(v)){this.type='javascript/blocked';return;}
        sDesc.set.call(this,rw(v));
      },configurable:true});
      // HTMLLinkElement.href (stylesheet dynamic loading)
      var lDesc=Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype,'href');
      if(lDesc&&lDesc.set)Object.defineProperty(HTMLLinkElement.prototype,'href',{get:lDesc.get,set:function(v){lDesc.set.call(this,rw(v));},configurable:true});
      // HTMLImageElement.src
      var iDesc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
      if(iDesc&&iDesc.set)Object.defineProperty(HTMLImageElement.prototype,'src',{get:iDesc.get,set:function(v){iDesc.set.call(this,rw(v));},configurable:true});
      // Element.setAttribute
      var origSetAttr=Element.prototype.setAttribute;
      Element.prototype.setAttribute=function(n,v){
        if(n==='src'&&typeof v==='string'){
          if(isBlocked(v)){this.type='javascript/blocked';return;}
          return origSetAttr.call(this,n,rw(v));
        }
        if(n==='href'&&typeof v==='string')return origSetAttr.call(this,n,rw(v));
        return origSetAttr.call(this,n,v);
      };
      // fetch
      var origFetch=window.fetch;
      window.fetch=function(input,init){
        if(typeof input==='string')input=rw(input);
        else if(input instanceof Request){var u=rw(input.url);if(u!==input.url)input=new Request(u,input);}
        return origFetch.call(this,input,init);
      };
      // XMLHttpRequest.open
      var origOpen=XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open=function(method,url){
        if(typeof url==='string')url=rw(url);
        return origOpen.apply(this,[method,url].concat(Array.prototype.slice.call(arguments,2)));
      };
      // new URL(path) when path is root-relative and no explicit base given —
      // intercept via URL constructor replacement
      var NativeURL=window.URL;
      try{
        window.URL=function URL(u,base){
          if(!base&&typeof u==='string')u=rw(u);
          return new NativeURL(u,base||window.location.href);
        };
        window.URL.prototype=NativeURL.prototype;
        window.URL.createObjectURL=NativeURL.createObjectURL.bind(NativeURL);
        window.URL.revokeObjectURL=NativeURL.revokeObjectURL.bind(NativeURL);
      }catch(e){}
    })();`;

    const JQUERY_READY_INTERCEPTOR = `(function(){
      var jq=window.jQuery||window.$;
      if(!jq||window.__proxyReadyPatched)return;
      window.__proxyReadyPatched=true;
      var q=[];
      var _orig=jq.fn.ready;
      jq.fn.ready=function(fn){q.push(fn);return this;};
      var origJQ=window.jQuery;
      if(origJQ){
        var w=function(sel){if(typeof sel==='function'){q.push(sel);return origJQ(document);}return origJQ.apply(this,arguments);};
        Object.assign(w,origJQ);w.fn=origJQ.fn;w.prototype=origJQ.prototype;
        window.jQuery=window.$=w;
      }
      window.__flushProxyReady=function(){
        if(origJQ){origJQ.fn.ready=_orig;window.jQuery=window.$=origJQ;}
        q.forEach(function(fn){try{fn(window.jQuery);}catch(e){console.warn('[proxy] ready-cb',e);}});
      };
    })();`;

    // Flush a batch of external scripts: register listeners first (so we
    // never miss a cache-hit 'load' event), then append them all at once.
    // With async=false the browser fetches concurrently but runs them in
    // insertion order, just like the parser does for normal <script> elements.
    const flushExternalBatch = async (
      batch: { el: HTMLScriptElement; signalKey: string }[],
      parent: HTMLElement
    ) => {
      if (batch.length === 0) return;
      const promises = batch.map(({ el }) => waitForLoadOrError(el));
      for (const { el } of batch) {
        el.async = false;
        parent.appendChild(el);
        executedScripts.current.push(el);
      }
      await Promise.all(promises);
    };

    const injectScripts = async () => {
      try {
        await sleep(50);
        if (cancelled) return;

        const parent = document.head || document.body;
        let jqueryPatched = false;

        // Inject the root-relative URL rewriter first so that any runtime
        // loadScript('/root/path') call goes through /_proxy/{slug}/root/path
        // regardless of which script issues it.
        const interceptorEl = document.createElement('script');
        interceptorEl.text = ROOT_RELATIVE_INTERCEPTOR;
        parent.appendChild(interceptorEl);
        executedScripts.current.push(interceptorEl);

        // Process scripts in document order.
        // External scripts are batched together so the browser fetches them
        // concurrently but executes them in order (async=false).
        // When an inline script is encountered we first drain the external
        // batch (waiting for every load), guaranteeing every global the
        // inline script depends on is already defined.
        let externalBatch: { el: HTMLScriptElement; signalKey: string }[] = [];

        for (let i = 0; i < scripts.length; i++) {
          if (cancelled) return;
          const s = scripts[i];

          if (s.src) {
            // ── External script: accumulate into the current batch ──────
            const el = document.createElement('script');
            if (s.type) el.type = s.type;
            if (s.defer) el.defer = true;
            el.src = s.src;
            externalBatch.push({ el, signalKey: s.id || s.src });

          } else if (s.content) {
            // ── Inline script: drain pending externals first ────────────
            await flushExternalBatch(externalBatch, parent);
            for (const { signalKey } of externalBatch) pushProxySignal(signalKey);

            // After externals land, patch jQuery ready-queue if available
            if (!jqueryPatched && (window as any).jQuery) {
              jqueryPatched = true;
              const patch = document.createElement('script');
              patch.text = JQUERY_READY_INTERCEPTOR;
              parent.appendChild(patch);
              executedScripts.current.push(patch);
            }

            externalBatch = [];

            // Now append the inline script — all its dependencies are ready.
            const el = document.createElement('script');
            if (s.type) el.type = s.type;
            el.text = s.content;
            parent.appendChild(el);
            executedScripts.current.push(el);
            pushProxySignal(s.id || `${pageUrl ?? ''}#inline-${i}`);
          }
        }

        // Drain any trailing external scripts.
        await flushExternalBatch(externalBatch, parent);
        for (const { signalKey } of externalBatch) pushProxySignal(signalKey);

        // If jQuery appeared in a trailing external batch, patch it now.
        if (!jqueryPatched && (window as any).jQuery) {
          jqueryPatched = true;
          const patch = document.createElement('script');
          patch.text = JQUERY_READY_INTERCEPTOR;
          parent.appendChild(patch);
          executedScripts.current.push(patch);
        }

        // Flush all queued $(document).ready() callbacks — every global
        // that any callback could need is now defined.
        if (jqueryPatched && (window as any).__flushProxyReady) {
          try { (window as any).__flushProxyReady(); } catch { }
        }

        // Springer: load MathJax directly from CDN.
        if (pageUrl && pageUrl.includes('link.springer.com')) {
          const src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js';
          const mjEl = document.createElement('script');
          mjEl.src = src;
          const mjPromise = waitForLoadOrError(mjEl);
          mjEl.async = false;
          parent.appendChild(mjEl);
          executedScripts.current.push(mjEl);
          await mjPromise;
          pushProxySignal(src);
        }
      } catch (error) {
        console.error('Error injecting scripts:', error);
      }
    };

    injectScripts();

    return () => {
      cancelled = true;
      executedScripts.current.forEach(s => {
        try { s.remove(); } catch { }
      });
      executedScripts.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(scripts || []), pageUrl, apiBase]);
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