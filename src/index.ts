#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
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
  isTool: boolean;
  isPrompt: boolean;
}

let loadedSkills: Skill[] = [];

async function parseRepo(repoUrl: string, allowedPlugins?: string[]) {
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
    }

    const skills: Skill[] = [];

    if (marketplace.plugins && Array.isArray(marketplace.plugins)) {
      for (const plugin of marketplace.plugins) {
        if (allowedPlugins && allowedPlugins.length > 0 && !allowedPlugins.includes(plugin.name)) {
          console.error(`Skipping plugin ${plugin.name} as it is not in the allowed plugins list.`);
          continue;
        }

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
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to cleanup temp dir ${tempDir}`);
    }
  }
}

function parseSkillMd(content: string): Skill {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    const [, frontmatterStr] = match;
    try {
      const frontmatter = yaml.parse(frontmatterStr);
      
      let isTool = true;
      if (frontmatter['disable-model-invocation'] === true || frontmatter['disable_model_invocation'] === true) {
        isTool = false;
      }
      
      let isPrompt = true;
      if (frontmatter['user-invocable'] === false || frontmatter['user_invocable'] === false) {
        isPrompt = false;
      }

      return {
        name: frontmatter.name || "unknown-skill",
        description: frontmatter.description || "",
        content: content.trim(),
        isTool,
        isPrompt,
      };
    } catch (e) {
      console.error("Failed to parse YAML frontmatter:", e);
    }
  }

  return {
    name: "unnamed-skill-" + Math.random().toString(36).substring(7),
    description: "A skill without metadata",
    content: content.trim(),
    isTool: true,
    isPrompt: true,
  };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const flags = rawArgs.filter(arg => arg.startsWith('--'));
  const args = rawArgs.filter(arg => !arg.startsWith('--'));

  const enableResources = flags.includes('--enable-resources');

  if (args.length === 0) {
    console.error("Usage: mcp-skill-server [--enable-resources] <githubuser/repo | git url> [plugin1,plugin2,...]");
    process.exit(1);
  }

  const repoUrl = args[0];
  const allowedPluginsStr = args[1];
  const allowedPlugins = allowedPluginsStr ? allowedPluginsStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

  await parseRepo(repoUrl, allowedPlugins);

  const capabilities: any = {};

  if (enableResources) {
    capabilities.resources = {};
  } else {
    capabilities.tools = {};
    capabilities.prompts = {};
  }

  const server = new Server(
    {
      name: "ecp-bridge",
      version: "1.0.0",
    },
    {
      capabilities,
    }
  );

  if (enableResources) {
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
  }

  if (!enableResources) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: loadedSkills.filter(s => s.isTool).map(skill => ({
        name: skill.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64),
        description: skill.description || `Get instructions for ${skill.name}`,
        inputSchema: {
          type: "object",
          properties: {},
        },
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const skill = loadedSkills.filter(s => s.isTool).find(s => s.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64) === toolName);

    if (!skill) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return {
      content: [
        {
          type: "text",
          text: skill.content,
        },
      ],
    };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: loadedSkills.filter(s => s.isPrompt).map(skill => ({
        name: skill.name.replace(/[^a-zA-Z0-9_-]/g, '_') + "-p",
        description: skill.description || `Apply the ${skill.name} skill`,
        arguments: [],
      })),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const skill = loadedSkills.filter(s => s.isPrompt).find(s => (s.name.replace(/[^a-zA-Z0-9_-]/g, '_') + "-p") === promptName);

    if (!skill) {
      throw new Error(`Prompt not found: ${promptName}`);
    }

    return {
      description: skill.description,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please review and follow these instructions for the task:\n\n${skill.content}`,
          },
        },
      ],
    };
  });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server is running over stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
