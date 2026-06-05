# pi-vertex-claude

Multi-provider [pi-agent](https://github.com/badlogic/pi-mono) extension that registers Claude (Vertex AI + Azure Foundry) and Azure OpenAI models with curated model lists — only models you actually have deployed.

## Providers

| Provider | Backend | Auth | Models |
|---|---|---|---|
| `vertex-claude` | Google Vertex AI | ADC (gcloud) | Opus 4.6, Sonnet 4.5, Haiku 4.5 |
| `foundry-claude` | Azure AI Foundry | API key | Sonnet 4.6, Opus 4.6, Opus 4.5, Sonnet 4.5, Haiku 4.5 |
| `azure-openai-responses` | Azure OpenAI | API key | GPT-5.5, 5.4, 5.3-codex, 5.2, 5, o4-mini, 4.1 |

## Setup

```bash
cd ~/.pi/agent/extensions
git clone https://github.com/chrishham/pi-vertex-claude.git vertex-claude
cd vertex-claude && npm install
```

### Environment variables

```bash
# Vertex AI (required for vertex-claude)
export ANTHROPIC_VERTEX_PROJECT_ID=your-project-id
export CLOUD_ML_REGION=europe-west1

# Foundry (optional, enables foundry-claude)
export ANTHROPIC_FOUNDRY_API_KEY=your-key

# Azure OpenAI (optional, enables azure-openai-responses)
export AZURE_OPENAI_API_KEY=your-key
```

### Set default provider

In `~/.pi/agent/settings.json`:
```json
{
  "defaultProvider": "vertex-claude",
  "defaultModel": "claude-opus-4-6"
}
```

### Prerequisites

Google Cloud SDK authenticated for Vertex:
```bash
gcloud auth application-default login
```

## How it works

- **Vertex Claude**: Uses `@anthropic-ai/vertex-sdk` to create an `AnthropicVertex` client, then injects it into pi's built-in `streamAnthropic` via the `options.client` parameter. No custom SSE parsing.
- **Foundry Claude**: Creates a standard `Anthropic` client pointed at the Foundry base URL, same delegation pattern.
- **Azure OpenAI**: Registers models under the built-in `azure-openai-responses` API — replaces the default 42-model catalog with only your deployed models.

## License

MIT
