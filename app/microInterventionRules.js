(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MicroInterventionRules = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_COOLDOWN_MS = 4 * 60 * 1000;
  const DEFAULT_SNOOZE_MS = 12 * 60 * 1000;

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function containsAny(text, keywords) {
    const normalized = normalizeText(text);
    return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
  }

  function createCardRegistry() {
    return {
      calm_breathing: {
        id: 'calm_breathing',
        title: '平靜時刻',
        subtitle: '如果你願意，我們先把注意力放回呼吸 30 秒。',
        bodyPreview: '先不用整理所有感受，只要陪自己吸氣、吐氣三次就好。',
        ctaLabel: '開啟引導呼吸',
        durationLabel: '約 30 秒',
        icon: 'air',
        accent: 'breath',
        priority: 2,
        docPath: '/docs/micro_interventions/calm-breathing.md',
        triggerTags: ['low_energy', 'anxious', 'overloaded'],
        suppressTags: ['safety', 'high_risk']
      },
      drink_water: {
        id: 'drink_water',
        title: '喝一口水',
        subtitle: '先做一個很小的動作，讓身體知道你還在照顧自己。',
        bodyPreview: '不用一次振作，只要先喝一口水就可以了。',
        ctaLabel: '看看這張小提醒',
        durationLabel: '約 10 秒',
        icon: 'water_drop',
        accent: 'water',
        priority: 0,
        docPath: '/docs/micro_interventions/drink-water.md',
        triggerTags: ['low_energy', 'frozen', 'short_reply'],
        suppressTags: ['safety', 'high_risk']
      },
      stretch_reset: {
        id: 'stretch_reset',
        title: '站起來伸展',
        subtitle: '如果身體願意，我們先把肩膀和手臂慢慢打開一點。',
        bodyPreview: '不是要你立刻變好，只是讓卡住的地方鬆一點點。',
        ctaLabel: '開啟伸展引導',
        durationLabel: '約 20 秒',
        icon: 'self_improvement',
        accent: 'stretch',
        priority: 1,
        docPath: '/docs/micro_interventions/stretch-reset.md',
        triggerTags: ['restless', 'overloaded', 'stuck'],
        suppressTags: ['safety', 'high_risk']
      },
      tiny_choice_reset: {
        id: 'tiny_choice_reset',
        title: '先不用想很多',
        subtitle: '如果現在很亂，我可以只陪你做一個超小的選擇。',
        bodyPreview: '你不用一次說清楚，只要先挑一個最不費力的方向。',
        ctaLabel: '看看兩個小選項',
        durationLabel: '約 15 秒',
        icon: 'toggle_on',
        accent: 'choice',
        priority: 3,
        docPath: '/docs/micro_interventions/tiny-choice-reset.md',
        triggerTags: ['overloaded', 'indecisive', 'short_reply'],
        suppressTags: ['safety', 'high_risk']
      }
    };
  }

  function shouldSuppressIntervention(context) {
    const metadata = context && context.metadata ? context.metadata : {};
    const riskFlag = String(metadata.risk_flag || '').toLowerCase() === 'true';
    const route = normalizeText(metadata.route || '');
    const currentScreen = normalizeText(context && context.currentScreen);
    const fromOutput = Boolean(context && context.fromOutput);
    const cooldownUntil = Number(context && context.cooldownUntil || 0);
    const snoozedUntil = Number(context && context.snoozedUntil || 0);
    const now = Number(context && context.now || Date.now());

    if (riskFlag) return 'risk_flag';
    if (route === 'safety') return 'safety_route';
    if (fromOutput) return 'output_flow';
    if (currentScreen === 'screen-report') return 'report_screen';
    if (now < cooldownUntil) return 'cooldown';
    if (now < snoozedUntil) return 'snoozed';
    return '';
  }

  function extractSignals(context) {
    const metadata = context && context.metadata ? context.metadata : {};
    const sessionExport = context && context.session_export ? context.session_export : {};
    const burden = metadata.burden_level_state || sessionExport.burden_level_state || {};
    const latestTags = metadata.latest_tag_payload || sessionExport.latest_tag_payload || {};
    const history = context && Array.isArray(context.history) ? context.history : [];
    const lastUserMessage = normalizeText(context && context.lastUserMessage) ||
      normalizeText(history.slice().reverse().find((item) => item && item.role === 'user')?.content);
    const warningTags = Array.isArray(latestTags.warning_tags) ? latestTags.warning_tags.map(normalizeText) : [];
    const sentimentTags = Array.isArray(latestTags.sentiment_tags) ? latestTags.sentiment_tags.map(normalizeText) : [];
    const summary = normalizeText(latestTags.summary || lastUserMessage);

    return {
      burdenLevel: normalizeText(burden.burden_level),
      responseStyle: normalizeText(burden.response_style),
      followupBudget: String(burden.followup_budget || ''),
      warningTags,
      sentimentTags,
      summary,
      lastUserMessage
    };
  }

  function chooseIntervention(context, options = {}) {
    const suppressedBy = shouldSuppressIntervention(context);
    if (suppressedBy) {
      return { suppressed: true, reason: suppressedBy, card: null };
    }

    const registry = options.registry || createCardRegistry();
    const signals = extractSignals(context);
    const now = Number(context && context.now || Date.now());
    const recentDismissCount = Number(context && context.dismissCount || 0);
    const recentCardId = normalizeText(context && context.lastPresentedCardId);
    const history = context && Array.isArray(context.cardHistory) ? context.cardHistory : [];

    if (signals.warningTags.some((item) => item.includes('self_harm') || item.includes('suicid'))) {
      return { suppressed: true, reason: 'warning_tag', card: null };
    }

    const candidateIds = [];
    const messageSuggestsAnxiety = containsAny(signals.summary, ['焦慮', '緊張', '喘不過氣', '心很亂', 'panic', 'anxious']);
    const messageSuggestsLowEnergy = containsAny(signals.summary, ['好累', '很累', '不想動', '沒力', '撐不住', '耗盡', '疲憊']);
    const messageSuggestsRestless = containsAny(signals.summary, ['煩', '躁', '卡住', '繃', '肩膀很緊', '坐不住']);
    const messageSuggestsOverload = containsAny(signals.summary, ['不知道怎麼辦', '不知道要做什麼', '很亂', '想很多', '腦袋很滿']);
    const shortReply = signals.lastUserMessage.length > 0 && signals.lastUserMessage.length <= 6;

    if (signals.burdenLevel === 'high' || signals.responseStyle === 'option_first' || shortReply) {
      candidateIds.push('drink_water', 'tiny_choice_reset');
    }
    if (messageSuggestsAnxiety || signals.sentimentTags.some((item) => ['anxious', 'distress', 'panic', 'overwhelmed'].includes(item))) {
      candidateIds.push('calm_breathing');
    }
    if (messageSuggestsRestless || signals.sentimentTags.some((item) => ['restless', 'irritable', 'agitated'].includes(item))) {
      candidateIds.push('stretch_reset');
    }
    if (messageSuggestsOverload || signals.followupBudget === '0') {
      candidateIds.push('tiny_choice_reset');
    }
    if (messageSuggestsLowEnergy) {
      candidateIds.push('drink_water', 'calm_breathing');
    }

    const uniqueIds = [...new Set(candidateIds)];
    if (!uniqueIds.length) {
      return { suppressed: true, reason: 'no_match', card: null };
    }

    const scored = uniqueIds
      .map((id) => registry[id])
      .filter(Boolean)
      .filter((card) => {
        const lastShown = history.find((item) => item && item.id === card.id);
        return !lastShown || (now - Number(lastShown.shownAt || 0)) >= DEFAULT_COOLDOWN_MS;
      })
      .filter((card) => card.id !== recentCardId)
      .sort((a, b) => a.priority - b.priority);

    if (!scored.length) {
      return { suppressed: true, reason: 'recent_duplicate', card: null };
    }

    const card = recentDismissCount >= 2 ? scored.find((item) => item.priority <= 1) || scored[0] : scored[0];
    return { suppressed: false, reason: 'matched', card };
  }

  return {
    DEFAULT_COOLDOWN_MS,
    DEFAULT_SNOOZE_MS,
    createCardRegistry,
    shouldSuppressIntervention,
    extractSignals,
    chooseIntervention
  };
}));
