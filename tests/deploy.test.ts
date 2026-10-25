import { describe, expect, it, vi } from 'vitest';
import { deployWithRetry, retryableAssetSessionFailure } from '../scripts/deploy.mjs';

const output = 'A request to the Cloudflare API (/accounts/test/workers/scripts/avonera48/assets-upload-session) failed.\nAn unknown error has occurred. [code: 10013]';
const failed = { code: 1, output };
describe('Cloudflare asset upload session recovery', () => {
  it('retries the reported pre-upload failure, then preserves successful exit', async () => {
    const run = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce({ code: 0, output: '' });
    const wait = vi.fn();
    expect(await deployWithRetry(run, wait, vi.fn())).toBe(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(15_000);
  });
  it('stops after three failures and retains failure status', async () => {
    const run = vi.fn().mockResolvedValue({ ...failed, code: 7 });
    const wait = vi.fn();
    expect(await deployWithRetry(run, wait, vi.fn())).toBe(7);
    expect(run).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[15_000], [30_000]]);
  });
  it.each([
    'TypeScript compilation failed',
    'Authentication error [code: 10000]',
    'Script validation error [code: 10013]',
    output.replace('10013', '10000'),
    output.replace('An unknown error has occurred.', 'Invalid configuration.'),
    output + '\nCurrent Version ID: already-uploaded',
  ])('does not replay unrelated or post-deployment failures: %s', async text => {
    expect(retryableAssetSessionFailure(text)).toBe(false);
    const run = vi.fn().mockResolvedValue({ code: 1, output: text });
    const wait = vi.fn();
    expect(await deployWithRetry(run, wait, vi.fn())).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
  it('does not replay interrupted attempts', async () => {
    const run = vi.fn().mockResolvedValue({ ...failed, code: 130, signal: 'SIGINT' });
    expect(await deployWithRetry(run, vi.fn(), vi.fn())).toBe(130);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
