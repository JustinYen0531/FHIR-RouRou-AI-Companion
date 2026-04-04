const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { processExportPayload, processChatPayload, processOutputPayload, createServer } = require('./fhirDeliveryServer');

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

async function run() {
  await testDryRunDelivery();
  await testBlockedDelivery();
  await testTransactionDelivery();
  await testPublicHapiDeliveryUsesUniqueKeys();
  await testChatProxyDelivery();
  await testChatProxyMissingApiKey();
  await testOutputProxyDelivery();
  await testSessionListEndpoint();
  console.log('FHIR delivery server tests passed.');
}

run();
