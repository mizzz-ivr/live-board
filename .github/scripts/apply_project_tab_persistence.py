
from pathlib import Path

def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement target, found {count}")
    file_path.write_text(content.replace(old, new), encoding="utf-8")

def replace_exact(path: str, old: str, new: str, expected: int) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    count = content.count(old)
    if count != expected:
        raise RuntimeError(
            f"{path}: expected {expected} replacement targets, found {count}"
        )
    file_path.write_text(content.replace(old, new), encoding="utf-8")

def write(path: str, content: str) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")

write(
    "packages/persistence/src/editor-state.ts",
    """import type { Workspace } from '@live-board/domain';

export const MAX_PERSISTED_PROJECT_TABS = 1_024;

export interface LiveboardProjectTabsState {
  openProjectIds: string[];
  pinnedProjectIds: string[];
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
""",
)

replace_once(
    "packages/persistence/src/index.ts",
    "export * from './archive.js';\n",
    "export * from './archive.js';\nexport * from './editor-state.js';\n",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """import {
  ArchiveValidationError,
  assertSafeArchivePath,
  createStoredZip,
  readStoredZip,
} from './zip.js';
""",
    """import {
  ArchiveValidationError,
  assertSafeArchivePath,
  createStoredZip,
  readStoredZip,
} from './zip.js';
import {
  normalizeLiveboardEditorState,
  remapLiveboardEditorState,
  type LiveboardEditorState,
} from './editor-state.js';
""",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """  workspace: Workspace;
  assetLibraries: Record<string, PersistedProjectAssetLibrary>;
}

export interface LiveboardBundle {
  workspace: Workspace;
  assetLibraries: Record<string, ProjectAssetLibrary>;
}
""",
    """  workspace: Workspace;
  assetLibraries: Record<string, PersistedProjectAssetLibrary>;
  editorState?: LiveboardEditorState;
}

export interface LiveboardBundle {
  workspace: Workspace;
  assetLibraries: Record<string, ProjectAssetLibrary>;
  editorState?: LiveboardEditorState;
}
""",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """    workspace,
    assetLibraries: persistedLibraries,
  };
""",
    """    workspace,
    assetLibraries: persistedLibraries,
    editorState: normalizeLiveboardEditorState(options.editorState, workspace),
  };
""",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """  const bundle: LiveboardBundle = {
    workspace: cloneJson(manifest.workspace),
    assetLibraries,
  };
""",
    """  const bundle: LiveboardBundle = {
    workspace: cloneJson(manifest.workspace),
    assetLibraries,
    editorState:
      manifest.editorState === undefined
        ? undefined
        : cloneJson(manifest.editorState),
  };
""",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """  validateWorkspace(workspace);
  validateAssetReferences(workspace, assetLibraries);
  return { workspace, assetLibraries };
}
""",
    """  const editorState = remapLiveboardEditorState(
    bundle.editorState,
    projectIdMap,
    workspace,
  );
  validateWorkspace(workspace);
  validateAssetReferences(workspace, assetLibraries);
  return { workspace, assetLibraries, editorState };
}
""",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """        workspace,
        assetLibraries: input.assetLibraries ?? {},
      },
""",
    """        workspace,
        assetLibraries: input.assetLibraries ?? {},
        editorState: input.editorState,
      },
""",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """  const workspace = cloneJson(input.workspace as Workspace);
  const assetLibraries = parsePersistedLibraries(input.assetLibraries);
  return {
""",
    """  const workspace = cloneJson(input.workspace as Workspace);
  const assetLibraries = parsePersistedLibraries(input.assetLibraries);
  const editorState = normalizeLiveboardEditorState(input.editorState, workspace);
  return {
""",
)

replace_once(
    "packages/persistence/src/archive.ts",
    """    workspace,
    assetLibraries,
  };
}

function parsePersistedLibraries""",
    """    workspace,
    assetLibraries,
    editorState,
  };
}

function parsePersistedLibraries""",
)

replace_once(
    "apps/desktop/src/project-tabs-model.ts",
    """export interface ProjectTabsState {
  workspaceId: string;
  sessionRevision: number;
  openProjectIds: string[];
  pinnedProjectIds: string[];
  recentlyClosedTabs: RecentlyClosedProjectTab[];
}
""",
    """export interface ProjectTabsState {
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
""",
)

replace_once(
    "apps/desktop/src/project-tabs-model.ts",
    """    openProjectIds: [...projectIds],
    pinnedProjectIds: [],
    recentlyClosedTabs: [],
  };
}

export function synchronizeProjectTabsState(
""",
    """    openProjectIds: [...projectIds],
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
""",
)

old_sync = """export function synchronizeProjectTabsState(
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
    ...state.recentlyClosedTabs.map((tab) => tab.projectId),
  ]);
  const openProjectIds = state.openProjectIds.filter((id) => availableIds.has(id));
  for (const projectId of projectIds) {
    if (!knownIds.has(projectId)) openProjectIds.push(projectId);
  }
  if (availableIds.has(activeProjectId) && !openProjectIds.includes(activeProjectId)) {
    openProjectIds.push(activeProjectId);
  }

  const openSet = new Set(openProjectIds);
  const pinnedSet = new Set(
    state.pinnedProjectIds.filter((id) => availableIds.has(id) && openSet.has(id)),
  );
  const nextOpenProjectIds = normalizeOpenProjectOrder(openProjectIds, pinnedSet);
  const nextPinnedProjectIds = nextOpenProjectIds.filter((id) => pinnedSet.has(id));
  const nextOpenSet = new Set(nextOpenProjectIds);
  const nextRecentlyClosedTabs = state.recentlyClosedTabs.filter(
    (tab) => availableIds.has(tab.projectId) && !nextOpenSet.has(tab.projectId),
  );
  if (
    arraysEqual(state.openProjectIds, nextOpenProjectIds) &&
    arraysEqual(state.pinnedProjectIds, nextPinnedProjectIds) &&
    recentlyClosedTabsEqual(state.recentlyClosedTabs, nextRecentlyClosedTabs)
  ) {
    return state;
  }

  return {
    workspaceId,
    sessionRevision,
    openProjectIds: nextOpenProjectIds,
    pinnedProjectIds: nextPinnedProjectIds,
    recentlyClosedTabs: nextRecentlyClosedTabs,
  };
}
"""
new_sync = """export function synchronizeProjectTabsState(
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
"""
replace_once("apps/desktop/src/project-tabs-model.ts", old_sync, new_sync)

replace_once(
    "apps/desktop/src/project-tabs-model.ts",
    """      openProjectIds,
      recentlyClosedTabs: [
""",
    """      openProjectIds,
      closedProjectIds: [
        ...state.closedProjectIds.filter((id) => id !== projectId),
        projectId,
      ],
      recentlyClosedTabs: [
""",
)

replace_once(
    "apps/desktop/src/project-tabs-model.ts",
    """      openProjectIds: [...pinnedProjectIds, ...unpinnedProjectIds],
      recentlyClosedTabs: state.recentlyClosedTabs.filter(
""",
    """      openProjectIds: [...pinnedProjectIds, ...unpinnedProjectIds],
      closedProjectIds: state.closedProjectIds.filter(
        (projectId) => projectId !== recentlyClosedTab.projectId,
      ),
      recentlyClosedTabs: state.recentlyClosedTabs.filter(
""",
)

replace_once(
    "apps/desktop/src/project-tabs-model.ts",
    """function normalizeOpenProjectOrder(
""",
    """function uniqueAvailableProjectIds(
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
""",
)

replace_once(
    "apps/desktop/src/AppV2.tsx",
    """  const persistence = useWorkspacePersistence({
    commandState,
    assetLibraries,
    setCommandState,
    setAssetLibraries,
  });
""",
    """  const persistence = useWorkspacePersistence({
    commandState,
    assetLibraries,
    projectTabsState,
    setCommandState,
    setAssetLibraries,
    setProjectTabsState,
  });
""",
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """import {
  resolveWorkspacePersistenceIdleStatus,
  resolveWorkspacePersistenceSaveCompletion,
} from './workspace-persistence-status';
""",
    """import {
  restoreProjectTabsState,
  toPersistedProjectTabsState,
  type ProjectTabsState,
} from './project-tabs-model';
import {
  resolveWorkspacePersistenceIdleStatus,
  resolveWorkspacePersistenceSaveCompletion,
} from './workspace-persistence-status';
""",
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """  assetLibraries: Record<string, ProjectAssetLibrary>;
  setCommandState: Dispatch<SetStateAction<CanvasWorkspaceCommandState>>;
  setAssetLibraries: Dispatch<
    SetStateAction<Record<string, ProjectAssetLibrary>>
  >;
""",
    """  assetLibraries: Record<string, ProjectAssetLibrary>;
  projectTabsState: ProjectTabsState;
  setCommandState: Dispatch<SetStateAction<CanvasWorkspaceCommandState>>;
  setAssetLibraries: Dispatch<
    SetStateAction<Record<string, ProjectAssetLibrary>>
  >;
  setProjectTabsState: Dispatch<SetStateAction<ProjectTabsState>>;
""",
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """  const revisionRef = useRef(0);
  const suppressNextChangeRef = useRef(false);
  const workspaceRef = useRef(input.commandState.workspace);
  const assetLibrariesRef = useRef(input.assetLibraries);

  workspaceRef.current = input.commandState.workspace;
  assetLibrariesRef.current = input.assetLibraries;
""",
    """  const revisionRef = useRef(0);
  const workspaceSessionRevisionRef = useRef(0);
  const suppressNextChangeRef = useRef(false);
  const workspaceRef = useRef(input.commandState.workspace);
  const assetLibrariesRef = useRef(input.assetLibraries);
  const projectTabsStateRef = useRef(input.projectTabsState);

  workspaceRef.current = input.commandState.workspace;
  assetLibrariesRef.current = input.assetLibraries;
  projectTabsStateRef.current = input.projectTabsState;
""",
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """        assets: Object.fromEntries(
          Object.entries(input.assetLibraries).map(([projectId, library]) => [
            projectId,
            {
              totalBytes: library.totalBytes,
              assets: library.assets.map((asset) => ({
                id: asset.id,
                sha256: asset.sha256,
                fileNames: asset.fileNames,
              })),
            },
          ]),
        ),
      }),
    [input.commandState.workspace, input.assetLibraries],
""",
    """        assets: Object.fromEntries(
          Object.entries(input.assetLibraries).map(([projectId, library]) => [
            projectId,
            {
              totalBytes: library.totalBytes,
              assets: library.assets.map((asset) => ({
                id: asset.id,
                sha256: asset.sha256,
                fileNames: asset.fileNames,
              })),
            },
          ]),
        ),
        projectTabs: toPersistedProjectTabsState(input.projectTabsState),
        workspaceSessionRevision,
      }),
    [
      input.commandState.workspace,
      input.assetLibraries,
      input.projectTabsState,
      workspaceSessionRevision,
    ],
""",
)

replace_exact(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """        const archive = createCurrentArchive(
          workspaceRef.current,
          assetLibrariesRef.current,
        );
""",
    """        const archive = createCurrentArchive(
          workspaceRef.current,
          assetLibrariesRef.current,
          projectTabsStateRef.current,
        );
""",
    2,
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """      setLastExplicitSaveRevision(nextDocument === null ? null : 0);
      setWorkspaceSessionRevision((current) => current + 1);
      input.setCommandState(createCanvasWorkspaceCommandState(bundle.workspace));
      input.setAssetLibraries(bundle.assetLibraries);
""",
    """      setLastExplicitSaveRevision(nextDocument === null ? null : 0);
      const nextWorkspaceSessionRevision =
        workspaceSessionRevisionRef.current + 1;
      workspaceSessionRevisionRef.current = nextWorkspaceSessionRevision;
      setWorkspaceSessionRevision(nextWorkspaceSessionRevision);
      input.setCommandState(createCanvasWorkspaceCommandState(bundle.workspace));
      input.setAssetLibraries(bundle.assetLibraries);
      input.setProjectTabsState(
        restoreProjectTabsState(
          bundle.workspace.id,
          bundle.workspace.projects.map((project) => project.id),
          bundle.workspace.activeProjectId,
          bundle.editorState?.projectTabs,
          nextWorkspaceSessionRevision,
        ),
      );
""",
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """    [input.setAssetLibraries, input.setCommandState],
""",
    """    [
      input.setAssetLibraries,
      input.setCommandState,
      input.setProjectTabsState,
    ],
""",
)

replace_exact(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """          workspace: loaded.workspace,
          assetLibraries: loaded.assetLibraries,
        },
""",
    """          workspace: loaded.workspace,
          assetLibraries: loaded.assetLibraries,
          editorState: loaded.editorState,
        },
""",
    2,
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """            workspace: workspaceRef.current,
            assetLibraries: assetLibrariesRef.current,
          },
""",
    """            workspace: workspaceRef.current,
            assetLibraries: assetLibrariesRef.current,
            editorState: {
              projectTabs: toPersistedProjectTabsState(
                projectTabsStateRef.current,
              ),
            },
          },
""",
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """            workspace: loaded.workspace,
            assetLibraries: loaded.assetLibraries,
          },
""",
    """            workspace: loaded.workspace,
            assetLibraries: loaded.assetLibraries,
            editorState: loaded.editorState,
          },
""",
)

replace_once(
    "apps/desktop/src/useWorkspacePersistence.ts",
    """function createCurrentArchive(
  workspace: CanvasWorkspaceCommandState['workspace'],
  assetLibraries: Record<string, ProjectAssetLibrary>,
): Uint8Array {
  return createLiveboardArchive({
    workspace,
    assetLibraries,
    appVersion: APP_VERSION,
  });
}
""",
    """function createCurrentArchive(
  workspace: CanvasWorkspaceCommandState['workspace'],
  assetLibraries: Record<string, ProjectAssetLibrary>,
  projectTabsState: ProjectTabsState,
): Uint8Array {
  return createLiveboardArchive({
    workspace,
    assetLibraries,
    editorState: {
      projectTabs: toPersistedProjectTabsState(projectTabsState),
    },
    appVersion: APP_VERSION,
  });
}
""",
)

replace_once(
    "apps/desktop/test/project-tabs-model.test.ts",
    """  reopenLastProjectTab,
  resolveProjectTabNavigation,
  synchronizeProjectTabsState,
  toggleProjectTabPin,
""",
    """  reopenLastProjectTab,
  resolveProjectTabNavigation,
  restoreProjectTabsState,
  synchronizeProjectTabsState,
  toPersistedProjectTabsState,
  toggleProjectTabPin,
""",
)

replace_once(
    "apps/desktop/test/project-tabs-model.test.ts",
    """      openProjectIds: ['p3', 'p4'],
      pinnedProjectIds: [],
      recentlyClosedTabs: [],
""",
    """      openProjectIds: ['p3', 'p4'],
      pinnedProjectIds: [],
      closedProjectIds: [],
      recentlyClosedTabs: [],
""",
)

replace_once(
    "apps/desktop/test/project-tabs-model.test.ts",
    """      openProjectIds: ['p1', 'p2'],
      pinnedProjectIds: [],
      recentlyClosedTabs: [],
""",
    """      openProjectIds: ['p1', 'p2'],
      pinnedProjectIds: [],
      closedProjectIds: [],
      recentlyClosedTabs: [],
""",
)

replace_once(
    "apps/desktop/test/project-tabs-model.test.ts",
    """    expect(middle.state.openProjectIds).toEqual(['p1', 'p3']);
    expect(middle.nextActiveProjectId).toBe('p3');
""",
    """    expect(middle.state.openProjectIds).toEqual(['p1', 'p3']);
    expect(middle.state.closedProjectIds).toEqual(['p2']);
    expect(middle.nextActiveProjectId).toBe('p3');
""",
)

replace_once(
    "apps/desktop/test/project-tabs-model.test.ts",
    """  it('左右キーは循環し、HomeとEndで現在の表示順の端へ移動する', () => {
""",
    """  it('保存済みの表示順・Close・ピン留めを復元して新規Projectだけを追加する', () => {
    const restored = restoreProjectTabsState(
      'workspace-1',
      ['p1', 'p2', 'p3'],
      'p1',
      {
        openProjectIds: ['p3', 'p1'],
        pinnedProjectIds: ['p3'],
      },
      7,
    );

    expect(restored).toEqual({
      workspaceId: 'workspace-1',
      sessionRevision: 7,
      openProjectIds: ['p3', 'p1'],
      pinnedProjectIds: ['p3'],
      closedProjectIds: ['p2'],
      recentlyClosedTabs: [],
    });
    expect(toPersistedProjectTabsState(restored)).toEqual({
      openProjectIds: ['p3', 'p1'],
      pinnedProjectIds: ['p3'],
    });

    const synchronized = synchronizeProjectTabsState(
      restored,
      'workspace-1',
      ['p1', 'p2', 'p3', 'p4'],
      'p1',
      7,
    );
    expect(synchronized.openProjectIds).toEqual(['p3', 'p1', 'p4']);
    expect(synchronized.closedProjectIds).toEqual(['p2']);
  });

  it('保存状態にアクティブProjectがなくても開いた状態へ補正する', () => {
    const restored = restoreProjectTabsState(
      'workspace-1',
      ['p1', 'p2'],
      'p2',
      {
        openProjectIds: ['missing', 'p1', 'p1'],
        pinnedProjectIds: ['missing', 'p1'],
      },
      2,
    );
    expect(restored.openProjectIds).toEqual(['p1', 'p2']);
    expect(restored.pinnedProjectIds).toEqual(['p1']);
    expect(restored.closedProjectIds).toEqual([]);
  });

  it('左右キーは循環し、HomeとEndで現在の表示順の端へ移動する', () => {
""",
)

replace_once(
    "packages/persistence/test/archive.test.ts",
    """  createEmptyWorkspace,
  createLayer,
  createProjectAssetLibrary,
""",
    """  appendWorkspaceProject,
  createEmptyWorkspace,
  createLayer,
  createPage,
  createProject,
  createProjectAssetLibrary,
""",
)

replace_once(
    "packages/persistence/test/archive.test.ts",
    """  loadLiveboardArchive,
  readStoredZip,
""",
    """  loadLiveboardArchive,
  readStoredZip,
""",
)

replace_once(
    "packages/persistence/test/archive.test.ts",
    """function createFixture() {
""",
    """function createFixture() {
""",
)

replace_once(
    "packages/persistence/test/archive.test.ts",
    """  return { workspace, assetLibraries, imported };
}

describe('.liveboard archive', () => {
""",
    """  return { workspace, assetLibraries, imported };
}

function createTwoProjectFixture() {
  const fixture = createFixture();
  const projectId = 'project-2';
  const page = createPage({
    id: 'page-2',
    projectId,
    name: 'Page 2',
    createdAt: savedAt,
  });
  const project = createProject({
    id: projectId,
    workspaceId: fixture.workspace.id,
    name: 'Project 2',
    pages: [page],
    createdAt: savedAt,
  });
  const workspace = appendWorkspaceProject(
    fixture.workspace,
    project,
    savedAt,
  );
  return { ...fixture, workspace, project };
}

describe('.liveboard archive', () => {
""",
)

replace_once(
    "packages/persistence/test/archive.test.ts",
    """    expect(loaded.migratedFromVersion).toBeNull();
  });

  it('空のAsset Libraryを含むWorkspaceを保存できる', () => {
""",
    """    expect(loaded.migratedFromVersion).toBeNull();
    expect(loaded.editorState).toBeUndefined();
  });

  it('Projectタブの表示状態をmanifestへ保存・再読込できる', () => {
    const fixture = createTwoProjectFixture();
    const firstProjectId = fixture.workspace.projects[0]!.id;
    const archive = createLiveboardArchive({
      workspace: fixture.workspace,
      assetLibraries: fixture.assetLibraries,
      editorState: {
        projectTabs: {
          openProjectIds: [fixture.project.id],
          pinnedProjectIds: [fixture.project.id],
        },
      },
      savedAt,
    });

    const loaded = loadLiveboardArchive(archive);
    expect(loaded.editorState).toEqual({
      projectTabs: {
        openProjectIds: [fixture.project.id],
        pinnedProjectIds: [fixture.project.id],
      },
    });
    expect(loaded.editorState?.projectTabs?.openProjectIds).not.toContain(
      firstProjectId,
    );
    expect(loaded.manifest.schemaVersion).toBe(1);
  });

  it('不明・重複Project IDを除外し、アクティブProjectを必ず開く', () => {
    const fixture = createTwoProjectFixture();
    const activeProjectId = fixture.workspace.activeProjectId;
    const archive = createLiveboardArchive({
      workspace: fixture.workspace,
      assetLibraries: fixture.assetLibraries,
      editorState: {
        projectTabs: {
          openProjectIds: ['missing', activeProjectId, activeProjectId],
          pinnedProjectIds: ['missing', activeProjectId],
        },
      },
      savedAt,
    });

    const loaded = loadLiveboardArchive(archive);
    expect(loaded.editorState).toEqual({
      projectTabs: {
        openProjectIds: [activeProjectId],
        pinnedProjectIds: [activeProjectId],
      },
    });
  });

  it('不正なeditorStateはWorkspaceを壊さず既定状態へフォールバックする', () => {
    const fixture = createFixture();
    const archive = createLiveboardArchive({
      workspace: fixture.workspace,
      assetLibraries: fixture.assetLibraries,
      editorState: {
        projectTabs: {
          openProjectIds: 'invalid',
          pinnedProjectIds: [],
        },
      } as never,
      savedAt,
    });
    const loaded = loadLiveboardArchive(archive);
    expect(loaded.editorState).toBeUndefined();
  });

  it('空のAsset Libraryを含むWorkspaceを保存できる', () => {
""",
)

replace_once(
    "packages/persistence/test/archive.test.ts",
    """  it('複製後も元Bundleを変更しない', () => {
    const fixture = createFixture();
    const before = JSON.stringify(fixture);
    const duplicated = duplicateLiveboardBundle(
      { workspace: fixture.workspace, assetLibraries: fixture.assetLibraries },
      'workspace-copy',
      savedAt,
    );
    expect(JSON.stringify(fixture)).toBe(before);
    expect(duplicated.workspace.id).toBe('workspace-copy');
    expect(duplicated.workspace.name).toContain('コピー');
  });
""",
    """  it('複製後も元Bundleを変更せず、ProjectタブIDを再採番する', () => {
    const fixture = createTwoProjectFixture();
    const bundle = {
      workspace: fixture.workspace,
      assetLibraries: fixture.assetLibraries,
      editorState: {
        projectTabs: {
          openProjectIds: [fixture.project.id],
          pinnedProjectIds: [fixture.project.id],
        },
      },
    };
    const before = JSON.stringify(bundle);
    const duplicated = duplicateLiveboardBundle(
      bundle,
      'workspace-copy',
      savedAt,
    );
    expect(JSON.stringify(bundle)).toBe(before);
    expect(duplicated.workspace.id).toBe('workspace-copy');
    expect(duplicated.workspace.name).toContain('コピー');
    expect(duplicated.editorState).toEqual({
      projectTabs: {
        openProjectIds: ['workspace-copy:project:2'],
        pinnedProjectIds: ['workspace-copy:project:2'],
      },
    });
  });
""",
)

replace_once(
    "docs/project-tabs.md",
    """`.liveboard`へ保存される正本は既存Workspaceモデルです。
""",
    """`.liveboard`へ保存される正本は既存Workspaceモデルと任意のEditor表示状態です。
""",
)

replace_once(
    "docs/project-tabs.md",
    """- Project単位のAsset Library

Project追加・複製・削除・選択・名前変更はWorkspaceを変更するため、既存のrevision検知、自動保存、明示保存へ合流します。保存形式とIPCは変更しません。
""",
    """- Project単位のAsset Library
- `editorState.projectTabs`の開いているタブ順とピン留め順

Project追加・複製・削除・選択・名前変更に加えて、タブのClose・ピン留め・並び替えも既存のrevision検知、自動保存、明示保存へ合流します。タブ操作はWorkspace Command履歴には追加しません。manifest schemaVersionとIPCは変更しません。
""",
)

replace_once(
    "docs/project-tabs.md",
    """## Rendererセッションだけの状態

次は同一Rendererプロセス内だけで保持します。

- 開いているProjectタブと表示順
- ピン留めしたProjectタブとピン留め領域内の順序
- 直近に閉じた通常タブと閉じる前の位置（最大10件）
""",
    """## Editor表示状態とRendererセッション

次は`.liveboard`の任意`editorState.projectTabs`へ保存します。

- 開いているProjectタブと表示順
- ピン留めしたProjectタブとピン留め領域内の順序

次は同一Rendererプロセス内だけで保持し、保存しません。

- 直近に閉じた通常タブと閉じる前の位置（最大10件）
""",
)

replace_once(
    "docs/project-tabs.md",
    """タブ状態は`AppV2`でEditorセッションとして保持します。そのため、ホームへ戻って「編集を続ける」を選んだ場合は、開いているタブ、並び順、ピン留め、復元履歴を維持します。

一方、Workspaceの新規作成、ファイル読込、最近使用からの読込、インポート、クラッシュ復元などでBundleを再適用した場合は、`workspaceSessionRevision`を更新します。同じWorkspace IDを再読込した場合でも、セッションrevisionの変更を検知して全Projectを元のProject順で開き直し、以前の並び順・ピン留め・閉じたタブ履歴を持ち越しません。
""",
    """タブ状態は`AppV2`でEditorセッションとして保持します。ホームへ戻って「編集を続ける」を選んだ場合は、開いているタブ、並び順、ピン留め、復元履歴を維持します。

Workspaceのファイル読込、最近使用からの読込、クラッシュ復元では、保存済みの開いているタブ順とピン留め順を復元します。直近に閉じたタブ履歴は持ち越しません。保存状態がない既存Archiveは全ProjectをWorkspace順で開きます。存在しないID・重複IDは除外し、`activeProjectId`は必ず開いた状態へ補正します。Workspace複製・インポートではProject IDの再採番へ追従します。
""",
)

replace_once(
    "docs/project-tabs.md",
    """タブ順とピン留め状態はProject本体の順序を変更せず、`.liveboard`へ保存しません。
""",
    """タブ順・Close状態・ピン留め状態はProject本体の順序を変更せず、任意のEditor表示状態として`.liveboard`へ保存します。
""",
)

replace_once(
    "docs/project-tabs.md",
    """- 同一Workspace ID再読込ではタブ状態を初期化する
""",
    """- 同一Workspace ID再読込でも保存済みタブ状態を復元する
- editorStateがない既存Archiveは全ProjectをWorkspace順で開く
- 不正なProject IDを除外し、アクティブProjectを必ず開く
- Workspace複製時に保存済みProjectタブIDを再採番する
""",
)

replace_once(
    "docs/project-tabs.md",
    """- Project本体の並び順変更
- タブ状態の永続化
- 別ウィンドウへの分離
""",
    """- Project本体の並び順変更
- 直近に閉じたタブ履歴の永続化
- 別ウィンドウへの分離
""",
)

print("Project tab persistence implementation applied")
