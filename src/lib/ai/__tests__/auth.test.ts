import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY_HEADER, PROVIDER_HEADER, envSource, readAiAuth, resolveAi, serverKeyAllowed } from "../auth";

const KEY = "sk-test-abcdefghijklmnopqrstuvwxyz0123456789";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/generate", { method: "POST", headers });
}

afterEach(() => vi.unstubAllEnvs());

describe("readAiAuth", () => {
  it("reads a provider and key", () => {
    const auth = readAiAuth(new Headers({ [KEY_HEADER]: KEY, [PROVIDER_HEADER]: "OpenAI" }));
    expect(auth).toEqual({ provider: "openai", apiKey: KEY });
  });

  it("ignores a missing key, an unknown provider and malformed keys", () => {
    expect(readAiAuth(new Headers())).toBeUndefined();
    expect(readAiAuth(new Headers({ [KEY_HEADER]: KEY, [PROVIDER_HEADER]: "gemini" }))).toBeUndefined();
    expect(readAiAuth(new Headers({ [KEY_HEADER]: "short", [PROVIDER_HEADER]: "openai" }))).toBeUndefined();
    expect(readAiAuth(new Headers({ [KEY_HEADER]: `${KEY} extra`, [PROVIDER_HEADER]: "openai" }))).toBeUndefined();
    expect(readAiAuth(new Headers({ [KEY_HEADER]: "a".repeat(401), [PROVIDER_HEADER]: "anthropic" }))).toBeUndefined();
  });
});

describe("serverKeyAllowed", () => {
  it("is allowed in development and refused in production by default", () => {
    vi.stubEnv("AI_ALLOW_SERVER_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(serverKeyAllowed()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(serverKeyAllowed()).toBe(false);
  });

  it("AI_ALLOW_SERVER_KEY overrides the default either way", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOW_SERVER_KEY", "true");
    expect(serverKeyAllowed()).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_ALLOW_SERVER_KEY", "false");
    expect(serverKeyAllowed()).toBe(false);
  });
});

describe("resolveAi", () => {
  it("prefers the visitor's key, and labels the source by provider", () => {
    vi.stubEnv("NODE_ENV", "production");
    const openai = resolveAi(req({ [KEY_HEADER]: KEY, [PROVIDER_HEADER]: "openai" }));
    expect(openai).toEqual({ source: "openai", auth: { provider: "openai", apiKey: KEY } });
    expect(resolveAi(req({ [KEY_HEADER]: KEY, [PROVIDER_HEADER]: "anthropic" })).source).toBe("claude");
  });

  it("never uses the server key in production unless allowed", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOW_SERVER_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", KEY);
    expect(resolveAi(req())).toEqual({ source: "mock" });
    vi.stubEnv("AI_ALLOW_SERVER_KEY", "true");
    expect(resolveAi(req())).toEqual({ source: "openai" });
  });

  it("falls back to the offline mock when nothing is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(envSource()).toBe("mock");
    expect(resolveAi(req())).toEqual({ source: "mock" });
  });

  it("AI_PROVIDER picks between two server keys, Anthropic first by default", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPENAI_API_KEY", KEY);
    vi.stubEnv("ANTHROPIC_API_KEY", KEY);
    vi.stubEnv("AI_PROVIDER", "");
    expect(envSource()).toBe("claude");
    vi.stubEnv("AI_PROVIDER", "openai");
    expect(envSource()).toBe("openai");
  });
});
