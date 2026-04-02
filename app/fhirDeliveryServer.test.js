const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { processExportPayload, processChatPayload } = require('./fhirDeliveryServer');

function getSamplePayload() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'sampleSessionExport.json'), 'utf8')
  );
}

async function testDryRunDelivery() {
  const result = await processExportPayload(getSamplePayload(), {});
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.delivery_status, 'dry_run_ready');
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
  assert.strictEqual(result.body.transaction_response.ok, true);
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
        metadata: { route: 'Natural' },
        session_export: getSamplePayload()
      };
    }
  };

  const result = await processChatPayload(
    {
      message: '最近很累',
      user: 'demo-user',
      api_key: 'groq-secret'
    },
    { engine: fakeEngine }
  );

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.ok, true);
  assert.strictEqual(result.body.conversation_id, 'conv-123');
  assert.strictEqual(result.body.answer, '你好，我有收到你的訊息。');
  assert.ok(result.body.session_export);
}

async function testChatProxyMissingApiKey() {
  const result = await processChatPayload({ message: 'hello', user: 'demo-user' }, {});
  assert.strictEqual(result.statusCode, 500);
  assert.ok(result.body.error.includes('Missing Groq API key'));
}

async function run() {
  await testDryRunDelivery();
  await testBlockedDelivery();
  await testTransactionDelivery();
  await testChatProxyDelivery();
  await testChatProxyMissingApiKey();
  console.log('FHIR delivery server tests passed.');
}

run();
