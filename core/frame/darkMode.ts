import {
  DARK_MODE_CLASS,
  DARK_MODE_STYLE_ID,
  FRAME_DARK_MODE_CSS,
} from './darkModeStyles.ts';

export function applyFrameDarkMode(doc: Document, _contentRoot: HTMLElement): () => void {
  const html = doc.documentElement;
  const body = doc.body;
  if (!html || !body) return () => undefined;

  const htmlHadClass = html.classList.contains(DARK_MODE_CLASS);
  const bodyHadClass = body.classList.contains(DARK_MODE_CLASS);

  let style = doc.getElementById(DARK_MODE_STYLE_ID) as HTMLStyleElement | null;
  const createdStyle = !style;
  if (!style) {
    style = doc.createElement('style');
    style.id = DARK_MODE_STYLE_ID;
    style.textContent = FRAME_DARK_MODE_CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  html.classList.add(DARK_MODE_CLASS);
  body.classList.add(DARK_MODE_CLASS);

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;

    if (!bodyHadClass) body.classList.remove(DARK_MODE_CLASS);
    if (!htmlHadClass) html.classList.remove(DARK_MODE_CLASS);
    if (createdStyle) style?.remove();
  };
}
