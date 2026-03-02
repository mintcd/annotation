'use client';

import { useState } from 'react';
import promptBoxStyles from '../styles/PromptBox.styles';

type Props = {
  error: string;
  site: string;
  /** path without leading slash, e.g. "article/10.1007/s11098-025-02457-y" */
  path: string;
  onSuccess: () => void;
  onClose: () => void;
};

export default function PasteHTML({ error, site, path, onSuccess, onClose }: Props) {
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleSubmit() {
    const trimmed = html.trim();
    if (!trimmed) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/webpages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, path, html: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setSaveError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      onSuccess();
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const instructions = [
    'Open the page in your browser.',
    'Press Ctrl+A (Cmd+A on Mac) to select all, then Ctrl+U (Cmd+U) to view source.',
    'Or right-click → "View Page Source", then Ctrl+A → Ctrl+C.',
    'Paste the full HTML below.',
  ];

  return (
    <div style={promptBoxStyles.backdrop}>
      <div style={promptBoxStyles.overlay} onClick={onClose} />
      <div style={{ ...promptBoxStyles.modal, maxWidth: 'min(680px, calc(100dvw - 1rem))' }}>
        <div style={promptBoxStyles.content}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Page could not be fetched automatically
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            <code style={{ background: '#f3f4f6', padding: '2px 5px', borderRadius: 3 }}>{error}</code>
          </div>
          <ol style={{ fontSize: '0.8rem', color: '#374151', paddingLeft: '1.1rem', margin: '0 0 0.75rem' }}>
            {instructions.map((s, i) => <li key={i} style={{ marginBottom: 2 }}>{s}</li>)}
          </ol>
          <textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            placeholder="Paste full page HTML here…"
            rows={10}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              resize: 'vertical',
            }}
          />
          {saveError && (
            <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem' }}>{saveError}</div>
          )}
          <div style={promptBoxStyles.actions}>
            <button
              type="button"
              style={promptBoxStyles.buttonVariant('primary')}
              onClick={handleSubmit}
              disabled={saving || !html.trim()}
            >
              {saving ? 'Saving…' : 'Save & Load'}
            </button>
            <button
              type="button"
              style={promptBoxStyles.buttonVariant('neutral')}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
