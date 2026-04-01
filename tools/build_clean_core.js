const fs = require('fs');
const path = require('path');
const YAML = require('../.tmp_yaml/node_modules/yaml');

const sourcePath = 'C:/Users/閻星澄/Downloads/AI_Chat_Companion_New_Skeleton (3).yml';
const targetPath = path.join(process.cwd(), 'AI_Chat_Companion_Clean_Core.yml');

const keepConversationVars = new Set([
  'pending_question',
  'risk_flag',
  'red_flag_payload',
  'followup_turn_count',
  'followup_status',
  'active_mode',
  'routing_mode_override',
  'command_feedback',
  'latest_tag_payload',
  'hamd_progress_state',
  'mission_retrieval_audit',
  'burden_level_state'
]);

const keepNodes = new Set([
  'start',
  'command-detector',
  'set-command-auto',
  'set-command-void',
  'set-command-soulmate',
  'set-command-mission',
  'set-command-option',
  'set-command-natural',
  'set-command-clarify',
  'risk-detector',
  'risk-structurer',
  'set-risk-state',
  'clear-risk-state',
  'classifier',
  'set-mode-void',
  'set-mode-soulmate',
  'set-mode-mission',
  'set-mode-option',
  'set-mode-natural',
  'set-mode-clarify',
  'llm-void',
  'llm-soulmate',
  'llm-mission',
  'llm-option',
  'llm-natural',
  'llm-clarify',
  'answer-safety',
  'answer-void',
  'answer-soulmate',
  'answer-mission',
  'answer-option',
  'answer-natural',
  'answer-clarify',
  'answer-command'
]);

const edge = (id, source, sourceHandle, target, sourceType, targetType) => ({
  data: { sourceType, targetType },
  id,
  source,
  sourceHandle,
  target,
  targetHandle: 'target',
  type: 'custom',
  zIndex: 0
});

const yamlText = fs.readFileSync(sourcePath, 'utf8');
const doc = YAML.parse(yamlText);

doc.app.name = 'AI_Chat_Companion_Clean_Core';
doc.app.description = 'Clean core workflow rebuilt from the latest export without retrieval, follow-up, or FHIR branches.';
doc.workflow.features.retriever_resource.enabled = false;
doc.workflow.conversation_variables = doc.workflow.conversation_variables.filter((v) =>
  keepConversationVars.has(v.name)
);

const nodeMap = new Map(doc.workflow.graph.nodes.map((node) => [node.id, node]));
doc.workflow.graph.nodes = [...keepNodes].map((id) => nodeMap.get(id)).filter(Boolean);
for (const node of doc.workflow.graph.nodes) {
  if (node.id === 'llm-mission' || node.id === 'llm-option') {
    node.data.context = { enabled: false, variable_selector: [] };
  }
  if (node.id === 'llm-mission') {
    node.data.prompt_template = [
      {
        role: 'system',
        text: '你是任務引導模式。把使用者目前的問題整理成 2 到 4 個清楚、可執行的下一步。使用繁體中文。'
      },
      {
        role: 'user',
        text: '{{#sys.query#}}'
      }
    ];
  }
  if (node.id === 'llm-option') {
    node.data.prompt_template = [
      {
        role: 'system',
        text: '你是選項模式。根據使用者問題提供 2 到 4 個簡短選項。每個選項一行，使用繁體中文。'
      },
      {
        role: 'user',
        text: '{{#sys.query#}}'
      }
    ];
  }
}

const commandItems = (modeValue, feedback) => [
  { input_type: 'constant', operation: 'overwrite', value: modeValue, variable_selector: ['conversation', 'routing_mode_override'] },
  { input_type: 'constant', operation: 'overwrite', value: modeValue, variable_selector: ['conversation', 'active_mode'] },
  { input_type: 'constant', operation: 'overwrite', value: 'none', variable_selector: ['conversation', 'pending_question'] },
  { input_type: 'constant', operation: 'overwrite', value: '0', variable_selector: ['conversation', 'followup_turn_count'] },
  { input_type: 'constant', operation: 'overwrite', value: 'none', variable_selector: ['conversation', 'followup_status'] },
  { input_type: 'constant', operation: 'overwrite', value: feedback, variable_selector: ['conversation', 'command_feedback'] }
];

const modeItems = (modeValue) => [
  { input_type: 'constant', operation: 'overwrite', value: modeValue, variable_selector: ['conversation', 'active_mode'] }
];

const updateNodeData = (id, patch) => {
  const node = nodeMap.get(id);
  if (node) Object.assign(node.data, patch);
};

updateNodeData('set-command-auto', { items: commandItems('auto', '已切換為自動分流模式。') });
updateNodeData('set-command-void', { items: commandItems('void', '已切換為樹洞模式。') });
updateNodeData('set-command-soulmate', { items: commandItems('soulmate', '已切換為靈魂伴侶模式。') });
updateNodeData('set-command-mission', { items: commandItems('mission', '已切換為任務引導模式。') });
updateNodeData('set-command-option', { items: commandItems('option', '已切換為選項模式。') });
updateNodeData('set-command-natural', { items: commandItems('natural', '已切換為自然聊天模式。') });
updateNodeData('set-command-clarify', { items: commandItems('clarify', '已切換為釐清提問模式。') });

updateNodeData('set-risk-state', {
  items: [
    { input_type: 'constant', operation: 'overwrite', value: 'true', variable_selector: ['conversation', 'risk_flag'] },
    { input_type: 'variable', operation: 'overwrite', value: ['risk-structurer', 'text'], variable_selector: ['conversation', 'red_flag_payload'] },
    { input_type: 'constant', operation: 'overwrite', value: 'safety', variable_selector: ['conversation', 'active_mode'] }
  ]
});

updateNodeData('clear-risk-state', {
  items: [
    { input_type: 'constant', operation: 'overwrite', value: 'false', variable_selector: ['conversation', 'risk_flag'] },
    { input_type: 'constant', operation: 'overwrite', value: 'none', variable_selector: ['conversation', 'red_flag_payload'] }
  ]
});

updateNodeData('set-mode-void', { items: modeItems('void') });
updateNodeData('set-mode-soulmate', { items: modeItems('soulmate') });
updateNodeData('set-mode-mission', { items: modeItems('mission') });
updateNodeData('set-mode-option', { items: modeItems('option') });
updateNodeData('set-mode-natural', { items: modeItems('natural') });
updateNodeData('set-mode-clarify', { items: modeItems('clarify') });

const graphEdges = [
  edge('start-command-detector', 'start', 'source', 'command-detector', 'start', 'question-classifier'),
  edge('command-auto-set', 'command-detector', 'cmd_auto', 'set-command-auto', 'question-classifier', 'assigner'),
  edge('command-void-set', 'command-detector', 'cmd_void', 'set-command-void', 'question-classifier', 'assigner'),
  edge('command-soulmate-set', 'command-detector', 'cmd_soulmate', 'set-command-soulmate', 'question-classifier', 'assigner'),
  edge('command-mission-set', 'command-detector', 'cmd_mission', 'set-command-mission', 'question-classifier', 'assigner'),
  edge('command-option-set', 'command-detector', 'cmd_option', 'set-command-option', 'question-classifier', 'assigner'),
  edge('command-natural-set', 'command-detector', 'cmd_natural', 'set-command-natural', 'question-classifier', 'assigner'),
  edge('command-clarify-set', 'command-detector', 'cmd_clarify', 'set-command-clarify', 'question-classifier', 'assigner'),
  edge('command-none-risk', 'command-detector', 'cmd_none', 'risk-detector', 'question-classifier', 'question-classifier'),
  edge('answer-command-auto', 'set-command-auto', 'source', 'answer-command', 'assigner', 'answer'),
  edge('answer-command-void', 'set-command-void', 'source', 'answer-command', 'assigner', 'answer'),
  edge('answer-command-soulmate', 'set-command-soulmate', 'source', 'answer-command', 'assigner', 'answer'),
  edge('answer-command-mission', 'set-command-mission', 'source', 'answer-command', 'assigner', 'answer'),
  edge('answer-command-option', 'set-command-option', 'source', 'answer-command', 'assigner', 'answer'),
  edge('answer-command-natural', 'set-command-natural', 'source', 'answer-command', 'assigner', 'answer'),
  edge('answer-command-clarify', 'set-command-clarify', 'source', 'answer-command', 'assigner', 'answer'),
  edge('risk-red-structurer', 'risk-detector', 'red_flag', 'risk-structurer', 'question-classifier', 'llm'),
  edge('risk-structurer-set-state', 'risk-structurer', 'source', 'set-risk-state', 'llm', 'assigner'),
  edge('risk-state-safety', 'set-risk-state', 'source', 'safety-response', 'assigner', 'llm'),
  edge('safety-answer-edge', 'safety-response', 'source', 'answer-safety', 'llm', 'answer'),
  edge('risk-normal-clear', 'risk-detector', 'normal', 'clear-risk-state', 'question-classifier', 'assigner'),
  edge('risk-clear-intent', 'clear-risk-state', 'source', 'classifier', 'assigner', 'question-classifier'),
  edge('classifier-void', 'classifier', 'mode_1_void', 'set-mode-void', 'question-classifier', 'assigner'),
  edge('classifier-soulmate', 'classifier', 'mode_2_soulmate', 'set-mode-soulmate', 'question-classifier', 'assigner'),
  edge('classifier-mission', 'classifier', 'mode_3_mission', 'set-mode-mission', 'question-classifier', 'assigner'),
  edge('classifier-option', 'classifier', 'mode_4_option', 'set-mode-option', 'question-classifier', 'assigner'),
  edge('classifier-natural', 'classifier', 'mode_5_natural', 'set-mode-natural', 'question-classifier', 'assigner'),
  edge('classifier-clarify', 'classifier', 'mode_6_clarify', 'set-mode-clarify', 'question-classifier', 'assigner'),
  edge('set-mode-void-llm', 'set-mode-void', 'source', 'llm-void', 'assigner', 'llm'),
  edge('set-mode-soulmate-llm', 'set-mode-soulmate', 'source', 'llm-soulmate', 'assigner', 'llm'),
  edge('set-mode-mission-llm', 'set-mode-mission', 'source', 'llm-mission', 'assigner', 'llm'),
  edge('set-mode-option-llm', 'set-mode-option', 'source', 'llm-option', 'assigner', 'llm'),
  edge('set-mode-natural-llm', 'set-mode-natural', 'source', 'llm-natural', 'assigner', 'llm'),
  edge('set-mode-clarify-llm', 'set-mode-clarify', 'source', 'llm-clarify', 'assigner', 'llm'),
  edge('void-answer-edge', 'llm-void', 'source', 'answer-void', 'llm', 'answer'),
  edge('soulmate-answer-edge', 'llm-soulmate', 'source', 'answer-soulmate', 'llm', 'answer'),
  edge('mission-answer-edge', 'llm-mission', 'source', 'answer-mission', 'llm', 'answer'),
  edge('option-answer-edge', 'llm-option', 'source', 'answer-option', 'llm', 'answer'),
  edge('natural-answer-edge', 'llm-natural', 'source', 'answer-natural', 'llm', 'answer'),
  edge('clarify-answer-edge', 'llm-clarify', 'source', 'answer-clarify', 'llm', 'answer')
];

doc.workflow.graph.edges = graphEdges;
doc.workflow.rag_pipeline_variables = [];
doc.workflow.graph.viewport = { x: 0, y: 0, zoom: 0.7 };

fs.writeFileSync(targetPath, YAML.stringify(doc), 'utf8');
console.log(`Wrote ${targetPath}`);
