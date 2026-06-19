// ─────────────────────────────────────────
//  engine.js — SH Grip Pro 핵심 로직 엔진
// ─────────────────────────────────────────

// ── 무게 단계 ────────────────────────────
export const WEIGHTS = [25, 36, 47, 58, 69, 80]; // index 0~5
export const MIN_STAGE = 0;
export const MAX_STAGE = WEIGHTS.length - 1;      // 5

export function weightOf(stage) {
  const s = Math.max(MIN_STAGE, Math.min(MAX_STAGE, stage));
  return WEIGHTS[s];
}

// ── 세션 블록 구성 ───────────────────────
// 반환: 훈련 실행에 필요한 블록 배열
export function buildSession(leftStage, rightStage) {
  const blocks = [];

  // 웜업A (메인 -2단계, 최저 0단계 고정)
  blocks.push(...makePair('warmup_a', {
    left:  { stage: Math.max(MIN_STAGE, leftStage  - 2), reps: 12 },
    right: { stage: Math.max(MIN_STAGE, rightStage - 2), reps: 12 },
  }));

  // 웜업B (메인 -1단계)
  blocks.push(...makePair('warmup_b', {
    left:  { stage: Math.max(MIN_STAGE, leftStage  - 1), reps: 8 },
    right: { stage: Math.max(MIN_STAGE, rightStage - 1), reps: 8 },
  }));

  // 메인 3세트 (좌1 → 우1 → 좌2 → 우2 → 좌3 → 우3)
  for (let set = 1; set <= 3; set++) {
    blocks.push(
      { type: 'main', hand: 'left',  stage: leftStage,  weight: weightOf(leftStage),  targetReps: 8, set },
      { type: 'main', hand: 'right', stage: rightStage, weight: weightOf(rightStage), targetReps: 8, set },
    );
  }

  // 네거티브 (메인 +1단계, 최고 5단계 고정)
  blocks.push(...makePair('negative', {
    left:  { stage: Math.min(MAX_STAGE, leftStage  + 1), duration: 5 },
    right: { stage: Math.min(MAX_STAGE, rightStage + 1), duration: 5 },
  }));

  // 홀딩 (메인단계, 최대 20초)
  blocks.push(...makePair('holding', {
    left:  { stage: leftStage,  maxDuration: 20 },
    right: { stage: rightStage, maxDuration: 20 },
  }));

  return blocks;
}

function makePair(type, { left, right }) {
  return [
    { type, hand: 'left',  weight: weightOf(left.stage),  ...left  },
    { type, hand: 'right', weight: weightOf(right.stage), ...right },
  ];
}

// ── 휴식 필요 여부 ───────────────────────
// 좌→우 전환은 휴식 없음, 그 외는 2분
export function needsRest(currentBlock, nextBlock) {
  if (!nextBlock) return false;
  // 같은 type + set 내에서 left→right 전환: 휴식 없음
  if (
    currentBlock.type === nextBlock.type &&
    currentBlock.hand === 'left' &&
    nextBlock.hand    === 'right' &&
    currentBlock.set  === nextBlock.set
  ) return false;
  return true;
}

// ══════════════════════════════════════════
//  진급 판정
// ══════════════════════════════════════════

const SUCCESS_THRESHOLD = 2;   // 연속 성공 → 진급
const FAIL_THRESHOLD    = -3;  // 연속 실패 → 감급

// mainSuccess: 이번 세션 메인 성공 여부 (bool)
// currentStreak: 현재 연속 기록 (양수=성공, 음수=실패)
// currentStage: 현재 단계
//
// 반환: { newStreak, newStage, event }
// event: 'promoted' | 'demoted' | 'streak_reset' | null
export function judgeStreak(mainSuccess, currentStreak, currentStage) {
  let streak = currentStreak;

  if (mainSuccess) {
    streak = streak > 0 ? streak + 1 : 1; // 실패 스트릭이면 리셋 후 1
  } else {
    streak = streak < 0 ? streak - 1 : -1;
  }

  let stage = currentStage;
  let event = null;

  if (streak >= SUCCESS_THRESHOLD) {
    if (stage < MAX_STAGE) {
      stage += 1;
      event  = 'promoted';
    }
    streak = 0; // 진급 후 리셋
  } else if (streak <= FAIL_THRESHOLD) {
    if (stage > MIN_STAGE) {
      stage -= 1;
      event  = 'demoted';
    }
    streak = 0; // 감급 후 리셋
  }

  return { newStreak: streak, newStage: stage, event };
}

// ── 세션 성공 여부 계산 ──────────────────
// sets: 실제 완료 횟수 배열 ex) [8, 8, 7]
export function calcMainSuccess(sets) {
  if (!sets || sets.length !== 3) return false;
  return sets.every(r => r >= 8);
}

// ── 홀딩 성공 여부 ───────────────────────
export function calcHoldingSuccess(actualSeconds) {
  return actualSeconds >= 20;
}

// ── 프로필 업데이트 (세션 완료 후 호출) ──
// profile: { left: { stage, streak }, right: { stage, streak } }
// result:  { left: { mainSuccess, sets }, right: { ... } }
export function applySessionResult(profile, result) {
  const updated = { ...profile };

  for (const hand of ['left', 'right']) {
    const { mainSuccess } = result[hand];
    const { stage, streak } = profile[hand];
    const judgment = judgeStreak(mainSuccess, streak, stage);

    updated[hand] = {
      stage:  judgment.newStage,
      streak: judgment.newStreak,
    };

    // 이벤트 정보도 결과에 붙여서 반환 (UI 알림용)
    result[hand].event    = judgment.event;
    result[hand].newStage = judgment.newStage;
  }

  return { updatedProfile: updated, result };
}

// ── 포맷 헬퍼 ────────────────────────────
export function formatWeight(stage) {
  return `${weightOf(stage)}kg`;
}

export function formatStreak(streak) {
  if (streak > 0) return `🔥 ${streak}연속 성공`;
  if (streak < 0) return `❄️ ${Math.abs(streak)}연속 실패`;
  return '—';
}
