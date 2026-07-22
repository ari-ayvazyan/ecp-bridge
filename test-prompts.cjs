const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

async function checkServer(name, command, args) {
  console.log(`\n--- Checking ${name} ---`);
  const transport = new StdioClientTransport({ command, args });
  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: { prompts: {} } });
  
  try {
    await client.connect(transport);
    const prompts = await client.listPrompts();
    console.log(`${name} Prompts:`, JSON.stringify(prompts, null, 2));
  } catch (err) {
    console.error(`Error querying ${name}:`, err.message);
  } finally {
    try { await client.close(); } catch (e) {}
  }
}

async function main() {
  await checkServer("GitKraken", "c:\\Users\\AriAy\\AppData\\Local\\GitKrakenCLI\\gk.exe", ["mcp", "--host=antigravity", "--source=gitlens", "--scheme=antigravity"]);
  await checkServer("ecp-bridge", "node", ["dist/index.js", "ari-ayvazyan/AISkills"]);
}

main();
