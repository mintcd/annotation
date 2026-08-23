import assert from 'node:assert/strict';
import test from 'node:test';

import * as cheerio from 'cheerio';

import { injectFrameDarkModeStyles } from '../core/frame/darkModeProxy.ts';
import {
  DARK_MODE_STYLE_ID,
  FRAME_DARK_MODE_CSS,
} from '../core/frame/darkModeStyles.ts';

test('injects dark-mode styles after the source page styles', () => {
  const $ = cheerio.load('<html><head><style id="source">body { color: red; }</style></head><body></body></html>');

  injectFrameDarkModeStyles($);

  const styles = $('head style');
  assert.equal(styles.length, 2);
  assert.equal(styles.last().attr('id'), DARK_MODE_STYLE_ID);
  assert.equal(styles.last().text(), FRAME_DARK_MODE_CSS);
});

test('replaces a stale injected stylesheet instead of duplicating it', () => {
  const $ = cheerio.load(`<html><head><style id="${DARK_MODE_STYLE_ID}">stale</style></head><body></body></html>`);

  injectFrameDarkModeStyles($);
  injectFrameDarkModeStyles($);

  const injected = $(`style#${DARK_MODE_STYLE_ID}`);
  assert.equal(injected.length, 1);
  assert.equal(injected.attr('data-annotation-proxy-style'), 'true');
  assert.equal(injected.text(), FRAME_DARK_MODE_CSS);
});
