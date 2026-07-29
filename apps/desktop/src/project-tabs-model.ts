const RECENTLY_CLOSED_LIMIT = 10;

export interface ProjectTabsState {
  workspaceId: string;
  openProjectIds: string[];
  recentlyClosedProjectIds: string[];
}

export function createProjectTabsState(
  workspaceId: string,
  projectIds: readonly string[],
): ProjectTabsState {
  return {
    workspaceId,
    openProjectIds: [...projectIds],
    recentlyClosedProjectIds: [],
  };
}

export function synchronizeProjectTabsState(
  state: ProjectTabsState,
  workspaceId: string,
  projectIds: readonly string[],
  activeProjectId: string,
): ProjectTabsState {
  if (state.workspaceId !== workspaceId) {
    return createProjectTabsState(workspaceId, projectIds);
  }

  const availableIds = new Set(projectIds);
  const knownIds = new Set([
    ...state.openProjectIds,
    ...state.recentlyClosedProjectIds,
  ]);
  const openProjectIds = state.openProjectIds.filter((id) => availableIds.has(id));
  for (const projectId of projectIds) {
    if (!knownIds.has(projectId)) openProjectIds.push(projectId);
  }
  if (availableIds.has(activeProjectId) && !openProjectIds.includes(activeProjectId)) {
    openProjectIds.push(activeProjectId);
  }

  const openSet = new Set(openProjectIds);
  const nextOpenProjectIds = sortByProjectOrder(openProjectIds, projectIds);
  const nextRecentlyClosedProjectIds = state.recentlyClosedProjectIds.filter(
    (id) => availableIds.has(id) && !openSet.has(id),
  );
  if (
    arraysEqual(state.openProjectIds, nextOpenProjectIds) &&
    arraysEqual(state.recentlyClosedProjectIds, nextRecentlyClosedProjectIds)
  ) {
    return state;
  }

  return {
    workspaceId,
    openProjectIds: nextOpenProjectIds,
    recentlyClosedProjectIds: nextRecentlyClosedProjectIds,
  };
}

export function closeProjectTab(
  state: ProjectTabsState,
  projectId: string,
  activeProjectId: string,
): { state: ProjectTabsState; nextActiveProjectId: string } {
  const closeIndex = state.openProjectIds.indexOf(projectId);
  if (closeIndex < 0 || state.openProjectIds.length <= 1) {
    return { state, nextActiveProjectId: activeProjectId };
  }

  const openProjectIds = state.openProjectIds.filter((id) => id !== projectId);
  const nextActiveProjectId = activeProjectId === projectId
    ? openProjectIds[Math.min(closeIndex, openProjectIds.length - 1)]!
    : activeProjectId;

  return {
    state: {
      ...state,
      openProjectIds,
      recentlyClosedProjectIds: [
        projectId,
        ...state.recentlyClosedProjectIds.filter((id) => id !== projectId),
      ].slice(0, RECENTLY_CLOSED_LIMIT),
    },
    nextActiveProjectId,
  };
}

export function reopenLastProjectTab(
  state: ProjectTabsState,
  projectIds: readonly string[],
): { state: ProjectTabsState; reopenedProjectId: string | null } {
  const availableIds = new Set(projectIds);
  const reopenedProjectId = state.recentlyClosedProjectIds.find(
    (id) => availableIds.has(id) && !state.openProjectIds.includes(id),
  );
  if (reopenedProjectId === undefined) {
    return { state, reopenedProjectId: null };
  }

  return {
    state: {
      ...state,
      openProjectIds: sortByProjectOrder(
        [...state.openProjectIds, reopenedProjectId],
        projectIds,
      ),
      recentlyClosedProjectIds: state.recentlyClosedProjectIds.filter(
        (id) => id !== reopenedProjectId,
      ),
    },
    reopenedProjectId,
  };
}

export function resolveProjectTabNavigation(
  openProjectIds: readonly string[],
  activeProjectId: string,
  key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End',
): string {
  if (openProjectIds.length === 0) return activeProjectId;
  if (key === 'Home') return openProjectIds[0]!;
  if (key === 'End') return openProjectIds.at(-1)!;

  const currentIndex = Math.max(0, openProjectIds.indexOf(activeProjectId));
  const offset = key === 'ArrowLeft' ? -1 : 1;
  const nextIndex = (currentIndex + offset + openProjectIds.length) % openProjectIds.length;
  return openProjectIds[nextIndex]!;
}

function sortByProjectOrder(
  ids: readonly string[],
  projectIds: readonly string[],
): string[] {
  const idSet = new Set(ids);
  return projectIds.filter((id) => idSet.has(id));
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
