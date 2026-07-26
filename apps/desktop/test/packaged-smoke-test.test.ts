import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  runPackagedSmokeTest,
  type PackagedSmokeRuntime,
} from '../electron/packaged-smoke-test.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe('packaged smoke test', () => {
  it('Renderer・永続化・loopback Overlay経路を2回反復して集計する', async () => {
    const root = await createPackagedFixture();
    const currentDirectory = join(root, 'app.asar', 'dist-electron');
    const resourcesPath = join(root, 'resources');
    const runtime = createRuntime(
      [0, 10, 10, 30],
      [100, 120, 110],
    );

    const result = await runPackagedSmokeTest({
      currentDirectory,
      resourcesPath,
      version: '0.1.0-test',
      iterations: 2,
      runtime,
    });

    expect(result).toMatchObject({
      ok: true,
      version: '0.1.0-test',
      host: '127.0.0.1',
      overlayStatus: 200,
      iterations: 2,
      successfulIterations: 2,
      p95DurationMs: 20,
      maxDurationMs: 20,
      initialRssBytes: 100,
      finalRssBytes: 110,
      maxRssBytes: 120,
      rssDeltaBytes: 10,
    });
    expect(result.port).toBeGreaterThan(0);
    expect(Object.keys(result).sort()).toEqual([
      'finalRssBytes',
      'host',
      'initialRssBytes',
      'iterations',
      'maxDurationMs',
      'maxRssBytes',
      'ok',
      'overlayStatus',
      'p95DurationMs',
      'port',
      'rssDeltaBytes',
      'successfulIterations',
      'version',
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain('token');
  });

  it('既定値では従来どおり1回だけ実行する', async () => {
    const root = await createPackagedFixture();
    const result = await runPackagedSmokeTest({
      currentDirectory: join(root, 'app.asar', 'dist-electron'),
      resourcesPath: join(root, 'resources'),
      version: '0.1.0-test',
    });

    expect(result.iterations).toBe(1);
    expect(result.successfulIterations).toBe(1);
    expect(result.overlayStatus).toBe(200);
  });

  it('Runner APIでも反復回数の範囲外を拒否する', async () => {
    const root = await createPackagedFixture();
    const base = {
      currentDirectory: join(root, 'app.asar', 'dist-electron'),
      resourcesPath: join(root, 'resources'),
      version: '0.1.0-test',
    };

    await expect(runPackagedSmokeTest({ ...base, iterations: 0 })).rejects.toThrow(
      'PACKAGED_SMOKE_ITERATIONS_INVALID',
    );
    await expect(runPackagedSmokeTest({ ...base, iterations: 501 })).rejects.toThrow(
      'PACKAGED_SMOKE_ITERATIONS_INVALID',
    );
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

function createRuntime(
  times: number[],
  rssValues: number[],
): PackagedSmokeRuntime {
  return {
    now: () => {
      const value = times.shift();
      if (value === undefined) throw new Error('TEST_TIME_EXHAUSTED');
      return value;
    },
    readRssBytes: () => {
      const value = rssValues.shift();
      if (value === undefined) throw new Error('TEST_RSS_EXHAUSTED');
      return value;
    },
  };
}

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
