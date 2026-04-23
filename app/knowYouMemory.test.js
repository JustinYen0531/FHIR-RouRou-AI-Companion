const assert = require('assert');
const KnowYouMemory = require('./knowYouMemory');

function testNormalizeLegacyMemory() {
  const profile = KnowYouMemory.normalizeTherapeuticProfile({
    userId: 'demo',
    longTermMemory: ['最近很累，工作壓力很大。'],
    memoryStats: {
      tokenLimit: 2000,
      estimatedTokens: 1500
    }
  });

  assert.strictEqual(profile.userId, 'demo');
  assert.strictEqual(profile.memoryChunks.length, 1);
  assert.strictEqual(profile.memoryChunks[0].summary.includes('最近很累'), true);
  assert.strictEqual(profile.memoryStats.tokenLimit, 2000);
}

function testBuildMeterFlagsCompression() {
  const profile = KnowYouMemory.normalizeTherapeuticProfile({
    userId: 'demo',
    stressors: [{ label: '工作壓力' }],
    memoryChunks: [{ title: '舊記憶', summary: '一段很長很長的舊記憶'.repeat(20) }]
  });

  const meter = KnowYouMemory.buildMemoryMeterState({
    profile,
    history: [
      { role: 'user', content: '最近真的很累，覺得一直被工作追著跑。' },
      { role: 'assistant', content: '我有聽見你的疲憊，先慢慢來。' }
    ],
    pendingMessage: '而且睡不好。'
  });

  assert.ok(meter.estimatedTokens > 0);
  assert.ok(typeof meter.percent === 'number');
  assert.strictEqual(typeof meter.shouldCompress, 'boolean');
}

function testMergeMemoryChunkKeepsLimit() {
  let profile = KnowYouMemory.normalizeTherapeuticProfile({
    userId: 'demo',
    memoryChunks: []
  });

  for (let index = 0; index < 12; index += 1) {
    profile = KnowYouMemory.mergeMemoryChunk(profile, {
      title: `chunk-${index + 1}`,
      category: 'context',
      summary: `summary-${index + 1}`,
      tokenEstimate: 120
    });
  }

  assert.ok(profile.memoryChunks.length <= KnowYouMemory.DEFAULT_MEMORY_CHUNK_LIMIT);
  assert.strictEqual(profile.memoryStats.memoryChunksCount, profile.memoryChunks.length);
}

function run() {
  testNormalizeLegacyMemory();
  testBuildMeterFlagsCompression();
  testMergeMemoryChunkKeepsLimit();
  console.log('Know You memory tests passed.');
}

run();
