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

Fast mode is off until first enabled. The most recent on/off setting is saved globally and restored for new, resumed, and reloaded sessions in every project. By default, it is stored at `~/.pi/agent/openai-fast.json`.

When Fast mode is on and the current model is supported, the extension publishes the footer status key `pi-fast-mode` with the text `Fast`.

## Supported models

- `openai/gpt-5.6-sol`
- `openai/gpt-5.6-terra`
- `openai/gpt-5.6-luna`
- `openai/gpt-5.5`
- `openai/gpt-5.4`
- `openai/gpt-5.4-mini`
- `openai-codex/gpt-5.6-sol`
- `openai-codex/gpt-5.6-terra`
- `openai-codex/gpt-5.6-luna`
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

There are no runtime dependencies, provider registrations, or auth storage integrations. The extension only stores the global Fast-mode preference in Pi's agent configuration directory.

## Development

```bash
npm install
npm run typecheck
npm test
npm pack --dry-run
```
