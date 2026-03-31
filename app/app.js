/* Rou Rou AI Companion
   Full UI navigation + real chat proxy integration */

const APP_STATE = {
  currentPage: 'mode',
  conversationId: '',
  userId: localStorage.getItem('rourou.userId') || `user-${crypto.randomUUID()}`,
  selectedMode: localStorage.getItem('rourou.selectedMode') || 'soulmate',
  syncedMode: '',
  isSending: false
};

const MODE_DEFINITIONS = {
  void: { command: 'void', label: '樹洞模式', display: 'Void Box 樹洞模式' },
  soulmate: { command: 'soulmate', label: '靈魂伴侶', display: 'Soul Mate 靈魂伴侶' },
  mission: { command: 'mission', label: '任務引導', display: 'Mission Guide 任務引導' },
  option: { command: 'option', label: '選擇模式', display: 'Option Selector' },
  natural: { command: 'natural', label: '自然聊天', display: 'Smart Hunter / 自然聊天' }
};

function getPageElement(pageId) {
  return document.getElementById(`page-${pageId}`);
}

function getModeButton(modeKey) {
  return document.querySelector(`.mode-card[data-mode="${modeKey}"], .mode-card-small[data-mode="${modeKey}"]`);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(value)));
  return div.innerHTML;
}

function updateModeLabels() {
  const mode = MODE_DEFINITIONS[APP_STATE.selectedMode] || MODE_DEFINITIONS.soulmate;
  const chatModeLabel = document.getElementById('chat-mode-label');
  const currentModeName = document.getElementById('current-mode-name');
  const statusMode = document.querySelector('.status-mode');

  if (chatModeLabel) {
    chatModeLabel.textContent = mode.label;
  }

  if (currentModeName) {
    currentModeName.textContent = mode.display;
  }

  if (statusMode) {
    statusMode.textContent = `模式：${mode.label}`;
  }
}

function syncActiveModeCard() {
  document.querySelectorAll('.mode-card, .mode-card-small').forEach((card) => {
    card.classList.remove('mode-active');
    const badge = card.querySelector('.active-badge');
    if (badge) badge.remove();
  });

  const activeCard = getModeButton(APP_STATE.selectedMode) || getModeButton('soulmate');
  if (!activeCard) {
    updateModeLabels();
    return;
  }

  activeCard.classList.add('mode-active');
  if (!activeCard.querySelector('.active-badge')) {
    const badge = document.createElement('div');
    badge.className = 'active-badge';
    badge.textContent = 'ACTIVE';
    activeCard.appendChild(badge);
  }

  updateModeLabels();
}

function navigateTo(pageId) {
  const nextPage = pageId || 'mode';
  if (APP_STATE.currentPage === nextPage) {
    return;
  }

  const current = getPageElement(APP_STATE.currentPage);
  if (current) {
    current.classList.remove('active');
    current.classList.add('exit-left');
    window.setTimeout(() => current.classList.remove('exit-left'), 400);
  }

  const target = getPageElement(nextPage);
  if (target) {
    target.classList.add('active');
    const scrollArea = target.querySelector('.scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
  }

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === nextPage);
  });

  APP_STATE.currentPage = nextPage;
}

function showScreen(pageId) {
  navigateTo(pageId);
}

function goBack() {
  navigateTo('mode');
}

function selectMode(element, modeLabel, modeKey) {
  const nextMode = modeKey || element?.dataset?.mode || 'soulmate';
  APP_STATE.selectedMode = nextMode;
  localStorage.setItem('rourou.selectedMode', APP_STATE.selectedMode);

  syncActiveModeCard();

  if (modeLabel) {
    const currentModeName = document.getElementById('current-mode-name');
    if (currentModeName) {
      currentModeName.textContent = modeLabel;
    }
  }

  APP_STATE.syncedMode = '';
}

function sendQuickReply(text) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = text;
  sendMessage();
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
  group.className = `msg-cluster ${role}`;
  group.innerHTML = `
    <div class="bubble ${role === 'user' ? 'user-bubble' : 'ai-bubble'}">
      <p>${escapeHtml(text)}</p>
    </div>
  `;

  const typingIndicator = container.querySelector('.typing-indicator');
  const insightFloat = container.querySelector('.insight-float');

  if (typingIndicator) {
    container.insertBefore(group, typingIndicator);
  } else if (insightFloat) {
    container.insertBefore(group, insightFloat);
  } else {
    container.appendChild(group);
  }

  group.style.opacity = '0';
  group.style.transform = 'translateY(10px)';
  requestAnimationFrame(() => {
    group.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    group.style.opacity = '1';
    group.style.transform = 'translateY(0)';
  });

  scrollChatToBottom();
}

function appendSystemNotice(text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const notice = document.createElement('div');
  notice.className = 'smart-hunter-indicator';
  notice.innerHTML = `<span>${escapeHtml(text)}</span><span class="material-symbols-outlined filled tiny">analytics</span>`;

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
    userId: localStorage.getItem('rourou.userId') || APP_STATE.userId
  };
}

async function ensureModeSynced() {
  const mode = MODE_DEFINITIONS[APP_STATE.selectedMode] || MODE_DEFINITIONS.soulmate;
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
    appendMessage('ai', payload.answer || '我已經收到你的訊息。');
  } catch (error) {
    appendMessage('ai', `聊天失敗：${error.message}`);
  } finally {
    setTyping(false);
    APP_STATE.isSending = false;
  }
}

function injectRuntimeSettings() {
  const settingsPage = document.getElementById('page-settings');
  if (!settingsPage || document.getElementById('dify-runtime-card')) {
    return;
  }

  const settingsMain = settingsPage.querySelector('main');
  if (!settingsMain) return;

  const wrapper = document.createElement('section');
  wrapper.className = 'settings-card';
  wrapper.id = 'dify-runtime-card';
  wrapper.innerHTML = `
    <div class="settings-group-label">DIFY CHATFLOW</div>
    <div class="settings-inner">
      <div class="setting-group">
        <div class="setting-title">
          <span class="material-symbols-outlined">link</span>
          <span>聊天連線設定</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <input id="dify-base-url" type="text" placeholder="https://api.dify.ai/v1" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="dify-api-key" type="password" placeholder="app-..." style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <input id="dify-user-id" type="text" placeholder="user id" style="width:100%;padding:12px 14px;border-radius:14px;background:#f5f8fb;border:1px solid #d7e0e7"/>
          <button id="save-dify-config" class="cta-primary with-icon" type="button">儲存聊天設定</button>
        </div>
        <p style="font-size:12px;color:#64727a;line-height:1.6;margin-top:12px">
          如果 Vercel 已設定環境變數，可不填 API key。這裡主要提供本機測試和手動覆蓋設定。
        </p>
      </div>
    </div>
  `;

  settingsMain.insertBefore(wrapper, settingsMain.firstChild);

  const config = getRuntimeConfig();
  const baseUrlInput = document.getElementById('dify-base-url');
  const apiKeyInput = document.getElementById('dify-api-key');
  const userIdInput = document.getElementById('dify-user-id');
  const saveButton = document.getElementById('save-dify-config');

  if (baseUrlInput) baseUrlInput.value = config.apiBaseUrl;
  if (apiKeyInput) apiKeyInput.value = config.apiKey;
  if (userIdInput) userIdInput.value = config.userId;

  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const nextBaseUrl = (baseUrlInput?.value || '').trim();
      const nextApiKey = (apiKeyInput?.value || '').trim();
      const nextUserId = (userIdInput?.value || '').trim();

      localStorage.setItem('rourou.difyBaseUrl', nextBaseUrl);
      localStorage.setItem('rourou.difyApiKey', nextApiKey);
      localStorage.setItem('rourou.userId', nextUserId || APP_STATE.userId);
      APP_STATE.userId = localStorage.getItem('rourou.userId') || APP_STATE.userId;
      APP_STATE.syncedMode = '';
      appendSystemNotice('聊天設定已更新');
    });
  }
}

function wireSecondaryInteractions() {
  document.querySelectorAll('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      if (!input) return;
      input.value = btn.textContent || '';
      sendMessage();
    });
  });

  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  document.querySelectorAll('.voice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.voice-btn').forEach((item) => item.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('.mode-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.mode-option').forEach((item) => item.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  document.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.insight-row');
      if (!row) return;

      row.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';
      row.style.maxHeight = `${row.offsetHeight}px`;
      window.setTimeout(() => {
        row.style.maxHeight = '0';
        row.style.padding = '0';
        row.style.margin = '0';
        window.setTimeout(() => row.remove(), 300);
      }, 300);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const initialModeButton = getModeButton(APP_STATE.selectedMode) || getModeButton('soulmate');
  if (initialModeButton) {
    selectMode(initialModeButton, initialModeButton.querySelector('h3')?.textContent || '', initialModeButton.dataset.mode);
  } else {
    updateModeLabels();
  }

  APP_STATE.currentPage = 'reports';
  navigateTo('mode');
  injectRuntimeSettings();
  wireSecondaryInteractions();
});

window.navigateTo = navigateTo;
window.showScreen = showScreen;
window.goBack = goBack;
window.selectMode = selectMode;
window.sendQuickReply = sendQuickReply;
window.sendMessage = sendMessage;
window.startChat = () => navigateTo('chat');
