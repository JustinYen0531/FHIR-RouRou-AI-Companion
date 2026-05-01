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

function testStableUserIdSurvivesRecreatedStore() {
  const firstStore = createAuthStore({ filePath: createTempStorePath() });
  const secondStore = createAuthStore({ filePath: createTempStorePath() });
  const first = firstStore.registerUser({
    role: 'patient',
    display_name: '星澄',
    login_identifier: 'patient_demo_seed',
    password: 'pass1234'
  });
  const second = secondStore.registerUser({
    role: 'patient',
    display_name: '星澄',
    login_identifier: 'PATIENT_DEMO_SEED',
    password: 'pass1234'
  });

  assert.strictEqual(first.id, second.id);
  assert.ok(first.id.startsWith('patient_'));
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

function testLoginSeesUsersRegisteredByAnotherStoreInstance() {
  const filePath = createTempStorePath();
  const loginStore = createAuthStore({ filePath });
  const registerStore = createAuthStore({ filePath });

  const user = registerStore.registerUser({
    role: 'patient',
    display_name: '星澄',
    login_identifier: 'patient_sync_demo',
    password: 'pass1234'
  });

  const login = loginStore.login({
    login_identifier: 'PATIENT_SYNC_DEMO',
    password: 'pass1234'
  });

  assert.ok(login.token);
  assert.strictEqual(login.user.id, user.id);
}

function testPortableTokenRestoresUserAcrossStoreInstances() {
  const issuingStore = createAuthStore({ filePath: createTempStorePath() });
  issuingStore.registerUser({
    role: 'doctor',
    display_name: '王醫師',
    login_identifier: 'doctor_wang',
    password: 'secure123'
  });
  const login = issuingStore.login({
    login_identifier: 'doctor_wang',
    password: 'secure123'
  });

  const verifyingStore = createAuthStore({ filePath: createTempStorePath() });
  const restored = verifyingStore.getSessionByToken(login.token);

  assert.strictEqual(restored.user.role, 'doctor');
  assert.strictEqual(restored.user.login_identifier, 'doctor_wang');
}

function testBuiltInDemoAccountsAreAvailable() {
  const store = createAuthStore({ filePath: createTempStorePath() });
  const patientLogin = store.login({
    login_identifier: 'Justin',
    password: '3553'
  });
  const doctorLogin = store.login({
    login_identifier: 'Dr. Justin',
    password: '3553'
  });

  assert.strictEqual(patientLogin.user.role, 'patient');
  assert.strictEqual(patientLogin.user.display_name, '星澄');
  assert.strictEqual(doctorLogin.user.role, 'doctor');
  assert.strictEqual(doctorLogin.user.display_name, '星澄');
}

function run() {
  testRegisterAndLogin();
  testRejectDuplicateLoginIdentifier();
  testStableUserIdSurvivesRecreatedStore();
  testRevokeSession();
  testFindUserByIdReturnsSafeUser();
  testLoginSeesUsersRegisteredByAnotherStoreInstance();
  testPortableTokenRestoresUserAcrossStoreInstances();
  testBuiltInDemoAccountsAreAvailable();
  console.log('Auth store tests passed.');
}

run();
