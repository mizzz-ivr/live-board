import type { Workspace } from '@live-board/domain';

export const MAX_PERSISTED_PROJECT_TABS = 1_024;

export interface LiveboardProjectTabsState {
  readonly openProjectIds: readonly string[];
  readonly pinnedProjectIds: readonly string[];
}

export interface LiveboardEditorState {
  projectTabs?: LiveboardProjectTabsState;
}

export function normalizeLiveboardEditorState(
  input: unknown,
  workspace: Workspace,
): LiveboardEditorState | undefined {
  if (!isRecord(input)) return undefined;
  const projectTabs = normalizeProjectTabsState(input.projectTabs, workspace);
  return projectTabs === undefined ? undefined : { projectTabs };
}

export function remapLiveboardEditorState(
  editorState: LiveboardEditorState | undefined,
  projectIdMap: ReadonlyMap<string, string>,
  workspace: Workspace,
): LiveboardEditorState | undefined {
  const projectTabs = editorState?.projectTabs;
  if (projectTabs === undefined) return undefined;
  return normalizeLiveboardEditorState(
    {
      projectTabs: {
        openProjectIds: projectTabs.openProjectIds.flatMap((projectId) => {
          const mapped = projectIdMap.get(projectId);
          return mapped === undefined ? [] : [mapped];
        }),
        pinnedProjectIds: projectTabs.pinnedProjectIds.flatMap((projectId) => {
          const mapped = projectIdMap.get(projectId);
          return mapped === undefined ? [] : [mapped];
        }),
      },
    },
    workspace,
  );
}

function normalizeProjectTabsState(
  input: unknown,
  workspace: Workspace,
): LiveboardProjectTabsState | undefined {
  if (
    !isRecord(input) ||
    !Array.isArray(input.openProjectIds) ||
    input.openProjectIds.length > MAX_PERSISTED_PROJECT_TABS
  ) {
    return undefined;
  }
  if (
    input.pinnedProjectIds !== undefined &&
    (
      !Array.isArray(input.pinnedProjectIds) ||
      input.pinnedProjectIds.length > MAX_PERSISTED_PROJECT_TABS
    )
  ) {
    return undefined;
  }
  if (
    !Array.isArray(workspace.projects) ||
    workspace.projects.length === 0 ||
    workspace.projects.length > MAX_PERSISTED_PROJECT_TABS
  ) {
    return undefined;
  }

  const projectIds = workspace.projects.flatMap((project) =>
    isRecord(project) && typeof project.id === 'string' ? [project.id] : [],
  );
  const availableIds = new Set(projectIds);
  const activeProjectId =
    typeof workspace.activeProjectId === 'string' &&
    availableIds.has(workspace.activeProjectId)
      ? workspace.activeProjectId
      : projectIds[0];
  if (activeProjectId === undefined) return undefined;

  const openProjectIds = uniqueAvailableIds(input.openProjectIds, availableIds);
  if (!openProjectIds.includes(activeProjectId)) {
    openProjectIds.push(activeProjectId);
  }

  const openSet = new Set(openProjectIds);
  const pinnedSet = new Set(
    uniqueAvailableIds(input.pinnedProjectIds ?? [], availableIds).filter(
      (projectId) => openSet.has(projectId),
    ),
  );
  const normalizedOpenProjectIds = [
    ...openProjectIds.filter((projectId) => pinnedSet.has(projectId)),
    ...openProjectIds.filter((projectId) => !pinnedSet.has(projectId)),
  ];

  return {
    openProjectIds: normalizedOpenProjectIds,
    pinnedProjectIds: normalizedOpenProjectIds.filter((projectId) =>
      pinnedSet.has(projectId),
    ),
  };
}

function uniqueAvailableIds(
  input: readonly unknown[],
  availableIds: ReadonlySet<string>,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of input) {
    if (
      typeof value === 'string' &&
      availableIds.has(value) &&
      !seen.has(value)
    ) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
