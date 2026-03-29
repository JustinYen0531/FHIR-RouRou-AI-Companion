const APP_STATE = {
  currentScreen: 'screen-chat',
  conversationId: '',
  userId: localStorage.getItem('rourou.userId') || `user-${crypto.randomUUID()}`,
  selectedMode: localStorage.getItem('rourou.selectedMode') || 'natural',
  syncedMode: '',
  isSending: false
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

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === screenId);
  });

  document.querySelectorAll('.bottom-nav .nav-item').forEach((item) => {
    const target = item.getAttribute('onclick') || '';
    item.classList.toggle('active', target.includes(screenId));
  });

  APP_STATE.currentScreen = screenId;
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

function setTyping(visible) {
  const indicator = document.querySelector('.typing-indicator');
  if (indicator) {
    indicator.style.display = visible ? 'flex' : 'none';
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

function getRuntimeConfig() {
  return {
    apiBaseUrl: localStorage.getItem('rourou.difyBaseUrl') || 'https://api.dify.ai/v1',
    apiKey: localStorage.getItem('rourou.difyApiKey') || '',
    userId: APP_STATE.userId
  };
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
      api_key: config.apiKey,
      api_base_url: config.apiBaseUrl,
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
  setTyping(true);

  try {
    await ensureModeSynced();

    const config = getRuntimeConfig();
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: APP_STATE.conversationId,
        user: config.userId,
        api_key: config.apiKey,
        api_base_url: config.apiBaseUrl
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || '聊天訊息送出失敗');
    }

    APP_STATE.conversationId = payload.conversation_id || APP_STATE.conversationId;
    appendMessage('ai', payload.answer || '我有收到你的訊息，但這次沒有拿到完整回覆。');
  } catch (error) {
    appendMessage('ai', `目前無法連接聊天流：${error.message}`);
  } finally {
    setTyping(false);
    APP_STATE.isSending = false;
  }
}

function injectRuntimeSettings() {
  const settingsScreen = document.getElementById('screen-settings');
  if (!settingsScreen || document.getElementById('dify-runtime-card')) return;

  const settingsMain = settingsScreen.querySelector('main');
  if (!settingsMain) return;

  const wrapper = document.createElement('section');
  wrapper.className = 'settings-card';
  wrapper.id = 'dify-runtime-card';
  wrapper.innerHTML = `
    <div class="settings-group-label">DIFY CHATFLOW</div>
    <div class="settings-inner">
      <div class="setting-group">
        <div class="setting-title">
          <span class="mat-icon">link</span>
          <span>聊天流連線設定</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <input id="dify-base-url" type="text" placeholder="https://api.dify.ai/v1" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="dify-api-key" type="password" placeholder="app-..." style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="dify-user-id" type="text" placeholder="user id" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <button id="save-dify-config" class="cta-primary with-icon" type="button">儲存聊天流設定</button>
        </div>
        <p style="font-size:12px;color:#64727a;line-height:1.6;margin-top:12px">
          建議把 API key 放在本地 server 的環境變數。這裡的欄位是為了本機 demo 整合使用。
        </p>
      </div>
    </div>
  `;

  settingsMain.insertBefore(wrapper, settingsMain.firstChild);

  const config = getRuntimeConfig();
  document.getElementById('dify-base-url').value = config.apiBaseUrl;
  document.getElementById('dify-api-key').value = config.apiKey;
  document.getElementById('dify-user-id').value = config.userId;

  document.getElementById('save-dify-config').addEventListener('click', () => {
    localStorage.setItem('rourou.difyBaseUrl', document.getElementById('dify-base-url').value.trim());
    localStorage.setItem('rourou.difyApiKey', document.getElementById('dify-api-key').value.trim());
    localStorage.setItem('rourou.userId', document.getElementById('dify-user-id').value.trim() || APP_STATE.userId);
    APP_STATE.userId = localStorage.getItem('rourou.userId') || APP_STATE.userId;
    APP_STATE.syncedMode = '';
    appendSystemNotice('聊天流設定已更新。之後送出的訊息會走 Dify Chatflow。');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  showScreen('screen-chat');
  updateModeLabels();
  injectRuntimeSettings();
});

window.showScreen = showScreen;
window.selectMode = selectMode;
window.startChat = startChat;
window.sendQuickReply = sendQuickReply;
window.sendMessage = sendMessage;
