const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GROQ_API_KEY = '';
const DEFAULT_GOOGLE_API_KEY = '';
const DEFAULT_PROVIDER = localStorage.getItem('rourou.aiProvider') || 'google';

const APP_STATE = {
  currentScreen: 'screen-chat',
  conversationId: '',
  userId: localStorage.getItem('rourou.userId') || `user-${crypto.randomUUID()}`,
  selectedMode: localStorage.getItem('rourou.selectedMode') || 'natural',
  syncedMode: '',
  isSending: false,
  currentReportTab: 'auto',
  moodPoints: [100, 100, 100, 100, 100, 100, 100], 
  selectedMoodTags: [],
  phq9Scores: Array(9).fill(0) 
};

const MODE_DEFINITIONS = {
  void: { command: 'void', label: '模式：樹洞模式', display: 'Void Box 樹洞模式' },
  soul: { command: 'soulmate', label: '模式：靈魂伴侶', display: 'Soul Mate 靈魂伴侶' },
  mission: { command: 'mission', label: '模式：任務引導', display: 'Mission Guide 任務引導' },
  option: { command: 'option', label: '模式：選擇模式', display: 'Option Selector' },
  smart: { command: 'natural', label: '模式：自然聊天', display: 'Smart Hunter / 自然聊天' },
  natural: { command: 'natural', label: '模式：自然聊天', display: '自然聊天' },
  auto: { command: 'auto', label: '模式：自動分流', display: 'Auto 自動分流' }
};

const OUTPUT_DEFINITIONS = {
  clinician_summary: { label: '整理給醫師', instruction: '幫我整理給醫生' },
  patient_review: { label: '病人審閱稿', instruction: '產生病人審閱稿' },
  fhir_delivery: { label: 'FHIR Draft', instruction: '產生FHIR draft' }
};

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

function handleInput(input) {
  const qrc = document.getElementById('quick-replies');
  const soa = document.getElementById('structured-output-actions');
  const hide = input.value.trim().length > 0;
  
  [qrc, soa].forEach(el => {
    if (!el) return;
    if (hide) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.pointerEvents = 'none';
      setTimeout(() => {
        if (input.value.trim().length > 0) el.style.display = 'none';
      }, 300);
    } else {
      el.style.display = 'flex';
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        el.style.pointerEvents = 'all';
      }, 50);
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

function appendMessage(role, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const group = document.createElement('div');
  group.className = `msg-group ${role}`;
  group.innerHTML = `<div class="bubble ${role === 'user' ? 'user-bubble' : 'ai-bubble'}">${escapeHtml(text)}</div>`;

  const typingIndicator = container.querySelector('.typing-indicator');
  if (typingIndicator) {
    container.insertBefore(group, typingIndicator);
  } else {
    container.appendChild(group);
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

  APP_STATE.isSending = true;
  appendMessage('user', message);
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
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
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
    appendMessage('ai', payload.answer || '我有收到你的訊息，但這次沒有拿到完整回覆。');
  } catch (error) {
    appendMessage('ai', error.message || '目前無法連接聊天流。');
  } finally {
    setTyping(false);
    APP_STATE.isSending = false;
  }
}

function formatOutputPayload(outputType, output) {
  const label = OUTPUT_DEFINITIONS[outputType]?.label || outputType;
  return `${label}\n\n${JSON.stringify(output, null, 2)}`;
}

async function requestOutput(outputType) {
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
    appendMessage('ai', payload.formatted_text || formatOutputPayload(payload.output_type, payload.output));
  } catch (error) {
    appendMessage('ai', error.message || '目前無法產生輸出。');
  } finally {
    setTyping(false);
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
  actionWrap.innerHTML = `
    <button class="qr-chip" type="button" onclick="requestOutput('clinician_summary')">整理給醫師</button>
    <button class="qr-chip" type="button" onclick="requestOutput('patient_review')">病人審閱稿</button>
    <button class="qr-chip" type="button" onclick="requestOutput('fhir_delivery')">FHIR Draft</button>
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
