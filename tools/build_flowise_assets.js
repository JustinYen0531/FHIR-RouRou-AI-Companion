const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'flowise', 'source');
const OUTPUT_DIR = path.join(ROOT, 'flowise');
const PROMPTS_DIR = path.join(OUTPUT_DIR, 'prompts');
const FLOWS_DIR = path.join(OUTPUT_DIR, 'flows');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapNodeType(type) {
  switch (type) {
    case 'question-classifier':
      return 'Custom JS Function + If Else + Set Variable';
    case 'if-else':
      return 'If Else';
    case 'assigner':
      return 'Set Variable';
    case 'knowledge-retrieval':
      return 'Document Store + Retriever + QA Chain';
    case 'llm':
      return 'LLM / Prompt Chain';
    case 'answer':
      return 'Final output node';
    case 'start':
      return 'Chatflow input / Start';
    default:
      return 'Custom implementation';
  }
}

function buildPromptMarkdown(node) {
  const sections = [`# ${node.title}`, '', `- Dify id: \`${node.id}\``, `- Dify type: \`${node.type}\``, `- Flowise mapping: ${mapNodeType(node.type)}`, ''];
  if (node.instruction) {
    sections.push('## Instruction', '', node.instruction.trim(), '');
  }
  if (Array.isArray(node.prompt_template) && node.prompt_template.length > 0) {
    sections.push('## Prompt Template', '');
    for (const prompt of node.prompt_template) {
      sections.push(`### ${prompt.role}`, '', String(prompt.text || '').trim(), '');
    }
  }
  if (node.dataset_ids) {
    sections.push('## Dataset Ids', '', '```json', JSON.stringify(node.dataset_ids, null, 2), '```', '');
  }
  return sections.join('\n');
}

function buildFlowBlueprint(nodes, edges, stateSchema, assigners) {
  const promptNodes = nodes
    .filter((node) => node.instruction || (node.prompt_template && node.prompt_template.length > 0))
    .map((node) => ({
      id: node.id,
      title: node.title,
      type: node.type,
      prompt_file: `flowise/prompts/${slugify(node.title)}.md`
    }));

  return {
    name: 'AI Companion Flowise Blueprint',
    source: 'AI_Chat_Companion_New_Skeleton (4).yml',
    generated_at: new Date().toISOString(),
    architecture: {
      orchestration: 'Node proxy + Flowise chatflow runtime',
      memory: 'Flowise sessionId + Node-side business state',
      rag: 'Local file corpus + Flowise retriever'
    },
    state_variables: stateSchema.map((item) => ({
      name: item.name,
      value_type: item.value_type,
      default_value: item.value,
      description: item.description
    })),
    node_mapping: nodes.map((node) => ({
      id: node.id,
      title: node.title,
      type: node.type,
      flowise_component: mapNodeType(node.type)
    })),
    prompt_nodes: promptNodes,
    assigners: assigners.map((assigner) => ({
      id: assigner.id,
      title: assigner.title,
      writes: (assigner.items || []).map((item) => ({
        variable: item.variable_selector ? item.variable_selector.join('.') : '',
        input_type: item.input_type,
        operation: item.operation,
        value: item.value
      }))
    })),
    edges
  };
}

function main() {
  ensureDir(PROMPTS_DIR);
  ensureDir(FLOWS_DIR);

  const nodes = readJson(path.join(SOURCE_DIR, 'dify_nodes.json'));
  const edges = readJson(path.join(SOURCE_DIR, 'dify_edges.json'));
  const stateSchema = readJson(path.join(SOURCE_DIR, 'dify_state_schema.json'));
  const assigners = readJson(path.join(SOURCE_DIR, 'dify_assigners.json'));

  const nodeMap = nodes.map((node) => ({
    id: node.id,
    title: node.title,
    type: node.type,
    flowise_component: mapNodeType(node.type)
  }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'FLOWISE_DIFY_NODE_MAP.json'),
    JSON.stringify(nodeMap, null, 2)
  );

  const normalizedState = stateSchema.map((item) => ({
    name: item.name,
    selector: item.selector,
    default_value: item.value,
    value_type: item.value_type,
    description: item.description
  }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'FLOWISE_STATE_SCHEMA.json'),
    JSON.stringify(normalizedState, null, 2)
  );

  for (const node of nodes) {
    if (!node.title) continue;
    if (!node.instruction && !(node.prompt_template && node.prompt_template.length > 0)) continue;
    fs.writeFileSync(
      path.join(PROMPTS_DIR, `${slugify(node.title)}.md`),
      buildPromptMarkdown(node)
    );
  }

  const blueprint = buildFlowBlueprint(nodes, edges, stateSchema, assigners);
  fs.writeFileSync(
    path.join(FLOWS_DIR, 'AI_Companion_Flowise_Blueprint.json'),
    JSON.stringify(blueprint, null, 2)
  );

  console.log('Flowise assets generated.');
}

main();
