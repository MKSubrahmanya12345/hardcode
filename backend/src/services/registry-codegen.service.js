import Groq from "groq-sdk";
import { getRegistry, getAIContext } from "./registry.service.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const stripThinking = (value = "") => {
  return String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
};

const safeParseJson = (text = "") => {
  const cleaned = stripThinking(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonBlock = cleaned.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlock?.[1]) {
      return JSON.parse(jsonBlock[1]);
    }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match?.[0]) {
      return JSON.parse(match[0]);
    }
    throw new Error("AI response parsing failed");
  }
};

const callAI = async (prompt) => {
  const res = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1
  });
  return String(res.choices?.[0]?.message?.content || "").trim();
};

const pickDefaultBoardKey = (registry) => {
  const entries = Object.entries(registry || {});
  const controllers = entries.filter(([, def]) => String(def?.category || "").toLowerCase() === "controller");
  if (controllers.length === 1) return controllers[0][0];
  if (controllers.length > 1) return controllers[0][0];
  if (entries.length > 0) return entries[0][0];
  return "";
};

const computeLayout = (count) => {
  const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(Math.max(1, count)))));
  const gapX = 170;
  const gapY = 140;
  const startX = 140;
  const startY = 90;
  return { cols, gapX, gapY, startX, startY };
};

const generateParts = (registry, plan) => {
  const items = Array.isArray(plan?.components) ? plan.components : [];
  const { cols, gapX, gapY, startX, startY } = computeLayout(items.length + 1);

  const parts = [];

  const boardKey = plan?.board?.type || "";
  const boardDef = registry[boardKey];
  if (!boardDef) {
    throw new Error(`Board type not found in registry: ${boardKey || "(empty)"}`);
  }

  parts.push({
    type: boardDef.wokwiType,
    id: String(plan?.board?.id || "board"),
    top: Number.isFinite(plan?.board?.top) ? plan.board.top : 270,
    left: Number.isFinite(plan?.board?.left) ? plan.board.left : 185,
    attrs: boardDef.attrs ? Object.fromEntries(Object.entries(boardDef.attrs).map(([k, v]) => [k, v?.default ?? null])) : {}
  });

  items.forEach((comp, idx) => {
    const def = registry[comp.type];
    if (!def) {
      throw new Error(`Component type not found in registry: ${comp.type || "(empty)"}`);
    }
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    parts.push({
      type: def.wokwiType,
      id: String(comp.id || `${comp.type.toLowerCase()}${idx + 1}`),
      top: Number.isFinite(comp.top) ? comp.top : startY + row * gapY,
      left: Number.isFinite(comp.left) ? comp.left : startX + col * gapX,
      rotate: Number.isFinite(comp.rotate) ? comp.rotate : undefined,
      attrs: comp.attrs && typeof comp.attrs === "object" ? comp.attrs : {}
    });
  });

  return parts.map((p) => {
    const cleaned = { ...p };
    if (cleaned.rotate === undefined) delete cleaned.rotate;
    return cleaned;
  });
};

const validatePinExists = (registry, compType, pinName) => {
  const def = registry[compType];
  if (!def) throw new Error(`Unknown component type: ${compType}`);
  const pins = Array.isArray(def.pins) ? def.pins.map((p) => p.name) : [];
  if (!pins.includes(pinName)) {
    throw new Error(`Invalid pin "${pinName}" for component "${compType}"`);
  }
};

const generateConnections = (registry, plan) => {
  const wires = Array.isArray(plan?.connections) ? plan.connections : [];
  return wires.map((w, idx) => {
    const from = w?.from;
    const to = w?.to;
    if (!from?.type || !from?.pin || !to?.type || !to?.pin) {
      throw new Error(`Invalid connection at index ${idx}`);
    }

    validatePinExists(registry, from.type, from.pin);
    validatePinExists(registry, to.type, to.pin);

    const color = String(w?.color || "green");
    const route = Array.isArray(w?.route) ? w.route : [];
    return [
      `${from.id}:${from.pin}`,
      `${to.id}:${to.pin}`,
      color,
      route
    ];
  });
};

const buildPlanPrompt = ({ project, userPrompt, registryContext, defaultBoardKey }) => {
  return `
You are a strict hardware planning assistant.

Goal:
Return a SMALL JSON plan that selects components FROM THE REGISTRY and wires them.
Do not output sketch.ino or diagram.json directly.

Rules:
- You can ONLY use component "type" values that exist in the REGISTRY CONTEXT list (use the "name" field as the type key).
- Pins must be chosen from that component's pin list.
- If the user asks for a board, pick it if it exists in the registry. Otherwise choose a reasonable default.
- If the prompt is ambiguous, make safe defaults and write a note in notes[].
- Return ONLY JSON. No markdown. No prose.

REGISTRY CONTEXT (compressed):
${JSON.stringify(registryContext)}

OUTPUT SHAPE (STRICT):
{
  "board": { "type": "${defaultBoardKey}", "id": "mega", "top": 270, "left": 185 },
  "components": [
    { "type": "", "id": "", "attrs": {}, "top": 0, "left": 0, "rotate": 0 }
  ],
  "connections": [
    {
      "from": { "type": "", "id": "", "pin": "" },
      "to": { "type": "", "id": "", "pin": "" },
      "color": "green",
      "route": []
    }
  ],
  "notes": []
}

PROJECT DESCRIPTION:
${project?.description || ""}

IDEATION STATE:
${JSON.stringify(project?.ideaState || {})}

COMPONENTS STATE:
${JSON.stringify(project?.componentsState || {})}

USER REQUEST:
${userPrompt || ""}
`;
};

export async function generateArtifactsFromRegistry({ project, userPrompt = "" }) {
  const registry = getRegistry();
  const registryContext = getAIContext();
  const defaultBoardKey = pickDefaultBoardKey(registry);
  if (!defaultBoardKey) {
    throw new Error("componentRegistry is empty; add at least one controller component.");
  }

  const planPrompt = buildPlanPrompt({ project, userPrompt, registryContext, defaultBoardKey });
  const raw = await callAI(planPrompt);
  const plan = safeParseJson(raw);

  // Normalize board defaults if model omitted.
  const boardType = plan?.board?.type || defaultBoardKey;
  const boardId = String(plan?.board?.id || "board");
  const normalizedPlan = {
    ...plan,
    board: {
      type: boardType,
      id: boardId,
      top: Number.isFinite(plan?.board?.top) ? plan.board.top : 270,
      left: Number.isFinite(plan?.board?.left) ? plan.board.left : 185
    },
    components: Array.isArray(plan?.components) ? plan.components : [],
    connections: Array.isArray(plan?.connections) ? plan.connections : [],
    notes: Array.isArray(plan?.notes) ? plan.notes.map((n) => String(n)) : []
  };

  // Validate board exists.
  if (!registry[normalizedPlan.board.type]) {
    throw new Error(`Board "${normalizedPlan.board.type}" not found in registry.`);
  }

  // Generate diagram from plan + registry.
  const parts = generateParts(registry, normalizedPlan);
  const connections = generateConnections(registry, {
    ...normalizedPlan,
    // Ensure board id is consistent for connection building.
    board: { ...normalizedPlan.board, id: normalizedPlan.board.id }
  });

  // Minimal sketch: keep deterministic and prompt-agnostic.
  // (We will improve this later by generating sketch from plan + signals.)
  const sketchIno = `void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(100);\n}\n`;

  return {
    sketchIno,
    diagramJson: {
      version: 1,
      author: "HardCode AI",
      editor: "wokwi",
      parts,
      connections,
      dependencies: {}
    },
    notes: [
      ...normalizedPlan.notes,
      "Generated via registry-plan pipeline: AI produced a small plan, backend validated with full registry and generated diagram.json."
    ],
    plan: normalizedPlan
  };
}

