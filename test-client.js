import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function run() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js", "ari-ayvazyan/AISkills"],
  });

  const client = new Client({ name: "test-client", version: "1.0.0" }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log("Connected");

  const prompts = await client.listPrompts();
  console.log("Prompts:", JSON.stringify(prompts, null, 2));

  if (prompts.prompts.length > 0) {
    const promptName = prompts.prompts[0].name;
    const promptDetails = await client.getPrompt({ name: promptName });
    console.log(`Prompt details for ${promptName}:`, JSON.stringify(promptDetails, null, 2));
  }

  const tools = await client.listTools();
  console.log("Tools:", JSON.stringify(tools, null, 2));

  process.exit(0);
}

run().catch(console.error);
