const assert = require('assert');
const {
  createCardRegistry,
  chooseIntervention
} = require('./microInterventionRules');

function makeContext(overrides = {}) {
  return Object.assign({
    metadata: {
      route: 'Natural',
      risk_flag: 'false',
      burden_level_state: {
        burden_level: 'high',
        response_style: 'option_first',
        followup_budget: '0'
      },
      latest_tag_payload: {
        sentiment_tags: ['tired'],
        warning_tags: [],
        summary: '我現在真的好累，不想動'
      }
    },
    session_export: {},
    history: [{ role: 'user', content: '我現在真的好累，不想動' }],
    currentScreen: 'screen-chat',
    dismissCount: 0,
    lastPresentedCardId: '',
    cardHistory: [],
    cooldownUntil: 0,
    snoozedUntil: 0,
    now: Date.now(),
    lastUserMessage: '我現在真的好累，不想動'
  }, overrides);
}

async function testLowEnergyGetsMinimalCard() {
  const decision = chooseIntervention(makeContext(), { registry: createCardRegistry() });
  assert.strictEqual(decision.suppressed, false);
  assert.strictEqual(decision.card.id, 'drink_water');
}

async function testSafetySuppressesCard() {
  const decision = chooseIntervention(makeContext({
    metadata: {
      route: 'safety',
      risk_flag: 'true',
      burden_level_state: {},
      latest_tag_payload: { warning_tags: ['self_harm_risk'], sentiment_tags: [], summary: '我想死' }
    }
  }), { registry: createCardRegistry() });
  assert.strictEqual(decision.suppressed, true);
  assert.ok(['risk_flag', 'safety_route', 'warning_tag'].includes(decision.reason));
}

async function testRecentDuplicateSuppressesCard() {
  const now = Date.now();
  const decision = chooseIntervention(makeContext({
    lastPresentedCardId: 'drink_water',
    cardHistory: [{ id: 'drink_water', shownAt: now - 1000 }],
    now
  }), { registry: createCardRegistry() });
  assert.strictEqual(decision.suppressed, false);
  assert.notStrictEqual(decision.card.id, 'drink_water');
}

async function run() {
  await testLowEnergyGetsMinimalCard();
  await testSafetySuppressesCard();
  await testRecentDuplicateSuppressesCard();
  console.log('Micro intervention rules tests passed.');
}

run();
