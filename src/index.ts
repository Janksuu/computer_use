#!/usr/bin/env node
import { createServer } from "./server.js";

const main = async (): Promise<void> => {
  const server = await createServer();
  await server.start();

  const handleShutdown = async (signal: string) => {
    process.stderr.write(`Received ${signal}, shutting down...\n`);
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
};

main().catch((error) => {
  process.stderr.write(`Fatal: ${error}\n`);
  process.exit(1);
});
