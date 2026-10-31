/**
 * Generates evals/mcp/mcp-tools.snapshot.json from the real MCP gateways.
 *
 * Placeholder: implemented in S3. It exists so `npm -w apps/backend run
 * eval:snapshot-mcp` resolves to a file and fails with a clear message.
 */
process.stderr.write('eval:snapshot-mcp is not implemented yet (evals S3).\n');
process.exitCode = 1;
