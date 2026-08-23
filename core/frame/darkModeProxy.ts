import type { CheerioAPI } from 'cheerio';

import {
  DARK_MODE_STYLE_ID,
  FRAME_DARK_MODE_CSS,
} from './darkModeStyles.ts';

export function injectFrameDarkModeStyles($: CheerioAPI): void {
  $(`style#${DARK_MODE_STYLE_ID}`).remove();

  const style = $('<style></style>')
    .attr('id', DARK_MODE_STYLE_ID)
    .attr('data-annotation-proxy-style', 'true')
    .text(FRAME_DARK_MODE_CSS);

  $('head').append(style);
}
