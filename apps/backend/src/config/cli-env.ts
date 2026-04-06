function readCliOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

const cliPort = readCliOption(process.argv.slice(2), '--port');

if (cliPort && !process.env.ISSUER_URL) {
  process.env.BACKEND_PORT = cliPort;
}
