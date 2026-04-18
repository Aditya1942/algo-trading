import { Strategy } from "./base-strategy.ts";
import { getStrategy } from "./registry.ts";
import { CustomStrategyProxy } from "./custom-proxy.ts";
import { getCustom } from "./custom-db.ts";

const CUSTOM_PREFIX = "custom:";

export function isCustomName(name: string): boolean {
  return name.startsWith(CUSTOM_PREFIX);
}

export function parseCustomId(name: string): number | null {
  if (!isCustomName(name)) return null;
  const id = Number(name.slice(CUSTOM_PREFIX.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function resolveStrategy(name: string): Strategy {
  if (isCustomName(name)) {
    const id = parseCustomId(name);
    if (id === null) throw new Error(`Invalid custom strategy id in "${name}"`);
    const row = getCustom(id);
    if (!row) throw new Error(`Custom strategy id ${id} not found`);
    return new CustomStrategyProxy(row);
  }
  return getStrategy(name);
}
