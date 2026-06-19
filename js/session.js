// ─────────────────────────────────────────
//  session.js — SH Grip Pro 훈련 실행 화면
// ─────────────────────────────────────────

import { state } from './app.js';
import {
  buildSession, needsRest, calcMainSuccess,
  calcHoldingSuccess, applySessionResult,
  weightOf, formatWeight
} from './engine.js';
import {
  getProfile, saveProfile,
  getSessionByDate, saveSession, todayKey
} from './db.js';

// ══════════════════════════════════════════
//  훈련 탭 진입점
// ══════════════════════════════════════════
export async function renderTrainTab(container) {
  const profile = state.profile;
  const today   = todayKey();
  const session = await getSessionByDate(today);

  if (session?.status === 'completed') {
    renderCompletedHome(container, session);
    return;
  }

  if (session?.status === 'in_progress') {
    renderTrainHome(container, profile, session);
    return;
  }

  renderTrainHome(container, profile, null);
}

// ── 훈련 홈 (시작 전 / 이어하기) ─────────
function renderTrainHome(container, profile, session) {
  const lw = weightOf(profile.left.stage);
  const rw = weightOf(profile.right.stage);

  const lStreak = profile.left.streak;
  const rStreak = profile.right.streak;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">SH Grip Pro</div>
      <div class="page-subtitle">${getGreeting()}</div>
    </div>

    <div class="section">
      <div class="today-status">

        <div class="status-row">
          <div class="status-item">
            <div class="status-item-label">왼손</div>
            <div class="status-item-value left">${lw}<span style="font-size:14px;color:var(--text-secondary);font-weight:400">kg</span></div>
          </div>
          <div class="status-item">
            <div class="status-item-label">오른손</div>
            <div class="status-item-value right">${rw}<span style="font-size:14px;color:var(--text-secondary);font-weight:400">kg</span></div>
          </div>
        </div>

        <div>
          <div class="section-label" style="margin-bottom:8px">연속 기록</div>
          ${renderStreakBar('left', lStreak)}
          <div style="height:8px"></div>
          ${renderStreakBar('right', rStreak)}
        </div>

        <div>
          <div class="section-label" style="margin-bottom:8px">오늘 세션 구성</div>
          ${renderSessionPreview(profile)}
        </div>

      </div>
    </div>

    <div style="padding:16px 20px 0">
      ${session
        ? `<button class="btn-primary" id="resumeBtn">이어하기</button>
           <button class="btn-secondary" style="margin-top:10px" id="restartBtn">새로 시작</button>`
        : `<button class="btn-primary" id="startBtn">훈련 시작</button>`
      }
    </div>
  `;

  if (session) {
    document.getElementById('resumeBtn').addEventListener('click', () =>
      startSession(container, profile, session)
    );
    document.getElementById('restartBtn').addEventListener('click', async () => {
      session.status = 'in_progress';
      session.blocks = buildSession(profile.left.stage, profile.right.stage)
        .map(b => ({ ...b, done: false, result: null }));
      session.currentIdx = 0;
      await saveSession(session);
      startSession(container, profile, session);
    });
  } else {
    document.getElementById('startBtn').addEventListener('click', async () => {
      const newSession = await createSession(profile);
      startSession(container, profile, newSession);
    });
  }
}

function renderStreakBar(hand, streak) {
  const MAX = 3;
  const dots = [];
  for (let i = 0; i < MAX; i++) {
    if (streak > 0) {
      dots.push(`<div class="streak-dot ${i < streak ? 'success' : ''}"></div>`);
    } else {
      const failIdx = Math.abs(streak);
      dots.push(`<div class="streak-dot ${i < failIdx ? 'fail' : ''}"></div>`);
    }
  }

  const label = streak > 0
    ? `<span style="color:var(--success);font-size:12px">${streak}연속 성공</span>`
    : streak < 0
      ? `<span style="color:var(--danger);font-size:12px">${Math.abs(streak)}연속 실패</span>`
      : `<span style="color:var(--text-tertiary);font-size:12px">기록 없음</span>`;

  const color = hand === 'left' ? 'var(--left-color)' : 'var(--right-color)';

  return `
    <div class="streak-bar">
      <span style="font-size:11px;color:${color};font-weight:600;width:22px">${hand === 'left' ? '왼' : '우'}</span>
      <div class="streak-dots">${dots.join('')}</div>
      ${label}
    </div>
  `;
}

function renderSessionPreview(profile) {
  const ls = profile.left.stage;
  const rs = profile.right.stage;
  const rows = [
    ['웜업 A', `${weightOf(Math.max(0, ls-2))}kg`, `${weightOf(Math.max(0, rs-2))}kg`, '12회'],
    ['웜업 B', `${weightOf(Math.max(0, ls-1))}kg`, `${weightOf(Math.max(0, rs-1))}kg`, '8회'],
    ['메인',   `${weightOf(ls)}kg`, `${weightOf(rs)}kg`, '8회×3'],
    ['네거티브', `${weightOf(Math.min(5, ls+1))}kg`, `${weightOf(Math.min(5, rs+1))}kg`, '5초'],
    ['홀딩',   `${weightOf(ls)}kg`, `${weightOf(rs)}kg`, 'max20초'],
  ];
  return `
    <div style="background:var(--bg-elevated);border-radius:12px;overflow:hidden">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 60px;padding:8px 12px;border-bottom:1px solid var(--border-subtle)">
        <span style="font-size:10px;color:var(--text-tertiary)">종류</span>
        <span style="font-size:10px;color:var(--left-color)">왼손</span>
        <span style="font-size:10px;color:var(--right-color)">오른손</span>
        <span style="font-size:10px;color:var(--text-tertiary)">목표</span>
      </div>
      ${rows.map((r, i) => `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 60px;padding:9px 12px;${i < rows.length-1 ? 'border-bottom:1px solid var(--border-subtle)' : ''}">
          <span style="font-size:12px;color:var(--text-secondary)">${r[0]}</span>
          <span style="font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--left-color)">${r[1]}</span>
          <span style="font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--right-color)">${r[2]}</span>
          <span style="font-size:12px;color:var(--text-tertiary)">${r[3]}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ══════════════════════════════════════════
//  세션 생성
// ══════════════════════════════════════════
async function createSession(profile) {
  const blocks = buildSession(profile.left.stage, profile.right.stage)
    .map(b => ({ ...b, done: false, result: null }));

  const session = {
    date: todayKey(),
    status: 'in_progress',
    createdAt: Date.now(),
    completedAt: null,
    currentIdx: 0,
    blocks,
    left:  { stage: profile.left.stage,  mainSuccess: false, sets: [], holding: null, negative: false },
    right: { stage: profile.right.stage, mainSuccess: false, sets: [], holding: null, negative: false },
  };

  await saveSession(session);
  return session;
}

// ══════════════════════════════════════════
//  세션 실행 메인
// ══════════════════════════════════════════
function startSession(container, profile, session) {
  renderBlock(container, session);
}

function renderBlock(container, session) {
  const idx   = session.currentIdx;
  const block = session.blocks[idx];
  const total = session.blocks.length;

  if (!block) {
    finishSession(container, session);
    return;
  }

  const pct = Math.round((idx / total) * 100);

  const headerHTML = `
    <div class="session-header">
      <div class="session-progress-bar">
        <div class="session-progress-fill" style="width:${pct}%"></div>
      </div>
      <span class="session-step-label">${idx + 1} / ${total}</span>
    </div>
  `;

  switch (block.type) {
    case 'warmup_a':
    case 'warmup_b':
      renderRepBlock(container, session, headerHTML, block, idx);
      break;
    case 'main':
      renderMainBlock(container, session, headerHTML, block, idx);
      break;
    case 'negative':
      renderNegativeBlock(container, session, headerHTML, block, idx);
      break;
    case 'holding':
      renderHoldingBlock(container, session, headerHTML, block, idx);
      break;
  }
}

// ── 다음 블록으로 이동 (휴식 포함) ────────
function nextBlock(container, session) {
  const current = session.blocks[session.currentIdx];
  const next    = session.blocks[session.currentIdx + 1];

  session.currentIdx++;

  if (needsRest(current, next) && next) {
    renderRest(container, session, 120); // 2분
  } else {
    saveSession(session);
    renderBlock(container, session);
  }
}

// ── 세션 저장 헬퍼 ───────────────────────
async function persistBlock(session, idx, result) {
  session.blocks[idx].done   = true;
  session.blocks[idx].result = result;

  const block = session.blocks[idx];
  const hand  = block.hand;

  if (block.type === 'main') {
    if (!session[hand].sets) session[hand].sets = [];
    session[hand].sets.push(result.reps);
  }
  if (block.type === 'negative') {
    session[hand].negative = result.done;
  }
  if (block.type === 'holding') {
    session[hand].holding = result.seconds;
  }

  await saveSession(session);
}

// ══════════════════════════════════════════
//  블록 렌더러들
// ══════════════════════════════════════════

// ── 웜업 A/B (횟수 카운트) ────────────────
function renderRepBlock(container, session, headerHTML, block, idx) {
  const typeLabel = block.type === 'warmup_a' ? '웜업 A' : '웜업 B';
  let reps = 0;
  const target = block.reps;

  container.innerHTML = `
    <div class="session-screen">
      ${headerHTML}
      <div style="padding:0 20px;flex:1;display:flex;flex-direction:column;gap:16px">
        <div class="block-card">
          <div class="block-card-header">
            <span class="block-type-label">${typeLabel}</span>
            <span class="hand-badge ${block.hand}">${block.hand === 'left' ? '왼손' : '오른손'}</span>
          </div>
          <div class="block-card-body">
            <div style="font-size:15px;font-family:'JetBrains Mono',monospace;color:var(--text-secondary);font-weight:600">
              ${block.weight}kg
            </div>
            <div class="rep-counter">
              <div class="rep-number" id="repNum">0</div>
              <div class="rep-target">목표 ${target}회</div>
            </div>
            <div class="rep-controls">
              <button class="rep-btn" id="repMinus">−</button>
              <button class="rep-btn" id="repPlus" style="width:64px;height:64px;font-size:30px;background:var(--accent-dim);border-color:var(--accent)">+</button>
            </div>
          </div>
        </div>
        <button class="done-btn" id="doneBtn">완료</button>
      </div>
    </div>
  `;

  const numEl  = document.getElementById('repNum');
  const doneBtn = document.getElementById('doneBtn');

  function update() {
    numEl.textContent = reps;
    numEl.classList.toggle('complete', reps >= target);
    doneBtn.classList.toggle('success-btn', reps >= target);
  }

  document.getElementById('repPlus').addEventListener('click', () => {
    reps = Math.min(reps + 1, 99);
    update();
  });
  document.getElementById('repMinus').addEventListener('click', () => {
    reps = Math.max(reps - 1, 0);
    update();
  });

  doneBtn.addEventListener('click', async () => {
    await persistBlock(session, idx, { reps });
    nextBlock(container, session);
  });
}

// ── 메인 세트 ────────────────────────────
function renderMainBlock(container, session, headerHTML, block, idx) {
  let reps = 0;
  const target = block.targetReps;

  // 완료된 세트 dots 계산
  const doneSets = session.blocks
    .filter(b => b.type === 'main' && b.hand === block.hand && b.done)
    .length;

  const dots = [0,1,2].map(i => {
    if (i < doneSets)        return `<div class="set-dot done"></div>`;
    if (i === doneSets)      return `<div class="set-dot current"></div>`;
    return                          `<div class="set-dot"></div>`;
  }).join('');

  container.innerHTML = `
    <div class="session-screen">
      ${headerHTML}
      <div style="padding:0 20px;flex:1;display:flex;flex-direction:column;gap:16px">
        <div class="block-card">
          <div class="block-card-header">
            <span class="block-type-label">메인 세트 ${block.set}</span>
            <span class="hand-badge ${block.hand}">${block.hand === 'left' ? '왼손' : '오른손'}</span>
          </div>
          <div class="block-card-body">
            <div style="font-size:15px;font-family:'JetBrains Mono',monospace;color:var(--text-secondary);font-weight:600">
              ${block.weight}kg
            </div>
            <div class="set-indicators">${dots}</div>
            <div class="rep-counter">
              <div class="rep-number" id="repNum">0</div>
              <div class="rep-target">목표 ${target}회</div>
            </div>
            <div class="rep-controls">
              <button class="rep-btn" id="repMinus">−</button>
              <button class="rep-btn" id="repPlus" style="width:64px;height:64px;font-size:30px;background:var(--accent-dim);border-color:var(--accent)">+</button>
            </div>
          </div>
        </div>
        <button class="done-btn" id="doneBtn">세트 완료</button>
      </div>
    </div>
  `;

  const numEl   = document.getElementById('repNum');
  const doneBtn = document.getElementById('doneBtn');

  function update() {
    numEl.textContent = reps;
    numEl.classList.toggle('complete', reps >= target);
    doneBtn.classList.toggle('success-btn', reps >= target);
  }

  document.getElementById('repPlus').addEventListener('click', () => {
    reps = Math.min(reps + 1, 99);
    update();
  });
  document.getElementById('repMinus').addEventListener('click', () => {
    reps = Math.max(reps - 1, 0);
    update();
  });

  doneBtn.addEventListener('click', async () => {
    await persistBlock(session, idx, { reps });

    // 마지막 메인세트(세트3-우)면 성공 여부 즉시 계산
    const hand = block.hand;
    if (block.set === 3 && hand === 'right') {
      for (const h of ['left', 'right']) {
        session[h].mainSuccess = calcMainSuccess(session[h].sets);
      }
    } else if (block.set === 3 && hand === 'left') {
      session.left.mainSuccess = calcMainSuccess(session.left.sets);
    }

    nextBlock(container, session);
  });
}

// ── 네거티브 (5초 버티기 타이머) ──────────
function renderNegativeBlock(container, session, headerHTML, block, idx) {
  const DURATION = 5;
  let seconds  = DURATION;
  let running  = false;
  let timerId  = null;
  const CIRCUM = 502;

  container.innerHTML = `
    <div class="session-screen">
      ${headerHTML}
      <div style="padding:0 20px;flex:1;display:flex;flex-direction:column;gap:16px">
        <div class="block-card">
          <div class="block-card-header">
            <span class="block-type-label">네거티브</span>
            <span class="hand-badge ${block.hand}">${block.hand === 'left' ? '왼손' : '오른손'}</span>
          </div>
          <div class="block-card-body">
            <div style="font-size:15px;font-family:'JetBrains Mono',monospace;color:var(--text-secondary);font-weight:600">
              ${block.weight}kg · 5초 버티기
            </div>
            <div class="timer-ring-wrap">
              <svg class="timer-ring" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg">
                <circle class="timer-ring-bg"   cx="85" cy="85" r="80"/>
                <circle class="timer-ring-fill" cx="85" cy="85" r="80"
                  stroke-dasharray="${CIRCUM}" stroke-dashoffset="0" id="negRing"/>
              </svg>
              <div class="timer-center">
                <div class="timer-seconds" id="negSec">${DURATION}</div>
                <div class="timer-label">초</div>
              </div>
            </div>
            <button class="done-btn" id="negStartBtn" style="background:var(--bg-card-2);color:var(--text-primary);box-shadow:none;border:1px solid var(--border)">
              시작
            </button>
          </div>
        </div>
        <button class="done-btn success-btn" id="negDoneBtn" style="display:none">완료</button>
        <button class="btn-secondary" id="negSkipBtn">건너뛰기</button>
      </div>
    </div>
  `;

  const secEl   = document.getElementById('negSec');
  const ringEl  = document.getElementById('negRing');
  const startBtn = document.getElementById('negStartBtn');
  const doneBtn  = document.getElementById('negDoneBtn');
  const skipBtn  = document.getElementById('negSkipBtn');

  function updateRing() {
    const offset = CIRCUM * (1 - seconds / DURATION);
    ringEl.style.strokeDashoffset = offset;
    secEl.textContent = seconds;
    if (seconds <= 1) ringEl.classList.add('danger');
  }

  startBtn.addEventListener('click', () => {
    if (running) return;
    running = true;
    startBtn.textContent = '버티는 중...';
    startBtn.disabled = true;

    timerId = setInterval(() => {
      seconds--;
      updateRing();
      if (seconds <= 0) {
        clearInterval(timerId);
        running = false;
        doneBtn.style.display = 'block';
        skipBtn.style.display = 'none';
        startBtn.style.display = 'none';
        showToast('네거티브 완료! 💪');
      }
    }, 1000);
  });

  doneBtn.addEventListener('click', async () => {
    await persistBlock(session, idx, { done: true });
    nextBlock(container, session);
  });

  skipBtn.addEventListener('click', async () => {
    clearInterval(timerId);
    await persistBlock(session, idx, { done: false });
    nextBlock(container, session);
  });
}

// ── 홀딩 (최대 20초) ─────────────────────
function renderHoldingBlock(container, session, headerHTML, block, idx) {
  const MAX = 20;
  let elapsed = 0;
  let running = false;
  let timerId = null;
  let startTs = null;
  const CIRCUM = 502;

  container.innerHTML = `
    <div class="session-screen">
      ${headerHTML}
      <div style="padding:0 20px;flex:1;display:flex;flex-direction:column;gap:16px">
        <div class="block-card">
          <div class="block-card-header">
            <span class="block-type-label">홀딩</span>
            <span class="hand-badge ${block.hand}">${block.hand === 'left' ? '왼손' : '오른손'}</span>
          </div>
          <div class="block-card-body">
            <div style="font-size:15px;font-family:'JetBrains Mono',monospace;color:var(--text-secondary);font-weight:600">
              ${block.weight}kg · 목표 20초
            </div>
            <div class="timer-ring-wrap">
              <svg class="timer-ring" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg">
                <circle class="timer-ring-bg"   cx="85" cy="85" r="80"/>
                <circle class="timer-ring-fill" cx="85" cy="85" r="80"
                  stroke-dasharray="${CIRCUM}" stroke-dashoffset="${CIRCUM}" id="holdRing"/>
              </svg>
              <div class="timer-center">
                <div class="timer-seconds" id="holdSec">0</div>
                <div class="timer-label">/ 20초</div>
              </div>
            </div>

            <div style="display:flex;gap:10px;width:100%">
              <button class="done-btn" id="holdStartBtn" style="background:var(--accent);flex:1">시작</button>
              <button class="done-btn" id="holdStopBtn"
                style="display:none;flex:1;background:var(--danger);box-shadow:0 4px 20px rgba(248,113,113,0.25)">
                중단
              </button>
            </div>
          </div>
        </div>
        <button class="done-btn success-btn" id="holdDoneBtn" style="display:none">완료 기록</button>
      </div>
    </div>
  `;

  const secEl    = document.getElementById('holdSec');
  const ringEl   = document.getElementById('holdRing');
  const startBtn = document.getElementById('holdStartBtn');
  const stopBtn  = document.getElementById('holdStopBtn');
  const doneBtn  = document.getElementById('holdDoneBtn');

  function updateRing() {
    const fill   = Math.min(elapsed / MAX, 1);
    const offset = CIRCUM * (1 - fill);
    ringEl.style.strokeDashoffset = offset;
    secEl.textContent = elapsed;

    if (elapsed >= MAX) {
      ringEl.style.stroke = 'var(--success)';
    }
  }

  function stopTimer(auto = false) {
    clearInterval(timerId);
    running = false;

    if (auto || elapsed >= MAX) {
      showToast(elapsed >= MAX ? '홀딩 성공! 🏆' : `${elapsed}초 기록`);
    }

    startBtn.style.display = 'none';
    stopBtn.style.display  = 'none';
    doneBtn.style.display  = 'block';

    if (elapsed >= MAX) {
      doneBtn.textContent = '성공 — 완료';
    } else {
      doneBtn.textContent = `${elapsed}초 기록 — 완료`;
      doneBtn.style.background = 'var(--bg-card-2)';
      doneBtn.style.boxShadow  = 'none';
      doneBtn.style.border     = '1px solid var(--border)';
      doneBtn.style.color      = 'var(--text-primary)';
    }
  }

  startBtn.addEventListener('click', () => {
    if (running) return;
    running  = true;
    startTs  = Date.now();
    startBtn.style.display = 'none';
    stopBtn.style.display  = 'block';

    timerId = setInterval(() => {
      elapsed = Math.round((Date.now() - startTs) / 1000);
      updateRing();
      if (elapsed >= MAX) {
        stopTimer(true);
      }
    }, 100);
  });

  stopBtn.addEventListener('click', () => stopTimer(false));

  doneBtn.addEventListener('click', async () => {
    const success = calcHoldingSuccess(elapsed);
    session[block.hand].holding = elapsed;
    await persistBlock(session, idx, { seconds: elapsed, success });
    nextBlock(container, session);
  });
}

// ══════════════════════════════════════════
//  휴식 타이머
// ══════════════════════════════════════════
function renderRest(container, session, totalSeconds) {
  const CIRCUM = 502;
  let remaining = totalSeconds;
  let timerId   = null;

  function render() {
    const pct    = (session.currentIdx / session.blocks.length) * 100;
    const fill   = remaining / totalSeconds;
    const offset = CIRCUM * (1 - fill);
    const mins   = Math.floor(remaining / 60);
    const secs   = String(remaining % 60).padStart(2, '0');

    container.innerHTML = `
      <div class="session-screen">
        <div class="session-header">
          <div class="session-progress-bar">
            <div class="session-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="session-step-label">${session.currentIdx} / ${session.blocks.length}</span>
        </div>
        <div class="rest-screen">
          <div class="rest-title">다음 세트까지</div>
          <div class="timer-ring-wrap">
            <svg class="timer-ring" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg">
              <circle class="timer-ring-bg"   cx="85" cy="85" r="80"/>
              <circle class="timer-ring-fill" cx="85" cy="85" r="80"
                stroke-dasharray="${CIRCUM}"
                stroke-dashoffset="${offset}"
                style="transition:stroke-dashoffset 0.9s linear"/>
            </svg>
            <div class="timer-center">
              <div class="timer-seconds">${mins}:${secs}</div>
              <div class="timer-label">휴식</div>
            </div>
          </div>
          <button class="skip-btn" id="skipBtn">스킵</button>
        </div>
      </div>
    `;

    document.getElementById('skipBtn').addEventListener('click', () => {
      clearInterval(timerId);
      saveSession(session);
      renderBlock(container, session);
    });
  }

  render();

  timerId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerId);
      saveSession(session);
      renderBlock(container, session);
    } else {
      render();
    }
  }, 1000);
}

// ══════════════════════════════════════════
//  세션 완료
// ══════════════════════════════════════════
async function finishSession(container, session) {
  // 최종 성공 여부 재계산
  for (const hand of ['left', 'right']) {
    session[hand].mainSuccess = calcMainSuccess(session[hand].sets);
  }

  session.status      = 'completed';
  session.completedAt = Date.now();

  // 진급 판정 + 프로필 업데이트
  const profile = state.profile;
  const { updatedProfile, result } = applySessionResult(profile, {
    left:  { mainSuccess: session.left.mainSuccess,  sets: session.left.sets },
    right: { mainSuccess: session.right.mainSuccess, sets: session.right.sets },
  });

  state.profile = updatedProfile;
  await saveProfile(updatedProfile);
  await saveSession(session);

  renderCompleteSummary(container, session, result);
}

function renderCompleteSummary(container, session, result) {
  const lSets   = session.left.sets  || [];
  const rSets   = session.right.sets || [];
  const lHold   = session.left.holding  ?? '—';
  const rHold   = session.right.holding ?? '—';
  const lNeg    = session.left.negative  ? '✓' : '—';
  const rNeg    = session.right.negative ? '✓' : '—';

  function eventBadge(hand) {
    const ev = result[hand].event;
    if (!ev) return '';
    const isPromoted = ev === 'promoted';
    return `
      <span class="event-badge ${ev}">
        ${isPromoted ? '⬆ 다음 세션 +1단계' : '⬇ 다음 세션 -1단계'}
        (${weightOf(result[hand].newStage)}kg)
      </span>
    `;
  }

  const bothSuccess = session.left.mainSuccess && session.right.mainSuccess;
  const anySuccess  = session.left.mainSuccess || session.right.mainSuccess;

  container.innerHTML = `
    <div class="session-complete">

      <div class="complete-hero">
        <div class="complete-icon">${bothSuccess ? '🏆' : anySuccess ? '💪' : '😤'}</div>
        <div class="complete-title">${bothSuccess ? '완벽한 훈련!' : anySuccess ? '훈련 완료' : '오늘도 수고했어!'}</div>
        <div class="complete-subtitle">${formatDate(session.date)}</div>
        <div style="display:flex;flex-direction:column;gap:6px;width:100%;margin-top:4px">
          ${eventBadge('left')}
          ${eventBadge('right')}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">

        <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);letter-spacing:.06em;text-transform:uppercase;padding:0 2px">
          메인 세트
        </div>

        <div class="result-grid">
          <div class="result-card">
            <div class="result-card-label" style="color:var(--left-color)">왼손</div>
            <div class="result-card-value" style="color:${session.left.mainSuccess ? 'var(--success)' : 'var(--danger)'}">
              ${lSets.join(' · ') || '—'}
            </div>
            <div style="font-size:11px;color:var(--text-tertiary)">${weightOf(session.left.stage)}kg</div>
          </div>
          <div class="result-card">
            <div class="result-card-label" style="color:var(--right-color)">오른손</div>
            <div class="result-card-value" style="color:${session.right.mainSuccess ? 'var(--success)' : 'var(--danger)'}">
              ${rSets.join(' · ') || '—'}
            </div>
            <div style="font-size:11px;color:var(--text-tertiary)">${weightOf(session.right.stage)}kg</div>
          </div>
        </div>

        <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);letter-spacing:.06em;text-transform:uppercase;padding:4px 2px 0">
          네거티브 · 홀딩
        </div>

        <div class="result-grid">
          <div class="result-card">
            <div class="result-card-label" style="color:var(--left-color)">왼손</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="font-size:13px;color:var(--text-secondary)">네거티브 <span class="mono" style="color:var(--text-primary)">${lNeg}</span></div>
              <div style="font-size:13px;color:var(--text-secondary)">홀딩 <span class="mono" style="color:${lHold >= 20 ? 'var(--success)' : 'var(--text-primary)'}">${lHold !== '—' ? lHold + '초' : '—'}</span></div>
            </div>
          </div>
          <div class="result-card">
            <div class="result-card-label" style="color:var(--right-color)">오른손</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="font-size:13px;color:var(--text-secondary)">네거티브 <span class="mono" style="color:var(--text-primary)">${rNeg}</span></div>
              <div style="font-size:13px;color:var(--text-secondary)">홀딩 <span class="mono" style="color:${rHold >= 20 ? 'var(--success)' : 'var(--text-primary)'}">${rHold !== '—' ? rHold + '초' : '—'}</span></div>
            </div>
          </div>
        </div>

      </div>

      <button class="btn-primary" id="toHomeBtn">확인</button>

    </div>
  `;

  document.getElementById('toHomeBtn').addEventListener('click', async () => {
    const { renderTrainTab } = await import('./session.js');
    const content = document.getElementById('tabContent');
    if (content) await renderTrainTab(content);
  });
}

// ── 완료된 세션 홈 표시 ───────────────────
function renderCompletedHome(container, session) {
  const lSets = session.left.sets  || [];
  const rSets = session.right.sets || [];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">오늘 완료 ✓</div>
      <div class="page-subtitle">${formatDate(session.date)}</div>
    </div>
    <div class="section">
      <div class="today-status">
        <div class="result-grid">
          <div class="result-card">
            <div class="result-card-label" style="color:var(--left-color)">왼손 메인</div>
            <div class="result-card-value" style="color:${session.left.mainSuccess ? 'var(--success)' : 'var(--danger)'}">
              ${lSets.join(' · ') || '—'}
            </div>
          </div>
          <div class="result-card">
            <div class="result-card-label" style="color:var(--right-color)">오른손 메인</div>
            <div class="result-card-value" style="color:${session.right.mainSuccess ? 'var(--success)' : 'var(--danger)'}">
              ${rSets.join(' · ') || '—'}
            </div>
          </div>
        </div>
        <div style="text-align:center;padding:12px 0;color:var(--text-secondary);font-size:14px">
          다음 훈련까지 충분히 쉬세요 💤
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════
//  유틸
// ══════════════════════════════════════════
export function showToast(msg, duration = 2200) {
  const old = document.querySelector('.toast');
  if (old) old.remove();

  const el = document.createElement('div');
  el.className   = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요 ☀️';
  if (h < 18) return '파이팅! 💪';
  return '오늘도 수고했어요 🌙';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}
