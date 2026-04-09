import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisOpts: import("ioredis").RedisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 500, 10000),
  reconnectOnError: () => true,
  enableReadyCheck: true,
  lazyConnect: false,
  connectTimeout: 10000,
};

// Main connection for general use (queues, publishing)
export const redis = new IORedis(redisUrl, redisOpts);

// Dedicated subscriber (Redis requires separate connection for pub/sub)
export const redisSub = new IORedis(redisUrl, redisOpts);

redis.on("error", (err) => console.error("Redis main:", err.message));
redisSub.on("error", (err) => console.error("Redis sub:", err.message));

// Safe Redis operations that don't crash on failure
export async function redisGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) {
      await redis.set(key, value, "EX", ttlSeconds);
    } else {
      await redis.set(key, value);
    }
  } catch {
    // Silently fail — cache miss is OK
  }
}

export async function redisPublish(channel: string, message: string): Promise<void> {
  try {
    await redis.publish(channel, message);
  } catch {
    console.error(`Failed to publish to ${channel}`);
  }
}

// Prevent unhandled Redis errors from crashing the process
process.on("uncaughtException", (err) => {
  const msg = err?.message || "";
  if (msg.includes("Connection is closed") || msg.includes("ECONNREFUSED") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT")) {
    // Suppress Redis connection errors — they auto-reconnect
    return;
  }
  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const msg = String(reason);
  if (msg.includes("Connection is closed") || msg.includes("ECONNREFUSED")) {
    return;
  }
  console.error("Unhandled rejection:", reason);
});
