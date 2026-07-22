# ecp-bridge

MCP Server bridging external GitHub repositories as skills for Model Context Protocol (MCP).

This server allows you to load skills defined in a GitHub repository using the standard Claude marketplace format or standard `SKILL.md` structures, exposing them as resources to your MCP client.

## Usage

You can run the server directly via `npx`:

```sh
npx ecp-bridge <githubuser/repo | git url>
```

Example:

```sh
npx ecp-bridge someone/their-mcp-skills
```

The server operates over standard input/output (stdio), which is compatible with most MCP clients.

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
