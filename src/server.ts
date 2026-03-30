import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getToolDefinitions, dispatchTool } from "./tools/registry.js";

export interface ComputerUseServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export async function createServer(): Promise<ComputerUseServer> {
  const server = new Server(
    { name: "windows-computer-use", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  const transport = new StdioServerTransport();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolDefinitions(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return dispatchTool(name, args ?? {});
  });

  return {
    async start() {
      await server.connect(transport);
      process.stderr.write("windows-computer-use MCP server running on stdio\n");
    },
    async stop() {
      await server.close();
    },
  };
}
