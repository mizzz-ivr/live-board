import { startObsBridge, type ObsBridge } from '@live-board/obs-bridge';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createWorkspacePersistenceService } from './persistence-service.js';
import {
  resolvePackagedResourcePaths,
  type PackagedResourcePaths,
} from './packaged-resources.js';

export interface PackagedSmokeTestResult {
  ok: true;
  version: string;
  host: '127.0.0.1' | '::1';
  port: number;
  overlayStatus: number;
  iterations: number;
  successfulIterations: number;
  durationP95Ms: number;
  durationMaxMs: number;
  initialRssBytes: number;
  finalRssBytes: number;
  maxRssBytes: number;
  rssDeltaBytes: number;
}

export interface RunPackagedSmokeTestOptions {
  currentDirectory: string;
  resourcesPath: string;
  version: string;
  iterations?: number;
}

interface SmokeIterationResult {
  host: '127.0.0.1' | '::1';
  port: number;
  overlayStatus: number;
}

const MAX_SMOKE_ITERATIONS = 500;

export async function runPackagedSmokeTest(
  options: RunPackagedSmokeTestOptions,
): Promise<PackagedSmokeTestResult> {
  const iterations = options.iterations ?? 1;
  assertSmokeIterations(iterations);

  const paths = resolvePackagedResourcePaths(
    options.currentDirectory,
    options.resourcesPath,
  );
  await assertPackagedResources(paths);

  const initialRssBytes = process.memoryUsage().rss;
  const rssSamples = [initialRssBytes];
  const durationsMs: number[] = [];
  let latestIteration: SmokeIterationResult | undefined;

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    latestIteration = await runSmokeIteration(paths);
    durationsMs.push(roundMilliseconds(performance.now() - startedAt));
    rssSamples.push(process.memoryUsage().rss);
  }

  if (latestIteration === undefined) {
    throw new Error('PACKAGED_SMOKE_ITERATION_MISSING');
  }

  const finalRssBytes = rssSamples[rssSamples.length - 1] ?? initialRssBytes;
  return {
    ok: true,
    version: options.version,
    host: latestIteration.host,
    port: latestIteration.port,
    overlayStatus: latestIteration.overlayStatus,
    iterations,
    successfulIterations: durationsMs.length,
    durationP95Ms: percentile95(durationsMs),
    durationMaxMs: Math.max(...durationsMs),
    initialRssBytes,
    finalRssBytes,
    maxRssBytes: Math.max(...rssSamples),
    rssDeltaBytes: finalRssBytes - initialRssBytes,
  };
}

export async function writePackagedSmokeResult(
  outputPath: string,
  result: PackagedSmokeTestResult,
): Promise<void> {
  await access(dirname(outputPath));
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

async function runSmokeIteration(
  paths: PackagedResourcePaths,
): Promise<SmokeIterationResult> {
  const smokeRoot = await mkdtemp(join(tmpdir(), 'live-board-packaged-smoke-'));
  let bridge: ObsBridge | undefined;

  try {
    const persistenceService = createWorkspacePersistenceService(
      join(smokeRoot, 'persistence'),
    );
    await persistenceService.initialize();

    bridge = await startObsBridge({
      allowedOrigins: [],
      overlayRoot: paths.overlayRoot,
    });

    const response = await fetch(bridge.info.overlayUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`PACKAGED_SMOKE_OVERLAY_HTTP_${response.status}`);
    }

    const html = await response.text();
    if (!/id=["']root["']/.test(html)) {
      throw new Error('PACKAGED_SMOKE_OVERLAY_ROOT_MISSING');
    }

    return {
      host: bridge.info.host,
      port: bridge.info.port,
      overlayStatus: response.status,
    };
  } finally {
    try {
      await bridge?.close();
    } finally {
      await rm(smokeRoot, { recursive: true, force: true });
    }
  }
}

async function assertPackagedResources(
  paths: PackagedResourcePaths,
): Promise<void> {
  try {
    await Promise.all([
      access(paths.rendererIndex),
      access(paths.overlayIndex),
    ]);
  } catch {
    throw new Error('PACKAGED_SMOKE_RESOURCE_MISSING');
  }
}

function assertSmokeIterations(iterations: number): void {
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < 1 ||
    iterations > MAX_SMOKE_ITERATIONS
  ) {
    throw new Error('PACKAGED_SMOKE_ITERATIONS_INVALID');
  }
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('PACKAGED_SMOKE_DURATION_MISSING');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
