import { inngest } from "./client";
import {
  // openai,
  gemini,
  createAgent,
  createTool,
  createNetwork,
  Tool,
} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompt";
import prisma from "@/lib/db";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("lovable-nextjs-test-2");

      return sandbox.sandboxId;
    });

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent ",
      system: PROMPT,
      // model: openai({
      //   model: "gpt-4.1-mini-2025-04-14",
      // }),
      model: gemini({
        model: "gemini-2.5-pro",
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };
              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  },
                });
                return result.stdout;
              } catch (error) {
                console.error(
                  `Command failed: ${error} \n stdout:${buffers.stdout} \n stderr:${buffers.stderr}`
                );
                return `Command failed: ${error} \n stdout:${buffers.stdout} \n stderr:${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run(
              "createOrUpdateFiles",
              async () => {
                try {
                  const updatedFiles = network.state.data.files || {};
                  const sandbox = await getSandbox(sandboxId);

                  console.log(
                    "Creating/updating files:",
                    files.map((f) => f.path)
                  );

                  for (const file of files) {
                    console.log(`Writing file: ${file.path}`);
                    await sandbox.files.write(file.path, file.content);
                    updatedFiles[file.path] = file.content;
                    console.log(`Successfully wrote file: ${file.path}`);
                  }
                  return updatedFiles;
                } catch (error) {
                  console.error(`Failed to create or update files: ${error}`);
                  return `Failed to create or update files: ${error}`;
                }
              }
            );
            if (typeof newFiles == "object") {
              network.state.data.files = newFiles;
            }
          },
        }),
        createTool({
          name: "listDirectory",
          description: "List files and directories in the sandbox",
          parameters: z.object({
            path: z
              .string()
              .describe("Directory path to list, defaults to current directory")
              .default("."),
          }),
          handler: async ({ path = "." }, { step }) => {
            return await step?.run("listDirectory", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(`ls -la ${path}`);
                return result.stdout;
              } catch (error) {
                console.error(`Failed to list directory: ${error}`);
                return `Failed to list directory: ${error}`;
              }
            });
          },
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (error) {
                console.error(`Failed to read files: ${error}`);
                return `Failed to read files: ${error}`;
              }
            });
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantText = lastAssistantTextMessageContent(result);

          if (lastAssistantText && network) {
            if (lastAssistantText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantText;
            }
          }
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "code-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        if (summary) {
          return;
        }
        return codeAgent;
      },
    });

    let result;
    try {
      result = await network.run(event.data.value);
    } catch (error) {
      console.error("Error running network:", error);
      throw error; // rethrow so the error is still visible
    }

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong, please try again",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: result.state.data.summary,
          role: "ASSISTANT",
          type: "RESULT",
          fragments: {
            create: {
              sandboxUrl: sandboxUrl,
              title: "Fragment",
              files: result.state.data.files,
            },
          },
        },
      });
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
