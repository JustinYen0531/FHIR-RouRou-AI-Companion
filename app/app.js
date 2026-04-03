const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GROQ_API_KEY = '';
const DEFAULT_GOOGLE_API_KEY = '';
const DEFAULT_PROVIDER = localStorage.getItem('rourou.aiProvider') || 'google';

/* ══════════════════════════════════════════════
   THERAPEUTIC MEMORY MODULE
   管理病人心理畫像：讀寫、合併、注入
   ══════════════════════════════════════════════ */
const TherapeuticMemory = {
  KEY: 'rourou.therapeuticProfile',

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || this._default();
    } catch {
      return this._default();
    }
  },

  save(profile) {
    profile.lastUpdatedAt = new Date().toISOString();
    localStorage.setItem(this.KEY, JSON.stringify(profile));
    this.renderProfileUI();
  },

  merge(updates) {
    const profile = this.get();

    if (updates.stressors && Array.isArray(updates.stressors)) {
      updates.stressors.forEach(s => {
        const label = typeof s === 'string' ? s : s.label;
        if (!label) return;
        const existing = profile.stressors.find(e => e.label === label);
        if (existing) {
          existing.confidence = Math.min(1, (existing.confidence || 0.5) + 0.1);
          existing.lastSeen = new Date().toISOString().slice(0, 10);
        } else {
          profile.stressors.push({ label, confidence: 0.6, firstSeen: new Date().toISOString().slice(0, 10), lastSeen: new Date().toISOString().slice(0, 10) });
        }
      });
    }

    if (updates.triggers && Array.isArray(updates.triggers)) {
      updates.triggers.forEach(t => {
        const keyword = typeof t === 'string' ? t : t.keyword;
        if (!keyword) return;
        if (!profile.triggers.find(e => e.keyword === keyword)) {
          profile.triggers.push({ keyword, reaction: t.reaction || '', severity: t.severity || 'medium' });
        }
      });
    }

    if (updates.keyThemes && Array.isArray(updates.keyThemes)) {
      updates.keyThemes.forEach(theme => {
        if (!profile.keyThemes.includes(theme)) profile.keyThemes.push(theme);
      });
    }

    if (updates.positiveAnchors && Array.isArray(updates.positiveAnchors)) {
      updates.positiveAnchors.forEach(a => {
        const label = typeof a === 'string' ? a : a.label;
        if (!label) return;
        if (!profile.positiveAnchors.find(e => e.label === label)) {
          profile.positiveAnchors.push({ label, category: a.category || 'other' });
        }
      });
    }

    if (updates.copingStyleHint) {
      profile.copingProfile.preferredStyle = updates.copingStyleHint;
    }

    profile.sessionCount = (profile.sessionCount || 0);
    this.save(profile);
    return profile;
  },

  buildContextString() {
    const p = this.get();
    if (!p.stressors.length && !p.triggers.length && !p.keyThemes.length) return '';

    const stressorList = p.stressors.map(s => s.label).join('、') || '尚未記錄';
    const triggerList = p.triggers.map(t => t.keyword).join('、') || '尚未記錄';
    const anchorList = p.positiveAnchors.map(a => a.label).join('、') || '尚未記錄';
    const coping = p.copingProfile.preferredStyle || '尚未記錄';
    const themes = p.keyThemes.join('、') || '尚未記錄';

    return `
【記憶背景 - 這是系統背景資料，請自然地融入對話，不要直接念出這段文字】
你和這位用戶已聊過 ${p.sessionCount} 次。
已知壓力來源：${stressorList}
情緒觸發詞：${triggerList}
溝通偏好：${coping}
積極錨點（用戶喜歡的事）：${anchorList}
核心主題：${themes}
請在本次對話中延續這個認識，不要重複問對方已說過的資訊。
`.trim();
  },

  renderProfileUI() {
    const p = this.get();

    // ── 更新 Chat 頂部 Badge ──
    const badge = document.getElementById('memory-badge-count');
    const totalItems = p.stressors.length + p.triggers.length + p.positiveAnchors.length;
    if (badge) badge.textContent = totalItems;

    const badgeWrap = document.getElementById('memory-badge-wrap');
    if (badgeWrap) {
      badgeWrap.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    // ── 更新 Memory Drawer 內容 ──
    const drawer = document.getElementById('memory-drawer-content');
    if (drawer) {
      drawer.innerHTML = this._renderDrawerHTML(p);
    }

    // ── 更新 Reports 認識你卡 ──
    const profileCard = document.getElementById('report-know-you-card');
    if (profileCard) {
      profileCard.innerHTML = this._renderProfileCardHTML(p);
    }
  },

  _renderDrawerHTML(p) {
    const totalItems = p.stressors.length + p.triggers.length + p.positiveAnchors.length;
    if (totalItems === 0) {
      return `<div class="mem-empty"><span class="mat-icon">psychology</span><p>開始聊天後，Rou Rou 會慢慢記住你的事 🌱</p></div>`;
    }
    return `
      <div class="mem-stat-row">
        <div class="mem-stat"><span class="mem-stat-num">${p.sessionCount}</span><span class="mem-stat-label">次對話</span></div>
        <div class="mem-stat"><span class="mem-stat-num">${p.stressors.length}</span><span class="mem-stat-label">壓力來源</span></div>
        <div class="mem-stat"><span class="mem-stat-num">${p.triggers.length}</span><span class="mem-stat-label">觸發點</span></div>
      </div>
      ${p.stressors.length ? `
        <div class="mem-section">
          <div class="mem-section-title"><span class="mat-icon">priority_high</span> 主要壓力</div>
          <div class="mem-tags">${p.stressors.map(s => `<span class="mem-tag stress">${s.label}</span>`).join('')}</div>
        </div>` : ''}
      ${p.triggers.length ? `
        <div class="mem-section">
          <div class="mem-section-title"><span class="mat-icon">electric_bolt</span> 情緒觸發點</div>
          <div class="mem-tags">${p.triggers.map(t => `<span class="mem-tag trigger">「${t.keyword}」</span>`).join('')}</div>
        </div>` : ''}
      ${p.positiveAnchors.length ? `
        <div class="mem-section">
          <div class="mem-section-title"><span class="mat-icon">favorite</span> 你喜歡的事</div>
          <div class="mem-tags">${p.positiveAnchors.map(a => `<span class="mem-tag anchor">${a.label}</span>`).join('')}</div>
        </div>` : ''}
      ${p.copingProfile.preferredStyle ? `
        <div class="mem-section">
          <div class="mem-section-title"><span class="mat-icon">chat</span> 溝通偏好</div>
          <p class="mem-coping">${p.copingProfile.preferredStyle}</p>
        </div>` : ''}
      <button class="mem-clear-btn" onclick="TherapeuticMemory.clearProfile()">
        <span class="mat-icon">delete_sweep</span> 清除記憶
      </button>
    `;
  },

  _renderProfileCardHTML(p) {
    const totalItems = p.stressors.length + p.triggers.length + p.positiveAnchors.length;
    if (totalItems === 0) {
      return `
        <div class="know-you-empty">
          <span class="mat-icon">psychology</span>
          <p>還沒有足夠的對話資料<br>開始聊天後，這裡會出現 Rou Rou 對你的認識</p>
        </div>`;
    }
    return `
      <div class="know-you-header">
        <div class="know-you-avatar"><span class="mat-icon fill">psychology</span></div>
        <div>
          <div class="know-you-title">Rou Rou 認識你</div>
          <div class="know-you-sub">已陪伴你 ${p.sessionCount} 次對話・記住了 ${totalItems} 件事</div>
        </div>
      </div>
      <div class="know-you-last">最後更新：${p.lastUpdatedAt ? new Date(p.lastUpdatedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '剛剛'}</div>
      ${p.stressors.length ? `
        <div class="know-you-row">
          <div class="know-you-icon stress"><span class="mat-icon">priority_high</span></div>
          <div class="know-you-info">
            <div class="know-you-label">主要壓力來源</div>
            <div class="know-you-value">${p.stressors.map(s => s.label).join('・')}</div>
          </div>
        </div>` : ''}
      ${p.triggers.length ? `
        <div class="know-you-row">
          <div class="know-you-icon trigger"><span class="mat-icon">electric_bolt</span></div>
          <div class="know-you-info">
            <div class="know-you-label">情緒觸發點</div>
            <div class="know-you-value">${p.triggers.map(t => `「${t.keyword}」`).join(' ')}</div>
          </div>
        </div>` : ''}
      ${p.positiveAnchors.length ? `
        <div class="know-you-row">
          <div class="know-you-icon anchor"><span class="mat-icon">favorite</span></div>
          <div class="know-you-info">
            <div class="know-you-label">你喜歡的放鬆方式</div>
            <div class="know-you-value">${p.positiveAnchors.map(a => a.label).join('・')}</div>
          </div>
        </div>` : ''}
      ${p.copingProfile.preferredStyle ? `
        <div class="know-you-row">
          <div class="know-you-icon coping"><span class="mat-icon">chat_bubble</span></div>
          <div class="know-you-info">
            <div class="know-you-label">溝通風格</div>
            <div class="know-you-value">${p.copingProfile.preferredStyle}</div>
          </div>
        </div>` : ''}
      ${p.keyThemes.length ? `
        <div class="know-you-row">
          <div class="know-you-icon theme"><span class="mat-icon">bookmark</span></div>
          <div class="know-you-info">
            <div class="know-you-label">核心主題</div>
            <div class="know-you-value">${p.keyThemes.join('・')}</div>
          </div>
        </div>` : ''}
      <button class="know-you-edit-btn" onclick="TherapeuticMemory.clearProfile()">
        <span class="mat-icon">delete_sweep</span> 清除所有記憶
      </button>
    `;
  },

  clearProfile() {
    if (!confirm('確定要清除 Rou Rou 對你的所有記憶嗎？')) return;
    localStorage.removeItem(this.KEY);
    this.renderProfileUI();
    appendSystemNotice('記憶已清除。Rou Rou 下次會重新認識你。');
  },

  incrementSession() {
    const p = this.get();
    p.sessionCount = (p.sessionCount || 0) + 1;
    this.save(p);
  },

  _default() {
    return {
      version: '1.0',
      userId: (typeof APP_STATE !== 'undefined' ? APP_STATE.userId : '') || '',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      sessionCount: 0,
      stressors: [],
      triggers: [],
      copingProfile: { preferredStyle: '', effectiveMethods: [], ineffectiveMethods: [] },
      positiveAnchors: [],
      emotionalBaseline: { dominantMood: '', phq9Trend: [], hamdSignalCount: 0 },
      keyThemes: [],
      clinicianNotes: ''
    };
  }
};

window.TherapeuticMemory = TherapeuticMemory;

const APP_STATE = {
  currentScreen: 'screen-chat',
  conversationId: '',
  userId: localStorage.getItem('rourou.userId') || `user-${crypto.randomUUID()}`,
  selectedMode: localStorage.getItem('rourou.selectedMode') || 'natural',
  syncedMode: '',
  isSending: false,
  currentReportTab: 'auto',
  currentWeeklyAudience: 'patient',
  turnCount: 0,
  moodPoints: [100, 100, 100, 100, 100, 100, 100], 
  selectedMoodTags: [],
  phq9Scores: Array(9).fill(0),
  reportOutputs: {
    clinician_summary: null,
    patient_analysis: null,
    patient_review: null,
    fhir_delivery: null,
    session_export: null,
    updatedAt: ''
  }
};

const MODE_DEFINITIONS = {
  void: { command: 'void', label: '模式：樹洞模式', display: '樹洞模式' },
  soul: { command: 'soulmate', label: '模式：靈魂陪伴', display: '靈魂陪伴' },
  mission: { command: 'mission', label: '模式：任務引導', display: '任務引導' },
  option: { command: 'option', label: '模式：選項引導', display: '選項引導' },
  smart: { command: 'natural', label: '模式：自然聊天', display: '自然聊天' },
  natural: { command: 'natural', label: '模式：自然聊天', display: '自然聊天' },
  auto: { command: 'auto', label: '模式：自動分流', display: 'Auto 自動分流' }
};

const OUTPUT_DEFINITIONS = {
  clinician_summary: { label: '整理給醫師', instruction: '幫我整理給醫生' },
  patient_analysis: { label: '請分析我', instruction: '請分析我' },
  patient_review: { label: '病人審閱稿', instruction: '產生病人審閱稿' },
  fhir_delivery: { label: 'FHIR 草稿', instruction: '產生FHIR draft' }
};

const OUTPUT_COMMANDS = [
  { type: 'clinician_summary', patterns: [/幫我整理給醫生/, /整理給醫師/, /醫師摘要/, /clinician summary/i, /doctor summary/i] },
  { type: 'patient_analysis', patterns: [/請分析我/, /分析我/, /給我分析/, /給我病人版本/, /patient analysis/i] },
  { type: 'patient_review', patterns: [/病人審閱稿/, /patient review/i] },
  { type: 'fhir_delivery', patterns: [/fhir draft/i, /\bfhir\b/i, /產生fhir/i] }
];

function detectOutputCommand(text) {
  const normalized = String(text || '').trim();
  for (const item of OUTPUT_COMMANDS) {
    if (item.patterns.some((pattern) => pattern.test(normalized))) {
      return item.type;
    }
  }
  return '';
}

function formatTimeLabel(date = new Date()) {
  return date.toLocaleString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    day: 'numeric'
  });
}

function getHamdSummary(summary) {
  const signalCount = Array.isArray(summary?.hamd_signals) ? summary.hamd_signals.length : 0;
  const concerns = Array.isArray(summary?.chief_concerns) ? summary.chief_concerns : [];
  const observations = Array.isArray(summary?.symptom_observations) ? summary.symptom_observations : [];
  const pendingTopics = [...new Set([...concerns, ...observations])].slice(0, 3);

  if (signalCount >= 4) {
    return {
      progressPercent: 75,
      progressLabel: '已整理較多情緒線索',
      trend: '仍需人工評估後才能下定論',
      primaryStatLabel: '目前完成',
      primaryStatValue: '75%',
      secondaryStatLabel: '仍需評估',
      secondaryStatValue: pendingTopics.join('、') || '安全風險與症狀變化'
    };
  }
  if (signalCount >= 2) {
    return {
      progressPercent: 55,
      progressLabel: '已完成初步整理',
      trend: '還需要更多對話確認脈絡',
      primaryStatLabel: '目前完成',
      primaryStatValue: '55%',
      secondaryStatLabel: '仍需評估',
      secondaryStatValue: pendingTopics.join('、') || '情緒波動與生活功能'
    };
  }
  if (signalCount >= 1) {
    return {
      progressPercent: 35,
      progressLabel: '已記錄本次重點',
      trend: '目前僅能視為初步訊號整理',
      primaryStatLabel: '目前完成',
      primaryStatValue: '35%',
      secondaryStatLabel: '仍需評估',
      secondaryStatValue: pendingTopics.join('、') || '情緒低落、壓力來源、睡眠與動機'
    };
  }
  return {
    progressPercent: 20,
    progressLabel: '尚未形成足夠評估依據',
    trend: '目前以一般聊天記錄為主',
    primaryStatLabel: '目前完成',
    primaryStatValue: '20%',
    secondaryStatLabel: '仍需評估',
    secondaryStatValue: '需要更多描述才能整理成醫療摘要'
  };
}

function renderClinicalInsights(summary) {
  const concerns = Array.isArray(summary?.chief_concerns) ? summary.chief_concerns : [];
  const observations = Array.isArray(summary?.symptom_observations) ? summary.symptom_observations : [];
  const hamdSignals = Array.isArray(summary?.hamd_signals) ? summary.hamd_signals : [];
  const combined = [
    ...concerns.map((item) => ({ title: '主要困擾', body: item, icon: 'priority_high' })),
    ...observations.map((item) => ({ title: '症狀觀察', body: item, icon: 'visibility' })),
    ...hamdSignals.map((item) => ({ title: 'HAM-D 線索', body: item, icon: 'monitor_heart' }))
  ].slice(0, 6);

  if (!combined.length) {
    return `
      <div class="insight-row">
        <div class="insight-ico tertiary"><span class="mat-icon">info</span></div>
        <div class="insight-text"><b>尚未產生醫師摘要</b><span>按下「整理給醫師」後，這裡會更新成可閱讀的重點條目。</span></div>
      </div>
    `;
  }

  return combined.map((item) => `
    <div class="insight-row">
      <div class="insight-ico tertiary"><span class="mat-icon">${item.icon}</span></div>
      <div class="insight-text"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.body)}</span></div>
    </div>
  `).join('');
}

function renderPatientAnalysisMarkdown(analysis) {
  const markdown = analysis?.markdown || [
    '## 給你的分析',
    '',
    analysis?.plain_summary || analysis?.patient_facing_summary || '目前還沒有足夠內容可以整理成給病人的分析。',
    '',
    '### 提醒',
    '',
    analysis?.reminder || '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。'
  ].join('\n');

  return renderMessageMarkdown(markdown);
}

function renderReportOutputs() {
  const clinician = APP_STATE.reportOutputs.clinician_summary || {};
  const patientAnalysis = APP_STATE.reportOutputs.patient_analysis || {};
  const patientReview = APP_STATE.reportOutputs.patient_review || {};
  const fhirDelivery = APP_STATE.reportOutputs.fhir_delivery || {};
  const updatedAt = APP_STATE.reportOutputs.updatedAt;
  const hamd = getHamdSummary(clinician);

  const intro = document.getElementById('report-auto-intro');
  const heading = document.getElementById('report-hamd-heading');
  const score = document.getElementById('report-hamd-score');
  const desc = document.getElementById('report-hamd-desc');
  const trend = document.getElementById('report-trend-label');
  const ring = document.getElementById('report-hamd-progress-ring');
  const primaryStatLabel = document.getElementById('report-hamd-primary-label');
  const primaryStatValue = document.getElementById('report-hamd-primary-value');
  const secondaryStatLabel = document.getElementById('report-hamd-secondary-label');
  const secondaryStatValue = document.getElementById('report-hamd-secondary-value');
  const insights = document.getElementById('report-clinical-insights');
  const note = document.getElementById('report-clinician-note');
  const patientAnalysisMarkdown = document.getElementById('report-patient-analysis-markdown');
  const patientAnalysisMeta = document.getElementById('report-patient-analysis-meta');
  const fhirStatus = document.getElementById('report-fhir-status');
  const fhirSummary = document.getElementById('report-fhir-summary');
  const fhirResources = document.getElementById('report-fhir-resources');
  const authNote = document.getElementById('report-auth-note');

  if (intro) {
    intro.textContent = updatedAt
      ? `這是 Rou Rou 依據最新對話整理的報表。最後更新時間：${updatedAt}。`
      : '這是 Rou Rou 為你整理的本週心情概覽，請確認資訊準確後再交由醫師審閱。';
  }

  if (heading) heading.textContent = 'HAM-D 評估進度';
  if (score) score.textContent = `${hamd.progressPercent}%`;
  if (desc) desc.textContent = hamd.progressLabel;
  if (trend) trend.textContent = hamd.trend;
  if (ring) {
    const circumference = 440;
    const progress = Math.max(0, Math.min(100, hamd.progressPercent));
    const offset = circumference - (circumference * progress) / 100;
    ring.setAttribute('stroke-dashoffset', String(offset));
  }
  if (primaryStatLabel) primaryStatLabel.textContent = hamd.primaryStatLabel;
  if (primaryStatValue) primaryStatValue.textContent = hamd.primaryStatValue;
  if (secondaryStatLabel) secondaryStatLabel.textContent = hamd.secondaryStatLabel;
  if (secondaryStatValue) secondaryStatValue.textContent = hamd.secondaryStatValue;
  if (insights) insights.innerHTML = renderClinicalInsights(clinician);

  if (note) {
    note.value = clinician?.draft_summary || '';
  }

  if (patientAnalysisMarkdown) {
    patientAnalysisMarkdown.innerHTML = renderPatientAnalysisMarkdown(patientAnalysis);
  }

  if (patientAnalysisMeta) {
    patientAnalysisMeta.textContent = patientAnalysis?.status
      ? `目前狀態：${patientAnalysis.status}`
      : '目前狀態：尚未生成';
  }

  if (fhirStatus) {
    fhirStatus.textContent = fhirDelivery?.delivery_status || '尚未生成';
  }

  if (fhirSummary) {
    fhirSummary.textContent = fhirDelivery?.narrative_summary || '尚未產生 FHIR Draft。按下「FHIR Draft」後，這裡會顯示可交付摘要。';
  }

  if (fhirResources) {
    const count = Array.isArray(fhirDelivery?.resources) ? fhirDelivery.resources.length : 0;
    fhirResources.textContent = `FHIR resources：${count}`;
  }

  if (authNote) {
    authNote.textContent = updatedAt
      ? `我已確認以上報表內容。若要交付給主治醫師，請確認最後更新時間與摘要內容。最後更新：${updatedAt}。`
      : '我已確認以上報告內容，並授權 Rou Rou 將此摘要加密傳送至主治醫師診間系統，以作為本次診療輔助。';
  }
}

function storeOutputResult(payload) {
  APP_STATE.reportOutputs[payload.output_type] = payload.output || null;
  APP_STATE.reportOutputs.session_export = payload.session_export || APP_STATE.reportOutputs.session_export;
  APP_STATE.reportOutputs.updatedAt = formatTimeLabel(new Date());
  renderReportOutputs();
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === screenId);
  });

  document.querySelectorAll('.bottom-nav .nav-item').forEach((item) => {
    const target = item.getAttribute('onclick') || '';
    item.classList.toggle('active', target.includes(screenId));
  });

  APP_STATE.currentScreen = screenId;
  
  if (screenId === 'screen-report') {
    renderMoodChart();
  }
}

function switchAutoAudience(audience) {
  APP_STATE.currentWeeklyAudience = audience === 'doctor' ? 'doctor' : 'patient';

  document.querySelectorAll('.report-audience-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.audience === APP_STATE.currentWeeklyAudience);
  });

  const patientView = document.getElementById('report-audience-patient');
  const doctorView = document.getElementById('report-audience-doctor');
  if (patientView) {
    patientView.style.display = APP_STATE.currentWeeklyAudience === 'patient' ? 'block' : 'none';
  }
  if (doctorView) {
    doctorView.style.display = APP_STATE.currentWeeklyAudience === 'doctor' ? 'block' : 'none';
  }
}

function switchReportTab(tabId) {
  APP_STATE.currentReportTab = tabId;
  
  document.querySelectorAll('.report-tab').forEach(btn => {
    const isActive = btn.getAttribute('onclick').includes(tabId);
    btn.classList.toggle('active', isActive);
    
    // Toggle mat-icon fill
    const icon = btn.querySelector('.mat-icon');
    if (icon) {
      if (isActive) icon.classList.add('fill');
      else icon.classList.remove('fill');
    }
  });

  document.querySelectorAll('.report-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `report-tab-${tabId}`);
  });

  if (tabId === 'manual') {
    setTimeout(renderMoodChart, 50); // Small delay to ensure container is visible for sizing
  }
}

const MOOD_LABELS = {
  0: '非常開心',
  50: '愉悅',
  100: '平穩',
  150: '低落',
  200: '極端沮喪'
};

function getMoodLabel(y) {
  if (y < 40) return '非常開心';
  if (y < 80) return '愉悅';
  if (y < 120) return '平穩';
  if (y < 160) return '低落';
  return '極端沮喪';
}

function updateMoodDisplay(y) {
  const labelEl = document.getElementById('current-mood-val');
  if (labelEl) {
    labelEl.textContent = getMoodLabel(y);
  }
}

function renderMoodChart() {
  const svg = document.getElementById('mood-curve-svg');
  if (!svg) return;
  
  const gPoints = document.getElementById('mood-points');
  const pathLine = document.getElementById('mood-path-line');
  const pathBg = document.getElementById('mood-path-bg');
  
  const width = 350;
  const height = 200;
  const points = APP_STATE.moodPoints;
  const stepX = width / (points.length - 1);
  
  // Clear old points
  gPoints.innerHTML = '';
  
  let d = `M 0,${points[0]}`;
  
  points.forEach((y, i) => {
    const x = i * stepX;
    
    // Curve calculation (simple bezier)
    if (i > 0) {
      const prevX = (i - 1) * stepX;
      const prevY = points[i-1];
      const cp1x = prevX + (x - prevX) / 2;
      d += ` C ${cp1x},${prevY} ${cp1x},${y} ${x},${y}`;
    }
    
    // Draw point
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "6");
    circle.setAttribute("fill", "white");
    circle.setAttribute("stroke", "var(--primary)");
    circle.setAttribute("stroke-width", "3");
    circle.setAttribute("class", "mood-point");
    
    // Interaction
    circle.onmousedown = (e) => startDrag(e, i);
    circle.ontouchstart = (e) => startDrag(e, i);
    
    gPoints.appendChild(circle);
  });
  
  pathLine.setAttribute("d", d);
  pathBg.setAttribute("d", d + ` L ${width},${height} L 0,${height} Z`);
  
  function startDrag(e, index) {
    e.preventDefault();
    const moveHandler = (moveEvent) => {
      const rect = svg.getBoundingClientRect();
      const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      let newY = ((clientY - rect.top) / rect.height) * height;
      
      // Constraints
      newY = Math.max(10, Math.min(190, newY));
      
      APP_STATE.moodPoints[index] = newY;
      renderMoodChart();
      updateMoodDisplay(newY);
    };
    
    const upHandler = () => {
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
      window.removeEventListener('touchmove', moveHandler);
      window.removeEventListener('touchend', upHandler);
    };
    
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    window.addEventListener('touchmove', moveHandler);
    window.addEventListener('touchend', upHandler);
  }
}

function toggleMoodTag(el, tag) {
  el.classList.toggle('active');
  const index = APP_STATE.selectedMoodTags.indexOf(tag);
  if (index === -1) APP_STATE.selectedMoodTags.push(tag);
  else APP_STATE.selectedMoodTags.splice(index, 1);
}

function setPHQ(questionIndex, score) {
  APP_STATE.phq9Scores[questionIndex] = score;
  const phqItem = document.querySelectorAll('.phq-item')[questionIndex];
  if (phqItem) {
    phqItem.querySelectorAll('.phq-opt').forEach((opt, i) => {
      opt.classList.toggle('active', i === score);
    });
  }
}

function updateModeLabels() {
  const mode = MODE_DEFINITIONS[APP_STATE.selectedMode] || MODE_DEFINITIONS.natural;
  const chatModeLabel = document.getElementById('chat-mode-label');
  const currentModeName = document.getElementById('current-mode-name');

  if (chatModeLabel) {
    chatModeLabel.textContent = mode.label;
  }

  if (currentModeName) {
    currentModeName.textContent = mode.display;
  }
}

function selectMode(element, modeLabel, modeKey) {
  APP_STATE.selectedMode = modeKey || 'natural';
  localStorage.setItem('rourou.selectedMode', APP_STATE.selectedMode);

  document.querySelectorAll('.mode-card, .mode-card-sm').forEach((card) => {
    card.classList.remove('active');
    const badge = card.querySelector('.active-badge');
    if (badge && !card.contains(element)) {
      badge.remove();
    }
  });

  if (element) {
    element.classList.add('active');
    if (!element.querySelector('.active-badge')) {
      const badge = document.createElement('div');
      badge.className = 'active-badge';
      badge.textContent = 'ACTIVE';
      element.appendChild(badge);
    }
  }

  if (modeLabel) {
    const currentModeName = document.getElementById('current-mode-name');
    if (currentModeName) {
      currentModeName.textContent = modeLabel;
    }
  }

  updateModeLabels();
}

function startChat() {
  showScreen('screen-chat');
  appendSystemNotice(`已切換為 ${MODE_DEFINITIONS[APP_STATE.selectedMode]?.display || '自然聊天'}。`);
}

function sendQuickReply(text) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = text;
  sendMessage();
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(value));
  return div.innerHTML;
}

function renderInlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\*)([^*]+)\*/g, '<em>$1</em>');
}

function renderMessageMarkdown(text) {
  const normalized = escapeHtml(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '';
  }

  const blocks = normalized.split(/\n{2,}/);
  const html = blocks.map((block) => {
    const lines = block.split('\n').filter(Boolean);

    if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
      const items = lines
        .map((line) => `<li>${renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }

    if (lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line))) {
      const items = lines
        .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    }

    return `<p>${renderInlineMarkdown(lines.join('<br/>'))}</p>`;
  }).join('');

  return html;
}

function createMessageBubble(role) {
  const container = document.getElementById('chat-messages');
  if (!container) return {};

  const group = document.createElement('div');
  group.className = `msg-group ${role}`;

  const bubble = document.createElement('div');
  bubble.className = `bubble ${role === 'user' ? 'user-bubble' : 'ai-bubble'}`;
  group.appendChild(bubble);

  const typingIndicator = container.querySelector('.typing-indicator');
  if (typingIndicator) {
    container.insertBefore(group, typingIndicator);
  } else {
    container.appendChild(group);
  }

  scrollChatToBottom();
  return { container, group, bubble };
}

function getTypingDelay(character) {
  if (character === '\n') return 70;
  if (/[，、；：]/.test(character)) return 35;
  if (/[。！？]/.test(character)) return 90;
  return 8;
}

async function animateAiMessage(bubble, text) {
  const normalized = (text || '').replace(/\r\n/g, '\n');
  bubble.classList.add('is-typing');
  bubble.textContent = '';

  for (const character of normalized) {
    bubble.textContent += character;
    scrollChatToBottom();
    await new Promise((resolve) => setTimeout(resolve, getTypingDelay(character)));
  }

  bubble.classList.remove('is-typing');
  bubble.innerHTML = renderMessageMarkdown(normalized);
  scrollChatToBottom();
}

function handleInput(input) {
  const qrc = document.getElementById('quick-replies');
  const soa = document.getElementById('structured-output-actions');
  const hasFocus = document.activeElement === input;
  const isEmpty = input.value.trim().length === 0;
  const shouldShow = hasFocus && isEmpty;
  
  [qrc, soa].forEach(el => {
    if (!el) return;
    if (shouldShow) {
      el.style.display = 'flex';
      setTimeout(() => {
        if (document.activeElement === input && input.value.trim().length === 0) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          el.style.pointerEvents = 'all';
        }
      }, 50);
    } else {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.pointerEvents = 'none';
      setTimeout(() => {
        if (!(document.activeElement === input && input.value.trim().length === 0)) {
          el.style.display = 'none';
        }
      }, 300);
    }
  });
}

function setThinkingState(visible, nodeName = '') {
  const label = document.getElementById('thinking-node-label');
  if (label) {
    label.textContent = nodeName;
  }
}

function setTyping(visible) {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.style.display = visible ? 'flex' : 'none';
    scrollChatToBottom();
  }
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

async function appendMessage(role, text, options = {}) {
  const { bubble } = createMessageBubble(role);
  if (!bubble) return;

  if (role === 'ai' && options.animate) {
    await animateAiMessage(bubble, text);
    return;
  }

  if (role === 'ai') {
    bubble.innerHTML = renderMessageMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  scrollChatToBottom();
}

function appendSystemNotice(text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const notice = document.createElement('div');
  notice.className = 'sensor-badge';
  notice.innerHTML = `<span>${escapeHtml(text)}</span><span class="mat-icon fill" style="font-size:14px">tune</span>`;

  const firstNode = container.firstElementChild;
  if (firstNode) {
    container.insertBefore(notice, firstNode.nextSibling);
  } else {
    container.appendChild(notice);
  }
}

function formatChatError(payload = {}) {
  const message = payload.error || '聊天訊息送出失敗';

  if (payload.code === 'internal_server_error' || payload.status === 500) {
    return `AI Companion 後端回了 500 錯誤，流程目前沒有成功執行。\n\n原始訊息：${message}`;
  }

  if (payload.code === 'groq_timeout' || payload.status === 504) {
    return 'Groq 超時了，這次等待太久沒有回來。通常代表模型沒有回應或後端執行過慢。';
  }

  if (payload.code === 'RESOURCE_EXHAUSTED' || payload.status === 429) {
    return `模型供應商目前拒絕請求，通常是配額或速率限制。\n\n原始訊息：${message}`;
  }

  if (message.includes('Missing Groq API key') || message.includes('Missing Google API key')) {
    return '目前沒有可用的模型 API key，請到 Settings 確認聊天引擎設定。';
  }

  return `目前無法連接聊天流：${message}`;
}

function getRuntimeConfig() {
  const provider = localStorage.getItem('rourou.aiProvider') || DEFAULT_PROVIDER;
  return {
    provider,
    apiBaseUrl:
      localStorage.getItem('rourou.aiBaseUrl') ||
      (provider === 'google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_GROQ_BASE_URL),
    apiKey:
      localStorage.getItem('rourou.aiApiKey') ||
      (provider === 'google' ? DEFAULT_GOOGLE_API_KEY : DEFAULT_GROQ_API_KEY),
    model: localStorage.getItem('rourou.aiModel') || (provider === 'google' ? 'gemini-2.0-flash' : 'llama-3.1-8b-instant'),
    userId: APP_STATE.userId
  };
}

function initializeRuntimeConfig() {
  if (!localStorage.getItem('rourou.aiProvider')) {
    localStorage.setItem('rourou.aiProvider', DEFAULT_PROVIDER);
  }

  if (!localStorage.getItem('rourou.aiBaseUrl')) {
    localStorage.setItem('rourou.aiBaseUrl', DEFAULT_PROVIDER === 'google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_GROQ_BASE_URL);
  }

  if (!localStorage.getItem('rourou.aiApiKey')) {
    localStorage.setItem('rourou.aiApiKey', DEFAULT_PROVIDER === 'google' ? DEFAULT_GOOGLE_API_KEY : DEFAULT_GROQ_API_KEY);
  }

  if (!localStorage.getItem('rourou.aiModel')) {
    localStorage.setItem('rourou.aiModel', DEFAULT_PROVIDER === 'google' ? 'gemini-2.0-flash' : 'llama-3.1-8b-instant');
  }
}

async function ensureModeSynced() {
  const mode = MODE_DEFINITIONS[APP_STATE.selectedMode] || MODE_DEFINITIONS.natural;
  if (!mode.command || APP_STATE.syncedMode === mode.command) {
    return;
  }

  const config = getRuntimeConfig();
  const response = await fetch('/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: mode.command,
        conversation_id: APP_STATE.conversationId,
        user: config.userId,
        api_provider: config.provider,
        api_key: config.apiKey,
        api_base_url: config.apiBaseUrl,
        api_model: config.model,
        hide_response: true
      })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || '模式同步失敗');
  }

  APP_STATE.conversationId = payload.conversation_id || APP_STATE.conversationId;
  APP_STATE.syncedMode = mode.command;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  if (!input || APP_STATE.isSending) return;

  const message = input.value.trim();
  if (!message) return;

  const outputType = detectOutputCommand(message);
  if (outputType) {
    await appendMessage('user', message);
    input.value = '';
    handleInput(input);
    await requestOutput(outputType, { fromChatCommand: true });
    return;
  }

  APP_STATE.isSending = true;
  await appendMessage('user', message);
  input.value = '';
  handleInput(input); // To restore quick replies UI state if needed
  setTyping(true);

  try {
    setThinkingState(true, '正在分析對話脈絡...');
    await new Promise(r => setTimeout(r, 1200));
    setThinkingState(true, '同步臨床歷史紀錄...');
    await new Promise(r => setTimeout(r, 800));

    await ensureModeSynced();

    setThinkingState(true, '正在生成暖心回覆...');
    const config = getRuntimeConfig();
    const memoryContext = TherapeuticMemory.buildContextString();
    const messageWithMemory = memoryContext ? `${memoryContext}\n\n用戶說：${message}` : message;
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageWithMemory,
        conversation_id: APP_STATE.conversationId,
        user: config.userId,
        api_provider: config.provider,
        api_key: config.apiKey,
        api_base_url: config.apiBaseUrl,
        api_model: config.model
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(formatChatError(payload));
    }

    APP_STATE.conversationId = payload.conversation_id || APP_STATE.conversationId;
    APP_STATE.turnCount++;
    setTyping(false);
    await appendMessage('ai', payload.answer || '我有收到你的訊息，但這次沒有拿到完整回覆。', { animate: true });

    // 每 3 輪觸發自動萃取
    if (APP_STATE.turnCount % 3 === 0) {
      extractProfileFromConversation();
    }
  } catch (error) {
    setTyping(false);
    await appendMessage('ai', error.message || '目前無法連接聊天流。', { animate: true });
  } finally {
    APP_STATE.isSending = false;
  }
}

async function extractProfileFromConversation() {
  try {
    const config = getRuntimeConfig();
    const extractPrompt = `請分析我們的對話，幫我萃取以下格式的 JSON，只回傳 JSON 不要其他文字：
{
  "stressors": ["壓力來源1", "壓力來源2"],
  "triggers": [{"keyword": "觸發詞", "reaction": "反應描述", "severity": "high|medium|low"}],
  "keyThemes": ["核心主題1"],
  "positiveAnchors": ["正向錨點1"],
  "copingStyleHint": "溝通偏好描述"
}
如果某個欄位沒有足夠資訊，請用空陣列或空字串。`;

    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: extractPrompt,
        conversation_id: APP_STATE.conversationId,
        user: config.userId,
        api_provider: config.provider,
        api_key: config.apiKey,
        api_base_url: config.apiBaseUrl,
        api_model: config.model,
        hide_response: true
      })
    });

    if (!response.ok) return;
    const payload = await response.json();
    const answer = payload.answer || '';

    // 嘗試解析 JSON（可能包在 MD fence 裡）
    const jsonMatch = answer.match(/```(?:json)?\s*([\s\S]*?)```/) || answer.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : answer;
    const updates = JSON.parse(jsonStr.trim());
    TherapeuticMemory.merge(updates);
    TherapeuticMemory.incrementSession();
    appendSystemNotice('記憶已自動更新 🧠');
  } catch (e) {
    // 靜默失敗，不干擾用戶
  }
}

function formatOutputPayload(outputType, output) {
  const label = OUTPUT_DEFINITIONS[outputType]?.label || outputType;
  return `${label}\n\n${JSON.stringify(output, null, 2)}`;
}

async function requestOutput(outputType, options = {}) {
  if (APP_STATE.isSending) return;
  const definition = OUTPUT_DEFINITIONS[outputType] || { label: outputType, instruction: outputType };
  APP_STATE.isSending = true;
  appendSystemNotice(`正在產生 ${definition.label}...`);
  setTyping(true);

  try {
    await ensureModeSynced();
    const config = getRuntimeConfig();
    const response = await fetch('/api/chat/output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: APP_STATE.conversationId,
        user: config.userId,
        output_type: outputType,
        instruction: definition.instruction,
        api_provider: config.provider,
        api_key: config.apiKey,
        api_base_url: config.apiBaseUrl,
        api_model: config.model
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(formatChatError(payload));
    }

    APP_STATE.conversationId = payload.conversation_id || APP_STATE.conversationId;
    storeOutputResult(payload);
    setTyping(false);
    appendSystemNotice(`${definition.label} 已更新，請到 Reports 查看。`);
    if (options.fromChatCommand) {
      await appendMessage('ai', `${definition.label} 已更新。你可以到 Reports 頁面查看最新內容。`, { animate: true });
    }
    showScreen('screen-report');
    switchReportTab('auto');
    if (outputType === 'patient_analysis') {
      switchAutoAudience('patient');
    } else if (outputType === 'clinician_summary' || outputType === 'fhir_delivery') {
      switchAutoAudience('doctor');
    }
  } catch (error) {
    setTyping(false);
    await appendMessage('ai', error.message || '目前無法產生輸出。', { animate: true });
  } finally {
    APP_STATE.isSending = false;
  }
}

function injectOutputActions() {
  const inputSection = document.querySelector('#screen-chat .input-section');
  if (!inputSection || document.getElementById('structured-output-actions')) return;

  const actionWrap = document.createElement('div');
  actionWrap.id = 'structured-output-actions';
  actionWrap.className = 'quick-replies';
  actionWrap.style.transition = 'all 0.3s ease-in-out';
  actionWrap.style.display = 'none';
  actionWrap.style.opacity = '0';
  actionWrap.style.transform = 'translateY(10px)';
  actionWrap.innerHTML = `
    <button class="qr-chip" type="button" onclick="requestOutput('clinician_summary')">整理給醫師</button>
    <button class="qr-chip" type="button" onclick="requestOutput('patient_analysis')">請分析我</button>
    <button class="qr-chip" type="button" onclick="requestOutput('fhir_delivery')">FHIR 草稿</button>
  `;
  inputSection.insertBefore(actionWrap, inputSection.firstChild);
}

function injectRuntimeSettings() {
  const settingsScreen = document.getElementById('screen-settings');
  if (!settingsScreen || document.getElementById('ai-engine-runtime-card')) return;

  const settingsMain = settingsScreen.querySelector('main');
  if (!settingsMain) return;

  const wrapper = document.createElement('section');
  wrapper.className = 'settings-card';
  wrapper.id = 'ai-engine-runtime-card';
  wrapper.innerHTML = `
    <div class="settings-group-label">AI COMPANION ENGINE</div>
    <div class="settings-inner">
      <div class="setting-group">
        <div class="setting-title">
          <span class="mat-icon">link</span>
          <span>聊天流連線設定</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <select id="ai-provider" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7">
            <option value="google">Google Gemini</option>
            <option value="groq">Groq</option>
          </select>
          <input id="ai-base-url" type="text" placeholder="https://generativelanguage.googleapis.com/v1beta" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="ai-model" type="text" placeholder="gemini-2.0-flash" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="ai-api-key" type="password" placeholder="AIza... / gsk_..." style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="ai-user-id" type="text" placeholder="user id" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <button id="save-ai-engine-config" class="cta-primary with-icon" type="button">儲存聊天引擎設定</button>
        </div>
        <p style="font-size:12px;color:#64727a;line-height:1.6;margin-top:12px">
          這裡設定模型 provider、base URL、model、API key 與 user id。前端會透過本地 Node proxy 轉發到程式版 AI Companion 引擎。
        </p>
      </div>
    </div>
  `;

  settingsMain.insertBefore(wrapper, settingsMain.firstChild);

  const config = getRuntimeConfig();
  document.getElementById('ai-provider').value = config.provider;
  document.getElementById('ai-base-url').value = config.apiBaseUrl;
  document.getElementById('ai-model').value = config.model;
  document.getElementById('ai-api-key').value = config.apiKey;
  document.getElementById('ai-user-id').value = config.userId;

  document.getElementById('ai-provider').addEventListener('change', (event) => {
    const provider = event.target.value;
    document.getElementById('ai-base-url').value = provider === 'google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_GROQ_BASE_URL;
    document.getElementById('ai-model').value = provider === 'google' ? 'gemini-2.0-flash' : 'llama-3.1-8b-instant';
  });

  document.getElementById('save-ai-engine-config').addEventListener('click', () => {
    const provider = document.getElementById('ai-provider').value.trim() || DEFAULT_PROVIDER;
    localStorage.setItem('rourou.aiProvider', provider);
    localStorage.setItem('rourou.aiBaseUrl', document.getElementById('ai-base-url').value.trim() || (provider === 'google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_GROQ_BASE_URL));
    localStorage.setItem('rourou.aiModel', document.getElementById('ai-model').value.trim() || (provider === 'google' ? 'gemini-2.0-flash' : 'llama-3.1-8b-instant'));
    localStorage.setItem('rourou.aiApiKey', document.getElementById('ai-api-key').value.trim() || '');
    localStorage.setItem('rourou.userId', document.getElementById('ai-user-id').value.trim() || APP_STATE.userId);
    APP_STATE.userId = localStorage.getItem('rourou.userId') || APP_STATE.userId;
    APP_STATE.syncedMode = '';
    appendSystemNotice('聊天引擎設定已更新。之後送出的訊息會走 Node 程式版 AI Companion。');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeRuntimeConfig();
  showScreen('screen-home');
  updateModeLabels();
  injectRuntimeSettings();
  injectOutputActions();
  renderReportOutputs();
  switchAutoAudience(APP_STATE.currentWeeklyAudience);
  TherapeuticMemory.renderProfileUI();
});

window.showScreen = showScreen;
window.switchReportTab = switchReportTab;
window.toggleMoodTag = toggleMoodTag;
window.setPHQ = setPHQ;
window.handleInput = handleInput;
window.selectMode = selectMode;
window.startChat = startChat;
window.sendQuickReply = sendQuickReply;
window.sendMessage = sendMessage;
window.requestOutput = requestOutput;
window.switchAutoAudience = switchAutoAudience;

function toggleMemoryDrawer() {
  const drawer = document.getElementById('memory-drawer');
  if (!drawer) return;
  const isOpen = drawer.style.display !== 'none';
  if (isOpen) {
    drawer.style.display = 'none';
  } else {
    drawer.style.display = 'block';
    TherapeuticMemory.renderProfileUI();
  }
}
window.toggleMemoryDrawer = toggleMemoryDrawer;
