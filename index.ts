import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { streamAnthropic } from "@earendil-works/pi-ai/anthropic";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DEFAULT_REGION = "europe-west1";
const AUTH_FILE = path.join(os.homedir(), ".pi", "agent", "auth.json");

function getConfig() {
  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || readAuth()?.project;
  const region = process.env.CLOUD_ML_REGION
    || process.env.GOOGLE_CLOUD_ML_REGION
    || readAuth()?.region
    || DEFAULT_REGION;
  return { projectId, region };
}

function readAuth(): { project?: string; region?: string } | undefined {
  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    return data["vertex-claude"];
  } catch {
    return undefined;
  }
}

function writeAuth(project: string, region: string) {
  let data: Record<string, any> = {};
  try { data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8")); } catch {}
  data["vertex-claude"] = { project, region };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function createClient(projectId: string, region: string) {
  return new AnthropicVertex({ projectId, region });
}

// Maps SimpleStreamOptions → AnthropicOptions and delegates to the built-in provider
const streamVertexClaude = (model: any, context: any, options?: any) => {
  const { projectId, region } = getConfig();
  if (!projectId) {
    throw new Error("Vertex AI project ID not configured. Run /login or set ANTHROPIC_VERTEX_PROJECT_ID.");
  }
  const client = createClient(projectId, region);

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
  const baseMax = opts.maxTokens ?? model.maxTokens;
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
};

const MODELS = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6 (Vertex)",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    contextWindow: 200000,
    maxTokens: 64000,
    compat: { forceAdaptiveThinking: true },
  },
  {
    id: "claude-sonnet-4-5@20250929",
    name: "Claude Sonnet 4.5 (Vertex)",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    contextWindow: 200000,
    maxTokens: 64000,
  },
  {
    id: "claude-haiku-4-5@20251001",
    name: "Claude Haiku 4.5 (Vertex)",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 1, output: 5, cacheRead: 0.08, cacheWrite: 1.25 },
    contextWindow: 200000,
    maxTokens: 64000,
  },
];

export default function (pi: ExtensionAPI) {
  const { region } = getConfig();
  const endpoint = region === "global"
    ? "aiplatform.googleapis.com"
    : `${region}-aiplatform.googleapis.com`;

  pi.registerProvider("vertex-claude", {
    baseUrl: `https://${endpoint}`,
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

        writeAuth(project, selectedRegion);

        // Test the connection
        try {
          const client = createClient(project, selectedRegion);
          await client.messages.create({
            model: "claude-haiku-4-5@20251001",
            max_tokens: 10,
            messages: [{ role: "user", content: "hi" }],
          });
          ui.notify?.(`Connected to Vertex AI (project: ${project}, region: ${selectedRegion})`, "success");
        } catch (e: any) {
          ui.notify?.(`Warning: connection test failed: ${e.message}`, "warning");
        }

        return { type: "oauth", project, region: selectedRegion, access: "adc" };
      },
      async refreshToken(credentials) {
        return credentials;
      },
      getApiKey(_credentials) {
        return "vertex-adc";
      },
    },

    models: MODELS as any,
    streamSimple: streamVertexClaude,
  });

  pi.on("session_start", async (_event: any, ctx: any) => {
    const { projectId } = getConfig();
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
