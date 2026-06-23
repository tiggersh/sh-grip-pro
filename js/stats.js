// ─────────────────────────────────────────
//  stats.js — 통계 탭
// ─────────────────────────────────────────

import { getAllSessions } from './db.js';
import { WEIGHTS, weightOf } from './engine.js';

export async function renderStatsTab(container) {
  const sessions = await getAllSessions();
  const completed = sessions
    .filter(s => s.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (completed.length === 0) {
    container.innerHTML = `
      <div class="page-header"><div class="page-title">통계</div></div>
      <div class="empty-state">
        <div class="empty-icon">📈</div>
        <div class="empty-title">아직 데이터가 없어요</div>
        <div class="empty-desc">훈련을 완료하면<br>여기에 통계가 표시됩니다</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">통계</div>
      <div class="page-subtitle">총 ${completed.length}회 훈련</div>
    </div>

    <div class="stats-hand-tabs">
      <button class="stats-hand-tab active left" id="tabLeft">왼손</button>
      <button class="stats-hand-tab right"        id="tabRight">오른손</button>
    </div>

    <div id="statsBody"></div>
    <div style="height:16px"></div>
  `;

  let activeHand = 'left';

  function renderStats(hand) {
    const body = document.getElementById('statsBody');
    body.innerHTML = '';

    const data = completed.map(s => ({
      date:    s.date,
      stage:   s[hand].stage,
      weight:  weightOf(s[hand].stage),
      success: s[hand].mainSuccess,
      sets:    s[hand].sets || [],
      holding: s[hand].holding,
    }));

    // 요약 카드
    const totalSessions = data.length;
    const successCount  = data.filter(d => d.success).length;
    const maxWeight     = Math.max(...data.map(d => d.weight));
    const avgHold       = avg(data.map(d => d.holding).filter(h => h != null));
    const successRate   = totalSessions > 0
      ? Math.round((successCount / totalSessions) * 100) : 0;

    const summaryEl = document.createElement('div');
    summaryEl.style.cssText = 'padding:12px 20px 0';
    summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${summaryCard('성공률', successRate + '%', successRate >= 70 ? 'var(--success)' : 'var(--text-primary)')}
        ${summaryCard('최고 무게', maxWeight + 'kg', 'var(--accent)')}
        ${summaryCard('총 횟수', totalSessions + '회', 'var(--text-primary)')}
        ${summaryCard('평균 홀딩', avgHold != null ? Math.round(avgHold) + '초' : '—', 'var(--text-primary)')}
      </div>
    `;
    body.appendChild(summaryEl);

    // 무게 추이 차트
    const chartEl = document.createElement('div');
    chartEl.style.cssText = 'padding:12px 20px 0';
    chartEl.innerHTML = `
      <div class="chart-card">
        <div class="chart-title">무게 추이</div>
        <div class="chart-area">
          <svg id="weightChart" width="100%" height="140" style="overflow:visible"></svg>
        </div>
      </div>
    `;
    body.appendChild(chartEl);

    // 홀딩 추이 차트
    const holdData = data.filter(d => d.holding != null);
    if (holdData.length > 0) {
      const holdEl = document.createElement('div');
      holdEl.style.cssText = 'padding:12px 20px 0';
      holdEl.innerHTML = `
        <div class="chart-card">
          <div class="chart-title">홀딩 기록 (초)</div>
          <div class="chart-area">
            <svg id="holdChart" width="100%" height="140" style="overflow:visible"></svg>
          </div>
        </div>
      `;
      body.appendChild(holdEl);
      requestAnimationFrame(() => drawLineChart('holdChart', holdData.map(d => d.holding), 0, 20, 'var(--left-color)', hand));
    }

    requestAnimationFrame(() => {
      drawStepChart('weightChart', data, hand);
    });
  }

  renderStats('left');

document.getElementById('tabLeft').addEventListener('click', () => {
  if (activeHand === 'left') return;
  activeHand = 'left';
  document.getElementById('tabLeft').classList.add('active');
  document.getElementById('tabRight').classList.remove('active');
  renderStats('left');
});

document.getElementById('tabRight').addEventListener('click', () => {
  if (activeHand === 'right') return;
  activeHand = 'right';
  document.getElementById('tabRight').classList.add('active');
  document.getElementById('tabLeft').classList.remove('active');
  renderStats('right');
});
}

// ── 무게 단계 차트 (계단형) ───────────────
function drawStepChart(id, data, hand) {
  const svg = document.getElementById(id);
  if (!svg || data.length === 0) return;

  const W = svg.clientWidth || 300;
  const H = 120;
  const PAD = { top: 10, right: 8, bottom: 24, left: 32 };
  const pw  = W - PAD.left - PAD.right;
  const ph  = H - PAD.top  - PAD.bottom;

  const minStage = 0;
  const maxStage = 5;
  const color    = hand === 'left' ? 'var(--left-color)' : 'var(--right-color)';

  const xOf  = i  => PAD.left + (i / Math.max(data.length - 1, 1)) * pw;
  const yOf  = st => PAD.top  + ph - ((st - minStage) / (maxStage - minStage)) * ph;

  // 격자선
  let gridLines = '';
  for (let s = 0; s <= 5; s++) {
    const y = yOf(s);
    const w = WEIGHTS[s];
    gridLines += `
      <line x1="${PAD.left}" y1="${y}" x2="${PAD.left + pw}" y2="${y}"
        stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      <text x="${PAD.left - 4}" y="${y + 4}" text-anchor="end"
        fill="var(--text-tertiary)" font-size="9" font-family="JetBrains Mono,monospace">${w}</text>
    `;
  }

  // 계단형 path
  let path = '';
  let areaPath = '';
  data.forEach((d, i) => {
    const x  = xOf(i);
    const y  = yOf(d.stage);
    const nx = i < data.length - 1 ? xOf(i + 1) : x;

    if (i === 0) {
      path += `M ${x} ${y}`;
      areaPath += `M ${x} ${H - PAD.bottom} L ${x} ${y}`;
    } else {
      path += ` H ${x} V ${y}`;
      areaPath += ` H ${x} V ${y}`;
    }
    // 마지막 점까지 수평
    if (i === data.length - 1) {
      path += ` H ${nx}`;
      areaPath += ` H ${nx} V ${H - PAD.bottom} Z`;
    }
  });

  // 성공/실패 점
  let dots = '';
  data.forEach((d, i) => {
    const x = xOf(i);
    const y = yOf(d.stage);
    dots += `<circle cx="${x}" cy="${y}" r="3.5"
      fill="${d.success ? 'var(--success)' : 'var(--danger)'}"
      stroke="var(--bg-card)" stroke-width="1.5"/>`;
  });

  // x축 날짜 레이블 (최대 5개)
  let xLabels = '';
  const step = Math.max(1, Math.floor(data.length / 5));
  data.forEach((d, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;
    const x   = xOf(i);
    const mon = new Date(d.date).getMonth() + 1;
    const day = new Date(d.date).getDate();
    xLabels += `
      <text x="${x}" y="${H - 4}" text-anchor="middle"
        fill="var(--text-tertiary)" font-size="9">${mon}/${day}</text>
    `;
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGrad_${hand}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${color}" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#areaGrad_${hand})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
    ${xLabels}
  `;
}

// ── 라인 차트 (홀딩) ─────────────────────
function drawLineChart(id, values, minV, maxV, color, hand) {
  const svg = document.getElementById(id);
  if (!svg || values.length === 0) return;

  const W   = svg.clientWidth || 300;
  const H   = 120;
  const PAD = { top: 10, right: 8, bottom: 24, left: 32 };
  const pw  = W - PAD.left - PAD.right;
  const ph  = H - PAD.top  - PAD.bottom;

  const xOf = i => PAD.left + (i / Math.max(values.length - 1, 1)) * pw;
  const yOf = v => PAD.top  + ph - ((Math.min(v, maxV) - minV) / (maxV - minV)) * ph;

  // 목표선 (20초)
  const targetY = yOf(20);

  let points = values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  let areaPts = `${xOf(0)},${H - PAD.bottom} ` + points + ` ${xOf(values.length - 1)},${H - PAD.bottom}`;

  let dots = '';
  values.forEach((v, i) => {
    dots += `<circle cx="${xOf(i)}" cy="${yOf(v)}" r="3"
      fill="${v >= 20 ? 'var(--success)' : color}"
      stroke="var(--bg-card)" stroke-width="1.5"/>`;
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="holdGrad_${hand}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${color}" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="${PAD.left}" y1="${targetY}" x2="${PAD.left + pw}" y2="${targetY}"
      stroke="rgba(52,211,153,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${PAD.left + pw - 2}" y="${targetY - 4}" text-anchor="end"
      fill="rgba(52,211,153,0.5)" font-size="9">20초</text>
    <polygon points="${areaPts}" fill="url(#holdGrad_${hand})"/>
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  `;
}

// ── 요약 카드 ─────────────────────────────
function summaryCard(label, value, color) {
  return `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:14px 16px">
      <div style="font-size:11px;color:var(--text-tertiary);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">${label}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:${color}">${value}</div>
    </div>
  `;
}

function avg(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
