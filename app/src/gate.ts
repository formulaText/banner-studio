import { sha256 } from "./storage";
// Public demo only. A client-only hash does not provide authentication.
export const gateConfig = {
  enabled: import.meta.env.VITE_GATE_ENABLED !== "false",
  digest:
    import.meta.env.VITE_GATE_SHA256 ||
    "141328dc7f8cadee4e30d0f747725219aaac9e6a9dd67abc665d4a106ba3dfbf",
};
export const gateKey = "banner-studio-gate";
export function gatePassed() {
  try {
    return (
      !gateConfig.enabled ||
      sessionStorage.getItem(gateKey) === gateConfig.digest
    );
  } catch {
    return !gateConfig.enabled;
  }
}
export async function unlock(value: string) {
  const valid =
    (await sha256(new TextEncoder().encode(value))) === gateConfig.digest;
  if (valid)
    try {
      sessionStorage.setItem(gateKey, gateConfig.digest);
    } catch {
      /* Session storage unavailable: current tab only. */
    }
  return valid;
}
export function logout() {
  try {
    sessionStorage.removeItem(gateKey);
  } catch {
    /* current UI still resets */
  }
}
