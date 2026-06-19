// ─────────────────────────────────────────
//  app.js — SH Grip Pro 진입점
// ─────────────────────────────────────────

import { initDB, getProfile, saveProfile, todayKey } from './db.js';
import { buildSession, applySessionResult, formatStreak, formatWeight, weightOf } from './engine.js';

// ── 전역 상태 ────────────────────────────
export const state = {
  profile: null,      // { id, left: { stage, streak }, right: { stage, streak } }
  activeTab: 'train', // 'train' | 'history' | 'stats' | 'settings'
};

// ── 앱 초기화 ────────────────────────────
async function init() {
  await initDB();

  const profile = await getProfile();

  if (!profile) {
    showOnboarding();
  } else {
    state.profile = profile;
    renderApp();
  }
}

// ── 온보딩 (최초 실행) ───────────────────
function showOnboarding() {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="onboarding">
      <div class="onboarding-logo">
        <span class="logo-icon">✊</span>
        <h1>SH Grip Pro</h1>
        <p>시작 무게를 선택하세요</p>
      </div>

      <div class="onboarding-card">
        <div class="hand-select">
          <label>왼손 시작 단계</label>
          <select id="leftStage">
            ${stageOptions()}
          </select>
        </div>
        <div class="hand-select">
          <label>오른손 시작 단계</label>
          <select id="rightStage">
            ${stageOptions()}
          </select>
        </div>
      </div>

      <button class="btn-primary" id="startBtn">시작하기</button>
    </div>
  `;

  document.getElementById('startBtn').addEventListener('click', async () => {
    const leftStage  = parseInt(document.getElementById('leftStage').value);
    const rightStage = parseInt(document.getElementById('rightStage').value);

    const profile = {
      id: 'main',
      left:  { stage: leftStage,  streak: 0 },
      right: { stage: rightStage, streak: 0 },
      createdAt: Date.now(),
    };

    await saveProfile(profile);
    state.profile = profile;
    renderApp();
  });
}

function stageOptions() {
  const weights = [25, 36, 47, 58, 69, 80];
  return weights.map((w, i) =>
    `<option value="${i}" ${i === 2 ? 'selected' : ''}>${w}kg</option>`
  ).join('');
}

// ── 메인 앱 렌더링 ───────────────────────
function renderApp() {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="app">
      <div class="tab-content" id="tabContent"></div>
      <nav class="tab-bar">
        <button class="tab-btn active" data-tab="train">
          <span class="tab-icon">✊</span>
          <span class="tab-label">훈련</span>
        </button>
        <button class="tab-btn" data-tab="history">
          <span class="tab-icon">📋</span>
          <span class="tab-label">기록</span>
        </button>
        <button class="tab-btn" data-tab="stats">
          <span class="tab-icon">📈</span>
          <span class="tab-label">통계</span>
        </button>
        <button class="tab-btn" data-tab="settings">
          <span class="tab-icon">⚙️</span>
          <span class="tab-label">설정</span>
        </button>
      </nav>
    </div>
  `;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  switchTab('train');
}

// ── 탭 전환 ──────────────────────────────
export async function switchTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  const content = document.getElementById('tabContent');

  // 동적 임포트로 각 탭 모듈 로드
  switch (tab) {
    case 'train': {
      const { renderTrainTab } = await import('./session.js');
      await renderTrainTab(content);
      break;
    }
    case 'history': {
      const { renderHistoryTab } = await import('./history.js');
      await renderHistoryTab(content);
      break;
    }
    case 'stats': {
      const { renderStatsTab } = await import('./stats.js');
      await renderStatsTab(content);
      break;
    }
    case 'settings': {
      const { renderSettingsTab } = await import('./settings.js');
      await renderSettingsTab(content);
      break;
    }
  }
}

// ── Service Worker 등록 ───────────────────
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');

    // 업데이트 감지 → 토스트 + 자동 적용
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW?.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast(newSW);
        }
      });
    });
  } catch (err) {
    console.warn('SW 등록 실패:', err);
  }
}

function showUpdateToast(newSW) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = 'display:flex;align-items:center;gap:12px;cursor:pointer';
  toast.innerHTML = `
    <span>새 버전이 있어요</span>
    <span style="color:var(--accent);font-weight:600">업데이트</span>
  `;
  document.body.appendChild(toast);
  toast.addEventListener('click', () => {
    newSW.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });
}

// ── 시작 ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init();
  registerSW();
});
