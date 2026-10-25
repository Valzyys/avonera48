import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Only this specific asset-session initialization failure is safe to replay:
// it happens before a Worker version is uploaded or deployed.
export function retryableAssetSessionFailure(output) {
  return /\/assets-upload-session\) failed\./.test(output)
    && /An unknown error has occurred\./.test(output)
    && /\[code: 10013\]/.test(output)
    && !/Uploaded avonera48|Deployed avonera48|Current Version ID:/.test(output);
}

export async function deployWithRetry(runAttempt, wait = delay, log = console.warn) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await runAttempt();
    if (result.code === 0 || result.signal || !retryableAssetSessionFailure(result.output) || attempt === 3) return result.code;
    const ms = 15_000 * attempt;
    log(`[deploy] Cloudflare could not initialize the asset upload session (10013). Retrying in ${ms / 1000}s (${attempt}/2); no successful deployment was reported.`);
    await wait(ms);
  }
  return 1;
}

function runWrangler(args) {
  const require = createRequire(import.meta.url);
  const cli = resolve(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
  return new Promise((resolveAttempt, reject) => {
    const child = spawn(process.execPath, [cli, 'deploy', ...args], { stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';
    const capture = stream => chunk => {
      stream.write(chunk);
      output = (output + chunk).slice(-32_768);
    };
    child.stdout.setEncoding('utf8').on('data', capture(process.stdout));
    child.stderr.setEncoding('utf8').on('data', capture(process.stderr));
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    const cleanup = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
    };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, signal) => {
      cleanup();
      resolveAttempt({ code: code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1), signal, output });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = await deployWithRetry(() => runWrangler(process.argv.slice(2)));
  } catch (error) {
    console.error('[deploy]', error instanceof Error ? error.message : 'Deployment failed');
    process.exitCode = 1;
  }
}
