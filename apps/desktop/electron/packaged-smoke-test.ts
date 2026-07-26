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
  p95DurationMs: number;
  maxDurationMs: number;
  initialRssBytes: number;
  finalRssBytes: number;
  maxRssBytes: number;
  rssDeltaBytes: number;
}

export interface PackagedSmokeRuntime {
  now(): number;
  readRssBytes(): number;
}

export interface RunPackagedSmokeTestOptions {
  currentDirectory: string;
  resourcesPath: string;
  version: string;
  iterations?: number;
  runtime?: PackagedSmokeRuntime;
}

const defaultRuntime: PackagedSmokeRuntime = {
  now: () => performance.now(),
  readRssBytes: () => process.memoryUsage().rss,
};

export async function runPackagedSmokeTest(
  options: RunPackagedSmokeTestOptions,
): Promise<PackagedSmokeTestResult> {
  const paths = resolvePackagedResourcePaths(
    options.currentDirectory,
    options.resourcesPath,
  );
  await assertPackagedResources(paths);

  const iterations = options.iterations ?? 1;
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 500) {
    throw new Error('PACKAGED_SMOKE_ITERATIONS_INVALID');
  }

  const runtime = options.runtime ?? defaultRuntime;
  const durations: number[] = [];
  const initialRssBytes = runtime.readRssBytes();
  let finalRssBytes = initialRssBytes;
  let maxRssBytes = initialRssBytes;
  let successfulIterations = 0;
  let lastHost: '127.0.0.1' | '::1' | undefined;
  let lastPort: number | undefined;
  let lastOverlayStatus: number | undefined;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = runtime.now();
    const iterationResult = await runPackagedSmokeIteration(paths);
    const durationMs = Math.max(0, runtime.now() - startedAt);
    durations.push(durationMs);
    successfulIterations += 1;
    lastHost = iterationResult.host;
    lastPort = iterationResult.port;
    lastOverlayStatus = iterationResult.overlayStatus;

    finalRssBytes = runtime.readRssBytes();
    maxRssBytes = Math.max(maxRssBytes, finalRssBytes);
  }

  if (
    lastHost === undefined ||
    lastPort === undefined ||
    lastOverlayStatus === undefined
  ) {
    throw new Error('PACKAGED_SMOKE_NO_SUCCESSFUL_ITERATION');
  }

  return {
    ok: true,
    version: options.version,
    host: lastHost,
    port: lastPort,
    overlayStatus: lastOverlayStatus,
    iterations,
    successfulIterations,
    p95DurationMs: roundMilliseconds(percentile95(durations)),
    maxDurationMs: roundMilliseconds(Math.max(...durations)),
    initialRssBytes,
    finalRssBytes,
    maxRssBytes,
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

interface PackagedSmokeIterationResult {
  host: '127.0.0.1' | '::1';
  port: number;
  overlayStatus: number;
}

async function runPackagedSmokeIteration(
  paths: PackagedResourcePaths,
): Promise<PackagedSmokeIterationResult> {
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
      if (bridge !== undefined) await bridge.close();
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

function percentile95(values: readonly number[]): number {
  if (values.length === 0) throw new Error('PACKAGED_SMOKE_DURATION_MISSING');
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
