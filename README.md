# pi-vertex-claude

Thin [pi-agent](https://github.com/badlogic/pi-mono) extension for running Claude models on Google Vertex AI.

Unlike heavier Vertex extensions that reimplement the Anthropic streaming protocol, this extension delegates all streaming to pi-agent's built-in Anthropic provider via client injection (`AnthropicVertex` → `streamAnthropic`). The result is ~100 lines of code instead of ~1000.

## Setup

```bash
cd ~/.pi/agent/extensions
git clone https://github.com/chrishham/pi-vertex-claude.git vertex-claude
cd vertex-claude && npm install
```

### Prerequisites

1. **Google Cloud SDK** (`gcloud`) installed and authenticated:
   ```bash
   gcloud auth application-default login
   ```

2. **Environment variables** (or use `/login` in pi):
   ```bash
   export ANTHROPIC_VERTEX_PROJECT_ID=your-project-id
   export CLOUD_ML_REGION=europe-west1  # optional, defaults to europe-west1
   ```

3. **Set as default provider** in `~/.pi/agent/settings.json`:
   ```json
   {
     "defaultProvider": "vertex-claude",
     "defaultModel": "claude-sonnet-4-5@20250929"
   }
   ```

## Models

| Model | Context | Max Output | Reasoning |
|-------|---------|-----------|-----------|
| claude-opus-4-6 | 200K | 64K | Adaptive |
| claude-sonnet-4-5@20250929 | 200K | 64K | Budget |
| claude-haiku-4-5@20251001 | 200K | 64K | Budget |

## How it works

The official `@anthropic-ai/vertex-sdk` creates an `AnthropicVertex` client that authenticates via Google ADC. Pi-agent's built-in `streamAnthropic` accepts an `options.client` parameter for exactly this purpose. This extension connects the two — no custom SSE parsing, no raw HTTP calls.

## License

MIT
