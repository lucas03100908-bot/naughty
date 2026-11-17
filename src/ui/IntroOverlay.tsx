'use client';
import { useApp } from '@/src/game/store';
import styles from './ui.module.css';

/** M1 entry: choose camera or mouse. The real intro/start states arrive in M2. */
export function IntroOverlay({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  const mode = useApp((s) => s.mode);
  const status = useApp((s) => s.status);
  if (mode !== 'none') return null;
  const loading = status === 'loading';
  return (
    <div className={styles.intro}>
      <p className={styles.kicker}>M1 기술 검증</p>
      <h1 className={styles.title}>NAUGHTY LIST</h1>
      <p className={styles.lede}>머리를 움직여 스노우볼을 들여다보세요. 카메라 영상은 이 브라우저 밖으로 나가지 않아요.</p>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={onCamera} disabled={loading}>
          {loading ? '카메라 준비 중…' : '카메라로 시작하기'}
        </button>
        <button className={styles.secondary} onClick={onMouse} disabled={loading}>
          마우스로 보기
        </button>
      </div>
    </div>
  );
}
