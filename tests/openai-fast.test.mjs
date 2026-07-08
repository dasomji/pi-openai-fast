import assert from "node:assert/strict";
import {
  FAST_SERVICE_TIER,
  isSupportedModel,
  parseFastCommand,
  shouldApplyFastMode,
  withFastServiceTier,
} from "/tmp/pi-openai-fast-test/extensions/openai-fast.js";

const supported = { provider: "openai-codex", id: "gpt-5.5" };
const unsupported = { provider: "openai-codex", id: "gpt-4.1" };

assert.equal(isSupportedModel(supported), true);
assert.equal(isSupportedModel(unsupported), false);

assert.equal(shouldApplyFastMode(supported, { model: "gpt-5.5" }), true);
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

console.log("openai-fast helper tests passed");
