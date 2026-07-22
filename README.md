# ecp-bridge

MCP Server bridging external GitHub repositories as skills for the Model Context Protocol (MCP).

This tool allows you to use Claude marketplaces for skills in **ANY agent** (specifically Antigravity, OpenCode, etc.). Because the server fetches the repository on startup, your skills **AUTO-UPDATE** automatically whenever the GitHub repo updates!

*This tool was created as part of [ecp-skillman](https://ecp-skillman.itdo.at) to manage & modify skills from different repos and use them anywhere with auto-updates.*

## Usage

You can run the server directly via `npx`:

```sh
npx ecp-bridge <githubuser/repo | git url> [plugin1,plugin2,...]
```

Example:

```sh
npx ecp-bridge ari-ayvazyan/AISkills ecp-code-agent-skills
```

The server operates over standard input/output (stdio), which is compatible with most MCP clients.

### Private Repository Marketplaces

To access private repository marketplaces, you don't need to configure a token inside the application. Instead, provide a full Git URL that includes your authentication method:

**Using a Personal Access Token (HTTPS):**

```sh
npx ecp-bridge https://<YOUR_TOKEN>@github.com/someone/their-private-skills.git
```

**Using SSH (Requires local SSH keys to be configured):**

```sh
npx ecp-bridge git@github.com:someone/their-private-skills.git
```

## MCP Client Configuration

To use `ecp-bridge` in an MCP client (such as Claude Desktop or other compatible clients), add the following to your MCP configuration file:

```json
{
  "mcpServers": {
    "ecp-bridge": {
      "command": "npx",
      "args": [
        "-y",
        "ecp-bridge",
        "ari-ayvazyan/AISkills",
        "ecp-code-agent-skills"
      ]
    }
  }
}
```

Replace `ari-ayvazyan/AISkills` with your desired GitHub repository or Git URL. You can optionally add a comma-separated list of plugins as the last argument to load only specific skills. If this argument is omitted, the server will assume that all plugins should be served and will load all skills by default.

## Development

Install dependencies:

```sh
npm install
```

Build the server:

```sh
npm run build
```

Start the server locally:

```sh
npm run start <githubuser/repo>
```

## License

MIT
