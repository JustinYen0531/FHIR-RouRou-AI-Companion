(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KnowYouMemory = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_CONTEXT_TOKEN_LIMIT = 3200;
  const DEFAULT_CONTEXT_COMPRESSION_RATIO = 0.8;
  const DEFAULT_RECENT_HISTORY_ITEMS = 12;
  const DEFAULT_MEMORY_CHUNK_LIMIT = 8;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toText(value) {
    return String(value == null ? '' : value).trim();
  }

  function estimateTokenCount(text = '') {
    const normalized = toText(text);
    if (!normalized) return 0;

    const cjkChars = normalized.match(/[\u3400-\u9fff]/g) || [];
    const latinWords = normalized
      .replace(/[\u3400-\u9fff]/g, ' ')
      .match(/[A-Za-z0-9_]+(?:'[A-Za-z0-9_]+)?/g) || [];
    const punctuation = normalized.match(/[.,!?;:，。！？、；：]/g) || [];

    const estimate = (cjkChars.length * 1.2) + (latinWords.length * 1.35) + (punctuation.length * 0.18);
    return Math.max(1, Math.ceil(estimate));
  }

  function estimateHistoryTokens(history = []) {
    return (Array.isArray(history) ? history : []).reduce((total, item) => {
      if (!item || !item.content) return total;
      const roleCost = item.role === 'assistant' ? 4 : 3;
      return total + roleCost + estimateTokenCount(item.content);
    }, 0);
  }

  function normalizeMemoryChunk(chunk = {}) {
    const source = chunk && typeof chunk === 'object' ? chunk : {};
    const summary = toText(source.summary || source.detail || source.text || source.note);
    if (!summary) return null;
    const createdAt = toText(source.createdAt || source.created_at) || new Date().toISOString();
    const tokenEstimate = Number.isFinite(Number(source.tokenEstimate))
      ? Math.max(0, Number(source.tokenEstimate))
      : estimateTokenCount(summary);

    return {
      id: toText(source.id) || `memory-${createdAt.replace(/[^0-9a-z]/gi, '').slice(0, 20) || Date.now().toString(36)}`,
      title: toText(source.title || source.label || source.category || '壓縮記憶').slice(0, 48),
      category: toText(source.category || 'context').slice(0, 32),
      summary: summary.slice(0, 500),
      detail: toText(source.detail || ''),
      sourceRange: source.sourceRange && typeof source.sourceRange === 'object'
        ? {
            start: Number.isFinite(Number(source.sourceRange.start)) ? Number(source.sourceRange.start) : null,
            end: Number.isFinite(Number(source.sourceRange.end)) ? Number(source.sourceRange.end) : null
          }
        : null,
      tokenEstimate,
      createdAt
    };
  }

  function normalizeMemoryStats(stats = {}) {
    const source = stats && typeof stats === 'object' ? stats : {};
    const tokenLimit = Number.isFinite(Number(source.tokenLimit))
      ? Math.max(1, Number(source.tokenLimit))
      : DEFAULT_CONTEXT_TOKEN_LIMIT;
    const estimatedTokens = Number.isFinite(Number(source.estimatedTokens))
      ? Math.max(0, Number(source.estimatedTokens))
      : 0;
    const compressionProgress = Number.isFinite(Number(source.compressionProgress))
      ? clamp(Number(source.compressionProgress), 0, 1)
      : clamp(tokenLimit ? estimatedTokens / tokenLimit : 0, 0, 1);

    return {
      tokenLimit,
      estimatedTokens,
      compressionProgress,
      shouldCompress: Boolean(source.shouldCompress) || compressionProgress >= DEFAULT_CONTEXT_COMPRESSION_RATIO,
      lastCompressedAt: toText(source.lastCompressedAt || ''),
      lastCompressionReason: toText(source.lastCompressionReason || ''),
      lastSourceRange: source.lastSourceRange && typeof source.lastSourceRange === 'object'
        ? {
            start: Number.isFinite(Number(source.lastSourceRange.start)) ? Number(source.lastSourceRange.start) : null,
            end: Number.isFinite(Number(source.lastSourceRange.end)) ? Number(source.lastSourceRange.end) : null
          }
        : null,
      memoryChunksCount: Number.isFinite(Number(source.memoryChunksCount)) ? Math.max(0, Number(source.memoryChunksCount)) : 0
    };
  }

  function normalizeTherapeuticProfile(profile = {}) {
    const source = profile && typeof profile === 'object' ? profile : {};
    const copingProfile = source.copingProfile && typeof source.copingProfile === 'object'
      ? source.copingProfile
      : {};
    const emotionalBaseline = source.emotionalBaseline && typeof source.emotionalBaseline === 'object'
      ? source.emotionalBaseline
      : {};
    const memoryChunks = Array.isArray(source.memoryChunks)
      ? source.memoryChunks.map(normalizeMemoryChunk).filter(Boolean)
      : Array.isArray(source.longTermMemory)
        ? source.longTermMemory.map((item, index) => normalizeMemoryChunk({
            id: `legacy-${index + 1}`,
            title: '歷史記憶',
            detail: item
          })).filter(Boolean)
        : [];
    const memoryStats = normalizeMemoryStats(source.memoryStats || source.compressionState || source.contextBudget || {});

    return {
      version: typeof source.version === 'string' && source.version.trim() ? source.version.trim() : '1.0',
      userId: toText(source.userId || ''),
      createdAt: toText(source.createdAt || '') || new Date().toISOString(),
      lastUpdatedAt: toText(source.lastUpdatedAt || '') || new Date().toISOString(),
      sessionCount: Number.isFinite(Number(source.sessionCount)) ? Math.max(0, Number(source.sessionCount)) : 0,
      stressors: Array.isArray(source.stressors) ? source.stressors.filter(Boolean) : [],
      triggers: Array.isArray(source.triggers) ? source.triggers.filter(Boolean) : [],
      copingProfile: {
        preferredStyle: toText(copingProfile.preferredStyle || ''),
        effectiveMethods: Array.isArray(copingProfile.effectiveMethods) ? copingProfile.effectiveMethods.filter(Boolean) : [],
        ineffectiveMethods: Array.isArray(copingProfile.ineffectiveMethods) ? copingProfile.ineffectiveMethods.filter(Boolean) : []
      },
      positiveAnchors: Array.isArray(source.positiveAnchors) ? source.positiveAnchors.filter(Boolean) : [],
      emotionalBaseline: {
        dominantMood: toText(emotionalBaseline.dominantMood || ''),
        phq9Trend: Array.isArray(emotionalBaseline.phq9Trend) ? emotionalBaseline.phq9Trend.filter(Boolean) : [],
        hamdSignalCount: Number.isFinite(Number(emotionalBaseline.hamdSignalCount)) ? Math.max(0, Number(emotionalBaseline.hamdSignalCount)) : 0
      },
      keyThemes: Array.isArray(source.keyThemes)
        ? source.keyThemes.filter((item) => typeof item === 'string' && item.trim())
        : [],
      clinicianNotes: toText(source.clinicianNotes || ''),
      memoryChunks: memoryChunks.slice(-DEFAULT_MEMORY_CHUNK_LIMIT),
      memoryStats
    };
  }

  function splitTranscript(history = [], recentItems = DEFAULT_RECENT_HISTORY_ITEMS) {
    const normalized = Array.isArray(history) ? history.filter(Boolean) : [];
    const safeRecentItems = Math.max(0, Number(recentItems) || DEFAULT_RECENT_HISTORY_ITEMS);
    const splitAt = Math.max(0, normalized.length - safeRecentItems);
    return {
      older: normalized.slice(0, splitAt),
      recent: normalized.slice(splitAt)
    };
  }

  function formatTranscriptEntry(item = {}) {
    if (!item || !item.content) return '';
    const role = item.role === 'assistant' ? 'AI' : '使用者';
    return `${role}：${toText(item.content)}`;
  }

  function buildMemoryChunkLines(profile = {}) {
    const normalized = normalizeTherapeuticProfile(profile);
    const lines = [];
    const stressors = normalized.stressors
      .map((item) => (typeof item === 'string' ? item : item?.label))
      .filter(Boolean)
      .slice(0, 3);
    const triggers = normalized.triggers
      .map((item) => (typeof item === 'string' ? item : item?.keyword))
      .filter(Boolean)
      .slice(0, 3);
    const anchors = normalized.positiveAnchors
      .map((item) => (typeof item === 'string' ? item : item?.label))
      .filter(Boolean)
      .slice(0, 3);
    const themes = normalized.keyThemes.slice(0, 3);

    if (stressors.length) lines.push(`主要壓力來源：${stressors.join('、')}`);
    if (triggers.length) lines.push(`情緒觸發點：${triggers.map((item) => `「${item}」`).join('、')}`);
    if (themes.length) lines.push(`核心主題：${themes.join('、')}`);
    if (anchors.length) lines.push(`正向錨點：${anchors.join('、')}`);
    if (normalized.copingProfile.preferredStyle) {
      lines.push(`溝通偏好：${normalized.copingProfile.preferredStyle}`);
    }

    const memoryChunks = Array.isArray(normalized.memoryChunks) ? normalized.memoryChunks : [];
    if (memoryChunks.length) {
      lines.push('壓縮記憶：');
      memoryChunks.slice(-5).forEach((chunk, index) => {
        const title = chunk.title ? `${chunk.title}：` : '';
        lines.push(`${index + 1}. ${title}${chunk.summary}`);
      });
    }

    return lines;
  }

  function buildMemoryContextString(profile = {}) {
    const normalized = normalizeTherapeuticProfile(profile);
    const lines = buildMemoryChunkLines(normalized);
    if (!lines.length) return '';
    const stats = normalized.memoryStats || normalizeMemoryStats({});
    const progressPercent = Math.round(clamp((stats.compressionProgress || 0) * 100, 0, 100));

    return [
      '【肉肉認識你 - 長期記憶】',
      `上下文容量：${stats.estimatedTokens}/${stats.tokenLimit} tokens（${progressPercent}%）`,
      '請優先參考以下長期記憶，並自然地融入對話，不要逐字唸出。',
      ...lines
    ].join('\n');
  }

  function buildMemoryMeterState(options = {}) {
    const profile = normalizeTherapeuticProfile(options.profile || {});
    const history = Array.isArray(options.history) ? options.history : [];
    const pendingMessage = toText(options.pendingMessage || '');
    const tokenLimit = Number.isFinite(Number(options.tokenLimit))
      ? Math.max(1, Number(options.tokenLimit))
      : (profile.memoryStats?.tokenLimit || DEFAULT_CONTEXT_TOKEN_LIMIT);
    const recentItems = Math.max(0, Number(options.recentItems) || DEFAULT_RECENT_HISTORY_ITEMS);
    const { recent } = splitTranscript(history, recentItems);
    const memoryText = buildMemoryContextString(profile);
    const estimatedTokens = estimateHistoryTokens(recent)
      + estimateTokenCount(memoryText)
      + estimateTokenCount(pendingMessage)
      + estimateTokenCount(profile.clinicianNotes || '');
    const compressionProgress = clamp(estimatedTokens / tokenLimit, 0, 1.5);
    return {
      tokenLimit,
      estimatedTokens,
      remainingTokens: tokenLimit - estimatedTokens,
      compressionProgress: clamp(compressionProgress, 0, 1),
      percent: Math.round(clamp(compressionProgress, 0, 1) * 100),
      shouldCompress: estimatedTokens >= Math.round(tokenLimit * DEFAULT_CONTEXT_COMPRESSION_RATIO),
      isFull: estimatedTokens >= tokenLimit,
      memoryChunksCount: Array.isArray(profile.memoryChunks) ? profile.memoryChunks.length : 0,
      recentItems,
      lastCompressedAt: profile.memoryStats?.lastCompressedAt || ''
    };
  }

  function mergeMemoryChunk(profile = {}, chunk = {}) {
    const normalizedProfile = normalizeTherapeuticProfile(profile);
    const normalizedChunk = normalizeMemoryChunk(chunk);
    if (!normalizedChunk) return normalizedProfile;

    const existingIndex = normalizedProfile.memoryChunks.findIndex((item) => {
      if (!item || !normalizedChunk.id) return false;
      return item.id === normalizedChunk.id;
    });

    if (existingIndex >= 0) {
      normalizedProfile.memoryChunks.splice(existingIndex, 1, normalizedChunk);
    } else {
      normalizedProfile.memoryChunks.push(normalizedChunk);
    }
    normalizedProfile.memoryChunks = normalizedProfile.memoryChunks.slice(-DEFAULT_MEMORY_CHUNK_LIMIT);
    normalizedProfile.memoryStats = Object.assign({}, normalizedProfile.memoryStats, {
      memoryChunksCount: normalizedProfile.memoryChunks.length,
      lastCompressedAt: normalizedChunk.createdAt,
      shouldCompress: false
    });
    normalizedProfile.lastUpdatedAt = new Date().toISOString();
    return normalizedProfile;
  }

  return {
    DEFAULT_CONTEXT_TOKEN_LIMIT,
    DEFAULT_CONTEXT_COMPRESSION_RATIO,
    DEFAULT_RECENT_HISTORY_ITEMS,
    DEFAULT_MEMORY_CHUNK_LIMIT,
    estimateTokenCount,
    estimateHistoryTokens,
    normalizeMemoryChunk,
    normalizeMemoryStats,
    normalizeTherapeuticProfile,
    splitTranscript,
    buildMemoryContextString,
    buildMemoryMeterState,
    mergeMemoryChunk
  };
});
