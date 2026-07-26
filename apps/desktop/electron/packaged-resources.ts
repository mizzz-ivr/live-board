import { join } from 'node:path';

export interface PackagedResourcePaths {
  rendererIndex: string;
  overlayRoot: string;
  overlayIndex: string;
}

export interface PackagedSmokeArguments {
  enabled: boolean;
  outputPath: string | undefined;
  iterations: number;
}

const DEFAULT_SMOKE_ITERATIONS = 1;
const MAX_SMOKE_ITERATIONS = 500;

export function resolvePackagedResourcePaths(
  currentDirectory: string,
  resourcesPath: string,
): PackagedResourcePaths {
  if (currentDirectory.length === 0 || resourcesPath.length === 0) {
    throw new Error('PACKAGED_RESOURCE_PATH_REQUIRED');
  }

  const overlayRoot = join(resourcesPath, 'overlay', 'dist');
  return {
    rendererIndex: join(currentDirectory, '../dist/index.html'),
    overlayRoot,
    overlayIndex: join(overlayRoot, 'index.html'),
  };
}

export function parsePackagedSmokeArguments(
  argv: readonly string[],
): PackagedSmokeArguments {
  const enabled = argv.includes('--smoke-test');
  const outputArguments = argv.filter((argument) =>
    argument.startsWith('--smoke-output='),
  );
  const iterationArguments = argv.filter((argument) =>
    argument.startsWith('--smoke-iterations='),
  );

  if (outputArguments.length > 1) {
    throw new Error('PACKAGED_SMOKE_OUTPUT_DUPLICATED');
  }
  if (iterationArguments.length > 1) {
    throw new Error('PACKAGED_SMOKE_ITERATIONS_DUPLICATED');
  }

  const outputPath = outputArguments[0]?.slice('--smoke-output='.length);
  if (outputArguments.length === 1 && (outputPath === undefined || outputPath.length === 0)) {
    throw new Error('PACKAGED_SMOKE_OUTPUT_INVALID');
  }

  const iterations = parseSmokeIterations(iterationArguments[0]);
  if (!enabled && outputPath !== undefined) {
    throw new Error('PACKAGED_SMOKE_OUTPUT_WITHOUT_TEST');
  }
  if (!enabled && iterationArguments.length === 1) {
    throw new Error('PACKAGED_SMOKE_ITERATIONS_WITHOUT_TEST');
  }

  return { enabled, outputPath, iterations };
}

function parseSmokeIterations(argument: string | undefined): number {
  if (argument === undefined) return DEFAULT_SMOKE_ITERATIONS;

  const value = argument.slice('--smoke-iterations='.length);
  if (!/^[1-9][0-9]{0,2}$/.test(value)) {
    throw new Error('PACKAGED_SMOKE_ITERATIONS_INVALID');
  }

  const iterations = Number(value);
  if (iterations > MAX_SMOKE_ITERATIONS) {
    throw new Error('PACKAGED_SMOKE_ITERATIONS_INVALID');
  }
  return iterations;
}
