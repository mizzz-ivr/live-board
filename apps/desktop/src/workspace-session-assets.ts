import type { ProjectAssetLibrary } from '@live-board/domain';

export function retainProjectAssetLibraries(
  libraries: Record<string, ProjectAssetLibrary>,
  retainedProjectIds: readonly string[],
): Record<string, ProjectAssetLibrary> {
  const retained = new Set(retainedProjectIds);
  const nextEntries = Object.entries(libraries).filter(([projectId]) =>
    retained.has(projectId),
  );
  if (nextEntries.length === Object.keys(libraries).length) return libraries;
  return Object.fromEntries(nextEntries);
}
