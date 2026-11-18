'use client';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { JUDGE, STORM, VIEW } from '@/src/game/constants';
import { live, useApp, type JudgeStage } from '@/src/game/store';
import { BaselineRecorder, SpiteScorer, spiteParts, type Blend } from '@/src/tracking/expression';

/**
 * Runs the 심술 심사 on the frame clock: stages by time (pull-out → baseline → grin → outro),
 * the baseline recording, the smoothed spite signal and its score. Also drives the scene's
 * reaction (storm, village lights) every frame, in and out of the judge.
 */
export function JudgeDirector() {
  const run = useRef<{ at: number; base: BaselineRecorder; baseline: Blend | null; scorer: SpiteScorer; hold: number } | null>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = useApp.getState();
    const now = performance.now();
    let target = 0;

    if (s.phase === 'judge') {
      if (!run.current || run.current.at !== s.phaseAt) {
        run.current = { at: s.phaseAt, base: new BaselineRecorder(), baseline: null, scorer: new SpiteScorer(), hold: 0 };
      }
      const r = run.current;
      const since = (now - s.phaseAt) / 1000;
      const t1 = VIEW.pullSec;
      const t2 = t1 + JUDGE.baselineSec;
      const t3 = t2 + JUDGE.grinSec;
      const t4 = t3 + JUDGE.outroSec;
      const stage: JudgeStage = since < t1 ? 'pull' : since < t2 ? 'baseline' : since < t3 ? 'grin' : 'outro';
      s.setJudgeStage(stage);

      const camera = s.mode === 'camera';
      if (stage === 'baseline' && camera && live.faceDetected) r.base.add({ ...live.blend });

      if (stage === 'grin') {
        if (camera) {
          r.baseline ??= r.base.samples > 0 ? r.base.result() : { ...live.blend };
          const parts = spiteParts(live.blend, r.baseline);
          live.spiteParts = parts;
          target = live.faceDetected ? parts.spite : 0;
        } else {
          // Mouse fallback: spite climbs while the button is held.
          r.hold += (live.holdingSpite ? JUDGE.holdRise : -JUDGE.holdFall) * dt;
          r.hold = Math.min(1, Math.max(0, r.hold));
          target = r.hold;
        }
      } else if (stage === 'outro') {
        target = live.spite; // freeze the last face for a beat
      }

      if (stage === 'grin') r.scorer.add(live.spite, dt);
      if (since >= t4) {
        const sc = r.scorer;
        s.finishJudge({ peak: sc.peak, heldShare: sc.heldShare, points: sc.points });
      }
    } else {
      run.current = null;
    }

    // Smooth spite toward its target; it decays to 0 outside the grin.
    live.spite += (target - live.spite) * Math.min(1, JUDGE.smoothing * dt);

    // Scene reaction: storm and lights follow spite during the judge, then calm down.
    const stormTarget = s.phase === 'judge' ? live.spite : 0;
    live.storm += (stormTarget - live.storm) * Math.min(1, STORM.follow * dt);
    live.villageLight = 1 - (1 - STORM.minLight) * live.storm;
  });

  return null;
}
