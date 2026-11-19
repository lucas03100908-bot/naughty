import { PLAY, PRANK } from './constants.ts';

export type PrankId = 'snowman' | 'lamp' | 'tree';

export const PRANK_LABEL: Record<PrankId, string> = {
  snowman: '눈사람',
  lamp: '가로등',
  tree: '트리 별',
};

/** The prank as a task, for records ("눈사람 무너뜨리기 · 9초"): result card and share image. */
export const PRANK_TASK: Record<PrankId, string> = {
  snowman: '눈사람 무너뜨리기',
  lamp: '가로등 끄기',
  tree: '트리 별 떨어뜨리기',
};

/** Faster = more. Linear from maxPoints at 0 s to maxPoints × minShare at the end of play. */
export function prankPoints(elapsedSec: number) {
  const k = Math.min(1, Math.max(PRANK.minShare, 1 - Math.max(0, elapsedSec) / PLAY.durationSec));
  return Math.round(PRANK.maxPoints * k);
}
