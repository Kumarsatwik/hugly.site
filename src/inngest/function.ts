import { inngest } from "./client";
import {
  // openai,
  gemini,
  createAgent,
  createTool,
  createNetwork,
} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompt";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("lovable-nextjs-test-2");

      return sandbox.sandboxId;
    });

    const codeAgent = createAgent({
      name: "code-agent",
      description: "An expert coding agent ",
      system: PROMPT,
      // model: openai({
      //   model: "gpt-4.1-mini-2025-04-14",
      // }),
      model: gemini({
        model: "gemini-2.0-flash-exp",
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
          handler: async ({ files }, { step, network }) => {
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
          name: "checkErrors",
          description:
            "Check for TypeScript errors, linting issues, and build problems",
          parameters: z.object({
            checkType: z
              .enum(["typescript", "eslint", "build", "all"])
              .describe("Type of error checking to perform"),
          }),
          handler: async ({ checkType }, { step }) => {
            return await step?.run("checkErrors", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const results: string[] = [];

                if (checkType === "typescript" || checkType === "all") {
                  console.log("Checking TypeScript errors...");
                  try {
                    // Use a more robust approach that doesn't throw on non-zero exit codes
                    const tsResult = await sandbox.commands.run(
                      "npx tsc --noEmit --pretty || true"
                    );

                    // Check if TypeScript is available by looking for its output
                    if (
                      tsResult.stdout.includes("error TS") ||
                      tsResult.stderr.includes("error TS")
                    ) {
                      results.push(
                        `❌ TypeScript Check: Compilation errors found\n${tsResult.stdout}\n${tsResult.stderr}`
                      );
                    } else if (
                      tsResult.stderr.includes("command not found") ||
                      tsResult.stderr.includes("not found")
                    ) {
                      results.push(
                        "⚠️ TypeScript Check: TypeScript compiler not available in sandbox"
                      );
                    } else if (
                      tsResult.stdout.trim() === "" &&
                      tsResult.stderr.trim() === ""
                    ) {
                      results.push(
                        "✅ TypeScript Check: No compilation errors found"
                      );
                    } else {
                      results.push(
                        "✅ TypeScript Check: Compilation completed successfully"
                      );
                    }
                  } catch (error) {
                    results.push(
                      `⚠️ TypeScript Check: Could not run TypeScript compiler - ${error}`
                    );
                  }
                }

                if (checkType === "eslint" || checkType === "all") {
                  console.log("Checking ESLint errors...");
                  try {
                    const lintResult = await sandbox.commands.run(
                      "npx eslint . --ext .ts,.tsx --format compact || true"
                    );

                    if (
                      lintResult.stderr.includes("command not found") ||
                      lintResult.stderr.includes("not found")
                    ) {
                      results.push(
                        "⚠️ ESLint Check: ESLint not available in sandbox"
                      );
                    } else if (
                      lintResult.stdout.includes("error") ||
                      lintResult.stdout.includes("warning")
                    ) {
                      results.push(
                        `❌ ESLint Check: Linting issues found\n${lintResult.stdout}`
                      );
                    } else if (
                      lintResult.stdout.trim() === "" &&
                      lintResult.stderr.trim() === ""
                    ) {
                      results.push("✅ ESLint Check: No linting errors found");
                    } else {
                      results.push(
                        "✅ ESLint Check: Linting completed successfully"
                      );
                    }
                  } catch (error) {
                    results.push(
                      `⚠️ ESLint Check: Could not run ESLint - ${error}`
                    );
                  }
                }

                if (checkType === "build" || checkType === "all") {
                  console.log("Checking build errors...");
                  try {
                    const buildResult = await sandbox.commands.run(
                      "npm run build || true"
                    );

                    if (
                      buildResult.stderr.includes("command not found") ||
                      buildResult.stderr.includes("npm: not found")
                    ) {
                      results.push(
                        "⚠️ Build Check: npm not available in sandbox"
                      );
                    } else if (
                      buildResult.stdout.includes("Build successful") ||
                      buildResult.stdout.includes("Compiled successfully")
                    ) {
                      results.push(
                        "✅ Build Check: Build completed successfully"
                      );

                      // Check for warnings
                      if (buildResult.stdout.includes("warning")) {
                        results.push(
                          `⚠️ Build warnings found:\n${buildResult.stdout}`
                        );
                      }
                    } else if (
                      buildResult.stderr.includes("error") ||
                      buildResult.stdout.includes("Failed to compile")
                    ) {
                      results.push(
                        `❌ Build Check: Build failed\n${buildResult.stdout}\n${buildResult.stderr}`
                      );
                    } else {
                      results.push("✅ Build Check: Build process completed");
                    }
                  } catch (error) {
                    results.push(
                      `⚠️ Build Check: Could not run build command - ${error}`
                    );
                  }
                }

                return results.join("\n\n" + "=".repeat(50) + "\n\n");
              } catch (error) {
                console.error(`Failed to check errors: ${error}`);
                return `Failed to check errors: ${error}`;
              }
            });
          },
        }),
        createTool({
          name: "validateCode",
          description: "Validate specific files for syntax and import errors",
          parameters: z.object({
            files: z
              .array(z.string())
              .describe("List of file paths to validate"),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("validateCode", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const results: string[] = [];

                for (const file of files) {
                  console.log(`Validating file: ${file}`);

                  // Check if file exists
                  const existsResult = await sandbox.commands.run(
                    `test -f "${file}" && echo "exists" || echo "missing"`
                  );
                  if (existsResult.stdout.trim() === "missing") {
                    results.push(`❌ ${file}: File does not exist`);
                    continue;
                  }

                  // Check syntax for TypeScript/JavaScript files
                  if (
                    file.endsWith(".ts") ||
                    file.endsWith(".tsx") ||
                    file.endsWith(".js") ||
                    file.endsWith(".jsx")
                  ) {
                    try {
                      const syntaxResult = await sandbox.commands.run(
                        `npx tsc --noEmit --skipLibCheck "${file}" || true`
                      );

                      if (
                        syntaxResult.stderr.includes("command not found") ||
                        syntaxResult.stderr.includes("not found")
                      ) {
                        results.push(
                          `⚠️ ${file}: TypeScript compiler not available`
                        );
                      } else if (
                        syntaxResult.stdout.includes("error TS") ||
                        syntaxResult.stderr.includes("error TS")
                      ) {
                        results.push(
                          `❌ ${file}: TypeScript errors:\n${syntaxResult.stdout}\n${syntaxResult.stderr}`
                        );
                      } else {
                        results.push(`✅ ${file}: No syntax errors`);
                      }
                    } catch (error) {
                      results.push(
                        `⚠️ ${file}: Could not validate syntax - ${error}`
                      );
                    }
                  }

                  // Check for common import issues
                  const contentResult = await sandbox.commands.run(
                    `cat "${file}" || echo ""`
                  );
                  const content = contentResult.stdout;

                  // Check for missing imports
                  const missingImports = [];
                  if (
                    content.includes("useState") &&
                    !content.includes("import.*useState")
                  ) {
                    missingImports.push("useState from react");
                  }
                  if (
                    content.includes("useEffect") &&
                    !content.includes("import.*useEffect")
                  ) {
                    missingImports.push("useEffect from react");
                  }
                  if (
                    content.includes("<Button") &&
                    !content.includes("import.*Button")
                  ) {
                    missingImports.push("Button component");
                  }

                  if (missingImports.length > 0) {
                    results.push(
                      `⚠️  ${file}: Possible missing imports: ${missingImports.join(
                        ", "
                      )}`
                    );
                  }
                }

                return results.join("\n");
              } catch (error) {
                console.error(`Failed to validate code: ${error}`);
                return `Failed to validate code: ${error}`;
              }
            });
          },
        }),
        createTool({
          name: "testBuild",
          description: "Test build process and check for runtime errors",
          parameters: z.object({
            skipCache: z
              .boolean()
              .describe("Whether to skip build cache")
              .default(false),
          }),
          handler: async ({ skipCache }, { step }) => {
            return await step?.run("testBuild", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const results: string[] = [];

                if (skipCache) {
                  console.log("Cleaning build cache...");
                  try {
                    await sandbox.commands.run("rm -rf .next || true");
                    results.push("✅ Cache cleaned successfully");
                  } catch (error) {
                    results.push(`⚠️ Could not clean cache: ${error}`);
                  }
                }

                console.log("Testing build process...");
                try {
                  const buildResult = await sandbox.commands.run(
                    "npm run build || true"
                  );

                  if (
                    buildResult.stderr.includes("command not found") ||
                    buildResult.stderr.includes("npm: not found")
                  ) {
                    results.push("⚠️ Build Test: npm not available in sandbox");
                  } else if (
                    buildResult.stdout.includes("Build successful") ||
                    buildResult.stdout.includes("Compiled successfully")
                  ) {
                    results.push("✅ Build completed successfully");

                    // Check for warnings
                    if (
                      buildResult.stdout &&
                      buildResult.stdout.includes("warning")
                    ) {
                      results.push(`⚠️ Build warnings:\n${buildResult.stdout}`);
                    }
                  } else if (
                    buildResult.stderr.includes("error") ||
                    buildResult.stdout.includes("Failed to compile")
                  ) {
                    results.push(
                      `❌ Build failed:\n${buildResult.stdout}\n${buildResult.stderr}`
                    );
                  } else {
                    results.push("✅ Build process completed");
                  }
                } catch (error) {
                  results.push(`❌ Could not run build: ${error}`);
                }

                return results.join("\n\n");
              } catch (error) {
                console.error(`Failed to test build: ${error}`);
                return `Failed to test build: ${error}`;
              }
            });
          },
        }),
        createTool({
          name: "simpleValidation",
          description: "Simple file validation without external dependencies",
          parameters: z.object({
            files: z
              .array(z.string())
              .describe("List of file paths to validate"),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("simpleValidation", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const results: string[] = [];

                for (const file of files) {
                  console.log(`Simple validation for: ${file}`);

                  // Check if file exists
                  try {
                    const existsResult = await sandbox.commands.run(
                      `test -f "${file}" && echo "exists" || echo "missing"`
                    );
                    if (existsResult.stdout.trim() === "missing") {
                      results.push(`❌ ${file}: File does not exist`);
                      continue;
                    }
                  } catch {
                    results.push(`❌ ${file}: Could not check file existence`);
                    continue;
                  }

                  // Read file content
                  try {
                    const contentResult = await sandbox.commands.run(
                      `cat "${file}" || echo ""`
                    );
                    const content = contentResult.stdout;

                    // Basic syntax checks
                    const issues = [];

                    // Check for basic React/TypeScript issues
                    if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
                      if (
                        content.includes("useState") ||
                        content.includes("useEffect")
                      ) {
                        if (
                          !content.includes('"use client"') &&
                          !content.includes("'use client'")
                        ) {
                          issues.push(
                            "Missing 'use client' directive for client-side hooks"
                          );
                        }
                      }
                    }

                    // Check for missing imports
                    if (
                      content.includes("useState") &&
                      !content.match(/import.*useState/)
                    ) {
                      issues.push("useState used but not imported");
                    }
                    if (
                      content.includes("useEffect") &&
                      !content.match(/import.*useEffect/)
                    ) {
                      issues.push("useEffect used but not imported");
                    }
                    if (
                      content.includes("<Button") &&
                      !content.match(/import.*Button/)
                    ) {
                      issues.push("Button component used but not imported");
                    }

                    // Check for basic syntax issues
                    if (
                      content.includes("export default") &&
                      content.includes("export {")
                    ) {
                      issues.push("Mixed default and named exports");
                    }

                    if (issues.length > 0) {
                      results.push(`⚠️ ${file}: ${issues.join(", ")}`);
                    } else {
                      results.push(`✅ ${file}: Basic validation passed`);
                    }
                  } catch {
                    results.push(`❌ ${file}: Could not read file content`);
                  }
                }

                return results.join("\n");
              } catch (error) {
                console.error(`Failed simple validation: ${error}`);
                return `Failed simple validation: ${error}`;
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

    const network = createNetwork({
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

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
