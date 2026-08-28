import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ASTRO_CLI = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const OUTPUT_LIMIT = 16_000;

type Exit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

export type PreviewServer = {
  stop: () => Promise<void>;
};

export async function startPreviewServer(port: number, timeoutMs = 15_000): Promise<PreviewServer> {
  const server = spawn(
    process.execPath,
    [ASTRO_CLI, 'preview', '--port', String(port), '--host', '127.0.0.1'],
    {
      env: { ...process.env, ASTRO_PREVIEW_BACKGROUND: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  let exit: Exit | undefined;
  let spawnError: Error | undefined;
  let resolveExit!: (exit: Exit) => void;

  const appendOutput = (chunk: Buffer): void => {
    output = `${output}${chunk.toString()}`.slice(-OUTPUT_LIMIT);
  };
  server.stdout.on('data', appendOutput);
  server.stderr.on('data', appendOutput);
  const exited = new Promise<Exit>((resolve) => {
    resolveExit = resolve;
    server.once('exit', (code, signal) => {
      exit = { code, signal };
      resolve(exit);
    });
  });
  server.once('error', (error) => {
    spawnError = error;
    exit = { code: null, signal: null };
    resolveExit(exit);
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/`, timeoutMs, () => {
      if (spawnError) return `Astro preview failed to start: ${spawnError.message}`;
      if (exit) {
        return `Astro preview exited before becoming ready (${describeExit(exit)})`;
      }
      return undefined;
    });
  } catch (error) {
    await stopProcess(server, exited, () => exit);
    throw withServerOutput(error, output);
  }

  return {
    stop: () => stopProcess(server, exited, () => exit),
  };
}

async function waitForServer(
  url: string,
  timeoutMs: number,
  getStartupError: () => string | undefined,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const startupError = getStartupError();
    if (startupError) throw new Error(startupError);

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry while Astro starts.
    }
    await delay(200);
  }
  throw new Error(`${url} did not respond within ${timeoutMs}ms`);
}

async function stopProcess(
  server: ChildProcess,
  exited: Promise<Exit>,
  getExit: () => Exit | undefined,
): Promise<void> {
  if (getExit()) return;

  server.kill('SIGTERM');
  const stopped = await Promise.race([exited.then(() => true), delay(3_000).then(() => false)]);
  if (stopped || getExit()) return;

  server.kill('SIGKILL');
  await exited;
}

function describeExit(exit: Exit): string {
  return exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? 'unknown'}`;
}

function withServerOutput(error: unknown, output: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const detail = output.trim();
  return new Error(detail ? `${message}\n\nAstro preview output:\n${detail}` : message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
