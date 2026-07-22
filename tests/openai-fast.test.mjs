import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import openaiFastExtension, {
  FAST_SERVICE_TIER,
  FAST_STATUS_KEY,
  FAST_STATUS_TEXT,
  isSupportedModel,
  parseFastCommand,
  shouldApplyFastMode,
  withFastServiceTier,
} from "/tmp/pi-openai-fast-test/extensions/openai-fast.js";

const supported = { provider: "openai-codex", id: "gpt-5.5" };
const currentModel = { provider: "openai-codex", id: "gpt-5.6-sol" };
const unsupported = { provider: "openai-codex", id: "gpt-4.1" };
const gpt56Models = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

assert.equal(isSupportedModel(supported), true);
for (const provider of ["openai", "openai-codex"]) {
  for (const id of gpt56Models) {
    assert.equal(
      isSupportedModel({ provider, id }),
      true,
      `${provider}/${id} should support Fast mode`,
    );
  }
}
assert.equal(isSupportedModel(unsupported), false);

assert.equal(shouldApplyFastMode(supported, { model: "gpt-5.5" }), true);
assert.equal(shouldApplyFastMode(currentModel, { model: "gpt-5.6-sol" }), true);
assert.equal(shouldApplyFastMode(supported, { model: "gpt-5.4" }), false);
assert.equal(shouldApplyFastMode(supported, { model: "gpt-5.5", service_tier: "default" }), false);
assert.equal(shouldApplyFastMode(unsupported, { model: "gpt-4.1" }), false);
assert.equal(shouldApplyFastMode(supported, null), false);
assert.equal(shouldApplyFastMode(supported, []), false);

const original = { model: "gpt-5.5", input: [] };
const patched = withFastServiceTier(original);
assert.deepEqual(patched, {
  model: "gpt-5.5",
  input: [],
  service_tier: FAST_SERVICE_TIER,
});
assert.equal(Object.hasOwn(original, "service_tier"), false);

assert.equal(parseFastCommand(""), "toggle");
assert.equal(parseFastCommand("toggle"), "toggle");
assert.equal(parseFastCommand("on"), "on");
assert.equal(parseFastCommand("enable"), "on");
assert.equal(parseFastCommand("off"), "off");
assert.equal(parseFastCommand("disable"), "off");
assert.equal(parseFastCommand("status"), "status");
assert.equal(parseFastCommand("wat"), undefined);

async function registerExtension() {
  const handlers = new Map();
  const commands = new Map();
  await openaiFastExtension({
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    registerCommand(name, command) {
      commands.set(name, command);
    },
  });
  return { handlers, commands };
}

function createContext() {
  const statuses = [];
  const notifications = [];
  return {
    statuses,
    notifications,
    ctx: {
      model: currentModel,
      ui: {
        setStatus(key, value) {
          statuses.push([key, value]);
        },
        notify(message, level) {
          notifications.push([message, level]);
        },
      },
    },
  };
}

const stateDir = mkdtempSync(join(tmpdir(), "pi-openai-fast-test-"));
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = stateDir;

try {
  const first = await registerExtension();
  const firstContext = createContext();
  await first.commands.get("fast").handler("on", firstContext.ctx);
  assert.deepEqual(firstContext.statuses.at(-1), [FAST_STATUS_KEY, FAST_STATUS_TEXT]);
  assert.deepEqual(firstContext.notifications.at(-1), ["OpenAI Fast mode is on.", "info"]);
  assert.deepEqual(
    first.handlers.get("before_provider_request")(
      { payload: { model: "gpt-5.6-sol", input: [] } },
      firstContext.ctx,
    ),
    { model: "gpt-5.6-sol", input: [], service_tier: FAST_SERVICE_TIER },
  );

  const reloaded = await registerExtension();
  const reloadedContext = createContext();
  reloaded.handlers.get("session_start")({}, reloadedContext.ctx);
  assert.deepEqual(
    reloadedContext.statuses.at(-1),
    [FAST_STATUS_KEY, FAST_STATUS_TEXT],
    "a new extension instance should restore the last Fast-mode setting",
  );
  assert.deepEqual(
    reloaded.handlers.get("before_provider_request")(
      { payload: { model: "gpt-5.6-sol", input: [] } },
      reloadedContext.ctx,
    ),
    { model: "gpt-5.6-sol", input: [], service_tier: FAST_SERVICE_TIER },
  );

  await reloaded.commands.get("fast").handler("off", reloadedContext.ctx);
  const disabled = await registerExtension();
  const disabledContext = createContext();
  disabled.handlers.get("session_start")({}, disabledContext.ctx);
  assert.deepEqual(
    disabledContext.statuses.at(-1),
    [FAST_STATUS_KEY, undefined],
    "turning Fast mode off should also persist across extension instances",
  );
  assert.equal(
    disabled.handlers.get("before_provider_request")(
      { payload: { model: "gpt-5.6-sol", input: [] } },
      disabledContext.ctx,
    ),
    undefined,
  );
} finally {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  rmSync(stateDir, { recursive: true, force: true });
}

console.log("openai-fast tests passed");
