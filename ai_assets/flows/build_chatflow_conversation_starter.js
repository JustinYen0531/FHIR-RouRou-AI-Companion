const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const flowsDir = path.join(ROOT, 'Chatflow', 'flows');
const baseFile = path.join(flowsDir, 'AI_Companion_Chatflow_Starter.json');
const outFile = path.join(flowsDir, 'AI_Companion_Chatflow_Conversation_Starter.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildConversationNode(modelNode, memoryNode) {
  return {
    width: 300,
    height: 520,
    id: 'conversationChain_0',
    position: {
      x: 1190,
      y: -60
    },
    type: 'customNode',
    data: {
      id: 'conversationChain_0',
      label: 'AI Companion Conversation',
      version: 1,
      name: 'conversationChain',
      type: 'ConversationChain',
      baseClasses: ['ConversationChain', 'BaseChain', 'BaseLangChain', 'Runnable', 'Serializable'],
      category: 'Chains',
      description: 'Chat models specific conversational chain with memory',
      inputParams: [
        {
          label: 'System Message',
          name: 'systemMessage',
          type: 'string',
          rows: 8,
          optional: true,
          additionalParams: true,
          id: 'conversationChain_0-input-systemMessage-string'
        },
        {
          label: 'Input Moderation',
          name: 'inputModeration',
          type: 'moderation',
          optional: true,
          id: 'conversationChain_0-input-inputModeration-Moderation'
        }
      ],
      inputAnchors: [
        {
          label: 'Chat Model',
          name: 'model',
          type: 'BaseChatModel',
          id: 'conversationChain_0-input-model-BaseChatModel'
        },
        {
          label: 'Memory',
          name: 'memory',
          type: 'BaseMemory',
          id: 'conversationChain_0-input-memory-BaseMemory'
        }
      ],
      inputs: {
        model: `{{${modelNode.id}.data.instance}}`,
        memory: `{{${memoryNode.id}.data.instance}}`,
        inputModeration: '',
        systemMessage: [
          '你是 Rou Rou，使用繁體中文回覆。',
          '你的任務是提供溫暖、直接、低負擔的陪伴式聊天。',
          '若使用者輸入明確模式指令 auto、void、soulmate、mission、option、natural、clarify，請用一句話確認已切換或收到指令。',
          '若使用者表達自傷、自殺或立即危險，優先給安全回應：先接住對方，再明確鼓勵立刻聯絡當地緊急服務、危機協助資源或可信任的人。',
          '其餘情況下，保持自然、溫和、簡潔，不像客服，不像問卷。'
        ].join('\n')
      },
      outputAnchors: [
        {
          id: 'conversationChain_0-output-conversationChain-ConversationChain|BaseChain|BaseLangChain|Runnable|Serializable',
          name: 'conversationChain',
          label: 'ConversationChain',
          type: 'ConversationChain | BaseChain | BaseLangChain | Runnable | Serializable'
        }
      ],
      outputs: {},
      selected: false
    },
    selected: false,
    positionAbsolute: {
      x: 1190,
      y: -60
    },
    dragging: false
  };
}

function buildEdges(modelNode, memoryNode) {
  return [
    {
      source: memoryNode.id,
      sourceHandle: `${memoryNode.id}-output-bufferMemory-BufferMemory|BaseChatMemory|BaseMemory`,
      target: 'conversationChain_0',
      targetHandle: 'conversationChain_0-input-memory-BaseMemory',
      type: 'buttonedge',
      id: `${memoryNode.id}-${memoryNode.id}-output-bufferMemory-BufferMemory|BaseChatMemory|BaseMemory-conversationChain_0-conversationChain_0-input-memory-BaseMemory`
    },
    {
      source: modelNode.id,
      sourceHandle: `${modelNode.id}-output-chatOpenAI-ChatOpenAI|BaseChatModel|BaseLanguageModel`,
      target: 'conversationChain_0',
      targetHandle: 'conversationChain_0-input-model-BaseChatModel',
      type: 'buttonedge',
      id: `${modelNode.id}-${modelNode.id}-output-chatOpenAI-ChatOpenAI|BaseChatModel|BaseLanguageModel-conversationChain_0-conversationChain_0-input-model-BaseChatModel`
    }
  ];
}

function main() {
  const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  const modelNode = clone(base.nodes.find((node) => node.id === 'chatOpenAI_0'));
  const memoryNode = clone(base.nodes.find((node) => node.id === 'bufferMemory_0'));

  if (!modelNode || !memoryNode) {
    throw new Error('Starter template is missing chatOpenAI_0 or bufferMemory_0');
  }

  modelNode.position = { x: 320, y: -180 };
  modelNode.positionAbsolute = { x: 320, y: -180 };
  modelNode.data.label = 'Groq Chat Model';
  modelNode.data.inputs.modelName = 'llama-3.1-8b-instant';
  modelNode.data.inputs.temperature = 0.2;
  modelNode.data.inputs.basepath = 'https://api.groq.com/openai/v1';
  modelNode.data.inputs.allowImageUploads = false;
  modelNode.data.inputs.imageResolution = 'low';

  memoryNode.position = { x: 760, y: -40 };
  memoryNode.positionAbsolute = { x: 760, y: -40 };
  memoryNode.data.label = 'Session Memory';
  memoryNode.data.inputs.sessionId = '';
  memoryNode.data.inputs.memoryKey = 'chat_history';

  const conversationNode = buildConversationNode(modelNode, memoryNode);
  const output = {
    nodes: [modelNode, memoryNode, conversationNode],
    edges: buildEdges(modelNode, memoryNode)
  };

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log('generated', path.relative(ROOT, outFile));
}

main();

