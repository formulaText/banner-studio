import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gateConfig, gateKey, gatePassed, logout, unlock } from "../src/gate";

describe("public demo gate", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("accepts ba7demo and retains the session until logout and re-login", async () => {
    expect(gatePassed()).toBe(false);
    expect(await unlock("ba7demo")).toBe(true);
    expect(sessionStorage.getItem(gateKey)).toBe(gateConfig.digest);
    expect(gatePassed()).toBe(true);
    logout();
    expect(sessionStorage.getItem(gateKey)).toBeNull();
    expect(gatePassed()).toBe(false);
    expect(await unlock("ba7demo")).toBe(true);
    expect(gatePassed()).toBe(true);
  });

  it.each(["banner-demo", "wrong", ""])(
    "rejects %j without granting a session",
    async (value) => {
      expect(await unlock(value)).toBe(false);
      expect(sessionStorage.getItem(gateKey)).toBeNull();
      expect(gatePassed()).toBe(false);
    },
  );

  it("rejects a session saved with the previous phrase hash", async () => {
    sessionStorage.setItem(
      gateKey,
      "0e6edc8b65be8a17d8d3bebce0ff4a891b7628fed6ee15a43c59dd205c360193",
    );
    expect(gatePassed()).toBe(false);
    expect(await unlock("banner-demo")).toBe(false);
    expect(gatePassed()).toBe(false);
    expect(await unlock("ba7demo")).toBe(true);
    expect(gatePassed()).toBe(true);
  });
});
