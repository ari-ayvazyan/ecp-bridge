# ecp-bridge

MCP Server bridging external GitHub repositories as skills for the Model Context Protocol (MCP).

This tool allows you to use Claude marketplaces for skills in **ANY agent** (specifically Antigravity, OpenCode, etc.). Because the server fetches the repository on startup, your skills **AUTO-UPDATE** automatically whenever the GitHub repo updates!

*This tool was created as part of [ecp-skillman](https://ecp-skillman.itdo.at) to manage & modify skills from different repos and use them anywhere with auto-updates.*

## Usage

You can run the server directly via `npx`:

```sh
npx ecp-bridge <githubuser/repo | git url>
```

Example:

```sh
npx ecp-bridge ari-ayvazyan/AISkills
```

The server operates over standard input/output (stdio), which is compatible with most MCP clients.

### Private Repositories

To access private repositories, you don't need to configure a token inside the application. Instead, provide a full Git URL that includes your authentication method:

**Using a Personal Access Token (HTTPS):**

```sh
npx ecp-bridge https://<YOUR_TOKEN>@github.com/someone/their-private-skills.git
```

**Using SSH (Requires local SSH keys to be configured):**

```sh
npx ecp-bridge git@github.com:someone/their-private-skills.git
```

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
