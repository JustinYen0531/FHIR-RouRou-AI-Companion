const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_AUTH_STORE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), 'ai-companion-auth.json')
  : path.join(__dirname, '..', '.data', 'ai-companion-auth.json');
const ROLE_SET = new Set(['patient', 'doctor']);
const STATUS_SET = new Set(['active', 'disabled']);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = 'sha512';
const AUTH_TOKEN_SECRET = process.env.AI_COMPANION_AUTH_TOKEN_SECRET || 'rourou-demo-auth-token-secret-v1';
const DEFAULT_DEMO_USERS = [
  {
    role: 'patient',
    display_name: '星澄',
    login_identifier: 'Justin',
    password: '3553'
  },
  {
    role: 'doctor',
    display_name: '星澄',
    login_identifier: 'Dr. Justin',
    password: '3553'
  }
];

function createAuthError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ROLE_SET.has(role) ? role : '';
}

function normalizeStatus(value, fallback = 'active') {
  const status = String(value || '').trim().toLowerCase();
  return STATUS_SET.has(status) ? status : fallback;
}

function normalizeLoginIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDisplayName(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function generateStableUserId(role, loginIdentifier) {
  const hash = crypto
    .createHash('sha256')
    .update(`${role}:${normalizeLoginIdentifier(loginIdentifier)}`)
    .digest('hex')
    .slice(0, 12);
  return `${role}_${hash}`;
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
  return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
}

function signTokenPayload(encodedPayload) {
  return crypto
    .createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(String(encodedPayload || ''))
    .digest('base64url');
}

function createPortableToken(user, session) {
  const payload = base64UrlEncode({
    version: 1,
    user: sanitizeUser(user),
    session,
    expires_at: session.expires_at
  });
  return `rourou_v1.${payload}.${signTokenPayload(payload)}`;
}

function verifyPortableToken(token = '') {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'rourou_v1') return null;
  const [, encodedPayload, signature] = parts;
  const expectedSignature = signTokenPayload(encodedPayload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const payload = base64UrlDecode(encodedPayload);
    const expiresAt = Date.parse(payload?.expires_at || payload?.session?.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    const user = sanitizeUser(payload.user || {});
    const rawSession = payload.session || {};
    const session = {
      id: String(rawSession.id || '').trim(),
      token_hash: String(rawSession.token_hash || 'portable').trim(),
      user_id: String(rawSession.user_id || user.id || '').trim(),
      created_at: String(rawSession.created_at || '').trim() || new Date().toISOString(),
      expires_at: String(rawSession.expires_at || payload.expires_at || '').trim()
    };
    if (!user.id || !user.role || !session.id || !session.user_id || !session.expires_at) return null;
    return { session, user };
  } catch {
    return null;
  }
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(String(password || ''), salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST).toString('hex');
  return ['pbkdf2', PASSWORD_DIGEST, PASSWORD_ITERATIONS, salt, derived].join('$');
}

function verifyPassword(password, passwordHash) {
  const raw = String(passwordHash || '').trim();
  const [scheme, digest, iterationText, salt, expectedHash] = raw.split('$');
  if (scheme !== 'pbkdf2' || !digest || !salt || !expectedHash) return false;
  const iterations = Number(iterationText);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const derived = crypto.pbkdf2Sync(String(password || ''), salt, iterations, PASSWORD_KEYLEN, digest).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

function sanitizeUser(user = {}) {
  return {
    id: String(user.id || '').trim(),
    role: normalizeRole(user.role),
    display_name: normalizeDisplayName(user.display_name, '未命名使用者'),
    login_identifier: normalizeLoginIdentifier(user.login_identifier),
    status: normalizeStatus(user.status),
    created_at: String(user.created_at || '').trim() || new Date().toISOString(),
    updated_at: String(user.updated_at || '').trim() || new Date().toISOString()
  };
}

function normalizeUserRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const user = sanitizeUser(record);
  if (!user.id || !user.role || !user.login_identifier) return null;
  const passwordHash = String(record.password_hash || '').trim();
  if (!passwordHash) return null;
  return {
    ...user,
    password_hash: passwordHash
  };
}

function normalizeSessionRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const id = String(record.id || '').trim();
  const tokenHash = String(record.token_hash || '').trim();
  const userId = String(record.user_id || '').trim();
  if (!id || !tokenHash || !userId) return null;
  return {
    id,
    token_hash: tokenHash,
    user_id: userId,
    created_at: String(record.created_at || '').trim() || new Date().toISOString(),
    expires_at: String(record.expires_at || '').trim() || new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
}

function loadAuthData(filePath = DEFAULT_AUTH_STORE_PATH) {
  try {
    if (!fs.existsSync(filePath)) {
      return { users: [], sessions: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: (Array.isArray(parsed.users) ? parsed.users : []).map(normalizeUserRecord).filter(Boolean),
      sessions: (Array.isArray(parsed.sessions) ? parsed.sessions : []).map(normalizeSessionRecord).filter(Boolean)
    };
  } catch {
    return { users: [], sessions: [] };
  }
}

function saveAuthData(data, filePath = DEFAULT_AUTH_STORE_PATH) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    users: Array.isArray(data.users) ? data.users : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : []
  }, null, 2), 'utf8');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function createAuthStore(options = {}) {
  const filePath = options.filePath || DEFAULT_AUTH_STORE_PATH;
  const state = loadAuthData(filePath);
  const revokedTokenHashes = new Set();
  let persistenceAvailable = true;

  function ensureDefaultDemoUsers() {
    let changed = false;

    for (const demoUser of DEFAULT_DEMO_USERS) {
      const loginIdentifier = normalizeLoginIdentifier(demoUser.login_identifier);
      const exists = state.users.some((item) => item.login_identifier === loginIdentifier);
      if (exists) continue;

      const timestamp = new Date().toISOString();
      state.users.push({
        id: generateStableUserId(demoUser.role, loginIdentifier),
        role: demoUser.role,
        display_name: normalizeDisplayName(demoUser.display_name, loginIdentifier),
        login_identifier: loginIdentifier,
        password_hash: createPasswordHash(demoUser.password),
        status: 'active',
        created_at: timestamp,
        updated_at: timestamp
      });
      changed = true;
    }

    if (changed) {
      persist();
    }
  }

  function refreshFromDisk() {
    if (!persistenceAvailable) return;
    const latest = loadAuthData(filePath);
    state.users = latest.users;
    state.sessions = latest.sessions;
    ensureDefaultDemoUsers();
  }

  function persist() {
    if (!persistenceAvailable) return;
    try {
      saveAuthData(state, filePath);
    } catch (error) {
      if (error && ['EROFS', 'EACCES', 'EPERM'].includes(error.code)) {
        persistenceAvailable = false;
        return;
      }
      throw error;
    }
  }

  function removeExpiredSessions() {
    const now = Date.now();
    state.sessions = state.sessions.filter((session) => {
      const expiresAt = Date.parse(session.expires_at);
      return Number.isFinite(expiresAt) && expiresAt > now;
    });
  }

  function findUserByLoginIdentifier(loginIdentifier = '') {
    const normalized = normalizeLoginIdentifier(loginIdentifier);
    return state.users.find((item) => item.login_identifier === normalized) || null;
  }

  function findUserById(userId = '') {
    const id = String(userId || '').trim();
    return state.users.find((item) => item.id === id) || null;
  }

  function listSafeUsers() {
    refreshFromDisk();
    return state.users.map((user) => sanitizeUser(user));
  }

  function registerUser(input = {}) {
    refreshFromDisk();
    const role = normalizeRole(input.role);
    const loginIdentifier = normalizeLoginIdentifier(input.login_identifier);
    const displayName = normalizeDisplayName(input.display_name, loginIdentifier || '未命名使用者');
    const password = String(input.password || '');

    if (!role) {
      throw new Error('role must be patient or doctor');
    }
    if (!loginIdentifier) {
      throw new Error('login_identifier is required');
    }
    if (password.length < 4) {
      throw new Error('password must be at least 4 characters');
    }
    if (findUserByLoginIdentifier(loginIdentifier)) {
      throw new Error('login_identifier already exists');
    }

    const timestamp = new Date().toISOString();
    const record = {
      id: generateStableUserId(role, loginIdentifier),
      role,
      display_name: displayName,
      login_identifier: loginIdentifier,
      password_hash: createPasswordHash(password),
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp
    };
    state.users.push(record);
    persist();
    return sanitizeUser(record);
  }

  function createSessionForUser(userId = '') {
    removeExpiredSessions();
    const user = findUserById(userId);
    if (!user) {
      throw new Error('user not found');
    }
    const session = {
      id: generateId('auth'),
      token_hash: '',
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    };
    const portableToken = createPortableToken(user, session);
    session.token_hash = hashToken(portableToken);
    state.sessions.push(session);
    persist();
    return {
      token: portableToken,
      session
    };
  }

  function login(input = {}) {
    refreshFromDisk();
    removeExpiredSessions();
    const loginIdentifier = normalizeLoginIdentifier(input.login_identifier);
    const password = String(input.password || '');
    const user = findUserByLoginIdentifier(loginIdentifier);
    if (!user) {
      throw createAuthError('account not found', 'account_not_found');
    }
    if (user.status !== 'active') {
      throw createAuthError('account disabled', 'account_disabled');
    }
    if (!verifyPassword(password, user.password_hash)) {
      throw createAuthError('password is incorrect', 'invalid_password');
    }
    const { token, session } = createSessionForUser(user.id);
    return {
      token,
      session,
      user: sanitizeUser(user)
    };
  }

  function getSessionByToken(token = '') {
    refreshFromDisk();
    removeExpiredSessions();
    const tokenHash = hashToken(token);
    if (revokedTokenHashes.has(tokenHash)) return null;
    const session = state.sessions.find((item) => item.token_hash === tokenHash);
    if (!session) return verifyPortableToken(token);
    const user = findUserById(session.user_id);
    if (!user || user.status !== 'active') return null;
    return {
      session,
      user: sanitizeUser(user)
    };
  }

  function revokeSession(token = '') {
    refreshFromDisk();
    const tokenHash = hashToken(token);
    revokedTokenHashes.add(tokenHash);
    const portable = verifyPortableToken(token);
    const before = state.sessions.length;
    state.sessions = state.sessions.filter((item) => {
      if (item.token_hash === tokenHash) return false;
      return !portable?.session?.id || item.id !== portable.session.id;
    });
    if (state.sessions.length !== before) {
      persist();
      return true;
    }
    return false;
  }

  return {
    filePath,
    registerUser,
    login,
    getSessionByToken,
    revokeSession,
    findUserById: (userId) => {
      refreshFromDisk();
      const user = findUserById(userId);
      return user ? sanitizeUser(user) : null;
    },
    listUsers: listSafeUsers,
    _state: state
  };
}

module.exports = {
  DEFAULT_AUTH_STORE_PATH,
  createAuthStore,
  loadAuthData,
  saveAuthData,
  verifyPassword
};
