import { TITLES } from '@/src/game/constants';
import { DISPLAY_EXTRA, LINES } from './copy';
import styles from './ui.module.css';

/**
 * The Korean kit is dynamically subset: it only fetches glyphs for text it finds on the page.
 * Subtitles appear later and the plaque / share image draw on a canvas, so put every display
 * string on the page from the start, invisible, in the display face.
 */
export function GlyphPrimer() {
  const text = [...Object.values(LINES), ...DISPLAY_EXTRA, ...TITLES.map((t) => t.name)].join(' ');
  return (
    <span className={styles.glyphPrimer} aria-hidden>
      {text}
    </span>
  );
}
