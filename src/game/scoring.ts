import { PLAY, PRANK } from './constants.ts';

export type PrankId = 'snowman' | 'lamp' | 'tree';

export const PRANK_LABEL: Record<PrankId, string> = {
  snowman: '눈사람',
  lamp: '가로등',
  tree: '트리 별',
};

export const PRANK_VERB: Record<PrankId, string> = {
  snowman: '무너뜨림',
  lamp: '끔',
  tree: '떨어뜨림',
};

/** Faster = more. Linear from maxPoints at 0 s to maxPoints × minShare at the end of play. */
export function prankPoints(elapsedSec: number) {
  const k = Math.min(1, Math.max(PRANK.minShare, 1 - Math.max(0, elapsedSec) / PLAY.durationSec));
  return Math.round(PRANK.maxPoints * k);
}

/** "눈사람: 8초 만에 무너뜨림" */
export function prankRecordText(id: PrankId, elapsedSec: number) {
  return `${PRANK_LABEL[id]}: ${Math.max(1, Math.round(elapsedSec))}초 만에 ${PRANK_VERB[id]}`;
}
