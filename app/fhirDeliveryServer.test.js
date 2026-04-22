const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { processExportPayload, processResourceRefreshPayload, processDeliveryCheckPayload, processChatPayload, processOutputPayload, createServer } = require('./fhirDeliveryServer');

function getSamplePayload() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'sampleSessionExport.json'), 'utf8')
  );
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
      }
    }));
    req.end();
  });

  server.close();
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.updated, true);
  assert.deepStrictEqual(sessions.get('conv-a').state.therapeutic_profile.stressors, [{ label: '工作壓力' }]);
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

async function run() {
  await testDryRunDelivery();
  await testBlockedDelivery();
  await testQuickCheckReady();
  await testQuickCheckBlocked();
  await testTransactionDelivery();
  await testPublicHapiDeliveryUsesUniqueKeys();
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
  await testQuickCheckEndpoint();
  await testPatientRefreshEndpoint();
  console.log('FHIR delivery server tests passed.');
}

run();
