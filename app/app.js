const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_GROQ_API_KEY = '';
const DEFAULT_OPENROUTER_API_KEY = '';
const DEFAULT_GOOGLE_API_KEY = '';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_GOOGLE_MODEL = 'gemini-2.0-flash';
const DEFAULT_USER_ID = 'web-demo-user';
const DEFAULT_PROVIDER = 'google';
const RUNTIME_CONFIG_SOURCE_KEY = 'rourou.aiConfigSource';
const LEGACY_LOCAL_SESSION_ARCHIVE_KEY = 'rourou.localSessionArchive';
const LOCAL_SESSION_ARCHIVE_KEY = 'rourou.singleSessionArchive.v2';
let SERVER_RUNTIME_CONFIG = {
  provider: DEFAULT_PROVIDER,
  apiBaseUrl: DEFAULT_GOOGLE_BASE_URL,
  model: DEFAULT_GOOGLE_MODEL,
  source: 'server'
};
const FHIR_REPORT_HISTORY_KEY = 'rourou.fhirReportHistory';
const HOME_GUIDE_PAGES = [
  {
    icon: 'chat_bubble',
    title: '聊天介面',
    markdown: [
      '## 從這裡開始',
      '',
      '- 點首頁的輸入框，就會進到聊天頁。',
      '- Rou Rou 會先接住情緒，再根據內容決定互動模式。',
      '',
      '> 如果你只想先說一點點，也可以只打短句。'
    ].join('\n')
  },
  {
    icon: 'bolt',
    title: '快捷指令',
    markdown: [
      '## 快速做事',
      '',
      '- 聊天頁底部有快捷列。',
      '- 第二頁可以用 `+` 新增自己的常用命令。',
      '- 適合放像是 `幫我整理給醫生`、`先陪我慢慢說` 這種固定句子。'
    ].join('\n')
  },
  {
    icon: 'analytics',
    title: '數據報表',
    markdown: [
      '## 看整理後的內容',
      '',
      '- Reports 會顯示醫師摘要、病人審閱稿與 FHIR 草稿。',
      '- 這裡也會看到目前整理出的症狀線索與資源數量。',
      '',
      '> 它不是每次聊天都自動送出，而是先整理給你看。'
    ].join('\n')
  },
  {
    icon: 'psychology',
    title: '認識你',
    markdown: [
      '## 累積你的心理畫像',
      '',
      '- 系統會把壓力來源、觸發點、正向錨點慢慢整理起來。',
      '- 這些內容主要用來讓對話更連續，不是直接當成醫療結論。'
    ].join('\n')
  },
  {
    icon: 'verified_user',
    title: '授權送出',
    markdown: [
      '## 手動確認後才上傳',
      '',
      '- 點 `數位授權並送出報告` 後，會先看到完整預覽。',
      '- 你必須滑到最下面，`同意送出` 才會解鎖。',
      '- 真正上傳只會在你最後按下同意之後才發生。'
    ].join('\n')
  },
  {
    icon: 'settings',
    title: '系統設定',
    markdown: [
      '## 調整連線與隱私',
      '',
      '- Settings 可以設定 AI provider、API key、User ID。',
      '- FHIR 即時同步目前只會記住偏好，不會自動上傳。'
    ].join('\n')
  }
];

/* ══════════════════════════════════════════════
   THERAPEUTIC MEMORY MODULE
   管理病人心理畫像：讀寫、合併、注入
   ══════════════════════════════════════════════ */
const TherapeuticMemory = {
  KEY: 'rourou.therapeuticProfile',
  syncTimer: null,

  get() {
    try {
      return this._normalize(JSON.parse(localStorage.getItem(this.KEY)));
    } catch {
      return this._default();
    }
  },

  save(profile) {
    const nextProfile = this._normalize(profile);
    nextProfile.lastUpdatedAt = new Date().toISOString();
    localStorage.setItem(this.KEY, JSON.stringify(nextProfile));
    this.renderProfileUI();
    this.scheduleSessionSync(nextProfile);
  },

  replace(profile, options = {}) {
    const nextProfile = this._normalize(profile);
    localStorage.setItem(this.KEY, JSON.stringify(nextProfile));
    this.renderProfileUI();
    if (!options.skipSessionSync) {
      this.scheduleSessionSync(nextProfile);
    }
  },

  scheduleSessionSync(profile = null) {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.syncCurrentSession(profile || this.get());
    }, 250);
  },

  async syncCurrentSession(profile = null) {
    if (typeof APP_STATE === 'undefined' || !APP_STATE.conversationId) return;
    try {
      await fetch(`/api/chat/session?id=${encodeURIComponent(APP_STATE.conversationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapeutic_profile: profile || this.get()
        })
      });
    } catch {
      // Best-effort sync; local copy remains available even if server write fails.
    }
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
    if (
      !p.stressors.length &&
      !p.triggers.length &&
      !p.keyThemes.length &&
      !p.positiveAnchors.length &&
      !p.copingProfile.preferredStyle
    ) return '';

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
    const nextProfile = this._default();
    localStorage.setItem(this.KEY, JSON.stringify(nextProfile));
    this.renderProfileUI();
    this.scheduleSessionSync(nextProfile);
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
  },

  _normalize(profile) {
    const fallback = this._default();
    const source = profile && typeof profile === 'object' ? profile : {};
    const copingProfile = source.copingProfile && typeof source.copingProfile === 'object'
      ? source.copingProfile
      : {};
    const emotionalBaseline = source.emotionalBaseline && typeof source.emotionalBaseline === 'object'
      ? source.emotionalBaseline
      : {};

    return {
      ...fallback,
      ...source,
      userId: typeof source.userId === 'string' && source.userId.trim()
        ? source.userId.trim()
        : fallback.userId,
      sessionCount: Number.isFinite(Number(source.sessionCount))
        ? Math.max(0, Number(source.sessionCount))
        : 0,
      stressors: Array.isArray(source.stressors) ? source.stressors.filter(Boolean) : [],
      triggers: Array.isArray(source.triggers) ? source.triggers.filter(Boolean) : [],
      positiveAnchors: Array.isArray(source.positiveAnchors) ? source.positiveAnchors.filter(Boolean) : [],
      keyThemes: Array.isArray(source.keyThemes) ? source.keyThemes.filter((item) => typeof item === 'string' && item.trim()) : [],
      copingProfile: {
        preferredStyle: typeof copingProfile.preferredStyle === 'string' ? copingProfile.preferredStyle : '',
        effectiveMethods: Array.isArray(copingProfile.effectiveMethods) ? copingProfile.effectiveMethods.filter(Boolean) : [],
        ineffectiveMethods: Array.isArray(copingProfile.ineffectiveMethods) ? copingProfile.ineffectiveMethods.filter(Boolean) : []
      },
      emotionalBaseline: {
        dominantMood: typeof emotionalBaseline.dominantMood === 'string' ? emotionalBaseline.dominantMood : '',
        phq9Trend: Array.isArray(emotionalBaseline.phq9Trend) ? emotionalBaseline.phq9Trend.filter(Boolean) : [],
        hamdSignalCount: Number.isFinite(Number(emotionalBaseline.hamdSignalCount))
          ? Math.max(0, Number(emotionalBaseline.hamdSignalCount))
          : 0
      },
      clinicianNotes: typeof source.clinicianNotes === 'string' ? source.clinicianNotes : ''
    };
  }
};

window.TherapeuticMemory = TherapeuticMemory;

const APP_STATE = {
  currentScreen: 'screen-chat',
  conversationId: '',
  userId: localStorage.getItem('rourou.userId') || DEFAULT_USER_ID,
  selectedMode: localStorage.getItem('rourou.selectedMode') || 'natural',
  runtimeMode: '',
  syncedMode: '',
  isSending: false,
  currentReportTab: 'auto',
  currentWeeklyAudience: 'patient',
  turnCount: 0,
  moodPoints: [100, 100, 100, 100, 100, 100, 100], 
  selectedMoodTags: [],
  phq9Scores: Array(9).fill(0),
  chatHistory: [],
  pendingFreshSession: false,
  lastChatMetadata: null,
  customShortcuts: loadCustomShortcuts(),
  reportOutputs: {
    clinician_summary: null,
    patient_analysis: null,
    patient_review: null,
    fhir_delivery: null,
    fhir_delivery_result: null,
    session_export: null,
    updatedAt: ''
  },
  fhirReportHistory: loadFhirReportHistory(),
  recentSessions: [],
  pendingConsent: {
    sessionExport: null,
    fhirDraft: null,
    deliveryResult: null,
    deliveryTargetUrl: '',
    canConfirm: false,
    progressLabel: '',
    progressValue: 0,
    progressText: ''
  },
  reportConsentProgress: {
    visible: false,
    value: 0,
    label: '',
    note: '',
    valueText: ''
  },
  progressAnimation: {
    consentTimer: null,
    reportTimer: null,
    stageTimer: null
  },
  reportFhirDraft: {
    isLoading: false,
    error: '',
    emptyReason: ''
  },
  privacySettings: {
    fhirRealtimeSync: localStorage.getItem('rourou.fhirRealtimeSync') === 'true',
    autoReportDraft: localStorage.getItem('rourou.autoReportDraft') === 'true'
  },
  aiSettings: {
    voiceStyle: localStorage.getItem('rourou.voiceStyle') || 'gentle',
    interactionSensing: localStorage.getItem('rourou.interactionSensing') !== 'false',
    userPrompt: localStorage.getItem('rourou.userPrompt') || ''
  },
  microIntervention: {
    currentCardId: '',
    lastPresentedCardId: '',
    cardHistory: [],
    dismissCount: 0,
    cooldownUntil: 0,
    snoozedUntil: 0,
    contentCache: {},
    detailOpen: false
  }
};

function loadCustomShortcuts() {
  try {
    const parsed = JSON.parse(localStorage.getItem('rourou.customShortcuts') || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.label && item.command) : [];
  } catch {
    return [];
  }
}

function saveCustomShortcuts() {
  localStorage.setItem('rourou.customShortcuts', JSON.stringify(APP_STATE.customShortcuts || []));
}

const MODE_DEFINITIONS = {
  void: { command: 'void', label: '模式：樹洞模式', display: '樹洞模式' },
  soul: { command: 'soulmate', label: '模式：靈魂陪伴', display: '靈魂陪伴' },
  mission: { command: 'mission', label: '模式：任務引導', display: '任務引導' },
  option: { command: 'option', label: '模式：選項引導', display: '選項引導' },
  smart: { command: 'natural', label: '模式：自然聊天', display: '自然聊天' },
  natural: { command: 'natural', label: '模式：自然聊天', display: '自然聊天' },
  auto: { command: 'auto', label: '模式：自動分流', display: '自動分流' }
};

const ENGINE_MODE_DISPLAY = {
  auto: { label: '模式：自動分流', display: '自動分流' },
  safety: { label: '模式：安全模式', display: '安全模式' },
  followup: { label: '模式：追問整理', display: '追問整理' },
  mode_1_void: { label: '模式：樹洞模式', display: '樹洞模式' },
  mode_2_soulmate: { label: '模式：靈魂陪伴', display: '靈魂陪伴' },
  mode_3_mission: { label: '模式：任務引導', display: '任務引導' },
  mode_4_option: { label: '模式：選項引導', display: '選項引導' },
  mode_5_natural: { label: '模式：自然聊天', display: '自然聊天' },
  mode_6_clarify: { label: '模式：釐清補問', display: '釐清補問' }
};

const MODE_EXPLAINERS = {
  auto: {
    subtitle: 'Rou Rou 會先看風險，再看互動負擔，最後決定最適合的回應模式。',
    markdown: [
      '### 自動分流會依這個順序判斷',
      '',
      '1. **先看你有沒有直接下指令**',
      '如果你明確輸入 `void`、`mission`、`option`、`natural`、`soulmate`，系統會先尊重你的指定。',
      '',
      '2. **再看有沒有高風險內容**',
      '像是自傷、自殺、立即危險，會直接切到安全回應，不走一般聊天模式。',
      '',
      '3. **再看互動負擔是否偏高**',
      '如果句子很短、很累、很不想說、明顯沒有力氣，會優先偏向比較低負擔的模式。',
      '',
      '4. **最後才在幾個模式裡選一個**',
      '- `樹洞模式`：只想被接住，不想被追問',
      '- `靈魂陪伴`：需要被理解、被安撫、被陪著',
      '- `任務引導`：想整理問題、想往下一步走',
      '- `選項引導`：想減少思考負擔，希望系統給選項',
      '- `自然聊天`：一般對話，不特別偏向某個心理任務',
      '',
      '### Auto 不是每輪都做完整報告',
      '現在只會先回話並保存重點。真的要產出醫師摘要或 FHIR 草稿時，才會另外生成。'
    ].join('\n')
  },
  void: {
    subtitle: '適合不想被追問、只想先把感受放下來的時候。',
    markdown: [
      '### 樹洞模式會怎麼回應',
      '',
      '- 優先接住你的話，不急著分析你',
      '- 盡量少追問，減少互動壓力',
      '- 適合「不想說太多，但想被接住」的狀態',
      '',
      '如果訊息裡出現高風險內容，仍然會先走安全回應。'
    ].join('\n')
  },
  soul: {
    subtitle: '適合想被理解、想有人溫柔陪著你的時候。',
    markdown: [
      '### 靈魂陪伴會怎麼回應',
      '',
      '- 優先共感，先陪你待在當下',
      '- 回覆會比較柔和、比較像陪伴式對話',
      '- 不會太快跳到任務或條列建議',
      '',
      '如果你明確想整理問題，也可以再切到任務引導。'
    ].join('\n')
  },
  mission: {
    subtitle: '適合想整理問題、想往下一步推進的時候。',
    markdown: [
      '### 任務引導會怎麼回應',
      '',
      '- 會幫你把問題拆成比較可處理的步驟',
      '- 需要時才會啟動較重的整理與摘要邏輯',
      '- 適合「我想整理給醫生」或「我想有方向」的情況'
    ].join('\n')
  },
  option: {
    subtitle: '適合覺得很累、不想自己想太多，希望直接看到幾個選項。',
    markdown: [
      '### 選項引導會怎麼回應',
      '',
      '- 會把回應壓成幾個可直接選的方向',
      '- 降低思考負擔，不要求你一次說很多',
      '- 適合「我沒有力氣整理，但想有人幫我縮小範圍」'
    ].join('\n')
  },
  smart: {
    subtitle: '適合一般聊天，系統不特別把你推向某一種結構。',
    markdown: [
      '### 自然聊天會怎麼回應',
      '',
      '- 以一般對話為主，不強制做心理任務',
      '- 會保留重要線索，但不會每輪都生成完整報告',
      '- 適合單純想聊聊、先讓 Rou Rou 理解近況'
    ].join('\n')
  },
  natural: {
    subtitle: '適合一般聊天，系統不特別把你推向某一種結構。',
    markdown: [
      '### 自然聊天會怎麼回應',
      '',
      '- 以一般對話為主，不強制做心理任務',
      '- 會保留重要線索，但不會每輪都生成完整報告',
      '- 適合單純想聊聊、先讓 Rou Rou 理解近況'
    ].join('\n')
  }
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

function formatDateTimeLabel(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '時間未知';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDynamicDateLabel() {
  const now = new Date();
  const hours = now.getHours();
  const period = hours < 12 ? '上午' : '下午';
  const displayHours = hours % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `今天，${period} ${displayHours}:${minutes}`;
}

function syncRealTimeLabels() {
  const label = getDynamicDateLabel();
  document.querySelectorAll('.date-chip').forEach(el => {
    el.textContent = label;
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

const HAMD_SIGNAL_LABELS = {
  depressed_mood: '憂鬱情緒',
  guilt: '罪惡感 / 自責',
  suicide: '自殺意念',
  insomnia: '睡眠障礙',
  work_interest: '工作與興趣下降',
  agitation: '激躁 / 坐立難安',
  retardation: '遲滯 / 注意力拖慢',
  somatic_anxiety: '身體化焦慮',
  psychic_anxiety: '心理焦慮',
  appetite_loss: '食慾下降',
  fatigue: '疲倦 / 無力'
};

function isMeaningfulDraftText(value = '') {
  const text = String(value || '').trim();
  return text && !isPlaceholderDraftText(text);
}

function getMeaningfulItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => String(item || '').trim())
    .filter((item, index, arr) => item && !isPlaceholderDraftText(item) && arr.indexOf(item) === index);
}

function formatHamdSignalLabel(signal) {
  const key = String(signal || '').trim();
  return HAMD_SIGNAL_LABELS[key] || key.replace(/_/g, ' ');
}

function buildReadableListMarkup(items = [], emptyText = '目前沒有可顯示內容。') {
  const normalized = getMeaningfulItems(items);
  if (!normalized.length) {
    return `<p class="report-empty-copy">${escapeHtml(emptyText)}</p>`;
  }
  return normalized.map((item) => `
    <div class="report-readable-item">
      <span class="mat-icon">check_circle</span>
      <div>${escapeHtml(item)}</div>
    </div>
  `).join('');
}

function renderDoctorSummary(summary = {}) {
  const parts = [
    String(summary?.draft_summary || '').trim(),
    ...getMeaningfulItems(summary?.chief_concerns).slice(0, 2),
    ...getMeaningfulItems(summary?.symptom_observations).slice(0, 2)
  ].filter((item, index, arr) => item && arr.indexOf(item) === index);

  if (!parts.length) {
    return {
      html: '<p class="report-empty-copy">尚未產生醫師摘要。按下「整理給醫師」後，這裡會顯示醫師實際會先看到的重點。</p>',
      meta: '目前狀態：尚未生成'
    };
  }

  return {
    html: parts.map((item) => `<p>${escapeHtml(item)}</p>`).join(''),
    meta: `目前狀態：已整理 ${parts.length} 段重點`
  };
}

function renderClassificationLogic(summary = {}) {
  const concerns = getMeaningfulItems(summary?.chief_concerns);
  const observations = getMeaningfulItems(summary?.symptom_observations);
  const followups = getMeaningfulItems(summary?.followup_needs);
  const safetyFlags = getMeaningfulItems(summary?.safety_flags);
  const lines = [];

  if (concerns.length) {
    lines.push(`主訴重點：${concerns.join('、')}`);
  }
  if (observations.length) {
    lines.push(`症狀證據：${observations.join('、')}`);
  }
  if (followups.length) {
    lines.push(`需補問 / 複核：${followups.join('、')}`);
  }
  if (safetyFlags.length) {
    lines.push(`安全提醒：${safetyFlags.join('、')}`);
  }

  return buildReadableListMarkup(lines, '目前還沒有足夠線索可以顯示分類邏輯。');
}

function renderHamdMapping(summary = {}, progress = {}) {
  const mappedSignals = getMeaningfulItems(summary?.hamd_signals);
  const supported = getMeaningfulItems(progress?.covered_dimensions);
  const evidence = getMeaningfulItems(progress?.recent_evidence);
  const combined = mappedSignals.length ? mappedSignals : supported;

  if (!combined.length) {
    return '<p class="report-empty-copy">尚未整理出可顯示的 HAM-D 對應項目。</p>';
  }

  return combined.map((signal, index) => {
    const evidenceText = evidence[index] || evidence[0] || '等待更多對話證據補齊';
    return `
      <div class="report-readable-item mapping">
        <span class="mat-icon">monitor_heart</span>
        <div>
          <strong>${escapeHtml(formatHamdSignalLabel(signal))}</strong>
          <p>${escapeHtml(evidenceText)}</p>
        </div>
      </div>
    `;
  }).join('');
}

function buildFhirSnippet(fhirDraft = {}, deliveryResult = null) {
  const resources = Array.isArray(fhirDraft?.resources) ? fhirDraft.resources : [];
  const resourceType = resources[0]?.resourceType || resources[0]?.type || 'Bundle';
  const signal = getMeaningfulItems(fhirDraft?.questionnaire_targets || fhirDraft?.observation_candidates)[0] || 'clinician_summary';
  const status = deliveryResult?.delivery_status || fhirDraft?.delivery_status || 'draft';
  return [
    '{',
    `  "resourceType": "${resourceType}",`,
    '  "type": "transaction",',
    `  "focus": "${String(signal).replace(/"/g, '\\"')}",`,
    `  "status": "${String(status).replace(/"/g, '\\"')}"`,
    '}'
  ].join('\n');
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
  const rawMarkdown = analysis?.markdown || [
    '## 給你的分析',
    '',
    analysis?.plain_summary || analysis?.patient_facing_summary || '目前還沒有足夠內容可以整理成給病人的分析。',
    '',
    '### 提醒',
    '',
    analysis?.reminder || '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。'
  ].join('\n');
  const markdown = String(rawMarkdown || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n');

  return renderMessageMarkdown(markdown);
}

function normalizeFhirBaseUrl(baseUrl) {
  const normalized = String(baseUrl || '').trim();
  return normalized ? normalized.replace(/\/+$/, '') : '';
}

function buildFhirResourceLinks(deliveryResult) {
  const baseUrl = normalizeFhirBaseUrl(deliveryResult?.fhir_base_url);
  const entries = Array.isArray(deliveryResult?.transaction_response?.body?.entry)
    ? deliveryResult.transaction_response.body.entry
    : [];
  const preferredOrder = ['Patient', 'Encounter', 'QuestionnaireResponse', 'Observation', 'Composition', 'DocumentReference', 'Provenance'];

  if (!baseUrl || !entries.length) return [];

  return entries
    .map((entry) => {
      const location = String(entry?.response?.location || '').trim();
      if (!location) return null;

      const resourcePath = location.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
      const canonicalPath = resourcePath.replace(/\/_history\/[^/]+$/i, '');
      const [resourceType = 'Resource', resourceId = ''] = canonicalPath.split('/');

      return {
        resourceType,
        label: resourceId ? `${resourceType}/${resourceId}` : resourceType,
        path: canonicalPath || resourcePath,
        url: `${baseUrl}/${canonicalPath || resourcePath}`
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.resourceType);
      const bIndex = preferredOrder.indexOf(b.resourceType);
      const safeA = aIndex === -1 ? preferredOrder.length : aIndex;
      const safeB = bIndex === -1 ? preferredOrder.length : bIndex;
      if (safeA !== safeB) return safeA - safeB;
      return a.label.localeCompare(b.label, 'en');
    });
}

function findFhirResourceLink(deliveryResult, resourceType) {
  return buildFhirResourceLinks(deliveryResult).find((item) => item.label.startsWith(`${resourceType}/`)) || null;
}

function loadFhirReportHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FHIR_REPORT_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFhirReportHistory() {
  localStorage.setItem(FHIR_REPORT_HISTORY_KEY, JSON.stringify(APP_STATE.fhirReportHistory || []));
}

function buildFhirHistoryEntry({ type, draft = null, deliveryResult = null, sessionExport = null }) {
  const entryType = type === 'delivery' ? 'delivery' : 'draft';
  const resourceLinks = buildFhirResourceLinks(deliveryResult);
  const fixedPatientValues = getFixedPatientValues(deliveryResult, sessionExport);
  const targetUrl = normalizeFhirBaseUrl(deliveryResult?.fhir_base_url || sessionExport?.__deliveryTargetUrl || '');
  const summary = isValidFhirDraftOutput(draft)
    ? String(draft?.narrative_summary || '').trim()
    : (entryType === 'delivery' ? 'FHIR 交付結果' : 'FHIR 草稿');
  const deliveryStatus = deliveryResult?.delivery_status || draft?.delivery_status || (entryType === 'draft' ? 'draft' : 'unknown');
  const fingerprint = JSON.stringify({
    entryType,
    summary,
    deliveryStatus,
    targetUrl,
    resources: resourceLinks.map((item) => item.path)
  });

  return {
    id: `fhir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: entryType,
    createdAt: new Date().toISOString(),
    summary,
    deliveryStatus,
    targetUrl,
    fixedPatientValues,
    resourceLinks,
    resourceCount: resourceLinks.length || (Array.isArray(draft?.resources) ? draft.resources.length : 0),
    fingerprint
  };
}

function upsertFhirHistoryEntry(entry) {
  if (!entry) return;
  const history = Array.isArray(APP_STATE.fhirReportHistory) ? [...APP_STATE.fhirReportHistory] : [];
  const existingIndex = history.findIndex((item) => item.fingerprint === entry.fingerprint);

  if (existingIndex >= 0) {
    history[existingIndex] = {
      ...history[existingIndex],
      ...entry,
      id: history[existingIndex].id,
      createdAt: history[existingIndex].createdAt || entry.createdAt
    };
  } else {
    history.unshift(entry);
  }

  APP_STATE.fhirReportHistory = history.slice(0, 20);
  saveFhirReportHistory();
}

function recordFhirDraftHistory(draft, sessionExport = null) {
  if (!draft || typeof draft !== 'object') return;
  upsertFhirHistoryEntry(buildFhirHistoryEntry({
    type: 'draft',
    draft,
    sessionExport
  }));
}

function recordFhirDeliveryHistory(deliveryResult, draft = null, sessionExport = null) {
  if (!deliveryResult || typeof deliveryResult !== 'object') return;
  upsertFhirHistoryEntry(buildFhirHistoryEntry({
    type: 'delivery',
    draft,
    deliveryResult,
    sessionExport
  }));
}

function removeFhirHistoryEntry(entryId) {
  APP_STATE.fhirReportHistory = (APP_STATE.fhirReportHistory || []).filter((item) => item.id !== entryId);
  saveFhirReportHistory();
  renderReportOutputs();
  appendSystemNotice('已刪除這筆 FHIR 記錄。');
}

function removeFhirHistoryResource(entryId, resourcePath) {
  let changed = false;
  APP_STATE.fhirReportHistory = (APP_STATE.fhirReportHistory || []).map((item) => {
    if (item.id !== entryId) return item;
    const resourceLinks = (item.resourceLinks || []).filter((link) => link.path !== resourcePath);
    if (resourceLinks.length === (item.resourceLinks || []).length) return item;
    changed = true;
    return {
      ...item,
      resourceLinks,
      resourceCount: resourceLinks.length
    };
  });

  if (!changed) return;
  saveFhirReportHistory();
  renderReportOutputs();
  appendSystemNotice('已刪除這筆記錄中的指定資源。');
}

function renderFhirHistorySection() {
  const history = Array.isArray(APP_STATE.fhirReportHistory) ? APP_STATE.fhirReportHistory : [];
  if (!history.length) return '';

  return `
    <div class="fhir-history-section">
      <div class="fhir-history-title-row">
        <div class="fhir-history-title"><span class="mat-icon">history</span>FHIR 歷史記錄</div>
        <div class="fhir-history-subtitle">草稿與交付結果都會保留時間，並可單筆刪除</div>
      </div>
      <div class="fhir-history-list">
        ${history.map((item) => `
          <div class="fhir-history-card">
            <div class="fhir-history-card-top">
              <div>
                <div class="fhir-history-badges">
                  <span class="fhir-history-badge ${item.type === 'delivery' ? 'delivery' : 'draft'}">${item.type === 'delivery' ? '已交付' : '草稿'}</span>
                  <span class="fhir-history-badge neutral">${escapeHtml(item.deliveryStatus || 'unknown')}</span>
                </div>
                <div class="fhir-history-time">建立時間：${escapeHtml(formatDateTimeLabel(item.createdAt))}</div>
              </div>
              <button class="fhir-history-delete-btn" type="button" onclick="removeFhirHistoryEntry('${escapeHtml(item.id)}')">刪除這筆</button>
            </div>
            <div class="fhir-history-summary">${escapeHtml(item.summary || '無摘要')}</div>
            <div class="fhir-history-meta">
              <div class="fhir-history-meta-item">
                <div class="fhir-history-meta-label">Patient identifier</div>
                <div class="fhir-history-meta-value">${escapeHtml(item.fixedPatientValues?.identifier || '尚未準備')}</div>
              </div>
              <div class="fhir-history-meta-item">
                <div class="fhir-history-meta-label">Patient 資源 ID</div>
                <div class="fhir-history-meta-value">${escapeHtml(item.fixedPatientValues?.resourceId || '尚未建立')}</div>
              </div>
            </div>
            ${item.targetUrl ? `<div class="fhir-history-target">FHIR Server：<a href="${escapeHtml(item.targetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.targetUrl)}</a></div>` : ''}
            ${Array.isArray(item.resourceLinks) && item.resourceLinks.length ? `
              <div class="fhir-history-resource-list">
                ${item.resourceLinks.map((link) => `
                  <div class="fhir-history-resource-item">
                    <div class="fhir-history-resource-copy">
                      <div class="fhir-history-resource-label">${escapeHtml(link.label)}</div>
                      <div class="fhir-history-resource-path">${link.url ? `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.path)}</a>` : escapeHtml(link.path)}</div>
                    </div>
                    <button class="fhir-history-resource-delete" type="button" onclick="removeFhirHistoryResource('${escapeHtml(item.id)}', '${escapeHtml(link.path)}')">刪除</button>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="fhir-history-empty">這筆記錄目前沒有保留資源連結。</div>'}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getFixedPatientValues(fhirDeliveryResult, fallbackSessionExport) {
  const targetUrl = normalizeFhirBaseUrl(
    fhirDeliveryResult?.fhir_base_url || fallbackSessionExport?.__deliveryTargetUrl || ''
  );
  const previewIdentifier = getPreviewPatientIdentifier(
    fallbackSessionExport || {},
    targetUrl
  );
  const deliveredPatient = findFhirResourceLink(fhirDeliveryResult, 'Patient');
  return {
    identifier: previewIdentifier || String(fallbackSessionExport?.patient?.key || '').trim() || '尚未準備',
    resourceId: deliveredPatient?.label || '尚未建立'
  };
}

function isPlaceholderDraftText(value = '') {
  const text = String(value || '').trim();
  if (!text) return true;
  return /^待補/.test(text) || /^尚待補充/.test(text) || /目前對話中沒有提供具體的症狀或情況描述/.test(text) || /目前沒有具體的對話內容可供摘要/.test(text);
}

function isValidClinicianSummaryOutput(output = {}) {
  if (!output || typeof output !== 'object') return false;
  const concerns = Array.isArray(output.chief_concerns) ? output.chief_concerns.filter(Boolean) : [];
  const observations = Array.isArray(output.symptom_observations) ? output.symptom_observations.filter(Boolean) : [];
  const summary = String(output.draft_summary || '').trim();
  return concerns.length > 0 || observations.length > 0 || !isPlaceholderDraftText(summary);
}

function isValidPatientAnalysisOutput(output = {}) {
  if (!output || typeof output !== 'object') return false;
  const summary = String(output.plain_summary || output.markdown || '').trim();
  const keyPoints = Array.isArray(output.key_points) ? output.key_points.filter(Boolean) : [];
  return !isPlaceholderDraftText(summary) || keyPoints.length > 0;
}

function isValidFhirDraftOutput(output = {}) {
  if (!output || typeof output !== 'object') return false;
  const narrative = String(output.narrative_summary || '').trim();
  const sections = Array.isArray(output.composition_sections) ? output.composition_sections.filter(Boolean) : [];
  const meaningfulSections = sections.filter((item) => item && !isPlaceholderDraftText(item.focus));
  const observations = Array.isArray(output.observation_candidates) ? output.observation_candidates.filter(Boolean) : [];
  const targets = Array.isArray(output.questionnaire_targets) ? output.questionnaire_targets.filter(Boolean) : [];
  return (!isPlaceholderDraftText(narrative) && meaningfulSections.length > 0) || observations.length > 0 || targets.length > 0;
}

function getPreferredFhirSummaryText() {
  const fhirDraft = APP_STATE.reportOutputs.fhir_delivery;
  const clinician = APP_STATE.reportOutputs.clinician_summary;
  if (isValidFhirDraftOutput(fhirDraft)) {
    return String(fhirDraft.narrative_summary || '').trim();
  }
  if (isValidClinicianSummaryOutput(clinician)) {
    return String(clinician.draft_summary || '').trim();
  }
  return '';
}

function syncReportOutputsFromSessionExport(sessionExport = {}) {
  if (!sessionExport || typeof sessionExport !== 'object') return;

  if (isValidClinicianSummaryOutput(sessionExport.clinician_summary_draft)) {
    APP_STATE.reportOutputs.clinician_summary = JSON.parse(JSON.stringify(sessionExport.clinician_summary_draft));
  }

  if (isValidPatientAnalysisOutput(sessionExport.patient_analysis)) {
    APP_STATE.reportOutputs.patient_analysis = JSON.parse(JSON.stringify(sessionExport.patient_analysis));
  }

  if (sessionExport.patient_review_packet && typeof sessionExport.patient_review_packet === 'object') {
    APP_STATE.reportOutputs.patient_review = JSON.parse(JSON.stringify(sessionExport.patient_review_packet));
  }

  if (isValidFhirDraftOutput(sessionExport.fhir_delivery_draft)) {
    APP_STATE.reportOutputs.fhir_delivery = JSON.parse(JSON.stringify(sessionExport.fhir_delivery_draft));
  }
}

function syncTherapeuticMemoryFromSessionExport(sessionExport = {}) {
  if (!sessionExport || typeof sessionExport !== 'object') return;

  if (sessionExport.therapeutic_profile && typeof sessionExport.therapeutic_profile === 'object') {
    TherapeuticMemory.replace(sessionExport.therapeutic_profile, { skipSessionSync: true });
    return;
  }

  const latestTags = sessionExport.latest_tag_payload && typeof sessionExport.latest_tag_payload === 'object'
    ? sessionExport.latest_tag_payload
    : {};
  const burdenState = sessionExport.burden_level_state && typeof sessionExport.burden_level_state === 'object'
    ? sessionExport.burden_level_state
    : {};
  const source = Object.keys(latestTags).length ? latestTags : burdenState;

  const stressors = Array.isArray(source.stressors) ? source.stressors : [];
  const triggers = Array.isArray(source.triggers) ? source.triggers : [];
  const keyThemes = Array.isArray(source.keyThemes) ? source.keyThemes : [];
  const positiveAnchors = Array.isArray(source.positiveAnchors) ? source.positiveAnchors : [];
  const copingStyleHint = typeof source.copingStyleHint === 'string' ? source.copingStyleHint : '';

  if (!stressors.length && !triggers.length && !keyThemes.length && !positiveAnchors.length && !copingStyleHint) {
    return;
  }

  TherapeuticMemory.merge({
    stressors,
    triggers,
    keyThemes,
    positiveAnchors,
    copingStyleHint
  });
}

function renderReportOutputs() {
  const clinician = APP_STATE.reportOutputs.clinician_summary || {};
  const patientAnalysis = APP_STATE.reportOutputs.patient_analysis || {};
  const patientReview = APP_STATE.reportOutputs.patient_review || {};
  const fhirDelivery = APP_STATE.reportOutputs.fhir_delivery || {};
  const fhirDeliveryResult = APP_STATE.reportOutputs.fhir_delivery_result || APP_STATE.pendingConsent.deliveryResult || null;
  const sessionExport = APP_STATE.pendingConsent.sessionExport || APP_STATE.reportOutputs.session_export || {};
  const hamdProgress = sessionExport?.hamd_progress_state || {};
  const updatedAt = APP_STATE.reportOutputs.updatedAt;
  const hamd = getHamdSummary(clinician);
  const doctorSummaryState = renderDoctorSummary(clinician);

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
  const doctorSummary = document.getElementById('report-doctor-summary');
  const doctorSummaryMeta = document.getElementById('report-doctor-summary-meta');
  const symptomSummary = document.getElementById('report-symptom-summary');
  const classificationLogic = document.getElementById('report-classification-logic');
  const hamdMapping = document.getElementById('report-hamd-mapping');
  const fhirStatus = document.getElementById('report-fhir-status');
  const fhirSummary = document.getElementById('report-fhir-summary');
  const fhirResources = document.getElementById('report-fhir-resources');
  const fhirSnippet = document.getElementById('report-fhir-snippet');
  const fhirLinks = document.getElementById('report-fhir-links');
  const authNote = document.getElementById('report-auth-note');
  const deleteDraftButton = document.getElementById('report-delete-fhir-draft');
  const latestFhirHistory = APP_STATE.fhirReportHistory?.[0] || null;

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

  if (doctorSummary) {
    doctorSummary.innerHTML = doctorSummaryState.html;
  }

  if (doctorSummaryMeta) {
    doctorSummaryMeta.textContent = doctorSummaryState.meta;
  }

  if (symptomSummary) {
    symptomSummary.innerHTML = buildReadableListMarkup(
      clinician?.symptom_observations,
      '尚未整理出可讀的症狀摘要。'
    );
  }

  if (classificationLogic) {
    classificationLogic.innerHTML = renderClassificationLogic(clinician);
  }

  if (hamdMapping) {
    hamdMapping.innerHTML = renderHamdMapping(clinician, hamdProgress);
  }

  if (fhirStatus) {
    if (APP_STATE.reportFhirDraft.isLoading && !isValidFhirDraftOutput(fhirDelivery)) {
      fhirStatus.textContent = '生成中';
    } else if (APP_STATE.reportFhirDraft.error && !isValidFhirDraftOutput(fhirDelivery)) {
      fhirStatus.textContent = '生成失敗';
    } else if (APP_STATE.reportFhirDraft.emptyReason && !isValidFhirDraftOutput(fhirDelivery)) {
      fhirStatus.textContent = '尚無資料';
    } else {
      fhirStatus.textContent = fhirDeliveryResult?.delivery_status || fhirDelivery?.delivery_status || '尚未生成';
    }
  }

  if (fhirSummary) {
    if (isValidFhirDraftOutput(fhirDelivery) || isValidClinicianSummaryOutput(clinician)) {
      fhirSummary.textContent = '系統會轉換為 FHIR JSON 並傳送至 Server。';
    } else if (APP_STATE.reportFhirDraft.isLoading) {
      fhirSummary.textContent = '正在依據這段對話整理交付內容，完成後會顯示精簡的 FHIR 示意。';
    } else if (APP_STATE.reportFhirDraft.error) {
      fhirSummary.textContent = `FHIR 草稿建立失敗：${APP_STATE.reportFhirDraft.error}`;
    } else if (APP_STATE.reportFhirDraft.emptyReason) {
      fhirSummary.textContent = APP_STATE.reportFhirDraft.emptyReason;
    } else {
      fhirSummary.textContent = '系統會轉換為 FHIR JSON 並傳送至 Server。';
    }
  }

  if (fhirSnippet) {
    fhirSnippet.textContent = buildFhirSnippet(fhirDelivery, fhirDeliveryResult);
  }

  if (fhirResources) {
    const baseCount = Array.isArray(fhirDelivery?.resources) ? fhirDelivery.resources.length : 0;
    const totalCount = baseCount;
    if (APP_STATE.reportFhirDraft.isLoading && !baseCount) {
      fhirResources.textContent = 'FHIR 資源數：整理中';
    } else {
      fhirResources.textContent = `FHIR 資源數：${totalCount}`;
    }

    // 附加心理畫像 Observations 清單（如果有）
    const profileObsList = document.getElementById('report-fhir-profile-obs');
    const profileObs = Array.isArray(fhirDelivery?.therapeutic_memory_observations)
      ? fhirDelivery.therapeutic_memory_observations.length
      : 0;
    if (profileObsList) {
      if (profileObs > 0) {
        const items = fhirDelivery.therapeutic_memory_observations.map(obs =>
          `<div class="fhir-obs-item">
            <span class="mat-icon" style="font-size:14px;color:var(--primary)">fiber_manual_record</span>
            <span><b>${obs.code.text}</b>：${obs.valueString}</span>
          </div>`
        ).join('');
        profileObsList.innerHTML = `
          <div class="fhir-profile-section">
            <div class="fhir-profile-title">
              <span class="mat-icon fill" style="color:var(--primary)">psychology</span>
              心理畫像 Observations（${profileObs} 筆，AI Companion Therapeutic Memory）
            </div>
            ${items}
          </div>`;
      } else {
        profileObsList.innerHTML = '';
      }
    }
  }

  if (deleteDraftButton) {
    const hasDraftContent = Boolean(
      isValidFhirDraftOutput(fhirDelivery) ||
      (Array.isArray(fhirDelivery?.resources) && fhirDelivery.resources.length) ||
      APP_STATE.reportOutputs.fhir_delivery_result ||
      APP_STATE.pendingConsent?.fhirDraft ||
      APP_STATE.pendingConsent?.deliveryResult
    );
    deleteDraftButton.disabled = !hasDraftContent;
  }

  if (fhirLinks) {
    const targetUrl = normalizeFhirBaseUrl(fhirDeliveryResult?.fhir_base_url);
    const linkItems = buildFhirResourceLinks(fhirDeliveryResult);
    const fixedPatientValues = getFixedPatientValues(
      fhirDeliveryResult,
      APP_STATE.pendingConsent.sessionExport || APP_STATE.reportOutputs.session_export || null
    );
    const historyMarkup = renderFhirHistorySection();
    if (fixedPatientValues.identifier !== '尚未準備' || fixedPatientValues.resourceId !== '尚未建立' || latestFhirHistory || (fhirDeliveryResult?.delivery_status === 'delivered' && targetUrl && linkItems.length)) {
      const summaryLabel = linkItems.length
        ? `已建立 ${linkItems.length} 個 FHIR 資源`
        : '查看 FHIR 交付資訊';
      const currentTimestamp = fhirDeliveryResult?.recorded_at || latestFhirHistory?.createdAt || '';
      fhirLinks.innerHTML = `
        <div class="fhir-link-section">
          <button class="fhir-link-toggle" type="button" onclick="toggleFhirResourceLinks(this)" aria-expanded="false">
            <span class="fhir-link-toggle-copy">
              <span class="fhir-link-title">
                <span class="mat-icon">link</span>
                FHIR 交付資訊
              </span>
              <span class="fhir-link-toggle-summary">${escapeHtml(summaryLabel)}</span>
            </span>
            <span class="mat-icon fhir-link-toggle-icon">expand_more</span>
          </button>
          ${currentTimestamp ? `<div class="fhir-link-current-time">這筆目前顯示內容建立於：${escapeHtml(formatDateTimeLabel(currentTimestamp))}</div>` : ''}
          <div class="fhir-fixed-meta">
            <div class="fhir-fixed-meta-item">
              <div class="fhir-fixed-meta-label">送出的 Patient identifier</div>
              <div class="fhir-fixed-meta-value">${escapeHtml(fixedPatientValues.identifier)}</div>
            </div>
            <div class="fhir-fixed-meta-item">
              <div class="fhir-fixed-meta-label">建立出的 Patient 資源 ID</div>
              <div class="fhir-fixed-meta-value">${escapeHtml(fixedPatientValues.resourceId)}</div>
            </div>
          </div>
          <div class="fhir-link-panel">
            ${targetUrl ? `<div class="fhir-link-target">FHIR Server：<a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(targetUrl)}</a></div>` : ''}
            ${fhirDeliveryResult?.delivery_status === 'delivered' && targetUrl && linkItems.length ? `
            <div class="fhir-link-list">
              ${linkItems.map((item) => `
                <div class="fhir-link-item">
                  <span class="mat-icon" style="font-size:16px;color:var(--primary)">open_in_new</span>
                  <div class="fhir-link-copy">
                    <div class="fhir-link-label">${escapeHtml(item.label)}</div>
                    <div class="fhir-link-path"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.path)}</a></div>
                  </div>
                </div>
              `).join('')}
            </div>
            ` : '<div class="fhir-link-empty">這次送出還沒有可直接打開的 HAPI 資源連結。</div>'}
          </div>
        </div>
        ${historyMarkup}
      `;
    } else {
      fhirLinks.innerHTML = '';
    }
  }

  if (authNote) {
    authNote.textContent = updatedAt
      ? `我已確認以上報表內容。若要交付給主治醫師，請確認最後更新時間與摘要內容。最後更新：${updatedAt}。`
      : '我已確認以上報告內容，並授權 Rou Rou 將此摘要加密傳送至主治醫師診間系統，以作為本次診療輔助。';
  }
}

function storeOutputResult(payload) {
  const output = payload.output || null;
  if (payload.output_type === 'fhir_delivery') {
    if (isValidFhirDraftOutput(output) || !isValidFhirDraftOutput(APP_STATE.reportOutputs.fhir_delivery)) {
      APP_STATE.reportOutputs.fhir_delivery = output;
    }
  } else if (payload.output_type === 'clinician_summary') {
    if (isValidClinicianSummaryOutput(output) || !isValidClinicianSummaryOutput(APP_STATE.reportOutputs.clinician_summary)) {
      APP_STATE.reportOutputs.clinician_summary = output;
    }
  } else if (payload.output_type === 'patient_analysis') {
    if (isValidPatientAnalysisOutput(output) || !isValidPatientAnalysisOutput(APP_STATE.reportOutputs.patient_analysis)) {
      APP_STATE.reportOutputs.patient_analysis = output;
    }
  } else {
    APP_STATE.reportOutputs[payload.output_type] = output;
  }
  if (payload.output_type === 'fhir_delivery') {
    APP_STATE.reportFhirDraft = {
      isLoading: false,
      error: '',
      emptyReason: isValidFhirDraftOutput(output) ? '' : '目前這份 FHIR 草稿仍在重新整理，請稍後再試一次。'
    };
    if (isValidFhirDraftOutput(output)) {
      output.recorded_at = output.recorded_at || new Date().toISOString();
      recordFhirDraftHistory(output, payload.session_export || APP_STATE.reportOutputs.session_export || null);
    }
  }
  if (payload.session_export && typeof payload.session_export === 'object') {
    APP_STATE.reportOutputs.session_export = payload.session_export;
    syncReportOutputsFromSessionExport(payload.session_export);
  }
  APP_STATE.lastChatMetadata = payload.metadata || APP_STATE.lastChatMetadata;
  APP_STATE.runtimeMode = payload.metadata?.active_mode || APP_STATE.runtimeMode;
  APP_STATE.reportOutputs.updatedAt = formatTimeLabel(new Date());
  renderReportOutputs();
  updateModeLabels();
  saveCurrentSessionToLocalArchive();
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
  if (screenId !== 'screen-chat') {
    clearMicroInterventionCard();
    closeMicroInterventionDetail();
  }
  
  if (screenId === 'screen-report') {
    syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
    syncTherapeuticMemoryFromSessionExport(APP_STATE.reportOutputs.session_export);
    renderReportOutputs();
    renderMoodChart();
    ensureReportFhirDraft();
  }
  
  if (screenId === 'screen-energy') {
    tempSelectedMode = APP_STATE.selectedMode;
    refreshModeListUI();
  }

  if (screenId === 'screen-settings') {
    updateSettingsUI();
  }

  if (screenId === 'screen-home') {
    loadRecentSessions();
  }

  updateScrollSafeArea();

  if (screenId === 'screen-chat') {
    window.requestAnimationFrame(() => {
      syncShortcutBarState();
      scrollChatToBottom();
    });
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
  const mode =
    ENGINE_MODE_DISPLAY[APP_STATE.runtimeMode] ||
    MODE_DEFINITIONS[APP_STATE.selectedMode] ||
    MODE_DEFINITIONS.natural;
  const chatModeLabel = document.getElementById('chat-mode-label');
  const currentModeName = document.getElementById('current-mode-name');

  if (chatModeLabel) {
    chatModeLabel.textContent = mode.label;
  }

  if (currentModeName) {
    currentModeName.textContent = mode.display;
  }

  renderModeExplainer();
}

let tempSelectedMode = '';
let shortcutBarDismissed = false;
let shortcutInputFocused = false;

function syncShortcutBarState() {
  const shortcutBar = document.getElementById('shortcut-bar');
  const input = document.getElementById('chat-input');
  const isChatScreen = APP_STATE.currentScreen === 'screen-chat';
  if (!shortcutBar || !input) return;

  const shouldShow = isChatScreen && shortcutInputFocused && input.value.trim().length === 0 && !shortcutBarDismissed;
  if (shouldShow) {
    shortcutBar.style.display = 'block';
    window.requestAnimationFrame(() => {
      shortcutBar.style.opacity = '1';
      shortcutBar.style.transform = 'translateY(0)';
      shortcutBar.style.pointerEvents = 'all';
      updateScrollSafeArea();
      scrollChatToBottom();
    });
    return;
  }

  shortcutBar.style.opacity = '0';
  shortcutBar.style.transform = 'translateY(10px)';
  shortcutBar.style.pointerEvents = 'none';
  window.setTimeout(() => {
    const stillShouldShow = APP_STATE.currentScreen === 'screen-chat' && shortcutInputFocused && input.value.trim().length === 0 && !shortcutBarDismissed;
    if (!stillShouldShow) {
      shortcutBar.style.display = 'none';
      updateScrollSafeArea();
    }
  }, 300);
}

function selectMode(element, modeLabel, modeKey) {
  tempSelectedMode = modeKey || 'natural';

  document.querySelectorAll('.mode-card').forEach((card) => {
    card.classList.remove('selected');
  });

  if (element) {
    element.classList.add('selected');
  }
}

function saveModeSettings() {
  if (!tempSelectedMode) {
    showScreen('screen-chat');
    return;
  }
  APP_STATE.selectedMode = tempSelectedMode;
  localStorage.setItem('rourou.selectedMode', APP_STATE.selectedMode);
  updateModeLabels();
  updateSettingsUI();
  refreshModeListUI();
  showScreen('screen-chat');
}

function refreshModeListUI() {
  const currentModeKey = APP_STATE.selectedMode;
  document.querySelectorAll('.mode-card').forEach(card => {
    card.classList.remove('active');
    card.classList.remove('selected');
    const badge = card.querySelector('.active-badge');
    if (badge) badge.remove();

    const modeKey = card.getAttribute('data-mode-key');
    if (modeKey === currentModeKey) {
      card.classList.add('active');
      const newBadge = document.createElement('div');
      newBadge.className = 'active-badge';
      newBadge.textContent = '使用中';
      card.prepend(newBadge);
    }
  });
}

function renderModeExplainer() {
  const key = APP_STATE.selectedMode in MODE_EXPLAINERS ? APP_STATE.selectedMode : 'auto';
  const explainer = MODE_EXPLAINERS[key] || MODE_EXPLAINERS.auto;
  const subtitle = document.getElementById('mode-explainer-subtitle');
  const body = document.getElementById('mode-explainer-body');

  if (subtitle) {
    subtitle.textContent = explainer.subtitle;
  }

  if (body) {
    body.innerHTML = renderMessageMarkdown(explainer.markdown);
  }
}

function toggleModeExplainer() {
  const button = document.querySelector('.mode-explainer-toggle');
  const body = document.getElementById('mode-explainer-body');
  if (!button || !body) return;

  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  body.style.display = expanded ? 'none' : 'block';
}

function startChat() {
  showScreen('screen-chat');
  appendSystemNotice(`已切換為 ${MODE_DEFINITIONS[APP_STATE.selectedMode]?.display || '自然聊天'}。`);
}

const DEFAULT_SHORTCUT_PAGE_ONE = [
  { label: '整理給醫師', command: 'OUTPUT:clinician_summary' },
  { label: '請分析我', command: 'OUTPUT:patient_analysis' },
  { label: 'FHIR 草稿', command: 'OUTPUT:fhir_delivery' },
  { label: '樹洞模式', command: 'void' },
  { label: '靈魂陪伴', command: 'soulmate' },
  { label: '任務引導', command: 'mission' },
  { label: '選項引導', command: 'option' },
  { label: '自然聊天', command: 'natural' }
];

function formatShortcutLabel(label) {
  return String(label || '').trim();
}

function renderShortcutChip(item, options = {}) {
  const display = formatShortcutLabel(item.label);
  const className = options.className || 'shortcut-chip';
  const commandAttr = encodeURIComponent(String(item.command || ''));
  const attrs = `${options.attrs || ''} data-command="${commandAttr}"`;
  return `<button class="${className}" type="button" ${attrs}><span class="shortcut-chip-label">${escapeHtml(display)}</span></button>`;
}

function renderShortcutPager() {
  const pageOne = document.getElementById('shortcut-page-system');
  const pageTwo = document.getElementById('shortcut-page-custom');
  const dots = document.getElementById('shortcut-pager-dots');
  if (!pageOne || !pageTwo) return;

  pageOne.innerHTML = `
    <div class="shortcut-page-shell shortcut-page-shell-system">
      <div class="shortcut-page-grid shortcut-page-grid-system">
        ${DEFAULT_SHORTCUT_PAGE_ONE.map((item) => renderShortcutChip(item)).join('')}
      </div>
    </div>
  `;

  if (APP_STATE.customShortcuts.length) {
    pageTwo.innerHTML = `
      <div class="shortcut-page-shell">
        <div class="shortcut-page-grid shortcut-page-grid-custom">
          ${APP_STATE.customShortcuts.map((item, index) =>
            `<div class="shortcut-custom-item">
              ${renderShortcutChip(item)}
              <button class="shortcut-delete-btn" type="button" data-index="${index}" aria-label="刪除 ${escapeHtml(item.label)}"><span class="mat-icon">close</span></button>
            </div>`
          ).join('')}
        </div>
        <button class="shortcut-fab" type="button" onclick="openShortcutComposer()" aria-label="新增自訂快捷">
          <span class="mat-icon">add</span>
        </button>
      </div>
    `;
  } else {
    pageTwo.innerHTML = `
      <div class="shortcut-page-shell">
        <div class="shortcut-page-grid shortcut-page-grid-empty">
          <div class="shortcut-empty-card">
            <div class="shortcut-empty-title">目前沒有任何自定義指令</div>
            <p class="shortcut-empty-body">按下方按鈕新增後，這一頁就會出現你自己的快捷命令。</p>
            <button class="shortcut-empty-add-btn" onclick="openShortcutComposer()">
              <span class="mat-icon">add_circle</span>
              加入指令
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (dots) {
    dots.innerHTML = `
      <span class="shortcut-dot active" data-page="0"></span>
      <span class="shortcut-dot" data-page="1"></span>
    `;
  }
}

function sendQuickReply(text) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = text;
  sendMessage();
}

function buildOutputShortcutMessage(outputType) {
  const messages = {
    clinician_summary: '請幫我整理成給醫師看的重點。',
    patient_analysis: '請幫我看看我現在的狀態。',
    patient_review: '請幫我整理成我自己看得懂的版本。',
    fhir_delivery: '請幫我準備 FHIR 草稿。'
  };
  return messages[outputType] || `請幫我處理${OUTPUT_DEFINITIONS[outputType]?.label || outputType}。`;
}

async function activateShortcut(command) {
  const normalized = decodeURIComponent(String(command || '')).trim();
  if (!normalized) return;

  if (normalized.startsWith('OUTPUT:')) {
    const outputType = normalized.replace(/^OUTPUT:/, '');
    const visibleMessage = buildOutputShortcutMessage(outputType);
    await appendMessage('user', visibleMessage);
    await requestOutput(outputType, { fromShortcut: true, visibleMessage });
    return;
  }

  sendQuickReply(normalized);
}

function openShortcutComposer() {
  const modal = document.getElementById('shortcut-composer');
  if (!modal) return;
  const labelInput = document.getElementById('shortcut-label-input');
  const commandInput = document.getElementById('shortcut-command-input');
  if (labelInput) labelInput.value = '';
  if (commandInput) commandInput.value = '';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => labelInput?.focus(), 30);
}

function closeShortcutComposer() {
  const modal = document.getElementById('shortcut-composer');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function closeShortcutBar() {
  const shortcutBar = document.getElementById('shortcut-bar');
  if (!shortcutBar) return;
  shortcutBarDismissed = true;
  syncShortcutBarState();
}

function submitShortcutComposer() {
  const labelInput = document.getElementById('shortcut-label-input');
  const commandInput = document.getElementById('shortcut-command-input');
  const label = String(labelInput?.value || '').trim();
  const command = String(commandInput?.value || '').trim();
  if (!command) {
    appendSystemNotice('請先輸入要快速送出的命令。');
    return;
  }

  APP_STATE.customShortcuts.unshift({
    label: label || command,
    command
  });
  APP_STATE.customShortcuts = APP_STATE.customShortcuts.slice(0, 12);
  saveCustomShortcuts();
  renderShortcutPager();
  closeShortcutComposer();
  const viewport = document.getElementById('shortcut-pages');
  if (viewport) {
    viewport.scrollTo({ left: viewport.clientWidth, behavior: 'smooth' });
    updateShortcutPagerState();
  }
}

function removeCustomShortcut(index) {
  if (!Number.isInteger(index) || index < 0 || index >= APP_STATE.customShortcuts.length) return;
  APP_STATE.customShortcuts.splice(index, 1);
  saveCustomShortcuts();
  renderShortcutPager();
}

function updateShortcutPagerState() {
  const viewport = document.getElementById('shortcut-pages');
  const dots = Array.from(document.querySelectorAll('.shortcut-dot'));
  if (!viewport || !dots.length) return;
  const page = viewport.scrollLeft >= viewport.clientWidth * 0.5 ? 1 : 0;
  dots.forEach((dot, index) => dot.classList.toggle('active', index === page));
}

function snapShortcutPager() {
  const viewport = document.getElementById('shortcut-pages');
  if (!viewport) return;
  const targetPage = viewport.scrollLeft >= viewport.clientWidth * 0.5 ? 1 : 0;
  viewport.scrollTo({
    left: viewport.clientWidth * targetPage,
    behavior: 'smooth'
  });
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(value));
  return div.innerHTML;
}

function isUnreadableSessionText(value = '') {
  const text = String(value || '').trim();
  if (!text) return true;
  const stripped = text.replace(/\s+/g, '');
  if (!stripped) return true;
  const suspiciousChars = stripped.match(/[?？�]/g) || [];
  return suspiciousChars.length / stripped.length >= 0.6;
}

function pickReadableSessionText(candidates = [], fallback = '') {
  const readable = candidates
    .map((item) => String(item || '').trim())
    .find((item) => item && !isUnreadableSessionText(item));
  return readable || fallback;
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

    if (lines.length > 0 && lines.every((line) => /^###\s+/.test(line))) {
      return lines.map((line) => `<h3>${renderInlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`).join('');
    }

    if (lines.length > 0 && lines.every((line) => /^##\s+/.test(line))) {
      return lines.map((line) => `<h2>${renderInlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`).join('');
    }

    if (lines.length > 0 && lines.every((line) => /^>\s?/.test(line))) {
      return `<blockquote>${lines.map((line) => renderInlineMarkdown(line.replace(/^>\s?/, ''))).join('<br/>')}</blockquote>`;
    }

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

function renderHomeGuidePages() {
  const pagesEl = document.getElementById('home-guide-pages');
  const dotsEl = document.getElementById('home-guide-dots');
  if (!pagesEl || !dotsEl) return;

  pagesEl.innerHTML = HOME_GUIDE_PAGES.map((page, index) => `
    <article class="home-guide-page" data-guide-index="${index}">
      <div class="home-guide-page-header">
        <span class="home-guide-page-icon mat-icon ${page.icon === 'chat_bubble' || page.icon === 'analytics' ? 'fill' : ''}">${page.icon}</span>
        <div class="home-guide-page-meta">
          <div class="home-guide-page-step">Step ${index + 1}</div>
          <div class="home-guide-page-title">${escapeHtml(page.title)}</div>
        </div>
      </div>
      <div class="home-guide-page-content markdown-body">${renderMessageMarkdown(page.markdown)}</div>
    </article>
  `).join('');

  dotsEl.innerHTML = HOME_GUIDE_PAGES.map((_, index) => `
    <button class="home-guide-dot ${index === 0 ? 'active' : ''}" type="button" data-guide-dot="${index}" aria-label="切換到導引第 ${index + 1} 頁"></button>
  `).join('');
}

function updateHomeGuideDots() {
  const pagesEl = document.getElementById('home-guide-pages');
  const dots = Array.from(document.querySelectorAll('.home-guide-dot'));
  const prevButton = document.getElementById('home-guide-prev');
  const nextButton = document.getElementById('home-guide-next');
  if (!pagesEl || !dots.length) return;
  const pageWidth = pagesEl.clientWidth || 1;
  const index = Math.max(0, Math.min(dots.length - 1, Math.round(pagesEl.scrollLeft / pageWidth)));
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex === index);
  });
  if (prevButton) prevButton.disabled = index <= 0;
  if (nextButton) nextButton.disabled = index >= dots.length - 1;
}

function goToHomeGuidePage(index) {
  const pagesEl = document.getElementById('home-guide-pages');
  if (!pagesEl) return;
  const clamped = Math.max(0, Math.min(HOME_GUIDE_PAGES.length - 1, index));
  pagesEl.scrollTo({
    left: pagesEl.clientWidth * clamped,
    behavior: 'smooth'
  });
}

function toggleHomeGuide() {
  const toggle = document.getElementById('home-guide-toggle');
  const viewer = document.getElementById('home-guide-viewer');
  const historySection = document.getElementById('home-history-section');
  if (!toggle || !viewer) return;
  const nextExpanded = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
  viewer.classList.toggle('active', nextExpanded);
  viewer.setAttribute('aria-hidden', nextExpanded ? 'false' : 'true');
  if (historySection) {
    historySection.classList.toggle('is-hidden', nextExpanded);
  }
  if (nextExpanded) {
    updateHomeGuideDots();
  }
}

function wireHomeGuide() {
  const toggle = document.getElementById('home-guide-toggle');
  const pagesEl = document.getElementById('home-guide-pages');
  const dotsEl = document.getElementById('home-guide-dots');

  renderHomeGuidePages();

  if (toggle && !toggle.dataset.wired) {
    toggle.dataset.wired = 'true';
    toggle.addEventListener('click', toggleHomeGuide);
  }

  if (pagesEl && !pagesEl.dataset.wired) {
    pagesEl.dataset.wired = 'true';
    pagesEl.addEventListener('scroll', updateHomeGuideDots, { passive: true });
    pagesEl.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      const currentIndex = Math.round(pagesEl.scrollLeft / (pagesEl.clientWidth || 1));
      const nextIndex = event.deltaY > 0 ? currentIndex + 1 : currentIndex - 1;
      goToHomeGuidePage(nextIndex);
    }, { passive: false });
  }

  if (dotsEl && !dotsEl.dataset.wired) {
    dotsEl.dataset.wired = 'true';
    dotsEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-dot]');
      if (!button || !pagesEl) return;
      const index = Number(button.dataset.guideDot || '0');
      goToHomeGuidePage(index);
    });
  }

  const prevButton = document.getElementById('home-guide-prev');
  const nextButton = document.getElementById('home-guide-next');

  if (prevButton && !prevButton.dataset.wired) {
    prevButton.dataset.wired = 'true';
    prevButton.addEventListener('click', () => {
      const currentIndex = Math.round((pagesEl?.scrollLeft || 0) / ((pagesEl?.clientWidth || 1)));
      goToHomeGuidePage(currentIndex - 1);
    });
  }

  if (nextButton && !nextButton.dataset.wired) {
    nextButton.dataset.wired = 'true';
    nextButton.addEventListener('click', () => {
      const currentIndex = Math.round((pagesEl?.scrollLeft || 0) / ((pagesEl?.clientWidth || 1)));
      goToHomeGuidePage(currentIndex + 1);
    });
  }
}

function wireHomeSessionControls() {
  const continueButton = document.getElementById('home-continue-last-chat');
  const newChatButton = document.getElementById('home-start-new-chat');
  const list = document.getElementById('home-session-list');

  if (continueButton && !continueButton.dataset.wired) {
    continueButton.dataset.wired = 'true';
    continueButton.addEventListener('click', continueLatestSession);
  }

  if (newChatButton && !newChatButton.dataset.wired) {
    newChatButton.dataset.wired = 'true';
    newChatButton.addEventListener('click', startNewConversation);
  }

  if (list && !list.dataset.wired) {
    list.dataset.wired = 'true';
    list.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('[data-session-delete]');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        deleteRecentSession(deleteButton.dataset.sessionDelete);
        return;
      }
      const button = event.target.closest('[data-session-open]');
      if (!button) return;
      continueSpecificSession(button.dataset.sessionOpen);
    });
  }
}

const MICRO_INTERVENTION_RULES = window.MicroInterventionRules || null;
const MICRO_INTERVENTION_REGISTRY = MICRO_INTERVENTION_RULES?.createCardRegistry
  ? MICRO_INTERVENTION_RULES.createCardRegistry()
  : {};

function getMicroInterventionState() {
  return APP_STATE.microIntervention;
}

function getMicroInterventionContext(payload = {}, options = {}) {
  const microState = getMicroInterventionState();
  return {
    metadata: payload.metadata || APP_STATE.lastChatMetadata || {},
    session_export: payload.session_export || APP_STATE.reportOutputs.session_export || {},
    history: APP_STATE.chatHistory,
    currentScreen: APP_STATE.currentScreen,
    fromOutput: Boolean(options.fromOutput),
    cooldownUntil: microState.cooldownUntil,
    snoozedUntil: microState.snoozedUntil,
    dismissCount: microState.dismissCount,
    lastPresentedCardId: microState.lastPresentedCardId,
    cardHistory: microState.cardHistory,
    lastUserMessage: options.lastUserMessage || ''
  };
}

function parseInterventionMarkdown(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n').trim();
  const sections = normalized.split(/\n---\n/);
  const header = sections[0] || '';
  const body = sections.slice(1).join('\n---\n').trim();
  const fields = {};

  header.split('\n').forEach((line) => {
    const match = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (match) {
      fields[match[1].toLowerCase()] = match[2].trim();
    }
  });

  return {
    title: fields.title || '',
    subtitle: fields.subtitle || '',
    duration: fields.duration || '',
    tone: fields.tone || '',
    primaryActionLabel: fields.primary_action_label || '開始',
    secondaryActionLabel: fields.secondary_action_label || '先不要',
    body: body || normalized
  };
}

const MICRO_INTERVENTION_FALLBACK_MARKDOWN = {
  calm_breathing: `title: 平靜時刻
subtitle: 如果你願意，我們先把注意力放回呼吸 30 秒。
duration: 約 30 秒
tone: 陪伴式引導
primary_action_label: 我做完了
secondary_action_label: 稍後再說
---
## 先不用急著整理全部

現在只要先陪自己待一下就好。

### 你可以這樣做

1. 先把肩膀放鬆一點。
2. 慢慢吸氣，心裡數到三。
3. 再慢慢吐氣，心裡也數到三。
4. 重複三次就可以了。

> 不用做到很標準，只要把注意力借給呼吸一下下。

如果做完後還想聊，我會繼續陪你。`,
  drink_water: `title: 喝一口水
subtitle: 如果現在什麼都不想做，那我們先做最小的一件事。
duration: 約 10 秒
tone: 溫和提醒
primary_action_label: 我喝了一口
secondary_action_label: 先不要
---
## 先照顧身體一下

你不用立刻振作，也不用馬上說更多。

### 現在只做這件事就好

1. 拿起手邊的水。
2. 喝一小口就可以。
3. 喝完先停一下，感覺水進到身體裡。

> 這不是要你立刻變好，只是先讓自己回來一點點。

如果還是很累，也沒關係，我們可以再慢一點。`,
  stretch_reset: `title: 站起來伸展
subtitle: 如果身體願意，我們先把緊繃的地方放鬆一點點。
duration: 約 20 秒
tone: 身體放鬆
primary_action_label: 我伸展完了
secondary_action_label: 稍後再說
---
## 先不要急著想清楚

有時候不是心裡不想動，是身體先卡住了。

### 可以試這樣

1. 先慢慢站起來。
2. 把兩邊肩膀往上提，再慢慢放下。
3. 手臂往前伸，輕輕轉一圈。
4. 最後把下巴微微往下，讓脖子鬆一點。

> 做到哪裡都可以，不需要完整做完。

只要有一點點鬆開，就已經很好了。`,
  tiny_choice_reset: `title: 先不用想很多
subtitle: 如果現在很亂，我們先只選一個最不費力的方向。
duration: 約 15 秒
tone: 低負擔選擇
primary_action_label: 我選好了
secondary_action_label: 等等再說
---
## 現在不用把全部說清楚

只要先選一個比較接近你的狀態就好。

### 你可以先挑一個

1. 閉上眼睛 10 秒，什麼都先不用想。
2. 抬頭看一個固定的地方 10 秒，讓腦袋先停一下。

> 沒有比較好的選項，哪一個比較不累，就選哪一個。

如果選完後想繼續聊，我再陪你往下走。`
};

async function loadMicroInterventionContent(card) {
  const microState = getMicroInterventionState();
  if (microState.contentCache[card.id]) {
    return microState.contentCache[card.id];
  }

  const fileName = String(card.docPath || '').split('/').pop();
  const candidatePaths = [
    card.docPath,
    fileName ? `/docs/micro_interventions/${fileName}` : '',
    fileName ? `/docs/計畫文件/${fileName}` : ''
  ]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);

  let lastFailedPath = card.docPath;
  let response = null;

  for (const docPath of candidatePaths) {
    lastFailedPath = docPath;
    response = await fetch(encodeURI(docPath));
    if (response.ok) {
      break;
    }
  }

  if (!response || !response.ok) {
    const fallbackMarkdown = MICRO_INTERVENTION_FALLBACK_MARKDOWN[card.id];
    if (fallbackMarkdown) {
      const parsedFallback = parseInterventionMarkdown(fallbackMarkdown);
      microState.contentCache[card.id] = parsedFallback;
      return parsedFallback;
    }
    throw new Error(`載入引導內容失敗：${lastFailedPath}`);
  }

  const markdown = await response.text();
  const parsed = parseInterventionMarkdown(markdown);
  microState.contentCache[card.id] = parsed;
  return parsed;
}

function renderMicroInterventionCard(card) {
  const container = document.getElementById('micro-intervention-slot');
  if (!container || !card) return;
  const anchor = TherapeuticMemory.get().positiveAnchors?.[0]?.label || '';
  const personalizedBody = anchor && card.id === 'tiny_choice_reset'
    ? `${card.bodyPreview} 如果你比較想靠近熟悉的東西，也可以先想想「${anchor}」這件事。`
    : card.bodyPreview;

  container.innerHTML = `
    <article class="micro-card ${card.accent}">
      <div class="micro-card-head">
        <div class="micro-card-icon">
          <span class="mat-icon fill">${card.icon}</span>
        </div>
        <div>
          <div class="micro-card-title">${escapeHtml(card.title)}</div>
          <div class="micro-card-duration">${escapeHtml(card.durationLabel)}</div>
        </div>
        <button class="micro-card-close" type="button" aria-label="關閉建議" onclick="dismissMicroIntervention('dismiss')">
          <span class="mat-icon">close</span>
        </button>
      </div>
      <p class="micro-card-subtitle">${escapeHtml(card.subtitle)}</p>
      <p class="micro-card-body">${escapeHtml(personalizedBody)}</p>
      <div class="micro-card-actions">
        <button class="micro-card-primary" type="button" onclick="openMicroIntervention('${card.id}')">
          ${escapeHtml(card.ctaLabel)}
          <span class="mat-icon">chevron_right</span>
        </button>
        <button class="micro-card-secondary" type="button" onclick="dismissMicroIntervention('snooze')">先不要</button>
      </div>
    </article>
  `;
  container.style.display = 'block';
  scrollChatToBottom();
}

function clearMicroInterventionCard() {
  const container = document.getElementById('micro-intervention-slot');
  getMicroInterventionState().currentCardId = '';
  if (!container) return;
  container.innerHTML = '';
  container.style.display = 'none';
}

function closeMicroInterventionDetail() {
  const overlay = document.getElementById('micro-intervention-detail');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('micro-detail-open');
  getMicroInterventionState().detailOpen = false;
}

async function openMicroIntervention(cardId) {
  const card = MICRO_INTERVENTION_REGISTRY[cardId];
  const overlay = document.getElementById('micro-intervention-detail');
  if (!card || !overlay) return;

  const title = document.getElementById('micro-detail-title');
  const subtitle = document.getElementById('micro-detail-subtitle');
  const meta = document.getElementById('micro-detail-meta');
  const body = document.getElementById('micro-detail-body');
  const primary = document.getElementById('micro-detail-primary');
  const secondary = document.getElementById('micro-detail-secondary');

  if (!title || !subtitle || !meta || !body || !primary || !secondary) return;

  title.textContent = card.title;
  subtitle.textContent = card.subtitle;
  meta.textContent = card.durationLabel;
  body.innerHTML = '<p>正在打開這張引導卡片...</p>';
  primary.textContent = '開始';
  secondary.textContent = '稍後再說';

  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('micro-detail-open');
  getMicroInterventionState().detailOpen = true;

  try {
    const content = await loadMicroInterventionContent(card);
    title.textContent = content.title || card.title;
    subtitle.textContent = content.subtitle || card.subtitle;
    meta.textContent = [content.duration || card.durationLabel, content.tone || '陪伴式引導'].filter(Boolean).join(' ・ ');
    body.innerHTML = renderMessageMarkdown(content.body || card.bodyPreview);
    primary.textContent = content.primaryActionLabel || '我做完了';
    secondary.textContent = content.secondaryActionLabel || '稍後再說';
    primary.onclick = () => completeMicroIntervention(card.id);
    secondary.onclick = () => dismissMicroIntervention('snooze');
  } catch (error) {
    body.innerHTML = `<p>${escapeHtml(error.message || '目前無法載入引導內容。')}</p>`;
    primary.textContent = '知道了';
    secondary.textContent = '關閉';
    primary.onclick = () => completeMicroIntervention(card.id);
    secondary.onclick = () => closeMicroInterventionDetail();
  }
}

function completeMicroIntervention(cardId) {
  appendSystemNotice('這張小卡片先陪你到這裡。如果還想要，我可以再給你一個更小的下一步。');
  getMicroInterventionState().dismissCount = 0;
  closeMicroInterventionDetail();
  clearMicroInterventionCard();
  getMicroInterventionState().currentCardId = '';
  getMicroInterventionState().lastPresentedCardId = cardId || getMicroInterventionState().lastPresentedCardId;
}

function dismissMicroIntervention(mode = 'dismiss') {
  const microState = getMicroInterventionState();
  const now = Date.now();
  if (mode === 'snooze') {
    microState.snoozedUntil = now + (MICRO_INTERVENTION_RULES?.DEFAULT_SNOOZE_MS || 12 * 60 * 1000);
    microState.dismissCount += 1;
  } else {
    microState.cooldownUntil = now + (MICRO_INTERVENTION_RULES?.DEFAULT_COOLDOWN_MS || 4 * 60 * 1000);
    microState.dismissCount += 1;
  }
  microState.currentCardId = '';
  clearMicroInterventionCard();
  closeMicroInterventionDetail();
}

function evaluateMicroIntervention(payload = {}, options = {}) {
  if (!MICRO_INTERVENTION_RULES?.chooseIntervention) return;
  const microState = getMicroInterventionState();
  const decision = MICRO_INTERVENTION_RULES.chooseIntervention(
    getMicroInterventionContext(payload, options),
    { registry: MICRO_INTERVENTION_REGISTRY }
  );

  if (decision.suppressed || !decision.card) {
    if (decision.reason === 'safety_route' || decision.reason === 'risk_flag' || options.fromOutput) {
      clearMicroInterventionCard();
      closeMicroInterventionDetail();
      microState.currentCardId = '';
    }
    return;
  }

  microState.currentCardId = decision.card.id;
  microState.lastPresentedCardId = decision.card.id;
  microState.cardHistory.unshift({ id: decision.card.id, shownAt: Date.now() });
  microState.cardHistory = microState.cardHistory.slice(0, 12);
  renderMicroInterventionCard(decision.card);
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

function handleInput(input, reason = 'input') {
  const isEmpty = input.value.trim().length === 0;

  if (reason === 'focus') {
    shortcutInputFocused = true;
    shortcutBarDismissed = false;
  } else if (reason === 'blur') {
    shortcutInputFocused = false;
    shortcutBarDismissed = false;
  } else if (!isEmpty) {
    shortcutBarDismissed = true;
  }

  syncShortcutBarState();
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

function updateScrollSafeArea() {
  const app = document.getElementById('app');
  if (!app) return;

  const activeScreen = document.querySelector('.screen.active');
  const inputSection = activeScreen?.querySelector('.input-section');
  const bottomNav = activeScreen?.querySelector('.bottom-nav');
  const topBar = activeScreen?.querySelector('.top-bar');

  const inputHeight = inputSection ? inputSection.offsetHeight : 0;
  const navHeight = bottomNav ? bottomNav.offsetHeight : 0;
  const topBarHeight = topBar ? topBar.offsetHeight : 0;
  const viewportHeight = window.visualViewport?.height || window.innerHeight || app.clientHeight || 0;
  const appHeight = app.clientHeight || 0;
  const keyboardInset = Math.max(0, appHeight - viewportHeight);
  const bottomGap = inputSection && bottomNav ? 36 : 36;
  const safeBottom = Math.max(160, inputHeight + navHeight + bottomGap + keyboardInset);

  app.style.setProperty('--scroll-safe-bottom', `${safeBottom}px`);

  const scrollAreas = activeScreen
    ? activeScreen.querySelectorAll('.chat-canvas, .page-scroll')
    : document.querySelectorAll('.chat-canvas, .page-scroll');

  scrollAreas.forEach((area) => {
    area.style.scrollPaddingTop = `${topBarHeight + 12}px`;
  });
}

async function appendMessage(role, text, options = {}) {
  const { bubble } = createMessageBubble(role);
  if (!bubble) return;

  APP_STATE.chatHistory.push({ role, content: text, createdAt: new Date().toISOString() });
  APP_STATE.chatHistory = APP_STATE.chatHistory.slice(-24);

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

  if (payload.code === 'openrouter_timeout') {
    return 'OpenRouter 超時了，這次等待太久沒有回來。通常代表上游模型沒有回應或網路過慢。';
  }

  if (payload.code === 'RESOURCE_EXHAUSTED' || payload.status === 429) {
    return `模型供應商目前拒絕請求，通常是配額或速率限制。\n\n原始訊息：${message}`;
  }

  if (message.includes('Missing Groq API key') || message.includes('Missing Google API key')) {
    return '目前沒有可用的模型 API key，請到 Settings 確認聊天引擎設定。';
  }

  if (message.includes('Missing OpenRouter API key')) {
    return '目前沒有可用的 OpenRouter API key，請到 Settings 確認聊天引擎設定。';
  }

  return `目前無法連接聊天流：${message}`;
}

function extractFhirDeliveryError(payload = {}) {
  const blockingReasons = Array.isArray(payload?.bundle_result?.blocking_reasons)
    ? payload.bundle_result.blocking_reasons.filter(Boolean)
    : [];
  if (blockingReasons.length) {
    return blockingReasons.join('；');
  }

  const issueDiagnostics = Array.isArray(payload?.transaction_response?.body?.issue)
    ? payload.transaction_response.body.issue
        .map((issue) => issue?.diagnostics || issue?.details?.text || issue?.code || '')
        .filter(Boolean)
    : [];
  if (issueDiagnostics.length) {
    return issueDiagnostics.join('；');
  }

  return payload?.transaction_response?.error || payload?.error || 'FHIR 上傳失敗';
}

function rememberFhirDeliveryDebug(debug = {}) {
  try {
    localStorage.setItem('rourou.lastFhirDeliveryDebug', JSON.stringify({
      capturedAt: new Date().toISOString(),
      ...debug
    }));
  } catch (error) {
    console.error('Unable to persist FHIR delivery debug info.', error);
  }
}

function buildUserPromptContextString() {
  const userPrompt = String(APP_STATE?.aiSettings?.userPrompt || '').trim();
  if (!userPrompt) return '';
  return [
    '【個性化記憶 - 這是使用者手動提供的偏好，請在回應時納入】',
    userPrompt
  ].join('\n');
}

function extractPreferenceItemsFromText(text = '') {
  const source = String(text || '').trim();
  if (!source) return [];
  const matches = [];
  const regex = /我(?:最)?喜歡([^，。！？\n]+)/g;
  let match;
  while ((match = regex.exec(source))) {
    const item = String(match[1] || '').trim().replace(/^(是|的)/, '').trim();
    if (item) matches.push(item);
  }
  return Array.from(new Set(matches));
}

function buildPreferenceRecallReply(message = '') {
  const question = String(message || '').trim();
  if (!/(喜歡什麼|記得.*喜歡|知道.*喜歡|我的偏好|我喜歡什麼)/.test(question)) {
    return '';
  }

  const memoryItems = Array.isArray(TherapeuticMemory.get()?.positiveAnchors)
    ? TherapeuticMemory.get().positiveAnchors.map((item) => item?.label).filter(Boolean)
    : [];
  const promptItems = extractPreferenceItemsFromText(APP_STATE?.aiSettings?.userPrompt || '');
  const items = Array.from(new Set(memoryItems.concat(promptItems)));

  if (!items.length) {
    return '';
  }

  return `我目前記得你喜歡 ${items.join('、')}。如果你願意，我也可以繼續把更多偏好記住。`;
}

function getRuntimeConfig() {
  const source = localStorage.getItem(RUNTIME_CONFIG_SOURCE_KEY) === 'custom' ? 'custom' : 'server';
  const serverConfig = getServerRuntimeConfig();
  const provider = source === 'custom'
    ? (localStorage.getItem('rourou.aiProvider') || serverConfig.provider)
    : serverConfig.provider;
  const defaults = getProviderDefaults(provider);
  return {
    source,
    provider,
    apiBaseUrl: source === 'custom'
      ? (localStorage.getItem('rourou.aiBaseUrl') || defaults.apiBaseUrl)
      : serverConfig.apiBaseUrl,
    apiKey: source === 'custom' ? (localStorage.getItem('rourou.aiApiKey') || '') : '',
    model: source === 'custom'
      ? (localStorage.getItem('rourou.aiModel') || defaults.model)
      : serverConfig.model,
    userId: APP_STATE.userId
  };
}

function getProviderDefaults(provider) {
  if (provider === 'openrouter') {
    return {
      provider,
      apiBaseUrl: DEFAULT_OPENROUTER_BASE_URL,
      model: DEFAULT_OPENROUTER_MODEL
    };
  }
  if (provider === 'groq') {
    return {
      provider,
      apiBaseUrl: DEFAULT_GROQ_BASE_URL,
      model: DEFAULT_GROQ_MODEL
    };
  }
  return {
    provider: 'google',
    apiBaseUrl: DEFAULT_GOOGLE_BASE_URL,
    model: DEFAULT_GOOGLE_MODEL
  };
}

function getServerRuntimeConfig() {
  return Object.assign({}, getProviderDefaults(SERVER_RUNTIME_CONFIG.provider || DEFAULT_PROVIDER), SERVER_RUNTIME_CONFIG);
}

function buildRuntimeRequestConfig(config) {
  if (config.source !== 'custom') {
    return {};
  }
  return {
    api_provider: config.provider,
    api_key: config.apiKey,
    api_base_url: config.apiBaseUrl,
    api_model: config.model
  };
}

function syncRuntimeSettingsForm() {
  const providerInput = document.getElementById('ai-provider');
  const baseUrlInput = document.getElementById('ai-base-url');
  const modelInput = document.getElementById('ai-model');
  const apiKeyInput = document.getElementById('ai-api-key');
  const userIdInput = document.getElementById('ai-user-id');
  if (!providerInput || !baseUrlInput || !modelInput || !apiKeyInput || !userIdInput) {
    return;
  }

  const config = getRuntimeConfig();
  providerInput.value = config.provider;
  baseUrlInput.value = config.apiBaseUrl;
  modelInput.value = config.model;
  apiKeyInput.value = config.apiKey;
  userIdInput.value = config.userId;
}

async function loadServerRuntimeConfig() {
  try {
    const response = await fetch('/health');
    if (!response.ok) return;
    const payload = await response.json();
    const defaults = getProviderDefaults(payload.provider || DEFAULT_PROVIDER);
    SERVER_RUNTIME_CONFIG = {
      provider: payload.provider || defaults.provider,
      apiBaseUrl: payload.default_api_base_url || defaults.apiBaseUrl,
      model: payload.default_model || defaults.model,
      source: 'server'
    };
    syncRuntimeSettingsForm();
  } catch (error) {
    console.warn('Unable to load server runtime config:', error);
  }
}

function getPrivacySettings() {
  return {
    fhirRealtimeSync: APP_STATE.privacySettings.fhirRealtimeSync,
    autoReportDraft: APP_STATE.privacySettings.autoReportDraft
  };
}

function savePrivacySettings(nextSettings = {}) {
  APP_STATE.privacySettings = Object.assign({}, APP_STATE.privacySettings, nextSettings);
  localStorage.setItem('rourou.fhirRealtimeSync', APP_STATE.privacySettings.fhirRealtimeSync ? 'true' : 'false');
  localStorage.setItem('rourou.autoReportDraft', APP_STATE.privacySettings.autoReportDraft ? 'true' : 'false');
}

function formatSessionTimestamp(value) {
  if (!value) return '未知時間';
  try {
    return new Date(value).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(value);
  }
}

function formatModeLabel(value) {
  const raw = String(value || 'auto');
  return raw
    .replace(/^mode_\d+_/, '')
    .replace(/^mode_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deepCloneSerializable(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function normalizeChatHistoryEntries(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const role = item.role === 'assistant' ? 'ai' : item.role;
      const content = String(item.content || '').trim();
      if (!role || !content) return null;
      return {
        ...item,
        role,
        content
      };
    })
    .filter(Boolean);
}

function findLatestHistoryContent(history = [], roles = []) {
  const roleList = Array.isArray(roles) ? roles : [roles];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (!item || !item.content) continue;
    if (roleList.length && !roleList.includes(item.role)) continue;
    const content = String(item.content || '').trim();
    if (content && !isUnreadableSessionText(content)) {
      return content;
    }
  }
  return '';
}

function summarizeSessionRecord(session = {}) {
  const history = normalizeChatHistoryEntries(session.history);
  const state = session.state && typeof session.state === 'object' ? session.state : {};
  const memorySnapshot = session.memory_snapshot && typeof session.memory_snapshot === 'object'
    ? session.memory_snapshot
    : {};
  const clinicianSummary = state.clinician_summary_draft && typeof state.clinician_summary_draft === 'object'
    ? state.clinician_summary_draft
    : {};
  const latestTagPayload = state.latest_tag_payload && typeof state.latest_tag_payload === 'object'
    ? state.latest_tag_payload
    : {};
  const lastUserMessage = pickReadableSessionText([
    memorySnapshot.last_user_message,
    findLatestHistoryContent(history, 'user')
  ], '');
  const lastAssistantMessage = pickReadableSessionText([
    memorySnapshot.last_assistant_message,
    findLatestHistoryContent(history, ['ai', 'assistant'])
  ], '');
  const latestTagSummary = pickReadableSessionText([
    memorySnapshot.latest_tag_summary,
    latestTagPayload.summary,
    lastAssistantMessage,
    lastUserMessage
  ], '');

  return {
    id: session.id || '',
    user: session.user || APP_STATE.userId || DEFAULT_USER_ID,
    startedAt: session.startedAt || '',
    updatedAt: session.updatedAt || '',
    active_mode: state.active_mode || memorySnapshot.active_mode || 'auto',
    risk_flag: state.risk_flag || memorySnapshot.risk_flag || 'false',
    latest_tag_summary: latestTagSummary,
    last_user_message: lastUserMessage,
    last_assistant_message: lastAssistantMessage,
    note_history_count: Array.isArray(memorySnapshot.note_history) ? memorySnapshot.note_history.length : 0,
    has_clinician_summary: Boolean(Object.keys(clinicianSummary).length),
    has_fhir_draft: Boolean(state.fhir_delivery_draft && typeof state.fhir_delivery_draft === 'object' && Object.keys(state.fhir_delivery_draft).length),
    has_corrupted_history: history.some((item) => isUnreadableSessionText(item.content)),
    message_count: history.length
  };
}

function scoreSessionRecordForRestore(session = {}) {
  const summary = summarizeSessionRecord(session);
  let score = 0;
  if (!summary.has_corrupted_history) score += 4;
  if (summary.last_user_message) score += 3;
  if (summary.last_assistant_message) score += 2;
  if (summary.latest_tag_summary) score += 1;
  score += Math.min(summary.message_count || 0, 6);
  return score;
}

function normalizeLocalSessionRecord(record = {}) {
  const state = record.state && typeof record.state === 'object' ? deepCloneSerializable(record.state, {}) : {};
  const memorySnapshot = record.memory_snapshot && typeof record.memory_snapshot === 'object'
    ? deepCloneSerializable(record.memory_snapshot, {})
    : {};
  return {
    id: String(record.id || '').trim(),
    user: String(record.user || APP_STATE.userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID,
    startedAt: record.startedAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.startedAt || new Date().toISOString(),
    history: normalizeChatHistoryEntries(record.history).slice(-48),
    state,
    revision: Number.isFinite(Number(record.revision)) ? Number(record.revision) : 0,
    memory_snapshot: {
      note_history: Array.isArray(memorySnapshot.note_history) ? memorySnapshot.note_history.filter(Boolean) : [],
      last_user_message: String(memorySnapshot.last_user_message || '').trim(),
      last_assistant_message: String(memorySnapshot.last_assistant_message || '').trim(),
      active_mode: String(memorySnapshot.active_mode || state.active_mode || 'auto').trim() || 'auto',
      risk_flag: String(memorySnapshot.risk_flag || state.risk_flag || 'false').trim() || 'false',
      latest_tag_summary: String(memorySnapshot.latest_tag_summary || state.latest_tag_payload?.summary || '').trim()
    },
    output_cache: record.output_cache && typeof record.output_cache === 'object'
      ? deepCloneSerializable(record.output_cache, {})
      : {}
  };
}

function loadLocalSessionArchiveRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SESSION_ARCHIVE_KEY));
    return (Array.isArray(parsed) ? parsed : [])
      .map((item) => normalizeLocalSessionRecord(item))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

function saveLocalSessionArchiveRecords(records = []) {
  const normalized = (Array.isArray(records) ? records : [])
    .map((item) => normalizeLocalSessionRecord(item))
    .filter((item) => item.id)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 1);
  localStorage.setItem(LOCAL_SESSION_ARCHIVE_KEY, JSON.stringify(normalized));
}

function findLocalSessionArchiveById(sessionId) {
  const targetId = String(sessionId || '').trim();
  if (!targetId) return null;
  return loadLocalSessionArchiveRecords().find((item) => item.id === targetId) || null;
}

function removeLocalSessionArchive(sessionId) {
  const targetId = String(sessionId || '').trim();
  if (!targetId) return false;
  const records = loadLocalSessionArchiveRecords();
  const nextRecords = records.filter((item) => item.id !== targetId);
  if (nextRecords.length === records.length) return false;
  saveLocalSessionArchiveRecords(nextRecords);
  return true;
}

function getSingleRecentSessionSummary() {
  const latest = loadLocalSessionArchiveRecords()
    .map((session) => summarizeSessionRecord(session))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
  return latest ? [latest] : [];
}

function buildCurrentSessionRecord() {
  if (!APP_STATE.conversationId) return null;
  const sessionExport = APP_STATE.reportOutputs.session_export || {};
  const history = normalizeChatHistoryEntries(APP_STATE.chatHistory);
  const lastUserMessage = findLatestHistoryContent(history, 'user');
  const lastAssistantMessage = findLatestHistoryContent(history, ['ai', 'assistant']);
  const latestTagPayload = APP_STATE.lastChatMetadata?.latest_tag_payload || sessionExport.latest_tag_payload || {};
  const state = {
    active_mode: APP_STATE.runtimeMode || APP_STATE.lastChatMetadata?.active_mode || sessionExport.active_mode || 'auto',
    risk_flag: APP_STATE.lastChatMetadata?.risk_flag || sessionExport.risk_flag || 'false',
    latest_tag_payload: deepCloneSerializable(latestTagPayload, {}),
    burden_level_state: deepCloneSerializable(APP_STATE.lastChatMetadata?.burden_level_state || sessionExport.burden_level_state || {}, {}),
    therapeutic_profile: deepCloneSerializable(TherapeuticMemory.get(), {})
  };

  return normalizeLocalSessionRecord({
    id: APP_STATE.conversationId,
    user: APP_STATE.userId || sessionExport.patient?.key || DEFAULT_USER_ID,
    startedAt: sessionExport.session?.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history,
    state,
    revision: history.length,
    memory_snapshot: {
      note_history: [],
      last_user_message: lastUserMessage,
      last_assistant_message: lastAssistantMessage,
      active_mode: state.active_mode,
      risk_flag: state.risk_flag,
      latest_tag_summary: pickReadableSessionText([
        latestTagPayload.summary,
        lastAssistantMessage,
        lastUserMessage
      ], '')
    }
  });
}

function saveCurrentSessionToLocalArchive() {
  const record = buildCurrentSessionRecord();
  if (!record || !record.id) return;
  const records = loadLocalSessionArchiveRecords().filter((item) => item.id !== record.id);
  records.unshift(record);
  saveLocalSessionArchiveRecords(records);
}

function applySessionRecord(session = {}, fallbackSessionId = '') {
  const normalizedSession = normalizeLocalSessionRecord({
    ...session,
    id: session.id || fallbackSessionId
  });
  APP_STATE.conversationId = normalizedSession.id || fallbackSessionId;
  APP_STATE.userId = normalizedSession.user || APP_STATE.userId;
  localStorage.setItem('rourou.userId', APP_STATE.userId);
  APP_STATE.runtimeMode = normalizedSession.state?.active_mode || '';
  APP_STATE.syncedMode = '';
  APP_STATE.lastChatMetadata = {
    active_mode: normalizedSession.state?.active_mode || '',
    risk_flag: normalizedSession.state?.risk_flag || 'false',
    latest_tag_payload: normalizedSession.state?.latest_tag_payload || {},
    burden_level_state: normalizedSession.state?.burden_level_state || {}
  };
  APP_STATE.chatHistory = normalizeChatHistoryEntries(normalizedSession.history).slice(-24);
  APP_STATE.reportOutputs.clinician_summary = null;
  APP_STATE.reportOutputs.patient_analysis = null;
  APP_STATE.reportOutputs.patient_review = null;
  APP_STATE.reportOutputs.fhir_delivery = null;
  APP_STATE.reportOutputs.fhir_delivery_result = null;
  APP_STATE.reportOutputs.session_export = buildSessionExportFromRecord(normalizedSession);
  APP_STATE.reportFhirDraft = {
    isLoading: false,
    error: '',
    emptyReason: '正在依據這段對話重新整理 FHIR 草稿...'
  };
  syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
  syncTherapeuticMemoryFromSessionExport(APP_STATE.reportOutputs.session_export);
  renderChatHistory(APP_STATE.chatHistory);
  updateModeLabels();
  renderReportOutputs();
  saveCurrentSessionToLocalArchive();
  showScreen('screen-chat');
}

function resetConversationState() {
  APP_STATE.conversationId = '';
  APP_STATE.pendingFreshSession = false;
  APP_STATE.syncedMode = '';
  APP_STATE.runtimeMode = '';
  APP_STATE.lastChatMetadata = null;
  APP_STATE.chatHistory = [];
  APP_STATE.reportOutputs = {
    clinician_summary: null,
    patient_analysis: null,
    patient_review: null,
    fhir_delivery: null,
    fhir_delivery_result: null,
    session_export: null,
    updatedAt: ''
  };
  APP_STATE.pendingConsent = {
    sessionExport: null,
    fhirDraft: null,
    deliveryResult: null,
    canConfirm: false
  };
  APP_STATE.reportFhirDraft = {
    isLoading: false,
    error: '',
    emptyReason: ''
  };
}

function buildConversationRequestState() {
  return {
    conversation_id: APP_STATE.conversationId,
    force_new_session: Boolean(!APP_STATE.conversationId && APP_STATE.pendingFreshSession),
    therapeutic_profile: TherapeuticMemory.get()
  };
}

function finalizeConversationRequest(payload = {}) {
  APP_STATE.conversationId = payload.conversation_id || APP_STATE.conversationId;
  if (APP_STATE.conversationId) {
    APP_STATE.pendingFreshSession = false;
  }
}

function normalizeFhirDraftPayload(payload) {
  const finalPayload = Object.assign({}, payload);
  const enhanced = attachProfileToFhirResult(finalPayload.output || finalPayload);
  if (enhanced !== (finalPayload.output || finalPayload)) {
    finalPayload.output = enhanced;
  }
  if (!isValidFhirDraftOutput(finalPayload.output)) {
    return finalPayload;
  }
  return finalPayload;
}

function getExistingFhirDraft() {
  const current = APP_STATE.reportOutputs.fhir_delivery;
  if (!isValidFhirDraftOutput(current)) return null;
  return JSON.parse(JSON.stringify(current));
}

async function ensureReportFhirDraft() {
  const hasDraft = isValidFhirDraftOutput(APP_STATE.reportOutputs.fhir_delivery);
  if (hasDraft || APP_STATE.reportFhirDraft.isLoading || APP_STATE.isSending) {
    return;
  }

  if (!APP_STATE.conversationId && !APP_STATE.chatHistory.length) {
    APP_STATE.reportFhirDraft = {
      isLoading: false,
      error: '',
      emptyReason: '目前還沒有可生成的 FHIR 草稿。先完成至少一輪對話，這裡才會出現真的摘要。'
    };
    renderReportOutputs();
    return;
  }

  APP_STATE.reportFhirDraft = {
    isLoading: true,
    error: '',
    emptyReason: '正在依據這段對話重新整理 FHIR 草稿...'
  };
  renderReportOutputs();

  try {
    const payload = await fetchOutputPayload('fhir_delivery', OUTPUT_DEFINITIONS.fhir_delivery.instruction);
    const finalPayload = normalizeFhirDraftPayload(payload);
    APP_STATE.reportFhirDraft = {
      isLoading: false,
      error: '',
      emptyReason: ''
    };
    storeOutputResult(finalPayload);
  } catch (error) {
    APP_STATE.reportFhirDraft = {
      isLoading: false,
      error: error.message || '目前無法建立 FHIR 草稿。',
      emptyReason: ''
    };
    renderReportOutputs();
  }
}

function renderRecentSessions() {
  const container = document.getElementById('home-session-list');
  const continueButton = document.getElementById('home-continue-last-chat');
  if (!container) return;

  const sessions = Array.isArray(APP_STATE.recentSessions) ? APP_STATE.recentSessions : [];
  if (continueButton) {
    continueButton.disabled = !sessions.length;
  }

  if (!sessions.length) {
    container.innerHTML = `<div class="home-session-empty">目前還沒有已保存的對話。你可以先開始一段新的聊天，之後這裡就會顯示最近的對話。</div>`;
    return;
  }

  container.innerHTML = sessions.map((session) => {
    const summary = pickReadableSessionText(
      [session.latest_tag_summary, session.last_user_message, session.last_assistant_message],
      '這段對話目前還沒有可讀摘要。'
    );
    const sub = pickReadableSessionText(
      [session.last_assistant_message, session.last_user_message],
      '點進去可以繼續這段對話。'
    );
    const flags = [
      session.risk_flag === 'true' ? '<span class="home-session-flag risk">高風險標記</span>' : '',
      session.has_clinician_summary ? '<span class="home-session-flag">有醫師摘要</span>' : '',
      session.has_fhir_draft ? '<span class="home-session-flag">有 FHIR 草稿</span>' : '',
      session.has_corrupted_history ? '<span class="home-session-flag risk">訊息疑似損壞</span>' : ''
    ].filter(Boolean).join('');

    return `
      <div class="home-session-item">
        <button class="home-session-card" type="button" data-session-open="${escapeHtml(session.id)}">
        <div class="home-session-top">
          <div class="home-session-time">${escapeHtml(formatSessionTimestamp(session.updatedAt))}</div>
          <div class="home-session-actions">
            <div class="home-session-mode">${escapeHtml(formatModeLabel(session.active_mode))}</div>
            <span class="home-session-delete" role="button" tabindex="0" aria-label="刪除這筆對話" data-session-delete="${escapeHtml(session.id)}">刪除</span>
          </div>
        </div>
        <div class="home-session-summary">${escapeHtml(summary)}</div>
        <div class="home-session-sub">${escapeHtml(sub)}</div>
        ${flags ? `<div class="home-session-flags">${flags}</div>` : ''}
        </button>
      </div>
    `;
  }).join('');
}

async function deleteRecentSession(sessionId) {
  const target = APP_STATE.recentSessions.find((item) => item.id === sessionId);
  if (!target) return;

  const confirmed = window.confirm(`要刪除 ${formatSessionTimestamp(target.updatedAt)} 的這段對話嗎？這個動作無法復原。`);
  if (!confirmed) return;

  const removedLocalBackup = removeLocalSessionArchive(sessionId);
  if (!removedLocalBackup) {
    appendSystemNotice('目前沒有可刪除的上一段對話。');
    return;
  }

  APP_STATE.recentSessions = APP_STATE.recentSessions.filter((item) => item.id !== sessionId);
  if (APP_STATE.conversationId === sessionId) {
    resetConversationState();
    APP_STATE.chatHistory = [];
    renderChatHistory([]);
    showScreen('screen-home');
  } else {
    renderRecentSessions();
  }

  appendSystemNotice('已刪除上一段對話。');
  renderRecentSessions();
}

async function loadRecentSessions() {
  const container = document.getElementById('home-session-list');
  if (container) {
    container.innerHTML = `<div class="home-session-empty">正在讀取最近對話...</div>`;
  }

  APP_STATE.recentSessions = getSingleRecentSessionSummary();
  if (APP_STATE.recentSessions.length) {
    renderRecentSessions();
  } else if (container) {
    container.innerHTML = `<div class="home-session-empty">目前還沒有已保存的對話。你之後上一段聊天會顯示在這裡。</div>`;
  }
}

function renderChatHistory(history = []) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const sensorBadge = container.querySelector('.sensor-badge');
  const dateChip = container.querySelector('.date-chip');
  const typingIndicator = document.getElementById('typing-indicator');
  const microSlot = document.getElementById('micro-intervention-slot');

  container.innerHTML = '';
  if (sensorBadge) container.appendChild(sensorBadge);
  if (dateChip) container.appendChild(dateChip);

  const items = Array.isArray(history) ? history : [];
  items.forEach((item) => {
    if (!item || !item.role || !item.content) return;
    const { bubble } = createMessageBubble(item.role);
    if (!bubble) return;
    if (item.role === 'ai') {
      bubble.innerHTML = renderMessageMarkdown(item.content);
    } else {
      bubble.textContent = item.content;
    }
  });

  if (typingIndicator) {
    typingIndicator.style.display = 'none';
    container.appendChild(typingIndicator);
  }
  if (microSlot) {
    microSlot.style.display = 'none';
    microSlot.innerHTML = '';
    container.appendChild(microSlot);
  }

  scrollChatToBottom();
}

function buildSessionExportFromRecord(session = {}) {
  const restoreSource = String(session.__restoreSource || session.__source || '').trim();
  const trustStructuredOutputs = restoreSource === 'server';
  return {
    patient: {
      key: session.user || APP_STATE.userId,
      name: session.user || APP_STATE.userId,
      gender: 'unknown'
    },
    session: {
      encounterKey: session.id || '',
      startedAt: session.startedAt || '',
      endedAt: session.updatedAt || ''
    },
    author: 'AI Companion Node Engine',
    active_mode: session.state?.active_mode || '',
    risk_flag: session.state?.risk_flag || 'false',
    latest_tag_payload: session.state?.latest_tag_payload || {},
    burden_level_state: session.state?.burden_level_state || {},
    clinician_summary_draft: trustStructuredOutputs ? (session.state?.clinician_summary_draft || {}) : {},
    patient_analysis: trustStructuredOutputs ? (session.state?.patient_analysis || {}) : {},
    patient_review_packet: trustStructuredOutputs ? (session.state?.patient_review_packet || {}) : {},
    fhir_delivery_draft: trustStructuredOutputs ? (session.state?.fhir_delivery_draft || {}) : {},
    hamd_progress_state: session.state?.hamd_progress_state || {},
    hamd_formal_assessment: session.state?.hamd_formal_assessment || {},
    red_flag_payload: session.state?.red_flag_payload || {},
    patient_authorization_state: session.state?.patient_authorization_state || {},
    delivery_readiness_state: session.state?.delivery_readiness_state || {},
    summary_draft_state: trustStructuredOutputs ? (session.state?.summary_draft_state || {}) : {},
    therapeutic_profile: session.state?.therapeutic_profile || {},
    __requiresRegeneration: !trustStructuredOutputs,
    __source: trustStructuredOutputs ? 'server_session' : 'local_archive'
  };
}

async function syncLocalSessionRecordToServer(session = {}) {
  if (!session || !session.id) return;
  const normalizedHistory = (Array.isArray(session.history) ? session.history : []).map((item) => ({
    ...item,
    role: item?.role === 'ai' ? 'assistant' : item?.role
  }));
  try {
    await fetch(`/api/chat/session?id=${encodeURIComponent(session.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: session.user || APP_STATE.userId || DEFAULT_USER_ID,
        startedAt: session.startedAt || new Date().toISOString(),
        history: normalizedHistory,
        state: session.state && typeof session.state === 'object' ? session.state : {},
        memory_snapshot: session.memory_snapshot && typeof session.memory_snapshot === 'object' ? session.memory_snapshot : {},
        revision: Number.isFinite(Number(session.revision)) ? Number(session.revision) : 0,
        clear_output_cache: true
      })
    });
  } catch (error) {
    console.warn('Unable to sync local session record back to server:', error);
  }
}

async function restoreSession(sessionId) {
  const localSession = findLocalSessionArchiveById(sessionId);
  try {
    const response = await fetch(`/api/chat/session?id=${encodeURIComponent(sessionId)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || '讀取對話內容失敗');
    }
    const serverSession = payload.session || {};
    const shouldPreferLocal = Boolean(
      localSession &&
      scoreSessionRecordForRestore(localSession) > scoreSessionRecordForRestore(serverSession)
    );
    if (shouldPreferLocal) {
      applySessionRecord({ ...localSession, __restoreSource: 'local' }, sessionId);
      await syncLocalSessionRecordToServer(localSession);
      appendSystemNotice('已優先使用這台裝置上較完整的上一段對話。');
      return;
    }
    applySessionRecord({ ...serverSession, __restoreSource: 'server' }, sessionId);
    return;
  } catch (error) {
    if (localSession) {
      applySessionRecord({ ...localSession, __restoreSource: 'local' }, sessionId);
      await syncLocalSessionRecordToServer(localSession);
      appendSystemNotice('目前改用這台裝置上的本機備份開啟這段對話。');
      return;
    }
    throw error;
  }
}

async function continueLatestSession() {
  const latest = APP_STATE.recentSessions[0];
  if (!latest) {
    appendSystemNotice('目前還沒有可繼續的舊對話。');
    return;
  }
  try {
    await restoreSession(latest.id);
    appendSystemNotice(`已切換到 ${formatSessionTimestamp(latest.updatedAt)} 的對話。`);
  } catch (error) {
    appendSystemNotice(error.message || '切換舊對話失敗。');
  }
}

async function continueSpecificSession(sessionId) {
  const target = APP_STATE.recentSessions.find((item) => item.id === sessionId);
  if (!target) return;
  try {
    await restoreSession(target.id);
    appendSystemNotice(`已切換到 ${formatSessionTimestamp(target.updatedAt)} 的對話。`);
  } catch (error) {
    appendSystemNotice(error.message || '切換舊對話失敗。');
  }
}

function startNewConversation() {
  saveCurrentSessionToLocalArchive();
  resetConversationState();
  APP_STATE.pendingFreshSession = true;
  renderChatHistory([]);
  updateModeLabels();
  renderReportOutputs();
  showScreen('screen-chat');
  appendSystemNotice('已開始新的對話。這次不會接續之前的會話。');
}

function formatArrayForList(items = [], emptyText = '目前沒有可顯示內容。') {
  const normalized = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!normalized.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }
  return `<ul class="consent-preview-list">${normalized.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>`;
}

function normalizeSessionExportForDelivery(sessionExport = {}) {
  const normalized = JSON.parse(JSON.stringify(sessionExport || {}));
  normalized.clinician_summary_draft = normalized.clinician_summary_draft && typeof normalized.clinician_summary_draft === 'object'
    ? normalized.clinician_summary_draft
    : {};
  const clinician = normalized.clinician_summary_draft;
  const fallbackMessages = Array.isArray(APP_STATE?.chatHistory)
    ? APP_STATE.chatHistory
        .filter((item) => item && item.role === 'user' && item.content)
        .map((item) => String(item.content).trim())
        .filter(Boolean)
    : [];
  const fallbackNarrative = fallbackMessages.length
    ? fallbackMessages.slice(-3).join('；')
    : '本次對話內容較少，先保留最小交付摘要供後續醫療端確認。';
  const extractedConcerns = [];
  const extractedSignals = [];
  const extractedObservations = [];

  fallbackMessages.slice(-12).forEach((message) => {
    const text = String(message || '').trim();
    if (!text) return;
    const clipped = text.length > 90 ? `${text.slice(0, 90)}...` : text;
    if (/(憂鬱|低落|沮喪|空虛|沒意義|提不起勁)/i.test(text)) {
      if (!extractedConcerns.includes('持續低落與憂鬱感')) extractedConcerns.push('持續低落與憂鬱感');
      if (!extractedSignals.includes('depressed_mood')) extractedSignals.push('depressed_mood');
    }
    if (/(工作|上班|打工|沒動力|摸魚|無意義|自我實踐)/i.test(text)) {
      if (!extractedConcerns.includes('工作動力與意義感下降')) extractedConcerns.push('工作動力與意義感下降');
      if (!extractedSignals.includes('work_interest')) extractedSignals.push('work_interest');
    }
    if (/(易怒|暴躁|煩躁|朋友|遠離|疏離|孤單)/i.test(text)) {
      if (!extractedConcerns.includes('易怒與人際疏離')) extractedConcerns.push('易怒與人際疏離');
      if (!extractedSignals.includes('agitation')) extractedSignals.push('agitation');
    }
    if (/(心不在焉|變慢|拖住|專心|注意力)/i.test(text)) {
      if (!extractedConcerns.includes('注意力下降或思考拖慢')) extractedConcerns.push('注意力下降或思考拖慢');
      if (!extractedSignals.includes('retardation')) extractedSignals.push('retardation');
    }
    if (/(睡不著|失眠|半夜醒|早醒|睡眠)/i.test(text)) {
      if (!extractedConcerns.includes('睡眠困擾')) extractedConcerns.push('睡眠困擾');
      if (!extractedSignals.includes('insomnia')) extractedSignals.push('insomnia');
    }
    if (/(焦慮|緊張|心悸|不安|胃痛|胸悶)/i.test(text)) {
      if (!extractedConcerns.includes('焦慮與身體緊繃')) extractedConcerns.push('焦慮與身體緊繃');
      if (!extractedSignals.includes('somatic_anxiety')) extractedSignals.push('somatic_anxiety');
    }
    if (/(自責|怪自己|絕望|活著沒有意義|想消失|傷痕|自傷)/i.test(text)) {
      if (!extractedConcerns.includes('自責、無望或自傷風險線索')) extractedConcerns.push('自責、無望或自傷風險線索');
      if (!extractedSignals.includes('guilt')) extractedSignals.push('guilt');
    }
    if (extractedObservations.length < 8) {
      extractedObservations.push(clipped);
    }
  });

  const symptomObservations = Array.isArray(clinician.symptom_observations)
    ? clinician.symptom_observations.filter(Boolean)
    : [];
  const hamdSignals = Array.isArray(clinician.hamd_signals)
    ? clinician.hamd_signals.filter(Boolean)
    : [];
  const inferredSignals = symptomObservations.reduce((acc, item) => {
    const text = String(item || '').toLowerCase();
    if ((text.includes('低落') || text.includes('憂鬱') || text.includes('depress')) && !acc.includes('depressed_mood')) {
      acc.push('depressed_mood');
    }
    if ((text.includes('興趣') || text.includes('工作') || text.includes('提不起勁') || text.includes('沒動力')) && !acc.includes('work_interest')) {
      acc.push('work_interest');
    }
    if ((text.includes('睡') || text.includes('失眠') || text.includes('醒')) && !acc.includes('insomnia')) {
      acc.push('insomnia');
    }
    if ((text.includes('焦躁') || text.includes('坐立難安') || text.includes('煩')) && !acc.includes('agitation')) {
      acc.push('agitation');
    }
    if ((text.includes('焦慮') || text.includes('緊張') || text.includes('心悸')) && !acc.includes('somatic_anxiety')) {
      acc.push('somatic_anxiety');
    }
    return acc;
  }, []);
  const resolvedSignals = hamdSignals.length ? hamdSignals : inferredSignals;

  if (!Array.isArray(clinician.chief_concerns) || !clinician.chief_concerns.length) {
    clinician.chief_concerns = extractedConcerns.length ? extractedConcerns : [fallbackNarrative];
  }

  if (!Array.isArray(clinician.symptom_observations) || !clinician.symptom_observations.length) {
    clinician.symptom_observations = symptomObservations.length
      ? symptomObservations
      : (extractedObservations.length ? extractedObservations : [fallbackNarrative]);
  }

  if (!Array.isArray(clinician.followup_needs) || !clinician.followup_needs.length) {
    clinician.followup_needs = ['建議於正式看診時補充本次情緒、睡眠與功能影響。'];
  }

  if (!Array.isArray(clinician.safety_flags) || !clinician.safety_flags.length) {
    clinician.safety_flags = ['本次為最小送出資料，需由醫療端再確認風險與症狀細節。'];
  }

  if (!Array.isArray(clinician.hamd_signals) || !clinician.hamd_signals.length) {
    clinician.hamd_signals = resolvedSignals.length ? resolvedSignals : (extractedSignals.length ? extractedSignals : ['depressed_mood']);
  }

  if (!String(clinician.draft_summary || '').trim()) {
    clinician.draft_summary = fallbackNarrative;
  }

  if (!normalized.hamd_progress_state || typeof normalized.hamd_progress_state !== 'object') {
    normalized.hamd_progress_state = {};
  }

  if (!Array.isArray(normalized.hamd_progress_state.covered_dimensions) || !normalized.hamd_progress_state.covered_dimensions.length) {
    normalized.hamd_progress_state.covered_dimensions = resolvedSignals.length ? resolvedSignals : ['depressed_mood'];
  }

  if (!Array.isArray(normalized.hamd_progress_state.supported_dimensions) || !normalized.hamd_progress_state.supported_dimensions.length) {
    normalized.hamd_progress_state.supported_dimensions = Array.isArray(normalized.hamd_progress_state.covered_dimensions)
      ? [...normalized.hamd_progress_state.covered_dimensions]
      : [];
  }

  if (!Array.isArray(normalized.hamd_progress_state.recent_evidence) || !normalized.hamd_progress_state.recent_evidence.length) {
    normalized.hamd_progress_state.recent_evidence = clinician.symptom_observations.length
      ? [...clinician.symptom_observations]
      : [fallbackNarrative];
  }

  if (!normalized.hamd_progress_state.next_recommended_dimension) {
    normalized.hamd_progress_state.next_recommended_dimension = normalized.hamd_progress_state.covered_dimensions[0] || 'depressed_mood';
  }

  if (!normalized.delivery_readiness_state || typeof normalized.delivery_readiness_state !== 'object') {
    normalized.delivery_readiness_state = {};
  }

  if (!normalized.delivery_readiness_state.readiness_status) {
    normalized.delivery_readiness_state.readiness_status = 'ready_for_backend_mapping';
  }

  if (normalized.delivery_readiness_state.readiness_status !== 'ready_for_backend_mapping') {
    normalized.delivery_readiness_state.readiness_status = 'ready_for_backend_mapping';
  }

  return normalized;
}

function mergeReportOutputsIntoSessionExport(sessionExport = {}, options = {}) {
  const merged = JSON.parse(JSON.stringify(sessionExport || {}));
  const reportOutputs = APP_STATE.reportOutputs || {};
  const pendingFhirDraft = options.fhirDraft || APP_STATE.pendingConsent?.fhirDraft || null;

  if (reportOutputs.clinician_summary && typeof reportOutputs.clinician_summary === 'object') {
    merged.clinician_summary_draft = JSON.parse(JSON.stringify(reportOutputs.clinician_summary));
  }

  if (reportOutputs.patient_analysis && typeof reportOutputs.patient_analysis === 'object') {
    merged.patient_analysis = JSON.parse(JSON.stringify(reportOutputs.patient_analysis));
  }

  if (reportOutputs.patient_review && typeof reportOutputs.patient_review === 'object') {
    merged.patient_review_packet = JSON.parse(JSON.stringify(reportOutputs.patient_review));
  }

  const resolvedFhirDraft = pendingFhirDraft || reportOutputs.fhir_delivery;
  if (resolvedFhirDraft && typeof resolvedFhirDraft === 'object') {
    merged.fhir_delivery_draft = JSON.parse(JSON.stringify(resolvedFhirDraft));
  }

  return merged;
}

function createDeliveryPreviewSuffix() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function prepareSessionExportForDelivery(sessionExport = {}, deliveryTargetUrl = '') {
  const enriched = mergeReportOutputsIntoSessionExport(sessionExport, {
    fhirDraft: APP_STATE.pendingConsent?.fhirDraft || null
  });
  const normalized = normalizeSessionExportForDelivery(enriched);
  const normalizedTarget = normalizeFhirBaseUrl(deliveryTargetUrl);
  if (normalizedTarget === 'https://hapi.fhir.org/baseR4') {
    const suffix = String(normalized.__deliverySuffix || '').trim() || createDeliveryPreviewSuffix();
    normalized.__deliverySuffix = suffix;
  }
  return normalized;
}

function getPreviewPatientIdentifier(sessionExport = {}, deliveryTargetUrl = '') {
  const baseKey = String(sessionExport?.patient?.key || '').trim();
  const normalizedTarget = normalizeFhirBaseUrl(deliveryTargetUrl);
  const suffix = String(sessionExport?.__deliverySuffix || '').trim();
  if (normalizedTarget === 'https://hapi.fhir.org/baseR4' && baseKey && suffix && !baseKey.endsWith(`-${suffix}`)) {
    return `${baseKey}-${suffix}`;
  }
  return baseKey;
}

async function fetchDeliveryTargetUrl() {
  try {
    const response = await fetch('/health');
    if (!response.ok) return '';
    const payload = await response.json();
    return normalizeFhirBaseUrl(payload?.fhir_server_url || '');
  } catch (error) {
    console.error('Unable to fetch FHIR delivery target.', error);
    return '';
  }
}

function buildConsentPreviewHtml(sessionExport, fhirDraft) {
  const clinician = sessionExport?.clinician_summary_draft || {};
  const patient = sessionExport?.patient || {};
  const session = sessionExport?.session || {};
  const hamd = sessionExport?.hamd_progress_state || {};
  const deliveryTargetUrl = sessionExport?.__deliveryTargetUrl || '';
  const previewPatientIdentifier = getPreviewPatientIdentifier(sessionExport, deliveryTargetUrl);
  const resourceList = Array.isArray(fhirDraft?.resources) ? fhirDraft.resources : [];
  const resourceLabels = resourceList.map((item) => item.display || item.type || item.resourceType || 'Unknown');
  const snippet = buildFhirSnippet(fhirDraft, APP_STATE.reportOutputs.fhir_delivery_result || APP_STATE.pendingConsent.deliveryResult || null);
  const payloadBlocks = [
    sessionExport?.clinician_summary_draft ? 'clinician_summary_draft' : '',
    sessionExport?.patient_analysis ? 'patient_analysis' : '',
    sessionExport?.patient_review_packet ? 'patient_review_packet' : '',
    sessionExport?.fhir_delivery_draft ? 'fhir_delivery_draft' : '',
    sessionExport?.hamd_formal_assessment ? 'hamd_formal_assessment' : ''
  ].filter(Boolean);

  return `
    <section class="consent-preview-section">
      <h4>送出資訊摘要</h4>
      <div class="consent-preview-meta">
        <div class="consent-preview-meta-item">
          <div class="consent-preview-meta-label">Patient 識別值</div>
          <div class="consent-preview-meta-value">${escapeHtml(patient.key || 'unknown')}</div>
        </div>
        <div class="consent-preview-meta-item">
          <div class="consent-preview-meta-label">這次送出會使用</div>
          <div class="consent-preview-meta-value">${escapeHtml(previewPatientIdentifier || 'unknown')}</div>
        </div>
        <div class="consent-preview-meta-item">
          <div class="consent-preview-meta-label">Encounter</div>
          <div class="consent-preview-meta-value">${escapeHtml(session.encounterKey || '尚未建立')}</div>
        </div>
        <div class="consent-preview-meta-item">
          <div class="consent-preview-meta-label">主模式</div>
          <div class="consent-preview-meta-value">${escapeHtml(sessionExport?.active_mode || 'auto')}</div>
        </div>
        <div class="consent-preview-meta-item">
          <div class="consent-preview-meta-label">FHIR 資源數</div>
          <div class="consent-preview-meta-value">${escapeHtml(String(resourceList.length))}</div>
        </div>
      </div>
      <p>${escapeHtml(deliveryTargetUrl ? `FHIR 端點：${deliveryTargetUrl}` : 'FHIR 端點尚未確認')}</p>
    </section>
    <section class="consent-preview-section">
      <h4>醫師摘要</h4>
      <p>${escapeHtml(isMeaningfulDraftText(clinician.draft_summary) ? clinician.draft_summary : '尚未產生摘要內容。')}</p>
    </section>
    <section class="consent-preview-section">
      <h4>症狀整理</h4>
      ${formatArrayForList(clinician.symptom_observations, '尚未整理出症狀觀察。')}
    </section>
    <section class="consent-preview-section">
      <h4>分類邏輯</h4>
      ${formatArrayForList(clinician.chief_concerns, '尚未整理出主要關注事項。')}
    </section>
    <section class="consent-preview-section">
      <h4>HAM-D Mapping</h4>
      ${formatArrayForList(
        getMeaningfulItems(hamd.covered_dimensions).map((item) => formatHamdSignalLabel(item)),
        '目前尚未收斂出 HAM-D 維度。'
      )}
    </section>
    <section class="consent-preview-section">
      <h4>FHIR 交付方式</h4>
      <p>系統會轉換為 FHIR JSON 並傳送至 Server。</p>
      <pre class="consent-preview-json consent-preview-json-compact">${escapeHtml(snippet)}</pre>
    </section>
    <section class="consent-preview-section">
      <h4>即將送出的資源</h4>
      ${formatArrayForList(resourceLabels, '目前沒有可送出的 FHIR 資源。')}
    </section>
    <details class="consent-preview-section consent-preview-details">
      <summary>查看技術明細</summary>
      <div class="consent-preview-details-body">
        <h4>已合併進送出 payload 的草稿區塊</h4>
        ${formatArrayForList(payloadBlocks, '目前只有最小必要欄位。')}
        <h4>Session Export JSON</h4>
        <pre class="consent-preview-json">${escapeHtml(JSON.stringify(sessionExport, null, 2))}</pre>
      </div>
    </details>
  `;
}

function resetConsentPreviewState() {
  APP_STATE.pendingConsent = {
    sessionExport: null,
    fhirDraft: null,
    deliveryResult: null,
    deliveryTargetUrl: '',
    canConfirm: false,
    progressLabel: '',
    progressValue: 0,
    progressText: ''
  };
  const confirmButton = document.getElementById('consent-preview-confirm');
  const scrollBody = document.getElementById('consent-preview-scroll');
  const previewBody = document.getElementById('consent-preview-body');
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.textContent = '同意送出';
  }
  if (scrollBody) {
    scrollBody.scrollTop = 0;
  }
  if (previewBody) {
    previewBody.innerHTML = '';
  }
  stopProgressAnimation('consent');
  setConsentPreviewProgress(0, '等待操作', '待命', { immediate: true });
}

function stopProgressAnimation(type) {
  const timerKey = type === 'report' ? 'reportTimer' : 'consentTimer';
  if (APP_STATE.progressAnimation[timerKey]) {
    clearInterval(APP_STATE.progressAnimation[timerKey]);
    APP_STATE.progressAnimation[timerKey] = null;
  }
}

function stopProgressStageRotation() {
  if (APP_STATE.progressAnimation.stageTimer) {
    clearInterval(APP_STATE.progressAnimation.stageTimer);
    APP_STATE.progressAnimation.stageTimer = null;
  }
}

function startProgressStageRotation(stages = []) {
  stopProgressStageRotation();
  if (!Array.isArray(stages) || stages.length < 2) return;
  let index = 0;
  APP_STATE.progressAnimation.stageTimer = setInterval(() => {
    index = (index + 1) % stages.length;
    const stage = stages[index];
    if (!stage) return;
    setReportConsentProgress(stage, { immediate: true });
    setConsentPreviewProgress(stage.value, stage.label, stage.valueText, { immediate: true });
  }, 1400);
}

function syncConsentPreviewProgress() {
  const labelEl = document.getElementById('consent-preview-progress-label');
  const valueEl = document.getElementById('consent-preview-progress-value');
  const barEl = document.getElementById('consent-preview-progress-bar');
  if (labelEl) labelEl.textContent = APP_STATE.pendingConsent.progressLabel || '等待操作';
  if (valueEl) valueEl.textContent = APP_STATE.pendingConsent.progressText || '進行中';
  if (barEl) barEl.style.width = `${APP_STATE.pendingConsent.progressValue}%`;
}

function syncReportConsentProgress() {
  const container = document.getElementById('report-consent-progress');
  const labelEl = document.getElementById('report-consent-progress-label');
  const valueEl = document.getElementById('report-consent-progress-value');
  const barEl = document.getElementById('report-consent-progress-bar');
  const noteEl = document.getElementById('report-consent-progress-note');

  if (container) {
    container.hidden = !APP_STATE.reportConsentProgress.visible;
  }
  if (labelEl) {
    labelEl.textContent = APP_STATE.reportConsentProgress.label || '正在準備授權預覽...';
  }
  if (valueEl) {
    valueEl.textContent = APP_STATE.reportConsentProgress.valueText || '進行中';
  }
  if (barEl) {
    barEl.style.width = `${APP_STATE.reportConsentProgress.value}%`;
  }
  if (noteEl) {
    noteEl.textContent = APP_STATE.reportConsentProgress.note || '這通常需要幾秒鐘，請稍候。';
  }
}

function animateProgressValue(type, targetValue) {
  const timerKey = type === 'report' ? 'reportTimer' : 'consentTimer';
  const stateKey = type === 'report' ? 'reportConsentProgress' : 'pendingConsent';
  stopProgressAnimation(type);

  APP_STATE.progressAnimation[timerKey] = setInterval(() => {
    const currentValue = Number(APP_STATE[stateKey].value ?? APP_STATE[stateKey].progressValue ?? 0);
    const delta = targetValue - currentValue;

    if (Math.abs(delta) <= 0.8) {
      if (type === 'report') {
        APP_STATE.reportConsentProgress.value = targetValue;
        syncReportConsentProgress();
      } else {
        APP_STATE.pendingConsent.progressValue = targetValue;
        syncConsentPreviewProgress();
      }
      stopProgressAnimation(type);
      return;
    }

    const step = Math.max(0.9, Math.min(4.2, Math.abs(delta) * 0.18));
    const nextValue = Math.max(0, Math.min(100, currentValue + Math.sign(delta) * step));

    if (type === 'report') {
      APP_STATE.reportConsentProgress.value = nextValue;
      syncReportConsentProgress();
    } else {
      APP_STATE.pendingConsent.progressValue = nextValue;
      syncConsentPreviewProgress();
    }
  }, 120);
}

function setConsentPreviewProgress(value, label, valueText = '', options = {}) {
  const nextValue = Math.max(0, Math.min(100, Number(value) || 0));
  APP_STATE.pendingConsent.progressLabel = String(label || '');
  APP_STATE.pendingConsent.progressText = String(valueText || '');
  if (options.immediate) {
    APP_STATE.pendingConsent.progressValue = nextValue;
    stopProgressAnimation('consent');
    syncConsentPreviewProgress();
    return;
  }
  syncConsentPreviewProgress();
  animateProgressValue('consent', nextValue);
}

function setReportConsentProgress({ visible = true, value = 0, label = '', note = '', valueText = '' } = {}, options = {}) {
  APP_STATE.reportConsentProgress = {
    visible: Boolean(visible),
    value: options.immediate ? Math.max(0, Math.min(100, Number(value) || 0)) : APP_STATE.reportConsentProgress.value,
    label: String(label || ''),
    note: String(note || ''),
    valueText: String(valueText || '')
  };
  syncReportConsentProgress();
  if (options.immediate) {
    stopProgressAnimation('report');
    return;
  }
  animateProgressValue('report', Math.max(0, Math.min(100, Number(value) || 0)));
}

function resetReportConsentProgress() {
  stopProgressAnimation('report');
  stopProgressStageRotation();
  setReportConsentProgress({
    visible: false,
    value: 0,
    label: '',
    note: '',
    valueText: ''
  }, { immediate: true });
}

function setReportConsentButtonsLoading(loading, primaryText = '數位授權並送出報告') {
  const authorizeButton = document.getElementById('report-authorize-submit');
  const saveLaterButton = document.getElementById('report-save-later');

  if (authorizeButton) {
    authorizeButton.disabled = Boolean(loading);
    authorizeButton.classList.toggle('is-loading', Boolean(loading));
    authorizeButton.textContent = loading ? primaryText : '數位授權並送出報告';
  }

  if (saveLaterButton) {
    saveLaterButton.disabled = Boolean(loading);
    saveLaterButton.classList.toggle('is-loading', Boolean(loading));
  }
}

function closeConsentPreview() {
  const overlay = document.getElementById('consent-preview-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  resetConsentPreviewState();
  resetReportConsentProgress();
}

function handleConsentPreviewScroll() {
  const scrollBody = document.getElementById('consent-preview-scroll');
  const confirmButton = document.getElementById('consent-preview-confirm');
  if (!scrollBody || !confirmButton || APP_STATE.pendingConsent.canConfirm) return;
  const nearBottom = scrollBody.scrollTop + scrollBody.clientHeight >= scrollBody.scrollHeight - 24;
  if (nearBottom) {
    APP_STATE.pendingConsent.canConfirm = true;
    confirmButton.disabled = false;
    confirmButton.textContent = '同意送出';
  }
}

async function openConsentPreview() {
  if (APP_STATE.isSending) return;

  APP_STATE.isSending = true;
  clearMicroInterventionCard();
  closeMicroInterventionDetail();
  setTyping(true);
  setReportConsentButtonsLoading(true, '正在準備中...');
  setReportConsentProgress({
    visible: true,
    value: 8,
    label: '正在初始化授權預覽...',
    note: '先建立這次授權預覽的工作狀態。',
    valueText: '初始化中'
  });
  appendSystemNotice('正在準備授權預覽...');
  setConsentPreviewProgress(8, '正在初始化授權預覽...', '初始化中');

  try {
    const existingFhirDraft = getExistingFhirDraft();
    setReportConsentProgress({
      visible: true,
      value: 18,
      label: '正在同步目前對話狀態...',
      note: '先確認最新的對話內容與模式狀態。',
      valueText: '同步中'
    });
    setConsentPreviewProgress(18, '正在同步目前對話狀態...', '同步中');
    setReportConsentProgress({
      visible: true,
      value: 36,
      label: '正在整理可授權的 session export...',
      note: '抓取這次對話的摘要與病人授權內容。',
      valueText: '整理中'
    });
    setConsentPreviewProgress(36, '正在整理可授權的 session export...', '整理中');
    startProgressStageRotation([
      { visible: true, value: 36, label: '正在整理可授權的 session export...', note: '抓取這次對話的摘要與病人授權內容。', valueText: '整理中' },
      { visible: true, value: 48, label: '正在比對這次對話脈絡...', note: '把最近對話內容對齊到授權預覽格式。', valueText: '比對中' },
      { visible: true, value: 58, label: '正在檢查可送出欄位...', note: '確認這次授權需要的欄位都已備齊。', valueText: '檢查中' }
    ]);
    const sessionPayload = await fetchOutputPayload('session_export', '準備授權預覽所需的 session export');
    stopProgressStageRotation();
    setReportConsentProgress({
      visible: true,
      value: 48,
      label: '正在確認 FHIR 送出端點...',
      note: '確認這次預覽預計送往哪個 FHIR 端點。',
      valueText: '確認中'
    });
    setConsentPreviewProgress(48, '正在確認 FHIR 送出端點...', '確認中');
    const deliveryTargetUrl = await fetchDeliveryTargetUrl();
    const sessionExport = prepareSessionExportForDelivery(sessionPayload.session_export || {}, deliveryTargetUrl);
    sessionExport.__deliveryTargetUrl = deliveryTargetUrl;
    let fhirDraft;

    if (existingFhirDraft) {
      setReportConsentProgress({
        visible: true,
        value: 66,
        label: '正在載入已生成的 FHIR 草稿...',
        note: '這次直接重用目前報表頁上的 FHIR 草稿，不再重新生成。',
        valueText: '載入中'
      });
      setConsentPreviewProgress(66, '正在載入已生成的 FHIR 草稿...', '載入中');
      fhirDraft = existingFhirDraft;
    } else {
      setReportConsentProgress({
        visible: true,
        value: 68,
        label: '正在建立 FHIR 草稿預覽...',
        note: 'FHIR 草稿需要額外生成，通常會再多花幾秒。',
        valueText: '生成中'
      });
      setConsentPreviewProgress(68, '正在建立 FHIR 草稿預覽...', '生成中');
      startProgressStageRotation([
        { visible: true, value: 68, label: '正在建立 FHIR 草稿預覽...', note: 'FHIR 草稿需要額外生成，通常會再多花幾秒。', valueText: '生成中' },
        { visible: true, value: 79, label: '正在整理 Observation 與摘要...', note: '把對話內容轉成可交付的 FHIR 結構。', valueText: '轉換中' },
        { visible: true, value: 89, label: '正在補齊預覽資訊...', note: '把草稿內容整理成你即將看到的授權預覽。', valueText: '補齊中' }
      ]);
      const fhirPayload = await fetchOutputPayload('fhir_delivery', '準備授權預覽所需的 FHIR draft');
      stopProgressStageRotation();
      fhirDraft = normalizeFhirDraftPayload({
        output: JSON.parse(JSON.stringify(fhirPayload.output || {}))
      }).output;
    }

    setReportConsentProgress({
      visible: true,
      value: 82,
      label: '正在整理預覽內容...',
      note: '把 session export 與 FHIR 草稿整合成你即將看到的預覽。',
      valueText: '整合中'
    });
    setConsentPreviewProgress(82, '正在整理預覽內容...', '整合中');

    if (!sessionExport.session?.encounterKey) {
      throw new Error('目前還沒有可送出的對話資料，請先完成至少一輪對話。');
    }

    APP_STATE.pendingConsent.sessionExport = sessionExport;
    APP_STATE.pendingConsent.fhirDraft = fhirDraft;
    APP_STATE.pendingConsent.deliveryResult = null;
    APP_STATE.pendingConsent.deliveryTargetUrl = deliveryTargetUrl;
    APP_STATE.pendingConsent.canConfirm = false;

    const previewBody = document.getElementById('consent-preview-body');
    const overlay = document.getElementById('consent-preview-overlay');
    const confirmButton = document.getElementById('consent-preview-confirm');
    const scrollBody = document.getElementById('consent-preview-scroll');

    if (previewBody) {
      previewBody.innerHTML = buildConsentPreviewHtml(sessionExport, fhirDraft);
    }
    if (confirmButton) {
      APP_STATE.pendingConsent.canConfirm = true;
      confirmButton.disabled = false;
      confirmButton.textContent = '同意送出';
    }
    if (scrollBody) {
      scrollBody.scrollTop = 0;
    }
    if (overlay) {
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
    }
    setReportConsentProgress({
      visible: false,
      value: 100,
      label: '授權預覽已就緒',
      note: '',
      valueText: '完成'
    });
    setConsentPreviewProgress(100, '授權預覽已就緒，可以直接送出', '完成');
  } catch (error) {
    stopProgressStageRotation();
    setReportConsentProgress({
      visible: true,
      value: 100,
      label: '授權預覽準備失敗',
      note: '請稍後再試一次，或先確認目前已有對話內容可送出。',
      valueText: '失敗'
    });
    setConsentPreviewProgress(100, '授權預覽準備失敗', '失敗');
    await appendMessage('ai', error.message || '目前無法打開授權預覽。', { animate: true });
  } finally {
    setTyping(false);
    APP_STATE.isSending = false;
    setReportConsentButtonsLoading(false);
  }
}

function initializeRuntimeConfig() {
  localStorage.removeItem(LEGACY_LOCAL_SESSION_ARCHIVE_KEY);
  if (!localStorage.getItem('rourou.userId')) {
    localStorage.setItem('rourou.userId', DEFAULT_USER_ID);
  }
  APP_STATE.userId = localStorage.getItem('rourou.userId') || DEFAULT_USER_ID;

  if (!localStorage.getItem('rourou.fhirRealtimeSync')) {
    localStorage.setItem('rourou.fhirRealtimeSync', 'false');
  }

  if (!localStorage.getItem('rourou.autoReportDraft')) {
    localStorage.setItem('rourou.autoReportDraft', 'false');
  }
}

async function fetchOutputPayload(outputType, instructionOverride = '') {
  await ensureModeSynced();
  const config = getRuntimeConfig();
  const conversationState = buildConversationRequestState();
  const response = await fetch('/api/chat/output', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationState.conversation_id,
      force_new_session: conversationState.force_new_session,
      therapeutic_profile: conversationState.therapeutic_profile,
      user: config.userId,
      output_type: outputType,
      instruction: instructionOverride || (OUTPUT_DEFINITIONS[outputType]?.instruction || outputType),
      ...buildRuntimeRequestConfig(config)
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(formatChatError(payload));
  }
  finalizeConversationRequest(payload);
  APP_STATE.lastChatMetadata = payload.metadata || APP_STATE.lastChatMetadata;
  return payload;
}

async function ensureModeSynced() {
  const mode = MODE_DEFINITIONS[APP_STATE.selectedMode] || MODE_DEFINITIONS.natural;
  if (!mode.command || APP_STATE.syncedMode === mode.command) {
    return;
  }

  const config = getRuntimeConfig();
  const conversationState = buildConversationRequestState();
  const response = await fetch('/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: mode.command,
        conversation_id: conversationState.conversation_id,
        force_new_session: conversationState.force_new_session,
        therapeutic_profile: conversationState.therapeutic_profile,
        user: config.userId,
        ...buildRuntimeRequestConfig(config),
        hide_response: true
      })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || '模式同步失敗');
  }

  finalizeConversationRequest(payload);
  APP_STATE.syncedMode = mode.command;
  APP_STATE.runtimeMode = payload.metadata?.active_mode || APP_STATE.runtimeMode;
  updateModeLabels();
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  if (!input || APP_STATE.isSending) return;

  const message = input.value.trim();
  if (!message) return;

  const outputType = detectOutputCommand(message);
  if (outputType) {
    clearMicroInterventionCard();
    closeMicroInterventionDetail();
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
    const directPreferenceReply = buildPreferenceRecallReply(message);
    if (directPreferenceReply) {
      setTyping(false);
      await appendMessage('ai', directPreferenceReply, { animate: true });
      return;
    }

    setThinkingState(true, '正在分析對話脈絡...');
    await new Promise(r => setTimeout(r, 1200));
    setThinkingState(true, '同步臨床歷史紀錄...');
    await new Promise(r => setTimeout(r, 800));

    await ensureModeSynced();

    setThinkingState(true, '正在生成暖心回覆...');
    const config = getRuntimeConfig();
    const conversationState = buildConversationRequestState();
    const userPromptContext = buildUserPromptContextString();
    const memoryContext = TherapeuticMemory.buildContextString();
    const contextParts = [userPromptContext, memoryContext].filter(Boolean);
    const messageWithMemory = contextParts.length ? `${contextParts.join('\n\n')}\n\n用戶說：${message}` : message;
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageWithMemory,
        raw_message: message,
        conversation_id: conversationState.conversation_id,
        force_new_session: conversationState.force_new_session,
        therapeutic_profile: conversationState.therapeutic_profile,
        user: config.userId,
        ...buildRuntimeRequestConfig(config)
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(formatChatError(payload));
    }

    finalizeConversationRequest(payload);
    APP_STATE.lastChatMetadata = payload.metadata || null;
    APP_STATE.reportOutputs.session_export = payload.session_export || APP_STATE.reportOutputs.session_export;
    APP_STATE.runtimeMode = payload.metadata?.active_mode || APP_STATE.runtimeMode;
    syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
    syncTherapeuticMemoryFromSessionExport(APP_STATE.reportOutputs.session_export);
    APP_STATE.turnCount++;
    updateModeLabels();
    renderReportOutputs();
    setTyping(false);
    await appendMessage('ai', payload.answer || '我有收到你的訊息，但這次沒有拿到完整回覆。', { animate: true });
    saveCurrentSessionToLocalArchive();
    evaluateMicroIntervention(payload, { lastUserMessage: message });

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
    const conversationState = buildConversationRequestState();
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
        raw_message: '',
        hide_response: true,
        conversation_id: conversationState.conversation_id,
        force_new_session: conversationState.force_new_session,
        therapeutic_profile: conversationState.therapeutic_profile,
        user: config.userId,
        ...buildRuntimeRequestConfig(config)
      })
    });

    if (!response.ok) return;
    const payload = await response.json();
    finalizeConversationRequest(payload);
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

/* ══════════════════════════════════════════════
   LAYER 4: FHIR Therapeutic Memory Integration
   把心理畫像序列化為 FHIR Observation 資源
   ══════════════════════════════════════════════ */
function buildProfileFhirObservations(profile, patientRef) {
  const ref = patientRef || `Patient/${profile.userId || 'unknown'}`;
  const now = new Date().toISOString();
  const entries = [];

  const makeObs = (code, display, valueString, category) => ({
    resourceType: 'Observation',
    status: 'final',
    meta: {
      profile: ['https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-screening-assessment-twcore']
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: category || 'social-history',
        display: category === 'survey' ? 'Survey' : 'Social History'
      }]
    }],
    code: {
      coding: [{
        system: 'https://example.org/fhir/CodeSystem/ai-companion-therapeutic-memory',
        code,
        display
      }],
      text: display
    },
    subject: { reference: ref },
    effectiveDateTime: now,
    valueString,
    method: { text: 'AI Companion Therapeutic Memory - auto extracted from conversation' }
  });

  // 1. 壓力來源
  if (profile.stressors && profile.stressors.length) {
    const stressorValue = profile.stressors
      .map(s => `${s.label}（信心度 ${Math.round((s.confidence || 0.6) * 100)}%）`)
      .join('；');
    entries.push(makeObs('psychosocial-stressor', '心理社會壓力來源', stressorValue, 'social-history'));
  }

  // 2. 情緒觸發點
  if (profile.triggers && profile.triggers.length) {
    const triggerValue = profile.triggers
      .map(t => `「${t.keyword}」→ ${t.reaction || '情緒反應'}（${t.severity || 'medium'}）`)
      .join('；');
    entries.push(makeObs('emotional-trigger', '情緒觸發點', triggerValue, 'social-history'));
  }

  // 3. 溝通偏好
  if (profile.copingProfile && profile.copingProfile.preferredStyle) {
    entries.push(makeObs('comms-preference', '溝通偏好風格', profile.copingProfile.preferredStyle, 'social-history'));
  }

  // 4. 正向紓壓資源
  if (profile.positiveAnchors && profile.positiveAnchors.length) {
    const anchorValue = profile.positiveAnchors.map(a => a.label).join('、');
    entries.push(makeObs('coping-resource', '正向紓壓資源', anchorValue, 'social-history'));
  }

  // 5. 核心主題
  if (profile.keyThemes && profile.keyThemes.length) {
    entries.push(makeObs('clinical-impression', '臨床印象主題', profile.keyThemes.join('；'), 'survey'));
  }

  // 6. AI 對話次數（可追蹤醫療連續性）
  if (profile.sessionCount > 0) {
    entries.push(makeObs('ai-session-count', 'AI 陪伴對話次數', `${profile.sessionCount} 次`, 'social-history'));
  }

  return entries;
}

function attachProfileToFhirResult(fhirPayload) {
  const profile = TherapeuticMemory.get();
  const totalItems = profile.stressors.length + profile.triggers.length + profile.positiveAnchors.length;
  if (!totalItems) return fhirPayload; // 沒有記憶資料就不附加

  const profileObservations = buildProfileFhirObservations(profile);
  if (!profileObservations.length) return fhirPayload;

  // 附加到 fhir_delivery 結果中（前端顯示用）
  const enhanced = Object.assign({}, fhirPayload);
  enhanced.therapeutic_memory_observations = profileObservations;
  enhanced.therapeutic_memory_summary = {
    stressors: profile.stressors.map(s => s.label),
    triggers: profile.triggers.map(t => t.keyword),
    positiveAnchors: profile.positiveAnchors.map(a => a.label),
    commsPreference: profile.copingProfile.preferredStyle,
    sessionCount: profile.sessionCount,
    lastUpdated: profile.lastUpdatedAt
  };
  enhanced.narrative_summary = [
    enhanced.narrative_summary || '',
    '',
    '【心理畫像摘要（Therapeutic Memory）】',
    profile.stressors.length ? `壓力來源：${profile.stressors.map(s => s.label).join('、')}` : '',
    profile.triggers.length ? `情緒觸發點：${profile.triggers.map(t => `「${t.keyword}」`).join(' ')}` : '',
    profile.copingProfile.preferredStyle ? `溝通偏好：${profile.copingProfile.preferredStyle}` : '',
    profile.positiveAnchors.length ? `正向錨點：${profile.positiveAnchors.map(a => a.label).join('、')}` : '',
    `AI 陪伴次數：${profile.sessionCount} 次`
  ].filter(Boolean).join('\n');

  const obsCount = (Array.isArray(fhirPayload.resources) ? fhirPayload.resources.length : 0) + profileObservations.length;
  enhanced.resources = (Array.isArray(fhirPayload.resources) ? fhirPayload.resources : []).concat(
    profileObservations.map((obs, i) => ({ type: 'Observation', code: obs.code.coding[0].code, display: obs.code.text }))
  );
  return enhanced;
}

function saveUserPrompt(textarea) {
  APP_STATE.aiSettings.userPrompt = textarea.value;
  localStorage.setItem('rourou.userPrompt', textarea.value);
}


async function requestOutput(outputType, options = {}) {
  if (APP_STATE.isSending) return;
  const definition = OUTPUT_DEFINITIONS[outputType] || { label: outputType, instruction: outputType };
  APP_STATE.isSending = true;
  clearMicroInterventionCard();
  closeMicroInterventionDetail();
  appendSystemNotice(`正在產生 ${definition.label}...`);
  setTyping(true);

  try {
    const payload = await fetchOutputPayload(outputType, definition.instruction);

    // Layer 4：FHIR Draft 附加心理畫像 Observations
    let finalPayload = payload;
    if (outputType === 'fhir_delivery') {
      finalPayload = normalizeFhirDraftPayload(payload);
      APP_STATE.reportFhirDraft = {
        isLoading: false,
        error: '',
        emptyReason: ''
      };
      const profileObs = finalPayload.output?.therapeutic_memory_observations || [];
      if (profileObs.length) {
        appendSystemNotice(`心理畫像已附加至 FHIR Draft（${profileObs.length} 個 Observation）🧠`);
      }
    }

    storeOutputResult(finalPayload);
    evaluateMicroIntervention(finalPayload, { fromOutput: true });
    setTyping(false);
    appendSystemNotice(`${definition.label} 已更新，請到 Reports 查看。`);
    if (options.fromChatCommand || options.fromShortcut) {
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

async function authorizeAndSendReport() {
  if (APP_STATE.isSending) return;
  if (!APP_STATE.pendingConsent.sessionExport) {
    await openConsentPreview();
    return;
  }
  if (!APP_STATE.pendingConsent.canConfirm) {
    appendSystemNotice('請先滑到最下方，再按同意送出。');
    return;
  }

  APP_STATE.isSending = true;
  clearMicroInterventionCard();
  closeMicroInterventionDetail();
  setTyping(true);
  appendSystemNotice('正在送出你已確認的 FHIR 內容...');
  setConsentPreviewProgress(10, '正在鎖定送出內容...', '準備中');
  const confirmButton = document.getElementById('consent-preview-confirm');
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.textContent = '送出中...';
  }

  let deliveryPayload = null;
  let needsPostDeliveryRefresh = false;
  try {
    const sessionExport = prepareSessionExportForDelivery(
      APP_STATE.pendingConsent.sessionExport || {},
      APP_STATE.pendingConsent.deliveryTargetUrl || ''
    );
    if (!sessionExport.session?.encounterKey) {
      throw new Error('目前還沒有可送出的對話資料，請先完成至少一輪對話。');
    }

    sessionExport.patient_authorization_state = Object.assign(
      {},
      sessionExport.patient_authorization_state || {},
      {
        authorization_status: 'patient_authorized_manual_submit',
        share_with_clinician: 'yes',
        consent_note: `Manually authorized in UI at ${new Date().toISOString()}`
      }
    );

    setConsentPreviewProgress(26, '正在檢查送出內容...', '檢查中');
    setConsentPreviewProgress(54, '正在呼叫 FHIR 送出端點...', '送出中');
    const response = await fetch('/api/fhir/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionExport)
    });
    const payload = await response.json();
    deliveryPayload = payload;
    rememberFhirDeliveryDebug({
      phase: 'response',
      responseOk: response.ok,
      httpStatus: response.status,
      deliveryStatus: payload?.delivery_status || '',
      error: extractFhirDeliveryError(payload),
      responseBody: payload,
      encounterKey: sessionExport?.session?.encounterKey || '',
      patientKey: sessionExport?.patient?.key || ''
    });

    if (!response.ok) {
      throw new Error(extractFhirDeliveryError(payload));
    }

    setConsentPreviewProgress(78, '正在接收伺服器回應...', '接收中');
    setConsentPreviewProgress(90, '正在整理送出結果...', '整理中');
    const deliveryStatus = payload.delivery_status || 'unknown';
    payload.recorded_at = payload.recorded_at || new Date().toISOString();
    APP_STATE.pendingConsent.deliveryResult = payload;
    APP_STATE.reportOutputs.fhir_delivery_result = payload;
    APP_STATE.reportOutputs.updatedAt = formatTimeLabel(new Date());
    recordFhirDeliveryHistory(
      payload,
      APP_STATE.reportOutputs.fhir_delivery || APP_STATE.pendingConsent.fhirDraft || null,
      APP_STATE.pendingConsent.sessionExport || APP_STATE.reportOutputs.session_export || null
    );
    needsPostDeliveryRefresh = deliveryStatus === 'delivered' || deliveryStatus === 'dry_run_ready';
    if (deliveryStatus === 'dry_run_ready') {
      setConsentPreviewProgress(100, '已完成授權，但目前為 dry-run', '完成');
      appendSystemNotice('已完成手動授權，但目前後端尚未設定 FHIR_SERVER_URL，所以這次只是 dry-run，尚未真正送到醫院端。');
    } else if (deliveryStatus === 'delivered') {
      const patientLink = findFhirResourceLink(payload, 'Patient');
      setConsentPreviewProgress(100, 'FHIR 報告已成功送出', '完成');
      appendSystemNotice(patientLink
        ? `已手動授權並成功送出 FHIR 報告。Patient ID：${patientLink.label}`
        : '已手動授權並成功送出 FHIR 報告。');
    } else {
      setConsentPreviewProgress(100, `送出完成，目前狀態：${deliveryStatus}`, '完成');
      appendSystemNotice(`手動授權流程已完成，目前狀態：${deliveryStatus}`);
    }
  } catch (error) {
    const deliveredStatus = deliveryPayload?.delivery_status;
    if (deliveredStatus === 'delivered' || deliveredStatus === 'dry_run_ready') {
      needsPostDeliveryRefresh = true;
      console.error('FHIR delivery succeeded, but post-send UI sync failed.', error);
      rememberFhirDeliveryDebug({
        phase: 'post_delivery_ui_sync_failed',
        responseOk: true,
        httpStatus: deliveryPayload?.transaction_response?.status || 200,
        deliveryStatus: deliveredStatus,
        error: error.message || 'Unknown UI sync failure',
        responseBody: deliveryPayload
      });
      appendSystemNotice(`FHIR 已完成送出，但畫面同步時發生錯誤：${error.message || '未知錯誤'}`);
      return;
    }

    rememberFhirDeliveryDebug({
      phase: 'request_failed',
      responseOk: false,
      httpStatus: deliveryPayload?.transaction_response?.status || 0,
      deliveryStatus: deliveredStatus || '',
      error: error.message || 'Unknown FHIR delivery failure',
      responseBody: deliveryPayload
    });
    setConsentPreviewProgress(100, '送出失敗，請再試一次', '失敗');
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.textContent = '重新送出';
    }
    await appendMessage('ai', error.message || '目前無法送出 FHIR 報告。', { animate: true });
  } finally {
    if (needsPostDeliveryRefresh) {
      try {
        renderReportOutputs();
        showScreen('screen-report');
        switchReportTab('auto');
        switchAutoAudience('doctor');
        closeConsentPreview();
      } catch (uiError) {
        console.error('Report UI refresh failed after successful delivery.', uiError);
        appendSystemNotice(`FHIR 已送出，但報表畫面更新失敗：${uiError.message || '未知錯誤'}`);
      }
    }
    setTyping(false);
    APP_STATE.isSending = false;
  }
}

function saveReportForLater() {
  closeConsentPreview();
  appendSystemNotice('這份報告已標記為稍後再送。系統目前不會自動上傳 FHIR。');
}

function deleteFhirDraft() {
  const hasDraftContent = Boolean(
    APP_STATE.reportOutputs.fhir_delivery ||
    APP_STATE.reportOutputs.fhir_delivery_result ||
    APP_STATE.pendingConsent?.fhirDraft ||
    APP_STATE.pendingConsent?.deliveryResult
  );
  if (!hasDraftContent) {
    appendSystemNotice('目前沒有可刪除的 FHIR 草稿。');
    return;
  }

  const confirmed = window.confirm('要清除目前這份 FHIR 草稿嗎？這只會刪除本地草稿與連結顯示，不會刪除 HAPI 上已建立的資源。');
  if (!confirmed) return;

  APP_STATE.reportOutputs.fhir_delivery = null;
  APP_STATE.reportOutputs.fhir_delivery_result = null;
  APP_STATE.pendingConsent.fhirDraft = null;
  APP_STATE.pendingConsent.deliveryResult = null;
  APP_STATE.pendingConsent.sessionExport = null;
  APP_STATE.reportFhirDraft = {
    isLoading: false,
    error: '',
    emptyReason: 'FHIR 草稿已刪除。需要時可以重新生成。'
  };

  renderReportOutputs();
  appendSystemNotice('已刪除目前這份 FHIR 草稿。');
}

function toggleFhirResourceLinks(button) {
  if (!button) return;
  const section = button.closest('.fhir-link-section');
  if (!section) return;
  const isExpanded = section.classList.toggle('expanded');
  button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
}

function selectVoiceStyle(style, element) {
  APP_STATE.aiSettings.voiceStyle = style;
  localStorage.setItem('rourou.voiceStyle', style);
  if (element && element.parentNode) {
    element.parentNode.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
  }
}

function toggleInteractionSensing(input) {
  APP_STATE.aiSettings.interactionSensing = input.checked;
  localStorage.setItem('rourou.interactionSensing', input.checked ? 'true' : 'false');
}

function checkSensitiveContent(text) {
  if (!APP_STATE.aiSettings.interactionSensing) return false;
  const risks = ['不想活', '自殺', '死掉', '結束生命', '傷害自', '傷人', '自殘'];
  return risks.some(r => text.includes(r));
}

function updateSettingsUI() {
  // Voice Style
  const voiceGroup = document.getElementById('settings-voice-style');
  if (voiceGroup) {
    const activeStyle = APP_STATE.aiSettings.voiceStyle;
    voiceGroup.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-style') === activeStyle);
    });
  }

  // Default Mode
  const modeName = document.getElementById('settings-mode-name');
  const modeIcon = document.getElementById('settings-mode-icon');
  const modeDef = MODE_DEFINITIONS[APP_STATE.selectedMode] || MODE_DEFINITIONS.natural;
  if (modeName) modeName.textContent = modeDef.label;
  if (modeIcon) {
    modeIcon.textContent = modeDef.icon || 'auto_awesome';
    if (modeDef.icon === 'favorite') modeIcon.classList.add('fill');
    else modeIcon.classList.remove('fill');
  }

  // Sensing Toggle
  const sensingToggle = document.getElementById('settings-interaction-sensing');
  if (sensingToggle) sensingToggle.checked = APP_STATE.aiSettings.interactionSensing;
}

function wirePrivacyControls() {
  const realtimeToggle = document.getElementById('fhir-realtime-sync-toggle');
  const autoDraftToggle = document.getElementById('auto-report-draft-toggle');
  const authorizeButton = document.getElementById('report-authorize-submit');
  const saveLaterButton = document.getElementById('report-save-later');
  const settings = getPrivacySettings();

  if (realtimeToggle) {
    realtimeToggle.checked = settings.fhirRealtimeSync;
    if (!realtimeToggle.dataset.wired) {
      realtimeToggle.dataset.wired = 'true';
      realtimeToggle.addEventListener('change', (event) => {
        savePrivacySettings({ fhirRealtimeSync: Boolean(event.target.checked) });
        if (event.target.checked) {
          appendSystemNotice('已記住你的偏好，但目前系統仍只支援手動授權送出，不會自動上傳。');
        } else {
          appendSystemNotice('已關閉即時同步。FHIR 只會在你手動授權後送出。');
        }
      });
    }
  }

  if (autoDraftToggle) {
    autoDraftToggle.checked = settings.autoReportDraft;
    if (!autoDraftToggle.dataset.wired) {
      autoDraftToggle.dataset.wired = 'true';
      autoDraftToggle.addEventListener('change', (event) => {
        savePrivacySettings({ autoReportDraft: Boolean(event.target.checked) });
        appendSystemNotice(event.target.checked ? '已開啟需要時準備醫師摘要草稿。' : '已關閉自動報告草稿提示。');
      });
    }
  }

  if (authorizeButton && !authorizeButton.dataset.wired) {
    authorizeButton.dataset.wired = 'true';
    authorizeButton.addEventListener('click', openConsentPreview);
  }

  if (saveLaterButton && !saveLaterButton.dataset.wired) {
    saveLaterButton.dataset.wired = 'true';
    saveLaterButton.addEventListener('click', saveReportForLater);
  }

  const consentOverlay = document.getElementById('consent-preview-overlay');
  const consentScroll = document.getElementById('consent-preview-scroll');
  const confirmButton = document.getElementById('consent-preview-confirm');

  if (consentOverlay && !consentOverlay.dataset.wired) {
    consentOverlay.dataset.wired = 'true';
    consentOverlay.addEventListener('click', (event) => {
      if (event.target === consentOverlay) {
        closeConsentPreview();
      }
    });
  }

  if (consentScroll && !consentScroll.dataset.wired) {
    consentScroll.dataset.wired = 'true';
    consentScroll.addEventListener('scroll', handleConsentPreviewScroll, { passive: true });
  }

  if (confirmButton && !confirmButton.dataset.wired) {
    confirmButton.dataset.wired = 'true';
    confirmButton.addEventListener('click', authorizeAndSendReport);
  }
}

function wireShortcutInteractions() {
  const viewport = document.getElementById('shortcut-pages');
  if (viewport && !viewport.dataset.wired) {
    viewport.dataset.wired = 'true';
    viewport.addEventListener('scroll', updateShortcutPagerState, { passive: true });
    viewport.addEventListener('click', (event) => {
      const addButton = event.target.closest('.shortcut-fab, .shortcut-empty-add-btn');
      if (addButton) {
        event.preventDefault();
        event.stopPropagation();
        openShortcutComposer();
        return;
      }
      const deleteButton = event.target.closest('.shortcut-delete-btn');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        removeCustomShortcut(Number(deleteButton.dataset.index));
        return;
      }
      if (viewport.dataset.suppressClick === 'true') {
        viewport.dataset.suppressClick = 'false';
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const button = event.target.closest('.shortcut-chip');
      if (!button) return;
      activateShortcut(button.dataset.command || '');
    });

    const dragState = {
      active: false,
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
      moved: false
    };

    viewport.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (
        event.target.closest('.shortcut-chip') ||
        event.target.closest('.shortcut-delete-btn') ||
        event.target.closest('.shortcut-fab') ||
        event.target.closest('.shortcut-empty-add-btn') ||
        event.target.closest('.shortcut-collapse-btn')
      ) return;
      dragState.active = true;
      dragState.pointerId = event.pointerId;
      dragState.startX = event.clientX;
      dragState.startScrollLeft = viewport.scrollLeft;
      dragState.moved = false;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture?.(event.pointerId);
    });

    viewport.addEventListener('pointermove', (event) => {
      if (!dragState.active || dragState.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - dragState.startX;
      if (Math.abs(deltaX) > 6) {
        dragState.moved = true;
      }
      viewport.scrollLeft = dragState.startScrollLeft - deltaX;
    });

    const endDrag = (event) => {
      if (!dragState.active || dragState.pointerId !== event.pointerId) return;
      dragState.active = false;
      viewport.classList.remove('is-dragging');
      viewport.releasePointerCapture?.(event.pointerId);
      if (dragState.moved) {
        viewport.dataset.suppressClick = 'true';
        snapShortcutPager();
      }
    };

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
  }

  const composer = document.getElementById('shortcut-composer');
  if (composer && !composer.dataset.wired) {
    composer.dataset.wired = 'true';
    composer.addEventListener('click', (event) => {
      if (event.target === composer) {
        closeShortcutComposer();
      }
    });
  }
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
            <option value="openrouter">OpenRouter</option>
          </select>
          <input id="ai-base-url" type="text" placeholder="https://generativelanguage.googleapis.com/v1beta" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="ai-model" type="text" placeholder="gemini-2.0-flash" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="ai-api-key" type="password" placeholder="AIza... / gsk_..." style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="ai-user-id" type="text" placeholder="user id" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <button id="save-ai-engine-config" class="cta-primary with-icon" type="button">儲存聊天引擎設定</button>
        </div>
        <p style="font-size:12px;color:#64727a;line-height:1.6;margin-top:12px">
          這裡設定模型 provider、base URL、model、API key 與 user id。若 API key 留空，系統會優先使用部署端預設金鑰與模型設定。
        </p>
      </div>
    </div>
  `;

  settingsMain.insertBefore(wrapper, settingsMain.firstChild);

  syncRuntimeSettingsForm();

  document.getElementById('ai-provider').addEventListener('change', (event) => {
    const provider = event.target.value;
    document.getElementById('ai-base-url').value = provider === 'google' ? DEFAULT_GOOGLE_BASE_URL : provider === 'openrouter' ? DEFAULT_OPENROUTER_BASE_URL : DEFAULT_GROQ_BASE_URL;
    document.getElementById('ai-model').value = provider === 'google' ? 'gemini-2.0-flash' : provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : 'llama-3.1-8b-instant';
  });

  document.getElementById('save-ai-engine-config').addEventListener('click', () => {
    const serverConfig = getServerRuntimeConfig();
    const provider = document.getElementById('ai-provider').value.trim() || serverConfig.provider;
    const defaults = getProviderDefaults(provider);
    const apiBaseUrl = document.getElementById('ai-base-url').value.trim() || defaults.apiBaseUrl;
    const model = document.getElementById('ai-model').value.trim() || defaults.model;
    const apiKey = document.getElementById('ai-api-key').value.trim();
    localStorage.setItem('rourou.userId', document.getElementById('ai-user-id').value.trim() || APP_STATE.userId);
    APP_STATE.userId = localStorage.getItem('rourou.userId') || APP_STATE.userId;
    const useServerDefault = !apiKey && provider === serverConfig.provider && apiBaseUrl === serverConfig.apiBaseUrl && model === serverConfig.model;
    if (useServerDefault) {
      localStorage.removeItem(RUNTIME_CONFIG_SOURCE_KEY);
      localStorage.removeItem('rourou.aiProvider');
      localStorage.removeItem('rourou.aiBaseUrl');
      localStorage.removeItem('rourou.aiModel');
      localStorage.removeItem('rourou.aiApiKey');
    } else {
      localStorage.setItem(RUNTIME_CONFIG_SOURCE_KEY, 'custom');
      localStorage.setItem('rourou.aiProvider', provider);
      localStorage.setItem('rourou.aiBaseUrl', apiBaseUrl);
      localStorage.setItem('rourou.aiModel', model);
      localStorage.setItem('rourou.aiApiKey', apiKey);
    }
    APP_STATE.syncedMode = '';
    syncRuntimeSettingsForm();
    appendSystemNotice(useServerDefault ? '已恢復為部署端預設 AI 設定。' : '聊天引擎設定已更新。之後送出的訊息會走你目前儲存的自訂設定。');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeRuntimeConfig();
  showScreen('screen-home');
  wireHomeGuide();
  wireHomeSessionControls();
  updateModeLabels();
  injectRuntimeSettings();
  await loadServerRuntimeConfig();
  renderShortcutPager();
  wireShortcutInteractions();
  renderReportOutputs();
  switchAutoAudience(APP_STATE.currentWeeklyAudience);
  TherapeuticMemory.renderProfileUI();
  clearMicroInterventionCard();
  closeMicroInterventionDetail();
  wirePrivacyControls();
  syncRealTimeLabels();
  updateShortcutPagerState();
  const userPromptArea = document.getElementById('settings-user-prompt');
  if (userPromptArea) {
    userPromptArea.value = APP_STATE.aiSettings.userPrompt;
  }

  // Keep time updated
  setInterval(syncRealTimeLabels, 30000);
  updateScrollSafeArea();

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => updateScrollSafeArea());
    document.querySelectorAll('.input-section, .bottom-nav, .top-bar').forEach((node) => {
      resizeObserver.observe(node);
    });
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateScrollSafeArea);
  }

  window.addEventListener('resize', updateScrollSafeArea);
});

window.showScreen = showScreen;
window.switchReportTab = switchReportTab;
window.toggleMoodTag = toggleMoodTag;
window.setPHQ = setPHQ;
window.handleInput = handleInput;
window.selectMode = selectMode;
window.startChat = startChat;
window.sendQuickReply = sendQuickReply;
window.activateShortcut = activateShortcut;
window.sendMessage = sendMessage;
window.requestOutput = requestOutput;
window.switchAutoAudience = switchAutoAudience;
window.toggleModeExplainer = toggleModeExplainer;
window.openMicroIntervention = openMicroIntervention;
window.closeMicroInterventionDetail = closeMicroInterventionDetail;
window.dismissMicroIntervention = dismissMicroIntervention;
window.openShortcutComposer = openShortcutComposer;
window.closeShortcutComposer = closeShortcutComposer;
window.submitShortcutComposer = submitShortcutComposer;
window.removeCustomShortcut = removeCustomShortcut;
window.saveModeSettings = saveModeSettings;
window.refreshModeListUI = refreshModeListUI;
window.openConsentPreview = openConsentPreview;
window.authorizeAndSendReport = authorizeAndSendReport;
window.saveReportForLater = saveReportForLater;
window.deleteFhirDraft = deleteFhirDraft;
window.removeFhirHistoryEntry = removeFhirHistoryEntry;
window.removeFhirHistoryResource = removeFhirHistoryResource;
window.toggleFhirResourceLinks = toggleFhirResourceLinks;
window.closeConsentPreview = closeConsentPreview;
window.saveUserPrompt = saveUserPrompt;
window.closeShortcutBar = closeShortcutBar;

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
