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

  try {
    const resources = await client.listResources();
    console.log("Resources:", JSON.stringify(resources, null, 2));

    if (resources.resources.length > 0) {
      const resourceUri = resources.resources[0].uri;
      const resourceDetails = await client.readResource({ uri: resourceUri });
      console.log(`Resource details for ${resourceUri}:`, JSON.stringify(resourceDetails, null, 2));
    }
  } catch (error) {
    console.error("Error fetching resources:", error);
  }

  process.exit(0);
}

run().catch(console.error);
