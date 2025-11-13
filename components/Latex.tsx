'use client'


import katex from 'katex';
import 'katex/dist/katex.min.css';
import latexStyles from '../styles/Latex.styles';


function renderLatexInTextAsHTMLString(
  text: string,
  delimiters: Delimiter[],
  strict: boolean,
  macros?: Macros): string {
  const data = splitAtDelimiters(text, delimiters);
  const fragments = []

  for (let i = 0; i < data.length; i++) {
    if (data[i].type === 'text') {
      fragments.push(`${data[i].data}`);
    } else {
      const latex = data[i].data;
      const displayMode = data[i].display;
      // If the math fragment only contains \sc{...} tokens (and optional control-spaces
      // or simple punctuation/parentheses) then convert those to HTML spans directly
      // instead of passing through KaTeX. This avoids brittle global regexes and
      // handles cases like "\sc{TRAVELING}\ \sc{SALESMAN}\ (\sc{TSP})".
      const containsSc = /\\sc\{[^}]*\}/.test(latex);
      const otherCommands = (latex.match(/\\([a-zA-Z]+)/g) || [])
        .map(m => m.slice(1))
        .filter(name => name !== 'sc');

      if (containsSc && otherCommands.length === 0) {
        // safe HTML-escape the content inside \sc{} and replace control-space with ~
        const escapeHtml = (s: string) =>
          s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const converted = latex.replace(/\\sc\{([^}]*)\}(\\\s*)?/g, (_m, p1, p2) => {
          const inner = escapeHtml(String(p1));
          const nbsp = p2 ? '~' : '';
          return `<span class="latex-textsc">${inner}${nbsp}</span>`;
        });

        fragments.push(`${converted}`);
      } else {
        try {
          const rendered = katex.renderToString(latex, { displayMode, macros, output: 'html' });
          fragments.push(`${rendered}`);
        } catch (error) {
          if (strict) {
            throw error;
          }
          fragments.push(`${data[i].data}`);
        }
      }
    }
  }

  return fragments.join('');
};


type Macros = { [name: string]: string };

type KatexData = {
  data: string;
  type: string;
  rawData?: string;
  display?: boolean;
}

type Delimiter = {
  right: string;
  left: string;
  display: boolean;
}


type LatexProps = {
  children: string;
  delimiters?: Delimiter[];
  strict?: boolean;
  macros?: Macros;
  width?: string | number;
  height?: string | number;
}

/* Adapted from /contrib/auto-render/splitAtDelimiters.js at github.com/Khan/KaTeX */
function findEndOfMath(delimiterValue: string, text: string, startIndex: number): number {
  let index = startIndex;
  let braceLevel = 0;

  const delimLength = delimiterValue.length;

  while (index < text.length) {
    const character = text[index];

    if (braceLevel <= 0 &&
      text.slice(index, index + delimLength) === delimiterValue) {
      return index;
    } else if (character === '\\') {
      index++;
    } else if (character === '{') {
      braceLevel++;
    } else if (character === '}') {
      braceLevel--;
    }

    index++;
  }

  return -1;
};

function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
};

const amsRegex = /^\\begin{/;

function splitAtDelimiters(text: string, delimiters: Delimiter[]): KatexData[] {
  let index;
  const data = [];

  const regexLeft = new RegExp(
    "(" + delimiters.map((x) => escapeRegex(x.left)).join("|") + ")"
  );

  while (true) {
    index = text.search(regexLeft);
    if (index === -1) {
      break;
    }
    if (index > 0) {
      data.push({
        type: "text",
        data: text.slice(0, index),
      });
      text = text.slice(index); // now text starts with delimiter
    }
    // ... so this always succeeds:
    const i = delimiters.findIndex((delim) => text.startsWith(delim.left));
    index = findEndOfMath(delimiters[i].right, text, delimiters[i].left.length);
    if (index === -1) {
      break;
    }
    const rawData = text.slice(0, index + delimiters[i].right.length);
    const math = amsRegex.test(rawData)
      ? rawData
      : text.slice(delimiters[i].left.length, index);
    data.push({
      type: "math",
      data: math,
      rawData,
      display: delimiters[i].display,
    });
    text = text.slice(index + delimiters[i].right.length);
  }

  if (text !== "") {
    data.push({
      type: "text",
      data: text,
    });
  }

  return data;
};

export default function Latex({ children, style }: {
  children: string,
  style?: React.CSSProperties
}) {
  const delimiters = [
    { left: '$$', right: '$$', display: true },
    { left: '\\(', right: '\\)', display: false },
    { left: '$', right: '$', display: false },
    { left: '\\[', right: '\\]', display: true },
  ];

  const alphabet: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const macros: Macros = {};

  alphabet.forEach(letter => {
    macros[`\\${letter}${letter}`] = `\\mathbb{${letter}}`;
    macros[`\\${letter}`] = `\\mathcal{${letter}}`;
    macros['\\sc#1'] = `\\require{html}\\htmlClass{textsc}{\\text{#1}}`;
  });

  const preprocessedChildren = String(children).replace(/\\\s+/g, ' ');

  const renderedLatex = renderLatexInTextAsHTMLString(preprocessedChildren, delimiters, false, macros);

  const shouldTruncate = !!(style?.width && style?.height);

  return (
    <span
      className="__latex"
      style={latexStyles.container(style, shouldTruncate)}
      dangerouslySetInnerHTML={{ __html: renderedLatex }}
    />
  );
}
