import type { AiConfigProvider } from "@/lib/api";

// Models worth one click, per provider. Any other model id can still be typed. The effort levels each model accepts are read
// from OpenRouter's model list by the API, not listed here.
export const MODEL_QUICK_PICKS: Record<AiConfigProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  ],
  openai_compatible: [
    { id: "z-ai/glm-5.3-flash", label: "GLM 5.3 Flash" },
    { id: "z-ai/glm-5.3-flashx", label: "GLM 5.3 Flash X" },
    { id: "z-ai/glm-5.3", label: "GLM 5.3" },
    { id: "z-ai/glm-5.3-prime", label: "GLM 5.3 Prime" },
  ],
};

export function modelLabel(provider: AiConfigProvider, id: string): string {
  return MODEL_QUICK_PICKS[provider].find((pick) => pick.id === id)?.label ?? id;
}

// A model id as providers spell it: letters, digits and . _ : / - (the API checks the same rule).
export const MODEL_ID_PATTERN = /^[A-Za-z0-9._:/-]{1,128}$/;
