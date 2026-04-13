import { Strategy } from "./base-strategy.ts";
import { SmaCrossoverStrategy } from "./strategies/sma-crossover.ts";
import { RsiMacdStrategy } from "./strategies/rsi-macd.ts";
import { BollingerVolumeStrategy } from "./strategies/bollinger-volume.ts";

const strategies = new Map<string, new () => Strategy>();

export function registerStrategy(cls: new () => Strategy): void {
  const instance = new cls();
  strategies.set(instance.name, cls);
}

export function getStrategy(name: string): Strategy {
  const Cls = strategies.get(name);
  if (!Cls) {
    throw new Error(
      `Strategy "${name}" not found. Available: ${[...strategies.keys()].join(", ")}`
    );
  }
  return new Cls();
}

export function listStrategies(): {
  name: string;
  description: string;
  defaultParams: Record<string, number>;
}[] {
  return [...strategies.values()].map((Cls) => {
    const instance = new Cls();
    return {
      name: instance.name,
      description: instance.description,
      defaultParams: instance.defaultParams,
    };
  });
}

// Auto-register all built-in strategies
registerStrategy(SmaCrossoverStrategy);
registerStrategy(RsiMacdStrategy);
registerStrategy(BollingerVolumeStrategy);
