/**
 * ScriptManager: safe, per-page script injection and execution signaling.
 * - Avoids appending duplicate script nodes
 * - Guards when container/head/body are missing
 * - Emits the `proxy:script-executed` event and pushes to `window.__proxy_script_executed`
 */

export type ScriptItem = { id?: string; src?: string; content?: string; type?: string; async?: boolean; defer?: boolean; location?: 'head' | 'body' };

type PerPage = {
	scriptsById: Map<string, ScriptItem>;
	nodesById: Map<string, HTMLScriptElement[]>;
	executedIds: Set<string>;
	listeners: Set<(id: string) => void>;
	refCount: number;
};

const pages = new Map<string, PerPage>();

function pageKey(pageUrl?: string) {
	return pageUrl || '__default__';
}

function ensurePage(url?: string) {
	const key = pageKey(url);
	if (!pages.has(key)) {
		pages.set(key, {
			scriptsById: new Map(),
			nodesById: new Map(),
			executedIds: new Set(),
			listeners: new Set(),
			refCount: 0,
		});
	}
	return pages.get(key)!;
}

function emitProxySignal(u: string) {
	try {
		const w = window as unknown as { __proxy_script_executed?: string[] };
		w.__proxy_script_executed = w.__proxy_script_executed || [];
		w.__proxy_script_executed.push(u);
		const ev = new CustomEvent('proxy:script-executed', { detail: { url: u } });
		window.dispatchEvent(ev);
	} catch { /* ignore */ }
}

class ScriptManagerClass {
	constructor() {
		// no-op constructor
	}

	loadScripts(pageUrl: string | undefined, scripts: ScriptItem[], opts?: { apiBase?: string; containerSelector?: string }) {
		const key = pageKey(pageUrl);
		const p = ensurePage(pageUrl);
		p.refCount++;

		// normalize and register scripts
		for (let i = 0; i < scripts.length; i++) {
			const s = scripts[i];
			const id = s.id || s.src || `${pageUrl || 'page'}#inline-${i}`;
			if (!p.scriptsById.has(id)) p.scriptsById.set(id, { ...s, id });
		}

		// find container (can be null on some pages) and fall back
		let container: HTMLElement | null = null;
		try {
			container = document.querySelector(opts?.containerSelector || '.cloned-content') as HTMLElement | null;
		} catch { container = null; }

		const head = (typeof document !== 'undefined' && document.head) || null;
		const body = (typeof document !== 'undefined' && document.body) || null;

		for (const [id, s] of p.scriptsById.entries()) {
			if (p.nodesById.has(id)) continue; // already appended

			const nodes: HTMLScriptElement[] = [];
			try {
				if (s.src) {
					// avoid appending if a script with same src or data-proxy-id already exists
					const existing = Array.from(document.querySelectorAll('script')).find(el => {
						try { return (el as HTMLScriptElement).src === s.src || (el as HTMLScriptElement).dataset?.proxyScriptId === id; } catch { return false; }
					});
					if (existing) {
						// mark node as existing but don't append
						p.nodesById.set(id, [existing as HTMLScriptElement]);
						// mark executed immediately if it already ran
						setTimeout(() => this.markExecuted(key, id), 0);
						continue;
					}

					const el = document.createElement('script');
					if (s.type) el.type = s.type;
					if (s.async) el.async = true;
					if (s.defer) el.defer = true;
					el.src = s.src;
					try { (el as any).dataset.proxyScriptId = id; } catch { }

					const onLoad = () => this.markExecuted(key, id);
					const onError = () => this.markExecuted(key, id);
					el.addEventListener('load', onLoad, { once: true });
					el.addEventListener('error', onError, { once: true });

					const parent = container || head || body || document.documentElement;
					try { parent.appendChild(el); } catch (err) { try { (head || body || document.documentElement).appendChild(el); } catch { /* ignore */ } }
					nodes.push(el);
				} else if (s.content) {
					const el = document.createElement('script');
					if (s.type) el.type = s.type;
					try { el.text = s.content; } catch { try { (el as any).textContent = s.content; } catch { /* ignore */ } }
					try { (el as any).dataset.proxyScriptId = id; } catch { }
					const parent = container || body || head || document.documentElement;
					try { parent.appendChild(el); } catch (err) { try { (body || head || document.documentElement).appendChild(el); } catch { /* ignore */ } }
					nodes.push(el);
					// inline scripts execute when appended
					setTimeout(() => this.markExecuted(key, id), 0);
				}
			} catch (e) {
				console.error('ScriptManager: error appending script', id, e);
			}

			if (nodes.length) p.nodesById.set(id, nodes);
		}

		return {
			unsubscribe: () => {
				const cur = pages.get(key);
				if (!cur) return;
				cur.refCount = Math.max(0, cur.refCount - 1);
				if (cur.refCount === 0) {
					// remove appended nodes we created
					for (const nodes of cur.nodesById.values()) {
						for (const n of nodes) {
							try { n.remove(); } catch { }
						}
					}
					cur.nodesById.clear();
				}
			}
		};
	}

	on(pageUrl: string | undefined, cb: (id: string) => void) {
		const p = ensurePage(pageUrl);
		p.listeners.add(cb);
		return () => p.listeners.delete(cb);
	}

	markExecuted(pageKeyStr: string, id: string) {
		const p = pages.get(pageKeyStr);
		if (!p) return;
		if (p.executedIds.has(id)) return;
		p.executedIds.add(id);
		// emit global proxy signal so existing tracker code still works
		emitProxySignal(id);
		for (const l of Array.from(p.listeners)) {
			try { l(id); } catch { }
		}
	}

	getExecutedCount(pageUrl?: string) {
		const p = pages.get(pageKey(pageUrl));
		return p ? p.executedIds.size : 0;
	}

	getExpectedCount(pageUrl?: string) {
		const p = pages.get(pageKey(pageUrl));
		return p ? p.scriptsById.size : 0;
	}
}

const ScriptManager = new ScriptManagerClass();
export default ScriptManager;

