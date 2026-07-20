import { Redis } from "ioredis";

import { createApp } from "./app.js";
import { RedisCartStore } from "./cart-store.js";

const port = Number(process.env.PORT ?? 8080);
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const app = createApp(new RedisCartStore(new Redis(redisUrl)));

app.listen(port, () => {
  console.log(`cart-service listening on ${port}`);
});
