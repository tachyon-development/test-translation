import { describe, test, expect, beforeEach } from "bun:test";
import { CircuitBreaker, CircuitOpenError } from "../lib/circuitBreaker";

/**
 * In-memory mock of the subset of IORedis used by CircuitBreaker.
 */
function createMockRedis() {
  const store = new Map<string, { value: string; expireAt?: number }>();
  return {
    get: async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expireAt && Date.now() > entry.expireAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set: async (key: string, value: string, _ex?: string, ttl?: number) => {
      store.set(key, {
        value,
        expireAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
      return "OK";
    },
    _store: store,
  } as any; // typed as any to satisfy IORedis interface
}

describe("Circuit Breaker", () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
  });

  function makeBreaker(opts?: Partial<{ threshold: number; resetTimeMs: number }>) {
    return new CircuitBreaker({
      name: "test-service",
      threshold: opts?.threshold ?? 3,
      resetTimeMs: opts?.resetTimeMs ?? 1000,
      redis,
    });
  }

  test("executes function when closed", async () => {
    const cb = makeBreaker();
    const result = await cb.execute(async () => "hello");
    expect(result).toBe("hello");
  });

  test("passes through successful results", async () => {
    const cb = makeBreaker();
    const result = await cb.execute(async () => ({ status: 200, data: [1, 2, 3] }));
    expect(result.status).toBe(200);
    expect(result.data).toEqual([1, 2, 3]);
  });

  test("propagates errors from the wrapped function", async () => {
    const cb = makeBreaker({ threshold: 5 });
    expect(
      cb.execute(async () => {
        throw new Error("service down");
      }),
    ).rejects.toThrow("service down");
  });

  test("opens after threshold failures", async () => {
    const cb = makeBreaker({ threshold: 3 });

    // Cause 3 failures
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(async () => {
          throw new Error("fail");
        });
      } catch {
        // expected
      }
    }

    // 4th call should get CircuitOpenError
    try {
      await cb.execute(async () => "should not run");
      throw new Error("Expected CircuitOpenError");
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitOpenError);
      expect((err as CircuitOpenError).serviceName).toBe("test-service");
    }
  });

  test("rejects immediately when OPEN", async () => {
    const cb = makeBreaker({ threshold: 2, resetTimeMs: 60000 });

    // Trip the breaker
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(async () => {
          throw new Error("fail");
        });
      } catch {
        // expected
      }
    }

    // Should reject without calling fn
    let fnCalled = false;
    try {
      await cb.execute(async () => {
        fnCalled = true;
        return "nope";
      });
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitOpenError);
    }
    expect(fnCalled).toBe(false);
  });

  test("transitions to HALF_OPEN after reset timeout", async () => {
    const cb = makeBreaker({ threshold: 2, resetTimeMs: 50 });

    // Trip the breaker
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(async () => {
          throw new Error("fail");
        });
      } catch {
        // expected
      }
    }

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 80));

    // Should try HALF_OPEN and succeed
    const result = await cb.execute(async () => "recovered");
    expect(result).toBe("recovered");
  });

  test("closes again on successful HALF_OPEN request", async () => {
    const cb = makeBreaker({ threshold: 2, resetTimeMs: 50 });

    // Trip
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(async () => {
          throw new Error("fail");
        });
      } catch {}
    }

    await new Promise((r) => setTimeout(r, 80));

    // Recover
    await cb.execute(async () => "ok");

    // Should be CLOSED now — next call should work without waiting
    const result = await cb.execute(async () => "working");
    expect(result).toBe("working");
  });

  test("reopens on failed HALF_OPEN request", async () => {
    const cb = makeBreaker({ threshold: 2, resetTimeMs: 50 });

    // Trip
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(async () => {
          throw new Error("fail");
        });
      } catch {}
    }

    await new Promise((r) => setTimeout(r, 80));

    // HALF_OPEN probe fails
    try {
      await cb.execute(async () => {
        throw new Error("still down");
      });
    } catch {}

    // Should be OPEN again
    try {
      await cb.execute(async () => "nope");
      throw new Error("Expected CircuitOpenError");
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitOpenError);
    }
  });

  test("stays closed under threshold failures", async () => {
    const cb = makeBreaker({ threshold: 3 });

    // 2 failures (under threshold of 3)
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(async () => {
          throw new Error("fail");
        });
      } catch {}
    }

    // Should still be closed
    const result = await cb.execute(async () => "still open");
    expect(result).toBe("still open");
  });
});
