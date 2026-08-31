/**
 * Environment configuration. Secrets are read from the process environment only
 * (Secret Manager injects them as env vars on Cloud Run) and are never bundled
 * into client code — nothing in this file is imported from a client component.
 */

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",

  // Auth
  sessionSecret: optional("SESSION_SECRET") ?? "dev-only-insecure-session-secret-change-me",
  googleClientId: optional("GOOGLE_CLIENT_ID"),

  // Firestore / Firebase
  gcpProjectId: optional("GOOGLE_CLOUD_PROJECT") ?? optional("GCLOUD_PROJECT"),
  firebaseServiceAccount: optional("FIREBASE_SERVICE_ACCOUNT_JSON"),
  useFirestore: optional("DATA_BACKEND") === "firestore",

  // Storage
  storageBucket: optional("EVIDENCE_BUCKET"),
  localDataDir: optional("LOCAL_DATA_DIR") ?? ".data",
  maxUploadBytes: Number(optional("MAX_UPLOAD_BYTES") ?? 10 * 1024 * 1024),

  // AI
  geminiApiKey: optional("GEMINI_API_KEY") ?? optional("GOOGLE_API_KEY"),
  geminiModelFast: optional("GEMINI_MODEL_FAST") ?? "gemini-2.5-flash",
  geminiModelDeep: optional("GEMINI_MODEL_DEEP") ?? "gemini-2.5-pro",
  useVertex: optional("GOOGLE_GENAI_USE_VERTEXAI") === "true",

  // Research
  searchApiKey: optional("SEARCH_API_KEY"),
  searchEngineId: optional("SEARCH_ENGINE_ID"),

  // Limits
  maxAgentIterations: Number(optional("MAX_AGENT_ITERATIONS") ?? 6),
  maxToolCalls: Number(optional("MAX_TOOL_CALLS") ?? 12),
  aiTimeoutMs: Number(optional("AI_TIMEOUT_MS") ?? 45_000),
} as const;

/** What the deployment can actually do right now. Surfaced to the UI so the
 *  product never implies a capability it does not have (§23, §51). */
export const capabilities = {
  ai: Boolean(config.geminiApiKey || config.useVertex),
  webResearch: Boolean(config.searchApiKey && config.searchEngineId),
  cloudStorage: Boolean(config.storageBucket),
  firestore: config.useFirestore,
  outboundEmail: false,
  phone: false,
  browserAutomation: false,
} as const;

export type Capabilities = typeof capabilities;
