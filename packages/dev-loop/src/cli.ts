#!/usr/bin/env node
/**
 * `devedge-ufe` CLI. Currently one subcommand: `doctor`, which runs
 * {@link diagnose} and prints a per-step checklist with check/cross marks.
 */
import { diagnose, type DiagnoseResult } from './index.js';

interface Args {
  [k: string]: string | boolean;
}

function parseArgs(argv: string[]): { cmd?: string; args: Args } {
  const [cmd, ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return { cmd, args };
}

function printResult(r: DiagnoseResult): void {
  for (const step of r.steps) {
    const mark = step.ok ? '✓' : '✗';
    const detail = step.detail ? ` — ${step.detail}` : '';
    console.log(`  ${mark} ${step.name}${detail}`);
  }
  console.log('');
  if (r.ok) {
    console.log('doctor: all checks passed ✓');
  } else {
    console.log(`doctor: FAILED at "${r.failedStep}"`);
    if (r.message) console.log(`  ${r.message}`);
  }
}

async function main(): Promise<number> {
  const { cmd, args } = parseArgs(process.argv.slice(2));

  if (cmd !== 'doctor') {
    console.log('devedge-ufe — micro-frontend dev-loop diagnostics');
    console.log('');
    console.log('Usage:');
    console.log('  devedge-ufe doctor --url <devServerUrl> --app <appId> [--metadata <path>]');
    return cmd ? 1 : 0;
  }

  const devServerUrl = args.url as string | undefined;
  const appId = (args.app as string | undefined) ?? 'app';
  if (!devServerUrl) {
    console.error('doctor: --url <devServerUrl> is required');
    return 2;
  }

  const result = await diagnose({
    devServerUrl,
    appId,
    metadataFile: args.metadata as string | undefined,
  });
  printResult(result);
  return result.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error('doctor: unexpected error:', err);
    process.exit(3);
  },
);
