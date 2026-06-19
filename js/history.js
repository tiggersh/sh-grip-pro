// ─────────────────────────────────────────
//  history.js — 기록 탭
// ─────────────────────────────────────────

import { getAllSessions } from './db.js';
import { weightOf } from './engine.js';

export async function renderHistoryTab(container) {
  const sessions = await getAllSessions();
  const sorted   = sessions
    .filter(s => s.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">기록</div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">아직 기록이 없어요</div>
        <div class="empty-desc">첫 훈련을 완료하면<br>여기에 기록됩니다</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">기록</div>
      <div class="page-subtitle">총 ${sorted.length}회 훈련</div>
    </div>
    <div class="history-list" id="historyList"></div>
    <div style="height:16px"></div>
  `;

  const list = document.getElementById('historyList');

  sorted.forEach(session => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const date   = new Date(session.date);
    const day    = date.getDate();
    const mon    = date.toLocaleDateString('ko-KR', { month: 'short' }).replace('월', '');
    const lSets  = session.left.sets  || [];
    const rSets  = session.right.sets || [];
    const lOk    = session.left.mainSuccess;
    const rOk    = session.right.mainSuccess;
    const status = lOk && rOk ? 'success' : !lOk && !rOk ? 'fail' : 'partial';

    item.innerHTML = `
      <div class="history-date-block">
        <div class="history-date-day">${day}</div>
        <div class="history-date-mon">${mon}</div>
      </div>
      <div class="history-divider"></div>
      <div class="history-info">
        <div class="history-weights">
          <span style="color:var(--left-color)">${weightOf(session.left.stage)}kg</span>
          <span style="color:var(--text-tertiary);font-size:11px;margin:0 4px">/</span>
          <span style="color:var(--right-color)">${weightOf(session.right.stage)}kg</span>
        </div>
        <div class="history-result">
          왼 ${lSets.join('-') || '—'} &nbsp;·&nbsp; 우 ${rSets.join('-') || '—'}
        </div>
      </div>
      <div class="history-status ${status}"></div>
    `;

    item.addEventListener('click', () => showDetail(session));
    list.appendChild(item);
  });
}

// ── 세션 상세 바텀 시트 ───────────────────
function showDetail(session) {
  const lSets  = session.left.sets  || [];
  const rSets  = session.right.sets || [];
  const lHold  = session.left.holding;
  const rHold  = session.right.holding;
  const lNeg   = session.left.negative;
  const rNeg   = session.right.negative;
  const date   = new Date(session.date).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-content">
      <div style="font-size:17px;font-weight:700;margin-bottom:4px">${date}</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">세션 상세</div>

      <div class="section-label">메인 세트</div>
      <div style="height:8px"></div>
      ${detailRow('왼손', weightOf(session.left.stage) + 'kg', lSets.join(' · ') || '—', session.left.mainSuccess)}
      <div style="height:8px"></div>
      ${detailRow('오른손', weightOf(session.right.stage) + 'kg', rSets.join(' · ') || '—', session.right.mainSuccess)}

      <div style="height:16px"></div>
      <div class="section-label">네거티브</div>
      <div style="height:8px"></div>
      ${detailRow('왼손', '', lNeg ? '완료' : '미완료', lNeg)}
      <div style="height:8px"></div>
      ${detailRow('오른손', '', rNeg ? '완료' : '미완료', rNeg)}

      <div style="height:16px"></div>
      <div class="section-label">홀딩</div>
      <div style="height:8px"></div>
      ${detailRow('왼손', '', lHold != null ? lHold + '초' : '—', lHold >= 20)}
      <div style="height:8px"></div>
      ${detailRow('오른손', '', rHold != null ? rHold + '초' : '—', rHold >= 20)}
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  overlay.addEventListener('click', () => {
    overlay.remove();
    sheet.remove();
  });
}

function detailRow(label, weight, value, success) {
  return `
    <div style="display:flex;align-items:center;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px 16px;gap:12px">
      <span style="font-size:14px;color:var(--text-secondary);flex:1">${label}${weight ? ' · ' + weight : ''}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:${success ? 'var(--success)' : 'var(--text-primary)'}">${value}</span>
    </div>
  `;
}
