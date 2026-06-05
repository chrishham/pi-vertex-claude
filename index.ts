import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { streamAnthropic } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DEFAULT_REGION = "europe-west1";
const AUTH_FILE = path.join(os.homedir(), ".pi", "agent", "auth.json");

function getVertexConfig() {
  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || readAuth("vertex-claude")?.project;
  const region = process.env.CLOUD_ML_REGION
    || process.env.GOOGLE_CLOUD_ML_REGION
    || readAuth("vertex-claude")?.region
    || DEFAULT_REGION;
  return { projectId, region };
}

function readAuth(key: string): Record<string, string> | undefined {
  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    return data[key];
  } catch {
    return undefined;
  }
}

function writeAuth(key: string, value: Record<string, string>) {
  let data: Record<string, any> = {};
  try { data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8")); } catch {}
  data[key] = value;
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Vertex AI streaming — delegates to built-in streamAnthropic with client injection
// ---------------------------------------------------------------------------

const streamVertexClaude = (model: any, context: any, options?: any) => {
  const { projectId, region } = getVertexConfig();
  if (!projectId) {
    throw new Error("Vertex AI project ID not configured. Run /login or set ANTHROPIC_VERTEX_PROJECT_ID.");
  }
  const client = new AnthropicVertex({ projectId, region });
  return delegateAnthropic(client, model, context, options);
};

// ---------------------------------------------------------------------------
// Foundry streaming — delegates to built-in streamAnthropic with baseURL override
// ---------------------------------------------------------------------------

const FOUNDRY_BASE_URL = "https://idpdevops-foundry.services.ai.azure.com/anthropic";

const streamFoundryClaude = (model: any, context: any, options?: any) => {
  const apiKey = process.env.ANTHROPIC_FOUNDRY_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_FOUNDRY_API_KEY not set.");
  }
  const client = new Anthropic({
    apiKey,
    baseURL: FOUNDRY_BASE_URL,
  });
  return delegateAnthropic(client, model, context, options);
};

// ---------------------------------------------------------------------------
// Shared Anthropic delegation — maps SimpleStreamOptions and injects client
// ---------------------------------------------------------------------------

function delegateAnthropic(client: any, model: any, context: any, options?: any) {
  const opts: any = {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    signal: options?.signal,
    transport: options?.transport,
    cacheRetention: options?.cacheRetention,
    sessionId: options?.sessionId,
    headers: options?.headers,
    onPayload: options?.onPayload,
    onResponse: options?.onResponse,
    timeoutMs: options?.timeoutMs,
    maxRetries: options?.maxRetries,
    metadata: options?.metadata,
    client,
  };

  if (!options?.reasoning) {
    return streamAnthropic(model, context, { ...opts, thinkingEnabled: false });
  }

  if (model.compat?.forceAdaptiveThinking === true) {
    const effortMap: Record<string, string> = { minimal: "low", low: "low", medium: "medium", high: "high", xhigh: "high" };
    const effort = model.thinkingLevelMap?.[options.reasoning] ?? effortMap[options.reasoning] ?? "high";
    return streamAnthropic(model, context, { ...opts, thinkingEnabled: true, effort });
  }

  const budgets: Record<string, number> = { minimal: 1024, low: 2048, medium: 8192, high: 16384, ...options?.thinkingBudgets };
  const level = options.reasoning === "xhigh" ? "high" : options.reasoning;
  let thinkingBudget = budgets[level] || 8192;
  const maxTokens = opts.maxTokens === undefined
    ? model.maxTokens
    : Math.min(opts.maxTokens + thinkingBudget, model.maxTokens);
  if (maxTokens <= thinkingBudget) {
    thinkingBudget = Math.max(0, maxTokens - 1024);
  }

  return streamAnthropic(model, context, {
    ...opts,
    maxTokens,
    thinkingEnabled: true,
    thinkingBudgetTokens: thinkingBudget,
  });
}

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

const VERTEX_MODELS = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6 [Vertex]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    contextWindow: 200000,
    maxTokens: 64000,
    compat: { forceAdaptiveThinking: true },
  },
  {
    id: "claude-sonnet-4-5@20250929",
    name: "Claude Sonnet 4.5 [Vertex]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    contextWindow: 200000,
    maxTokens: 64000,
  },
  {
    id: "claude-haiku-4-5@20251001",
    name: "Claude Haiku 4.5 [Vertex]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 1, output: 5, cacheRead: 0.08, cacheWrite: 1.25 },
    contextWindow: 200000,
    maxTokens: 64000,
  },
];

const FOUNDRY_MODELS = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 [Foundry]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    contextWindow: 200000,
    maxTokens: 64000,
    compat: { forceAdaptiveThinking: true },
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6 [Foundry]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    contextWindow: 200000,
    maxTokens: 64000,
    compat: { forceAdaptiveThinking: true },
  },
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5 [Foundry]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    contextWindow: 200000,
    maxTokens: 64000,
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5 [Foundry]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    contextWindow: 200000,
    maxTokens: 64000,
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5 [Foundry]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 1, output: 5, cacheRead: 0.08, cacheWrite: 1.25 },
    contextWindow: 200000,
    maxTokens: 64000,
  },
];

const AZURE_OAI_BASE_URL = "https://oai-556devops.openai.azure.com/openai";

const AZURE_MODELS = [
  {
    id: "gpt-5.5",
    name: "GPT-5.5 [Azure]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 2, output: 10, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 100000,
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4 [Azure]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 100000,
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex [Azure]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 100000,
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2 [Azure]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 100000,
  },
  {
    id: "gpt-5",
    name: "GPT-5 [Azure]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 100000,
  },
  {
    id: "o4-mini",
    name: "o4-mini [Azure]",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 1.1, output: 4.4, cacheRead: 0.275, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 100000,
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1 [Azure]",
    reasoning: false,
    input: ["text", "image"] as const,
    cost: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 1047576,
    maxTokens: 32768,
  },
];

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // --- Vertex Claude ---
  const { region } = getVertexConfig();
  const vertexEndpoint = region === "global"
    ? "aiplatform.googleapis.com"
    : `${region}-aiplatform.googleapis.com`;

  pi.registerProvider("vertex-claude", {
    baseUrl: `https://${vertexEndpoint}`,
    apiKey: "vertex-adc",
    api: "anthropic-vertex",
    oauth: {
      name: "Google Cloud Vertex AI",
      async login(callbacks) {
        const ui = callbacks;
        const projects = await listProjects(pi);
        const project = projects
          ? await ui.select("Select GCP project:", projects)
          : await ui.input("Enter GCP project ID:");
        if (!project) throw new Error("No project selected");

        const regions = ["europe-west1", "us-east5", "us-central1", "asia-southeast1"];
        const selectedRegion = await ui.select("Select region:", regions) || DEFAULT_REGION;

        writeAuth("vertex-claude", { project, region: selectedRegion });

        try {
          const client = new AnthropicVertex({ projectId: project, region: selectedRegion });
          await client.messages.create({
            model: "claude-haiku-4-5@20251001",
            max_tokens: 10,
            messages: [{ role: "user", content: "hi" }],
          });
          ui.notify?.(`Connected to Vertex AI (project: ${project}, region: ${selectedRegion})`, "success");
        } catch (e: any) {
          ui.notify?.(`Connection test failed: ${e.message}`, "warning");
        }

        return { type: "oauth", project, region: selectedRegion, access: "adc" };
      },
      async refreshToken(credentials) { return credentials; },
      getApiKey() { return "vertex-adc"; },
    },
    models: VERTEX_MODELS as any,
    streamSimple: streamVertexClaude,
  });

  // --- Foundry Claude ---
  const foundryKey = process.env.ANTHROPIC_FOUNDRY_API_KEY;
  if (foundryKey) {
    pi.registerProvider("foundry-claude", {
      baseUrl: FOUNDRY_BASE_URL,
      apiKey: foundryKey,
      api: "anthropic-foundry",
      models: FOUNDRY_MODELS as any,
      streamSimple: streamFoundryClaude,
    });
  }

  // --- Azure OpenAI (replaces built-in model list with only our deployments) ---
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  if (azureKey) {
    pi.registerProvider("azure-openai-responses", {
      baseUrl: AZURE_OAI_BASE_URL,
      apiKey: azureKey,
      api: "azure-openai-responses",
      models: AZURE_MODELS as any,
    });
  }

  // --- Hide other built-in providers we don't use ---
  for (const name of ["anthropic", "google", "google-vertex"]) {
    try { pi.unregisterProvider(name); } catch {}
  }

  // --- Session start notification ---
  pi.on("session_start", async (_event: any, ctx: any) => {
    const { projectId } = getVertexConfig();
    if (!projectId) {
      ctx.ui?.notify?.("Vertex Claude: Run /login to configure project and region", "warning");
    }
  });
}

async function listProjects(pi: ExtensionAPI): Promise<string[] | null> {
  try {
    const result = await (pi as any).exec("gcloud", [
      "projects", "list", "--format=value(projectId)", "--limit=20",
    ]);
    if (result?.stdout) {
      return result.stdout.trim().split("\n").filter(Boolean);
    }
  } catch {}
  return null;
}
