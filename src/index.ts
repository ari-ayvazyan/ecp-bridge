#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import simpleGit from "simple-git";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import * as yaml from "yaml";

interface Skill {
  name: string;
  description: string;
  content: string;
}

const server = new Server(
  {
    name: "ecp-bridge",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
    },
  }
);

let loadedSkills: Skill[] = [];

async function parseRepo(repoUrl: string) {
  // Convert githubuser/repo to full URL if necessary
  if (!repoUrl.startsWith("http") && !repoUrl.startsWith("git@")) {
    repoUrl = `https://github.com/${repoUrl}.git`;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-skill-server-"));

  try {
    console.error(`Cloning repository ${repoUrl} to ${tempDir}...`);
    const git = simpleGit();
    await git.clone(repoUrl, tempDir, ["--depth", "1"]);

    const marketplacePath = path.join(tempDir, ".claude-plugin", "marketplace.json");
    let marketplace: any = { plugins: [] };

    try {
      const marketplaceContent = await fs.readFile(marketplacePath, "utf-8");
      marketplace = JSON.parse(marketplaceContent);
      console.error(`Found marketplace.json with ${marketplace.plugins?.length || 0} plugins.`);
    } catch (err) {
      console.error(`Could not read .claude-plugin/marketplace.json, proceeding to search for skills manually.`);
      // If there's no marketplace.json, we could just search the entire repo for SKILL.md
      // but the instructions imply "claude marketplace format" so let's stick to the structure
    }

    const skills: Skill[] = [];

    // Process each plugin defined in marketplace.json
    if (marketplace.plugins && Array.isArray(marketplace.plugins)) {
      for (const plugin of marketplace.plugins) {
        const sourcePath = plugin.source || "";
        const skillsDir = path.join(tempDir, sourcePath, "skills");

        try {
          const entries = await fs.readdir(skillsDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
              try {
                const content = await fs.readFile(skillMdPath, "utf-8");
                skills.push(parseSkillMd(content));
              } catch (err) {
                // No SKILL.md in this directory, skip
              }
            }
          }
        } catch (err) {
          console.error(`Could not read skills directory: ${skillsDir}`);
        }
      }
    } else {
      console.error(`No plugins array found in marketplace.json. Expected standard Claude marketplace format.`);
    }

    loadedSkills = skills;
    console.error(`Successfully loaded ${skills.length} skills.`);

  } finally {
    // We keep the temp dir or clean it up? Better clean it up to avoid disk space leaks.
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to cleanup temp dir ${tempDir}`);
    }
  }
}

function parseSkillMd(content: string): Skill {
  // Typical frontmatter:
  // ---
  // name: my-skill
  // description: A description
  // ---
  // content...

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    const [, frontmatterStr, body] = match;
    try {
      const frontmatter = yaml.parse(frontmatterStr);
      return {
        name: frontmatter.name || "unknown-skill",
        description: frontmatter.description || "",
        content: content.trim(), // Include the whole thing or just body? Usually the whole thing provides context, but maybe just body.
        // Wait, standard practice is to include frontmatter so the model knows the name/description if it reads it as raw text.
        // But body alone might be cleaner. Let's include the whole thing.
      };
    } catch (e) {
      console.error("Failed to parse YAML frontmatter:", e);
    }
  }

  // Fallback if no frontmatter
  return {
    name: "unnamed-skill-" + Math.random().toString(36).substring(7),
    description: "A skill without metadata",
    content: content.trim(),
  };
}



server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: loadedSkills.map(skill => ({
      uri: `skill://${skill.name}`,
      name: skill.name,
      description: skill.description,
      mimeType: "text/markdown",
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  if (!uri.startsWith("skill://")) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }
  const name = uri.replace("skill://", "");
  const skill = loadedSkills.find(s => s.name === name);

  if (!skill) {
    throw new Error(`Resource not found: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text: skill.content,
      },
    ],
  };
});

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: mcp-skill-server <githubuser/repo | git url>");
    process.exit(1);
  }

  const repoUrl = args[0];
  await parseRepo(repoUrl);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server is running over stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
