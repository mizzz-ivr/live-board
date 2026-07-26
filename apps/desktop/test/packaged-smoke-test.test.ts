import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runPackagedSmokeTest } from '../electron/packaged-smoke-test.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe('packaged smoke test', () => {
  it('Renderer・永続化・loopback Overlay経路を既定1回確認する', async () => {
    const root = await createPackagedFixture();
    const currentDirectory = join(root, 'app.asar', 'dist-electron');
    const resourcesPath = join(root, 'resources');

    const result = await runPackagedSmokeTest({
      currentDirectory,
      resourcesPath,
      version: '0.1.0-test',
    });

    expect(result).toMatchObject({
      ok: true,
      version: '0.1.0-test',
      host: '127.0.0.1',
      overlayStatus: 200,
      iterations: 1,
      successfulIterations: 1,
    });
    expect(result.port).toBeGreaterThan(0);
    expect(result.durationP95Ms).toBeGreaterThanOrEqual(0);
    expect(result.durationMaxMs).toBeGreaterThanOrEqual(result.durationP95Ms);
    expect(result.initialRssBytes).toBeGreaterThan(0);
    expect(result.finalRssBytes).toBeGreaterThan(0);
    expect(result.maxRssBytes).toBeGreaterThanOrEqual(result.initialRssBytes);
    expect(result.maxRssBytes).toBeGreaterThanOrEqual(result.finalRssBytes);
  });

  it('同一プロセスで2回反復し、集計値だけを返す', async () => {
    const root = await createPackagedFixture();
    const result = await runPackagedSmokeTest({
      currentDirectory: join(root, 'app.asar', 'dist-electron'),
      resourcesPath: join(root, 'resources'),
      version: '0.1.0-test',
      iterations: 2,
    });

    expect(result.iterations).toBe(2);
    expect(result.successfulIterations).toBe(2);
    expect(result.overlayStatus).toBe(200);
    expect(result.durationMaxMs).toBeGreaterThanOrEqual(result.durationP95Ms);
    expect(result.rssDeltaBytes).toBe(result.finalRssBytes - result.initialRssBytes);
    expect(Object.keys(result).sort()).toEqual([
      'durationMaxMs',
      'durationP95Ms',
      'finalRssBytes',
      'host',
      'initialRssBytes',
      'iterations',
      'maxRssBytes',
      'ok',
      'overlayStatus',
      'port',
      'rssDeltaBytes',
      'successfulIterations',
      'version',
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('overlayUrl');
  });

  it('反復回数の境界外を実行前に拒否する', async () => {
    const root = await createPackagedFixture();
    const baseOptions = {
      currentDirectory: join(root, 'app.asar', 'dist-electron'),
      resourcesPath: join(root, 'resources'),
      version: '0.1.0-test',
    };

    await expect(runPackagedSmokeTest({
      ...baseOptions,
      iterations: 0,
    })).rejects.toThrow('PACKAGED_SMOKE_ITERATIONS_INVALID');
    await expect(runPackagedSmokeTest({
      ...baseOptions,
      iterations: 501,
    })).rejects.toThrow('PACKAGED_SMOKE_ITERATIONS_INVALID');
  });

  it('RendererまたはOverlayが欠落している場合はBridge起動前に拒否する', async () => {
    const root = await makeTemporaryRoot();

    await expect(runPackagedSmokeTest({
      currentDirectory: join(root, 'app.asar', 'dist-electron'),
      resourcesPath: join(root, 'resources'),
      version: '0.1.0-test',
      iterations: 2,
    })).rejects.toThrow('PACKAGED_SMOKE_RESOURCE_MISSING');
  });
});

async function createPackagedFixture(): Promise<string> {
  const root = await makeTemporaryRoot();
  const rendererRoot = join(root, 'app.asar', 'dist');
  const overlayRoot = join(root, 'resources', 'overlay', 'dist');
  await Promise.all([
    mkdir(join(root, 'app.asar', 'dist-electron'), { recursive: true }),
    mkdir(rendererRoot, { recursive: true }),
    mkdir(overlayRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(rendererRoot, 'index.html'), '<div id="root"></div>', 'utf8'),
    writeFile(
      join(overlayRoot, 'index.html'),
      '<!doctype html><html><body><div id="root"></div></body></html>',
      'utf8',
    ),
  ]);
  return root;
}

async function makeTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'live-board-package-test-'));
  temporaryRoots.push(root);
  return root;
}
