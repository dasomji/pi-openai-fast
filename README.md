# pi-openai-fast

Minimal Pi extension for OpenAI Fast mode.

It adds a `/fast` command and, when enabled, injects `service_tier: "priority"` into supported OpenAI/Codex provider requests. Codex uses `priority` as the wire value for the user-facing Fast tier.

## Install

```bash
pi install npm:@wienerberliner/pi-openai-fast
```

For local development from this checkout:

```bash
pi -e /home/dev/Development/pi-daniel/extensions/pi-openai-fast
```

## Usage

```text
/fast
/fast on
/fast off
/fast status
```

Fast mode is off by default and only affects the current Pi process. When it is on and the current model is supported, the extension publishes the footer status key `pi-fast-mode` with the text `Fast`.

## Supported models

- `openai/gpt-5.5`
- `openai/gpt-5.4`
- `openai/gpt-5.4-mini`
- `openai-codex/gpt-5.5`
- `openai-codex/gpt-5.4`
- `openai-codex/gpt-5.4-mini`

The list is deliberately explicit so newly added OpenAI models do not start using the higher-usage Fast tier by surprise. Edit `SUPPORTED_MODEL_KEYS` in `extensions/openai-fast.ts` when OpenAI adds another Fast-capable model.

## Behavior

The request payload is patched only when all of these are true:

- `/fast` is enabled.
- The active model is in the supported model list.
- The serialized provider payload is an object.
- The payload model matches the active Pi model id.
- The payload does not already contain `service_tier`.

There are no runtime dependencies, no config files, no provider registration, and no auth storage integration.

## Development

```bash
npm install
npm run typecheck
npm test
npm pack --dry-run
```
