import type IORedis from "ioredis";

export class CircuitOpenError extends Error {
  public readonly serviceName: string;

  constructor(name: string) {
    super(`Circuit breaker "${name}" is OPEN — service unavailable`);
    this.name = "CircuitOpenError";
    this.serviceName = name;
  }
}

interface CircuitState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failures: number;
  lastFailure: number; // epoch ms
}

export interface CircuitBreakerOptions {
  name: string;
  threshold: number;
  resetTimeMs: number;
  redis: IORedis;
}

const DEFAULT_STATE: CircuitState = {
  state: "CLOSED",
  failures: 0,
  lastFailure: 0,
};

export class CircuitBreaker {
  private readonly key: string;
  private readonly name: string;
  private readonly threshold: number;
  private readonly resetTimeMs: number;
  private readonly redis: IORedis;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.key = `circuit:${opts.name}`;
    this.threshold = opts.threshold;
    this.resetTimeMs = opts.resetTimeMs;
    this.redis = opts.redis;
  }

  private async getState(): Promise<CircuitState> {
    const raw = await this.redis.get(this.key);
    if (!raw) return { ...DEFAULT_STATE };
    try {
      return JSON.parse(raw) as CircuitState;
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  private async setState(cs: CircuitState): Promise<void> {
    // TTL = 2× resetTime so stale keys don't linger forever
    const ttlSeconds = Math.max(
      Math.ceil((this.resetTimeMs * 2) / 1000),
      120,
    );
    await this.redis.set(this.key, JSON.stringify(cs), "EX", ttlSeconds);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const cs = await this.getState();

    if (cs.state === "OPEN") {
      const elapsed = Date.now() - cs.lastFailure;
      if (elapsed > this.resetTimeMs) {
        return this.tryHalfOpen(fn);
      }
      throw new CircuitOpenError(this.name);
    }

    if (cs.state === "HALF_OPEN") {
      return this.tryHalfOpen(fn);
    }

    // CLOSED — normal execution
    try {
      const result = await fn();
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  private async tryHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    console.log(`Circuit "${this.name}" attempting HALF_OPEN probe`);
    await this.setState({
      state: "HALF_OPEN",
      failures: 0,
      lastFailure: Date.now(),
    });

    try {
      const result = await fn();
      await this.recordSuccess();
      console.log(`Circuit "${this.name}" recovered → CLOSED`);
      return result;
    } catch (error) {
      // Probe failed — back to OPEN
      await this.setState({
        state: "OPEN",
        failures: this.threshold,
        lastFailure: Date.now(),
      });
      console.warn(`Circuit "${this.name}" probe failed → OPEN`);
      throw error;
    }
  }

  private async recordSuccess(): Promise<void> {
    await this.setState({ ...DEFAULT_STATE });
  }

  private async recordFailure(): Promise<void> {
    const cs = await this.getState();
    const failures = cs.failures + 1;

    if (failures >= this.threshold) {
      console.warn(
        `Circuit "${this.name}" tripped OPEN after ${failures} failures`,
      );
      await this.setState({
        state: "OPEN",
        failures,
        lastFailure: Date.now(),
      });
    } else {
      await this.setState({
        state: "CLOSED",
        failures,
        lastFailure: Date.now(),
      });
    }
  }
}
