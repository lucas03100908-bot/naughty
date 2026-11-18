'use client';
import { useApp } from '@/src/game/store';
import styles from './ui.module.css';

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
        <h1 className={styles.title}>NAUGHTY LIST</h1>
        <p className={styles.lede}>머리를 움직여 스노우볼을 들여다보세요. 카메라 영상은 이 브라우저 밖으로 나가지 않아요.</p>
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
        {mode === 'camera'
          ? '고개를 움직여 둘러보고, 도리도리하면 눈이 흩날려요.'
          : '마우스로 둘러보고, 마우스를 좌우로 빠르게 흔들면 눈이 흩날려요.'}
      </p>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={begin}>
          시작하기
        </button>
      </div>
    </div>
  );
}
