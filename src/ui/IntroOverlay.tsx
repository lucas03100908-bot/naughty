'use client';
import { useApp } from '@/src/game/store';
import styles from './ui.module.css';

/**
 * Santa's list, corrected: NICE struck out in red pen above NAUGHTY LIST. The strike draws itself
 * in once the page has settled.
 */
function Title() {
  return (
    <h1 className={styles.title} aria-label="Naughty List">
      <span className={styles.titleNice} aria-hidden="true">
        NICE
        <svg className={styles.titleStrike} viewBox="0 0 120 24" preserveAspectRatio="none">
          <path d="M3 15 C 30 9, 52 17, 78 10 S 108 8, 117 11" />
          <path d="M8 18 C 40 12, 70 19, 114 13" />
        </svg>
      </span>
      <span aria-hidden="true">NAUGHTY LIST</span>
    </h1>
  );
}

/**
 * `intro`, outside the globe. First pick an input (camera or mouse); then the globe is idle and
 * the viewer can look around, tilt and shake it until they press start.
 */
export function IntroOverlay({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  const mode = useApp((s) => s.mode);
  const status = useApp((s) => s.status);
  const phase = useApp((s) => s.phase);
  const begin = useApp((s) => s.begin);
  if (phase !== 'intro') return null;

  if (mode === 'none') {
    const loading = status === 'loading';
    return (
      <div className={styles.intro}>
        <Title />
        <p className={styles.lede}>
          <span className={styles.ledeMain}>머리를 움직여 스노우볼을 들여다보세요.</span>
          <span className={styles.ledeNote}>카메라 영상은 이 브라우저 밖으로 나가지 않아요.</span>
        </p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={onCamera} disabled={loading}>
            {loading ? '카메라 준비 중…' : '카메라 켜기'}
          </button>
          <button className={styles.secondary} onClick={onMouse} disabled={loading}>
            마우스로 하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.intro}>
      <p className={styles.lede}>
        {mode === 'camera' ? (
          <>
            <span className={styles.ledeMain}>고개를 움직여 둘러보세요.</span>
            <span className={styles.ledeMain}>도리도리하면 눈이 흩날려요.</span>
          </>
        ) : (
          <>
            <span className={styles.ledeMain}>마우스로 둘러보세요.</span>
            <span className={styles.ledeMain}>좌우로 빠르게 흔들면 눈이 흩날려요.</span>
          </>
        )}
      </p>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={begin}>
          시작하기
        </button>
      </div>
    </div>
  );
}
