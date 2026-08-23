import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeUrl, toAnnotatorPath } from '../core/utils/url.ts';

test('keeps source directory semantics and fragments in annotator routes', () => {
  const sourceUrl = 'https://plato.stanford.edu/entries/time/#Fata';

  assert.equal(normalizeUrl(sourceUrl), 'https://plato.stanford.edu/entries/time#Fata');
  assert.equal(
    toAnnotatorPath('plato-stanford-edu', sourceUrl),
    '/plato-stanford-edu/entries/time/#Fata',
  );
});

test('uses the canonical query without changing the source path or fragment', () => {
  assert.equal(
    toAnnotatorPath(
      'example-com',
      'https://example.com/articles/?utm_source=test#notes',
      'https://example.com/articles#notes',
    ),
    '/example-com/articles/#notes',
  );
});
