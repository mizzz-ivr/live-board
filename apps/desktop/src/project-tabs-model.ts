const RECENTLY_CLOSED_LIMIT = 10;

export interface RecentlyClosedProjectTab {
  projectId: string;
  unpinnedIndex: number;
}

export interface ProjectTabsState {
  workspaceId: string;
  sessionRevision: number;
  openProjectIds: string[];
  pinnedProjectIds: string[];
  closedProjectIds: string[];
  recentlyClosedTabs: RecentlyClosedProjectTab[];
}

export interface PersistedProjectTabsState {
  readonly openProjectIds: readonly string[];
  readonly pinnedProjectIds: readonly string[];
}

export type ProjectTabDropPosition = 'before' | 'after';

export function createProjectTabsState(
  workspaceId: string,
  projectIds: readonly string[],
  sessionRevision = 0,
): ProjectTabsState {
  return {
    workspaceId,
    sessionRevision,
    openProjectIds: [...projectIds],
    pinnedProjectIds: [],
    closedProjectIds: [],
    recentlyClosedTabs: [],
  };
}

export function restoreProjectTabsState(
  workspaceId: string,
  projectIds: readonly string[],
  activeProjectId: string,
  persistedState: PersistedProjectTabsState | undefined,
  sessionRevision = 0,
): ProjectTabsState {
  if (persistedState === undefined) {
    return createProjectTabsState(workspaceId, projectIds, sessionRevision);
  }

  const availableIds = new Set(projectIds);
  const openProjectIds = uniqueAvailableProjectIds(
    persistedState.openProjectIds,
    availableIds,
  );
  if (availableIds.has(activeProjectId) && !openProjectIds.includes(activeProjectId)) {
    openProjectIds.push(activeProjectId);
  }
  if (openProjectIds.length === 0 && projectIds[0] !== undefined) {
    openProjectIds.push(projectIds[0]);
  }

  const openSet = new Set(openProjectIds);
  const pinnedSet = new Set(
    uniqueAvailableProjectIds(persistedState.pinnedProjectIds, availableIds).filter(
      (projectId) => openSet.has(projectId),
    ),
  );
  const normalizedOpenProjectIds = normalizeOpenProjectOrder(
    openProjectIds,
    pinnedSet,
  );
  const normalizedOpenSet = new Set(normalizedOpenProjectIds);

  return {
    workspaceId,
    sessionRevision,
    openProjectIds: normalizedOpenProjectIds,
    pinnedProjectIds: normalizedOpenProjectIds.filter((projectId) =>
      pinnedSet.has(projectId),
    ),
    closedProjectIds: projectIds.filter(
      (projectId) => !normalizedOpenSet.has(projectId),
    ),
    recentlyClosedTabs: [],
  };
}

export function toPersistedProjectTabsState(
  state: ProjectTabsState,
): PersistedProjectTabsState {
  return {
    openProjectIds: [...state.openProjectIds],
    pinnedProjectIds: [...state.pinnedProjectIds],
  };
}

export function synchronizeProjectTabsState(
  state: ProjectTabsState,
  workspaceId: string,
  projectIds: readonly string[],
  activeProjectId: string,
  sessionRevision = 0,
): ProjectTabsState {
  if (
    state.workspaceId !== workspaceId ||
    state.sessionRevision !== sessionRevision
  ) {
    return createProjectTabsState(workspaceId, projectIds, sessionRevision);
  }

  const availableIds = new Set(projectIds);
  const knownIds = new Set([
    ...state.openProjectIds,
    ...state.closedProjectIds,
    ...state.recentlyClosedTabs.map((tab) => tab.projectId),
  ]);
  const openProjectIds = state.openProjectIds.filter((id) => availableIds.has(id));
  let closedProjectIds = state.closedProjectIds.filter(
    (id) => availableIds.has(id) && !openProjectIds.includes(id),
  );
  for (const projectId of projectIds) {
    if (!knownIds.has(projectId)) openProjectIds.push(projectId);
  }
  if (availableIds.has(activeProjectId) && !openProjectIds.includes(activeProjectId)) {
    openProjectIds.push(activeProjectId);
    closedProjectIds = closedProjectIds.filter((id) => id !== activeProjectId);
  }

  const openSet = new Set(openProjectIds);
  closedProjectIds = closedProjectIds.filter((id) => !openSet.has(id));
  const pinnedSet = new Set(
    state.pinnedProjectIds.filter((id) => availableIds.has(id) && openSet.has(id)),
  );
  const nextOpenProjectIds = normalizeOpenProjectOrder(openProjectIds, pinnedSet);
  const nextPinnedProjectIds = nextOpenProjectIds.filter((id) => pinnedSet.has(id));
  const nextOpenSet = new Set(nextOpenProjectIds);
  const nextClosedProjectIds = projectIds.filter(
    (projectId) =>
      closedProjectIds.includes(projectId) && !nextOpenSet.has(projectId),
  );
  const nextRecentlyClosedTabs = state.recentlyClosedTabs.filter(
    (tab) =>
      availableIds.has(tab.projectId) &&
      nextClosedProjectIds.includes(tab.projectId) &&
      !nextOpenSet.has(tab.projectId),
  );
  if (
    arraysEqual(state.openProjectIds, nextOpenProjectIds) &&
    arraysEqual(state.pinnedProjectIds, nextPinnedProjectIds) &&
    arraysEqual(state.closedProjectIds, nextClosedProjectIds) &&
    recentlyClosedTabsEqual(state.recentlyClosedTabs, nextRecentlyClosedTabs)
  ) {
    return state;
  }

  return {
    workspaceId,
    sessionRevision,
    openProjectIds: nextOpenProjectIds,
    pinnedProjectIds: nextPinnedProjectIds,
    closedProjectIds: nextClosedProjectIds,
    recentlyClosedTabs: nextRecentlyClosedTabs,
  };
}

export function isProjectTabPinned(
  state: ProjectTabsState,
  projectId: string,
): boolean {
  return state.pinnedProjectIds.includes(projectId);
}

export function toggleProjectTabPin(
  state: ProjectTabsState,
  projectId: string,
): ProjectTabsState {
  if (!state.openProjectIds.includes(projectId)) return state;

  const pinnedSet = new Set(state.pinnedProjectIds);
  if (pinnedSet.has(projectId)) pinnedSet.delete(projectId);
  else pinnedSet.add(projectId);

  const openProjectIds = normalizeOpenProjectOrder(state.openProjectIds, pinnedSet);
  const pinnedProjectIds = openProjectIds.filter((id) => pinnedSet.has(id));
  if (
    arraysEqual(state.openProjectIds, openProjectIds) &&
    arraysEqual(state.pinnedProjectIds, pinnedProjectIds)
  ) {
    return state;
  }

  return {
    ...state,
    openProjectIds,
    pinnedProjectIds,
  };
}

export function canMoveProjectTab(
  state: ProjectTabsState,
  projectId: string,
  targetProjectId: string,
): boolean {
  return (
    projectId !== targetProjectId &&
    state.openProjectIds.includes(projectId) &&
    state.openProjectIds.includes(targetProjectId) &&
    isProjectTabPinned(state, projectId) === isProjectTabPinned(state, targetProjectId)
  );
}

export function moveProjectTab(
  state: ProjectTabsState,
  projectId: string,
  targetProjectId: string,
  position: ProjectTabDropPosition,
): ProjectTabsState {
  if (!canMoveProjectTab(state, projectId, targetProjectId)) return state;

  const openProjectIds = state.openProjectIds.filter((id) => id !== projectId);
  const targetIndex = openProjectIds.indexOf(targetProjectId);
  const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
  openProjectIds.splice(insertIndex, 0, projectId);
  if (arraysEqual(state.openProjectIds, openProjectIds)) return state;

  return {
    ...state,
    openProjectIds,
    pinnedProjectIds: openProjectIds.filter((id) =>
      state.pinnedProjectIds.includes(id),
    ),
  };
}

export function moveProjectTabByOffset(
  state: ProjectTabsState,
  projectId: string,
  offset: -1 | 1,
): ProjectTabsState {
  if (!state.openProjectIds.includes(projectId)) return state;

  const pinned = isProjectTabPinned(state, projectId);
  const groupIds = state.openProjectIds.filter(
    (id) => isProjectTabPinned(state, id) === pinned,
  );
  const currentIndex = groupIds.indexOf(projectId);
  const nextIndex = currentIndex + offset;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= groupIds.length) return state;

  const targetProjectId = groupIds[nextIndex]!;
  return moveProjectTab(
    state,
    projectId,
    targetProjectId,
    offset < 0 ? 'before' : 'after',
  );
}

export function closeProjectTab(
  state: ProjectTabsState,
  projectId: string,
  activeProjectId: string,
): { state: ProjectTabsState; nextActiveProjectId: string } {
  const closeIndex = state.openProjectIds.indexOf(projectId);
  if (
    closeIndex < 0 ||
    state.openProjectIds.length <= 1 ||
    isProjectTabPinned(state, projectId)
  ) {
    return { state, nextActiveProjectId: activeProjectId };
  }

  const unpinnedProjectIds = state.openProjectIds.filter(
    (id) => !isProjectTabPinned(state, id),
  );
  const unpinnedIndex = unpinnedProjectIds.indexOf(projectId);
  const openProjectIds = state.openProjectIds.filter((id) => id !== projectId);
  const nextActiveProjectId = activeProjectId === projectId
    ? openProjectIds[Math.min(closeIndex, openProjectIds.length - 1)]!
    : activeProjectId;

  return {
    state: {
      ...state,
      openProjectIds,
      closedProjectIds: [
        ...state.closedProjectIds.filter((id) => id !== projectId),
        projectId,
      ],
      recentlyClosedTabs: [
        { projectId, unpinnedIndex },
        ...state.recentlyClosedTabs.filter((tab) => tab.projectId !== projectId),
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
  const recentlyClosedTab =
    state.recentlyClosedTabs.find(
      (tab) =>
        availableIds.has(tab.projectId) &&
        !state.openProjectIds.includes(tab.projectId),
    ) ?? restoreClosedProjectTabCandidate(state, projectIds);
  if (recentlyClosedTab === undefined) {
    return { state, reopenedProjectId: null };
  }

  const pinnedProjectIds = state.openProjectIds.filter((id) =>
    isProjectTabPinned(state, id),
  );
  const unpinnedProjectIds = state.openProjectIds.filter(
    (id) => !isProjectTabPinned(state, id),
  );
  unpinnedProjectIds.splice(
    Math.min(recentlyClosedTab.unpinnedIndex, unpinnedProjectIds.length),
    0,
    recentlyClosedTab.projectId,
  );

  return {
    state: {
      ...state,
      openProjectIds: [...pinnedProjectIds, ...unpinnedProjectIds],
      closedProjectIds: state.closedProjectIds.filter(
        (projectId) => projectId !== recentlyClosedTab.projectId,
      ),
      recentlyClosedTabs: state.recentlyClosedTabs.filter(
        (tab) => tab.projectId !== recentlyClosedTab.projectId,
      ),
    },
    reopenedProjectId: recentlyClosedTab.projectId,
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

function restoreClosedProjectTabCandidate(
  state: ProjectTabsState,
  projectIds: readonly string[],
): RecentlyClosedProjectTab | undefined {
  const projectId = projectIds.find(
    (candidate) =>
      state.closedProjectIds.includes(candidate) &&
      !state.openProjectIds.includes(candidate),
  );
  if (projectId === undefined) return undefined;

  const unpinnedProjectIds = projectIds.filter(
    (candidate) => !state.pinnedProjectIds.includes(candidate),
  );
  return {
    projectId,
    unpinnedIndex: Math.max(0, unpinnedProjectIds.indexOf(projectId)),
  };
}

function uniqueAvailableProjectIds(
  projectIds: readonly string[],
  availableIds: ReadonlySet<string>,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const projectId of projectIds) {
    if (availableIds.has(projectId) && !seen.has(projectId)) {
      seen.add(projectId);
      result.push(projectId);
    }
  }
  return result;
}

function normalizeOpenProjectOrder(
  openProjectIds: readonly string[],
  pinnedProjectIds: ReadonlySet<string>,
): string[] {
  return [
    ...openProjectIds.filter((id) => pinnedProjectIds.has(id)),
    ...openProjectIds.filter((id) => !pinnedProjectIds.has(id)),
  ];
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function recentlyClosedTabsEqual(
  left: readonly RecentlyClosedProjectTab[],
  right: readonly RecentlyClosedProjectTab[],
): boolean {
  return left.length === right.length && left.every(
    (value, index) =>
      value.projectId === right[index]?.projectId &&
      value.unpinnedIndex === right[index]?.unpinnedIndex,
  );
}
