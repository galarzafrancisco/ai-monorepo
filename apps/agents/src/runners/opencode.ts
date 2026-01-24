// /*
// Work in progress. Need to port this to a BaseAgentRunner compatible class.
// */


// import { createOpencode, createOpencodeServer, OpencodeClient, TextPartInput } from "@opencode-ai/sdk";
// import { readFileSync, writeFileSync, existsSync } from "fs";
// import { join } from "node:path";


// import { AgentRunArgs, AgentRunResult } from "../claude.js";
// import { ACCESS_TOKEN, BASE_URL } from "../config.js";

// function startTaskPrompt(): string {
//   const filePath = join(
//     new URL(".", import.meta.url).pathname,
//     "prompts",
//     "start-task.md"
//   )
//   const raw = readFileSync(filePath);
//   return raw.toString();
// }

// function reviewerPrompt(): string {
//   const filePath = join(
//     new URL(".", import.meta.url).pathname,
//     "prompts",
//     "personas",
//     "code-reviewer.md"
//   )
//   const raw = readFileSync(filePath);
//   return raw.toString();
// }

// function cleanup(client: OpencodeClient | null) {
//   if (client) {
//     client.instance.dispose();
//   }
// }



// export async function runAgentStream(args: AgentRunArgs): Promise<AgentRunResult> {
//   console.log('Starting Opencode run');
//   let client: OpencodeClient | null = null;

//   try {
//     // Slash commands don't do shit here
//     const opencode = await createOpencode({
//       timeout: 20 * 3600,
//       config: {
//         mcp: {
//           tasks: {
//             type: "remote",
//             url: `${BASE_URL}/api/v1/tasks/tasks/mcp`,
//             headers: {
//               Authorization: `Bearer ${ACCESS_TOKEN}`
//             },
//             enabled: true,
//           }
//         }
//       }
//       // config: {
//       //   command: {
//       //     "test-command-1": {
//       //       description: "This is just a test command",
//       //       template: "Say hello like a cowboy"
//       //     },
//       //     "/test-command-2": {
//       //       description: "This is just a test command",
//       //       template: "Say goodbye like a cowboy"
//       //     }
//       //   },
//       //   agent: {
//       //     "code-review": {
//       //       mode: "primary",
//       //       prompt: "say LGTM 🚀"
//       //     }
//       //   }
//       // }
//     });
//     client = opencode.client;

//     // // We can list projects
//     // const { data: projects } = await client.project.list();
//     // console.log(projects);


//     // Create a session for this work
//     const { data: session } = await client.session.create({
//       body: {
//         title: `Session ${new Date().toLocaleString()}`,
//       },
//       query: {
//         directory: args.cwd,
//       },
//     });
//     if (!session) {
//       cleanup(client);
//       return {
//         sessionId: null,
//         events: [],
//         result: 'Failed to create session',
//       }
//     }
//     console.log(`created session ${session.id} in ${session.directory}`);


//     /*
//     Prep some prompts
//     */
//     const startTaskPromptMessage: TextPartInput = {
//       type: 'text',
//       text: startTaskPrompt(),
//     };
//     const taskIdMessage: TextPartInput = {
//       type: 'text',
//       text: `Task ID: ${args.taskId}`,
//     }
//     const reviewPromptMessage: TextPartInput = {
//       type: 'text',
//       text: reviewerPrompt(),
//     };
//     const message: TextPartInput = {
//       type: "text",
//       // text: args.prompt,
//       text: "/test-command-1",
//     };


//     const { data: response } = await client.session.prompt({
//       // Link to the session
//       path: {
//         id: session.id
//       },
//       query: {
//         directory: args.cwd, // do we need this?
//       },
//       body: {
//         model: {
//           providerID: "spark-openai",
//           modelID: "openai/gpt-oss-120b",
//         },
//         // agent: "agent name",
//         // system: "Is this the system prompt?",
//         // noReply: false, // what does this do?
//         parts: [
//           startTaskPromptMessage,
//           taskIdMessage,
//           reviewPromptMessage,
//         ],
//       }
//     });

//     console.log(response);

//     // const messages = await client.session.messages({
//     //   path: {
//     //     id: session.id
//     //   },
//     //   query: {
//     //     directory: args.cwd,
//     //   },
//     // });
//     // console.log(messages);

//     // // Listen to real-time events // > this gives server pings, no real events
//     // const events = await client.event.subscribe({ query: { directory: args.cwd } });
//     // for await (const event of events.stream) {
//     //   console.log("Event:", event.type, event.properties)
//     // }

//   } catch (error) {
//     // Try to gracefully close on crash
//     cleanup(client);
//     console.error(error);
//     return {
//       sessionId: null,
//       events: [],
//       result: `${error}`,
//     }
//   }



//   console.log('Opencode run finished');
//   return {
//     sessionId: null,
//     events: [],
//     result: 'done',
//   }
// }