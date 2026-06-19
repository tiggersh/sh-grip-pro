// ─────────────────────────────────────────
//  settings.js — 설정 탭
// ─────────────────────────────────────────

import { state } from './app.js';
import { getProfile, saveProfile, getAllSessions, saveSession, todayKey } from './db.js';
import { WEIGHTS, weightOf } from './engine.js';

export async function renderSettingsTab(container) {
  const profile = state.profile;
  const lw = weightOf(profile.left.stage);
  const rw = weightOf(profile.right.stage);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">설정</div>
    </div>

    <div class="section-label" style="padding:12px 20px 6px">무게 설정</div>
    <div class="settings-group">
      <div class="settings-row" id="setLeftWeight">
        <span class="settings-row-icon">✊</span>
        <span class="settings-row-label">왼손 현재 무게</span>
        <span class="settings-row-value" style="color:var(--left-color)">${lw}kg</span>
        <span class="settings-row-arrow">›</span>
      </div>
      <div class="settings-row" id="setRightWeight">
        <span class="settings-row-icon">✊</span>
        <span class="settings-row-label">오른손 현재 무게</span>
        <span class="settings-row-value" style="color:var(--right-color)">${rw}kg</span>
        <span class="settings-row-arrow">›</span>
      </div>
    </div>

    <div class="section-label" style="padding:20px 20px 6px">연속 기록</div>
    <div class="settings-group">
      <div class="settings-row" id="resetLeftStreak">
        <span class="settings-row-icon">🔄</span>
        <span class="settings-row-label">왼손 연속 기록 초기화</span>
        <span class="settings-row-value">${streakLabel(profile.left.streak)}</span>
        <span class="settings-row-arrow">›</span>
      </div>
      <div class="settings-row" id="resetRightStreak">
        <span class="settings-row-icon">🔄</span>
        <span class="settings-row-label">오른손 연속 기록 초기화</span>
        <span class="settings-row-value">${streakLabel(profile.right.streak)}</span>
        <span class="settings-row-arrow">›</span>
      </div>
    </div>

    <div class="section-label" style="padding:20px 20px 6px">데이터</div>
    <div class="settings-group">
      <div class="settings-row" id="exportBtn">
        <span class="settings-row-icon">📤</span>
        <span class="settings-row-label">데이터 내보내기</span>
        <span class="settings-row-arrow">›</span>
      </div>
      <div class="settings-row" id="importBtn">
        <span class="settings-row-icon">📥</span>
        <span class="settings-row-label">데이터 가져오기</span>
        <span class="settings-row-arrow">›</span>
      </div>
    </div>

    <div style="height:24px"></div>

    <input type="file" id="importFile" accept=".json" style="display:none">
  `;

  // ── 무게 변경 ──
  document.getElementById('setLeftWeight').addEventListener('click', () =>
    showWeightPicker('left', profile, container)
  );
  document.getElementById('setRightWeight').addEventListener('click', () =>
    showWeightPicker('right', profile, container)
  );

  // ── 연속 기록 초기화 ──
  document.getElementById('resetLeftStreak').addEventListener('click', async () => {
    if (!confirm('왼손 연속 기록을 초기화할까요?')) return;
    profile.left.streak = 0;
    state.profile = profile;
    await saveProfile(profile);
    renderSettingsTab(container);
  });
  document.getElementById('resetRightStreak').addEventListener('click', async () => {
    if (!confirm('오른손 연속 기록을 초기화할까요?')) return;
    profile.right.streak = 0;
    state.profile = profile;
    await saveProfile(profile);
    renderSettingsTab(container);
  });

  // ── 내보내기 ──
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const sessions = await getAllSessions();
    const data     = { version: 1, exportedAt: new Date().toISOString(), profile, sessions };
    const blob     = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `sh-grip-pro-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── 가져오기 ──
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.profile || !data.sessions) {
        alert('올바른 SH Grip Pro 백업 파일이 아닙니다.');
        return;
      }

      if (!confirm(`백업 데이터를 가져오면 현재 데이터가 덮어씌워집니다.\n계속할까요?`)) return;

      await saveProfile(data.profile);
      for (const s of data.sessions) {
        await saveSession(s);
      }

      state.profile = data.profile;
      alert('데이터 가져오기 완료!');
      renderSettingsTab(container);
    } catch {
      alert('파일을 읽는 중 오류가 발생했습니다.');
    }
  });
}

// ── 무게 선택 시트 ────────────────────────
function showWeightPicker(hand, profile, container) {
  const current = profile[hand].stage;
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-content">
      <div style="font-size:17px;font-weight:700;margin-bottom:4px">
        ${hand === 'left' ? '왼손' : '오른손'} 무게 변경
      </div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">
        무게를 선택하면 연속 기록이 초기화됩니다
      </div>
      ${WEIGHTS.map((w, i) => `
        <div class="settings-row weight-option" data-stage="${i}"
          style="margin-bottom:1px;background:${i === current ? 'var(--accent-dim)' : ''};
                 border:1px solid ${i === current ? 'var(--accent)' : 'transparent'};border-radius:12px">
          <span style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;color:${
            i === current ? 'var(--accent)' : 'var(--text-primary)'}">${w}kg</span>
          ${i === current ? '<span style="color:var(--accent);font-size:13px">현재</span>' : ''}
        </div>
      `).join('')}
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  sheet.querySelectorAll('.weight-option').forEach(el => {
    el.addEventListener('click', async () => {
      const newStage = parseInt(el.dataset.stage);
      profile[hand].stage  = newStage;
      profile[hand].streak = 0;
      state.profile = profile;
      await saveProfile(profile);
      overlay.remove();
      sheet.remove();
      renderSettingsTab(container);
    });
  });

  overlay.addEventListener('click', () => {
    overlay.remove();
    sheet.remove();
  });
}

function streakLabel(streak) {
  if (streak > 0) return `${streak}연속 성공`;
  if (streak < 0) return `${Math.abs(streak)}연속 실패`;
  return '—';
}
