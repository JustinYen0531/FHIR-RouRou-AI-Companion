const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { createAuthStore } = require('./authStore');
const { processExportPayload, processResourceRefreshPayload, processDeliveryCheckPayload, processChatPayload, processOutputPayload, createServer } = require('./fhirDeliveryServer');

function getSamplePayload() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'sampleSessionExport.json'), 'utf8')
  );
}

function createTempAuthStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rourou-auth-server-'));
  return createAuthStore({ filePath: path.join(dir, 'auth.json') });
}

function createTempAssignmentStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rourou-assignments-server-'));
  return path.join(dir, 'assignments.json');
}

function requestJson(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}${pathname}`, {
      method: options.method || 'GET',
      headers: Object.assign({}, options.headers || {})
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: raw ? JSON.parse(raw) : {}
        });
      });
    });
    req.on('error', reject);
    if (options.body !== undefined) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function testDryRunDelivery() {
  const result = await processExportPayload(getSamplePayload(), {});
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'dry_run_ready');
  assert.strictEqual(result.body.fhir_base_url, '');
  assert.ok(result.body.bundle_result.bundle_json);
}

async function testBlockedDelivery() {
  const payload = getSamplePayload();
  payload.patient_authorization_state.share_with_clinician = 'no';
  const result = await processExportPayload(payload, {});
  assert.strictEqual(result.statusCode, 422);
  assert.strictEqual(result.body.delivery_status, 'blocked');
}

async function testQuickCheckReady() {
  const result = await processDeliveryCheckPayload(getSamplePayload(), {});
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.ok, true);
  assert.strictEqual(result.body.quick_check.can_deliver, true);
  assert.strictEqual(result.body.quick_check.mode, 'dry_run');
}

async function testQuickCheckBlocked() {
  const payload = getSamplePayload();
  payload.patient_authorization_state.share_with_clinician = 'no';
  const result = await processDeliveryCheckPayload(payload, {});
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.ok, true);
  assert.strictEqual(result.body.quick_check.can_deliver, false);
  assert.ok(Array.isArray(result.body.quick_check.reasons));
  assert.ok(result.body.quick_check.reasons.some((reason) => String(reason).includes('does not allow clinician sharing')));
}

async function testTransactionDelivery() {
  const payload = getSamplePayload();
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ resourceType: 'Bundle', type: 'transaction-response' })
  });

  const result = await processExportPayload(payload, {
    fhirBaseUrl: 'https://example.org/fhir',
    fetchImpl: fakeFetch
  });

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'delivered');
  assert.strictEqual(result.body.fhir_base_url, 'https://example.org/fhir');
  assert.strictEqual(result.body.transaction_response.ok, true);
}

async function testTransactionDeliveryReturnsResourceLinks() {
  const payload = getSamplePayload();
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [
        { response: { location: 'Patient/123/_history/1' } },
        { response: { location: 'Encounter/234/_history/1' } },
        { response: { location: 'Composition/345/_history/1' } },
        { response: { location: 'Provenance/456/_history/1' } }
      ]
    })
  });

  const result = await processExportPayload(payload, {
    fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
    fetchImpl: fakeFetch
  });

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'delivered');
  assert.deepStrictEqual(
    result.body.fhir_resource_links.map((item) => item.label),
    ['Patient/123', 'Encounter/234', 'Composition/345', 'Provenance/456']
  );
  assert.strictEqual(result.body.fhir_resource_links[0].url, 'https://hapi.fhir.org/baseR4/Patient/123');
  assert.strictEqual(result.body.created_resources.Patient, 'Patient/123');
  assert.strictEqual(result.body.created_resources.Composition, 'Composition/345');
}

async function testPublicHapiDeliveryUsesUniqueKeys() {
  const payload = getSamplePayload();
  const originalPatientKey = payload.patient.key;
  const originalEncounterKey = payload.session.encounterKey;
  let submittedBundle = null;
  const fakeFetch = async (url, options) => {
    submittedBundle = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ resourceType: 'Bundle', type: 'transaction-response' })
    };
  };

  const result = await processExportPayload(payload, {
    fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
    fetchImpl: fakeFetch
  });

  const patientEntry = submittedBundle.entry.find((entry) => entry.resource.resourceType === 'Patient');
  const encounterEntry = submittedBundle.entry.find((entry) => entry.resource.resourceType === 'Encounter');
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'delivered');
  assert.ok(patientEntry.resource.identifier[0].value.startsWith(originalPatientKey + '-'));
  assert.ok(encounterEntry.resource.identifier[0].value.startsWith(originalEncounterKey + '-'));
}

async function testSharedDeviceUsesIdempotentPutRequest() {
  const payload = getSamplePayload();
  let submittedBundle = null;
  const fakeFetch = async (_url, options) => {
    submittedBundle = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ resourceType: 'Bundle', type: 'transaction-response' })
    };
  };

  const result = await processExportPayload(payload, {
    fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
    fetchImpl: fakeFetch
  });

  const deviceEntry = submittedBundle.entry.find((entry) => entry.resource.resourceType === 'Device');
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(deviceEntry, undefined);
}

async function testPublicHapiDeliveryFallsBackToSmartWhenHapiFails() {
  const payload = getSamplePayload();
  const attemptedUrls = [];
  const fakeFetch = async (url) => {
    attemptedUrls.push(url);
    if (url === 'https://hapi.fhir.org/baseR4') {
      return {
        ok: false,
        status: 500,
        text: async () => JSON.stringify({
          resourceType: 'OperationOutcome',
          issue: [{ diagnostics: 'Timer already cancelled.' }]
        })
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        resourceType: 'Bundle',
        type: 'transaction-response',
        entry: [
          { response: { location: 'Patient/123/_history/1' } }
        ]
      })
    };
  };

  const result = await processExportPayload(payload, {
    fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
    fetchImpl: fakeFetch
  });

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'delivered');
  assert.strictEqual(result.body.fhir_base_url, 'https://r4.smarthealthit.org');
  assert.strictEqual(result.body.transaction_response.fallback_used, true);
  assert.strictEqual(result.body.transaction_response.primary_response.status, 500);
  assert.deepStrictEqual(attemptedUrls, ['https://hapi.fhir.org/baseR4', 'https://r4.smarthealthit.org']);
}

async function testTransactionDeliveryRetriesTransientFetchFailure() {
  const payload = getSamplePayload();
  let attempts = 0;
  const fakeFetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('fetch failed');
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        resourceType: 'Bundle',
        type: 'transaction-response',
        entry: [
          { response: { location: 'Patient/123/_history/1' } }
        ]
      })
    };
  };

  const result = await processExportPayload(payload, {
    fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
    fetchImpl: fakeFetch
  });

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'delivered');
  assert.strictEqual(result.body.transaction_response.ok, true);
  assert.strictEqual(result.body.transaction_response.attempts, 2);
}

async function testFallbackDeliveryRetriesTransientFetchFailure() {
  const payload = getSamplePayload();
  const attemptsByUrl = new Map();
  const fakeFetch = async (url) => {
    attemptsByUrl.set(url, (attemptsByUrl.get(url) || 0) + 1);
    if (url === 'https://hapi.fhir.org/baseR4') {
      return {
        ok: false,
        status: 503,
        text: async () => JSON.stringify({
          resourceType: 'OperationOutcome',
          issue: [{ diagnostics: 'Public demo server is busy.' }]
        })
      };
    }
    if (attemptsByUrl.get(url) === 1) {
      throw new Error('fetch failed');
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        resourceType: 'Bundle',
        type: 'transaction-response',
        entry: [
          { response: { location: 'Patient/456/_history/1' } }
        ]
      })
    };
  };

  const result = await processExportPayload(payload, {
    fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
    fetchImpl: fakeFetch
  });

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'delivered');
  assert.strictEqual(result.body.fhir_base_url, 'https://r4.smarthealthit.org');
  assert.strictEqual(result.body.transaction_response.fallback_used, true);
  assert.strictEqual(result.body.transaction_response.attempts, 2);
}

async function testPatientRefreshDelivery() {
  const payload = getSamplePayload();
  let requestUrl = '';
  let requestOptions = null;
  const fakeFetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ resourceType: 'Patient', id: '131946130' })
    };
  };

  const result = await processResourceRefreshPayload({
    resource_type: 'Patient',
    resource_path: 'Patient/131946130',
    session_export: payload
  }, {
    fhirBaseUrl: 'https://example.org/fhir',
    fetchImpl: fakeFetch
  });

  const submittedPatient = JSON.parse(requestOptions.body);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.refresh_status, 'refreshed');
  assert.strictEqual(result.body.build_result.valid, true);
  assert.strictEqual(result.body.build_result.resource_json.resourceType, 'Patient');
  assert.strictEqual(result.body.resource_result.ok, true);
  assert.strictEqual(result.body.resource_result.submitted_resource.resourceType, 'Patient');
  assert.strictEqual(requestUrl, 'https://example.org/fhir/Patient/131946130');
  assert.strictEqual(requestOptions.method, 'PUT');
  assert.strictEqual(submittedPatient.resourceType, 'Patient');
  assert.strictEqual(submittedPatient.id, '131946130');
  assert.strictEqual(submittedPatient.identifier[0].value, payload.patient.key);
}

async function testPatientRefreshRejectsInvalidPath() {
  const payload = getSamplePayload();
  const result = await processResourceRefreshPayload({
    resource_type: 'Patient',
    resource_path: 'Encounter/131946131',
    session_export: payload
  }, {
    fhirBaseUrl: 'https://example.org/fhir'
  });

  assert.strictEqual(result.statusCode, 422);
  assert.strictEqual(result.body.refresh_status, 'blocked');
  assert.ok(result.body.validation_errors.some((message) => message.includes('existing Patient')));
}

async function testPatientRefreshRejectsInvalidBuild() {
  const payload = getSamplePayload();
  payload.patient.key = '';
  const result = await processResourceRefreshPayload({
    resource_type: 'Patient',
    resource_path: 'Patient/131946130',
    session_export: payload
  }, {
    fhirBaseUrl: 'https://example.org/fhir'
  });

  assert.strictEqual(result.statusCode, 422);
  assert.strictEqual(result.body.refresh_status, 'blocked');
  assert.strictEqual(result.body.build_result.valid, false);
  assert.ok(result.body.build_result.validation_errors.some((message) => message.includes('patient.key')));
}

async function testChatProxyDelivery() {
  const fakeEngine = {
    handleMessage: async (payload) => {
      assert.strictEqual(payload.message, '最近很累');
      assert.strictEqual(payload.user, 'demo-user');
      return {
        conversation_id: 'conv-123',
        answer: '你好，我有收到你的訊息。',
        message_id: 'msg-123',
        metadata: {
          route: 'Natural',
          active_mode: 'mode_5_natural',
          risk_flag: 'false',
          latest_tag_payload: { sentiment_tags: ['tired'] },
          burden_level_state: { burden_level: 'high', response_style: 'option_first' }
        },
        session_export: getSamplePayload()
      };
    }
  };

  const result = await processChatPayload(
    {
      message: '最近很累',
      user: 'demo-user'
    },
    { engine: fakeEngine }
  );

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.ok, true);
  assert.strictEqual(result.body.conversation_id, 'conv-123');
  assert.strictEqual(result.body.answer, '你好，我有收到你的訊息。');
  assert.strictEqual(result.body.metadata.risk_flag, 'false');
  assert.strictEqual(result.body.metadata.burden_level_state.burden_level, 'high');
  assert.ok(result.body.session_export);
}

async function testChatProxyPassesForceNewSessionFlag() {
  const fakeEngine = {
    handleMessage: async (payload) => {
      assert.strictEqual(payload.force_new_session, true);
      return {
        conversation_id: 'conv-new',
        answer: '新的對話已建立。',
        message_id: 'msg-new',
        metadata: {
          route: 'Natural',
          active_mode: 'mode_5_natural',
          risk_flag: 'false',
          latest_tag_payload: {},
          burden_level_state: {}
        },
        session_export: getSamplePayload()
      };
    }
  };

  const result = await processChatPayload(
    {
      message: '重新開始',
      user: 'demo-user',
      force_new_session: true
    },
    { engine: fakeEngine }
  );

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.conversation_id, 'conv-new');
}

async function testChatProxyMissingApiKey() {
  const result = await processChatPayload({ message: 'hello', user: 'demo-user' }, {});
  assert.strictEqual(result.statusCode, 500);
  assert.ok(result.body.error.includes('Missing'));
  assert.ok(result.body.error.includes('API key'));
}

async function testOutputProxyDelivery() {
  const fakeEngine = {
    generateOutput: async (payload) => {
      assert.strictEqual(payload.output_type, 'clinician_summary');
      return {
        conversation_id: 'conv-456',
        output_type: 'clinician_summary',
        output: { summary_version: 'v1' },
        formatted_text: '醫師摘要\n\n{"summary_version":"v1"}',
        session_export: getSamplePayload(),
        metadata: { output_type: 'clinician_summary' }
      };
    }
  };

  const result = await processOutputPayload(
    {
      user: 'demo-user',
      output_type: 'clinician_summary'
    },
    { engine: fakeEngine }
  );

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.ok, true);
  assert.strictEqual(result.body.output_type, 'clinician_summary');
  assert.ok(result.body.output);
}

async function testSessionListEndpoint() {
  const sessions = new Map();
  sessions.set('conv-a', {
    id: 'conv-a',
    user: 'demo-user',
    startedAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:05:00.000Z',
    history: [
      { role: 'user', content: '最近很累' },
      { role: 'assistant', content: '我有聽到。' }
    ],
    state: {
      active_mode: 'mode_5_natural',
      risk_flag: 'false',
      clinician_summary_draft: { draft_summary: 'stub' },
      fhir_delivery_draft: { delivery_status: 'ready_for_mapping' }
    },
    revision: 1,
    memory_snapshot: {
      note_history: ['最近很累'],
      last_user_message: '最近很累',
      last_assistant_message: '我有聽到。',
      active_mode: 'mode_5_natural',
      risk_flag: 'false',
      latest_tag_summary: '最近很累',
      hamd_focus: 'depressed_mood'
    },
    output_cache: {}
  });

  const server = createServer({ sessions });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const payload = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/api/chat/sessions?user=demo-user&limit=5`, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve(JSON.parse(raw)));
    }).on('error', reject);
  });

  server.close();
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.sessions.length, 1);
  assert.strictEqual(payload.sessions[0].id, 'conv-a');
  assert.strictEqual(payload.sessions[0].has_fhir_draft, true);
}

async function testSessionDetailEndpoint() {
  const sessions = new Map();
  sessions.set('conv-a', {
    id: 'conv-a',
    user: 'demo-user',
    startedAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:05:00.000Z',
    history: [
      { role: 'user', content: '最近很累' },
      { role: 'assistant', content: '我有聽到。' }
    ],
    state: {
      active_mode: 'mode_5_natural',
      risk_flag: 'false',
      clinician_summary_draft: { draft_summary: 'stub' }
    },
    revision: 1,
    memory_snapshot: {
      note_history: ['最近很累'],
      last_user_message: '最近很累',
      last_assistant_message: '我有聽到。',
      active_mode: 'mode_5_natural',
      risk_flag: 'false',
      latest_tag_summary: '最近很累',
      hamd_focus: 'depressed_mood'
    },
    output_cache: {}
  });

  const server = createServer({ sessions });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const payload = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/api/chat/session?id=conv-a`, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve(JSON.parse(raw)));
    }).on('error', reject);
  });

  server.close();
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.session.id, 'conv-a');
  assert.strictEqual(payload.session.history.length, 2);
  assert.strictEqual(payload.session.state.active_mode, 'mode_5_natural');
}

async function testSessionDeleteEndpoint() {
  const sessions = new Map();
  sessions.set('conv-a', {
    id: 'conv-a',
    user: 'demo-user',
    startedAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:05:00.000Z',
    history: [{ role: 'user', content: '最近很累' }],
    state: {},
    revision: 1,
    memory_snapshot: {},
    output_cache: {}
  });

  const server = createServer({ sessions });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const payload = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/api/chat/session?id=conv-a`, { method: 'DELETE' }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.end();
  });

  server.close();
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.deleted, true);
  assert.strictEqual(sessions.has('conv-a'), false);
}

async function testSessionPatchEndpoint() {
  const sessions = new Map();
  sessions.set('conv-a', {
    id: 'conv-a',
    user: 'demo-user',
    startedAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:05:00.000Z',
    history: [{ role: 'user', content: '最近很累' }],
    state: {},
    revision: 1,
    memory_snapshot: {},
    output_cache: {}
  });

  const server = createServer({ sessions });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const payload = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/api/chat/session?id=conv-a`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({
      therapeutic_profile: {
        version: '1.0',
        userId: 'demo-user',
        stressors: [{ label: '工作壓力' }]
      },
      patient_profile: {
        profileKey: 'pt-lin-xiao',
        name: '林小明',
        gender: 'male',
        birthDate: '1994-02-03',
        phone: '0912345678'
      }
    }));
    req.end();
  });

  server.close();
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.updated, true);
  assert.deepStrictEqual(sessions.get('conv-a').state.therapeutic_profile.stressors, [{ label: '工作壓力' }]);
  assert.strictEqual(sessions.get('conv-a').state.patient_profile.name, '林小明');
  assert.strictEqual(sessions.get('conv-a').state.patient_profile.profileKey, 'pt-lin-xiao');
}

async function testSessionPatchCreatesMissingSession() {
  const sessions = new Map();
  const server = createServer({ sessions });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const patch = await requestJson(port, '/api/chat/session?id=conv-local-backup', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: {
      user: 'demo-user',
      startedAt: '2026-04-04T00:00:00.000Z',
      history: [
        { role: 'user', content: '我想打開之前的對話', id: 'msg-old-user-1', recalled: true, recalledAt: '2026-04-04T00:01:00.000Z', recalled_placeholder: '此訊息已收回' },
        { role: 'assistant', content: '我在，這段可以繼續。' }
      ],
      state: {
        active_mode: 'mode_5_natural',
        risk_flag: 'false'
      },
      memory_snapshot: {
        last_user_message: '我想打開之前的對話',
        last_assistant_message: '我在，這段可以繼續。'
      },
      revision: 2,
      clear_output_cache: true
    }
  });

  const detail = await requestJson(port, '/api/chat/session?id=conv-local-backup');

  server.close();
  assert.strictEqual(patch.statusCode, 200);
  assert.strictEqual(patch.body.ok, true);
  assert.strictEqual(detail.statusCode, 200);
  assert.strictEqual(detail.body.session.id, 'conv-local-backup');
  assert.strictEqual(detail.body.session.history.length, 2);
  assert.strictEqual(detail.body.session.history[0].recalled, true);
  assert.strictEqual(detail.body.session.history[0].id, 'msg-old-user-1');
  assert.strictEqual(detail.body.session.state.active_mode, 'mode_5_natural');
  assert.strictEqual(detail.body.session.revision, 2);
}

async function testQuickCheckEndpoint() {
  const server = createServer({});
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const payload = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/api/fhir/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(getSamplePayload()));
    req.end();
  });

  server.close();
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(typeof payload.quick_check.can_deliver, 'boolean');
}

async function testPatientRefreshEndpoint() {
  const server = createServer({
    fhirBaseUrl: 'https://example.org/fhir',
    fetchImpl: async (url, options) => {
      assert.strictEqual(url, 'https://example.org/fhir/Patient/131946130');
      assert.strictEqual(options.method, 'PUT');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ resourceType: 'Patient', id: '131946130' })
      };
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const payload = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/api/fhir/resource-refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({
      resource_type: 'Patient',
      resource_path: 'Patient/131946130',
      session_export: getSamplePayload()
    }));
    req.end();
  });

  server.close();
  assert.strictEqual(payload.refresh_status, 'refreshed');
  assert.strictEqual(payload.resource_result.ok, true);
}

async function testAuthRegisterAndMeEndpoint() {
  const authStore = createTempAuthStore();
  const server = createServer({ authStore });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const register = await requestJson(port, '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      role: 'patient',
      display_name: '林小明',
      login_identifier: 'patient_lin',
      password: 'pass1234'
    }
  });

  assert.strictEqual(register.statusCode, 201);
  assert.ok(register.body.token);
  assert.strictEqual(register.body.user.role, 'patient');

  const me = await requestJson(port, '/auth/me', {
    headers: {
      Authorization: `Bearer ${register.body.token}`
    }
  });

  server.close();
  assert.strictEqual(me.statusCode, 200);
  assert.strictEqual(me.body.user.login_identifier, 'patient_lin');
}

async function testAuthLoginCreatesUnknownAccount() {
  const authStore = createTempAuthStore();
  const server = createServer({ authStore });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const login = await requestJson(port, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      role: 'doctor',
      display_name: 'New Demo Doctor',
      login_identifier: 'doctor_new_demo',
      password: '1234'
    }
  });

  server.close();
  assert.strictEqual(login.statusCode, 201);
  assert.strictEqual(login.body.created, true);
  assert.ok(login.body.token);
  assert.strictEqual(login.body.user.login_identifier, 'doctor_new_demo');
}

async function testDoctorCanAddPatientIdWithoutSharedUserCache() {
  const authStore = createTempAuthStore();
  const server = createServer({ authStore });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const doctorLogin = await requestJson(port, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      role: 'doctor',
      display_name: '王醫師',
      login_identifier: 'doctor_wang',
      password: 'secure123'
    }
  });
  const lookup = await requestJson(port, '/api/auth/users?id=patient_500145aa3ab7', {
    headers: { Authorization: `Bearer ${doctorLogin.body.token}` }
  });

  server.close();
  assert.strictEqual(lookup.statusCode, 200);
  assert.strictEqual(lookup.body.user.role, 'patient');
  assert.strictEqual(lookup.body.user.id, 'patient_500145aa3ab7');
}

async function testDoctorAssignmentVisibleToPatient() {
  const authStore = createTempAuthStore();
  const server = createServer({ authStore, assignmentStorePath: createTempAssignmentStorePath() });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const patientLogin = await requestJson(port, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      role: 'patient',
      display_name: 'Demo Patient',
      login_identifier: 'patient_assignment_demo',
      password: 'pass1234'
    }
  });
  const doctorLogin = await requestJson(port, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      role: 'doctor',
      display_name: '王醫師',
      login_identifier: 'doctor_wang',
      password: 'secure123'
    }
  });
  const patientId = patientLogin.body.user.id;

  const patch = await requestJson(port, `/api/assignments?patient_id=${encodeURIComponent(patientId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorLogin.body.token}`
    },
    body: {
      patientId,
      patientName: 'Justin',
      medicalRecordStatus: '已送入',
      orderDraft: {
        content: '回診前請補充最近一週睡眠狀況。',
        status: '已送出'
      }
    }
  });
  const get = await requestJson(port, `/api/assignments?patient_id=${encodeURIComponent(patientId)}`, {
    headers: { Authorization: `Bearer ${patientLogin.body.token}` }
  });

  server.close();
  assert.strictEqual(patch.statusCode, 200);
  assert.strictEqual(get.statusCode, 200);
  assert.strictEqual(get.body.assignment.medicalRecordStatus, '已送入');
  assert.strictEqual(get.body.assignment.orderDraft.content, '回診前請補充最近一週睡眠狀況。');
}

async function testAuthProtectsForeignSession() {
  const authStore = createTempAuthStore();
  const user = authStore.registerUser({
    role: 'patient',
    display_name: '林小明',
    login_identifier: 'patient_lin',
    password: 'pass1234'
  });
  const login = authStore.login({
    login_identifier: 'patient_lin',
    password: 'pass1234'
  });

  const sessions = new Map();
  sessions.set('conv-foreign', {
    id: 'conv-foreign',
    user: 'another-user',
    startedAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:05:00.000Z',
    history: [{ role: 'user', content: '最近很累' }],
    state: {},
    revision: 1,
    memory_snapshot: {},
    output_cache: {}
  });
  sessions.set('conv-own', {
    id: 'conv-own',
    user: user.id,
    startedAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:05:00.000Z',
    history: [{ role: 'user', content: '這是我的對話' }],
    state: {},
    revision: 1,
    memory_snapshot: {},
    output_cache: {}
  });

  const server = createServer({ sessions, authStore });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const foreign = await requestJson(port, '/api/chat/session?id=conv-foreign', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const own = await requestJson(port, `/api/chat/session?id=conv-own`, {
    headers: { Authorization: `Bearer ${login.token}` }
  });

  server.close();
  assert.strictEqual(foreign.statusCode, 403);
  assert.strictEqual(own.statusCode, 200);
  assert.strictEqual(own.body.session.id, 'conv-own');
}

async function run() {
  await testDryRunDelivery();
  await testBlockedDelivery();
  await testQuickCheckReady();
  await testQuickCheckBlocked();
  await testTransactionDelivery();
  await testTransactionDeliveryReturnsResourceLinks();
  await testPublicHapiDeliveryUsesUniqueKeys();
  await testSharedDeviceUsesIdempotentPutRequest();
  await testPublicHapiDeliveryFallsBackToSmartWhenHapiFails();
  await testTransactionDeliveryRetriesTransientFetchFailure();
  await testFallbackDeliveryRetriesTransientFetchFailure();
  await testPatientRefreshDelivery();
  await testPatientRefreshRejectsInvalidPath();
  await testPatientRefreshRejectsInvalidBuild();
  await testChatProxyDelivery();
  await testChatProxyPassesForceNewSessionFlag();
  await testChatProxyMissingApiKey();
  await testOutputProxyDelivery();
  await testSessionListEndpoint();
  await testSessionDetailEndpoint();
  await testSessionDeleteEndpoint();
  await testSessionPatchEndpoint();
  await testSessionPatchCreatesMissingSession();
  await testQuickCheckEndpoint();
  await testPatientRefreshEndpoint();
  await testAuthRegisterAndMeEndpoint();
  await testAuthLoginCreatesUnknownAccount();
  await testDoctorCanAddPatientIdWithoutSharedUserCache();
  await testDoctorAssignmentVisibleToPatient();
  await testAuthProtectsForeignSession();
  console.log('FHIR delivery server tests passed.');
}

run();
