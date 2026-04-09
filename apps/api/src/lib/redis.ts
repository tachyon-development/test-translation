import IORedis from "ioredis";

// Main connection for general use (queues, publishing)
export const redis = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

// Dedicated subscriber (Redis requires separate connection for pub/sub)
export const redisSub = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

redis.on("error", (err) => console.error("Redis main error:", err));
redisSub.on("error", (err) => console.error("Redis sub error:", err));
