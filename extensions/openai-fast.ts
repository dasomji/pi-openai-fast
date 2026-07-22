import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const FAST_STATUS_KEY = "pi-fast-mode";
export const FAST_STATUS_TEXT = "Fast";
export const FAST_SERVICE_TIER = "priority";
export const FAST_STATE_FILENAME = "openai-fast.json";

export const SUPPORTED_MODEL_KEYS = new Set([
  "openai/gpt-5.6-sol",
  "openai/gpt-5.6-terra",
  "openai/gpt-5.6-luna",
  "openai/gpt-5.5",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai-codex/gpt-5.6-sol",
  "openai-codex/gpt-5.6-terra",
  "openai-codex/gpt-5.6-luna",
  "openai-codex/gpt-5.5",
  "openai-codex/gpt-5.4",
  "openai-codex/gpt-5.4-mini",
]);

type ModelLike = {
  provider?: unknown;
  id?: unknown;
};

type RequestPayload = Record<string, unknown> & {
  model?: unknown;
  service_tier?: unknown;
};

type FastCommand = "toggle" | "on" | "off" | "status";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function modelKey(model: ModelLike | null | undefined): string | undefined {
  if (typeof model?.provider !== "string") return undefined;
  if (typeof model.id !== "string") return undefined;
  return `${model.provider}/${model.id}`;
}

export function isSupportedModel(model: ModelLike | null | undefined): boolean {
  const key = modelKey(model);
  return key !== undefined && SUPPORTED_MODEL_KEYS.has(key);
}

export function shouldApplyFastMode(
  model: ModelLike | null | undefined,
  payload: unknown,
): payload is RequestPayload {
  if (!isSupportedModel(model)) return false;
  if (!isRecord(payload)) return false;
  if ("service_tier" in payload) return false;
  return payload.model === model?.id;
}

export function withFastServiceTier(payload: RequestPayload): RequestPayload {
  return { ...payload, service_tier: FAST_SERVICE_TIER };
}

export function fastStatePath(): string {
  return join(getAgentDir(), FAST_STATE_FILENAME);
}

export async function loadFastMode(path = fastStatePath()): Promise<boolean> {
  try {
    const state: unknown = JSON.parse(await readFile(path, "utf8"));
    return isRecord(state) && state.enabled === true;
  } catch {
    return false;
  }
}

export async function saveFastMode(enabled: boolean, path = fastStatePath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temporaryPath, `${JSON.stringify({ enabled }, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function parseFastCommand(args: string): FastCommand | undefined {
  const value = args.trim().toLowerCase();
  if (value === "") return "toggle";
  if (value === "toggle") return "toggle";
  if (value === "on" || value === "enable" || value === "enabled") return "on";
  if (value === "off" || value === "disable" || value === "disabled") return "off";
  if (value === "status") return "status";
  return undefined;
}

function statusLine(enabled: boolean, model: ModelLike | null | undefined): string {
  if (enabled && isSupportedModel(model)) return "OpenAI Fast mode is on.";
  if (enabled) return "OpenAI Fast mode is on, but the current model is not supported.";
  return "OpenAI Fast mode is off.";
}

function updateStatus(ctx: ExtensionContext | ExtensionCommandContext, enabled: boolean): void {
  ctx.ui.setStatus(
    FAST_STATUS_KEY,
    enabled && isSupportedModel(ctx.model) ? FAST_STATUS_TEXT : undefined,
  );
}

export default async function openaiFastExtension(pi: ExtensionAPI) {
  let enabled = await loadFastMode();

  pi.on("session_start", (_event, ctx) => {
    updateStatus(ctx, enabled);
  });

  pi.on("model_select", (_event, ctx) => {
    updateStatus(ctx, enabled);
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!enabled) return undefined;
    if (!shouldApplyFastMode(ctx.model, event.payload)) return undefined;
    return withFastServiceTier(event.payload);
  });

  pi.registerCommand("fast", {
    description: "Toggle OpenAI Fast mode for supported OpenAI/Codex models",
    handler: async (args, ctx) => {
      const command = parseFastCommand(args);

      if (command === undefined) {
        ctx.ui.notify("Usage: /fast [on|off|toggle|status]", "warning");
        return;
      }

      if (command === "on") enabled = true;
      if (command === "off") enabled = false;
      if (command === "toggle") enabled = !enabled;

      updateStatus(ctx, enabled);

      if (command !== "status") {
        try {
          await saveFastMode(enabled);
        } catch {
          ctx.ui.notify(`${statusLine(enabled, ctx.model)} The setting could not be saved.`, "warning");
          return;
        }
      }

      ctx.ui.notify(statusLine(enabled, ctx.model), "info");
    },
  });
}
