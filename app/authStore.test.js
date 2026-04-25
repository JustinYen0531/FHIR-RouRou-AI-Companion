const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAuthStore } = require('./authStore');

function createTempStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rourou-auth-'));
  return path.join(dir, 'auth.json');
}

function testRegisterAndLogin() {
  const store = createAuthStore({ filePath: createTempStorePath() });
  const user = store.registerUser({
    role: 'patient',
    display_name: '林小明',
    login_identifier: 'patient_lin',
    password: 'pass1234'
  });

  assert.strictEqual(user.role, 'patient');
  assert.strictEqual(user.display_name, '林小明');
  assert.strictEqual(user.login_identifier, 'patient_lin');

  const login = store.login({
    login_identifier: 'patient_lin',
    password: 'pass1234'
  });

  assert.ok(login.token);
  assert.strictEqual(login.user.id, user.id);
  const resolved = store.getSessionByToken(login.token);
  assert.strictEqual(resolved.user.id, user.id);
}

function testRejectDuplicateLoginIdentifier() {
  const store = createAuthStore({ filePath: createTempStorePath() });
  store.registerUser({
    role: 'doctor',
    display_name: '王醫師',
    login_identifier: 'doctor_wang',
    password: 'secure123'
  });

  assert.throws(() => {
    store.registerUser({
      role: 'doctor',
      display_name: '王醫師 2',
      login_identifier: 'doctor_wang',
      password: 'secure456'
    });
  }, /already exists/);
}

function testRevokeSession() {
  const store = createAuthStore({ filePath: createTempStorePath() });
  store.registerUser({
    role: 'patient',
    display_name: '陳小華',
    login_identifier: 'patient_chen',
    password: 'abcd1234'
  });
  const login = store.login({
    login_identifier: 'patient_chen',
    password: 'abcd1234'
  });

  assert.strictEqual(Boolean(store.getSessionByToken(login.token)), true);
  assert.strictEqual(store.revokeSession(login.token), true);
  assert.strictEqual(store.getSessionByToken(login.token), null);
}

function testFindUserByIdReturnsSafeUser() {
  const store = createAuthStore({ filePath: createTempStorePath() });
  const user = store.registerUser({
    role: 'patient',
    display_name: '黃小安',
    login_identifier: 'patient_huang',
    password: 'abcd1234'
  });

  const found = store.findUserById(user.id);
  assert.strictEqual(found.id, user.id);
  assert.strictEqual(found.role, 'patient');
  assert.strictEqual(found.display_name, '黃小安');
  assert.strictEqual(found.password_hash, undefined);
}

function run() {
  testRegisterAndLogin();
  testRejectDuplicateLoginIdentifier();
  testRevokeSession();
  testFindUserByIdReturnsSafeUser();
  console.log('Auth store tests passed.');
}

run();
