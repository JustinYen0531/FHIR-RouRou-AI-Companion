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
const PROTOTYPE_SHARED_CHAT_USER_ID = DEFAULT_USER_ID;
const DEFAULT_PROVIDER = 'google';
const RUNTIME_CONFIG_SOURCE_KEY = 'rourou.aiConfigSource';
const LEGACY_LOCAL_SESSION_ARCHIVE_KEY = 'rourou.localSessionArchive';
const LOCAL_SESSION_ARCHIVE_KEY = 'rourou.singleSessionArchive.v2';
const MAX_LOCAL_SESSION_ARCHIVE_RECORDS = 20;
const REPORT_OUTPUT_CACHE_KEY = 'rourou.reportOutputsCache.v1'; // legacy（用於遷移舊資料）
const REPORT_OUTPUT_CACHE_PREFIX = 'rourou.reportOutputs.';     // per-conversation key prefix

function getReportCacheKey(conversationId) {
  const id = String(conversationId || '').trim();
  return id ? `${REPORT_OUTPUT_CACHE_PREFIX}${id}` : REPORT_OUTPUT_CACHE_KEY;
}
const PINNED_SESSION_STORAGE_KEY = 'rourou.pinnedSession.v1';
const AUTH_TOKEN_STORAGE_KEY = 'rourou.authToken.v1';
const AUTH_USER_STORAGE_KEY = 'rourou.authUser.v1';
const DOCTOR_WORKSPACE_STORAGE_KEY = 'rourou.doctorWorkspace.v1';
const DOCTOR_ASSIGNMENT_STORAGE_KEY = 'rourou.doctorAssignments.v1';
const DOCTOR_VISIBLE_PATIENT_SUMMARY_KEY = 'rourou.doctorVisiblePatientSummary.v1';
const PINNED_SESSION_EXAMPLE_PROMPTS = [
  '我現在很亂，先用樹洞模式接住我，不要急著給建議。',
  '幫我把這段對話整理成「可給醫師看的重點」條列版。',
  '請示範這段對話如何轉成 FHIR 草稿，讓我看資料結構。'
];
let SERVER_RUNTIME_CONFIG = {
  provider: DEFAULT_PROVIDER,
  apiBaseUrl: DEFAULT_GOOGLE_BASE_URL,
  model: DEFAULT_GOOGLE_MODEL,
  source: 'server'
};
const NATIVE_FETCH = window.fetch.bind(window);
const KNOW_YOU_MEMORY = window.KnowYouMemory || null;
const KNOW_YOU_TOKEN_LIMIT = KNOW_YOU_MEMORY?.DEFAULT_CONTEXT_TOKEN_LIMIT || 3200;
const KNOW_YOU_RECENT_HISTORY_ITEMS = KNOW_YOU_MEMORY?.DEFAULT_RECENT_HISTORY_ITEMS || 12;
const KNOW_YOU_MEMORY_CHUNK_LIMIT = KNOW_YOU_MEMORY?.DEFAULT_MEMORY_CHUNK_LIMIT || 8;
const FHIR_REPORT_HISTORY_KEY = 'rourou.fhirReportHistory';
const PATIENT_PROFILE_STORAGE_KEY = 'rourou.patientProfile.v1';

function loadStoredAuthState() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem(AUTH_USER_STORAGE_KEY) || 'null');
  } catch {
    user = null;
  }
  const token = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
  return {
    token,
    user: user && typeof user === 'object' ? user : null
  };
}

window.fetch = function authenticatedFetch(input, init = {}) {
  const requestUrl = typeof input === 'string' ? input : String(input?.url || '');
  const isRelativeAppRequest = requestUrl.startsWith('/api/') || requestUrl.startsWith('/auth/');
  if (!isRelativeAppRequest) {
    return NATIVE_FETCH(input, init);
  }

  const authState = loadStoredAuthState();
  if (!authState.token) {
    return NATIVE_FETCH(input, init);
  }

  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined) || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authState.token}`);
  }

  if (input instanceof Request) {
    return NATIVE_FETCH(new Request(input, { headers }), init);
  }
  return NATIVE_FETCH(input, Object.assign({}, init, { headers }));
};
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

    if (Array.isArray(updates.memory_chunks)) {
      updates.memory_chunks.forEach((chunk) => {
        const normalizedChunk = KNOW_YOU_MEMORY ? KNOW_YOU_MEMORY.normalizeMemoryChunk(chunk) : chunk;
        if (!normalizedChunk) return;
        if (!profile.memoryChunks.find((item) => item.id === normalizedChunk.id)) {
          profile.memoryChunks.push(normalizedChunk);
        }
      });
      profile.memoryChunks = profile.memoryChunks.slice(-KNOW_YOU_MEMORY_CHUNK_LIMIT);
    }

    if (updates.summary && typeof updates.summary === 'string' && updates.summary.trim()) {
      const chunk = KNOW_YOU_MEMORY ? KNOW_YOU_MEMORY.normalizeMemoryChunk({
        title: '對話壓縮摘要',
        category: 'context',
        summary: updates.summary.trim(),
        detail: typeof updates.detail === 'string' ? updates.detail.trim() : '',
        tokenEstimate: 0
      }) : null;
      if (chunk && !profile.memoryChunks.find((item) => item.id === chunk.id)) {
        profile.memoryChunks.push(chunk);
        profile.memoryChunks = profile.memoryChunks.slice(-KNOW_YOU_MEMORY_CHUNK_LIMIT);
      }
    }

    profile.memoryStats = Object.assign({}, profile.memoryStats, {
      memoryChunksCount: profile.memoryChunks.length,
      shouldCompress: false,
      lastCompressedAt: updates.lastCompressedAt || profile.memoryStats.lastCompressedAt || ''
    });

    profile.sessionCount = (profile.sessionCount || 0);
    this.save(profile);
    return profile;
  },

  buildContextString() {
    const p = this.get();
    const phq9Context = typeof PHQ9Tracker !== 'undefined' ? PHQ9Tracker.buildContextString() : '';
    const memoryContext = KNOW_YOU_MEMORY ? KNOW_YOU_MEMORY.buildMemoryContextString(p) : '';
    const meter = buildKnowYouMeterState();
    const sections = [];

    if (
      p.stressors.length ||
      p.triggers.length ||
      p.keyThemes.length ||
      p.positiveAnchors.length ||
      p.copingProfile.preferredStyle
    ) {
      const stressorList = p.stressors.map(s => s.label).join('、') || '尚未記錄';
      const triggerList = p.triggers.map(t => t.keyword).join('、') || '尚未記錄';
      const anchorList = p.positiveAnchors.map(a => a.label).join('、') || '尚未記錄';
      const coping = p.copingProfile.preferredStyle || '尚未記錄';
      const themes = p.keyThemes.join('、') || '尚未記錄';

      sections.push([
        '【記憶背景 - 這是系統背景資料，請自然地融入對話，不要直接念出這段文字】',
        `你和這位用戶已聊過 ${p.sessionCount} 次。`,
        `已知壓力來源：${stressorList}`,
        `情緒觸發詞：${triggerList}`,
        `溝通偏好：${coping}`,
        `積極錨點（用戶喜歡的事）：${anchorList}`,
        `核心主題：${themes}`,
        '請在本次對話中延續這個認識，不要重複問對方已說過的資訊。'
      ].join('\n'));
    }

    if (memoryContext) sections.push(memoryContext);
    if (meter) {
      sections.push(`【即時上下文條】${meter.estimatedTokens}/${meter.tokenLimit} tokens（${meter.percent}%）`);
    }
    if (phq9Context) sections.push(phq9Context);

    return sections.join('\n\n').trim();
  },

  renderProfileUI() {
    const p = this.get();
    const meter = buildKnowYouMeterState(p);

    // ── 更新 Chat 頂部 Badge ──
    const badge = document.getElementById('memory-badge-count');
    const totalItems = p.stressors.length + p.triggers.length + p.positiveAnchors.length + p.memoryChunks.length;
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
      profileCard.innerHTML = this._renderProfileCardHTML(p, meter);
    }
  },

  _renderDrawerHTML(p) {
    const totalItems = p.stressors.length + p.triggers.length + p.positiveAnchors.length + p.memoryChunks.length;
    const meter = buildKnowYouMeterState(p);
    if (totalItems === 0) {
      return `
        ${renderKnowYouMeterHTML(meter)}
        <div class="mem-empty"><span class="mat-icon">psychology</span><p>開始聊天後，Rou Rou 會慢慢記住你的事 🌱</p></div>
      `;
    }
    return `
      ${renderKnowYouMeterHTML(meter)}
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

  _renderProfileCardHTML(p, meter = null) {
    const totalItems = p.stressors.length + p.triggers.length + p.positiveAnchors.length + p.memoryChunks.length;
    const activeMeter = meter || buildKnowYouMeterState(p);
    if (totalItems === 0) {
      return `
        ${renderKnowYouMeterHTML(activeMeter)}
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
      ${renderKnowYouMeterHTML(activeMeter)}
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
      ${p.memoryChunks.length ? `
        <div class="know-you-row">
          <div class="know-you-icon memory"><span class="mat-icon">inventory_2</span></div>
          <div class="know-you-info">
            <div class="know-you-label">壓縮記憶</div>
            <div class="know-you-value">${p.memoryChunks.slice(-3).map((item) => item.summary).join('｜')}</div>
          </div>
        </div>` : ''}
      <div class="know-you-action-row">
        <button class="know-you-test-btn" type="button" onclick="triggerKnowYouCompressionTest()">
          <span class="mat-icon">science</span> 模擬壓縮測試
        </button>
      </div>
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
      clinicianNotes: '',
      memoryChunks: [],
      memoryStats: {
        tokenLimit: KNOW_YOU_TOKEN_LIMIT,
        estimatedTokens: 0,
        compressionProgress: 0,
        shouldCompress: false,
        lastCompressedAt: '',
        lastCompressionReason: '',
        memoryChunksCount: 0
      }
    };
  },

  _normalize(profile) {
    const fallback = this._default();
    const source = profile && typeof profile === 'object' ? profile : {};
    const normalized = KNOW_YOU_MEMORY ? KNOW_YOU_MEMORY.normalizeTherapeuticProfile(source) : source;
    const copingProfile = normalized.copingProfile && typeof normalized.copingProfile === 'object'
      ? normalized.copingProfile
      : {};
    const emotionalBaseline = normalized.emotionalBaseline && typeof normalized.emotionalBaseline === 'object'
      ? normalized.emotionalBaseline
      : {};

    return {
      ...fallback,
      ...normalized,
      userId: typeof normalized.userId === 'string' && normalized.userId.trim()
        ? normalized.userId.trim()
        : fallback.userId,
      sessionCount: Number.isFinite(Number(normalized.sessionCount))
        ? Math.max(0, Number(normalized.sessionCount))
        : 0,
      stressors: Array.isArray(normalized.stressors) ? normalized.stressors.filter(Boolean) : [],
      triggers: Array.isArray(normalized.triggers) ? normalized.triggers.filter(Boolean) : [],
      positiveAnchors: Array.isArray(normalized.positiveAnchors) ? normalized.positiveAnchors.filter(Boolean) : [],
      keyThemes: Array.isArray(normalized.keyThemes) ? normalized.keyThemes.filter((item) => typeof item === 'string' && item.trim()) : [],
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
      clinicianNotes: typeof normalized.clinicianNotes === 'string' ? normalized.clinicianNotes : '',
      memoryChunks: Array.isArray(normalized.memoryChunks) ? normalized.memoryChunks.filter(Boolean) : [],
      memoryStats: KNOW_YOU_MEMORY ? KNOW_YOU_MEMORY.normalizeMemoryStats(normalized.memoryStats) : fallback.memoryStats
    };
  }
};

window.TherapeuticMemory = TherapeuticMemory;

function buildKnowYouMeterState(profile = null, pendingMessage = '') {
  if (!KNOW_YOU_MEMORY) {
    return {
      tokenLimit: KNOW_YOU_TOKEN_LIMIT,
      estimatedTokens: 0,
      remainingTokens: KNOW_YOU_TOKEN_LIMIT,
      compressionProgress: 0,
      percent: 0,
      shouldCompress: false,
      isFull: false,
      memoryChunksCount: 0,
      recentItems: KNOW_YOU_RECENT_HISTORY_ITEMS,
      lastCompressedAt: ''
    };
  }

  const targetProfile = profile && typeof profile === 'object'
    ? profile
    : TherapeuticMemory.get();
  const livePendingMessage = typeof pendingMessage === 'string' && pendingMessage.trim()
    ? pendingMessage
    : (document.getElementById('chat-input')?.value || '').trim();

  return KNOW_YOU_MEMORY.buildMemoryMeterState({
    profile: targetProfile,
    history: Array.isArray(APP_STATE.chatHistory) ? APP_STATE.chatHistory : [],
    pendingMessage: livePendingMessage,
    tokenLimit: targetProfile?.memoryStats?.tokenLimit || KNOW_YOU_TOKEN_LIMIT,
    recentItems: KNOW_YOU_RECENT_HISTORY_ITEMS
  });
}

function renderKnowYouMeterHTML(meter = null) {
  const data = meter || buildKnowYouMeterState();
  const fillWidth = Math.max(0, Math.min(100, Number(data.percent) || 0));
  const statusLabel = data.isFull
    ? '上下文快滿了'
    : data.shouldCompress
      ? '快要壓縮了'
      : '還有空間';
  const statusCopy = data.isFull
    ? 'Rou Rou 會先整理前面的對話，再繼續陪你聊。'
    : data.shouldCompress
      ? '這段對話快要超出預設容量，下一輪會先壓縮成長期記憶。'
      : '目前還能放心繼續聊，記憶條還沒有真的頂到上限。';

  return `
    <div class="know-you-meter ${data.isFull ? 'is-full' : data.shouldCompress ? 'is-warm' : ''}">
      <div class="know-you-meter-head">
        <span class="know-you-meter-title">上下文容量</span>
        <span class="know-you-meter-value">${Number(data.estimatedTokens) || 0}/${Number(data.tokenLimit) || KNOW_YOU_TOKEN_LIMIT} tokens</span>
      </div>
      <div class="know-you-meter-track" aria-hidden="true">
        <div class="know-you-meter-fill" style="width:${fillWidth}%"></div>
      </div>
      <div class="know-you-meter-foot">
        <span class="know-you-meter-status">${statusLabel}</span>
        <span class="know-you-meter-copy">${statusCopy}</span>
      </div>
    </div>
  `;
}

async function triggerKnowYouCompressionTest() {
  if (APP_STATE.isSending) return;
  const conversationState = buildConversationRequestState();
  if (!conversationState.conversation_id) {
    appendSystemNotice('目前還沒有可測試的對話，先開始一段聊天再按壓縮測試。');
    return;
  }

  APP_STATE.isSending = true;
  setTyping(true);
  setThinkingState(true, '正在模擬壓縮測試...');
  try {
    const config = getRuntimeConfig();
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '測試肉肉認識你壓縮',
        raw_message: '',
        conversation_id: conversationState.conversation_id,
        force_memory_compression: true,
        therapeutic_profile: conversationState.therapeutic_profile,
        patient_profile: conversationState.patient_profile,
        phq9_assessment: conversationState.phq9_assessment,
        user: config.userId,
        ...buildRuntimeRequestConfig(config),
        hide_response: true
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(formatChatError(payload));
    }

    finalizeConversationRequest(payload);
    if (payload.session_export) {
      syncTherapeuticMemoryFromSessionExport(payload.session_export);
      syncReportOutputsFromSessionExport(payload.session_export);
    }
    TherapeuticMemory.renderProfileUI();
    renderReportOutputs();
    appendSystemNotice('已執行模擬壓縮測試，現在可以直接看上方記憶條與「壓縮記憶」區塊的變化。');
  } catch (error) {
    appendSystemNotice(error.message || '模擬壓縮測試失敗。');
  } finally {
    setThinkingState(false, '');
    setTyping(false);
    APP_STATE.isSending = false;
  }
}

const PHQ9_STORAGE_KEY = 'rourou.phq9Assessments.v1';
const PHQ9_DRAFT_STORAGE_KEY = 'rourou.phq9Draft.v1';
const PHQ9_VERSION = 'PHQ-9';
const PHQ9_QUESTION_DEFS = [
  {
    itemCode: 'phq9_1',
    label: '做事缺乏興趣或樂趣',
    prompt: '過去兩週，對做事失去興趣或樂趣的頻率如何？'
  },
  {
    itemCode: 'phq9_2',
    label: '情緒低落、沮喪或絕望',
    prompt: '過去兩週，感到心情低落、沮喪或絕望的頻率如何？'
  },
  {
    itemCode: 'phq9_3',
    label: '睡眠困擾',
    prompt: '過去兩週，入睡、睡不安穩或睡太多的頻率如何？'
  },
  {
    itemCode: 'phq9_4',
    label: '疲倦或沒精神',
    prompt: '過去兩週，感到疲倦或沒精神的頻率如何？'
  },
  {
    itemCode: 'phq9_5',
    label: '食慾改變',
    prompt: '過去兩週，食慾不振或吃得過多的頻率如何？'
  },
  {
    itemCode: 'phq9_6',
    label: '自責或覺得自己很糟',
    prompt: '過去兩週，覺得自己不好、失敗或讓家人失望的頻率如何？'
  },
  {
    itemCode: 'phq9_7',
    label: '注意力不集中',
    prompt: '過去兩週，讀書、看報或看電視時難以專心的頻率如何？'
  },
  {
    itemCode: 'phq9_8',
    label: '動作或說話變慢，或坐立不安',
    prompt: '過去兩週，動作、說話變慢，或相反地坐立不安的頻率如何？'
  },
  {
    itemCode: 'phq9_9',
    label: '不如死掉的念頭',
    prompt: '過去兩週，有沒有覺得不如死掉，或希望自己消失的念頭？'
  }
];

function createDefaultPhq9Draft() {
  return {
    version: PHQ9_VERSION,
    updatedAt: '',
    createdAt: '',
    scores: Array(9).fill(0),
    narratives: Array(9).fill(''),
    note: ''
  };
}

function normalizePhq9Draft(value = {}) {
  const base = createDefaultPhq9Draft();
  const source = value && typeof value === 'object' ? value : {};
  const scores = Array.isArray(source.scores) ? source.scores : Array.isArray(source.answers) ? source.answers.map((item) => Number(item?.score) || 0) : [];
  const narratives = Array.isArray(source.narratives)
    ? source.narratives
    : Array.isArray(source.answers)
      ? source.answers.map((item) => String(item?.narrative || item?.note || '').trim())
      : [];
  base.version = typeof source.version === 'string' && source.version.trim() ? source.version.trim() : PHQ9_VERSION;
  base.updatedAt = String(source.updatedAt || '').trim();
  base.createdAt = String(source.createdAt || '').trim();
  base.note = String(source.note || '').trim();
  base.scores = base.scores.map((_, index) => Math.max(0, Math.min(3, Number(scores[index]) || 0)));
  base.narratives = base.narratives.map((_, index) => String(narratives[index] || '').trim());
  return base;
}

function normalizePhq9Assessment(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const answers = PHQ9_QUESTION_DEFS.map((question, index) => {
    const answerSource = Array.isArray(source.answers)
      ? source.answers.find((item) => {
          const code = String(item?.itemCode || item?.item_code || item?.questionId || item?.question_id || '').trim();
          return code === question.itemCode;
        }) || source.answers[index] || {}
      : {};
    const score = Number.isFinite(Number(answerSource.score))
      ? Math.max(0, Math.min(3, Number(answerSource.score)))
      : Math.max(0, Math.min(3, Number(Array.isArray(source.scores) ? source.scores[index] : 0) || 0));
    const narrative = String(answerSource.narrative || (Array.isArray(source.narratives) ? source.narratives[index] : '') || '').trim();
    return {
      itemCode: question.itemCode,
      label: question.label,
      prompt: question.prompt,
      score,
      narrative
    };
  });
  const answerTotalScore = answers.reduce((sum, answer) => sum + (Number(answer.score) || 0), 0);
  const explicitTotalScore = Number.isFinite(Number(source.totalScore)) ? Math.max(0, Math.min(27, Number(source.totalScore))) : 0;
  const totalScore = Math.max(answerTotalScore, explicitTotalScore);
  return {
    id: String(source.id || '').trim(),
    version: typeof source.version === 'string' && source.version.trim() ? source.version.trim() : PHQ9_VERSION,
    createdAt: String(source.createdAt || '').trim(),
    updatedAt: String(source.updatedAt || '').trim(),
    completedAt: String(source.completedAt || '').trim(),
    totalScore,
    severityBand: String(source.severityBand || '').trim(),
    summary: String(source.summary || '').trim(),
    answers,
    note: String(source.note || '').trim()
  };
}

function hasSourcePhq9AssessmentContent(value = {}) {
  if (!value || typeof value !== 'object') return false;
  if (String(value.completedAt || value.updatedAt || value.createdAt || value.note || value.summary || '').trim()) return true;
  if (Array.isArray(value.answers) && value.answers.length) return true;
  if (Array.isArray(value.scores) && value.scores.length) return true;
  return Number.isFinite(Number(value.totalScore)) && Number(value.totalScore) > 0;
}

function getPhq9AssessmentTimeValue(assessment = {}) {
  const timestamp = Date.parse(assessment.completedAt || assessment.updatedAt || assessment.createdAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildPhq9SeverityBand(totalScore = 0) {
  const score = Math.max(0, Math.min(27, Number(totalScore) || 0));
  if (score <= 4) return { label: 'minimal', zhLabel: '極輕微', color: 'low' };
  if (score <= 9) return { label: 'mild', zhLabel: '輕度', color: 'soft' };
  if (score <= 14) return { label: 'moderate', zhLabel: '中度', color: 'mid' };
  if (score <= 19) return { label: 'moderately-severe', zhLabel: '中重度', color: 'strong' };
  return { label: 'severe', zhLabel: '重度', color: 'critical' };
}

const PHQ9Tracker = {
  getDraft() {
    try {
      return normalizePhq9Draft(JSON.parse(localStorage.getItem(PHQ9_DRAFT_STORAGE_KEY) || 'null'));
    } catch {
      return createDefaultPhq9Draft();
    }
  },

  saveDraft(draft) {
    const normalized = normalizePhq9Draft(draft);
    normalized.updatedAt = new Date().toISOString();
    if (!normalized.createdAt) normalized.createdAt = normalized.updatedAt;
    localStorage.setItem(PHQ9_DRAFT_STORAGE_KEY, JSON.stringify(normalized));
    APP_STATE.phq9Draft = normalized;
    return normalized;
  },

  getAssessments() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PHQ9_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map((item) => normalizePhq9Assessment(item)) : [];
    } catch {
      return [];
    }
  },

  saveAssessments(list) {
    const normalized = (Array.isArray(list) ? list.map((item) => normalizePhq9Assessment(item)) : [])
      .sort((a, b) => getPhq9AssessmentTimeValue(b) - getPhq9AssessmentTimeValue(a));
    localStorage.setItem(PHQ9_STORAGE_KEY, JSON.stringify(normalized));
    APP_STATE.phq9Assessments = normalized;
    return normalized;
  },

  getLatestAssessment() {
    const assessments = Array.isArray(APP_STATE.phq9Assessments) && APP_STATE.phq9Assessments.length
      ? APP_STATE.phq9Assessments
      : this.getAssessments();
    return assessments[0] ? normalizePhq9Assessment(assessments[0]) : null;
  },

  buildContextString() {
    const latest = this.getLatestAssessment();
    if (!latest) return '';
    const severity = buildPhq9SeverityBand(latest.totalScore);
    const answerLines = latest.answers.map((answer, index) => {
      const note = String(answer.narrative || '').trim();
      return `${index + 1}. ${answer.label}：${answer.score} 分${note ? `；補充：${note}` : ''}`;
    });
    const recentAssessments = (Array.isArray(APP_STATE.phq9Assessments) ? APP_STATE.phq9Assessments : [])
      .slice(0, 3)
      .map((item) => `${String(item.updatedAt || item.createdAt || '').slice(0, 10) || '未標記'}:${item.totalScore}`)
      .filter(Boolean);

    return `
【PHQ-9 自評背景 - 這是系統背景資料，請自然地融入對話，不要直接唸出整段文字】
最新一筆填寫時間：${latest.updatedAt || latest.createdAt || '未標記'}
總分：${latest.totalScore} / 27
嚴重度：${severity.zhLabel}（${severity.label}）
逐題內容：
${answerLines.join('\n')}
${latest.note ? `補充總覽：${latest.note}` : ''}
${recentAssessments.length ? `近期趨勢：${recentAssessments.join(' → ')}` : ''}
請在後續對話中把這份自評當作目前情緒狀態的正式背景資料，並與自然對話脈絡一起保留。
`.trim();
  },

  commitDraft() {
    const draft = this.getDraft();
    const answers = PHQ9_QUESTION_DEFS.map((question, index) => ({
      itemCode: question.itemCode,
      label: question.label,
      prompt: question.prompt,
      score: Math.max(0, Math.min(3, Number(draft.scores[index]) || 0)),
      narrative: String(draft.narratives[index] || '').trim()
    }));
    const totalScore = answers.reduce((sum, answer) => sum + answer.score, 0);
    const severityBand = buildPhq9SeverityBand(totalScore);
    const now = new Date().toISOString();
    const assessment = normalizePhq9Assessment({
      id: draft.id || `phq9-${Date.now().toString(36)}`,
      version: PHQ9_VERSION,
      createdAt: draft.createdAt || now,
      updatedAt: now,
      completedAt: now,
      totalScore,
      severityBand: severityBand.label,
      summary: `PHQ-9 ${totalScore}/27（${severityBand.zhLabel}）`,
      note: String(draft.note || '').trim(),
      answers
    });

    const assessments = [assessment, ...this.getAssessments().filter((item) => item.id !== assessment.id)];
    this.saveAssessments(assessments);
    this.saveDraft({
      ...draft,
      id: assessment.id,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
      note: String(draft.note || '').trim(),
      scores: assessment.answers.map((item) => item.score),
      narratives: assessment.answers.map((item) => item.narrative)
    });
    appendSystemNotice(`PHQ-9 已保存，總分 ${assessment.totalScore} 分。`);
    return assessment;
  },

  importFromSessionExport(sessionExport = {}) {
    const source = sessionExport && typeof sessionExport.phq9_assessment === 'object'
      ? sessionExport.phq9_assessment
      : null;
    if (!hasSourcePhq9AssessmentContent(source)) return;
    const payload = source
      ? normalizePhq9Assessment(sessionExport.phq9_assessment)
      : null;
    if (!payload) return;
    const current = this.getAssessments();
    const next = [payload, ...current.filter((item) => item.id !== payload.id)];
    this.saveAssessments(next);
    this.renderUI();
  },

  renderUI() {
    renderPhq9Screen();
    renderPhq9ReportSummary();
  }
};

function createDefaultDoctorPatients() {
  return [
    {
      id: 'patient-demo-001',
      patientNumber: 'P-2026-001',
      name: '林小明',
      latestAiRecordAt: '2026-04-24 21:10',
      aiSummaryStatus: '已整理',
      medicalRecordStatus: '待送入',
      orderStatus: '未填寫',
      riskLevel: '中',
      aiSummary: '近三次互動以睡眠中斷、焦慮反芻與就診前緊張為主。PHQ-9 草稿顯示低落與疲倦分數偏高，建議下次回診先確認睡眠與日間功能。',
      lastVisitNote: '病人已同意將摘要作為診前討論素材，但尚未送入正式病歷。',
      orderDraft: createEmptyDoctorOrder()
    },
    {
      id: 'patient-demo-002',
      patientNumber: 'P-2026-002',
      name: '陳怡安',
      latestAiRecordAt: '2026-04-23 08:35',
      aiSummaryStatus: '需要補充',
      medicalRecordStatus: '待送入',
      orderStatus: '草稿',
      riskLevel: '低',
      aiSummary: '近期主要在使用情緒標籤與呼吸練習，互動穩定，暫未出現明顯高風險訊號。仍建議補充藥物副作用與白天嗜睡狀況。',
      lastVisitNote: '醫囑草稿尚未確認，適合展示「暫存後再處理」流程。',
      orderDraft: {
        type: '追蹤觀察',
        content: '請持續記錄睡眠時間與白天精神狀態，下次回診帶回討論。',
        assignee: '病人',
        duePreset: '回診前',
        dueDate: '',
        priority: '重要',
        replyRequirement: '需填寫資料',
        taskRef: '睡眠紀錄',
        note: '若白天嗜睡加重，也請一併記錄發生時段。',
        status: '草稿',
        createdBy: '王醫師',
        createdAt: '2026-04-23 08:35',
        patientRef: 'P-2026-002',
        encounterRef: '',
        summaryRef: 'AI 睡眠觀察摘要',
        observationRef: 'sleep-observation'
      }
    },
    {
      id: 'patient-demo-003',
      patientNumber: 'P-2026-003',
      name: '吳柏辰',
      latestAiRecordAt: '2026-04-20 19:42',
      aiSummaryStatus: '已整理',
      medicalRecordStatus: '已送入',
      orderStatus: '已送出',
      riskLevel: '觀察',
      aiSummary: '病人近期互動量下降，但最後一次對話提到工作壓力與社交退縮。建議醫師端先視為觀察個案，回診時確認是否有惡化。',
      lastVisitNote: '病歷送入狀態已標示完成，作為 prototype 狀態切換示範。',
      orderDraft: {
        type: '回診前補充資料',
        content: '回診前請先整理最近一週工作壓力來源與情緒波動。',
        assignee: '病人',
        duePreset: '回診前',
        dueDate: '',
        priority: '一般',
        replyRequirement: '需回傳狀況',
        taskRef: '回診前摘要確認',
        note: '若出現明顯惡化，請提前回診或聯絡醫療單位。',
        status: '已送出',
        createdBy: '王醫師',
        createdAt: '2026-04-20 19:42',
        patientRef: 'P-2026-003',
        encounterRef: 'ENC-2026-003',
        summaryRef: '診前追蹤摘要',
        observationRef: 'mood-observation'
      }
    }
  ];
}

function createEmptyDoctorOrder() {
  return {
    type: '',
    content: '',
    assignee: '病人',
    duePreset: '回診前',
    dueDate: '',
    priority: '一般',
    replyRequirement: '不需回覆',
    taskRef: '',
    note: '',
    status: '草稿',
    createdBy: '',
    createdAt: '',
    patientRef: '',
    encounterRef: '',
    summaryRef: '',
    observationRef: ''
  };
}

function normalizeDoctorOrder(order, fallbackStatus = '未填寫', patient = {}) {
  const base = createEmptyDoctorOrder();
  if (typeof order === 'string') {
    const legacy = order.trim();
    return {
      ...base,
      content: legacy,
      status: legacy ? (fallbackStatus === '未填寫' ? '草稿' : fallbackStatus) : '草稿',
      patientRef: patient.patientNumber || '',
      createdBy: '',
      createdAt: ''
    };
  }
  const source = order && typeof order === 'object' ? order : {};
  const normalizedStatus = String(source.status || fallbackStatus || '草稿').trim() || '草稿';
  return {
    ...base,
    type: String(source.type || '').trim(),
    content: String(source.content || '').trim(),
    assignee: String(source.assignee || base.assignee).trim() || base.assignee,
    duePreset: String(source.duePreset || base.duePreset).trim() || base.duePreset,
    dueDate: String(source.dueDate || '').trim(),
    priority: String(source.priority || base.priority).trim() || base.priority,
    replyRequirement: String(source.replyRequirement || base.replyRequirement).trim() || base.replyRequirement,
    taskRef: String(source.taskRef || '').trim(),
    note: String(source.note || '').trim(),
    status: normalizedStatus,
    createdBy: String(source.createdBy || '').trim(),
    createdAt: String(source.createdAt || '').trim(),
    patientRef: String(source.patientRef || patient.patientNumber || '').trim(),
    encounterRef: String(source.encounterRef || '').trim(),
    summaryRef: String(source.summaryRef || '').trim(),
    observationRef: String(source.observationRef || '').trim()
  };
}

function deriveDoctorOrderStatus(order = null) {
  const normalized = normalizeDoctorOrder(order);
  if (!normalized.content) return '未填寫';
  return normalized.status || '草稿';
}

function hasPublishedDoctorOrder(order = null) {
  const normalized = normalizeDoctorOrder(order);
  return Boolean(
    normalized.content &&
    ['已送出', '病人已讀', '病人已完成', '醫師已複核', '已關閉'].includes(normalized.status)
  );
}

function createEmptyMedicalRecord() {
  return {
    patient: { name: '', gender: '', birthDate: '', identifier: '' },
    encounter: { periodStart: '', periodEnd: '', class: '', serviceType: '', practitionerName: '' },
    observations: [],
    questionnaire: { name: '', authored: '', items: [] },
    composition: { title: '', status: 'preliminary', chiefComplaint: '', symptomSummary: '', riskAlert: '', followupSuggestion: '' },
    documents: [],
    conditions: [],
    medications: [],
    provenance: { sourceType: 'doctor_edited', recorded: '', activity: '', agent: '' },
    updatedAt: ''
  };
}

function normalizeMedicalRecordItem(item, shape) {
  const out = {};
  Object.keys(shape).forEach((key) => {
    out[key] = String((item && item[key]) || shape[key] || '');
  });
  return out;
}

function normalizeMedicalRecord(record) {
  const base = createEmptyMedicalRecord();
  if (!record || typeof record !== 'object') return base;
  const observationShape = { code: '', display: '', value: '', interpretation: '', effectiveDateTime: '', derivedFrom: '' };
  const documentShape = { type: '', filename: '', url: '', contentType: '', date: '' };
  const conditionShape = { code: '', clinicalStatus: '', verificationStatus: '', onsetDateTime: '' };
  const questionnaireItemShape = { linkId: '', text: '', answer: '' };
  return {
    patient: normalizeMedicalRecordItem(record.patient, base.patient),
    encounter: normalizeMedicalRecordItem(record.encounter, base.encounter),
    observations: Array.isArray(record.observations)
      ? record.observations.map((item) => normalizeMedicalRecordItem(item, observationShape))
      : [],
    questionnaire: {
      name: String(record.questionnaire?.name || ''),
      authored: String(record.questionnaire?.authored || ''),
      items: Array.isArray(record.questionnaire?.items)
        ? record.questionnaire.items.map((item) => normalizeMedicalRecordItem(item, questionnaireItemShape))
        : []
    },
    composition: normalizeMedicalRecordItem(record.composition, base.composition),
    documents: Array.isArray(record.documents)
      ? record.documents.map((item) => normalizeMedicalRecordItem(item, documentShape))
      : [],
    conditions: Array.isArray(record.conditions)
      ? record.conditions.map((item) => normalizeMedicalRecordItem(item, conditionShape))
      : [],
    medications: Array.isArray(record.medications)
      ? record.medications.map((item) => ({
          kind: item?.kind === 'request' ? 'request' : 'statement',
          name: String(item?.name || ''),
          dosage: String(item?.dosage || ''),
          start: String(item?.start || ''),
          end: String(item?.end || '')
        }))
      : [],
    provenance: {
      sourceType: ['ai_generated', 'patient_confirmed', 'doctor_edited'].includes(record.provenance?.sourceType)
        ? record.provenance.sourceType
        : 'doctor_edited',
      recorded: String(record.provenance?.recorded || ''),
      activity: String(record.provenance?.activity || ''),
      agent: String(record.provenance?.agent || '')
    },
    updatedAt: String(record.updatedAt || '')
  };
}

function normalizeDoctorPatient(patient = {}) {
  const normalizedOrder = normalizeDoctorOrder(patient.orderDraft, patient.orderStatus, patient);
  return {
    id: String(patient.id || `patient-${Date.now()}`),
    patientNumber: String(patient.patientNumber || 'P-DEMO'),
    name: String(patient.name || '未命名病人'),
    loginIdentifier: String(patient.loginIdentifier || patient.login_identifier || ''),
    source: String(patient.source || 'demo'),
    latestAiRecordAt: String(patient.latestAiRecordAt || '尚無紀錄'),
    aiSummaryStatus: String(patient.aiSummaryStatus || '尚未整理'),
    medicalRecordStatus: String(patient.medicalRecordStatus || '待送入'),
    orderStatus: deriveDoctorOrderStatus(normalizedOrder),
    riskLevel: String(patient.riskLevel || '觀察'),
    aiSummary: String(patient.aiSummary || '目前沒有可展示的 AI 使用紀錄摘要。'),
    lastVisitNote: String(patient.lastVisitNote || '尚無補充紀錄。'),
    orderDraft: normalizedOrder,
    medicalRecord: normalizeMedicalRecord(patient.medicalRecord)
  };
}

function normalizeDoctorWorkspace(workspace = {}) {
  const fallbackPatients = createDefaultDoctorPatients();
  const patients = Array.isArray(workspace.patients) && workspace.patients.length
    ? workspace.patients.map(normalizeDoctorPatient)
    : fallbackPatients.map(normalizeDoctorPatient);
  const selectedPatientId = patients.some((patient) => patient.id === workspace.selectedPatientId)
    ? workspace.selectedPatientId
    : patients[0]?.id || '';
  return {
    patients,
    selectedPatientId
  };
}

function getDoctorWorkspaceStorageKey(ownerId = '') {
  const normalizedOwnerId = String(ownerId || '').trim();
  return normalizedOwnerId ? `${DOCTOR_WORKSPACE_STORAGE_KEY}.${normalizedOwnerId}` : DOCTOR_WORKSPACE_STORAGE_KEY;
}

function loadDoctorWorkspace(ownerId = '') {
  try {
    return normalizeDoctorWorkspace(JSON.parse(localStorage.getItem(getDoctorWorkspaceStorageKey(ownerId)) || 'null') || {});
  } catch {
    return normalizeDoctorWorkspace({});
  }
}

function saveDoctorWorkspace() {
  try {
    const ownerId = isDoctorUser() ? getCurrentAuthUser()?.id : '';
    localStorage.setItem(getDoctorWorkspaceStorageKey(ownerId), JSON.stringify(APP_STATE.doctorWorkspace));
  } catch {
    // Local demo state is best-effort only.
  }
}

function buildDoctorAssignmentPayload(patient = null) {
  if (!patient?.id) return null;
  const currentUser = getCurrentAuthUser();
  const normalizedOrder = normalizeDoctorOrder(patient.orderDraft, patient.orderStatus, patient);
  return {
    patientId: patient.id,
    patientName: patient.name || '',
    patientNumber: patient.patientNumber || '',
    doctorId: currentUser?.id || '',
    doctorName: currentUser?.display_name || currentUser?.login_identifier || '醫師',
    medicalRecordStatus: patient.medicalRecordStatus || '待送入',
    orderStatus: deriveDoctorOrderStatus(normalizedOrder),
    medicalRecord: normalizeMedicalRecord(patient.medicalRecord),
    orderDraft: normalizedOrder,
    syncedAt: new Date().toISOString()
  };
}

function loadLocalDoctorAssignments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DOCTOR_ASSIGNMENT_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalDoctorAssignment(entry = null) {
  if (!entry?.patientId) return;
  const assignments = loadLocalDoctorAssignments();
  assignments[entry.patientId] = entry;
  localStorage.setItem(DOCTOR_ASSIGNMENT_STORAGE_KEY, JSON.stringify(assignments));
}

function getLocalDoctorAssignment(patientId = '') {
  const assignments = loadLocalDoctorAssignments();
  return assignments[String(patientId || '').trim()] || null;
}

function loadDoctorVisiblePatientSummaries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DOCTOR_VISIBLE_PATIENT_SUMMARY_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveDoctorVisiblePatientSummary(patientId = '', summary = {}) {
  const id = String(patientId || '').trim();
  if (!id) return null;
  const summaries = loadDoctorVisiblePatientSummaries();
  const current = summaries[id] && typeof summaries[id] === 'object' ? summaries[id] : {};
  const next = Object.assign({}, current, summary, {
    patientId: id,
    updatedAt: new Date().toISOString()
  });
  summaries[id] = next;
  localStorage.setItem(DOCTOR_VISIBLE_PATIENT_SUMMARY_KEY, JSON.stringify(summaries));
  return next;
}

function getDoctorVisiblePatientSummary(patientId = '') {
  const summaries = loadDoctorVisiblePatientSummaries();
  return summaries[String(patientId || '').trim()] || null;
}

function getCurrentPatientIdForDoctorSummary() {
  const user = getCurrentAuthUser();
  return user?.role === 'patient' ? user.id : '';
}

function publishDoctorVisiblePatientSummary(partial = {}) {
  const patientId = getCurrentPatientIdForDoctorSummary();
  if (!patientId) return null;
  return saveDoctorVisiblePatientSummary(patientId, partial);
}

function getLatestLocalDoctorAssignment() {
  const assignments = Object.values(loadLocalDoctorAssignments()).filter(shouldDisplayPatientAssignment);
  assignments.sort((a, b) => String(b.syncedAt || '').localeCompare(String(a.syncedAt || '')));
  return assignments[0] || null;
}

function getLatestLocalCareAccess() {
  const assignments = Object.values(loadLocalDoctorAssignments()).filter((entry) => (
    entry && typeof entry === 'object' && (entry.doctorName || entry.doctorId)
  ));
  assignments.sort((a, b) => String(b.syncedAt || '').localeCompare(String(a.syncedAt || '')));
  return assignments[0] || null;
}

async function syncDoctorAssignmentInbox(patient = null) {
  const payload = buildDoctorAssignmentPayload(patient);
  if (!payload) return null;
  saveLocalDoctorAssignment(payload);
  let response;
  let result = {};
  try {
    response = await fetch(`/api/assignments?patient_id=${encodeURIComponent(payload.patientId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    result = await readJsonResponseSafe(response);
  } catch {
    return payload;
  }
  if (!response.ok) return payload;
  const assignment = result.assignment || payload;
  saveLocalDoctorAssignment(assignment);
  return assignment;
}

function getAttendingDoctorInfo() {
  const entry = APP_STATE.patientCareAccess || APP_STATE.patientAssignment || getLatestLocalCareAccess();
  if (!entry || typeof entry !== 'object') return null;
  const doctorName = String(entry.doctorName || '').trim();
  const doctorId = String(entry.doctorId || '').trim();
  if (!doctorName && !doctorId) return null;
  return {
    name: doctorName || '未命名醫師',
    id: doctorId,
    patientId: String(entry.patientId || '').trim(),
    syncedAt: String(entry.syncedAt || '').trim(),
    hasMedicalRecord: entry.medicalRecordStatus === '已送入',
    hasOrder: hasPublishedDoctorOrder(entry.orderDraft)
  };
}

function buildMoodSummaryForDoctor() {
  const points = (APP_STATE.moodPoints || []).map((value) => Number(value) || 0);
  const average = points.length
    ? Math.round(points.reduce((sum, value) => sum + value, 0) / points.length)
    : 0;
  return {
    updatedAt: new Date().toISOString(),
    average,
    currentLabel: getMoodLabel(points[points.length - 1] || average || 100),
    tags: (APP_STATE.selectedMoodTags || []).slice(0, 8),
    points
  };
}

function publishMoodSummaryForDoctor() {
  return publishDoctorVisiblePatientSummary({
    mood: buildMoodSummaryForDoctor()
  });
}

function publishPhq9SummaryForDoctor(assessment = null) {
  const latest = assessment || PHQ9Tracker.getLatestAssessment();
  if (!latest) return null;
  const severity = buildPhq9SeverityBand(latest.totalScore);
  return publishDoctorVisiblePatientSummary({
    phq9: {
      updatedAt: latest.completedAt || latest.updatedAt || new Date().toISOString(),
      totalScore: latest.totalScore,
      severity: severity.zhLabel,
      summary: latest.summary || `PHQ-9 ${latest.totalScore}/27（${severity.zhLabel}）`,
      note: latest.note || '',
      answers: (latest.answers || []).map((answer) => ({
        label: answer.label,
        score: answer.score,
        narrative: answer.narrative
      }))
    }
  });
}

function publishHamdSummaryForDoctor(sessionExport = null) {
  const source = sessionExport || APP_STATE.reportOutputs?.session_export || null;
  const formal = source?.hamd_formal_assessment || null;
  const progress = source?.hamd_progress_state || null;
  if (!formal && !progress) return null;

  const items = Array.isArray(formal?.items) ? formal.items : [];
  const scoredItems = items.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const score = item.clinician_final_score ?? item.ai_suggested_score ?? item.direct_answer_value;
    return Number.isFinite(Number(score));
  });

  const totalScore = Number.isFinite(Number(formal?.clinician_total_score))
    ? Number(formal.clinician_total_score)
    : (Number.isFinite(Number(formal?.ai_total_score)) ? Number(formal.ai_total_score) : null);

  const coveredDimensions = Array.isArray(progress?.covered_dimensions) ? progress.covered_dimensions.filter(Boolean) : [];
  const recentEvidence = Array.isArray(progress?.recent_evidence) ? progress.recent_evidence.filter(Boolean) : [];

  if (!scoredItems.length && totalScore === null && !coveredDimensions.length && !recentEvidence.length) {
    return null;
  }

  return publishDoctorVisiblePatientSummary({
    hamd: {
      updatedAt: new Date().toISOString(),
      scaleVersion: formal?.scale_version || 'HAM-D17',
      status: formal?.status || '',
      assessmentMode: formal?.assessment_mode || '',
      totalScore,
      severityBand: formal?.severity_band || '',
      coveredDimensions: coveredDimensions.slice(0, 12),
      recentEvidence: recentEvidence.slice(0, 5),
      items: scoredItems.slice(0, 17).map((item) => ({
        code: item.item_code || '',
        label: item.item_label || item.item_code || '',
        score: Number.isFinite(Number(item.clinician_final_score))
          ? Number(item.clinician_final_score)
          : (Number.isFinite(Number(item.ai_suggested_score))
              ? Number(item.ai_suggested_score)
              : (Number.isFinite(Number(item.direct_answer_value)) ? Number(item.direct_answer_value) : null)),
        evidenceType: item.evidence_type || '',
        reviewRequired: Boolean(item.review_required),
        evidence: Array.isArray(item.evidence_summary) ? item.evidence_summary.slice(0, 2) : []
      }))
    }
  });
}

function publishSafetyAccessForDoctor(reason = '安全模式') {
  const previous = publishDoctorVisiblePatientSummary({}) || {};
  const existing = Array.isArray(previous.safetyEvents) ? previous.safetyEvents : [];
  const nextEvents = [
    { reason, enteredAt: new Date().toISOString() },
    ...existing
  ].slice(0, 5);
  return publishDoctorVisiblePatientSummary({
    safetyEvents: nextEvents
  });
}

function formatDoctorSummaryTime(value = '') {
  if (!value) return '尚未更新';
  return new Date(value).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderDoctorVisiblePatientSummary(patient = {}) {
  const summary = getDoctorVisiblePatientSummary(patient.id);
  if (!summary) {
    return `
      <div class="doctor-self-report-card">
        <div class="doctor-summary-label">病人自評與安全摘要</div>
        <div class="doctor-self-report-empty">病人尚未產生可提供給醫師的自評資料。聊天內容仍保留為病人隱私。</div>
      </div>
    `;
  }
  const mood = summary.mood || null;
  const phq9 = summary.phq9 || null;
  const hamd = summary.hamd || null;
  const safetyEvents = Array.isArray(summary.safetyEvents) ? summary.safetyEvents : [];
  return `
    <div class="doctor-self-report-card">
      <div class="doctor-summary-label">病人自評與安全摘要</div>
      <div class="doctor-self-report-grid">
        <section class="doctor-self-report-block">
          <div class="doctor-self-report-title">情緒自評</div>
          ${mood ? `
            <div class="doctor-self-report-main">${escapeHtml(mood.currentLabel || '未標記')}</div>
            <div class="doctor-self-report-meta">平均 ${escapeHtml(String(mood.average ?? '-'))}/100 ・ ${escapeHtml(formatDoctorSummaryTime(mood.updatedAt))}</div>
            <div class="doctor-self-report-tags">
              ${(mood.tags || []).length ? mood.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('') : '<span>尚未選擇情緒標籤</span>'}
            </div>
          ` : '<div class="doctor-self-report-empty">尚未有情緒自評。</div>'}
        </section>
        <section class="doctor-self-report-block">
          <div class="doctor-self-report-title">PHQ-9 九題量表</div>
          ${phq9 ? `
            <div class="doctor-self-report-main">${escapeHtml(String(phq9.totalScore))}<span>/27</span></div>
            <div class="doctor-self-report-meta">${escapeHtml(phq9.severity || '')} ・ ${escapeHtml(formatDoctorSummaryTime(phq9.updatedAt))}</div>
            <div class="doctor-self-report-preview">${escapeHtml(phq9.note || phq9.summary || '病人已完成 PHQ-9。')}</div>
            <div class="doctor-phq9-mini-list">
              ${(phq9.answers || []).slice(0, 9).map((answer, index) => `
                <div class="doctor-phq9-mini-row">
                  <span>Q${index + 1}</span>
                  <b>${escapeHtml(String(answer.score ?? 0))}</b>
                  <em>${escapeHtml(answer.label || '')}</em>
                </div>
              `).join('')}
            </div>
          ` : '<div class="doctor-self-report-empty">尚未完成 PHQ-9。</div>'}
        </section>
        <section class="doctor-self-report-block">
          <div class="doctor-self-report-title">HAM-D 量表追蹤</div>
          ${hamd ? `
            <div class="doctor-self-report-main">${hamd.totalScore !== null && hamd.totalScore !== undefined ? escapeHtml(String(hamd.totalScore)) : '-'}<span>/52</span></div>
            <div class="doctor-self-report-meta">${escapeHtml(hamd.scaleVersion || 'HAM-D17')} ・ ${escapeHtml(hamd.severityBand || '')} ・ ${escapeHtml(formatDoctorSummaryTime(hamd.updatedAt))}</div>
            ${hamd.coveredDimensions && hamd.coveredDimensions.length ? `
              <div class="doctor-self-report-tags">
                ${hamd.coveredDimensions.map((dim) => `<span>${escapeHtml(dim)}</span>`).join('')}
              </div>
            ` : ''}
            ${hamd.items && hamd.items.length ? `
              <div class="doctor-phq9-mini-list">
                ${hamd.items.map((item) => `
                  <div class="doctor-phq9-mini-row">
                    <span>${escapeHtml(item.code || '')}</span>
                    <b>${escapeHtml(String(item.score ?? '-'))}</b>
                    <em>${escapeHtml(item.label || '')}${item.reviewRequired ? ' ⚠' : ''}</em>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${hamd.recentEvidence && hamd.recentEvidence.length ? `
              <div class="doctor-self-report-preview">${escapeHtml(hamd.recentEvidence.join('；'))}</div>
            ` : ''}
          ` : '<div class="doctor-self-report-empty">尚未開始 HAM-D 量表評估。</div>'}
        </section>
        <section class="doctor-self-report-block">
          <div class="doctor-self-report-title">安全模式紀錄</div>
          ${safetyEvents.length ? safetyEvents.map((event) => `
            <div class="doctor-self-report-safety">
              <span class="mat-icon">health_and_safety</span>
              <div>
                <b>${escapeHtml(event.reason || '安全模式')}</b>
                <small>${escapeHtml(formatDoctorSummaryTime(event.enteredAt))}</small>
              </div>
            </div>
          `).join('') : '<div class="doctor-self-report-empty">尚未進入安全模式。</div>'}
        </section>
      </div>
      <div class="doctor-self-report-note">僅顯示病人自評、PHQ-9 與安全模式時間；聊天內容不會在醫師端顯示。</div>
    </div>
  `;
}

function shouldDisplayPatientAssignment(entry = null) {
  if (!entry || typeof entry !== 'object') return false;
  const hasRecord = entry.medicalRecordStatus === '已送入';
  const hasOrder = hasPublishedDoctorOrder(entry.orderDraft);
  return hasRecord || hasOrder;
}

async function fetchCurrentPatientAssignment(options = {}) {
  const user = getCurrentAuthUser();
  if (!user || user.role !== 'patient') {
    APP_STATE.patientAssignment = null;
    APP_STATE.patientCareAccess = null;
    return null;
  }
  try {
    const response = await fetch(`/api/assignments?patient_id=${encodeURIComponent(user.id)}`);
    const result = await readJsonResponseSafe(response);
    if (!response.ok) {
      throw new Error(result.error || '讀取醫生指派失敗。');
    }
    const fallback = getLocalDoctorAssignment(user.id) || getLatestLocalDoctorAssignment();
    const careFallback = getLocalDoctorAssignment(user.id) || getLatestLocalCareAccess();
    APP_STATE.patientCareAccess = result.assignment || careFallback || null;
    const entry = shouldDisplayPatientAssignment(result.assignment)
      ? result.assignment
      : shouldDisplayPatientAssignment(fallback)
        ? fallback
        : null;
    APP_STATE.patientAssignment = entry;
    if (options.render !== false) {
      renderReportOutputs();
    }
    return entry;
  } catch (error) {
    const fallback = getLocalDoctorAssignment(user.id) || getLatestLocalDoctorAssignment();
    const careFallback = getLocalDoctorAssignment(user.id) || getLatestLocalCareAccess();
    APP_STATE.patientCareAccess = careFallback || null;
    APP_STATE.patientAssignment = shouldDisplayPatientAssignment(fallback) ? fallback : null;
    if (options.silent !== true) {
      appendSystemNotice(APP_STATE.patientAssignment
        ? '後端暫時讀不到醫生指派，已先使用這台瀏覽器保存的最新資料。'
        : (error.message || '讀取醫生指派失敗。'));
    }
    if (options.render !== false) {
      renderReportOutputs();
    }
    return APP_STATE.patientAssignment;
  }
}

const APP_STATE = {
  currentScreen: 'screen-chat',
  conversationId: '',
  userId: PROTOTYPE_SHARED_CHAT_USER_ID,
  auth: loadStoredAuthState(),
  authForm: {
    role: localStorage.getItem('rourou.authRoleDraft') || 'patient'
  },
  doctorWorkspace: loadDoctorWorkspace(),
  patientAssignment: null,
  patientCareAccess: null,
  selectedMode: localStorage.getItem('rourou.selectedMode') || 'natural',
  runtimeMode: '',
  syncedMode: '',
  isSending: false,
  pendingSliderRating: null,
  currentReportTab: 'auto',
  currentWeeklyAudience: 'patient',
  turnCount: 0,
  moodPoints: [100, 100, 100, 100, 100, 100, 100], 
  selectedMoodTags: [],
  phq9Scores: Array(9).fill(0),
  phq9Draft: createDefaultPhq9Draft(),
  phq9Assessments: [],
  chatHistory: [],
  pendingFreshSession: false,
  lastChatMetadata: null,
  customShortcuts: loadCustomShortcuts(),
  reportOutputs: createEmptyReportOutputs(),
  fhirReportHistory: loadFhirReportHistory(),
  serverRecentSessions: [],
  recentSessions: [],
  pinnedSession: loadPinnedSession(),
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
  fhirResourceRefresh: {
    active: false,
    resourcePath: '',
    entryId: ''
  },
  reportFhirDraft: {
    isLoading: false,
    error: '',
    emptyReason: ''
  },
  restoredSessionRefresh: {
    conversationId: '',
    inFlight: false
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

function getAuthRoleLabel(role = '') {
  return role === 'doctor' ? '醫師' : '病人';
}

function getCurrentAuthUser() {
  return APP_STATE.auth?.user || null;
}

function isDoctorUser() {
  return getCurrentAuthUser()?.role === 'doctor';
}

function getRoleDefaultScreen() {
  return isDoctorUser() ? 'screen-doctor-dashboard' : 'screen-home';
}

function showRoleHome() {
  showScreen(getRoleDefaultScreen());
}

function showRoleReport() {
  showScreen(isDoctorUser() ? 'screen-doctor-dashboard' : 'screen-report');
}

function returnFromSettings() {
  showScreen(isDoctorUser() ? 'screen-doctor-dashboard' : 'screen-chat');
}

function isAuthenticated() {
  return Boolean(getCurrentAuthUser() && APP_STATE.auth?.token);
}

function persistAuthState(token = '', user = null) {
  if (token && user) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
}

function syncAuthStateToApp() {
  // 對話 namespace 共用 PROTOTYPE_SHARED_CHAT_USER_ID，避免 user 切換導致對話紀錄消失。
  // 真實認證身份仍可從 APP_STATE.auth.user.id 取得。
  APP_STATE.userId = PROTOTYPE_SHARED_CHAT_USER_ID;
  localStorage.setItem('rourou.userId', PROTOTYPE_SHARED_CHAT_USER_ID);
}

function updateAuthUI() {
  const user = getCurrentAuthUser();
  const isLoggedIn = Boolean(user);
  const homeHeadline = document.querySelector('.home-headline');
  const homeSub = document.querySelector('.home-sub');
  const homeEntryButton = document.getElementById('home-entry-button');
  const homeEntryPlaceholder = document.getElementById('home-entry-placeholder');
  const authGuest = document.getElementById('auth-modal-guest');
  const authMember = document.getElementById('auth-modal-member');
  const authRoleBadge = document.getElementById('home-auth-role-badge');
  const authName = document.getElementById('home-auth-name');
  const authMeta = document.getElementById('home-auth-meta');
  const authModalClose = document.getElementById('auth-modal-close');
  const settingsAuthName = document.getElementById('settings-auth-name');
  const settingsAuthMeta = document.getElementById('settings-auth-meta');
  const settingsAuthId = document.getElementById('settings-auth-id');
  const settingsAuthBadge = document.getElementById('settings-auth-badge');
  const settingsAuthActions = document.getElementById('settings-auth-actions');
  const settingsLogout = document.getElementById('settings-auth-logout');
  const authRoleButtons = document.querySelectorAll('[data-auth-role]');

  authRoleButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.authRole === APP_STATE.authForm.role);
  });

  if (homeHeadline) {
    homeHeadline.textContent = isLoggedIn
      ? (user.role === 'doctor' ? `醫師您好，${user.display_name}` : `歡迎回來，${user.display_name}`)
      : '先登入，再開始對話';
  }
  if (homeSub) {
    homeSub.textContent = isLoggedIn
      ? (user.role === 'doctor'
        ? '醫師端會進入病人管理工作台，不使用聊天頁作為主入口'
        : `目前身份：${getAuthRoleLabel(user.role)}・帳號已辨識完成`)
      : '這一版先支援病人與醫師雙角色登入';
  }
  if (homeEntryButton) {
    homeEntryButton.disabled = !isLoggedIn;
    homeEntryButton.classList.toggle('is-disabled', !isLoggedIn);
  }
  if (homeEntryPlaceholder) {
    homeEntryPlaceholder.textContent = isLoggedIn
      ? (user.role === 'doctor' ? '前往病人管理工作台' : '跟 Rou Rou 說說心事...')
      : '請先登入病人或醫師帳號';
  }
  if (authGuest) {
    authGuest.style.display = isLoggedIn ? 'none' : 'block';
  }
  if (authMember) {
    authMember.style.display = isLoggedIn ? 'flex' : 'none';
  }
  if (authRoleBadge) {
    authRoleBadge.textContent = isLoggedIn ? getAuthRoleLabel(user.role) : '未登入';
  }
  if (authName) {
    authName.textContent = isLoggedIn ? user.display_name : '尚未登入';
  }
  if (authMeta) {
    authMeta.textContent = isLoggedIn ? `${user.login_identifier} ・ ${user.id}` : '請先建立或登入帳號';
  }
  if (settingsAuthName) {
    settingsAuthName.textContent = isLoggedIn ? user.display_name : '尚未登入帳號';
  }
  if (settingsAuthMeta) {
    settingsAuthMeta.textContent = isLoggedIn
      ? `${getAuthRoleLabel(user.role)} ・ ${user.login_identifier}`
      : '登入後，系統才會知道你是病人還是醫師';
  }
  if (settingsAuthId) {
    settingsAuthId.style.display = isLoggedIn ? 'inline-flex' : 'none';
    settingsAuthId.textContent = isLoggedIn ? `帳號 ID：${user.id}` : '';
    settingsAuthId.title = isLoggedIn ? '這個 ID 可提供給醫師加入病人清單' : '';
  }
  if (settingsAuthBadge) {
    settingsAuthBadge.textContent = isLoggedIn ? getAuthRoleLabel(user.role) : '訪客';
    settingsAuthBadge.classList.toggle('complete', isLoggedIn);
    settingsAuthBadge.classList.toggle('incomplete', !isLoggedIn);
  }
  if (settingsAuthActions) {
    settingsAuthActions.style.display = isLoggedIn ? 'flex' : 'none';
  }
  if (settingsLogout) {
    settingsLogout.disabled = !isLoggedIn;
  }
  if (authModalClose) {
    authModalClose.style.display = isLoggedIn ? 'inline-flex' : 'none';
  }
  const homeSessionList = document.getElementById('home-session-list');
  if (homeSessionList) {
    if (isLoggedIn && user.role === 'doctor') {
      homeSessionList.innerHTML = `<div class="home-session-empty">醫師端不顯示聊天紀錄，請進入病人管理工作台查看 AI 使用摘要。</div>`;
    } else {
      APP_STATE.pinnedSession = loadPinnedSession();
      APP_STATE.recentSessions = getRecentSessionSummaries();
      renderRecentSessions();
    }
  }
}

function openAuthModal(force = false) {
  const overlay = document.getElementById('auth-modal-overlay');
  if (!overlay) return;
  if (isAuthenticated() && !force) return;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeAuthModal() {
  if (!isAuthenticated()) return;
  const overlay = document.getElementById('auth-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

async function readJsonResponseSafe(response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {
      error: raw && raw.trim()
        ? `登入 API 回傳了非 JSON 內容：${raw.trim().slice(0, 120)}`
        : '登入 API 沒有回傳可讀資料。'
    };
  }
}

function formatAuthErrorMessage(payload = {}, action = 'login') {
  const code = String(payload.code || '').trim();
  if (code === 'account_not_found') {
    return action === 'login'
      ? '這個帳號還不存在，請先註冊。'
      : '這個帳號還不存在。';
  }
  if (code === 'account_exists') {
    return action === 'register' ? '這個帳號已經存在，請直接登入。' : '這個帳號已經存在。';
  }
  if (code === 'invalid_password') {
    return '密碼不正確，請再確認一次。';
  }
  if (code === 'account_disabled') {
    return '這個帳號目前停用中。';
  }
  if (String(payload.error || '').includes('not found')) {
    return '找不到這個帳號，請先註冊。';
  }
  return payload.error || (action === 'register' ? '註冊失敗。' : '登入失敗。');
}

async function requestAuthAction(action, body) {
  const response = await fetch(action === 'register' ? '/api/auth/register' : '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await readJsonResponseSafe(response);
  return {
    ok: response.ok,
    payload
  };
}

function setAuthenticatedSession(token = '', user = null) {
  APP_STATE.auth = { token, user };
  APP_STATE.patientAssignment = null;
  APP_STATE.serverRecentSessions = [];
  persistAuthState(token, user);
  syncAuthStateToApp();
  migrateGuestSessionsToAuthUser(user?.id);
  restoreReportOutputsFromCache();
  TherapeuticMemory.renderProfileUI();
  renderReportOutputs();
  APP_STATE.pinnedSession = loadPinnedSession();
  APP_STATE.recentSessions = getRecentSessionSummaries();
  updateAuthUI();
  closeAuthModal();
  if (user?.role === 'doctor') {
    APP_STATE.doctorWorkspace = loadDoctorWorkspace(user.id);
    renderDoctorDashboard();
    showScreen('screen-doctor-dashboard');
    return;
  }
  fetchCurrentPatientAssignment({ silent: true, render: false }).catch(() => {});
}

function clearAuthenticatedSession(options = {}) {
  APP_STATE.auth = { token: '', user: null };
  APP_STATE.patientAssignment = null;
  APP_STATE.serverRecentSessions = [];
  APP_STATE.restoredSessionRefresh = { conversationId: '', inFlight: false };
  persistAuthState('', null);
  if (!options.preserveUserId) {
    APP_STATE.userId = DEFAULT_USER_ID;
    localStorage.setItem('rourou.userId', DEFAULT_USER_ID);
  }
  if (options.resetConversation !== false) {
    resetConversationState();
    renderChatHistory([]);
  }
  APP_STATE.pinnedSession = loadPinnedSession();
  APP_STATE.recentSessions = getRecentSessionSummaries();
  updateAuthUI();
}

function ensureAuthenticated(actionLabel = '使用這個功能') {
  if (isAuthenticated()) return true;
  appendSystemNotice(`請先登入病人或醫師帳號，才能${actionLabel}。`);
  openAuthModal(true);
  showScreen('screen-home');
  return false;
}

function ensurePatientUser(actionLabel = '使用病人功能') {
  if (!ensureAuthenticated(actionLabel)) return false;
  if (!isDoctorUser()) return true;
  appendSystemNotice('醫師端目前使用病人管理工作台，不進入病人聊天、PHQ-9 或報表流程。');
  showScreen('screen-doctor-dashboard');
  return false;
}

async function restoreAuthenticatedSession() {
  const token = String(APP_STATE.auth?.token || '').trim();
  if (!token) {
    updateAuthUI();
    openAuthModal(true);
    return;
  }

  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      throw new Error('Session expired');
    }
    const payload = await readJsonResponseSafe(response);
    setAuthenticatedSession(token, payload.user || null);
  } catch {
    clearAuthenticatedSession({ resetConversation: false });
    appendSystemNotice('登入狀態已失效，請重新登入。');
    openAuthModal(true);
  }
}

async function submitAuth(action = 'login') {
  const role = APP_STATE.authForm.role === 'doctor' ? 'doctor' : 'patient';
  const loginIdentifier = String(document.getElementById('auth-login-identifier')?.value || '').trim();
  const displayName = String(document.getElementById('auth-display-name')?.value || '').trim();
  const password = String(document.getElementById('auth-password')?.value || '');
  const status = document.getElementById('home-auth-status');
  const submitButton = document.getElementById(action === 'register' ? 'auth-register-btn' : 'auth-login-btn');

  if (!loginIdentifier || !password) {
    if (status) status.textContent = '請先輸入帳號與密碼。';
    return;
  }
  if (submitButton) {
    submitButton.disabled = true;
  }
  if (status) {
    status.textContent = '正在確認帳號...';
  }

  try {
    const authBody = {
      role,
      display_name: displayName,
      login_identifier: loginIdentifier,
      password
    };
    const result = await requestAuthAction(action, authBody);

    if (!result.ok) {
      throw new Error(formatAuthErrorMessage(result.payload, action));
    }
    const payload = result.payload;
    setAuthenticatedSession(payload.token || '', payload.user || null);
    if (status) {
      status.textContent = payload.created ? '帳號建立成功，已自動登入。' : '登入成功。';
    }
    appendSystemNotice(payload.created ? '帳號建立完成，現在系統知道你是誰了。' : '登入成功，身份系統已啟用。');
    showRoleHome();
  } catch (error) {
    if (status) {
      status.textContent = error.message || '登入失敗。';
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function logoutAuth() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore network errors on logout and clear local auth anyway.
  }
  clearAuthenticatedSession();
  appendSystemNotice('已登出，目前回到訪客狀態。');
  openAuthModal(true);
  showScreen('screen-home');
}

function selectAuthRole(role = 'patient') {
  APP_STATE.authForm.role = role === 'doctor' ? 'doctor' : 'patient';
  localStorage.setItem('rourou.authRoleDraft', APP_STATE.authForm.role);
  updateAuthUI();
}

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

function normalizePinnedSessionRecord(record = {}) {
  const source = record && typeof record === 'object' ? record : {};
  const id = String(source.id || '').trim();
  if (!id) return null;
  return {
    id,
    user: String(source.user || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID,
    updatedAt: source.updatedAt || new Date().toISOString(),
    active_mode: String(source.active_mode || 'auto').trim() || 'auto',
    risk_flag: String(source.risk_flag || 'false').trim() || 'false',
    latest_tag_summary: String(source.latest_tag_summary || '').trim(),
    last_user_message: String(source.last_user_message || '').trim(),
    last_assistant_message: String(source.last_assistant_message || '').trim(),
    has_clinician_summary: Boolean(source.has_clinician_summary),
    has_fhir_draft: Boolean(source.has_fhir_draft),
    has_corrupted_history: Boolean(source.has_corrupted_history),
    message_count: Number.isFinite(Number(source.message_count)) ? Number(source.message_count) : 0,
    pinned_summary: String(source.pinned_summary || '').trim(),
    pinned_sub: String(source.pinned_sub || '').trim(),
    pinnedAt: source.pinnedAt || new Date().toISOString()
  };
}

function loadPinnedSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_SESSION_STORAGE_KEY) || 'null');
    // 不依 userId 過濾，避免帳號切換或登出後釘選對話消失
    return normalizePinnedSessionRecord(parsed);
  } catch {
    return null;
  }
}

function savePinnedSession(record = null) {
  const normalized = normalizePinnedSessionRecord(record);
  APP_STATE.pinnedSession = normalized;
  if (!normalized) {
    localStorage.removeItem(PINNED_SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(PINNED_SESSION_STORAGE_KEY, JSON.stringify(normalized));
}

function getPinCandidateSession() {
  const fromCurrent = summarizeSessionRecord(buildCurrentSessionRecord() || {});
  if (fromCurrent.id) {
    return fromCurrent;
  }
  const fromRecent = Array.isArray(APP_STATE.recentSessions) && APP_STATE.recentSessions.length
    ? APP_STATE.recentSessions[0]
    : getRecentSessionSummaries(1)[0];
  return fromRecent || null;
}

function buildPinnedSessionSnapshot(session = {}) {
  const summary = pickReadableSessionText(
    [session.last_user_message, session.last_assistant_message, session.latest_tag_summary],
    '這段釘選對話目前還沒有可讀摘要。'
  );
  const sub = pickReadableSessionText(
    [session.last_assistant_message, session.last_user_message, session.latest_tag_summary],
    '點進去可以直接展示這段對話。'
  );
  return {
    ...session,
    pinned_summary: summary,
    pinned_sub: sub,
    pinnedAt: new Date().toISOString()
  };
}

function syncPinnedSessionButtonState() {
  const pinButton = document.getElementById('chat-pin-session');
  if (!pinButton) return;
  const currentId = String(APP_STATE.conversationId || '').trim();
  const pinnedId = String(APP_STATE.pinnedSession?.id || '').trim();
  const isPinned = Boolean(currentId && pinnedId && currentId === pinnedId);
  pinButton.classList.toggle('is-active', isPinned);
  pinButton.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
  pinButton.setAttribute('aria-label', isPinned ? '取消釘選這段對話' : '釘選這段對話到首頁最上方');
  pinButton.title = isPinned ? '取消釘選這段對話' : '釘選這段對話到首頁最上方';
}

function togglePinnedSession() {
  const candidate = getPinCandidateSession();
  if (!candidate || !candidate.id) {
    appendSystemNotice('目前還沒有可釘選的對話，先聊一段再釘選。');
    return;
  }

  const currentPinnedId = String(APP_STATE.pinnedSession?.id || '').trim();
  if (currentPinnedId && currentPinnedId === candidate.id) {
    savePinnedSession(null);
    appendSystemNotice('已取消釘選。');
    syncPinnedSessionButtonState();
    if (APP_STATE.currentScreen === 'screen-home') {
      renderRecentSessions();
    }
    return;
  }

  savePinnedSession(buildPinnedSessionSnapshot(candidate));
  appendSystemNotice('已釘選這段對話，首頁最上方會固定顯示給評審先看。');
  syncPinnedSessionButtonState();
  if (APP_STATE.currentScreen === 'screen-home') {
    renderRecentSessions();
  }
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

const OUTPUT_COUNTDOWN_CONFIG = {
  fhir_delivery: {
    key: 'fhir-draft-countdown',
    seconds: 60,
    pendingText: 'FHIR 草稿 AI 分析中',
    completedText: 'FHIR 草稿分析完成。',
    failedPrefix: 'FHIR 草稿分析失敗'
  },
  patient_analysis: {
    key: 'patient-analysis-countdown',
    seconds: 45,
    pendingText: '病人分析 AI 整理中',
    completedText: '病人分析整理完成。',
    failedPrefix: '病人分析整理失敗'
  },
  clinician_summary: {
    key: 'clinician-summary-countdown',
    seconds: 45,
    pendingText: '醫師摘要 AI 整理中',
    completedText: '醫師摘要整理完成。',
    failedPrefix: '醫師摘要整理失敗'
  }
};

const PatientProfile = {
  KEY: PATIENT_PROFILE_STORAGE_KEY,

  get() {
    try {
      return this._normalize(JSON.parse(localStorage.getItem(this.KEY)));
    } catch {
      return this._normalize({});
    }
  },

  save(profile) {
    const current = this.get();
    const nextProfile = this._normalize({
      ...current,
      ...(profile && typeof profile === 'object' ? profile : {})
    });
    const now = new Date().toISOString();
    nextProfile.updatedAt = now;
    nextProfile.createdAt = current.createdAt || nextProfile.createdAt || now;
    nextProfile.profileKey = nextProfile.profileKey || current.profileKey || this._createProfileKey();
    if (this.isComplete(nextProfile) && !nextProfile.completedAt) {
      nextProfile.completedAt = now;
    }
    localStorage.setItem(this.KEY, JSON.stringify(nextProfile));
    this.renderUI(nextProfile);
    this.scheduleSessionSync(nextProfile);
    return nextProfile;
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
          patient_profile: profile || this.get()
        })
      });
    } catch {
      // Best-effort sync; local copy remains available even if server write fails.
    }
  },

  isComplete(profile = null) {
    const target = profile || this.get();
    return Boolean(
      String(target.name || '').trim() &&
      String(target.birthDate || '').trim() &&
      String(target.gender || '').trim() &&
      String(target.phone || '').trim()
    );
  },

  applyToPatient(patient = {}) {
    const basePatient = patient && typeof patient === 'object'
      ? JSON.parse(JSON.stringify(patient))
      : {};
    const profile = this.get();
    if (!this.isComplete(profile)) {
      return basePatient;
    }

    const telecom = [
      profile.phone
        ? {
            system: 'phone',
            value: profile.phone,
            use: 'mobile'
          }
        : null,
      profile.email
        ? {
            system: 'email',
            value: profile.email,
            use: 'home'
          }
        : null
    ].filter(Boolean);

    const emergencyContact = (profile.emergencyName || profile.emergencyPhone)
      ? [{
          relationship: [{ text: 'Emergency contact' }],
          name: profile.emergencyName ? { text: profile.emergencyName } : undefined,
          telecom: profile.emergencyPhone
            ? [{
                system: 'phone',
                value: profile.emergencyPhone,
                use: 'mobile'
              }]
            : undefined
        }]
      : [];

    return {
      ...basePatient,
      key: String(basePatient.key || '').trim() || profile.profileKey,
      name: profile.name,
      gender: profile.gender,
      birthDate: profile.birthDate,
      phone: profile.phone,
      email: profile.email,
      emergencyName: profile.emergencyName,
      emergencyPhone: profile.emergencyPhone,
      telecom,
      contact: emergencyContact
    };
  },

  applyToSessionExport(sessionExport = {}) {
    const baseExport = sessionExport && typeof sessionExport === 'object'
      ? JSON.parse(JSON.stringify(sessionExport))
      : {};
    baseExport.patient = this.applyToPatient(baseExport.patient || {});
    return baseExport;
  },

  buildReferenceSummary(patient = {}) {
    const source = patient && typeof patient === 'object' ? patient : {};
    const lines = [
      source.name ? { label: '姓名', value: source.name } : null,
      source.birthDate ? { label: '生日', value: source.birthDate } : null,
      source.gender ? { label: '性別', value: this._formatGender(source.gender) } : null,
      source.phone ? { label: '聯絡電話', value: source.phone } : null,
      source.email ? { label: 'Email', value: source.email } : null,
      source.emergencyName ? { label: '緊急聯絡人', value: source.emergencyName } : null,
      source.emergencyPhone ? { label: '緊急聯絡電話', value: source.emergencyPhone } : null
    ].filter(Boolean);

    return {
      isComplete: Boolean(
        String(source.name || '').trim() &&
        String(source.birthDate || '').trim() &&
        String(source.gender || '').trim() &&
        String(source.phone || '').trim()
      ),
      lines
    };
  },

  renderUI(profile = null) {
    const current = profile || this.get();
    const nameNode = document.getElementById('settings-profile-name');
    const subtitleNode = document.getElementById('settings-profile-subtitle');
    const statusNode = document.getElementById('settings-profile-status');

    if (nameNode) {
      nameNode.textContent = this.isComplete(current)
        ? current.name
        : '訪客模式';
    }

    if (subtitleNode) {
      subtitleNode.textContent = this.isComplete(current)
        ? (current.email || current.phone || 'Patient Draft 會優先引用這份基本資料')
        : '先補齊基本資料，Patient Draft 才會帶入真實病人欄位';
    }

    if (statusNode) {
      const complete = this.isComplete(current);
      statusNode.textContent = complete ? '已完成' : '未完成';
      statusNode.classList.toggle('complete', complete);
      statusNode.classList.toggle('incomplete', !complete);
    }

    const form = document.getElementById('patient-profile-form');
    if (form) {
      form.querySelector('#patient-profile-name').value = current.name || '';
      form.querySelector('#patient-profile-birthDate').value = current.birthDate || '';
      form.querySelector('#patient-profile-gender').value = current.gender || '';
      form.querySelector('#patient-profile-phone').value = current.phone || '';
      form.querySelector('#patient-profile-email').value = current.email || '';
      form.querySelector('#patient-profile-emergencyName').value = current.emergencyName || '';
      form.querySelector('#patient-profile-emergencyPhone').value = current.emergencyPhone || '';
    }
  },

  openModal() {
    const overlay = document.getElementById('patient-profile-overlay');
    if (!overlay) return;
    this.renderUI();
    this.setError('');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    const overlay = document.getElementById('patient-profile-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.setError('');
  },

  setError(message = '') {
    const errorNode = document.getElementById('patient-profile-error');
    if (!errorNode) return;
    errorNode.hidden = !message;
    errorNode.textContent = message || '';
  },

  wireForm() {
    const overlay = document.getElementById('patient-profile-overlay');
    const form = document.getElementById('patient-profile-form');
    const birthDateInput = document.getElementById('patient-profile-birthDate');

    if (birthDateInput && !birthDateInput.max) {
      birthDateInput.max = new Date().toISOString().slice(0, 10);
    }

    if (overlay && !overlay.dataset.wired) {
      overlay.dataset.wired = 'true';
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          this.closeModal();
        }
      });
    }

    if (form && !form.dataset.wired) {
      form.dataset.wired = 'true';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
          name: String(formData.get('name') || '').trim(),
          birthDate: String(formData.get('birthDate') || '').trim(),
          gender: String(formData.get('gender') || '').trim(),
          phone: String(formData.get('phone') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          emergencyName: String(formData.get('emergencyName') || '').trim(),
          emergencyPhone: String(formData.get('emergencyPhone') || '').trim()
        };

        const error = this.validate(payload);
        if (error) {
          this.setError(error);
          return;
        }

        const saved = this.save(payload);
        if (APP_STATE.reportOutputs.session_export && typeof APP_STATE.reportOutputs.session_export === 'object') {
          APP_STATE.reportOutputs.session_export = this.applyToSessionExport(APP_STATE.reportOutputs.session_export);
        }
        if (APP_STATE.pendingConsent.sessionExport && typeof APP_STATE.pendingConsent.sessionExport === 'object') {
          APP_STATE.pendingConsent.sessionExport = this.applyToSessionExport(APP_STATE.pendingConsent.sessionExport);
        }
        if (isValidFhirDraftOutput(APP_STATE.reportOutputs.fhir_delivery)) {
          APP_STATE.reportOutputs.fhir_delivery = normalizeFhirDraftPayload({
            output: APP_STATE.reportOutputs.fhir_delivery,
            session_export: APP_STATE.reportOutputs.session_export || APP_STATE.pendingConsent.sessionExport || {}
          }).output;
        }
        renderReportOutputs();
        saveReportOutputsToCache();
        this.closeModal();
        appendSystemNotice(`個人資料已儲存，Patient Draft 之後會優先引用 ${saved.name} 的基本資料。`);
      });
    }
  },

  validate(profile = {}) {
    if (!String(profile.name || '').trim()) return '姓名是必填欄位。';
    if (!String(profile.birthDate || '').trim()) return '生日是必填欄位。';
    if (!String(profile.gender || '').trim()) return '性別是必填欄位。';
    if (!String(profile.phone || '').trim()) return '聯絡電話是必填欄位。';
    if (profile.birthDate && profile.birthDate > new Date().toISOString().slice(0, 10)) {
      return '生日不能晚於今天。';
    }
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      return 'Email 格式看起來不太對，幫我再確認一下。';
    }
    return '';
  },

  _formatGender(gender = '') {
    const value = String(gender || '').trim().toLowerCase();
    if (value === 'male') return '男性';
    if (value === 'female') return '女性';
    if (value === 'other') return '其他';
    if (value === 'unknown') return '不透露 / 尚未確認';
    return value || '未填寫';
  },

  _createProfileKey() {
    return `patient-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  },

  _normalize(profile) {
    const source = profile && typeof profile === 'object' ? profile : {};
    return {
      profileKey: String(source.profileKey || '').trim(),
      name: String(source.name || '').trim(),
      birthDate: String(source.birthDate || '').trim(),
      gender: String(source.gender || '').trim(),
      phone: String(source.phone || '').trim(),
      email: String(source.email || '').trim(),
      emergencyName: String(source.emergencyName || '').trim(),
      emergencyPhone: String(source.emergencyPhone || '').trim(),
      createdAt: String(source.createdAt || '').trim(),
      updatedAt: String(source.updatedAt || '').trim(),
      completedAt: String(source.completedAt || '').trim()
    };
  }
};

function createEmptyReportOutputs() {
  return {
    clinician_summary: null,
    patient_analysis: null,
    patient_review: null,
    fhir_delivery: null,
    fhir_delivery_result: null,
    session_export: null,
    updatedAt: ''
  };
}

function normalizeCachedReportOutputs(source = {}) {
  const base = createEmptyReportOutputs();
  const payload = source && typeof source === 'object' ? source : {};
  const reportOutputs = payload.reportOutputs && typeof payload.reportOutputs === 'object'
    ? payload.reportOutputs
    : payload;
  return {
    ...base,
    ...reportOutputs,
    updatedAt: String(reportOutputs.updatedAt || '').trim()
  };
}

function hasMeaningfulReportOutputs(outputs = {}) {
  if (!outputs || typeof outputs !== 'object') return false;
  return Boolean(
    isValidClinicianSummaryOutput(outputs.clinician_summary) ||
    isValidPatientAnalysisOutput(outputs.patient_analysis) ||
    (outputs.patient_review && typeof outputs.patient_review === 'object' && Object.keys(outputs.patient_review).length) ||
    isValidFhirDraftOutput(outputs.fhir_delivery) ||
    (outputs.fhir_delivery_result && typeof outputs.fhir_delivery_result === 'object' && Object.keys(outputs.fhir_delivery_result).length) ||
    (outputs.session_export && typeof outputs.session_export === 'object' && Object.keys(outputs.session_export).length)
  );
}

function saveReportOutputsToCache(options = {}) {
  try {
    const reportOutputs = APP_STATE.reportOutputs || createEmptyReportOutputs();
    if (!options.allowEmpty && !hasMeaningfulReportOutputs(reportOutputs)) {
      return;
    }
    const conversationId = APP_STATE.conversationId || '';
    const key = getReportCacheKey(conversationId);
    localStorage.setItem(key, JSON.stringify({
      reportOutputs,
      conversationId,
      savedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.warn('Unable to cache report outputs:', error);
  }
}

// 為指定的 conversationId 還原報表（per-conversation）
function restoreReportOutputsForSession(conversationId) {
  try {
    const key = getReportCacheKey(conversationId);
    let parsed = JSON.parse(localStorage.getItem(key) || 'null');

    // 遷移：若新 key 無資料，嘗試從舊的全域 key 讀（且 conversationId 相符）
    if (!parsed) {
      const legacy = JSON.parse(localStorage.getItem(REPORT_OUTPUT_CACHE_KEY) || 'null');
      if (legacy && legacy.conversationId === conversationId) {
        parsed = legacy;
        // 遷移到新 key，刪舊 key
        localStorage.setItem(key, JSON.stringify(parsed));
        localStorage.removeItem(REPORT_OUTPUT_CACHE_KEY);
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      // 此對話無報表快取，清空報表讓它從 session_export 重建
      APP_STATE.reportOutputs = createEmptyReportOutputs();
      return;
    }

    APP_STATE.reportOutputs = normalizeCachedReportOutputs(parsed);
    if (APP_STATE.reportOutputs.session_export && typeof APP_STATE.reportOutputs.session_export === 'object') {
      APP_STATE.reportOutputs.session_export = PatientProfile.applyToSessionExport(APP_STATE.reportOutputs.session_export);
      syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
      syncTherapeuticMemoryFromSessionExport(APP_STATE.reportOutputs.session_export);
      syncPhq9SessionState();
    }
    if (isValidFhirDraftOutput(APP_STATE.reportOutputs.fhir_delivery)) {
      APP_STATE.reportFhirDraft = { isLoading: false, error: '', emptyReason: '' };
    }
  } catch (error) {
    console.warn('Unable to restore report outputs for session:', error);
  }
}

// 向後相容的包裝（頁面初始化時使用當前 conversationId）
function restoreReportOutputsFromCache() {
  restoreReportOutputsForSession(APP_STATE.conversationId || '');
}

const OUTPUT_COMMANDS = [
  { type: 'clinician_summary', patterns: [/幫我整理給醫生/, /整理給醫師/, /整理成.*給醫(師|生).*(重點|摘要|版本)?/i, /醫師摘要/, /clinician summary/i, /doctor summary/i] },
  { type: 'patient_analysis', patterns: [/請分析我/, /分析我/, /給我分析/, /給我病人版本/, /patient analysis/i] },
  { type: 'patient_review', patterns: [/病人審閱稿/, /patient review/i] },
  { type: 'fhir_delivery', patterns: [/fhir draft/i, /\bfhir\b/i, /產生fhir/i] }
];

const MODE_SWITCH_PATTERNS = [
  /切回.*auto/i,
  /切換到.*(auto|void|soulmate|mission|option|natural|clarify)/i,
  /模式$/i
];

const UI_CONTROL_PATTERNS = [
  /^output:/i,
  /幫我整理給醫(師|生)/i,
  /整理成.*給醫(師|生).*(重點|摘要|版本)?/i,
  /病人審閱稿/i,
  /授權狀態/i,
  /請幫我.*(生成|產生|準備).*(fhir|草稿|摘要)/i,
  /準備授權預覽/i,
  /session export/i
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

const HAMD_SIGNAL_LABELS = {
  depressed_mood: '情緒低落',
  guilt: '罪惡感 / 自責',
  suicide: '自傷想法',
  insomnia_early: '入睡困難',
  insomnia_middle: '夜間中醒',
  insomnia_late: '早醒',
  insomnia: '睡眠障礙',           // legacy alias
  work_activities: '興趣與功能',
  work_interest: '工作與興趣下降', // legacy alias
  retardation: '動作 / 思考遲滯',
  agitation: '焦躁不安',
  somatic_anxiety: '身體焦慮症狀',
  appetite_weight: '食慾 / 體重',
  psychic_anxiety: '心理焦慮',
  appetite_loss: '食慾下降',       // legacy alias
  fatigue: '疲倦 / 無力'
};

// 11 核心維度（與任務引導器及追蹤器同步）
const HAMD_PROGRESS_DIMENSIONS = [
  'depressed_mood',
  'guilt',
  'suicide',
  'insomnia_early',
  'insomnia_middle',
  'insomnia_late',
  'work_activities',
  'retardation',
  'agitation',
  'somatic_anxiety',
  'appetite_weight'
];

// 舊版 7 題與新版 11 題的別名對應
const HAMD_LEGACY_ALIAS = {
  insomnia: ['insomnia_early', 'insomnia_middle', 'insomnia_late'],
  work_interest: ['work_activities'],
  appetite_loss: ['appetite_weight']
};

function normalizeHamdDimensionList(rawList = []) {
  // 將舊版別名展開成新版代號，並過濾出有效代號
  const expanded = [];
  getMeaningfulItems(rawList).forEach((key) => {
    if (HAMD_PROGRESS_DIMENSIONS.includes(key)) {
      expanded.push(key);
    } else if (HAMD_LEGACY_ALIAS[key]) {
      HAMD_LEGACY_ALIAS[key].forEach((alias) => {
        if (!expanded.includes(alias)) expanded.push(alias);
      });
    }
  });
  return [...new Set(expanded)];
}

function getHamdSummary(summary = {}, progress = {}, formalAssessment = {}) {
  const concerns = getMeaningfulItems(summary?.chief_concerns);
  const observations = getMeaningfulItems(summary?.symptom_observations);
  const evidence = getMeaningfulItems(progress?.recent_evidence);
  const rawSignalCandidates = [
    ...getMeaningfulItems(summary?.hamd_signals),
    ...getMeaningfulItems(progress?.covered_dimensions),
    ...getMeaningfulItems(progress?.supported_dimensions)
  ];
  const coveredDimensions = normalizeHamdDimensionList(rawSignalCandidates);
  const missingDimensions = HAMD_PROGRESS_DIMENSIONS.filter((d) => !coveredDimensions.includes(d));
  const missingDimensionCount = missingDimensions.length;

  // 逐題狀態（從 progress.items 讀取，若無則從 covered_dimensions 推算）
  const progressItems = Array.isArray(progress?.items) ? progress.items : [];
  const itemStatusMap = {};
  progressItems.forEach((item) => {
    const code = String(item?.item || '').trim();
    if (code) itemStatusMap[code] = item;
  });
  const perItemStatus = HAMD_PROGRESS_DIMENSIONS.map((dim) => {
    const tracked = itemStatusMap[dim];
    const isCovered = coveredDimensions.includes(dim);
    return {
      item: dim,
      label: formatHamdSignalLabel(dim),
      status: tracked?.status || (isCovered ? 'partial' : 'missing'),
      evidence: getMeaningfulItems(tracked?.evidence || []),
      missing: getMeaningfulItems(tracked?.missing || [])
    };
  });

  const nextQuestionHint = String(progress?.next_question_hint || '').trim();
  const nextTarget = String(progress?.next_recommended_dimension || progress?.current_focus || '').trim();

  const formalItems = Array.isArray(formalAssessment?.items) ? formalAssessment.items : [];
  const ratedItems = formalItems.filter((item) => Number.isFinite(Number(item?.clinician_final_score)) || Number.isFinite(Number(item?.ai_suggested_score)));
  const clinicianRatedItems = formalItems.filter((item) => Number.isFinite(Number(item?.clinician_final_score)));
  const evidenceBackedItems = formalItems.filter((item) => {
    const evidenceType = String(item?.evidence_type || '').trim();
    return evidenceType && evidenceType !== 'none';
  });

  const evidencePoolCount = [...new Set([...concerns, ...observations, ...evidence])].length;
  const dimensionScore = (coveredDimensions.length / HAMD_PROGRESS_DIMENSIONS.length) * 50;
  const evidenceScore = (Math.min(evidencePoolCount, 10) / 10) * 25;
  const formalScore = formalItems.length ? (ratedItems.length / formalItems.length) * 25 : 0;
  const momentumBonus = coveredDimensions.length >= 2 && evidencePoolCount >= 2 ? 5 : 0;

  let progressPercent = Math.round(dimensionScore + evidenceScore + formalScore + momentumBonus);
  if (!coveredDimensions.length && !evidencePoolCount && !ratedItems.length) {
    progressPercent = 12;
  } else {
    progressPercent = Math.max(12, Math.min(96, progressPercent));
  }

  if (formalItems.length && clinicianRatedItems.length === formalItems.length) {
    progressPercent = 100;
  } else if (formalItems.length && clinicianRatedItems.length > 0) {
    const clinicianReviewFloor = 72 + Math.round((clinicianRatedItems.length / formalItems.length) * 24);
    progressPercent = Math.max(progressPercent, Math.min(99, clinicianReviewFloor));
  }

  let progressLabel = '剛開始蒐集 HAM-D 線索';
  if (progressPercent >= 85) {
    progressLabel = '接近完整，可供人工覆核';
  } else if (progressPercent >= 65) {
    progressLabel = '已形成較完整評估草稿';
  } else if (progressPercent >= 45) {
    progressLabel = '已覆蓋多個重點面向';
  } else if (progressPercent >= 25) {
    progressLabel = '已有初步症狀對應';
  }

  let trend = '目前仍以自然對話蒐集線索，還需要更多可映射描述。';
  if (formalItems.length && clinicianRatedItems.length) {
    trend = `正式題項已由人工確認 ${clinicianRatedItems.length}/${formalItems.length} 題，剩餘題項可再逐步補齊。`;
  } else if (formalItems.length && ratedItems.length) {
    trend = `正式題項草稿已建立 ${ratedItems.length}/${formalItems.length} 題，仍需人工覆核與補問。`;
  } else if (coveredDimensions.length) {
    trend = `目前已覆蓋 ${coveredDimensions.length}/${HAMD_PROGRESS_DIMENSIONS.length} 個核心維度，尚缺 ${missingDimensionCount} 個維度。`;
  }

  const secondaryStatLabel = formalItems.length ? '正式題項草稿' : 'HAM-D 維度';
  const secondaryStatValue = formalItems.length
    ? `${ratedItems.length}/${formalItems.length}`
    : `${coveredDimensions.length}/${HAMD_PROGRESS_DIMENSIONS.length}`;

  const supportingStatLabel = evidenceBackedItems.length ? '已有證據題項' : '可用證據';
  const supportingStatValue = evidenceBackedItems.length
    ? `${evidenceBackedItems.length} 題`
    : `${evidencePoolCount} 則`;
  const formalStats = buildHamdFormalStats(formalAssessment);
  const hasFormalScores = formalStats.scoredItems.length > 0;

  return {
    progressPercent,
    progressLabel: hasFormalScores ? formalStats.totalSource : progressLabel,
    trend: hasFormalScores
      ? `目前已有 ${formalStats.scoredItems.length}/${formalStats.items.length} 題具備題項分數；每題的理由與證據可在明細中逐項檢查。`
      : trend,
    primaryStatLabel: hasFormalScores ? formalStats.totalSource : '目前完整度',
    primaryStatValue: hasFormalScores ? `${formalStats.displayedTotal}/${formalStats.maxTotal || 52}` : `${progressPercent}%`,
    secondaryStatLabel: hasFormalScores ? '已有分數題項' : secondaryStatLabel,
    secondaryStatValue: hasFormalScores ? `${formalStats.scoredItems.length}/${formalStats.items.length}` : secondaryStatValue,
    supportingStatLabel,
    supportingStatValue,
    // 逐題缺口資料（供 UI gap indicator 使用）
    coveredDimensions,
    missingDimensions,
    perItemStatus,
    nextTarget,
    nextQuestionHint
  };
}

function isMeaningfulDraftText(value = '') {
  const text = String(value || '').trim();
  return text && !isPlaceholderDraftText(text);
}

function cleanClinicalDisplayText(value = '') {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text
    .replace(/\brecent_dialogue\b/gi, '')
    .replace(/(?:對話中提及\s*){2,}/g, '對話中提及')
    .replace(/([。．！？!?])\1+/g, '$1')
    .replace(/，{2,}/g, '，')
    .replace(/\s+/g, ' ')
    .replace(/^對話中提及\s*對話中提及/, '對話中提及')
    .replace(/^\s*[，。；;:\-]+\s*/g, '')
    .replace(/\s*[，。；;:\-]+\s*$/g, '')
    .trim();
  if (!text) return '';
  if (/請幫我準備\s*FHIR\s*草稿|請幫我生成\s*FHIR\s*草稿|^output:/i.test(text)) return '';
  return text;
}

function getMeaningfulItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => cleanClinicalDisplayText(item))
    .filter((item, index, arr) => item && !isPlaceholderDraftText(item) && arr.indexOf(item) === index);
}

function formatHamdSignalLabel(signal) {
  const key = String(signal || '').trim();
  return HAMD_SIGNAL_LABELS[key] || key.replace(/_/g, ' ');
}

function getHamdScaleMax(scaleRange = '') {
  return String(scaleRange || '').trim() === '0_to_2' ? 2 : 4;
}

function getHamdItemScore(item = {}) {
  const clinicianScore = Number(item?.clinician_final_score);
  if (Number.isFinite(clinicianScore)) {
    return { value: clinicianScore, source: '醫師確認' };
  }
  const aiScore = Number(item?.ai_suggested_score);
  if (Number.isFinite(aiScore)) {
    return { value: aiScore, source: 'AI 建議' };
  }
  return { value: null, source: '未評分' };
}

function buildHamdFormalStats(formalAssessment = {}) {
  const items = Array.isArray(formalAssessment?.items) ? formalAssessment.items : [];
  const maxTotal = items.reduce((sum, item) => sum + getHamdScaleMax(item?.scale_range), 0);
  const scoredItems = items
    .map((item) => ({ item, score: getHamdItemScore(item) }))
    .filter(({ score }) => Number.isFinite(score.value));
  const aiTotal = scoredItems.reduce((sum, { score }) => sum + score.value, 0);
  const clinicianTotal = Number(formalAssessment?.clinician_total_score);
  const displayedTotal = Number.isFinite(clinicianTotal) ? clinicianTotal : aiTotal;
  const totalSource = Number.isFinite(clinicianTotal) ? '醫師確認總分' : 'AI 題項草稿總分';

  return {
    items,
    scoredItems,
    maxTotal,
    displayedTotal,
    totalSource,
    severityBand: String(formalAssessment?.severity_band || 'unrated').trim()
  };
}

function formatHamdEvidenceType(type = '') {
  const key = String(type || '').trim();
  const labels = {
    direct_answer: '直接回答',
    indirect_observation: '間接觀察',
    mixed: '直接 + 觀察',
    none: '尚無證據'
  };
  return labels[key] || key || '尚無證據';
}

function renderHamdFormalDetail(formalAssessment = {}) {
  const stats = buildHamdFormalStats(formalAssessment);
  if (!stats.items.length) {
    return '<p class="report-empty-copy">目前還沒有可顯示的 HAM-D 題項明細。</p>';
  }

  const rows = stats.items.map((item) => {
    const score = getHamdItemScore(item);
    const maxScore = getHamdScaleMax(item?.scale_range);
    const evidenceSummary = getMeaningfulItems(item?.evidence_summary);
    const rationale = cleanClinicalDisplayText(item?.rating_rationale);
    const reviewRequired = item?.review_required ? '需人工覆核' : '可作為草稿參考';
    const scoreText = Number.isFinite(score.value) ? `${score.value}/${maxScore}` : `未評分/${maxScore}`;

    return `
      <div class="hamd-detail-row">
        <div class="hamd-detail-score">
          <strong>${escapeHtml(scoreText)}</strong>
          <span>${escapeHtml(score.source)}</span>
        </div>
        <div class="hamd-detail-body">
          <div class="hamd-detail-title">${escapeHtml(item?.item_label || item?.item_code || '未命名題項')}</div>
          <div class="hamd-detail-meta">
            <span>${escapeHtml(formatHamdEvidenceType(item?.evidence_type))}</span>
            <span>${escapeHtml(reviewRequired)}</span>
            <span>信心：${escapeHtml(item?.confidence || '未標記')}</span>
          </div>
          <p>${escapeHtml(rationale || '尚未形成可查證的評分理由。')}</p>
          ${evidenceSummary.length
            ? `<ul>${evidenceSummary.map((evidence) => `<li>${escapeHtml(evidence)}</li>`).join('')}</ul>`
            : '<p class="hamd-detail-empty">尚無逐題證據摘要。</p>'}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="hamd-detail-summary">
      <span>${escapeHtml(stats.totalSource)}：${stats.displayedTotal}/${stats.maxTotal || 52}</span>
      <span>已有分數題項：${stats.scoredItems.length}/${stats.items.length}</span>
      <span>嚴重度草稿：${escapeHtml(stats.severityBand || 'unrated')}</span>
    </div>
    <div class="hamd-detail-list">${rows}</div>
  `;
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

function renderHamdGapIndicator(hamd = {}) {
  const perItem = Array.isArray(hamd.perItemStatus) ? hamd.perItemStatus : [];
  if (!perItem.length) {
    return '<p class="hamd-gap-empty">尚未蒐集任何 HAM-D 線索，請先開始與 Rou Rou 對話。</p>';
  }

  const completeItems = perItem.filter((i) => i.status === 'complete');
  const partialItems = perItem.filter((i) => i.status === 'partial');
  const missingItems = perItem.filter((i) => i.status === 'missing');

  const renderItem = (item, icon, cls) => {
    const evidenceStr = item.evidence && item.evidence.length
      ? `<span class="hamd-gap-evidence">${escapeHtml(item.evidence.slice(0, 2).join('；'))}</span>`
      : '';
    const missingStr = item.missing && item.missing.length
      ? `<span class="hamd-gap-missing-hint">尚缺：${escapeHtml(item.missing.join('、'))}</span>`
      : '';
    return `<div class="hamd-gap-item ${cls}">
      <span class="hamd-gap-icon">${icon}</span>
      <span class="hamd-gap-label">${escapeHtml(item.label)}</span>
      ${evidenceStr}${missingStr}
    </div>`;
  };

  const completedHtml = completeItems.length
    ? `<div class="hamd-gap-group">
        <div class="hamd-gap-group-title covered">✔ 已可評分（${completeItems.length} 題）</div>
        ${completeItems.map((i) => renderItem(i, '✔', 'is-complete')).join('')}
      </div>`
    : '';

  const partialHtml = partialItems.length
    ? `<div class="hamd-gap-group">
        <div class="hamd-gap-group-title partial">◑ 部分蒐集，需補問（${partialItems.length} 題）</div>
        ${partialItems.map((i) => renderItem(i, '◑', 'is-partial')).join('')}
      </div>`
    : '';

  const missingHtml = missingItems.length
    ? `<div class="hamd-gap-group">
        <div class="hamd-gap-group-title missing">❗ 尚未提及（${missingItems.length} 題）</div>
        ${missingItems.map((i) => renderItem(i, '❗', 'is-missing')).join('')}
      </div>`
    : '';

  const nextHint = hamd.nextQuestionHint
    ? `<div class="hamd-gap-next">
        <span class="hamd-gap-next-label">💬 建議追問：</span>
        <span class="hamd-gap-next-question">${escapeHtml(hamd.nextQuestionHint)}</span>
      </div>`
    : (hamd.nextTarget
        ? `<div class="hamd-gap-next">
            <span class="hamd-gap-next-label">🎯 下一個重點：</span>
            <span class="hamd-gap-next-question">${escapeHtml(formatHamdSignalLabel(hamd.nextTarget))}</span>
          </div>`
        : '');

  return `${completedHtml}${partialHtml}${missingHtml}${nextHint}`;
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

function toggleHamdDetail() {
  const panel = document.getElementById('report-hamd-detail-panel');
  const toggle = document.getElementById('report-hamd-detail-toggle');
  if (!panel) return;
  const nextHidden = !panel.hidden ? true : false;
  panel.hidden = nextHidden;
  if (toggle) {
    toggle.classList.toggle('active', !nextHidden);
    const icon = toggle.querySelector('.mat-icon');
    if (icon) icon.textContent = nextHidden ? 'expand_more' : 'expand_less';
  }
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
  const concerns = getMeaningfulItems(summary?.chief_concerns || []);
  const observations = getMeaningfulItems(summary?.symptom_observations || []);
  const hamdSignals = getMeaningfulItems(summary?.hamd_signals || []);
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

  return `<div class="markdown-body report-markdown">${renderMessageMarkdown(markdown)}</div>`;
}

function buildDoctorAssignmentBlocks(entry = {}) {
  if (entry.medicalRecordStatus !== '已送入') {
    return [];
  }
  const record = normalizeMedicalRecord(entry.medicalRecord);
  const blocks = [];
  const summaryItems = [
    record.composition.chiefComplaint && `主訴：${record.composition.chiefComplaint}`,
    record.composition.symptomSummary && `症狀摘要：${record.composition.symptomSummary}`,
    record.composition.riskAlert && `風險提醒：${record.composition.riskAlert}`,
    record.composition.followupSuggestion && `追蹤建議：${record.composition.followupSuggestion}`
  ].filter(Boolean);
  const observationItems = record.observations
    .map((item) => [item.display || item.code, item.value, item.interpretation].filter(Boolean).join('｜'))
    .filter(Boolean)
    .slice(0, 4);
  const conditionItems = record.conditions
    .map((item) => [item.code, item.clinicalStatus, item.verificationStatus].filter(Boolean).join('｜'))
    .filter(Boolean)
    .slice(0, 4);
  const medicationItems = record.medications
    .map((item) => [item.name, item.dosage].filter(Boolean).join('｜'))
    .filter(Boolean)
    .slice(0, 4);
  const documentItems = record.documents
    .map((item) => [item.type, item.filename].filter(Boolean).join('｜'))
    .filter(Boolean)
    .slice(0, 4);

  if (summaryItems.length) blocks.push({ title: '病歷重點', items: summaryItems });
  if (observationItems.length) blocks.push({ title: '觀察紀錄', items: observationItems });
  if (conditionItems.length) blocks.push({ title: '診斷 / 狀態', items: conditionItems });
  if (medicationItems.length) blocks.push({ title: '用藥資訊', items: medicationItems });
  if (documentItems.length) blocks.push({ title: '附件文件', items: documentItems });

  if (!blocks.length && entry.medicalRecordStatus === '已送入') {
    blocks.push({ title: '病歷重點', items: ['醫師已送出病歷，目前尚未附帶可閱讀摘要。'] });
  }

  return blocks;
}

function renderDoctorAssignmentCard(entry = null) {
  if (!entry) {
    return `
      <div class="doctor-assignment-empty">
        <span class="mat-icon">assignment_ind</span>
        <p>目前還沒有新的醫生指派<br>等醫師送出病歷或醫囑後，這裡就會更新。</p>
      </div>
    `;
  }

  const order = normalizeDoctorOrder(entry.orderDraft, entry.orderStatus, entry);
  const hasOrder = hasPublishedDoctorOrder(order);
  const blocks = buildDoctorAssignmentBlocks(entry);
  const orderMetaItems = [
    ['類型', order.type || '未分類'],
    ['執行對象', order.assignee || '病人'],
    ['期限', order.duePreset === '指定日期' && order.dueDate ? order.dueDate : (order.duePreset || '未指定')],
    ['優先程度', order.priority || '一般'],
    ['回覆需求', order.replyRequirement || '不需回覆'],
    ['對應任務', order.taskRef || '未指定']
  ];
  const syncedLabel = entry.syncedAt
    ? new Date(entry.syncedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '剛剛';

  return `
    <div class="doctor-assignment-head">
      <div>
        <div class="doctor-assignment-title">來自 ${escapeHtml(entry.doctorName || '醫師')} 的指派</div>
        <div class="doctor-assignment-meta">${escapeHtml(entry.patientNumber || entry.patientName || '')} ・ 更新時間 ${escapeHtml(syncedLabel)}</div>
      </div>
      <div class="doctor-assignment-status-group">
        <span class="doctor-status-pill ${getDoctorStatusClass(entry.medicalRecordStatus)}">${escapeHtml(entry.medicalRecordStatus || '待送入')}</span>
        <span class="doctor-status-pill ${getDoctorStatusClass(entry.orderStatus)}">${escapeHtml(entry.orderStatus || '未填寫')}</span>
      </div>
    </div>
    <div class="doctor-assignment-grid">
      <section class="doctor-assignment-block">
        <div class="doctor-assignment-block-title">病歷</div>
        ${blocks.length ? blocks.map((block) => `
          <div class="doctor-assignment-subblock">
            <div class="doctor-assignment-subtitle">${escapeHtml(block.title)}</div>
            ${block.items.map((item) => `
              <div class="doctor-assignment-item">
                <span class="mat-icon">description</span>
                <div>${escapeHtml(item)}</div>
              </div>
            `).join('')}
          </div>
        `).join('') : `
          <div class="doctor-assignment-empty-inline">醫師尚未送出病歷內容。</div>
        `}
      </section>
      <section class="doctor-assignment-block">
        <div class="doctor-assignment-block-title">醫囑</div>
        ${hasOrder ? `
          <div class="doctor-assignment-order-card">
            <div class="doctor-assignment-order-content">
              <b>內容</b>
              <span>${escapeHtml(order.content)}</span>
            </div>
            <div class="doctor-assignment-order-meta-row">
              ${orderMetaItems.map(([label, value]) => `
                <div class="doctor-assignment-order-pill">
                  <b>${escapeHtml(label)}</b>
                  <span>${escapeHtml(value)}</span>
                </div>
              `).join('')}
            </div>
            ${order.note ? `<div class="doctor-assignment-order-note">${escapeHtml(order.note)}</div>` : ''}
            <div class="doctor-assignment-trace">
              ${order.createdBy ? `<span>建立者：${escapeHtml(order.createdBy)}</span>` : ''}
              ${order.createdAt ? `<span>建立時間：${escapeHtml(order.createdAt)}</span>` : ''}
              ${order.encounterRef ? `<span>Encounter：${escapeHtml(order.encounterRef)}</span>` : ''}
              ${order.summaryRef ? `<span>Summary：${escapeHtml(order.summaryRef)}</span>` : ''}
              ${order.observationRef ? `<span>Observation：${escapeHtml(order.observationRef)}</span>` : ''}
            </div>
          </div>
        ` : `
          <div class="doctor-assignment-empty-inline">目前還沒有新的醫囑內容。</div>
        `}
      </section>
    </div>
  `;
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
  const preferredOrder = ['Patient', 'Encounter', 'QuestionnaireResponse', 'Observation', 'ClinicalImpression', 'Composition', 'DocumentReference', 'Provenance'];

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

function buildPatientRefreshSnapshot(sessionExport = null) {
  const normalizedSessionExport = PatientProfile.applyToSessionExport(sessionExport || {});
  if (!normalizedSessionExport || typeof normalizedSessionExport !== 'object' || !normalizedSessionExport.patient) return null;
  const patientKey = String(normalizedSessionExport.patient.key || '').trim();
  if (!patientKey) return null;
  return {
    patient: JSON.parse(JSON.stringify(normalizedSessionExport.patient)),
    session: {
      encounterKey: String(normalizedSessionExport?.session?.encounterKey || '').trim()
    },
    __deliveryTargetUrl: String(normalizedSessionExport?.__deliveryTargetUrl || '').trim(),
    __deliverySuffix: String(normalizedSessionExport?.__deliverySuffix || '').trim()
  };
}

function resolvePatientRefreshPayload(historyPayload = null) {
  const basePayload = historyPayload && typeof historyPayload === 'object'
    ? historyPayload
    : buildCurrentPatientRefreshPayload();
  return buildPatientRefreshSnapshot(basePayload);
}

function canRefreshFhirResource(link, refreshPayload = null) {
  return Boolean(
    link &&
    link.resourceType === 'Patient' &&
    /^Patient\/[^/]+$/i.test(String(link.path || '').trim()) &&
    refreshPayload?.patient?.key
  );
}

function isRefreshingFhirResource(resourcePath = '', entryId = '') {
  return Boolean(
    APP_STATE.fhirResourceRefresh?.active &&
    APP_STATE.fhirResourceRefresh.resourcePath === resourcePath &&
    (!entryId || APP_STATE.fhirResourceRefresh.entryId === entryId)
  );
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
  const patientRefreshPayload = buildPatientRefreshSnapshot(sessionExport);
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
    patientRefreshPayload,
    draftPayload: deepCloneSerializable(draft || null, null),
    deliveryResultPayload: deepCloneSerializable(deliveryResult || null, null),
    sessionExportPayload: deepCloneSerializable(sessionExport || null, null),
    resourceCount: resourceLinks.length || (Array.isArray(draft?.resources) ? draft.resources.length : 0),
    fingerprint,
    lastRefreshedAt: ''
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

function extractFhirRefreshError(payload = {}) {
  const validationErrors = Array.isArray(payload?.validation_errors)
    ? payload.validation_errors.filter(Boolean)
    : [];
  if (validationErrors.length) {
    return validationErrors.join('；');
  }

  const issueDiagnostics = Array.isArray(payload?.resource_result?.body?.issue)
    ? payload.resource_result.body.issue
        .map((issue) => issue?.diagnostics || issue?.details?.text || issue?.code || '')
        .filter(Boolean)
    : [];
  if (issueDiagnostics.length) {
    return issueDiagnostics.join('；');
  }

  return payload?.resource_result?.error || payload?.error || 'Patient 更新失敗';
}

function getFhirRefreshBuildSummary(payload = {}) {
  const builtPatient = payload?.build_result?.resource_json;
  if (!payload?.build_result?.valid || !builtPatient) return '';
  const patientName = String(builtPatient?.name?.[0]?.text || builtPatient?.name?.text || '').trim();
  const patientIdentifier = String(builtPatient?.identifier?.[0]?.value || '').trim();
  const patientBirthDate = String(builtPatient?.birthDate || '').trim();
  return [
    patientName ? `姓名 ${patientName}` : '',
    patientIdentifier ? `識別值 ${patientIdentifier}` : '',
    patientBirthDate ? `生日 ${patientBirthDate}` : ''
  ].filter(Boolean).join('，');
}

function markFhirHistoryResourceRefreshed(entryId, resourcePath, refreshPayload = null, refreshedAt = '') {
  if (!entryId) return;
  let changed = false;
  APP_STATE.fhirReportHistory = (APP_STATE.fhirReportHistory || []).map((item) => {
    if (item.id !== entryId) return item;
    const hasResource = (item.resourceLinks || []).some((link) => link.path === resourcePath);
    if (!hasResource) return item;
    changed = true;
    return {
      ...item,
      patientRefreshPayload: refreshPayload || item.patientRefreshPayload || null,
      lastRefreshedAt: refreshedAt || new Date().toISOString()
    };
  });

  if (changed) {
    saveFhirReportHistory();
  }
}

function buildCurrentPatientRefreshPayload() {
  const deliveryTargetUrl = (
    APP_STATE.pendingConsent?.deliveryTargetUrl ||
    APP_STATE.reportOutputs?.session_export?.__deliveryTargetUrl ||
    APP_STATE.reportOutputs?.fhir_delivery_result?.fhir_base_url ||
    ''
  );
  const baseSessionExport = APP_STATE.pendingConsent?.sessionExport || APP_STATE.reportOutputs?.session_export || null;
  if (!baseSessionExport) return null;
  const preparedSessionExport = prepareSessionExportForDelivery(baseSessionExport, deliveryTargetUrl);
  preparedSessionExport.__deliveryTargetUrl = deliveryTargetUrl;
  return buildPatientRefreshSnapshot(preparedSessionExport);
}

async function refreshPatientResource(resourcePath, source = 'current', entryId = '') {
  const normalizedPath = String(resourcePath || '').trim();
  if (!/^Patient\/[^/]+$/i.test(normalizedPath)) {
    appendSystemNotice('目前只有 Patient 資源支援單獨更新。');
    return;
  }
  if (APP_STATE.fhirResourceRefresh?.active) return;

  const historyItem = source === 'history'
    ? (APP_STATE.fhirReportHistory || []).find((item) => item.id === entryId) || null
    : null;
  const refreshPayload = resolvePatientRefreshPayload(historyItem?.patientRefreshPayload || null);
  if (!refreshPayload?.patient?.key) {
    appendSystemNotice('現在找不到可用的 Patient 草稿資料，先回到目前對話重新開一次 FHIR 預覽就可以了。');
    return;
  }

  APP_STATE.fhirResourceRefresh = {
    active: true,
    resourcePath: normalizedPath,
    entryId: entryId || ''
  };
  renderReportOutputs();

  try {
    appendSystemNotice(`正在單獨更新 ${normalizedPath}，其他 FHIR 資源不會重送。`);
    const response = await fetch('/api/fhir/resource-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_type: 'Patient',
        resource_path: normalizedPath,
        session_export: refreshPayload
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(extractFhirRefreshError(payload));
    }
    if (
      payload?.refresh_status !== 'refreshed' ||
      payload?.build_result?.valid !== true ||
      payload?.build_result?.resource_json?.resourceType !== 'Patient' ||
      payload?.resource_result?.ok !== true
    ) {
      throw new Error('Patient builder 沒有成功重跑完成，這次更新不算數。');
    }

    const refreshedAt = new Date().toISOString();
    if (APP_STATE.reportOutputs?.fhir_delivery_result) {
      const deliveredPatient = findFhirResourceLink(APP_STATE.reportOutputs.fhir_delivery_result, 'Patient');
      if (deliveredPatient?.path === normalizedPath) {
        APP_STATE.reportOutputs.fhir_delivery_result.recorded_at = refreshedAt;
      }
    }

    markFhirHistoryResourceRefreshed(entryId, normalizedPath, refreshPayload, refreshedAt);
    saveReportOutputsToCache();
    renderReportOutputs();
    const buildSummary = getFhirRefreshBuildSummary(payload);
    appendSystemNotice(
      buildSummary
        ? `已重新跑過 Patient builder，並更新 ${normalizedPath}（${buildSummary}）。這次只重送 Patient，其他資源完全沒有動。`
        : `已重新跑過 Patient builder，並更新 ${normalizedPath}。這次只重送 Patient，其他資源完全沒有動。`
    );
  } catch (error) {
    renderReportOutputs();
    appendSystemNotice(error.message || 'Patient 更新失敗');
  } finally {
    APP_STATE.fhirResourceRefresh = {
      active: false,
      resourcePath: '',
      entryId: ''
    };
    renderReportOutputs();
  }
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
                ${item.lastRefreshedAt ? `<div class="fhir-history-time">最近更新：${escapeHtml(formatDateTimeLabel(item.lastRefreshedAt))}</div>` : ''}
              </div>
              <div class="fhir-history-card-actions">
                <button class="fhir-history-preview-btn" type="button" onclick="openFhirHistoryPreview('${escapeHtml(item.id)}')">預覽</button>
                <button class="fhir-history-delete-btn" type="button" onclick="removeFhirHistoryEntry('${escapeHtml(item.id)}')">刪除這筆</button>
              </div>
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
                  ${(() => {
                    const canRefresh = canRefreshFhirResource(link, item.patientRefreshPayload);
                    const refreshing = isRefreshingFhirResource(link.path, item.id);
                    return `
                  <div class="fhir-history-resource-item">
                    <div class="fhir-history-resource-copy">
                      <div class="fhir-history-resource-label">${escapeHtml(link.label)}</div>
                      <div class="fhir-history-resource-path">${link.url ? `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.path)}</a>` : escapeHtml(link.path)}</div>
                    </div>
                    <div class="fhir-history-resource-actions">
                      ${canRefresh ? `
                        <button
                          class="fhir-history-resource-refresh"
                          type="button"
                          onclick="refreshPatientResource('${escapeHtml(link.path)}', 'history', '${escapeHtml(item.id)}')"
                          ${refreshing ? 'disabled' : ''}
                        >${refreshing ? '更新中...' : '更新'}</button>
                      ` : ''}
                      <button class="fhir-history-resource-delete" type="button" onclick="removeFhirHistoryResource('${escapeHtml(item.id)}', '${escapeHtml(link.path)}')">刪除</button>
                    </div>
                  </div>
                `;
                  })()}
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
  const resources = Array.isArray(output.resources) ? output.resources.filter(Boolean) : [];
  return (
    (!isPlaceholderDraftText(narrative) && meaningfulSections.length > 0) ||
    observations.length > 0 ||
    targets.length > 0 ||
    resources.length > 0
  );
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

function isClinicalFallbackMessage(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  if (detectOutputCommand(normalized)) return false;
  if (MODE_SWITCH_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  if (UI_CONTROL_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return true;
}

function syncReportOutputsFromSessionExport(sessionExport = {}) {
  if (!sessionExport || typeof sessionExport !== 'object') return;
  const normalizedSessionExport = PatientProfile.applyToSessionExport(sessionExport);

  if (isValidClinicianSummaryOutput(normalizedSessionExport.clinician_summary_draft)) {
    APP_STATE.reportOutputs.clinician_summary = JSON.parse(JSON.stringify(normalizedSessionExport.clinician_summary_draft));
  }

  if (isValidPatientAnalysisOutput(normalizedSessionExport.patient_analysis)) {
    APP_STATE.reportOutputs.patient_analysis = JSON.parse(JSON.stringify(normalizedSessionExport.patient_analysis));
  }

  if (normalizedSessionExport.patient_review_packet && typeof normalizedSessionExport.patient_review_packet === 'object') {
    APP_STATE.reportOutputs.patient_review = JSON.parse(JSON.stringify(normalizedSessionExport.patient_review_packet));
  }

  if (isValidFhirDraftOutput(normalizedSessionExport.fhir_delivery_draft)) {
    APP_STATE.reportOutputs.fhir_delivery = JSON.parse(JSON.stringify(normalizedSessionExport.fhir_delivery_draft));
  }
  PHQ9Tracker.importFromSessionExport(normalizedSessionExport);
  publishHamdSummaryForDoctor(normalizedSessionExport);
}

function syncTherapeuticMemoryFromSessionExport(sessionExport = {}) {
  if (!sessionExport || typeof sessionExport !== 'object') return;

  if (sessionExport.therapeutic_profile && typeof sessionExport.therapeutic_profile === 'object') {
    const incomingProfile = TherapeuticMemory._normalize(sessionExport.therapeutic_profile);
    const currentProfile = TherapeuticMemory.get();
    const incomingItemCount = getTherapeuticProfileItemCount(incomingProfile);
    const currentItemCount = getTherapeuticProfileItemCount(currentProfile);
    const incomingTime = Date.parse(incomingProfile.lastUpdatedAt || incomingProfile.updatedAt || '');
    const currentTime = Date.parse(currentProfile.lastUpdatedAt || currentProfile.updatedAt || '');

    if (!incomingItemCount) return;
    if (currentItemCount && Number.isFinite(currentTime) && Number.isFinite(incomingTime) && incomingTime < currentTime) {
      return;
    }
    TherapeuticMemory.replace(incomingProfile, { skipSessionSync: true });
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

function getTherapeuticProfileItemCount(profile = {}) {
  if (!profile || typeof profile !== 'object') return 0;
  return [
    profile.stressors,
    profile.triggers,
    profile.keyThemes,
    profile.positiveAnchors,
    profile.memoryChunks
  ].reduce((count, items) => count + (Array.isArray(items) ? items.filter(Boolean).length : 0), 0) +
    (String(profile?.copingProfile?.preferredStyle || '').trim() ? 1 : 0) +
    (String(profile?.clinicianNotes || '').trim() ? 1 : 0);
}

function renderReportOutputs() {
  const clinician = APP_STATE.reportOutputs.clinician_summary || {};
  const patientAnalysis = APP_STATE.reportOutputs.patient_analysis || {};
  const patientReview = APP_STATE.reportOutputs.patient_review || {};
  const fhirDelivery = APP_STATE.reportOutputs.fhir_delivery || {};
  const fhirDeliveryResult = APP_STATE.reportOutputs.fhir_delivery_result || APP_STATE.pendingConsent.deliveryResult || null;
  const sessionExport = PatientProfile.applyToSessionExport(APP_STATE.pendingConsent.sessionExport || APP_STATE.reportOutputs.session_export || {});
  const hamdProgress = sessionExport?.hamd_progress_state || {};
  const hamdFormalAssessment = sessionExport?.hamd_formal_assessment || {};
  const updatedAt = APP_STATE.reportOutputs.updatedAt;
  const hamd = getHamdSummary(clinician, hamdProgress, hamdFormalAssessment);
  const hamdFormalStats = buildHamdFormalStats(hamdFormalAssessment);
  const doctorSummaryState = renderDoctorSummary(clinician);
  const doctorAssignment = APP_STATE.patientAssignment;

  const intro = document.getElementById('report-auto-intro');
  const heading = document.getElementById('report-hamd-heading');
  const score = document.getElementById('report-hamd-score');
  const desc = document.getElementById('report-hamd-desc');
  const trend = document.getElementById('report-trend-label');
  const ring = document.getElementById('report-hamd-progress-ring');
  const hamdDetailPanel = document.getElementById('report-hamd-detail-panel');
  const hamdDetailToggle = document.getElementById('report-hamd-detail-toggle');
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
  const doctorAssignmentCard = document.getElementById('report-doctor-assignment-card');
  const phq9Summary = document.getElementById('report-phq9-summary');
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
  renderPhq9ReportSummary();

  if (intro) {
    intro.textContent = updatedAt
      ? `這是 Rou Rou 依據最新對話整理的報表。最後更新時間：${updatedAt}。`
      : '這是 Rou Rou 為你整理的本週心情概覽，請確認資訊準確後再交由醫師審閱。';
  }

  if (heading) heading.textContent = 'HAM-D 題項評分草稿';
  if (score) {
    score.textContent = hamdFormalStats.scoredItems.length
      ? `${hamdFormalStats.displayedTotal}/${hamdFormalStats.maxTotal || 52}`
      : `${hamd.progressPercent}%`;
  }
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

  // 逐題缺口指示器
  const hamdGapPanel = document.getElementById('report-hamd-gap-panel');
  if (hamdGapPanel) {
    hamdGapPanel.innerHTML = renderHamdGapIndicator(hamd);
  }

  if (hamdDetailPanel) hamdDetailPanel.innerHTML = renderHamdFormalDetail(hamdFormalAssessment);
  if (hamdDetailToggle) {
    hamdDetailToggle.hidden = !hamdFormalStats.items.length;
  }
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

  if (doctorAssignmentCard) {
    doctorAssignmentCard.innerHTML = renderDoctorAssignmentCard(doctorAssignment);
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

    let patientReferenceNode = document.getElementById('report-fhir-patient-reference');
    if (!patientReferenceNode) {
      const profileObsNode = document.getElementById('report-fhir-profile-obs');
      if (profileObsNode?.parentNode) {
        patientReferenceNode = document.createElement('div');
        patientReferenceNode.id = 'report-fhir-patient-reference';
        profileObsNode.parentNode.insertBefore(patientReferenceNode, profileObsNode);
      }
    }
    const patientReference = fhirDelivery?.patient_reference_summary || PatientProfile.buildReferenceSummary(sessionExport?.patient || {});
    if (patientReferenceNode) {
      if (Array.isArray(patientReference?.lines) && patientReference.lines.length) {
        patientReferenceNode.innerHTML = `
          <div class="fhir-profile-section">
            <div class="fhir-profile-title">
              <span class="mat-icon fill" style="color:var(--primary)">badge</span>
              Patient Draft 參考資料
            </div>
            ${patientReference.lines.map((item) => `
              <div class="fhir-obs-item">
                <span class="mat-icon" style="font-size:14px;color:var(--primary)">person</span>
                <span><b>${escapeHtml(item.label)}</b>：${escapeHtml(item.value)}</span>
              </div>
            `).join('')}
          </div>`;
      } else {
        patientReferenceNode.innerHTML = '';
      }
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
    const currentPatientRefreshPayload = buildCurrentPatientRefreshPayload();
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
                ${(() => {
                  const canRefresh = canRefreshFhirResource(item, currentPatientRefreshPayload);
                  const refreshing = isRefreshingFhirResource(item.path);
                  return `
                <div class="fhir-link-item">
                  <span class="mat-icon" style="font-size:16px;color:var(--primary)">open_in_new</span>
                  <div class="fhir-link-copy">
                    <div class="fhir-link-label">${escapeHtml(item.label)}</div>
                    <div class="fhir-link-path"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.path)}</a></div>
                  </div>
                  ${canRefresh ? `
                    <button
                      class="fhir-link-refresh"
                      type="button"
                      onclick="refreshPatientResource('${escapeHtml(item.path)}')"
                      ${refreshing ? 'disabled' : ''}
                    >${refreshing ? '更新中...' : '更新'}</button>
                  ` : ''}
                </div>
              `;
                })()}
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
    APP_STATE.reportOutputs.session_export = PatientProfile.applyToSessionExport(payload.session_export);
    syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
  }
  APP_STATE.lastChatMetadata = payload.metadata || APP_STATE.lastChatMetadata;
  APP_STATE.runtimeMode = payload.metadata?.active_mode || APP_STATE.runtimeMode;
  APP_STATE.reportOutputs.updatedAt = formatTimeLabel(new Date());
  renderReportOutputs();
  updateModeLabels();
  saveReportOutputsToCache();
}

function getSelectedDoctorPatient() {
  const workspace = APP_STATE.doctorWorkspace || normalizeDoctorWorkspace({});
  return workspace.patients.find((patient) => patient.id === workspace.selectedPatientId) || workspace.patients[0] || null;
}

function getDoctorStatusClass(status = '') {
  if (String(status).includes('已')) return 'complete';
  if (String(status).includes('待') || String(status).includes('未')) return 'pending';
  return 'draft';
}

function buildDoctorPatientFromUser(user = {}) {
  const patientId = String(user.id || '').trim();
  const displayName = String(user.display_name || user.login_identifier || patientId || '未命名病人').trim();
  return normalizeDoctorPatient({
    id: patientId,
    patientNumber: patientId,
    name: displayName,
    loginIdentifier: user.login_identifier || '',
    source: 'manual_id',
    latestAiRecordAt: '尚未同步',
    aiSummaryStatus: '尚未整理',
    medicalRecordStatus: '待送入',
    orderStatus: '未填寫',
    riskLevel: '待評估',
    aiSummary: '此病人是由醫師輸入病人 ID 加入。AI 使用紀錄摘要尚未接上 CareLink / 正式資料同步。',
    lastVisitNote: '目前只建立醫師工作台清單項目，尚未完成病人端授權確認。',
    orderDraft: createEmptyDoctorOrder()
  });
}

function openDoctorAddPatientModal() {
  if (!isDoctorUser()) {
    appendSystemNotice('只有醫師身份可以用病人 ID 加入病人。');
    return;
  }
  const overlay = document.getElementById('doctor-add-patient-overlay');
  const input = document.getElementById('doctor-add-patient-id');
  const status = document.getElementById('doctor-add-patient-status');
  if (!overlay) return;
  if (input) input.value = '';
  if (status) {
    status.textContent = APP_STATE.auth?.token
      ? '輸入病人 ID 後加入。'
      : '尚未取得登入 token，請先在登入頁完成醫師登入再回來加入病人。';
  }
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  window.requestAnimationFrame(() => input?.focus());
}

function closeDoctorAddPatientModal() {
  const overlay = document.getElementById('doctor-add-patient-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

async function fetchUserById(userId = '') {
  const response = await fetch(`/api/auth/users?id=${encodeURIComponent(userId)}`);
  const payload = await readJsonResponseSafe(response);
  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

async function submitDoctorAddPatient() {
  if (!isDoctorUser()) return;
  const input = document.getElementById('doctor-add-patient-id');
  const status = document.getElementById('doctor-add-patient-status');
  const submitButton = document.getElementById('doctor-add-patient-submit');
  const patientId = String(input?.value || '').trim();

  if (!patientId) {
    if (status) status.textContent = '請先輸入病人 ID。';
    return;
  }
  if (APP_STATE.doctorWorkspace.patients.some((patient) => patient.id === patientId)) {
    if (status) status.textContent = '這位病人已經在你的清單裡。';
    return;
  }

  if (!APP_STATE.auth?.token) {
    if (status) status.textContent = '尚未登入，請先用醫師帳號完成登入後再加入病人。';
    return;
  }

  if (submitButton) submitButton.disabled = true;
  if (status) status.textContent = '正在查找病人...';

  try {
    const result = await fetchUserById(patientId);
    if (!result.ok) {
      const code = result.payload?.code || '';
      if (result.status === 401) {
        clearAuthenticatedSession({ resetConversation: false });
        openAuthModal(true);
        throw new Error('為了保護病人資料，醫師登入驗證已失效，請重新用醫師帳號登入後再加入病人。');
      }
      if (result.status === 403) {
        throw new Error('目前帳號沒有查找其他病人的權限（必須是醫師帳號）。');
      }
      throw new Error(code === 'user_not_found' ? '找不到這個病人 ID。' : (result.payload?.error || '查找病人失敗。'));
    }
    const user = result.payload?.user;
    if (!user || user.role !== 'patient') {
      throw new Error('這個 ID 不是病人帳號，不能加入病人清單。');
    }
    const patient = buildDoctorPatientFromUser(user);
    APP_STATE.doctorWorkspace.patients = [
      patient,
      ...APP_STATE.doctorWorkspace.patients.filter((item) => item.id !== patient.id)
    ];
    APP_STATE.doctorWorkspace.selectedPatientId = patient.id;
    saveDoctorWorkspace();
    await syncDoctorAssignmentInbox(patient);
    renderDoctorDashboard();
    closeDoctorAddPatientModal();
    appendSystemNotice(`已加入病人：${patient.name}。病人端設定頁會顯示你是目前主治醫師。`);
  } catch (error) {
    if (status) status.textContent = error.message || '加入病人失敗。';
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function renderDoctorDashboard() {
  if (!document.getElementById('screen-doctor-dashboard')) return;
  APP_STATE.doctorWorkspace = normalizeDoctorWorkspace(APP_STATE.doctorWorkspace);
  const { patients } = APP_STATE.doctorWorkspace;
  const totalPatients = document.getElementById('doctor-total-patients');
  const pendingRecords = document.getElementById('doctor-pending-records');
  const pendingOrders = document.getElementById('doctor-pending-orders');
  const list = document.getElementById('doctor-patient-list');

  if (totalPatients) totalPatients.textContent = String(patients.length);
  if (pendingRecords) {
    pendingRecords.textContent = String(patients.filter((patient) => patient.medicalRecordStatus !== '已送入').length);
  }
  if (pendingOrders) {
    pendingOrders.textContent = String(patients.filter((patient) => !hasPublishedDoctorOrder(patient.orderDraft)).length);
  }

  if (list) {
    list.innerHTML = patients.map((patient) => {
      const active = patient.id === APP_STATE.doctorWorkspace.selectedPatientId;
      return `
        <button class="doctor-patient-row ${active ? 'active' : ''}" type="button" data-patient-id="${escapeHtml(patient.id)}" onclick="selectDoctorPatient(this.dataset.patientId)">
          <div class="doctor-patient-main">
            <div class="doctor-patient-id">${escapeHtml(patient.patientNumber)}</div>
            <div class="doctor-patient-name">${escapeHtml(patient.name)}</div>
            <div class="doctor-patient-meta">最近 AI 記錄：${escapeHtml(patient.latestAiRecordAt)}</div>
          </div>
          <div class="doctor-patient-badges">
            <span class="doctor-status-pill ${getDoctorStatusClass(patient.aiSummaryStatus)}">${escapeHtml(patient.aiSummaryStatus)}</span>
            <span class="doctor-status-pill ${getDoctorStatusClass(patient.medicalRecordStatus)}">${escapeHtml(patient.medicalRecordStatus)}</span>
            <span class="doctor-status-pill ${getDoctorStatusClass(patient.orderStatus)}">${escapeHtml(patient.orderStatus)}</span>
          </div>
        </button>
      `;
    }).join('');
  }

  renderDoctorPatientDetail();
}

function selectDoctorPatient(patientId) {
  const exists = APP_STATE.doctorWorkspace.patients.some((patient) => patient.id === patientId);
  if (!exists) return;
  APP_STATE.doctorWorkspace.selectedPatientId = patientId;
  saveDoctorWorkspace();
  renderDoctorDashboard();
}

function renderDoctorPatientDetail() {
  const detail = document.getElementById('doctor-patient-detail');
  if (!detail) return;
  const patient = getSelectedDoctorPatient();
  if (!patient) {
    detail.innerHTML = '<div class="doctor-empty">目前沒有可顯示的病人。</div>';
    return;
  }

  detail.innerHTML = `
    <div class="doctor-detail-head">
      <div>
        <div class="section-label">PATIENT DETAIL</div>
        <h3 class="doctor-detail-title">${escapeHtml(patient.name)}</h3>
        <div class="doctor-detail-meta">${escapeHtml(patient.patientNumber)} ・ 風險觀察：${escapeHtml(patient.riskLevel)}</div>
      </div>
      <span class="doctor-status-pill ${getDoctorStatusClass(patient.aiSummaryStatus)}">${escapeHtml(patient.aiSummaryStatus)}</span>
    </div>

    <div class="doctor-summary-card">
      <div class="doctor-summary-label">AI 使用紀錄摘要</div>
      <p>${escapeHtml(patient.aiSummary)}</p>
      <div class="doctor-summary-note">${escapeHtml(patient.lastVisitNote)}</div>
    </div>

    <div class="doctor-usage-status-grid">
      <div class="doctor-stat">
        <span class="doctor-status-pill ${getDoctorStatusClass(patient.medicalRecordStatus)}">${escapeHtml(patient.medicalRecordStatus)}</span>
        <span class="doctor-stat-label">病歷狀態</span>
      </div>
      <div class="doctor-stat">
        <span class="doctor-status-pill ${getDoctorStatusClass(patient.orderStatus)}">${escapeHtml(patient.orderStatus)}</span>
        <span class="doctor-stat-label">醫囑狀態</span>
      </div>
    </div>

    ${renderDoctorVisiblePatientSummary(patient)}

    <div style="margin-top:1rem;text-align:center;">
      <button class="primary-btn" type="button" onclick="showScreen('screen-doctor-assign')">前往指派 / 輸入病歷醫囑</button>
    </div>
  `;
}

const DOCTOR_ORDER_TYPE_OPTIONS = ['追蹤觀察', '填寫量表', '回診前補充資料', '生活作息建議', '用藥相關提醒', '轉介 / 進一步評估'];
const DOCTOR_ORDER_ASSIGNEE_OPTIONS = ['病人', '家屬 / 照顧者', '護理師', '系統自動提醒'];
const DOCTOR_ORDER_DUE_OPTIONS = ['今日', '三天內', '回診前', '指定日期'];
const DOCTOR_ORDER_PRIORITY_OPTIONS = ['一般', '重要', '需盡快處理'];
const DOCTOR_ORDER_REPLY_OPTIONS = ['不需回覆', '需確認已讀', '需填寫資料', '需回傳狀況'];
const DOCTOR_ORDER_TASK_OPTIONS = ['PHQ-9', 'GAD-7', '睡眠紀錄', '情緒日記', '副作用回報', '回診前摘要確認'];
const DOCTOR_ORDER_STATUS_OPTIONS = ['草稿', '已送出', '病人已讀', '病人已完成', '醫師已複核', '已關閉'];

function buildDoctorOrderOptionMarkup(options = [], currentValue = '', placeholder = '請選擇') {
  const head = [`<option value="">${escapeHtml(placeholder)}</option>`];
  const tail = options.map((value) => `<option value="${escapeHtml(value)}" ${value === currentValue ? 'selected' : ''}>${escapeHtml(value)}</option>`);
  return [...head, ...tail].join('');
}

function renderDoctorOrderForm(patient) {
  const order = normalizeDoctorOrder(patient.orderDraft, patient.orderStatus, patient);
  const orderMetaHint = order.createdAt
    ? `最近更新：${escapeHtml(order.createdAt)}`
    : '尚未建立醫囑。';
  return `
    <section class="doctor-action-panel doctor-order-panel">
      <div class="doctor-action-kicker">ORDERS / TASKS</div>
      <div class="doctor-order-head">
        <div>
          <h4>醫囑設計</h4>
          <p>${orderMetaHint}</p>
        </div>
        <div class="doctor-status-pill ${getDoctorStatusClass(order.status)}">${escapeHtml(order.status || '草稿')}</div>
      </div>

      <div class="doctor-order-form-grid">
        <label class="doctor-order-field">
          <span>醫囑類型</span>
          <select id="doctor-order-type">${buildDoctorOrderOptionMarkup(DOCTOR_ORDER_TYPE_OPTIONS, order.type)}</select>
        </label>
        <label class="doctor-order-field">
          <span>執行對象</span>
          <select id="doctor-order-assignee">${buildDoctorOrderOptionMarkup(DOCTOR_ORDER_ASSIGNEE_OPTIONS, order.assignee)}</select>
        </label>
        <label class="doctor-order-field">
          <span>執行期限</span>
          <select id="doctor-order-due-preset">${buildDoctorOrderOptionMarkup(DOCTOR_ORDER_DUE_OPTIONS, order.duePreset)}</select>
        </label>
        <label class="doctor-order-field">
          <span>指定日期</span>
          <input id="doctor-order-due-date" type="date" value="${escapeHtml(order.dueDate)}" />
        </label>
        <label class="doctor-order-field">
          <span>優先程度</span>
          <select id="doctor-order-priority">${buildDoctorOrderOptionMarkup(DOCTOR_ORDER_PRIORITY_OPTIONS, order.priority)}</select>
        </label>
        <label class="doctor-order-field">
          <span>是否需要病人回覆</span>
          <select id="doctor-order-reply">${buildDoctorOrderOptionMarkup(DOCTOR_ORDER_REPLY_OPTIONS, order.replyRequirement)}</select>
        </label>
        <label class="doctor-order-field">
          <span>對應任務</span>
          <select id="doctor-order-task">${buildDoctorOrderOptionMarkup(DOCTOR_ORDER_TASK_OPTIONS, order.taskRef)}</select>
        </label>
        <label class="doctor-order-field">
          <span>醫囑狀態</span>
          <select id="doctor-order-status">${buildDoctorOrderOptionMarkup(DOCTOR_ORDER_STATUS_OPTIONS, order.status, '請選擇狀態')}</select>
        </label>
      </div>

      <label class="doctor-order-field doctor-order-field-full">
        <span>醫囑內容</span>
        <textarea id="doctor-order-content" class="doctor-order-textarea" placeholder="例如：請於下次回診前完成 PHQ-9 與睡眠紀錄。" rows="4">${escapeHtml(order.content)}</textarea>
      </label>

      <label class="doctor-order-field doctor-order-field-full">
        <span>醫師補充備註</span>
        <textarea id="doctor-order-note" class="doctor-order-note" placeholder="例如：若出現明顯惡化，請提前回診或聯絡醫療單位。" rows="2">${escapeHtml(order.note)}</textarea>
      </label>

      <div class="doctor-order-trace-grid">
        <label class="doctor-order-field">
          <span>建立者</span>
          <input id="doctor-order-created-by" type="text" value="${escapeHtml(order.createdBy)}" placeholder="王醫師" />
        </label>
        <label class="doctor-order-field">
          <span>建立時間</span>
          <input id="doctor-order-created-at" type="datetime-local" value="${escapeHtml(order.createdAt ? order.createdAt.replace(' ', 'T') : '')}" />
        </label>
        <label class="doctor-order-field">
          <span>對應病人</span>
          <input id="doctor-order-patient-ref" type="text" value="${escapeHtml(order.patientRef || patient.patientNumber)}" placeholder="P-2026-001" />
        </label>
        <label class="doctor-order-field">
          <span>對應 Encounter</span>
          <input id="doctor-order-encounter-ref" type="text" value="${escapeHtml(order.encounterRef)}" placeholder="Encounter / 就診編號" />
        </label>
        <label class="doctor-order-field">
          <span>對應 Summary</span>
          <input id="doctor-order-summary-ref" type="text" value="${escapeHtml(order.summaryRef)}" placeholder="診前摘要 / AI summary" />
        </label>
        <label class="doctor-order-field">
          <span>對應 Observation</span>
          <input id="doctor-order-observation-ref" type="text" value="${escapeHtml(order.observationRef)}" placeholder="Observation code / id" />
        </label>
      </div>

      <div class="doctor-order-actions">
        <button class="ghost-btn doctor-action-btn" type="button" onclick="saveDoctorOrderDraft()">儲存醫囑欄位</button>
        <button class="primary-btn doctor-action-btn" type="button" onclick="publishDoctorOrder()">送出醫囑</button>
      </div>
    </section>
  `;
}

function renderDoctorAssignScreen() {
  const content = document.getElementById('doctor-assign-content');
  if (!content) return;
  const patient = getSelectedDoctorPatient();
  if (!patient) {
    content.innerHTML = '<div class="doctor-empty">請先在「病人」頁面選取一位病人，再來此輸入病歷與醫囑。</div>';
    return;
  }

  content.innerHTML = `
    <div class="doctor-detail-head">
      <div>
        <div class="section-label">ASSIGN / SUBMIT</div>
        <h3 class="doctor-detail-title">${escapeHtml(patient.name)}</h3>
        <div class="doctor-detail-meta">${escapeHtml(patient.patientNumber)} ・ 風險觀察：${escapeHtml(patient.riskLevel)}</div>
      </div>
      <span class="doctor-status-pill ${getDoctorStatusClass(patient.aiSummaryStatus)}">${escapeHtml(patient.aiSummaryStatus)}</span>
    </div>

    <div class="doctor-action-grid">
      <section class="doctor-action-panel">
        <div class="doctor-action-kicker">病歷送入</div>
        <h4>送入病歷</h4>
        <p>填寫下方欄位後，在此送出病歷。</p>
        <div class="doctor-action-state">目前狀態：${escapeHtml(patient.medicalRecordStatus)}</div>
        <button class="ghost-btn doctor-action-btn" type="button" onclick="generateDemoMedicalRecordAndOrder()">一鍵產生測試病歷與醫囑</button>
        <button class="primary-btn doctor-action-btn" type="button" onclick="markMedicalRecordSent()">標示為已送入</button>
      </section>
    </div>

    ${renderDoctorOrderForm(patient)}
    ${renderMedicalRecordForm(patient)}
  `;
}

function renderMedicalRecordForm(patient) {
  const record = patient.medicalRecord || createEmptyMedicalRecord();
  const updatedHint = record.updatedAt
    ? `最後更新：${escapeHtml(record.updatedAt)}`
    : '尚未填寫病歷欄位。';
  return `
    <section class="doctor-fhir-form" aria-label="病歷輸入（FHIR 對應欄位）">
      <header class="doctor-fhir-form-head">
        <div>
          <div class="doctor-action-kicker">MEDICAL RECORD INPUT</div>
          <h4>病歷輸入（依 FHIR 標準分區）</h4>
          <p class="doctor-fhir-form-sub">每一區對應一種 FHIR Resource，留白欄位在輸出時會自動省略。${escapeHtml(updatedHint)}</p>
        </div>
        <div class="doctor-fhir-form-actions">
          <button class="ghost-btn" type="button" onclick="previewMedicalRecordFhir()">預覽 FHIR JSON</button>
          <button class="primary-btn" type="button" onclick="saveMedicalRecordForm()">儲存病歷</button>
        </div>
      </header>

      ${renderMrSectionPatient(record.patient)}
      ${renderMrSectionEncounter(record.encounter)}
      ${renderMrSectionObservations(record.observations)}
      ${renderMrSectionQuestionnaire(record.questionnaire)}
      ${renderMrSectionComposition(record.composition)}
      ${renderMrSectionDocuments(record.documents)}
      ${renderMrSectionConditions(record.conditions)}
      ${renderMrSectionMedications(record.medications)}
      ${renderMrSectionProvenance(record.provenance)}
    </section>
  `;
}

function mrField(path, label, value, opts = {}) {
  const type = opts.type || 'text';
  const placeholder = opts.placeholder || '';
  const safeValue = escapeHtml(value || '');
  if (type === 'textarea') {
    return `
      <label class="doctor-fhir-field">
        <span>${escapeHtml(label)}</span>
        <textarea data-mr-field="${escapeHtml(path)}" placeholder="${escapeHtml(placeholder)}" rows="${opts.rows || 2}">${safeValue}</textarea>
      </label>`;
  }
  if (type === 'select') {
    const options = (opts.options || []).map((opt) => {
      const selected = String(opt.value) === String(value || '') ? 'selected' : '';
      return `<option value="${escapeHtml(opt.value)}" ${selected}>${escapeHtml(opt.label)}</option>`;
    }).join('');
    return `
      <label class="doctor-fhir-field">
        <span>${escapeHtml(label)}</span>
        <select data-mr-field="${escapeHtml(path)}">${options}</select>
      </label>`;
  }
  return `
    <label class="doctor-fhir-field">
      <span>${escapeHtml(label)}</span>
      <input data-mr-field="${escapeHtml(path)}" type="${escapeHtml(type)}" value="${safeValue}" placeholder="${escapeHtml(placeholder)}" />
    </label>`;
}

function renderMrSectionPatient(p) {
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">Patient</span> 1. 病人是誰</legend>
      <div class="doctor-fhir-grid">
        ${mrField('patient.name', '姓名 → Patient.name', p.name, { placeholder: '林小明' })}
        ${mrField('patient.gender', '性別 → Patient.gender', p.gender, { type: 'select', options: [
          { value: '', label: '請選擇' },
          { value: 'male', label: 'male' },
          { value: 'female', label: 'female' },
          { value: 'other', label: 'other' },
          { value: 'unknown', label: 'unknown' }
        ] })}
        ${mrField('patient.birthDate', '生日 → Patient.birthDate', p.birthDate, { type: 'date' })}
        ${mrField('patient.identifier', '病人識別碼 → Patient.identifier', p.identifier, { placeholder: '例如 P-2026-001' })}
      </div>
    </fieldset>`;
}

function renderMrSectionEncounter(e) {
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">Encounter</span> 2. 這次就醫 / 互動</legend>
      <div class="doctor-fhir-grid">
        ${mrField('encounter.periodStart', '看診開始 → Encounter.period.start', e.periodStart, { type: 'datetime-local' })}
        ${mrField('encounter.periodEnd', '看診結束 → Encounter.period.end', e.periodEnd, { type: 'datetime-local' })}
        ${mrField('encounter.class', '型態 → Encounter.class', e.class, { type: 'select', options: [
          { value: '', label: '請選擇' },
          { value: 'AMB', label: '門診（AMB）' },
          { value: 'VR', label: '遠距（VR）' },
          { value: 'PRENC', label: '診前整理（PRENC）' },
          { value: 'IMP', label: '住院（IMP）' }
        ] })}
        ${mrField('encounter.serviceType', '科別 → Encounter.serviceType', e.serviceType, { placeholder: '精神科 / 身心科' })}
        ${mrField('encounter.practitionerName', '醫師 → Encounter.participant', e.practitionerName, { placeholder: '王醫師' })}
      </div>
    </fieldset>`;
}

function renderMrSectionObservations(list) {
  const rows = (list || []).map((obs, idx) => `
    <div class="doctor-fhir-row" data-mr-row="observations-${idx}">
      <div class="doctor-fhir-row-head">
        <span class="doctor-fhir-row-title">Observation #${idx + 1}</span>
        <button class="doctor-fhir-row-remove" type="button" onclick="removeMedicalRecordItem('observations', ${idx})">移除</button>
      </div>
      <div class="doctor-fhir-grid">
        ${mrField(`observations.${idx}.code`, 'code → Observation.code (code)', obs.code, { placeholder: 'depressed-mood / insomnia / anxiety' })}
        ${mrField(`observations.${idx}.display`, 'display → Observation.code.display', obs.display, { placeholder: '情緒低落 / 睡眠困擾' })}
        ${mrField(`observations.${idx}.value`, '值 → Observation.value[x]', obs.value, { placeholder: '例如 PHQ-9 分數 12' })}
        ${mrField(`observations.${idx}.interpretation`, '嚴重程度 → Observation.interpretation', obs.interpretation, { placeholder: 'mild / moderate / severe' })}
        ${mrField(`observations.${idx}.effectiveDateTime`, '時間 → Observation.effectiveDateTime', obs.effectiveDateTime, { type: 'datetime-local' })}
        ${mrField(`observations.${idx}.derivedFrom`, '來源 → Observation.derivedFrom', obs.derivedFrom, { placeholder: '來自 PHQ-9 / 對話節錄' })}
      </div>
    </div>
  `).join('');
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">Observation</span> 3. 症狀與觀察</legend>
      ${rows || '<div class="doctor-fhir-empty">尚未新增任何觀察項目。</div>'}
      <button class="doctor-fhir-add" type="button" onclick="addMedicalRecordItem('observations')">＋ 新增 Observation</button>
    </fieldset>`;
}

function renderMrSectionQuestionnaire(q) {
  const items = (q.items || []).map((item, idx) => `
    <div class="doctor-fhir-row" data-mr-row="questionnaire-item-${idx}">
      <div class="doctor-fhir-row-head">
        <span class="doctor-fhir-row-title">item #${idx + 1}</span>
        <button class="doctor-fhir-row-remove" type="button" onclick="removeMedicalRecordItem('questionnaire.items', ${idx})">移除</button>
      </div>
      <div class="doctor-fhir-grid">
        ${mrField(`questionnaire.items.${idx}.linkId`, 'linkId → item.linkId', item.linkId, { placeholder: 'phq9-q1' })}
        ${mrField(`questionnaire.items.${idx}.text`, '題目 → item.text', item.text, { placeholder: '感覺心情低落或沒有希望' })}
        ${mrField(`questionnaire.items.${idx}.answer`, '答案 → item.answer.value[x]', item.answer, { placeholder: '0 / 1 / 2 / 3 或文字' })}
      </div>
    </div>
  `).join('');
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">QuestionnaireResponse</span> 4. 問卷 / 量表</legend>
      <div class="doctor-fhir-grid">
        ${mrField('questionnaire.name', '問卷名稱 → questionnaire', q.name, { placeholder: 'PHQ-9 / GAD-7 / 自評' })}
        ${mrField('questionnaire.authored', '填寫時間 → authored', q.authored, { type: 'datetime-local' })}
      </div>
      ${items || '<div class="doctor-fhir-empty">尚未新增題目。</div>'}
      <button class="doctor-fhir-add" type="button" onclick="addMedicalRecordItem('questionnaire.items')">＋ 新增題目</button>
    </fieldset>`;
}

function renderMrSectionComposition(c) {
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">Composition</span> 5. 醫師摘要 / 臨床文件</legend>
      <div class="doctor-fhir-grid">
        ${mrField('composition.title', '文件標題 → Composition.title', c.title, { placeholder: '診前摘要 2026-04-25' })}
        ${mrField('composition.status', '狀態 → Composition.status', c.status, { type: 'select', options: [
          { value: 'preliminary', label: 'preliminary（草稿）' },
          { value: 'final', label: 'final（定稿）' },
          { value: 'amended', label: 'amended（修訂）' },
          { value: 'entered-in-error', label: 'entered-in-error' }
        ] })}
      </div>
      ${mrField('composition.chiefComplaint', '主訴 → section[chief-complaint]', c.chiefComplaint, { type: 'textarea', rows: 2 })}
      ${mrField('composition.symptomSummary', '症狀整理 → section[symptoms]', c.symptomSummary, { type: 'textarea', rows: 3 })}
      ${mrField('composition.riskAlert', '風險提醒 → section[risk-alert]', c.riskAlert, { type: 'textarea', rows: 2 })}
      ${mrField('composition.followupSuggestion', '建議補問 → section[followup]', c.followupSuggestion, { type: 'textarea', rows: 2 })}
    </fieldset>`;
}

function renderMrSectionDocuments(list) {
  const rows = (list || []).map((doc, idx) => `
    <div class="doctor-fhir-row" data-mr-row="documents-${idx}">
      <div class="doctor-fhir-row-head">
        <span class="doctor-fhir-row-title">DocumentReference #${idx + 1}</span>
        <button class="doctor-fhir-row-remove" type="button" onclick="removeMedicalRecordItem('documents', ${idx})">移除</button>
      </div>
      <div class="doctor-fhir-grid">
        ${mrField(`documents.${idx}.type`, '文件類型 → DocumentReference.type', doc.type, { placeholder: '病歷 PDF / 診斷書 / 檢驗報告' })}
        ${mrField(`documents.${idx}.filename`, '檔名 → attachment.title', doc.filename, { placeholder: 'discharge-summary.pdf' })}
        ${mrField(`documents.${idx}.url`, '檔案連結 → attachment.url', doc.url, { type: 'url', placeholder: 'https://...' })}
        ${mrField(`documents.${idx}.contentType`, 'MIME → attachment.contentType', doc.contentType, { placeholder: 'application/pdf' })}
        ${mrField(`documents.${idx}.date`, '建立時間 → DocumentReference.date', doc.date, { type: 'datetime-local' })}
      </div>
    </div>
  `).join('');
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">DocumentReference</span> 6. 原始文件 / PDF / 報告檔</legend>
      ${rows || '<div class="doctor-fhir-empty">尚未掛上文件。</div>'}
      <button class="doctor-fhir-add" type="button" onclick="addMedicalRecordItem('documents')">＋ 新增文件</button>
    </fieldset>`;
}

function renderMrSectionConditions(list) {
  const rows = (list || []).map((cond, idx) => `
    <div class="doctor-fhir-row" data-mr-row="conditions-${idx}">
      <div class="doctor-fhir-row-head">
        <span class="doctor-fhir-row-title">Condition #${idx + 1}</span>
        <button class="doctor-fhir-row-remove" type="button" onclick="removeMedicalRecordItem('conditions', ${idx})">移除</button>
      </div>
      <div class="doctor-fhir-grid">
        ${mrField(`conditions.${idx}.code`, '診斷名稱 → Condition.code', cond.code, { placeholder: '憂鬱症 / 焦慮症 / 失眠症' })}
        ${mrField(`conditions.${idx}.clinicalStatus`, 'clinicalStatus', cond.clinicalStatus, { type: 'select', options: [
          { value: '', label: '請選擇' },
          { value: 'active', label: 'active' },
          { value: 'recurrence', label: 'recurrence' },
          { value: 'remission', label: 'remission' },
          { value: 'resolved', label: 'resolved' }
        ] })}
        ${mrField(`conditions.${idx}.verificationStatus`, 'verificationStatus', cond.verificationStatus, { type: 'select', options: [
          { value: '', label: '請選擇' },
          { value: 'unconfirmed', label: 'unconfirmed' },
          { value: 'provisional', label: 'provisional' },
          { value: 'differential', label: 'differential' },
          { value: 'confirmed', label: 'confirmed' }
        ] })}
        ${mrField(`conditions.${idx}.onsetDateTime`, 'onsetDateTime', cond.onsetDateTime, { type: 'datetime-local' })}
      </div>
    </div>
  `).join('');
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">Condition</span> 7. 診斷 / 問題清單</legend>
      <p class="doctor-fhir-section-note">AI 不應自行創造正式診斷，必須是醫師確認過再寫入。</p>
      ${rows || '<div class="doctor-fhir-empty">尚未新增診斷。</div>'}
      <button class="doctor-fhir-add" type="button" onclick="addMedicalRecordItem('conditions')">＋ 新增診斷</button>
    </fieldset>`;
}

function renderMrSectionMedications(list) {
  const rows = (list || []).map((med, idx) => `
    <div class="doctor-fhir-row" data-mr-row="medications-${idx}">
      <div class="doctor-fhir-row-head">
        <span class="doctor-fhir-row-title">${med.kind === 'request' ? 'MedicationRequest' : 'MedicationStatement'} #${idx + 1}</span>
        <button class="doctor-fhir-row-remove" type="button" onclick="removeMedicalRecordItem('medications', ${idx})">移除</button>
      </div>
      <div class="doctor-fhir-grid">
        ${mrField(`medications.${idx}.kind`, '類型', med.kind, { type: 'select', options: [
          { value: 'statement', label: 'MedicationStatement（病人正在吃）' },
          { value: 'request', label: 'MedicationRequest（醫師處方）' }
        ] })}
        ${mrField(`medications.${idx}.name`, '藥名 → medicationCodeableConcept', med.name, { placeholder: 'Sertraline 50mg' })}
        ${mrField(`medications.${idx}.dosage`, '劑量 → dosage', med.dosage, { placeholder: '每日一次，早餐後' })}
        ${mrField(`medications.${idx}.start`, '開始 → effectivePeriod.start', med.start, { type: 'date' })}
        ${mrField(`medications.${idx}.end`, '結束 → effectivePeriod.end', med.end, { type: 'date' })}
      </div>
    </div>
  `).join('');
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">Medication</span> 8. 用藥</legend>
      ${rows || '<div class="doctor-fhir-empty">尚未新增藥物。</div>'}
      <button class="doctor-fhir-add" type="button" onclick="addMedicalRecordItem('medications')">＋ 新增用藥</button>
    </fieldset>`;
}

function renderMrSectionProvenance(p) {
  return `
    <fieldset class="doctor-fhir-section">
      <legend><span class="doctor-fhir-tag">Provenance</span> 9. AI 生成與審閱紀錄</legend>
      <div class="doctor-fhir-grid">
        ${mrField('provenance.sourceType', '產生方式 → Provenance.activity', p.sourceType, { type: 'select', options: [
          { value: 'ai_generated', label: 'AI 生成' },
          { value: 'patient_confirmed', label: '病人確認' },
          { value: 'doctor_edited', label: '醫師修改' }
        ] })}
        ${mrField('provenance.recorded', '時間 → Provenance.recorded', p.recorded, { type: 'datetime-local' })}
        ${mrField('provenance.agent', '產生者 → Provenance.agent', p.agent, { placeholder: 'RouRou AI / 王醫師 / 病人本人' })}
        ${mrField('provenance.activity', '活動描述 → Provenance.activity.text', p.activity, { placeholder: 'AI 抽取症狀後由醫師審閱' })}
      </div>
    </fieldset>`;
}

function readDoctorOrderForm(patient = null, forcedStatus = '') {
  const currentUser = getCurrentAuthUser();
  const currentOrder = normalizeDoctorOrder(patient?.orderDraft, patient?.orderStatus, patient || {});
  const createdAtInput = String(document.getElementById('doctor-order-created-at')?.value || '').trim();
  return normalizeDoctorOrder({
    type: document.getElementById('doctor-order-type')?.value || '',
    content: document.getElementById('doctor-order-content')?.value || '',
    assignee: document.getElementById('doctor-order-assignee')?.value || '病人',
    duePreset: document.getElementById('doctor-order-due-preset')?.value || '回診前',
    dueDate: document.getElementById('doctor-order-due-date')?.value || '',
    priority: document.getElementById('doctor-order-priority')?.value || '一般',
    replyRequirement: document.getElementById('doctor-order-reply')?.value || '不需回覆',
    taskRef: document.getElementById('doctor-order-task')?.value || '',
    note: document.getElementById('doctor-order-note')?.value || '',
    status: forcedStatus || document.getElementById('doctor-order-status')?.value || currentOrder.status || '草稿',
    createdBy: document.getElementById('doctor-order-created-by')?.value || currentOrder.createdBy || currentUser?.display_name || currentUser?.login_identifier || '醫師',
    createdAt: createdAtInput ? createdAtInput.replace('T', ' ') : (currentOrder.createdAt || new Date().toISOString().replace('T', ' ').slice(0, 16)),
    patientRef: document.getElementById('doctor-order-patient-ref')?.value || patient?.patientNumber || '',
    encounterRef: document.getElementById('doctor-order-encounter-ref')?.value || '',
    summaryRef: document.getElementById('doctor-order-summary-ref')?.value || '',
    observationRef: document.getElementById('doctor-order-observation-ref')?.value || ''
  }, forcedStatus || currentOrder.status, patient || {});
}

function pickRandomItem(items = []) {
  return items[Math.floor(Math.random() * items.length)] || items[0];
}

function formatDateOffset(days = 0) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function formatDateTimeLocalOffset(hours = 0) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

function buildDemoClinicalPacket(patient = {}) {
  const currentUser = getCurrentAuthUser();
  const doctorName = currentUser?.display_name || currentUser?.login_identifier || '王醫師';
  const patientName = patient.name || '測試病人';
  const patientRef = patient.patientNumber || patient.id || 'P-DEMO';
  const cases = [
    {
      riskLevel: '中度',
      chiefComplaint: '近兩週心情低落、睡眠中斷，覺得白天專注力明顯下降。',
      symptomSummary: '病人描述入睡時間延長，夜間醒來 2 到 3 次；近期工作壓力升高，對原本有興趣的活動動機下降。否認立即自傷計畫，但表示有明顯疲憊與無力感。',
      riskAlert: '目前未表達具體自傷計畫，但因持續失眠與功能下降，建議一週內追蹤情緒與安全狀態。',
      followupSuggestion: '回診時確認睡眠型態、食慾變化、是否出現自傷意念，並檢視 PHQ-9 / GAD-7 量表結果。',
      observations: [
        { code: 'insomnia', display: '睡眠困擾', value: '夜醒 2-3 次，睡眠品質差', interpretation: 'moderate', derivedFrom: '病人自述與 AI 對話摘要' },
        { code: 'depressed-mood', display: '情緒低落', value: 'PHQ-9 初估 12 分', interpretation: 'moderate', derivedFrom: 'PHQ-9 草稿' }
      ],
      condition: '憂鬱症狀待評估',
      order: {
        type: '填寫量表',
        content: '請於三天內完成 PHQ-9 與睡眠紀錄，若出現自傷想法或安全疑慮，請立即聯絡醫療單位或身邊可信任的人。',
        taskRef: 'PHQ-9',
        duePreset: '三天內',
        priority: '重要',
        replyRequirement: '需填寫資料',
        note: '下次回診前請帶著最近一週睡眠紀錄，方便評估是否需要調整治療計畫。'
      }
    },
    {
      riskLevel: '觀察',
      chiefComplaint: '近期焦慮感增加，常擔心事情做不好，伴隨胸悶與反覆檢查訊息。',
      symptomSummary: '病人表示焦慮主要出現在工作與人際互動後，會反覆回想對話內容；睡眠尚可但淺眠，白天容易緊繃。',
      riskAlert: '目前未見急性危險訊號，建議持續觀察焦慮頻率與是否影響工作表現。',
      followupSuggestion: '下次回診可補問焦慮發作時間、身體症狀、咖啡因攝取與壓力源。',
      observations: [
        { code: 'anxiety', display: '焦慮', value: '工作情境後明顯升高', interpretation: 'mild-moderate', derivedFrom: 'AI 對話摘要' },
        { code: 'somatic-tension', display: '身體緊繃', value: '偶發胸悶、肩頸僵硬', interpretation: 'mild', derivedFrom: '病人自述' }
      ],
      condition: '焦慮症狀待評估',
      order: {
        type: '生活作息建議',
        content: '請連續七天記錄焦慮出現的時間、觸發事件、身體感覺與緩解方式，回診時一起討論。',
        taskRef: '情緒日記',
        duePreset: '回診前',
        priority: '一般',
        replyRequirement: '需回傳狀況',
        note: '若胸悶持續或加劇，請優先就醫排除身體因素。'
      }
    },
    {
      riskLevel: '高關注',
      chiefComplaint: '最近明顯疲憊、社交退縮，曾提到「不想面對明天」但未說明具體計畫。',
      symptomSummary: '病人近期互動量下降，回覆變短，提及自責與無望感；目前需要更密集追蹤安全狀態與支持系統。',
      riskAlert: '出現消極語句與退縮跡象，雖未揭露具體計畫，仍建議安排近期追蹤並確認緊急聯絡資源。',
      followupSuggestion: '請回診時直接評估自傷意念、計畫、可取得工具、保護因子與是否需要安全計畫。',
      observations: [
        { code: 'social-withdrawal', display: '社交退縮', value: '互動量下降且避免聯絡朋友', interpretation: 'moderate', derivedFrom: 'AI 使用紀錄' },
        { code: 'hopelessness', display: '無望感', value: '曾表達不想面對明天', interpretation: 'moderate-severe', derivedFrom: '病人語句' }
      ],
      condition: '自傷風險需進一步評估',
      order: {
        type: '追蹤觀察',
        content: '請今天先完成安全確認：列出一位可聯絡的人、今晚會待的安全地點，以及若情緒急遽惡化時的求助方式。',
        taskRef: '回診前摘要確認',
        duePreset: '今日',
        priority: '需盡快處理',
        replyRequirement: '需確認已讀',
        note: '若病人回覆出現急性危險訊號，請啟動緊急處置或聯繫照護團隊。'
      }
    }
  ];
  const selected = pickRandomItem(cases);
  const now = formatDateTimeLocalOffset(0);
  const encounterStart = formatDateTimeLocalOffset(-2);
  const dueDate = selected.order.duePreset === '今日'
    ? formatDateOffset(0)
    : selected.order.duePreset === '三天內'
      ? formatDateOffset(3)
      : formatDateOffset(7);

  const record = normalizeMedicalRecord({
    patient: {
      name: patientName,
      gender: 'unknown',
      birthDate: '1998-05-13',
      identifier: patientRef
    },
    encounter: {
      periodStart: encounterStart,
      periodEnd: now,
      class: 'PRENC',
      serviceType: '身心科 / 診前 AI 摘要',
      practitionerName: doctorName
    },
    observations: selected.observations.map((item) => ({
      ...item,
      effectiveDateTime: now
    })),
    questionnaire: {
      name: selected.order.taskRef || 'PHQ-9',
      authored: now,
      items: [
        { linkId: 'q1', text: '過去兩週是否感到心情低落或沒有希望', answer: selected.riskLevel === '高關注' ? '3' : '2' },
        { linkId: 'q2', text: '過去兩週是否失去興趣或樂趣', answer: selected.riskLevel === '觀察' ? '1' : '2' }
      ]
    },
    composition: {
      title: `RouRou 診前摘要 - ${patientName}`,
      status: 'final',
      chiefComplaint: selected.chiefComplaint,
      symptomSummary: selected.symptomSummary,
      riskAlert: selected.riskAlert,
      followupSuggestion: selected.followupSuggestion
    },
    documents: [
      {
        type: 'AI 診前摘要',
        filename: `rourou-previsit-${Date.now()}.json`,
        url: '',
        contentType: 'application/json',
        date: now
      }
    ],
    conditions: [
      {
        code: selected.condition,
        clinicalStatus: 'active',
        verificationStatus: 'provisional',
        onsetDateTime: encounterStart
      }
    ],
    medications: [
      {
        kind: 'statement',
        name: '目前未填寫正式用藥',
        dosage: '待醫師確認',
        start: '',
        end: ''
      }
    ],
    provenance: {
      sourceType: 'doctor_edited',
      recorded: now,
      activity: '一鍵產生測試病歷與醫囑，供 demo 同步流程驗證',
      agent: doctorName
    },
    updatedAt: now.replace('T', ' ')
  });

  const order = normalizeDoctorOrder({
    ...selected.order,
    assignee: '病人',
    dueDate,
    status: '已送出',
    createdBy: doctorName,
    createdAt: now.replace('T', ' '),
    patientRef,
    encounterRef: `Encounter/${patient.id || patientRef}`,
    summaryRef: record.composition.title,
    observationRef: record.observations[0]?.code || ''
  }, '已送出', patient);

  return { record, order, riskLevel: selected.riskLevel };
}

async function generateDemoMedicalRecordAndOrder() {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  const packet = buildDemoClinicalPacket(patient);
  patient.medicalRecord = packet.record;
  patient.medicalRecordStatus = '已送入';
  patient.orderDraft = packet.order;
  patient.orderStatus = '已送出';
  patient.riskLevel = packet.riskLevel;
  saveDoctorWorkspace();
  try {
    const assignment = await syncDoctorAssignmentInbox(patient);
    renderDoctorDashboard();
    renderDoctorAssignScreen();
    appendSystemNotice(`已產生一組測試病歷與醫囑，並同步到病人 ID：${assignment?.patientId || patient.id}。`);
  } catch (error) {
    renderDoctorDashboard();
    renderDoctorAssignScreen();
    appendSystemNotice(error.message || '測試病歷與醫囑已產生，但同步時發生問題。');
  }
}

async function saveDoctorOrderDraft() {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  const draft = readDoctorOrderForm(patient);
  patient.orderDraft = draft;
  patient.orderStatus = draft.content ? (draft.status || '草稿') : '未填寫';
  saveDoctorWorkspace();
  try {
    const assignment = await syncDoctorAssignmentInbox(patient);
    renderDoctorDashboard();
    renderDoctorAssignScreen();
    appendSystemNotice(draft.content
      ? `醫囑欄位已儲存，目前狀態為「${patient.orderStatus}」，已同步到病人 ID：${assignment?.patientId || patient.id}。`
      : '醫囑內容已清空。');
  } catch (error) {
    appendSystemNotice(error.message || '醫囑同步失敗。');
  }
}

async function publishDoctorOrder() {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  const order = readDoctorOrderForm(patient, '已送出');
  if (!order.content) {
    appendSystemNotice('請先填寫醫囑內容，再送出給病人。');
    return;
  }
  patient.orderDraft = order;
  patient.orderStatus = '已送出';
  saveDoctorWorkspace();
  try {
    const assignment = await syncDoctorAssignmentInbox(patient);
    renderDoctorDashboard();
    renderDoctorAssignScreen();
    appendSystemNotice(`醫囑已送出給病人 ID：${assignment?.patientId || patient.id}，病人端可在「醫生指派」查看。`);
  } catch (error) {
    appendSystemNotice(error.message || '醫囑送出失敗。');
  }
}

async function markMedicalRecordSent() {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  patient.medicalRecordStatus = '已送入';
  saveDoctorWorkspace();
  try {
    const assignment = await syncDoctorAssignmentInbox(patient);
    renderDoctorDashboard();
    renderDoctorAssignScreen();
    appendSystemNotice(`已把此病人標示為「病歷已送入」，同步到病人 ID：${assignment?.patientId || patient.id}。`);
  } catch (error) {
    appendSystemNotice(error.message || '病歷同步失敗。');
  }
}

function setByPath(target, path, value) {
  const segments = String(path).split('.');
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const next = segments[i + 1];
    const nextIsIndex = /^\d+$/.test(next);
    if (cursor[segment] == null) {
      cursor[segment] = nextIsIndex ? [] : {};
    }
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = value;
}

function commitMedicalRecordFormToState() {
  const patient = getSelectedDoctorPatient();
  if (!patient) return null;
  const form = document.querySelector('.doctor-fhir-form');
  if (!form) return patient.medicalRecord;
  const record = normalizeMedicalRecord(patient.medicalRecord);
  form.querySelectorAll('[data-mr-field]').forEach((input) => {
    const path = input.getAttribute('data-mr-field');
    if (!path) return;
    setByPath(record, path, input.value);
  });
  patient.medicalRecord = normalizeMedicalRecord(record);
  return patient.medicalRecord;
}

function addMedicalRecordItem(listPath) {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  commitMedicalRecordFormToState();
  const record = patient.medicalRecord;
  const blanks = {
    observations: { code: '', display: '', value: '', interpretation: '', effectiveDateTime: '', derivedFrom: '' },
    documents: { type: '', filename: '', url: '', contentType: '', date: '' },
    conditions: { code: '', clinicalStatus: '', verificationStatus: '', onsetDateTime: '' },
    medications: { kind: 'statement', name: '', dosage: '', start: '', end: '' },
    'questionnaire.items': { linkId: '', text: '', answer: '' }
  };
  const blank = blanks[listPath];
  if (!blank) return;
  if (listPath === 'questionnaire.items') {
    record.questionnaire.items.push({ ...blank });
  } else {
    record[listPath].push({ ...blank });
  }
  renderDoctorAssignScreen();
}

function removeMedicalRecordItem(listPath, index) {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  commitMedicalRecordFormToState();
  const record = patient.medicalRecord;
  const list = listPath === 'questionnaire.items' ? record.questionnaire.items : record[listPath];
  if (!Array.isArray(list)) return;
  list.splice(index, 1);
  renderDoctorAssignScreen();
}

async function saveMedicalRecordForm() {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  const record = commitMedicalRecordFormToState();
  if (!record) return;
  record.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  if (!record.provenance.recorded) {
    record.provenance.recorded = record.updatedAt;
  }
  if (!record.provenance.agent) {
    const currentUser = getCurrentAuthUser();
    record.provenance.agent = currentUser?.display_name || currentUser?.login_identifier || '醫師';
  }
  patient.medicalRecord = record;
  saveDoctorWorkspace();
  try {
    const assignment = await syncDoctorAssignmentInbox(patient);
    renderDoctorDashboard();
    renderDoctorAssignScreen();
    appendSystemNotice(`病歷欄位已儲存到病人 ID：${assignment?.patientId || patient.id}。標示為「已送入」後，病人端就會看到。`);
  } catch (error) {
    appendSystemNotice(error.message || '病歷儲存失敗。');
  }
}

function buildMedicalRecordFhirPreview(patient) {
  const record = patient.medicalRecord || createEmptyMedicalRecord();
  const patientFullUrl = `urn:uuid:patient-${patient.id}`;
  const encounterFullUrl = `urn:uuid:encounter-${patient.id}`;
  const subjectRef = { reference: patientFullUrl };
  const encounterRef = { reference: encounterFullUrl };

  const entries = [];

  entries.push({
    fullUrl: patientFullUrl,
    resource: {
      resourceType: 'Patient',
      identifier: record.patient.identifier ? [{ value: record.patient.identifier }] : undefined,
      name: record.patient.name ? [{ text: record.patient.name }] : undefined,
      gender: record.patient.gender || undefined,
      birthDate: record.patient.birthDate || undefined
    }
  });

  entries.push({
    fullUrl: encounterFullUrl,
    resource: {
      resourceType: 'Encounter',
      status: 'finished',
      class: record.encounter.class ? { code: record.encounter.class } : undefined,
      serviceType: record.encounter.serviceType ? { text: record.encounter.serviceType } : undefined,
      subject: subjectRef,
      participant: record.encounter.practitionerName
        ? [{ individual: { display: record.encounter.practitionerName } }]
        : undefined,
      period: (record.encounter.periodStart || record.encounter.periodEnd) ? {
        start: record.encounter.periodStart || undefined,
        end: record.encounter.periodEnd || undefined
      } : undefined
    }
  });

  record.observations.forEach((obs, idx) => {
    if (!obs.code && !obs.display && !obs.value) return;
    entries.push({
      fullUrl: `urn:uuid:observation-${patient.id}-${idx}`,
      resource: {
        resourceType: 'Observation',
        status: 'preliminary',
        code: { coding: obs.code ? [{ code: obs.code, display: obs.display || undefined }] : undefined, text: obs.display || undefined },
        subject: subjectRef,
        encounter: encounterRef,
        effectiveDateTime: obs.effectiveDateTime || undefined,
        valueString: obs.value || undefined,
        interpretation: obs.interpretation ? [{ text: obs.interpretation }] : undefined,
        derivedFrom: obs.derivedFrom ? [{ display: obs.derivedFrom }] : undefined
      }
    });
  });

  if (record.questionnaire.name || record.questionnaire.items.length) {
    entries.push({
      fullUrl: `urn:uuid:questionnaireResponse-${patient.id}`,
      resource: {
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        questionnaire: record.questionnaire.name || undefined,
        subject: subjectRef,
        encounter: encounterRef,
        authored: record.questionnaire.authored || undefined,
        item: record.questionnaire.items.map((item) => ({
          linkId: item.linkId || undefined,
          text: item.text || undefined,
          answer: item.answer ? [{ valueString: item.answer }] : undefined
        }))
      }
    });
  }

  const compositionSections = [];
  if (record.composition.chiefComplaint) compositionSections.push({ title: '主訴', code: { text: 'chief-complaint' }, text: { div: record.composition.chiefComplaint } });
  if (record.composition.symptomSummary) compositionSections.push({ title: '症狀整理', code: { text: 'symptoms' }, text: { div: record.composition.symptomSummary } });
  if (record.composition.riskAlert) compositionSections.push({ title: '風險提醒', code: { text: 'risk-alert' }, text: { div: record.composition.riskAlert } });
  if (record.composition.followupSuggestion) compositionSections.push({ title: '建議補問', code: { text: 'followup' }, text: { div: record.composition.followupSuggestion } });
  if (record.composition.title || compositionSections.length) {
    entries.push({
      fullUrl: `urn:uuid:composition-${patient.id}`,
      resource: {
        resourceType: 'Composition',
        status: record.composition.status || 'preliminary',
        type: { text: 'Clinician summary' },
        subject: subjectRef,
        encounter: encounterRef,
        title: record.composition.title || undefined,
        section: compositionSections
      }
    });
  }

  record.documents.forEach((doc, idx) => {
    if (!doc.url && !doc.filename && !doc.type) return;
    entries.push({
      fullUrl: `urn:uuid:documentReference-${patient.id}-${idx}`,
      resource: {
        resourceType: 'DocumentReference',
        status: 'current',
        type: doc.type ? { text: doc.type } : undefined,
        subject: subjectRef,
        date: doc.date || undefined,
        content: [{
          attachment: {
            contentType: doc.contentType || undefined,
            url: doc.url || undefined,
            title: doc.filename || undefined
          }
        }]
      }
    });
  });

  record.conditions.forEach((cond, idx) => {
    if (!cond.code) return;
    entries.push({
      fullUrl: `urn:uuid:condition-${patient.id}-${idx}`,
      resource: {
        resourceType: 'Condition',
        clinicalStatus: cond.clinicalStatus ? { coding: [{ code: cond.clinicalStatus }] } : undefined,
        verificationStatus: cond.verificationStatus ? { coding: [{ code: cond.verificationStatus }] } : undefined,
        code: { text: cond.code },
        subject: subjectRef,
        onsetDateTime: cond.onsetDateTime || undefined
      }
    });
  });

  record.medications.forEach((med, idx) => {
    if (!med.name) return;
    const isRequest = med.kind === 'request';
    entries.push({
      fullUrl: `urn:uuid:${isRequest ? 'medicationRequest' : 'medicationStatement'}-${patient.id}-${idx}`,
      resource: {
        resourceType: isRequest ? 'MedicationRequest' : 'MedicationStatement',
        status: isRequest ? 'active' : 'recorded',
        medicationCodeableConcept: { text: med.name },
        subject: subjectRef,
        dosage: med.dosage ? [{ text: med.dosage }] : undefined,
        effectivePeriod: (med.start || med.end) ? {
          start: med.start || undefined,
          end: med.end || undefined
        } : undefined
      }
    });
  });

  const provenanceTargets = entries
    .filter((entry) => entry.resource.resourceType !== 'Patient')
    .map((entry) => ({ reference: entry.fullUrl }));
  if (provenanceTargets.length) {
    entries.push({
      fullUrl: `urn:uuid:provenance-${patient.id}`,
      resource: {
        resourceType: 'Provenance',
        target: provenanceTargets,
        recorded: record.provenance.recorded || record.updatedAt || undefined,
        activity: record.provenance.activity ? { text: record.provenance.activity } : { text: record.provenance.sourceType },
        agent: [{
          type: { text: record.provenance.sourceType },
          who: { display: record.provenance.agent || undefined }
        }]
      }
    });
  }

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries.map((entry) => ({
      fullUrl: entry.fullUrl,
      resource: JSON.parse(JSON.stringify(entry.resource))
    }))
  };
}

function previewMedicalRecordFhir() {
  const patient = getSelectedDoctorPatient();
  if (!patient) return;
  commitMedicalRecordFormToState();
  const bundle = buildMedicalRecordFhirPreview(patient);
  const text = JSON.stringify(bundle, null, 2);
  const overlay = document.getElementById('doctor-fhir-preview-overlay');
  const body = document.getElementById('doctor-fhir-preview-body');
  if (overlay && body) {
    body.textContent = text;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  } else {
    console.log('[FHIR PREVIEW]', bundle);
    appendSystemNotice('已在主控台輸出 FHIR JSON 預覽。');
  }
}

function closeMedicalRecordPreview() {
  const overlay = document.getElementById('doctor-fhir-preview-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

async function copyMedicalRecordPreview() {
  const body = document.getElementById('doctor-fhir-preview-body');
  if (!body) return;
  try {
    await navigator.clipboard.writeText(body.textContent || '');
    appendSystemNotice('已複製 FHIR JSON 到剪貼簿。');
  } catch {
    appendSystemNotice('複製失敗，請手動框選 JSON 文字。');
  }
}

function focusDoctorPendingTasks() {
  const pendingPatient = APP_STATE.doctorWorkspace.patients.find((patient) => (
    patient.medicalRecordStatus !== '已送入' || !hasPublishedDoctorOrder(patient.orderDraft)
  ));
  if (pendingPatient) {
    APP_STATE.doctorWorkspace.selectedPatientId = pendingPatient.id;
    saveDoctorWorkspace();
  }
  showScreen('screen-doctor-dashboard');
  appendSystemNotice(pendingPatient ? '已切到第一位待處理病人。' : '目前沒有待處理病人。');
}

function showScreen(screenId) {
  if (isDoctorUser() && ['screen-chat', 'screen-phq9', 'screen-report', 'screen-energy'].includes(screenId)) {
    screenId = 'screen-doctor-dashboard';
  }

  if (screenId === 'screen-doctor-assign') {
    renderDoctorAssignScreen();
  }

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
    fetchCurrentPatientAssignment({ silent: true }).catch(() => {});
  }

  if (screenId === 'screen-phq9') {
    renderPhq9Screen();
  }
  
  if (screenId === 'screen-energy') {
    tempSelectedMode = APP_STATE.selectedMode;
    refreshModeListUI();
  }

  if (screenId === 'screen-settings') {
    fetchCurrentPatientAssignment({ silent: true, render: false })
      .then(() => updateSettingsUI())
      .catch(() => updateSettingsUI());
    updateSettingsUI();
  }

  if (screenId === 'screen-home') {
    loadRecentSessions();
  }

  if (screenId === 'screen-doctor-dashboard') {
    renderDoctorDashboard();
  }

  updateScrollSafeArea();

  if (screenId === 'screen-chat') {
    syncPinnedSessionButtonState();
    window.requestAnimationFrame(() => {
      syncShortcutBarState();
      scrollChatToBottom();
    });
  }
}

function getSelectedModeDefinition() {
  return MODE_DEFINITIONS[APP_STATE.selectedMode] || MODE_DEFINITIONS.natural;
}

function shouldPreferManualModeDisplay() {
  return APP_STATE.selectedMode !== 'auto';
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
  if (tabId === 'doctor-assignment') {
    renderReportOutputs();
    fetchCurrentPatientAssignment({ silent: false }).catch(() => {});
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
      publishMoodSummaryForDoctor();
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
  publishMoodSummaryForDoctor();
}

function setPHQ(questionIndex, score) {
  const draft = PHQ9Tracker.getDraft();
  draft.scores[questionIndex] = Math.max(0, Math.min(3, Number(score) || 0));
  APP_STATE.phq9Scores[questionIndex] = draft.scores[questionIndex];
  PHQ9Tracker.saveDraft(draft);
  const phqCard = document.querySelectorAll('.phq-card')[questionIndex];
  if (phqCard) {
    phqCard.querySelectorAll('.phq-score-pill').forEach((opt, i) => {
      const active = i === draft.scores[questionIndex];
      opt.classList.toggle('active', active);
      opt.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
}

function updatePhq9Narrative(questionIndex, value) {
  const draft = PHQ9Tracker.getDraft();
  draft.narratives[questionIndex] = String(value || '').trim();
  PHQ9Tracker.saveDraft(draft);
}

function updatePhq9GlobalNote(value) {
  const draft = PHQ9Tracker.getDraft();
  draft.note = String(value || '').trim();
  PHQ9Tracker.saveDraft(draft);
}

function syncPhq9SessionState() {
  APP_STATE.phq9Draft = PHQ9Tracker.getDraft();
  APP_STATE.phq9Assessments = PHQ9Tracker.getAssessments();
  APP_STATE.phq9Scores = (APP_STATE.phq9Draft.scores || Array(9).fill(0)).slice(0, 9);
}

function renderPhq9Screen() {
  const container = document.getElementById('phq9-form-root');
  const latestSummary = document.getElementById('phq9-latest-summary');
  const summaryMeta = document.getElementById('phq9-latest-meta');
  const draft = PHQ9Tracker.getDraft();
  const latest = PHQ9Tracker.getLatestAssessment();

  if (latestSummary) {
    if (latest) {
      const severity = buildPhq9SeverityBand(latest.totalScore);
      latestSummary.innerHTML = `
        <div class="phq9-summary-score">${latest.totalScore}<span>/27</span></div>
        <div class="phq9-summary-text">目前嚴重度：${severity.zhLabel}</div>
      `;
      if (summaryMeta) {
        summaryMeta.textContent = `最新完成：${formatTimeLabel(latest.completedAt || latest.updatedAt || latest.createdAt || new Date().toISOString())}`;
      }
    } else {
      latestSummary.innerHTML = '<div class="phq9-summary-empty">還沒有完成過 PHQ-9。填完後這裡會顯示最新總分與趨勢。</div>';
      if (summaryMeta) {
        summaryMeta.textContent = '尚未填寫';
      }
    }
  }

  if (!container) return;

  container.innerHTML = PHQ9_QUESTION_DEFS.map((question, index) => {
    const score = Math.max(0, Math.min(3, Number(draft.scores[index]) || 0));
    const narrative = String(draft.narratives[index] || '');
    return `
      <div class="phq-card" data-phq-index="${index}">
        <div class="phq-card-head">
          <div class="phq-card-kicker">問題 ${index + 1}</div>
          <div class="phq-card-title">${escapeHtml(question.label)}</div>
          <div class="phq-card-prompt">${escapeHtml(question.prompt)}</div>
        </div>
        <div class="phq-score-row" role="group" aria-label="${escapeHtml(question.label)}">
          <button type="button" aria-pressed="${score === 0 ? 'true' : 'false'}" class="phq-score-pill ${score === 0 ? 'active' : ''}" onclick="setPHQ(${index}, 0)">0 完全沒有</button>
          <button type="button" aria-pressed="${score === 1 ? 'true' : 'false'}" class="phq-score-pill ${score === 1 ? 'active' : ''}" onclick="setPHQ(${index}, 1)">1 幾天</button>
          <button type="button" aria-pressed="${score === 2 ? 'true' : 'false'}" class="phq-score-pill ${score === 2 ? 'active' : ''}" onclick="setPHQ(${index}, 2)">2 一半以上天數</button>
          <button type="button" aria-pressed="${score === 3 ? 'true' : 'false'}" class="phq-score-pill ${score === 3 ? 'active' : ''}" onclick="setPHQ(${index}, 3)">3 幾乎每天</button>
        </div>
        <label class="phq-note-label" for="phq-note-${index}">正式敘述 / 補充說明</label>
        <textarea
          id="phq-note-${index}"
          class="phq-note-input"
          placeholder="請寫下這一題對你造成的正式描述，例如持續多久、影響到什麼、你怎麼感受。"
          oninput="updatePhq9Narrative(${index}, this.value)"
        >${escapeHtml(narrative)}</textarea>
      </div>
    `;
  }).join('');

  const noteInput = document.getElementById('phq9-global-note');
  if (noteInput && noteInput.value !== draft.note) {
    noteInput.value = draft.note || '';
  }
  const promptStatus = document.getElementById('phq9-prompt-status');
  if (promptStatus) {
    const latest = PHQ9Tracker.getLatestAssessment();
    if (latest) {
      const activeSeverity = buildPhq9SeverityBand(latest.totalScore);
      promptStatus.textContent = `目前 prompt 使用：最新完成版本，總分 ${latest.totalScore} 分，${activeSeverity.zhLabel}。`;
    } else {
      promptStatus.textContent = '目前 prompt 尚未帶入 PHQ-9。按「儲存並回到聊天」後才會更新。';
    }
  }
  const progress = document.getElementById('phq9-progress-count');
  if (progress) {
    progress.textContent = `PHQ-9 共 ${PHQ9_QUESTION_DEFS.length} 題，填完後可直接儲存並回到聊天。`;
  }
}

function renderPhq9ReportSummary() {
  const container = document.getElementById('report-phq9-summary');
  if (!container) return;
  const latest = PHQ9Tracker.getLatestAssessment();
  if (!latest) {
    container.innerHTML = `
      <div class="report-empty-copy">目前沒有 PHQ-9 紀錄。可從聊天頁右下角按鈕進入自評。</div>
      <button class="phq9-open-link-btn" type="button" onclick="openPhq9Assessment()">前往填寫 PHQ-9</button>
    `;
    return;
  }
  const severity = buildPhq9SeverityBand(latest.totalScore);
  const preview = latest.answers
    .slice(0, 3)
    .map((answer, index) => `${index + 1}. ${answer.label}：${answer.score} 分`)
    .join(' / ');
  container.innerHTML = `
    <div class="phq9-report-card">
      <div class="phq9-report-top">
        <div>
          <div class="phq9-report-title">最新 PHQ-9</div>
          <div class="phq9-report-meta">${escapeHtml(formatTimeLabel(latest.completedAt || latest.updatedAt || latest.createdAt || new Date().toISOString()))}</div>
        </div>
        <div class="phq9-report-score">${latest.totalScore}<span>/27</span></div>
      </div>
      <div class="phq9-report-band">${severity.zhLabel}</div>
      <div class="phq9-report-preview">${escapeHtml(preview || '尚未有逐題內容')}</div>
      <button class="phq9-open-link-btn" type="button" onclick="openPhq9Assessment()">重新填寫 PHQ-9</button>
    </div>
  `;
}

function openPhq9Assessment() {
  if (!ensurePatientUser('填寫 PHQ-9')) return;
  showScreen('screen-phq9');
  renderPhq9Screen();
  const firstInput = document.getElementById('phq9-note-0');
  window.requestAnimationFrame(() => firstInput?.focus());
}

function closePhq9Assessment() {
  showScreen('screen-chat');
}

function submitPhq9Assessment() {
  const assessment = PHQ9Tracker.commitDraft();
  syncPhq9SessionState();
  publishPhq9SummaryForDoctor(assessment);
  renderPhq9Screen();
  renderPhq9ReportSummary();
  appendSystemNotice(`已把 PHQ-9 最新版本帶入對話背景，總分 ${assessment.totalScore} 分。`);
  showScreen('screen-chat');
}

function updateModeLabels() {
  const selectedMode = getSelectedModeDefinition();
  const mode = shouldPreferManualModeDisplay()
    ? selectedMode
    : (
      ENGINE_MODE_DISPLAY[APP_STATE.runtimeMode] ||
      selectedMode ||
      MODE_DEFINITIONS.natural
    );
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
  APP_STATE.syncedMode = '';
  if (shouldPreferManualModeDisplay()) {
    APP_STATE.runtimeMode = getSelectedModeDefinition().command;
  }
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
  if (!ensurePatientUser('開始聊天')) return;
  showScreen('screen-chat');
  appendSystemNotice(`已切換為 ${MODE_DEFINITIONS[APP_STATE.selectedMode]?.display || '自然聊天'}。`);
}

function enterChatFromHome() {
  startChat();
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

const SHORTCUT_USER_MESSAGES = new Set([
  '請幫我整理成給醫師看的重點。',
  '請幫我看看我現在的狀態。',
  '請幫我整理成我自己看得懂的版本。',
  '請幫我準備 FHIR 草稿。'
]);

function isEphemeralShortcutMessage(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.ephemeral) return true;
  const content = String(item.content || '').trim();
  if (!content) return false;
  if (item.role === 'user' && SHORTCUT_USER_MESSAGES.has(content)) return true;
  if ((item.role === 'ai' || item.role === 'assistant')
      && /^.+ 已更新。你可以到 Reports 頁面查看最新內容。$/.test(content)) return true;
  return false;
}

async function activateShortcut(command) {
  const normalized = decodeURIComponent(String(command || '')).trim();
  if (!normalized) return;

  if (normalized.startsWith('OUTPUT:')) {
    const outputType = normalized.replace(/^OUTPUT:/, '');
    const visibleMessage = buildOutputShortcutMessage(outputType);
    await appendMessage('user', visibleMessage, { ephemeral: true });
    await requestOutput(outputType, { fromShortcut: true, visibleMessage, ephemeral: true });
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

// 截取對話預覽前 N 字，讓清單更整潔
function truncatePreview(text, maxLen = 22) {
  const str = String(text || '').trim();
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
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

  const lines = normalized.split('\n');
  const html = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<${listType}>${listItems.join('')}</${listType}>`);
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      flushList();
      html.push(`<h3>${renderInlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^##\s+/.test(line)) {
      flushList();
      html.push(`<h2>${renderInlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^#\s+/.test(line)) {
      flushList();
      html.push(`<h1>${renderInlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`);
    } else if (/^>\s?/.test(line)) {
      flushList();
      html.push(`<blockquote>${renderInlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listItems.push(`<li>${renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listItems.push(`<li>${renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      html.push(`<p>${renderInlineMarkdown(line)}</p>`);
    }
  }
  flushList();

  return html.join('');
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
  const pinButton = document.getElementById('chat-pin-session');

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
    list.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const button = event.target.closest('[data-session-open]');
      if (!button) return;
      event.preventDefault();
      continueSpecificSession(button.dataset.sessionOpen);
    });
  }

  if (pinButton && !pinButton.dataset.wired) {
    pinButton.dataset.wired = 'true';
    pinButton.addEventListener('click', togglePinnedSession);
  }

  syncPinnedSessionButtonState();
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
      if (decision.reason === 'safety_route' || decision.reason === 'risk_flag') {
        publishSafetyAccessForDoctor(decision.reason === 'risk_flag' ? '高風險標記' : '安全模式');
      }
      clearMicroInterventionCard();
      closeMicroInterventionDetail();
      microState.currentCardId = '';
    }
    return;
  }

  microState.currentCardId = decision.card.id;
  if (decision.reason === 'safety_route' || decision.reason === 'risk_flag') {
    publishSafetyAccessForDoctor(decision.reason === 'risk_flag' ? '高風險標記' : '安全模式');
  }
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

function renderClinicalTraceButton(group, btnRow, traceData) {
  if (!group) return;

  // Support both (group, btnRow, traceData) and (group, traceData)
  let actualTraceData = traceData;
  let targetBtnRow = btnRow;

  if (arguments.length === 2 || (traceData === undefined && btnRow && typeof btnRow.appendChild !== 'function')) {
    actualTraceData = btnRow;
    targetBtnRow = null;
  }

  if (!targetBtnRow) {
    targetBtnRow = group.querySelector('.trace-actions');
    if (!targetBtnRow) {
      targetBtnRow = document.createElement('div');
      targetBtnRow.className = 'trace-actions';
      group.appendChild(targetBtnRow);
    }
  }

  const btn = document.createElement('button');
  btn.className = 'clinical-trace-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', '查看系統決策紀錄');
  btn.title = '查看系統後處理與介入決策';
  btn.innerHTML = '<span class="mat-icon" style="font-size:16px">psychology</span> 系統決策';

  const t = actualTraceData;

  const panel = document.createElement('div');
  panel.className = 'clinical-trace-panel';
  panel.style.display = 'none';

  if (!t) {
    // 沒有 trace → 顯示「此訊息無決策紀錄」
    panel.innerHTML = `
      <div class="trace-header">🧠 系統決策</div>
      <div class="trace-row"><span class="trace-label">⚪ 狀態</span><span class="trace-value">此訊息沒有經過臨床後處理器（可能不是智慧獵手模式）</span></div>
    `;
  } else {
    const HAMD_ITEM_LABELS = {
      depressed_mood: '憂鬱情緒', guilt: '罪惡感', suicide: '自殺意念',
      insomnia_early: '早段失眠', insomnia_middle: '中段失眠', insomnia_late: '晚段失眠',
      work_and_activities: '工作與活動', retardation: '遲滯', agitation: '激動',
      anxiety_psychic: '精神性焦慮', anxiety_somatic: '身體性焦慮',
      somatic_gastrointestinal: '腸胃症狀', somatic_general: '一般身體症狀',
      genital: '性功能', hypochondriasis: '疑病症', weight_loss: '體重減輕',
      insight: '病識感'
    };

    const actionMap = {
      none_llm_correct: '✅ 不用（AI 問得很好）',
      append_question: '➕ 補了一題',
      replace_question: '🔄 換掉問題',
      no_probe_available: '⚠️ 沒有替代題',
      crash_fallback: '💥 出錯，用備用題',
      crash_last_resort: '💥 嚴重錯誤'
    };
    const reasonMap = {
      pass: '通過（AI 表現好）',
      no_question: 'AI 沒有提問',
      banned_question_type: '問了禁止類型',
      not_scoreable: '問句無法量化',
      wrong_item: '問錯重點',
      vague_functional: '太籠統',
      risk_override: '🚨 風險最高優先 → 強制安全確認',
      risk_detected_but_locked: '🚨 偵測到風險（但已問過 suicide）'
    };

    const itemLabel = HAMD_ITEM_LABELS[t.target_item] || t.target_item || '無';
    const actionLabel = actionMap[t.intervention_action] || t.intervention_action || '未知';
    const reasonLabel = reasonMap[t.intervention_reason] || t.intervention_reason || '未知';

    const interveneIcon = t.should_intervene ? '👉 需要' : '🤫 不用';
    const correctIcon = t.is_correct_item === null ? '⬜' : t.is_correct_item ? '✅' : '❌';
    const scoreIcon = t.is_scoreable ? '✅' : '❌';
    const riskIcon = t.risk_detected ? '🔴' : '🟢';

    const convModeMap = {
      clarifying: '🟢 釐清',
      probing:    '🟡 追問',
      switching:  '🔵 換題'
    };
    const convModeLabel = convModeMap[t.conversation_mode] || t.conversation_mode || '—';
    const summaryBadges = [
      `<span class="trace-badge">${escapeHtml(convModeLabel)}</span>`,
      `<span class="trace-badge">🎯 ${escapeHtml(itemLabel)}</span>`,
      `<span class="trace-badge">${escapeHtml(interveneIcon)}</span>`,
      `<span class="trace-badge">${t.risk_detected ? '🚨 有風險訊號' : '🟢 無高風險'}</span>`
    ].join(' ');
    const decisionPath = Array.isArray(t.decision_path) && t.decision_path.length
      ? t.decision_path.map((step) => `<div class="trace-step">${escapeHtml(step)}</div>`).join('')
      : '<div class="trace-step">（沒有額外決策路徑）</div>';

    panel.innerHTML = `
      <div class="trace-header">🧠 系統決策</div>
      <div class="trace-summary-strip">${summaryBadges}</div>
      <div class="trace-section-title">快速摘要</div>
      <div class="trace-row"><span class="trace-label">系統看到的狀態</span><span class="trace-value">${escapeHtml(convModeLabel)} / ${escapeHtml(reasonLabel)}</span></div>
      <div class="trace-row"><span class="trace-label">AI 原始問句</span><span class="trace-value">「${escapeHtml(t.extracted_question || '沒問問題')}」</span></div>
      <div class="trace-row"><span class="trace-label">原始輸出</span><span class="trace-value">「${escapeHtml((t.raw_output || '').substring(0, 90))}${(t.raw_output || '').length > 90 ? '…' : ''}」</span></div>
      <div class="trace-divider"></div>
      <div class="trace-section-title">系統判讀</div>
      <div class="trace-row"><span class="trace-label">當前該問</span><span class="trace-value">${escapeHtml(itemLabel)}</span></div>
      <div class="trace-row"><span class="trace-label">可評分嗎</span><span class="trace-value">${scoreIcon}</span></div>
      <div class="trace-row"><span class="trace-label">問對了嗎</span><span class="trace-value">${correctIcon}</span></div>
      <div class="trace-row"><span class="trace-label">風險訊號</span><span class="trace-value">${riskIcon}</span></div>
      <div class="trace-row"><span class="trace-label">系統介入</span><span class="trace-value">${escapeHtml(interveneIcon)}</span></div>
      <div class="trace-row"><span class="trace-label">介入動作</span><span class="trace-value">${escapeHtml(actionLabel)}</span></div>
      <div class="trace-divider"></div>
      <div class="trace-section-title">輸出結果</div>
      ${t.replacement_probe ? `<div class="trace-row"><span class="trace-label">替換問句</span><span class="trace-value">「${escapeHtml(t.replacement_probe.substring(0, 80))}${t.replacement_probe.length > 80 ? '…' : ''}」</span></div>` : ''}
      <div class="trace-divider"></div>
      <div class="trace-row trace-final"><span class="trace-label">最終問句</span><span class="trace-value">「${escapeHtml(t.final_question || '沒有問句')}」</span></div>
      <div class="trace-divider"></div>
      <div class="trace-section-title">決策路徑</div>
      <div class="trace-step-list">${decisionPath}</div>
      ${t.error ? `<div class="trace-row trace-error"><span class="trace-label">⚠️ 錯誤</span><span class="trace-value">${escapeHtml(t.error)}</span></div>` : ''}
    `;
  }

  btn.addEventListener('click', () => {
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    btn.classList.toggle('active', !isVisible);
  });

  btnRow.appendChild(btn);
  group.appendChild(panel);
}

function renderAiTraceButton(group, btnRow, aiTraceData) {
  if (!group) return;

  const btn = document.createElement('button');
  btn.className = 'clinical-trace-toggle ai-trace-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', '查看 AI 決策紀錄');
  btn.title = '查看 AI 端各 LLM 任務的判斷過程';
  btn.innerHTML = '<span class="mat-icon" style="font-size:16px">smart_toy</span> AI 決策';

  const panel = document.createElement('div');
  panel.className = 'clinical-trace-panel ai-trace-panel';
  panel.style.display = 'none';

  if (!aiTraceData) {
    panel.innerHTML = `
      <div class="trace-header">🤖 AI 決策紀錄</div>
      <div class="trace-row"><span class="trace-label">⚪ 狀態</span><span class="trace-value">此訊息沒有 AI 決策紀錄</span></div>
    `;
  } else {
    const HAMD_ITEM_LABELS = {
      depressed_mood: '憂鬱情緒', guilt: '罪惡感', suicide: '自殺意念',
      insomnia_early: '早段失眠', insomnia_middle: '中段失眠', insomnia_late: '晚段失眠',
      work_activities: '工作與活動', retardation: '遲滯', agitation: '激動',
      psychic_anxiety: '精神性焦慮', somatic_anxiety: '身體性焦慮',
      gastrointestinal_somatic: '腸胃症狀', general_somatic: '一般身體症狀',
      genital_symptoms: '性功能', hypochondriasis: '疑病症', weight_loss: '體重減輕',
      insight: '病識感'
    };
    const SUB_MODE_LABELS = {
      emotional_holding: '🟣 情緒承載',
      clinical_probing: '🔵 隱性 HAM-D 蒐集',
      choice_prompting: '🟡 選項支架',
      flow_conversation: '🟢 自然 flow'
    };
    const a = aiTraceData;
    const sections = [];
    const cm = a.conversation_mode_judge || null;
    const probe = a.probe_selector || null;
    const modeMap = {
      clarifying: '🟢 釐清',
      probing: '🟡 追問',
      switching: '🔵 換題'
    };
    const topBadges = [
      cm ? `<span class="trace-badge">${escapeHtml(modeMap[cm.mode] || cm.mode || '—')}</span>` : '',
      cm && (cm.hamd_dimension_label || cm.hamd_dimension) ? `<span class="trace-badge">🧭 ${escapeHtml(cm.hamd_dimension_label || cm.hamd_dimension)}</span>` : '',
      probe ? `<span class="trace-badge">${probe.should_ask === 'yes' ? '✅ 會問 HAMD' : '⏸️ 暫不問 HAMD'}</span>` : '',
      a.burden ? `<span class="trace-badge">負擔 ${escapeHtml(a.burden.burden_level || '—')}</span>` : ''
    ].filter(Boolean).join(' ');

    sections.push('<div class="trace-header">🤖 AI 決策紀錄</div>');
    if (topBadges) {
      sections.push(`<div class="trace-summary-strip">${topBadges}</div>`);
    }

    if (cm) {
      sections.push(`
        <div class="trace-section-title">先看結論</div>
        <div class="trace-row"><span class="trace-label">目前模式</span><span class="trace-value">${escapeHtml(modeMap[cm.mode] || cm.mode || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">AI 理由</span><span class="trace-value">${escapeHtml(cm.reason || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">目前題項</span><span class="trace-value">${escapeHtml(cm.target_item_label || cm.target_item_code || '—')}</span></div>
        ${(cm.mode === 'probing' || cm.mode === 'switching') ? `<div class="trace-row"><span class="trace-label">HAM-D 面向</span><span class="trace-value">${escapeHtml(cm.hamd_dimension_label || cm.hamd_dimension || '—')}</span></div>` : ''}
        <div class="trace-row"><span class="trace-label">HAM-D 準備度</span><span class="trace-value">${escapeHtml(cm.hamd_ready || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">推進狀態</span><span class="trace-value">${escapeHtml(cm.progression || '—')} / 繞圈：${escapeHtml(cm.loop_detected || '—')}</span></div>
        <div class="trace-divider"></div>
      `);
    }

    // 1. 負擔判定
    if (a.burden) {
      sections.push(`
        <div class="trace-section-title">📊 負擔判定</div>
        <div class="trace-row"><span class="trace-label">負擔等級</span><span class="trace-value">${escapeHtml(a.burden.burden_level || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">回應風格</span><span class="trace-value">${escapeHtml(a.burden.response_style || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">追問預算</span><span class="trace-value">${escapeHtml(a.burden.followup_budget || '—')}</span></div>
        <div class="trace-divider"></div>
      `);
    }

    // 2. HAM-D 進度
    if (a.hamd_progress) {
      const focusLabel = HAMD_ITEM_LABELS[a.hamd_progress.next_recommended_dimension] || a.hamd_progress.next_recommended_dimension || '—';
      const completion = typeof a.hamd_progress.completion === 'number'
        ? `${Math.round(a.hamd_progress.completion * 100)}%`
        : '—';
      const itemStatusEntries = Object.entries(a.hamd_progress.item_status || {});
      const statusBadges = itemStatusEntries.length
        ? itemStatusEntries.map(([code, status]) => {
            const label = HAMD_ITEM_LABELS[code] || code;
            const icon = status === 'complete' ? '✅' : status === 'partial' ? '🟡' : '⬜';
            return `<span class="trace-badge">${icon} ${escapeHtml(label)}</span>`;
          }).join(' ')
        : '<span class="trace-value">（尚無資料）</span>';
      sections.push(`
        <div class="trace-section-title">🎯 HAM-D 進度</div>
        <div class="trace-row"><span class="trace-label">階段</span><span class="trace-value">${escapeHtml(a.hamd_progress.progress_stage || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">下一推薦維度</span><span class="trace-value">${escapeHtml(focusLabel)}</span></div>
        <div class="trace-row"><span class="trace-label">完成度</span><span class="trace-value">${completion}</span></div>
        <div class="trace-row"><span class="trace-label">摘要</span><span class="trace-value">${escapeHtml(a.hamd_progress.status_summary || '—')}</span></div>
        <div class="trace-row trace-badges-row"><span class="trace-label">題項狀態</span><span class="trace-value">${statusBadges}</span></div>
        <div class="trace-divider"></div>
      `);
    }

    // 3. 對話三態
    if (cm) {
      sections.push(`
        <div class="trace-section-title">🧭 對話三態</div>
        <div class="trace-row"><span class="trace-label">判定模式</span><span class="trace-value">${escapeHtml(modeMap[cm.mode] || cm.mode || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">理由</span><span class="trace-value">${escapeHtml(cm.reason || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">主軸清晰度</span><span class="trace-value">${escapeHtml(cm.topic_clarity || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">HAM-D 準備度</span><span class="trace-value">${escapeHtml(cm.hamd_ready || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">推進狀態</span><span class="trace-value">${escapeHtml(cm.progression || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">是否繞圈</span><span class="trace-value">${escapeHtml(cm.loop_detected || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">目前題項</span><span class="trace-value">${escapeHtml(cm.target_item_label || cm.target_item_code || '—')}</span></div>
        ${(cm.mode === 'probing' || cm.mode === 'switching') ? `<div class="trace-row"><span class="trace-label">HAM-D 面向</span><span class="trace-value">${escapeHtml(cm.hamd_dimension_label || cm.hamd_dimension || '—')}</span></div>` : ''}
        <div class="trace-row"><span class="trace-label">系統備援</span><span class="trace-value">${escapeHtml(cm.fallback_mode || '—')} / ${escapeHtml(cm.fallback_reason || '—')}</span></div>
        <div class="trace-divider"></div>
      `);
    }

    // 4. 模式分流
    if (a.low_energy || a.intent || a.flow) {
      const subModeLabel = SUB_MODE_LABELS[a.flow && a.flow.sub_mode] || (a.flow && a.flow.sub_mode) || '—';
      sections.push(`
        <div class="trace-section-title">🔀 模式分流</div>
        ${a.low_energy ? `<div class="trace-row"><span class="trace-label">低能量偵測</span><span class="trace-value">${escapeHtml(a.low_energy)}</span></div>` : ''}
        ${a.intent ? `<div class="trace-row"><span class="trace-label">意圖分類</span><span class="trace-value">${escapeHtml(a.intent)}</span></div>` : ''}
        ${a.flow ? `
          <div class="trace-row"><span class="trace-label">子模式</span><span class="trace-value">${escapeHtml(subModeLabel)}</span></div>
          <div class="trace-row"><span class="trace-label">允許探針</span><span class="trace-value">${a.flow.can_probe_hamd ? '✅ 可' : '❌ 不可'}</span></div>
          <div class="trace-row"><span class="trace-label">連續追問</span><span class="trace-value">${a.flow.consecutive_probes ?? 0}</span></div>
          <div class="trace-row"><span class="trace-label">氣氛保護</span><span class="trace-value">${a.flow.atmosphere_protection ? '🛡️ 啟動' : '—'}</span></div>
        ` : ''}
        <div class="trace-divider"></div>
      `);
    }

    // 5. 探針選擇
    if (a.probe_selector) {
      const psItem = HAMD_ITEM_LABELS[a.probe_selector.item_code] || a.probe_selector.item_code || '—';
      const PROBE_STATUS_LABELS = {
        fresh:            '🟢 全新題目',
        sticky:           '🟡 黏著中（第1輪）',
        rescued:          '🟠 救了一次（第2輪，換問法）',
        circling_skipped: '🔴 繞圈→跳題',
        risk_override:    '🚨 風險覆寫',
        no_probe:         '— 不問'
      };
      const probeStatusLabel = PROBE_STATUS_LABELS[a.probe_selector.probe_status] || a.probe_selector.probe_status || '—';
      const skippedList = Array.isArray(a.probe_selector.skipped_items) && a.probe_selector.skipped_items.length
        ? a.probe_selector.skipped_items.map((c) => HAMD_ITEM_LABELS[c] || c).join('、')
        : '（無）';
      sections.push(`
        <div class="trace-section-title">🎣 探針選擇</div>
        <div class="trace-row"><span class="trace-label">循環狀態</span><span class="trace-value">${probeStatusLabel}</span></div>
        <div class="trace-row"><span class="trace-label">是否要問</span><span class="trace-value">${a.probe_selector.should_ask === 'yes' ? '✅ 是' : '❌ 否'}</span></div>
        <div class="trace-row"><span class="trace-label">選定題項</span><span class="trace-value">${escapeHtml(psItem)}</span></div>
        <div class="trace-row"><span class="trace-label">問題類型</span><span class="trace-value">${escapeHtml(a.probe_selector.question_type || '—')}</span></div>
        <div class="trace-row"><span class="trace-label">原因</span><span class="trace-value">${escapeHtml(a.probe_selector.reason || '—')}</span></div>
        ${a.probe_selector.probe_question ? `<div class="trace-row"><span class="trace-label">問句</span><span class="trace-value">「${escapeHtml(a.probe_selector.probe_question.substring(0, 60))}」</span></div>` : ''}
        <div class="trace-row"><span class="trace-label">已跳過題目</span><span class="trace-value">${escapeHtml(skippedList)}</span></div>
        <div class="trace-divider"></div>
      `);
    }

    // 6. 證據分類
    if (a.evidence_classifier && Array.isArray(a.evidence_classifier.items) && a.evidence_classifier.items.length) {
      const evidenceRows = a.evidence_classifier.items.map((it) => {
        const label = HAMD_ITEM_LABELS[it.item_code] || it.item_code;
        const evList = (it.evidence_summary || []).slice(0, 2).map((e) => escapeHtml(e)).join('；') || '（無）';
        return `<div class="trace-row"><span class="trace-label">${escapeHtml(label)}</span><span class="trace-value">${escapeHtml(it.evidence_type || '—')} / ${escapeHtml(it.confidence || '—')}<br><small>${evList}</small></span></div>`;
      }).join('');
      sections.push(`
        <div class="trace-section-title">🔍 證據分類</div>
        ${evidenceRows}
        <div class="trace-divider"></div>
      `);
    }

    // 7. 評分器
    if (a.scorer && Array.isArray(a.scorer.items) && a.scorer.items.length) {
      const scoreRows = a.scorer.items.map((it) => {
        const label = HAMD_ITEM_LABELS[it.item_code] || it.item_code;
        const score = it.ai_suggested_score == null ? '—' : it.ai_suggested_score;
        return `<div class="trace-row"><span class="trace-label">${escapeHtml(label)}</span><span class="trace-value">${score}<br><small>${escapeHtml((it.rating_rationale || '').substring(0, 80))}</small></span></div>`;
      }).join('');
      sections.push(`
        <div class="trace-section-title">⚖️ 評分器</div>
        ${scoreRows}
        <div class="trace-divider"></div>
      `);
    }

    // 8. Smart Hunter
    if (a.smart_hunter) {
      const shSubMode = SUB_MODE_LABELS[a.smart_hunter.sub_mode] || a.smart_hunter.sub_mode || '—';
      sections.push(`
        <div class="trace-section-title">🦊 Smart Hunter</div>
        <div class="trace-row"><span class="trace-label">採用子模式</span><span class="trace-value">${escapeHtml(shSubMode)}</span></div>
        <div class="trace-row"><span class="trace-label">收到探針</span><span class="trace-value">${a.smart_hunter.formal_probe_received && a.smart_hunter.formal_probe_received.should_ask === 'yes' ? '✅' : '—'} ${escapeHtml((a.smart_hunter.formal_probe_received && a.smart_hunter.formal_probe_received.item_code) || '')}</span></div>
        <div class="trace-row trace-final"><span class="trace-label">原始輸出</span><span class="trace-value">「${escapeHtml((a.smart_hunter.raw_output || '').substring(0, 120))}…」</span></div>
      `);
    }

    panel.innerHTML = sections.join('');
  }

  btn.addEventListener('click', () => {
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    btn.classList.toggle('active', !isVisible);
  });

  btnRow.appendChild(btn);
  group.appendChild(panel);
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
  TherapeuticMemory.renderProfileUI();
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

function setOutputCountdownState(text = '', options = {}) {
  const wrap = document.getElementById('chat-output-countdown');
  const textNode = document.getElementById('chat-output-countdown-text');
  const iconNode = document.getElementById('chat-output-countdown-icon');
  if (!wrap || !textNode || !iconNode) return;

  const message = String(text || '').trim();
  if (!message) {
    wrap.style.display = 'none';
    textNode.textContent = '';
    iconNode.textContent = 'hourglass_top';
    wrap.classList.remove('is-success', 'is-error');
    return;
  }

  const status = String(options.status || 'running').trim();
  wrap.style.display = 'flex';
  textNode.textContent = message;
  wrap.classList.remove('is-success', 'is-error');
  if (status === 'success') {
    wrap.classList.add('is-success');
    iconNode.textContent = 'check_circle';
  } else if (status === 'error') {
    wrap.classList.add('is-error');
    iconNode.textContent = 'error';
  } else {
    iconNode.textContent = 'hourglass_top';
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

function renderHamdSlider(group, probeMeta) {
  if (!probeMeta || !probeMeta.item_code) return;
  const isFrequency = probeMeta.type !== 'severity';
  const max = isFrequency ? 7 : 4;
  const labels = isFrequency
    ? ['從不', '1天', '2天', '3天', '4天', '5天', '6天', '每天']
    : ['完全沒有', '輕微', '中等', '嚴重', '非常嚴重'];
  const mid = Math.floor(max / 2);

  const wrapper = document.createElement('div');
  wrapper.className = 'hamd-slider-wrapper';
  wrapper.setAttribute('data-item-code', probeMeta.item_code);
  wrapper.innerHTML = `
    <div class="hamd-slider-inner">
      <input type="range" class="hamd-slider" min="0" max="${max}" step="1" value="${mid}">
      <div class="hamd-slider-labels">${labels.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="hamd-slider-actions">
        <button class="hamd-slider-confirm">確認（${labels[mid]}）</button>
        <button class="hamd-slider-skip">略過</button>
      </div>
    </div>`;

  const slider = wrapper.querySelector('.hamd-slider');
  const confirmBtn = wrapper.querySelector('.hamd-slider-confirm');
  const skipBtn = wrapper.querySelector('.hamd-slider-skip');

  slider.addEventListener('input', () => {
    confirmBtn.textContent = `確認（${labels[parseInt(slider.value, 10)]}）`;
  });

  confirmBtn.addEventListener('click', () => {
    APP_STATE.pendingSliderRating = {
      type: isFrequency ? 'frequency' : 'severity',
      value: parseInt(slider.value, 10),
      source: 'slider'
    };
    wrapper.classList.add('hamd-slider-confirmed');
    confirmBtn.disabled = true;
    skipBtn.disabled = true;
    slider.disabled = true;
    confirmBtn.textContent = `✓ 已記錄（${labels[parseInt(slider.value, 10)]}）`;
  });

  skipBtn.addEventListener('click', () => {
    APP_STATE.pendingSliderRating = null;
    wrapper.remove();
  });

  group.appendChild(wrapper);
}

async function appendMessage(role, text, options = {}) {
  const { bubble, group } = createMessageBubble(role);
  if (!bubble) return;

  APP_STATE.chatHistory.push({
    role,
    content: text,
    createdAt: new Date().toISOString(),
    ...(options.ephemeral ? { ephemeral: true } : {}),
    ...(options.traceData ? { traceData: options.traceData } : {}),
    ...(options.aiTraceData ? { aiTraceData: options.aiTraceData } : {})
  });
  APP_STATE.chatHistory = APP_STATE.chatHistory.slice(-24);

  if (role === 'ai' && options.animate) {
    await animateAiMessage(bubble, text);
    const btnRow = document.createElement('div');
    btnRow.className = 'trace-btn-row';
    group.appendChild(btnRow);
    renderClinicalTraceButton(group, btnRow, options.traceData || null);
    renderAiTraceButton(group, btnRow, options.aiTraceData || null);
    renderHamdSlider(group, options.probeMeta || null);
    return;
  }

  if (role === 'ai') {
    bubble.innerHTML = renderMessageMarkdown(text);
    const btnRow = document.createElement('div');
    btnRow.className = 'trace-btn-row';
    group.appendChild(btnRow);
    renderClinicalTraceButton(group, btnRow, options.traceData || null);
    renderAiTraceButton(group, btnRow, options.aiTraceData || null);
    renderHamdSlider(group, options.probeMeta || null);
  } else {
    bubble.textContent = text;
  }

  scrollChatToBottom();
  TherapeuticMemory.renderProfileUI();
}

function appendSystemNotice(text, options = {}) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const noticeKey = String(options.replaceKey || '').trim();
  const existing = noticeKey
    ? container.querySelector(`.sensor-badge[data-notice-key="${noticeKey}"]`)
    : null;
  const noticeMarkup = `<span>${escapeHtml(text)}</span><span class="mat-icon fill" style="font-size:14px">tune</span>`;
  if (existing) {
    existing.innerHTML = noticeMarkup;
    return existing;
  }

  const notice = document.createElement('div');
  notice.className = 'sensor-badge';
  notice.innerHTML = noticeMarkup;
  if (noticeKey) {
    notice.setAttribute('data-notice-key', noticeKey);
  }

  const firstNode = container.firstElementChild;
  if (firstNode) {
    container.insertBefore(notice, firstNode.nextSibling);
  } else {
    container.appendChild(notice);
  }
  return notice;
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

  if (payload.code === 'no_clinical_messages_for_ai') {
    return '目前沒有可分析的臨床內容。請先用 1-2 句描述最近的症狀（例如：失眠、肚子痛、發冷、情緒低落），再按一次「請分析我／整理給醫師／FHIR 草稿」。';
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

function setConsentQuickCheckResult(status = 'checking', summary = '', reasons = []) {
  const resultEl = document.getElementById('consent-quick-check-result');
  if (!resultEl) return;
  const lines = [String(summary || '').trim()].filter(Boolean);
  if (Array.isArray(reasons)) {
    reasons.filter(Boolean).slice(0, 3).forEach((reason) => {
      lines.push(`- ${String(reason).trim()}`);
    });
  }
  resultEl.className = `consent-quick-check-result ${status}`;
  resultEl.textContent = lines.join('\n');
  resultEl.hidden = false;
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
    userId: APP_STATE.userId || PROTOTYPE_SHARED_CHAT_USER_ID
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

function normalizeSessionSummaryRecord(session = {}) {
  if (!session || typeof session !== 'object') return null;
  const summary = summarizeSessionRecord(session);
  const fallbackState = session.state && typeof session.state === 'object' ? session.state : {};
  const fallbackMemory = session.memory_snapshot && typeof session.memory_snapshot === 'object'
    ? session.memory_snapshot
    : {};

  return {
    id: String(session.id || summary.id || '').trim(),
    user: String(session.user || summary.user || APP_STATE.userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID,
    startedAt: session.startedAt || summary.startedAt || '',
    updatedAt: session.updatedAt || summary.updatedAt || '',
    active_mode: String(session.active_mode || summary.active_mode || fallbackState.active_mode || fallbackMemory.active_mode || 'auto').trim() || 'auto',
    risk_flag: String(session.risk_flag || summary.risk_flag || fallbackState.risk_flag || fallbackMemory.risk_flag || 'false').trim() || 'false',
    latest_tag_summary: pickReadableSessionText([
      session.latest_tag_summary,
      summary.latest_tag_summary
    ], ''),
    last_user_message: pickReadableSessionText([
      session.last_user_message,
      summary.last_user_message
    ], ''),
    last_assistant_message: pickReadableSessionText([
      session.last_assistant_message,
      summary.last_assistant_message
    ], ''),
    note_history_count: Number.isFinite(Number(session.note_history_count))
      ? Number(session.note_history_count)
      : summary.note_history_count,
    has_clinician_summary: Boolean(session.has_clinician_summary ?? summary.has_clinician_summary),
    has_fhir_draft: Boolean(session.has_fhir_draft ?? summary.has_fhir_draft),
    has_corrupted_history: Boolean(session.has_corrupted_history ?? summary.has_corrupted_history),
    message_count: Number.isFinite(Number(session.message_count))
      ? Number(session.message_count)
      : summary.message_count
  };
}

function scoreSessionSummaryForDisplay(session = {}) {
  let score = 0;
  if (!session.has_corrupted_history) score += 4;
  if (session.last_user_message) score += 3;
  if (session.last_assistant_message) score += 2;
  if (session.latest_tag_summary) score += 1;
  score += Math.min(Number(session.message_count) || 0, 6);
  return score;
}

function mergeRecentSessionSummaries(localSessions = [], serverSessions = []) {
  const merged = new Map();

  [...(Array.isArray(serverSessions) ? serverSessions : []), ...(Array.isArray(localSessions) ? localSessions : [])]
    .map((session) => normalizeSessionSummaryRecord(session))
    .filter((session) => session && session.id)
    .forEach((session) => {
      const existing = merged.get(session.id);
      if (!existing) {
        merged.set(session.id, session);
        return;
      }

      const nextScore = scoreSessionSummaryForDisplay(session);
      const existingScore = scoreSessionSummaryForDisplay(existing);
      if (nextScore > existingScore || (nextScore === existingScore && String(session.updatedAt || '') > String(existing.updatedAt || ''))) {
        merged.set(session.id, { ...existing, ...session });
      } else {
        merged.set(session.id, { ...session, ...existing });
      }
    });

  return Array.from(merged.values())
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function buildFhirHistoryPreviewSessionExport(item = {}) {
  const baseExport = deepCloneSerializable(item.sessionExportPayload || {}, {});
  const refreshPayload = item.patientRefreshPayload && typeof item.patientRefreshPayload === 'object'
    ? item.patientRefreshPayload
    : {};

  if ((!baseExport.patient || typeof baseExport.patient !== 'object') && refreshPayload.patient) {
    baseExport.patient = deepCloneSerializable(refreshPayload.patient, {});
  } else if (refreshPayload.patient) {
    baseExport.patient = Object.assign({}, baseExport.patient, deepCloneSerializable(refreshPayload.patient, {}));
  }

  if ((!baseExport.session || typeof baseExport.session !== 'object') && refreshPayload.session) {
    baseExport.session = deepCloneSerializable(refreshPayload.session, {});
  } else if (refreshPayload.session) {
    baseExport.session = Object.assign({}, baseExport.session, deepCloneSerializable(refreshPayload.session, {}));
  }

  if (!String(baseExport.__deliveryTargetUrl || '').trim() && item.targetUrl) {
    baseExport.__deliveryTargetUrl = item.targetUrl;
  }

  return PatientProfile.applyToSessionExport(baseExport);
}

function buildFhirHistoryPreviewDraft(item = {}, sessionExport = {}) {
  if (item.draftPayload && typeof item.draftPayload === 'object') {
    return deepCloneSerializable(item.draftPayload, {});
  }

  const patientSummary = PatientProfile.buildReferenceSummary(sessionExport?.patient || {});
  return {
    delivery_status: item.deliveryStatus || 'pre_review',
    narrative_summary: String(item.summary || '').trim() || '這筆記錄沒有保留完整草稿，以下先顯示當時可回推的 Patient 內容。',
    resources: [{ resourceType: 'Patient', display: 'Patient / Subject Of Care' }],
    patient_reference_summary: patientSummary
  };
}

function setConsentPreviewChrome(options = {}) {
  const kickerNode = document.getElementById('consent-preview-kicker');
  const titleNode = document.getElementById('consent-preview-title');
  const introNode = document.getElementById('consent-preview-intro');
  const bottomNoteNode = document.getElementById('consent-preview-bottom-note');
  const progressNode = document.getElementById('consent-preview-progress');
  const backButton = document.getElementById('consent-preview-back');
  const checkButton = document.getElementById('consent-preview-check');
  const confirmButton = document.getElementById('consent-preview-confirm');

  if (kickerNode) kickerNode.textContent = options.kicker || '送出前確認';
  if (titleNode) titleNode.textContent = options.title || '即將送出的 FHIR 草稿';
  if (introNode) introNode.textContent = options.intro || '請先完整查看以下摘要內容。滑到最下方後，才會解鎖最後的送出按鈕。';
  if (bottomNoteNode) bottomNoteNode.textContent = options.bottomNote || '我已閱讀上方內容，理解這次送出會把目前摘要資料上傳到已設定的 FHIR 端點。';
  if (progressNode) progressNode.hidden = options.showProgress === false;
  if (backButton) backButton.textContent = options.backLabel || '返回修改';
  if (checkButton) checkButton.hidden = options.showCheck === false;
  if (confirmButton) confirmButton.hidden = options.showConfirm === false;
}

function openFhirHistoryPreview(entryId = '') {
  const historyItem = (APP_STATE.fhirReportHistory || []).find((item) => item.id === entryId);
  if (!historyItem) {
    appendSystemNotice('這筆歷史記錄目前找不到可預覽內容。');
    return;
  }

  const sessionExport = buildFhirHistoryPreviewSessionExport(historyItem);
  const fhirDraft = buildFhirHistoryPreviewDraft(historyItem, sessionExport);
  const previewBody = document.getElementById('consent-preview-body');
  const overlay = document.getElementById('consent-preview-overlay');
  const scrollBody = document.getElementById('consent-preview-scroll');
  const quickCheckResult = document.getElementById('consent-quick-check-result');

  setConsentPreviewChrome({
    kicker: '歷史預覽',
    title: historyItem.type === 'delivery' ? '已保存的 FHIR 交付內容' : '已保存的 FHIR 草稿內容',
    intro: '這裡是這筆歷史記錄當時保留下來的預覽內容。你可以先檢查 patient 草稿與摘要，再決定要不要回去重建。',
    bottomNote: historyItem.targetUrl
      ? `這筆記錄原本對應的 FHIR 端點是 ${historyItem.targetUrl}。`
      : '這是唯讀預覽，不會在這裡直接送出或修改資料。',
    backLabel: '關閉預覽',
    showProgress: false,
    showCheck: false,
    showConfirm: false
  });

  if (previewBody) {
    previewBody.innerHTML = `
      ${buildConsentPreviewHtml(sessionExport, fhirDraft, historyItem.deliveryResultPayload || null)}
      <details class="consent-preview-section consent-preview-details">
        <summary>查看這筆歷史記錄的原始保存內容</summary>
        <div class="consent-preview-details-body">
          <h4>FHIR History Entry JSON</h4>
          <pre class="consent-preview-json">${escapeHtml(JSON.stringify(historyItem, null, 2))}</pre>
        </div>
      </details>
    `;
  }

  if (quickCheckResult) {
    quickCheckResult.hidden = true;
    quickCheckResult.textContent = '';
    quickCheckResult.className = 'consent-quick-check-result';
  }
  if (scrollBody) {
    scrollBody.scrollTop = 0;
  }
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  }
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
    .slice(0, MAX_LOCAL_SESSION_ARCHIVE_RECORDS);
  localStorage.setItem(LOCAL_SESSION_ARCHIVE_KEY, JSON.stringify(normalized));
}

function migrateGuestSessionsToAuthUser(authUserId) {
  if (!authUserId || authUserId === DEFAULT_USER_ID) return;
  const records = loadLocalSessionArchiveRecords();
  const hasChanges = records.some((record) => record.user === DEFAULT_USER_ID);
  if (!hasChanges) return;

  const migratedRecords = records.map((record) => {
    if (record.user === DEFAULT_USER_ID) {
      return { ...record, user: authUserId };
    }
    return record;
  });
  saveLocalSessionArchiveRecords(migratedRecords);
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

function getRecentSessionSummaries(limit = MAX_LOCAL_SESSION_ARCHIVE_RECORDS) {
  // 每次取資料時順手把舊的 'web-demo-user' session 遷移到當前認證帳號
  const currentAuthId = APP_STATE.auth?.user?.id || '';
  if (currentAuthId) {
    migrateGuestSessionsToAuthUser(currentAuthId);
  }
  const normalizedLimit = Math.max(1, Number(limit) || MAX_LOCAL_SESSION_ARCHIVE_RECORDS);
  const localSessions = loadLocalSessionArchiveRecords()
    .map((session) => summarizeSessionRecord(session))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, normalizedLimit);
  return mergeRecentSessionSummaries(localSessions, APP_STATE.serverRecentSessions).slice(0, normalizedLimit);
}

async function fetchServerRecentSessions(limit = MAX_LOCAL_SESSION_ARCHIVE_RECORDS) {
  if (!isAuthenticated() || isDoctorUser()) {
    return [];
  }

  try {
    const normalizedLimit = Math.max(1, Number(limit) || MAX_LOCAL_SESSION_ARCHIVE_RECORDS);
    const response = await fetch(`/api/chat/sessions?limit=${encodeURIComponent(String(normalizedLimit))}`);
    const payload = await readJsonResponseSafe(response);
    if (!response.ok) {
      throw new Error(payload.error || '讀取雲端對話列表失敗');
    }
    return (Array.isArray(payload.sessions) ? payload.sessions : [])
      .map((session) => normalizeSessionSummaryRecord(session))
      .filter((session) => session && session.id);
  } catch (error) {
    console.warn('Unable to load server recent sessions:', error);
    return [];
  }
}

function buildCurrentSessionRecord() {
  if (!APP_STATE.conversationId) return null;
  const sessionExport = APP_STATE.reportOutputs.session_export || {};
  const history = normalizeChatHistoryEntries(APP_STATE.chatHistory.filter((e) => !isEphemeralShortcutMessage(e)));
  const lastUserMessage = findLatestHistoryContent(history, 'user');
  const lastAssistantMessage = findLatestHistoryContent(history, ['ai', 'assistant']);
  const latestTagPayload = APP_STATE.lastChatMetadata?.latest_tag_payload || sessionExport.latest_tag_payload || {};
  const state = {
    active_mode: APP_STATE.runtimeMode || APP_STATE.lastChatMetadata?.active_mode || sessionExport.active_mode || 'auto',
    risk_flag: APP_STATE.lastChatMetadata?.risk_flag || sessionExport.risk_flag || 'false',
    latest_tag_payload: deepCloneSerializable(latestTagPayload, {}),
    burden_level_state: deepCloneSerializable(APP_STATE.lastChatMetadata?.burden_level_state || sessionExport.burden_level_state || {}, {}),
    therapeutic_profile: deepCloneSerializable(TherapeuticMemory.get(), {}),
    clinician_summary_draft: deepCloneSerializable(sessionExport.clinician_summary_draft || {}, {}),
    patient_analysis: deepCloneSerializable(sessionExport.patient_analysis || {}, {}),
    patient_review_packet: deepCloneSerializable(sessionExport.patient_review_packet || {}, {}),
    fhir_delivery_draft: deepCloneSerializable(sessionExport.fhir_delivery_draft || {}, {}),
    hamd_progress_state: deepCloneSerializable(sessionExport.hamd_progress_state || {}, {}),
    hamd_formal_assessment: deepCloneSerializable(sessionExport.hamd_formal_assessment || {}, {}),
    red_flag_payload: deepCloneSerializable(sessionExport.red_flag_payload || {}, {}),
    patient_authorization_state: deepCloneSerializable(sessionExport.patient_authorization_state || {}, {}),
    delivery_readiness_state: deepCloneSerializable(sessionExport.delivery_readiness_state || {}, {}),
    summary_draft_state: deepCloneSerializable(sessionExport.summary_draft_state || {}, {})
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

function buildSessionArchiveFingerprint(record = {}) {
  const normalized = normalizeLocalSessionRecord(record);
  return JSON.stringify({
    id: normalized.id,
    user: normalized.user,
    history: normalized.history.map((item) => ({
      role: item.role,
      content: item.content
    })),
    state: normalized.state,
    memory_snapshot: normalized.memory_snapshot
  });
}

function hasMeaningfulSessionContent(record = null) {
  const target = record && typeof record === 'object' ? record : buildCurrentSessionRecord();
  if (!target) return false;
  const history = Array.isArray(target.history) ? target.history : [];
  if (history.length > 0) return true;
  const summary = summarizeSessionRecord(target);
  return Boolean(summary.last_user_message || summary.last_assistant_message || summary.latest_tag_summary);
}

function isSessionAlreadyArchived(record = null) {
  const target = record && typeof record === 'object' ? record : buildCurrentSessionRecord();
  if (!target || !target.id) return false;
  const archived = findLocalSessionArchiveById(target.id);
  if (!archived) return false;
  return buildSessionArchiveFingerprint(archived) === buildSessionArchiveFingerprint(target);
}

function shouldPromptToSaveCurrentSession() {
  const record = buildCurrentSessionRecord();
  if (!record || !record.id) return false;
  if (!hasMeaningfulSessionContent(record)) return false;
  return !isSessionAlreadyArchived(record);
}

function saveSessionRecordToLocalArchive(record = null) {
  const finalRecord = record && typeof record === 'object' ? normalizeLocalSessionRecord(record) : buildCurrentSessionRecord();
  if (!finalRecord || !finalRecord.id) return null;
  const records = loadLocalSessionArchiveRecords().filter((item) => item.id !== finalRecord.id);
  records.unshift(finalRecord);
  saveLocalSessionArchiveRecords(records);
  APP_STATE.recentSessions = getRecentSessionSummaries();
  syncPinnedSessionButtonState();
  return finalRecord;
}

function saveCurrentSessionToLocalArchive() {
  const record = buildCurrentSessionRecord();
  if (!record || !record.id) return;
  saveSessionRecordToLocalArchive(record);
}

async function maybeSaveCurrentSessionBefore(actionLabel = '離開目前這段對話') {
  // 每次 AI 回覆後已自動存檔，這裡只需補抓「尚未存過」的邊緣情況
  // （例如：使用者送出問題但 AI 還沒回覆就立刻離開）
  const record = buildCurrentSessionRecord();
  if (!record || !record.id || !hasMeaningfulSessionContent(record)) {
    return { proceeded: true, saved: false };
  }
  // 靜默自動儲存，不再彈出確認框打斷使用者
  saveSessionRecordToLocalArchive(record);
  return { proceeded: true, saved: true };
}

async function navigateHome() {
  if (isDoctorUser()) {
    showScreen('screen-doctor-dashboard');
    return;
  }
  if (APP_STATE.currentScreen !== 'screen-home') {
    await maybeSaveCurrentSessionBefore('回首頁');
  }
  showScreen('screen-home');
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
  APP_STATE.chatHistory = normalizeChatHistoryEntries(normalizedSession.history).filter((e) => !isEphemeralShortcutMessage(e)).slice(-24);
  APP_STATE.reportOutputs.session_export = buildSessionExportFromRecord(normalizedSession);
  APP_STATE.reportFhirDraft = {
    isLoading: false,
    error: '',
    emptyReason: '正在依據這段對話重新整理 FHIR 草稿...'
  };
  syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
  syncTherapeuticMemoryFromSessionExport(APP_STATE.reportOutputs.session_export);
  PHQ9Tracker.importFromSessionExport(APP_STATE.reportOutputs.session_export);
  syncPhq9SessionState();
  renderChatHistory(APP_STATE.chatHistory);
  updateModeLabels();
  renderReportOutputs();
  saveReportOutputsToCache();
  showScreen('screen-chat');
  refreshRestoredSessionOutputsIfNeeded(APP_STATE.reportOutputs.session_export).catch((error) => {
    console.warn('Unable to refresh restored session outputs:', error);
  });
}

function resetConversationState(options = {}) {
  const shouldPreserveReports = options.preserveReports !== false;
  const preservedReportOutputs = shouldPreserveReports
    ? normalizeCachedReportOutputs(APP_STATE.reportOutputs || createEmptyReportOutputs())
    : createEmptyReportOutputs();
  APP_STATE.conversationId = '';
  APP_STATE.pendingFreshSession = false;
  APP_STATE.syncedMode = '';
  APP_STATE.runtimeMode = '';
  APP_STATE.lastChatMetadata = null;
  APP_STATE.chatHistory = [];
  APP_STATE.reportOutputs = preservedReportOutputs;
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
  APP_STATE.restoredSessionRefresh = {
    conversationId: '',
    inFlight: false
  };
  saveReportOutputsToCache();
}

function buildConversationRequestState() {
  return {
    conversation_id: APP_STATE.conversationId,
    force_new_session: Boolean(!APP_STATE.conversationId && APP_STATE.pendingFreshSession),
    therapeutic_profile: TherapeuticMemory.get(),
    patient_profile: PatientProfile.get(),
    phq9_assessment: PHQ9Tracker.getLatestAssessment()
  };
}

function buildClientHistorySnapshot(limit = 48) {
  return (Array.isArray(APP_STATE.chatHistory) ? APP_STATE.chatHistory : [])
    .map((item) => {
      const role = item?.role === 'ai' ? 'assistant' : String(item?.role || '').trim().toLowerCase();
      const content = String(item?.content || '').trim();
      if (!content) return null;
      if (role !== 'user' && role !== 'assistant') return null;
      if (
        role === 'user'
        && detectOutputCommand(content)
        && !/[。；，\n]/.test(content)
        && content.replace(/\s+/g, '').length <= 24
      ) {
        return null;
      }
      return { role, content };
    })
    .filter(Boolean)
    .slice(-limit);
}

function finalizeConversationRequest(payload = {}) {
  APP_STATE.conversationId = payload.conversation_id || APP_STATE.conversationId;
  if (APP_STATE.conversationId) {
    APP_STATE.pendingFreshSession = false;
  }
}

function normalizeFhirDraftPayload(payload) {
  const finalPayload = Object.assign({}, payload);
  const preparedSessionExport = PatientProfile.applyToSessionExport(
    finalPayload.session_export || APP_STATE.pendingConsent.sessionExport || APP_STATE.reportOutputs.session_export || {}
  );
  const patientKey = String(preparedSessionExport?.patient?.key || '').trim();
  const enhanced = attachProfileToFhirResult(finalPayload.output || finalPayload, {
    patientRef: patientKey ? `Patient/${patientKey}` : '',
    patient: preparedSessionExport?.patient || {}
  });
  finalPayload.session_export = preparedSessionExport;
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
  const pinned = APP_STATE.pinnedSession;
  if (continueButton) {
    continueButton.disabled = !sessions.length;
  }

  if (!sessions.length && !pinned) {
    container.innerHTML = `<div class="home-session-empty">目前還沒有已保存的對話。你可以先開始一段新的聊天，之後這裡就會累積顯示你手動儲存過的紀錄。</div>`;
    return;
  }

  // ── 釘選區塊 ──────────────────────────────────────────────
  const pinnedHtml = pinned ? (() => {
    const summary = truncatePreview(pickReadableSessionText(
      [pinned.pinned_summary, pinned.last_user_message, pinned.last_assistant_message, pinned.latest_tag_summary],
      '這段釘選對話目前還沒有可讀摘要。'
    ), 28);
    const sub = truncatePreview(pickReadableSessionText(
      [pinned.pinned_sub, pinned.last_assistant_message, pinned.last_user_message, pinned.latest_tag_summary],
      '點進去可以直接展示這段對話。'
    ), 28);
    const flags = [
      pinned.risk_flag === 'true' ? '<span class="home-session-flag risk">高風險標記</span>' : '',
      pinned.has_clinician_summary ? '<span class="home-session-flag">有醫師摘要</span>' : '',
      pinned.has_fhir_draft ? '<span class="home-session-flag">有 FHIR 草稿</span>' : '',
      pinned.has_corrupted_history ? '<span class="home-session-flag risk">訊息疑似損壞</span>' : ''
    ].filter(Boolean).join('');
    const promptList = PINNED_SESSION_EXAMPLE_PROMPTS
      .map((prompt) => `<li class="home-session-demo-item">${escapeHtml(prompt)}</li>`)
      .join('');

    return `
      <div class="home-session-item is-pinned">
        <div class="home-session-card home-session-card-pinned" role="button" tabindex="0" data-session-open="${escapeHtml(pinned.id)}" aria-label="打開這段釘選對話">
          <div class="home-session-top">
            <div class="home-session-time">${escapeHtml(formatSessionTimestamp(pinned.updatedAt))}</div>
            <div class="home-session-actions">
              <div class="home-session-pin-badge"><span class="mat-icon fill">push_pin</span> 評審先看</div>
            </div>
          </div>
          <div class="home-session-summary">${escapeHtml(summary)}</div>
          <div class="home-session-sub">${escapeHtml(sub)}</div>
          ${flags ? `<div class="home-session-flags">${flags}</div>` : ''}
          <div class="home-session-note">
            推薦展示問法（直接貼到聊天框就能看出功能差異）：
            <ul class="home-session-demo-list">${promptList}</ul>
          </div>
        </div>
      </div>
    `;
  })() : '';

  // ── 非釘選清單（排除已釘選的那筆，按時間排序後預設收合）───────
  const pinnedId = pinned?.id || '';
  const otherSessions = sessions
    .filter((s) => s.id !== pinnedId)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  const sessionListHtml = otherSessions.map((session) => {
    const summary = truncatePreview(pickReadableSessionText(
      [session.latest_tag_summary, session.last_user_message, session.last_assistant_message],
      '這段對話目前還沒有可讀摘要。'
    ));
    const sub = truncatePreview(pickReadableSessionText(
      [session.last_assistant_message, session.last_user_message],
      '點進去可以繼續這段對話。'
    ));
    const flags = [
      session.risk_flag === 'true' ? '<span class="home-session-flag risk">高風險標記</span>' : '',
      session.has_clinician_summary ? '<span class="home-session-flag">有醫師摘要</span>' : '',
      session.has_fhir_draft ? '<span class="home-session-flag">有 FHIR 草稿</span>' : '',
      session.has_corrupted_history ? '<span class="home-session-flag risk">訊息疑似損壞</span>' : ''
    ].filter(Boolean).join('');

    return `
      <div class="home-session-item">
        <div class="home-session-card" role="button" tabindex="0" data-session-open="${escapeHtml(session.id)}" aria-label="打開這段對話">
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
        </div>
      </div>
    `;
  }).join('');

  // 收合區塊：有其他對話才顯示，預設關閉
  const historySection = otherSessions.length > 0
    ? `<details class="home-session-history">
        <summary class="home-session-history-toggle">
          <span class="mat-icon">history</span>
          其他對話紀錄（${otherSessions.length} 則）
          <span class="home-session-history-chevron mat-icon">expand_more</span>
        </summary>
        <div class="home-session-history-body">${sessionListHtml}</div>
      </details>`
    : (pinned ? '<div class="home-session-empty">目前沒有其他已保存對話，先展示上面的釘選對話即可。</div>' : '');

  container.innerHTML = `${pinnedHtml}${historySection}`;
}

function setHomeHistoryFeedback(text = '', options = {}) {
  const node = document.getElementById('home-history-feedback');
  if (!node) return;
  const message = String(text || '').trim();
  node.classList.remove('is-error', 'is-success');
  if (!message) {
    node.textContent = '';
    node.style.display = 'none';
    return;
  }
  if (options.status === 'error') node.classList.add('is-error');
  if (options.status === 'success') node.classList.add('is-success');
  node.textContent = message;
  node.style.display = 'block';
}

function removeUnavailableRecentSession(sessionId) {
  const targetId = String(sessionId || '').trim();
  if (!targetId) return;
  removeLocalSessionArchive(targetId);
  APP_STATE.serverRecentSessions = APP_STATE.serverRecentSessions.filter((item) => item.id !== targetId);
  APP_STATE.recentSessions = APP_STATE.recentSessions.filter((item) => item.id !== targetId);
  if (APP_STATE.pinnedSession?.id === targetId) {
    APP_STATE.pinnedSession = null;
    localStorage.removeItem(PINNED_SESSION_KEY);
  }
  renderRecentSessions();
}

async function deleteRecentSession(sessionId) {
  if (String(APP_STATE.pinnedSession?.id || '').trim() === String(sessionId || '').trim()) {
    appendSystemNotice('這段對話已被釘選，請先取消釘選後才能刪除。');
    return;
  }

  const target = APP_STATE.recentSessions.find((item) => item.id === sessionId);
  if (!target) return;

  const confirmed = window.confirm(`要刪除 ${formatSessionTimestamp(target.updatedAt)} 的這段對話嗎？這個動作無法復原。`);
  if (!confirmed) return;

  const removedLocalBackup = removeLocalSessionArchive(sessionId);
  let removedServerBackup = false;
  if (isAuthenticated()) {
    try {
      const response = await fetch(`/api/chat/session?id=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      removedServerBackup = response.ok;
    } catch (error) {
      console.warn('Unable to delete server session:', error);
    }
  }

  if (!removedLocalBackup && !removedServerBackup) {
    appendSystemNotice('目前沒有可刪除的已保存對話。');
    return;
  }

  APP_STATE.serverRecentSessions = APP_STATE.serverRecentSessions.filter((item) => item.id !== sessionId);
  APP_STATE.recentSessions = APP_STATE.recentSessions.filter((item) => item.id !== sessionId);
  if (APP_STATE.conversationId === sessionId) {
    resetConversationState();
    APP_STATE.chatHistory = [];
    renderChatHistory([]);
    showScreen('screen-home');
  } else {
    renderRecentSessions();
  }

  appendSystemNotice('已刪除這筆已保存對話。');
  renderRecentSessions();
}

async function loadRecentSessions() {
  const container = document.getElementById('home-session-list');
  setHomeHistoryFeedback('');
  if (container) {
    container.innerHTML = `<div class="home-session-empty">正在讀取最近對話...</div>`;
  }

  if (isDoctorUser()) {
    APP_STATE.pinnedSession = null;
    APP_STATE.serverRecentSessions = [];
    APP_STATE.recentSessions = [];
    if (container) {
      container.innerHTML = `<div class="home-session-empty">醫師端不顯示聊天紀錄，請進入病人管理工作台查看 AI 使用摘要。</div>`;
    }
    syncPinnedSessionButtonState();
    return;
  }

  APP_STATE.pinnedSession = loadPinnedSession();
  APP_STATE.serverRecentSessions = await fetchServerRecentSessions(MAX_LOCAL_SESSION_ARCHIVE_RECORDS);
  APP_STATE.recentSessions = getRecentSessionSummaries();
  if (APP_STATE.recentSessions.length || APP_STATE.pinnedSession) {
    renderRecentSessions();
  } else if (container) {
    container.innerHTML = isAuthenticated()
      ? `<div class="home-session-empty">目前還沒有可顯示的對話。你新的聊天內容存下來後，這裡就會開始累積。</div>`
      : `<div class="home-session-empty">目前這台裝置還沒有已保存的對話。登入後可把之後的對話同步到你的帳號。</div>`;
  }
  syncPinnedSessionButtonState();
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

  const items = (Array.isArray(history) ? history : []).filter((e) => !isEphemeralShortcutMessage(e));
  items.forEach((item) => {
    if (!item || !item.role || !item.content) return;
    const { group, bubble } = createMessageBubble(item.role);
    if (!bubble) return;
    if (item.role === 'ai') {
      bubble.innerHTML = renderMessageMarkdown(item.content);
      // 還原兩顆決策紀錄按鈕（含 trace 資料時才掛上）
      if (group) {
        renderClinicalTraceButton(group, item.traceData || null);
        renderAiTraceButton(group, item.aiTraceData || null);
      }
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
  return PatientProfile.applyToSessionExport({
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
    phq9_assessment: session.state?.phq9_assessment || {},
    __requiresRegeneration: !trustStructuredOutputs,
    __source: trustStructuredOutputs ? 'server_session' : 'local_archive'
  });
}

function shouldRefreshRestoredSessionOutputs(sessionExport = {}) {
  if (!sessionExport || typeof sessionExport !== 'object') return false;
  if (sessionExport.__requiresRegeneration) return true;
  const hasMeaningfulOutputs = Boolean(
    isValidClinicianSummaryOutput(sessionExport.clinician_summary_draft) ||
    isValidPatientAnalysisOutput(sessionExport.patient_analysis) ||
    isValidFhirDraftOutput(sessionExport.fhir_delivery_draft)
  );
  return !hasMeaningfulOutputs && Boolean(APP_STATE.conversationId && APP_STATE.chatHistory.length);
}

async function refreshRestoredSessionOutputsIfNeeded(sessionExport = {}) {
  const currentConversationId = String(APP_STATE.conversationId || '').trim();
  if (!currentConversationId || !shouldRefreshRestoredSessionOutputs(sessionExport)) {
    return;
  }
  if (
    APP_STATE.restoredSessionRefresh.inFlight &&
    APP_STATE.restoredSessionRefresh.conversationId === currentConversationId
  ) {
    return;
  }

  APP_STATE.restoredSessionRefresh = {
    conversationId: currentConversationId,
    inFlight: true
  };

  const noticeKey = 'restored-session-refresh';
  appendSystemNotice('正在重新整理這段對話的輸出資料...', { replaceKey: noticeKey });
  setOutputCountdownState('正在重新整理這段對話的輸出資料...');

  try {
    const payload = await fetchOutputPayload('session_export', '重新整理這段歷史對話的輸出資料');
    if (String(APP_STATE.conversationId || '').trim() !== currentConversationId) {
      return;
    }
    if (payload.session_export && typeof payload.session_export === 'object') {
      APP_STATE.reportOutputs.session_export = PatientProfile.applyToSessionExport(payload.session_export);
      syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
      syncTherapeuticMemoryFromSessionExport(APP_STATE.reportOutputs.session_export);
      APP_STATE.reportOutputs.updatedAt = formatTimeLabel(new Date());
      renderReportOutputs();
      saveReportOutputsToCache();
    }
    appendSystemNotice('這段對話的輸出資料已重新整理完成。', { replaceKey: noticeKey });
    setOutputCountdownState('這段對話的輸出資料已重新整理完成。', { status: 'success' });
    setTimeout(() => {
      if (String(APP_STATE.conversationId || '').trim() === currentConversationId) {
        setOutputCountdownState('');
      }
    }, 1800);
  } catch (error) {
    if (String(APP_STATE.conversationId || '').trim() !== currentConversationId) {
      return;
    }
    const failText = `這段對話的輸出資料重整失敗：${error.message || '未知錯誤'}`;
    appendSystemNotice(failText, { replaceKey: noticeKey });
    setOutputCountdownState(failText, { status: 'error' });
    setTimeout(() => {
      if (String(APP_STATE.conversationId || '').trim() === currentConversationId) {
        setOutputCountdownState('');
      }
    }, 3200);
  } finally {
    if (APP_STATE.restoredSessionRefresh.conversationId === currentConversationId) {
      APP_STATE.restoredSessionRefresh.inFlight = false;
    }
  }
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
      const error = new Error(payload.error || '讀取對話內容失敗');
      error.status = response.status;
      throw error;
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
    setHomeHistoryFeedback('目前還沒有可繼續的舊對話。', { status: 'error' });
    appendSystemNotice('目前還沒有可繼續的舊對話。');
    return;
  }
  try {
    setHomeHistoryFeedback('正在開啟上次對話...', { status: 'success' });
    await restoreSession(latest.id);
    setHomeHistoryFeedback(`已切換到 ${formatSessionTimestamp(latest.updatedAt)} 的對話。`, { status: 'success' });
    appendSystemNotice(`已切換到 ${formatSessionTimestamp(latest.updatedAt)} 的對話。`);
  } catch (error) {
    if (Number(error.status) === 404) {
      removeUnavailableRecentSession(latest.id);
      setHomeHistoryFeedback('這筆舊對話目前找不到可還原內容，已從首頁清單移除。', { status: 'error' });
      return;
    }
    setHomeHistoryFeedback(error.message || '切換舊對話失敗。', { status: 'error' });
    appendSystemNotice(error.message || '切換舊對話失敗。');
  }
}

async function continueSpecificSession(sessionId) {
  const target = APP_STATE.recentSessions.find((item) => item.id === sessionId)
    || (APP_STATE.pinnedSession?.id === sessionId ? APP_STATE.pinnedSession : null);
  if (!target) return;
  try {
    setHomeHistoryFeedback(`正在開啟 ${formatSessionTimestamp(target.updatedAt)} 的對話...`, { status: 'success' });
    await restoreSession(target.id);
    setHomeHistoryFeedback(`已切換到 ${formatSessionTimestamp(target.updatedAt)} 的對話。`, { status: 'success' });
    appendSystemNotice(`已切換到 ${formatSessionTimestamp(target.updatedAt)} 的對話。`);
  } catch (error) {
    if (Number(error.status) === 404) {
      removeUnavailableRecentSession(target.id);
      setHomeHistoryFeedback('這筆舊對話目前找不到可還原內容，已從首頁清單移除。', { status: 'error' });
      return;
    }
    setHomeHistoryFeedback(error.message || '切換舊對話失敗。', { status: 'error' });
    appendSystemNotice(error.message || '切換舊對話失敗。');
  }
}

async function startNewConversation() {
  setHomeHistoryFeedback('');
  await maybeSaveCurrentSessionBefore('開始新對話');
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
  const normalized = PatientProfile.applyToSessionExport(sessionExport || {});
  normalized.clinician_summary_draft = normalized.clinician_summary_draft && typeof normalized.clinician_summary_draft === 'object'
    ? normalized.clinician_summary_draft
    : {};
  const clinician = normalized.clinician_summary_draft;
  const fallbackMessages = Array.isArray(APP_STATE?.chatHistory)
    ? APP_STATE.chatHistory
        .filter((item) => item && item.role === 'user' && item.content)
        .map((item) => String(item.content).trim())
        .filter((item) => item && isClinicalFallbackMessage(item))
    : [];
  const fallbackNarrative = fallbackMessages.length
    ? fallbackMessages.slice(-3).join('；')
    : '';
  const extractedConcerns = [];
  const extractedSignals = [];
  const extractedObservations = [];

  fallbackMessages.slice(-12).forEach((message) => {
    const text = String(message || '').trim();
    if (!text) return;
    if (/(憂鬱|低落|沮喪|空虛|沒意義|提不起勁)/i.test(text)) {
      if (!extractedConcerns.includes('持續低落與憂鬱感')) extractedConcerns.push('持續低落與憂鬱感');
      if (!extractedSignals.includes('depressed_mood')) extractedSignals.push('depressed_mood');
      if (!extractedObservations.includes('對話內容顯示持續低落與動機下降。')) extractedObservations.push('對話內容顯示持續低落與動機下降。');
    }
    if (/(工作|上班|打工|沒動力|摸魚|無意義|自我實踐)/i.test(text)) {
      if (!extractedConcerns.includes('工作動力與意義感下降')) extractedConcerns.push('工作動力與意義感下降');
      if (!extractedSignals.includes('work_interest')) extractedSignals.push('work_interest');
      if (!extractedObservations.includes('近期工作或課業投入度下降，功能受影響。')) extractedObservations.push('近期工作或課業投入度下降，功能受影響。');
    }
    if (/(易怒|暴躁|煩躁|朋友|遠離|疏離|孤單)/i.test(text)) {
      if (!extractedConcerns.includes('易怒與人際疏離')) extractedConcerns.push('易怒與人際疏離');
      if (!extractedSignals.includes('agitation')) extractedSignals.push('agitation');
      if (!extractedObservations.includes('人際互動耐受度下降，伴隨疏離傾向。')) extractedObservations.push('人際互動耐受度下降，伴隨疏離傾向。');
    }
    if (/(心不在焉|變慢|拖住|專心|注意力)/i.test(text)) {
      if (!extractedConcerns.includes('注意力下降或思考拖慢')) extractedConcerns.push('注意力下降或思考拖慢');
      if (!extractedSignals.includes('retardation')) extractedSignals.push('retardation');
      if (!extractedObservations.includes('注意力維持困難，思考與反應速度下降。')) extractedObservations.push('注意力維持困難，思考與反應速度下降。');
    }
    if (/(睡不著|失眠|半夜醒|早醒|睡眠)/i.test(text)) {
      if (!extractedConcerns.includes('睡眠困擾')) extractedConcerns.push('睡眠困擾');
      if (!extractedSignals.includes('insomnia')) extractedSignals.push('insomnia');
      if (!extractedObservations.includes('睡眠中斷或入睡困難持續出現。')) extractedObservations.push('睡眠中斷或入睡困難持續出現。');
    }
    if (/(焦慮|緊張|心悸|不安|胃痛|肚子痛|腹痛|發冷|手腳冰冷|胸悶)/i.test(text)) {
      if (!extractedConcerns.includes('焦慮與身體緊繃')) extractedConcerns.push('焦慮與身體緊繃');
      if (!extractedSignals.includes('somatic_anxiety')) extractedSignals.push('somatic_anxiety');
      if (!extractedObservations.includes('對話內容顯示焦慮感與身體化反應（含腸胃不適或發冷）。')) extractedObservations.push('對話內容顯示焦慮感與身體化反應（含腸胃不適或發冷）。');
    }
    if (/(自責|怪自己|絕望|活著沒有意義|想消失|傷痕|自傷)/i.test(text)) {
      if (!extractedConcerns.includes('自責、無望或自傷風險線索')) extractedConcerns.push('自責、無望或自傷風險線索');
      if (!extractedSignals.includes('guilt')) extractedSignals.push('guilt');
      if (!extractedObservations.includes('出現自責或無望相關敘述，需持續風險釐清。')) extractedObservations.push('出現自責或無望相關敘述，需持續風險釐清。');
    }
  });

  const symptomObservations = Array.isArray(clinician.symptom_observations)
    ? clinician.symptom_observations.filter(Boolean)
    : [];
  const symptomInferenceTrack = Array.isArray(clinician.symptom_inference_track)
    ? clinician.symptom_inference_track.filter(Boolean)
    : [];
  const inferredObservationSummaries = symptomInferenceTrack
    .map((item) => String(item.summary || item.symptom_label || '').trim())
    .filter(Boolean);
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
    clinician.chief_concerns = extractedConcerns.length ? extractedConcerns : [];
  }

  if (!Array.isArray(clinician.symptom_observations) || !clinician.symptom_observations.length) {
    clinician.symptom_observations = inferredObservationSummaries.length
      ? inferredObservationSummaries
      : symptomObservations.length
        ? symptomObservations
        : (extractedObservations.length ? extractedObservations : []);
  }

  if (!Array.isArray(clinician.followup_needs) || !clinician.followup_needs.length) {
    clinician.followup_needs = [];
  }

  if (!Array.isArray(clinician.safety_flags) || !clinician.safety_flags.length) {
    clinician.safety_flags = [];
  }

  if (!Array.isArray(clinician.hamd_signals) || !clinician.hamd_signals.length) {
    clinician.hamd_signals = resolvedSignals.length ? resolvedSignals : (extractedSignals.length ? extractedSignals : []);
  }

  if (!String(clinician.draft_summary || '').trim()) {
    clinician.draft_summary = '';
  }

  if (!normalized.hamd_progress_state || typeof normalized.hamd_progress_state !== 'object') {
    normalized.hamd_progress_state = {};
  }

  if (!Array.isArray(normalized.hamd_progress_state.covered_dimensions) || !normalized.hamd_progress_state.covered_dimensions.length) {
    normalized.hamd_progress_state.covered_dimensions = resolvedSignals.length ? resolvedSignals : [];
  }

  if (!Array.isArray(normalized.hamd_progress_state.supported_dimensions) || !normalized.hamd_progress_state.supported_dimensions.length) {
    normalized.hamd_progress_state.supported_dimensions = Array.isArray(normalized.hamd_progress_state.covered_dimensions)
      ? [...normalized.hamd_progress_state.covered_dimensions]
      : [];
  }

  if (!Array.isArray(normalized.hamd_progress_state.recent_evidence) || !normalized.hamd_progress_state.recent_evidence.length) {
    normalized.hamd_progress_state.recent_evidence = clinician.symptom_observations.length
      ? [...clinician.symptom_observations]
      : [];
  }

  if (!normalized.hamd_progress_state.next_recommended_dimension) {
    normalized.hamd_progress_state.next_recommended_dimension = normalized.hamd_progress_state.covered_dimensions[0] || '';
  }

  if (!normalized.delivery_readiness_state || typeof normalized.delivery_readiness_state !== 'object') {
    normalized.delivery_readiness_state = {};
  }

  if (!normalized.delivery_readiness_state.readiness_status) {
    normalized.delivery_readiness_state.readiness_status = '';
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

function buildConsentPreviewHtml(sessionExport, fhirDraft, deliveryResultOverride = null) {
  const clinician = sessionExport?.clinician_summary_draft || {};
  const patient = sessionExport?.patient || {};
  const session = sessionExport?.session || {};
  const hamd = sessionExport?.hamd_progress_state || {};
  const deliveryTargetUrl = sessionExport?.__deliveryTargetUrl || '';
  const previewPatientIdentifier = getPreviewPatientIdentifier(sessionExport, deliveryTargetUrl);
  const resourceList = Array.isArray(fhirDraft?.resources) ? fhirDraft.resources : [];
  const resourceLabels = resourceList.map((item) => item.display || item.type || item.resourceType || 'Unknown');
  const snippet = buildFhirSnippet(
    fhirDraft,
    deliveryResultOverride || APP_STATE.reportOutputs.fhir_delivery_result || APP_STATE.pendingConsent.deliveryResult || null
  );
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
  const checkButton = document.getElementById('consent-preview-check');
  const scrollBody = document.getElementById('consent-preview-scroll');
  const previewBody = document.getElementById('consent-preview-body');
  const quickCheckResult = document.getElementById('consent-quick-check-result');
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.textContent = '同意送出';
  }
  if (checkButton) {
    checkButton.disabled = false;
    checkButton.textContent = '一鍵檢查可否送出';
  }
  if (scrollBody) {
    scrollBody.scrollTop = 0;
  }
  if (previewBody) {
    previewBody.innerHTML = '';
  }
  if (quickCheckResult) {
    quickCheckResult.hidden = true;
    quickCheckResult.className = 'consent-quick-check-result';
    quickCheckResult.textContent = '';
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
  setConsentPreviewChrome({
    kicker: '送出前確認',
    title: '即將送出的 FHIR 草稿',
    intro: '請先完整查看以下摘要內容。滑到最下方後，才會解鎖最後的送出按鈕。',
    bottomNote: '我已閱讀上方內容，理解這次送出會把目前摘要資料上傳到已設定的 FHIR 端點。',
    backLabel: '返回修改',
    showProgress: true,
    showCheck: true,
    showConfirm: true
  });
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

  setConsentPreviewChrome({
    kicker: '送出前確認',
    title: '即將送出的 FHIR 草稿',
    intro: '請先完整查看以下摘要內容。滑到最下方後，才會解鎖最後的送出按鈕。',
    bottomNote: '我已閱讀上方內容，理解這次送出會把目前摘要資料上傳到已設定的 FHIR 端點。',
    backLabel: '返回修改',
    showProgress: true,
    showCheck: true,
    showConfirm: true
  });
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
  const quickCheckResult = document.getElementById('consent-quick-check-result');
  if (quickCheckResult) {
    quickCheckResult.hidden = true;
    quickCheckResult.className = 'consent-quick-check-result';
    quickCheckResult.textContent = '';
  }

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
  // 不直接刪除 legacy archive — 先把資料合併到主 key，避免歷史對話遺失
  try {
    const legacyRaw = localStorage.getItem(LEGACY_LOCAL_SESSION_ARCHIVE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      const legacyRecords = Array.isArray(legacyParsed) ? legacyParsed : [];
      if (legacyRecords.length) {
        const mainRecords = loadLocalSessionArchiveRecords();
        const knownIds = new Set(mainRecords.map((r) => r.id));
        const merged = [...mainRecords];
        legacyRecords.forEach((rec) => {
          const normalized = normalizeLocalSessionRecord(rec);
          if (normalized.id && !knownIds.has(normalized.id)) {
            merged.push(normalized);
            knownIds.add(normalized.id);
          }
        });
        saveLocalSessionArchiveRecords(merged);
      }
      localStorage.removeItem(LEGACY_LOCAL_SESSION_ARCHIVE_KEY);
    }
  } catch (error) {
    console.warn('Unable to merge legacy session archive:', error);
  }
  localStorage.setItem('rourou.userId', PROTOTYPE_SHARED_CHAT_USER_ID);
  syncAuthStateToApp();

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
      force_refresh: true,
      client_history: buildClientHistorySnapshot(),
      therapeutic_profile: conversationState.therapeutic_profile,
      patient_profile: conversationState.patient_profile,
      phq9_assessment: conversationState.phq9_assessment,
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
  if (payload.session_export && typeof payload.session_export === 'object') {
    payload.session_export = PatientProfile.applyToSessionExport(payload.session_export);
  }
  APP_STATE.lastChatMetadata = payload.metadata || APP_STATE.lastChatMetadata;
  return payload;
}

async function runDeliveryQuickCheck() {
  if (APP_STATE.isSending) return;

  if (!APP_STATE.pendingConsent.sessionExport) {
    await openConsentPreview();
    if (!APP_STATE.pendingConsent.sessionExport) return;
  }

  const checkButton = document.getElementById('consent-preview-check');
  const originalText = checkButton ? checkButton.textContent : '一鍵檢查可否送出';
  if (checkButton) {
    checkButton.disabled = true;
    checkButton.textContent = '檢查中...';
  }
  setConsentQuickCheckResult('checking', '正在快速檢查是否可送出...');

  try {
    const sessionExport = prepareSessionExportForDelivery(
      APP_STATE.pendingConsent.sessionExport || {},
      APP_STATE.pendingConsent.deliveryTargetUrl || ''
    );
    if (!sessionExport.session?.encounterKey) {
      throw new Error('目前還沒有可送出的對話資料。');
    }

    sessionExport.patient_authorization_state = Object.assign(
      {},
      sessionExport.patient_authorization_state || {},
      {
        authorization_status: 'patient_authorized_manual_submit',
        share_with_clinician: 'yes',
        consent_note: `Quick check in UI at ${new Date().toISOString()}`
      }
    );

    const response = await fetch('/api/fhir/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionExport)
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || '快速檢查失敗');
    }

    const quick = payload.quick_check || {};
    const reasons = Array.isArray(quick.reasons) ? quick.reasons : [];
    if (quick.can_deliver) {
      setConsentQuickCheckResult('ready', `可送出：${quick.summary || '檢查通過。'}`, [
        `模式：${quick.mode_label || quick.mode || '-'}`,
        `目標：${quick.target_label || quick.target || 'dry-run'}`
      ]);
      appendSystemNotice('一鍵檢查結果：可送出。', { replaceKey: 'delivery-quick-check' });
    } else {
      setConsentQuickCheckResult('blocked', `目前不可送出：${quick.summary || '有阻擋原因。'}`, reasons);
      appendSystemNotice(`一鍵檢查結果：不可送出（${reasons[0] || '請看檢查結果'}）`, { replaceKey: 'delivery-quick-check' });
    }
  } catch (error) {
    setConsentQuickCheckResult('error', `一鍵檢查失敗：${error.message || '未知錯誤'}`);
    appendSystemNotice(`一鍵檢查失敗：${error.message || '未知錯誤'}`, { replaceKey: 'delivery-quick-check' });
  } finally {
    if (checkButton) {
      checkButton.disabled = false;
      checkButton.textContent = originalText || '一鍵檢查可否送出';
    }
  }
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
        patient_profile: conversationState.patient_profile,
        phq9_assessment: conversationState.phq9_assessment,
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
  if (!ensurePatientUser('開始對話')) return;
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

    const memoryMeter = buildKnowYouMeterState();
    setThinkingState(true, '正在分析對話脈絡...');
    await new Promise(r => setTimeout(r, 1200));
    setThinkingState(true, memoryMeter.shouldCompress ? '上下文快滿了，正在壓縮長期記憶...' : '同步臨床歷史紀錄...');
    await new Promise(r => setTimeout(r, 800));

    await ensureModeSynced();

    setThinkingState(true, '正在生成暖心回覆...');
    const config = getRuntimeConfig();
    const conversationState = buildConversationRequestState();
    const userPromptContext = buildUserPromptContextString();
    const memoryContext = TherapeuticMemory.buildContextString();
    const phq9Context = PHQ9Tracker.buildContextString();
    const contextParts = [userPromptContext, memoryContext, phq9Context].filter(Boolean);
    const messageWithMemory = contextParts.length ? `${contextParts.join('\n\n')}\n\n用戶說：${message}` : message;
    window.__lastChatRequestPreview = {
      message,
      messageWithMemory,
      contextParts,
      phq9Context,
      memoryMeter: buildKnowYouMeterState(),
      conversationState
    };
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageWithMemory,
        raw_message: message,
        conversation_id: conversationState.conversation_id,
        force_new_session: conversationState.force_new_session,
        therapeutic_profile: conversationState.therapeutic_profile,
        patient_profile: conversationState.patient_profile,
        phq9_assessment: conversationState.phq9_assessment,
        user: config.userId,
        user_self_rating: APP_STATE.pendingSliderRating || null,
        ...buildRuntimeRequestConfig(config)
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(formatChatError(payload));
    }

    APP_STATE.pendingSliderRating = null;
    finalizeConversationRequest(payload);
    APP_STATE.lastChatMetadata = payload.metadata || null;
    APP_STATE.reportOutputs.session_export = payload.session_export || APP_STATE.reportOutputs.session_export;
    APP_STATE.runtimeMode = payload.metadata?.active_mode || APP_STATE.runtimeMode;
    if (payload.metadata?.active_mode === 'safety' || payload.metadata?.risk_flag === 'true' || payload.session_export?.risk_flag === 'true') {
      publishSafetyAccessForDoctor(payload.metadata?.risk_flag === 'true' || payload.session_export?.risk_flag === 'true' ? '高風險標記' : '安全模式');
    }
    syncReportOutputsFromSessionExport(APP_STATE.reportOutputs.session_export);
    syncTherapeuticMemoryFromSessionExport(APP_STATE.reportOutputs.session_export);
    APP_STATE.turnCount++;
    updateModeLabels();
    renderReportOutputs();
    saveReportOutputsToCache();
    setTyping(false);
    console.log('[DEBUG] clinical_trace 收到了嗎？', payload.metadata?.clinical_trace ? '✅ 有' : '❌ 沒有', '| ai_trace:', payload.metadata?.ai_trace ? '✅ 有' : '❌ 沒有');
    await appendMessage('ai', payload.answer || '我有收到你的訊息，但這次沒有拿到完整回覆。', { animate: true, traceData: payload.metadata?.clinical_trace || null, aiTraceData: payload.metadata?.ai_trace || null, probeMeta: payload.metadata?.probe_meta || null });

    // 每次 AI 回覆後自動存檔，確保對話不因刷新/跳頁而消失
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
        patient_profile: conversationState.patient_profile,
        phq9_assessment: conversationState.phq9_assessment,
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

function attachProfileToFhirResult(fhirPayload, options = {}) {
  const profile = TherapeuticMemory.get();
  const patientSummary = PatientProfile.buildReferenceSummary(options.patient || {});
  const totalItems = profile.stressors.length + profile.triggers.length + profile.positiveAnchors.length;
  if (!totalItems && !patientSummary.lines.length) return fhirPayload; // 沒有可附加資料就跳過

  const profileObservations = totalItems
    ? buildProfileFhirObservations(profile, options.patientRef)
    : [];

  // 附加到 fhir_delivery 結果中（前端顯示用）
  const enhanced = Object.assign({}, fhirPayload);
  if (profileObservations.length) {
    enhanced.therapeutic_memory_observations = profileObservations;
    enhanced.therapeutic_memory_summary = {
      stressors: profile.stressors.map(s => s.label),
      triggers: profile.triggers.map(t => t.keyword),
      positiveAnchors: profile.positiveAnchors.map(a => a.label),
      commsPreference: profile.copingProfile.preferredStyle,
      sessionCount: profile.sessionCount,
      lastUpdated: profile.lastUpdatedAt
    };
  }
  if (patientSummary.lines.length) {
    enhanced.patient_reference_summary = patientSummary;
  }
  enhanced.narrative_summary = [
    enhanced.narrative_summary || '',
    patientSummary.lines.length ? '【Patient Draft 參考資料】' : '',
    ...patientSummary.lines.map((item) => `${item.label}：${item.value}`),
    patientSummary.lines.length ? '' : '',
    '',
    profileObservations.length ? '【心理畫像摘要（Therapeutic Memory）】' : '',
    profile.stressors.length ? `壓力來源：${profile.stressors.map(s => s.label).join('、')}` : '',
    profile.triggers.length ? `情緒觸發點：${profile.triggers.map(t => `「${t.keyword}」`).join(' ')}` : '',
    profile.copingProfile.preferredStyle ? `溝通偏好：${profile.copingProfile.preferredStyle}` : '',
    profile.positiveAnchors.length ? `正向錨點：${profile.positiveAnchors.map(a => a.label).join('、')}` : '',
    profileObservations.length ? `AI 陪伴次數：${profile.sessionCount} 次` : ''
  ].filter(Boolean).join('\n');

  enhanced.resources = (Array.isArray(fhirPayload.resources) ? fhirPayload.resources : []).concat(
    profileObservations.map((obs) => ({ type: 'Observation', code: obs.code.coding[0].code, display: obs.code.text }))
  );
  return enhanced;
}

function saveUserPrompt(textarea) {
  APP_STATE.aiSettings.userPrompt = textarea.value;
  localStorage.setItem('rourou.userPrompt', textarea.value);
}


async function requestOutput(outputType, options = {}) {
  if (!ensurePatientUser('產生報表')) return;
  if (APP_STATE.isSending) return;
  const definition = OUTPUT_DEFINITIONS[outputType] || { label: outputType, instruction: outputType };
  const countdownConfig = OUTPUT_COUNTDOWN_CONFIG[outputType] || null;
  APP_STATE.isSending = true;
  clearMicroInterventionCard();
  closeMicroInterventionDetail();
  appendSystemNotice(`正在產生 ${definition.label}...`);
  setTyping(true);
  const countdownKey = countdownConfig ? countdownConfig.key : '';
  let countdownTimer = null;
  let countdownClearTimer = null;
  setOutputCountdownState('');
  if (countdownConfig) {
    let remaining = Math.max(1, Number(countdownConfig.seconds) || 1);
    appendSystemNotice(`${countdownConfig.pendingText}，可能需要約 ${remaining} 秒。`, { replaceKey: countdownKey });
    setOutputCountdownState(`${countdownConfig.pendingText}，約 ${remaining} 秒`);
    countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining < 0) return;
      appendSystemNotice(`${countdownConfig.pendingText}，可能需要約 ${remaining} 秒。`, { replaceKey: countdownKey });
      setOutputCountdownState(`${countdownConfig.pendingText}，約 ${remaining} 秒`);
      if (remaining === 0 && countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);
  }

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
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (countdownClearTimer) {
      clearTimeout(countdownClearTimer);
      countdownClearTimer = null;
    }
    if (countdownConfig) {
      appendSystemNotice(countdownConfig.completedText, { replaceKey: countdownKey });
      setOutputCountdownState(countdownConfig.completedText, { status: 'success' });
      countdownClearTimer = setTimeout(() => setOutputCountdownState(''), 1600);
    } else {
      setOutputCountdownState('');
    }
    appendSystemNotice(`${definition.label} 已更新，請到 Reports 查看。`);
    if (options.fromChatCommand || options.fromShortcut) {
      await appendMessage('ai', `${definition.label} 已更新。你可以到 Reports 頁面查看最新內容。`, { animate: true, ephemeral: !!options.ephemeral });
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
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (countdownClearTimer) {
      clearTimeout(countdownClearTimer);
      countdownClearTimer = null;
    }
    if (countdownConfig) {
      const failText = `${countdownConfig.failedPrefix}：${error.message || '未知錯誤'}`;
      appendSystemNotice(failText, { replaceKey: countdownKey });
      setOutputCountdownState(failText, { status: 'error' });
      countdownClearTimer = setTimeout(() => setOutputCountdownState(''), 3200);
    } else {
      setOutputCountdownState('');
    }
    await appendMessage('ai', error.message || '目前無法產生輸出。', { animate: true });
  } finally {
    APP_STATE.isSending = false;
  }
}

async function authorizeAndSendReport() {
  if (!ensurePatientUser('送出報告')) return;
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
    saveReportOutputsToCache();
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
        saveReportOutputsToCache();
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
  saveReportOutputsToCache();
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
  PatientProfile.renderUI();

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

  const attendingName = document.getElementById('settings-attending-name');
  const attendingMeta = document.getElementById('settings-attending-meta');
  const attendingStatus = document.getElementById('settings-attending-status');
  const attending = getAttendingDoctorInfo();
  if (attendingName) {
    attendingName.textContent = attending ? attending.name : '尚未有醫師加入你的資料';
  }
  if (attendingMeta) {
    if (attending) {
      const syncedLabel = attending.syncedAt
        ? new Date(attending.syncedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '剛剛';
      const accessText = [
        attending.hasMedicalRecord ? '已送入病歷' : '尚未送入病歷',
        attending.hasOrder ? '已有醫囑' : '尚未送出醫囑'
      ].join('・');
      attendingMeta.textContent = `${accessText}・最近存取 ${syncedLabel}${attending.id ? `・醫師 ID：${attending.id}` : ''}`;
    } else {
      attendingMeta.textContent = '當醫師加入你的病人 ID 後，這裡會顯示目前正在存取資料的醫師。';
    }
  }
  if (attendingStatus) {
    attendingStatus.textContent = attending ? '已連結' : '未連結';
    attendingStatus.classList.toggle('complete', Boolean(attending));
    attendingStatus.classList.toggle('incomplete', !attending);
  }
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
  wrapper.id = 'ai-engine-runtime-card';
  wrapper.className = 'settings-runtime-panel';
  wrapper.innerHTML = `
    <details class="settings-card runtime-settings-details">
      <summary class="runtime-settings-summary">
        <div>
          <div class="settings-group-label">聊天流連線設定</div>
          <div class="settings-sub">一般使用者不用調整，只有切換模型或 API key 時才需要打開。</div>
        </div>
        <span class="mat-icon">expand_more</span>
      </summary>
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
    </details>
  `;

  const footer = settingsMain.querySelector('.app-footer');
  if (footer) settingsMain.insertBefore(wrapper, footer);
  else settingsMain.appendChild(wrapper);

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
    localStorage.setItem('rourou.userId', PROTOTYPE_SHARED_CHAT_USER_ID);
    APP_STATE.userId = PROTOTYPE_SHARED_CHAT_USER_ID;
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
  updateAuthUI();
  PatientProfile.wireForm();
  restoreReportOutputsFromCache();
  syncPhq9SessionState();
  showScreen('screen-home');
  wireHomeGuide();
  wireHomeSessionControls();
  updateModeLabels();
  injectRuntimeSettings();
  await loadServerRuntimeConfig();
  await restoreAuthenticatedSession();
  renderShortcutPager();
  wireShortcutInteractions();
  renderReportOutputs();
  renderPhq9ReportSummary();
  switchAutoAudience(APP_STATE.currentWeeklyAudience);
  TherapeuticMemory.renderProfileUI();
  PatientProfile.renderUI();
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
window.showRoleHome = showRoleHome;
window.showRoleReport = showRoleReport;
window.returnFromSettings = returnFromSettings;
window.selectDoctorPatient = selectDoctorPatient;
window.saveDoctorOrderDraft = saveDoctorOrderDraft;
window.publishDoctorOrder = publishDoctorOrder;
window.markMedicalRecordSent = markMedicalRecordSent;
window.generateDemoMedicalRecordAndOrder = generateDemoMedicalRecordAndOrder;
window.addMedicalRecordItem = addMedicalRecordItem;
window.removeMedicalRecordItem = removeMedicalRecordItem;
window.saveMedicalRecordForm = saveMedicalRecordForm;
window.previewMedicalRecordFhir = previewMedicalRecordFhir;
window.closeMedicalRecordPreview = closeMedicalRecordPreview;
window.copyMedicalRecordPreview = copyMedicalRecordPreview;
window.focusDoctorPendingTasks = focusDoctorPendingTasks;
window.openDoctorAddPatientModal = openDoctorAddPatientModal;
window.closeDoctorAddPatientModal = closeDoctorAddPatientModal;
window.submitDoctorAddPatient = submitDoctorAddPatient;
window.switchReportTab = switchReportTab;
window.toggleMoodTag = toggleMoodTag;
window.setPHQ = setPHQ;
window.handleInput = handleInput;
window.selectMode = selectMode;
window.startChat = startChat;
window.enterChatFromHome = enterChatFromHome;
window.selectAuthRole = selectAuthRole;
window.loginAuth = () => submitAuth('login');
window.registerAuth = () => submitAuth('register');
window.logoutAuth = logoutAuth;
window.closeAuthModal = closeAuthModal;
window.sendQuickReply = sendQuickReply;
window.activateShortcut = activateShortcut;
window.sendMessage = sendMessage;
window.requestOutput = requestOutput;
window.switchAutoAudience = switchAutoAudience;
window.toggleModeExplainer = toggleModeExplainer;
window.openMicroIntervention = openMicroIntervention;
window.triggerKnowYouCompressionTest = triggerKnowYouCompressionTest;
window.closeMicroInterventionDetail = closeMicroInterventionDetail;
window.dismissMicroIntervention = dismissMicroIntervention;
window.openShortcutComposer = openShortcutComposer;
window.closeShortcutComposer = closeShortcutComposer;
window.submitShortcutComposer = submitShortcutComposer;
window.removeCustomShortcut = removeCustomShortcut;
window.saveModeSettings = saveModeSettings;
window.refreshModeListUI = refreshModeListUI;
window.openConsentPreview = openConsentPreview;
window.runDeliveryQuickCheck = runDeliveryQuickCheck;
window.authorizeAndSendReport = authorizeAndSendReport;
window.saveReportForLater = saveReportForLater;
window.deleteFhirDraft = deleteFhirDraft;
window.removeFhirHistoryEntry = removeFhirHistoryEntry;
window.removeFhirHistoryResource = removeFhirHistoryResource;
window.openFhirHistoryPreview = openFhirHistoryPreview;
window.refreshPatientResource = refreshPatientResource;
window.toggleFhirResourceLinks = toggleFhirResourceLinks;
window.closeConsentPreview = closeConsentPreview;
window.saveUserPrompt = saveUserPrompt;
window.closeShortcutBar = closeShortcutBar;
window.navigateHome = navigateHome;
window.openPatientProfileModal = () => PatientProfile.openModal();
window.closePatientProfileModal = () => PatientProfile.closeModal();

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
