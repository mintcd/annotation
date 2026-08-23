export const DARK_MODE_STYLE_ID = 'annotation-dark-mode-styles';
export const DARK_MODE_CLASS = 'annotation-dark-mode';

export const FRAME_DARK_MODE_CSS = `
  html.annotation-dark-mode,
  html.annotation-dark-mode body {
    color-scheme: dark !important;
  }

  html.annotation-dark-mode :where(input, textarea, select, button) {
    color-scheme: dark !important;
  }

  html.annotation-dark-mode.annotation-reading-mode,
  html.annotation-dark-mode.annotation-reading-mode body {
    background: #0f172a !important;
    color: #e5e7eb !important;
  }

  html.annotation-dark-mode.annotation-reading-mode [data-annotation-reading-root="true"] {
    background: transparent !important;
    color: #e5e7eb !important;
  }

  html.annotation-dark-mode.annotation-reading-mode [data-annotation-reading-root="true"]
    :where(article, main, section, div, header, footer, aside, nav, p, span:not(.highlighted-text), ul, ol, li, dl, dt, dd, blockquote, h1, h2, h3, h4, h5, h6) {
    background-color: transparent !important;
    border-color: #374151 !important;
    color: inherit !important;
  }

  html.annotation-dark-mode.annotation-reading-mode [data-annotation-reading-root="true"]
    :where(a, a:visited) {
    color: #93c5fd !important;
  }

  html.annotation-dark-mode.annotation-reading-mode [data-annotation-reading-root="true"]
    :where(pre, code, kbd, samp, th, td) {
    background-color: #111827 !important;
    border-color: #374151 !important;
    color: #e5e7eb !important;
  }

  html.annotation-dark-mode.annotation-reading-mode [data-annotation-reading-root="true"] hr {
    border-color: #374151 !important;
  }
`;
