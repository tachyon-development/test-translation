import IORedis from "ioredis";

const redisOpts = {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  reconnectOnError: () => true,
  enableReadyCheck: true,
};

// Main connection for general use (queues, publishing)
export const redis = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  redisOpts,
);

// Dedicated subscriber (Redis requires separate connection for pub/sub)
export const redisSub = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  redisOpts,
);

redis.on("error", (err) => console.error("Redis main error:", err.message));
redisSub.on("error", (err) => console.error("Redis sub error:", err.message));

// Prevent unhandled Redis errors from crashing the process
process.on("uncaughtException", (err) => {
  if (err.message?.includes("Connection is closed") || err.message?.includes("ECONNREFUSED")) {
    console.error("Redis connection error (suppressed crash):", err.message);
    return;
  }
  console.error("Uncaught exception:", err);
  process.exit(1);
});
