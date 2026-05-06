import { AI_MODEL, GROQ_TOKEN } from '../config/env';

const DEFAULT_MODEL = AI_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const STRUCTURED_CACHE_TTL_MS = 10 * 60 * 1000;

type GroqModel = {
  id: string;
  active?: boolean;
};

type GroqModelsResponse = {
  data?: GroqModel[];
};

type StructuredCache = {
  models: string[];
  expiresAt: number;
};

export const createModelConfigService = () => {
  let currentModel = DEFAULT_MODEL;
  let structuredCache: StructuredCache | null = null;
  const supportCache = new Map<string, boolean>();

  const assertToken = () => {
    if (!GROQ_TOKEN) {
      throw new Error('Missing GROQ_TOKEN in environment variables.');
    }
  };

  const listAvailableModels = async (): Promise<string[]> => {
    assertToken();

    const res = await fetch(GROQ_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${GROQ_TOKEN}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to fetch models: ${res.status} ${body}`);
    }

    const payload = (await res.json()) as GroqModelsResponse;
    const ids = (payload.data ?? [])
      .filter((m) => m.active !== false)
      .map((m) => m.id)
      .filter(Boolean);

    return ids.sort((a, b) => a.localeCompare(b));
  };

  const supportsStructuredOutput = async (modelId: string) => {
    if (supportCache.has(modelId)) {
      return supportCache.get(modelId)!;
    }

    assertToken();

    const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Return a tiny json object.' }],
        max_tokens: 16,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'tiny_object',
            schema: {
              type: 'object',
              properties: {
                ok: { type: 'boolean' },
              },
              required: ['ok'],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (res.ok) {
      supportCache.set(modelId, true);
      return true;
    }

    const body = await res.text();
    const unsupported =
      body.includes('does not support response format `json_schema`') ||
      body.includes('structured outputs');

    if (unsupported) {
      supportCache.set(modelId, false);
      return false;
    }

    // Any other API error means model may still support structured output.
    // Be permissive so we don't hide models due to transient failures.
    supportCache.set(modelId, true);
    return true;
  };

  const listStructuredOutputModels = async (
    forceRefresh = false
  ): Promise<string[]> => {
    const now = Date.now();
    if (
      !forceRefresh &&
      structuredCache &&
      structuredCache.expiresAt > now
    ) {
      return structuredCache.models;
    }

    const models = await listAvailableModels();
    const structured: string[] = [];

    for (const id of models) {
      // Keep sequential to avoid rate-limits.
      const supported = await supportsStructuredOutput(id);
      if (supported) structured.push(id);
    }

    const sorted = structured.sort((a, b) => a.localeCompare(b));
    structuredCache = {
      models: sorted,
      expiresAt: now + STRUCTURED_CACHE_TTL_MS,
    };

    return sorted;
  };

  const setCurrentModel = async (modelId: string) => {
    const id = modelId.trim();
    if (!id) throw new Error('Model id cannot be empty.');

    const models = await listStructuredOutputModels();
    if (!models.includes(id)) {
      return {
        ok: false as const,
        currentModel,
        availableModels: models,
      };
    }

    currentModel = id;
    return {
      ok: true as const,
      currentModel,
      availableModels: models,
    };
  };

  return {
    getCurrentModel: () => currentModel,
    setCurrentModel,
    listAvailableModels,
    listStructuredOutputModels,
  };
};

export type ModelConfigService = ReturnType<typeof createModelConfigService>;
