// Deprecated: model picker and per-chat model config removed.
export const createModelConfigService = () => {
  throw new Error('Model config service has been removed.');
};

export type ModelConfigService = ReturnType<typeof createModelConfigService>;
