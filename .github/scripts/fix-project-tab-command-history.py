from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding='utf-8')
    if old not in content:
        raise RuntimeError(f'anchor not found: {path}\n{old[:200]}')
    file_path.write_text(content.replace(old, new, 1), encoding='utf-8')


def write(path: str, content: str) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding='utf-8')


write(
    'packages/domain/src/workspace-commands.ts',
    """import {
  DomainError,
  cloneProject,
  type Project,
  type ProjectId,
  type Workspace,
  type WorkspaceId,
} from './model.js';
import {
  appendWorkspaceProject,
  selectWorkspaceProject,
} from './workspace-projects.js';

export interface WorkspaceCommandMetadata {
  commandId: string;
  createdAt: string;
}

export interface AddProjectCommand extends WorkspaceCommandMetadata {
  type: 'workspace.project.add';
  workspaceId: WorkspaceId;
  project: Project;
}

export interface SelectProjectCommand extends WorkspaceCommandMetadata {
  type: 'workspace.project.select';
  workspaceId: WorkspaceId;
  projectId: ProjectId;
}

export type WorkspaceCommand = AddProjectCommand | SelectProjectCommand;

export interface WorkspaceCommandResult {
  workspace: Workspace;
  changed: boolean;
}

export function createAddProjectCommand(
  workspaceId: WorkspaceId,
  project: Project,
  metadata: WorkspaceCommandMetadata,
): AddProjectCommand {
  return {
    type: 'workspace.project.add',
    workspaceId,
    project: cloneProject(project),
    ...metadata,
  };
}

export function createSelectProjectCommand(
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  metadata: WorkspaceCommandMetadata,
): SelectProjectCommand {
  return {
    type: 'workspace.project.select',
    workspaceId,
    projectId,
    ...metadata,
  };
}

export function applyWorkspaceCommand(
  workspace: Workspace,
  command: WorkspaceCommand,
): WorkspaceCommandResult {
  if (workspace.id !== command.workspaceId) {
    throw new DomainError(
      'WORKSPACE_NOT_FOUND',
      `Workspace not found: ${command.workspaceId}`,
    );
  }

  if (command.type === 'workspace.project.add') {
    return {
      workspace: appendWorkspaceProject(workspace, command.project, command.createdAt),
      changed: true,
    };
  }

  const nextWorkspace = selectWorkspaceProject(
    workspace,
    command.projectId,
    command.createdAt,
  );
  return {
    workspace: nextWorkspace,
    changed: nextWorkspace !== workspace,
  };
}
""",
)

write(
    'packages/domain/src/history.ts',
    """import {
  assertWorkspaceIntegrity,
  cloneProject,
  findProject,
  replaceProject,
  type PageId,
  type Project,
  type ProjectId,
  type Workspace,
} from './model.js';
import {
  applyProjectCommand,
  type ProjectCommand,
} from './commands.js';
import {
  applyWorkspaceCommand,
  type AddProjectCommand,
  type SelectProjectCommand,
  type WorkspaceCommand,
} from './workspace-commands.js';
import {
  appendWorkspaceProject,
  selectWorkspaceProject,
} from './workspace-projects.js';

const DEFAULT_WORKSPACE_HISTORY_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;

interface WorkspaceHistoryEntryBase {
  historyId: string;
  previousActiveProjectId: ProjectId;
  estimatedBytes: number;
}

export interface AddProjectWorkspaceHistoryEntry
  extends WorkspaceHistoryEntryBase {
  command: AddProjectCommand;
  projectSnapshot: Project;
}

export interface SelectProjectWorkspaceHistoryEntry
  extends WorkspaceHistoryEntryBase {
  command: SelectProjectCommand;
}

export type WorkspaceHistoryEntry =
  | AddProjectWorkspaceHistoryEntry
  | SelectProjectWorkspaceHistoryEntry;

export interface WorkspaceHistoryStack {
  past: WorkspaceHistoryEntry[];
  future: WorkspaceHistoryEntry[];
}

export interface HistoryEntry {
  historyId: string;
  command: ProjectCommand;
  beforeProject: Project;
  afterProject: Project;
  estimatedBytes: number;
}

export interface HistoryStack {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export interface CommandHistories {
  workspace: WorkspaceHistoryStack;
  project: Record<ProjectId, HistoryStack>;
  page: Record<PageId, HistoryStack>;
}

export interface WorkspaceCommandState {
  workspace: Workspace;
  histories: CommandHistories;
  historyLimit: number;
  workspaceHistoryMemoryLimitBytes: number;
}

export function createWorkspaceCommandState(
  workspace: Workspace,
  historyLimit = 100,
  workspaceHistoryMemoryLimitBytes = DEFAULT_WORKSPACE_HISTORY_MEMORY_LIMIT_BYTES,
): WorkspaceCommandState {
  if (!Number.isInteger(historyLimit) || historyLimit < 1 || historyLimit > 1000) {
    throw new Error(`Invalid history limit: ${historyLimit}`);
  }
  if (
    !Number.isSafeInteger(workspaceHistoryMemoryLimitBytes) ||
    workspaceHistoryMemoryLimitBytes < 1024 ||
    workspaceHistoryMemoryLimitBytes > 1024 * 1024 * 1024
  ) {
    throw new Error(
      `Invalid workspace history memory limit: ${workspaceHistoryMemoryLimitBytes}`,
    );
  }

  return {
    workspace,
    histories: {
      workspace: { past: [], future: [] },
      project: {},
      page: {},
    },
    historyLimit,
    workspaceHistoryMemoryLimitBytes,
  };
}

export function dispatchWorkspaceCommand(
  state: WorkspaceCommandState,
  command: WorkspaceCommand,
): WorkspaceCommandState {
  const previousActiveProjectId = state.workspace.activeProjectId;
  const result = applyWorkspaceCommand(state.workspace, command);
  if (!result.changed) return state;

  const entry = createWorkspaceHistoryEntry(
    result.workspace,
    command,
    previousActiveProjectId,
  );
  const past = trimWorkspaceHistory(
    [...state.histories.workspace.past, entry].slice(-state.historyLimit),
    state.workspaceHistoryMemoryLimitBytes,
  );

  return retainReachableCommandHistories({
    ...state,
    workspace: result.workspace,
    histories: {
      workspace: { past, future: [] },
      project: state.histories.project,
      page: state.histories.page,
    },
  });
}

export function undoWorkspaceCommand(
  state: WorkspaceCommandState,
): WorkspaceCommandState {
  const entry = state.histories.workspace.past.at(-1);
  if (entry === undefined) return state;

  const undone = undoWorkspaceHistoryEntry(state.workspace, entry);
  const future = trimWorkspaceHistory(
    [...state.histories.workspace.future, undone.futureEntry],
    state.workspaceHistoryMemoryLimitBytes,
  );

  return retainReachableCommandHistories({
    ...state,
    workspace: undone.workspace,
    histories: {
      workspace: {
        past: state.histories.workspace.past.slice(0, -1),
        future,
      },
      project: state.histories.project,
      page: state.histories.page,
    },
  });
}

export function redoWorkspaceCommand(
  state: WorkspaceCommandState,
): WorkspaceCommandState {
  const entry = state.histories.workspace.future.at(-1);
  if (entry === undefined) return state;

  const redone = redoWorkspaceHistoryEntry(state.workspace, entry);
  const past = trimWorkspaceHistory(
    [...state.histories.workspace.past, redone.pastEntry].slice(-state.historyLimit),
    state.workspaceHistoryMemoryLimitBytes,
  );

  return retainReachableCommandHistories({
    ...state,
    workspace: redone.workspace,
    histories: {
      workspace: {
        past,
        future: state.histories.workspace.future.slice(0, -1),
      },
      project: state.histories.project,
      page: state.histories.page,
    },
  });
}

export function getWorkspaceHistory(
  state: WorkspaceCommandState,
): WorkspaceHistoryStack {
  return state.histories.workspace;
}

export function getWorkspaceHistoryBytes(
  state: WorkspaceCommandState,
): number {
  return [
    ...state.histories.workspace.past,
    ...state.histories.workspace.future,
  ].reduce((total, entry) => total + entry.estimatedBytes, 0);
}

export function canUndoWorkspace(state: WorkspaceCommandState): boolean {
  return state.histories.workspace.past.length > 0;
}

export function canRedoWorkspace(state: WorkspaceCommandState): boolean {
  return state.histories.workspace.future.length > 0;
}

export function getWorkspaceHistoryRestorableProjects(
  state: WorkspaceCommandState,
): Project[] {
  return state.histories.workspace.future.flatMap((entry) =>
    entry.command.type === 'workspace.project.add'
      ? [cloneProject(entry.projectSnapshot)]
      : [],
  );
}

export function getWorkspaceHistoryRetainedProjectIds(
  state: WorkspaceCommandState,
): ProjectId[] {
  return [
    ...new Set([
      ...state.workspace.projects.map((project) => project.id),
      ...getWorkspaceHistoryRestorableProjects(state).map((project) => project.id),
    ]),
  ];
}

export function dispatchProjectCommand(
  state: WorkspaceCommandState,
  command: ProjectCommand,
): WorkspaceCommandState {
  const beforeProject = cloneProject(findProject(state.workspace, command.targetId));
  const result = applyProjectCommand(state.workspace, command);

  if (!result.changed) return state;

  const afterProject = cloneProject(findProject(result.workspace, command.targetId));
  const entry: HistoryEntry = {
    historyId: `history:${command.commandId}`,
    command,
    beforeProject,
    afterProject,
    estimatedBytes: estimateHistoryBytes(beforeProject, afterProject, command),
  };
  const currentStack = getProjectHistory(state, command.targetId);
  const past = [...currentStack.past, entry].slice(-state.historyLimit);

  return {
    ...state,
    workspace: result.workspace,
    histories: {
      workspace: state.histories.workspace,
      project: {
        ...state.histories.project,
        [command.targetId]: { past, future: [] },
      },
      page: state.histories.page,
    },
  };
}

export function undoProjectCommand(
  state: WorkspaceCommandState,
  projectId: ProjectId,
): WorkspaceCommandState {
  const currentStack = getProjectHistory(state, projectId);
  const entry = currentStack.past.at(-1);
  if (entry === undefined) return state;

  const workspace = replaceProject(
    state.workspace,
    entry.beforeProject,
    new Date().toISOString(),
  );

  return {
    ...state,
    workspace,
    histories: {
      workspace: state.histories.workspace,
      project: {
        ...state.histories.project,
        [projectId]: {
          past: currentStack.past.slice(0, -1),
          future: [...currentStack.future, entry],
        },
      },
      page: state.histories.page,
    },
  };
}

export function redoProjectCommand(
  state: WorkspaceCommandState,
  projectId: ProjectId,
): WorkspaceCommandState {
  const currentStack = getProjectHistory(state, projectId);
  const entry = currentStack.future.at(-1);
  if (entry === undefined) return state;

  const workspace = replaceProject(
    state.workspace,
    entry.afterProject,
    new Date().toISOString(),
  );

  return {
    ...state,
    workspace,
    histories: {
      workspace: state.histories.workspace,
      project: {
        ...state.histories.project,
        [projectId]: {
          past: [...currentStack.past, entry].slice(-state.historyLimit),
          future: currentStack.future.slice(0, -1),
        },
      },
      page: state.histories.page,
    },
  };
}

export function getProjectHistory(
  state: WorkspaceCommandState,
  projectId: ProjectId,
): HistoryStack {
  return state.histories.project[projectId] ?? EMPTY_HISTORY;
}

export function getPageHistory(
  state: WorkspaceCommandState,
  pageId: PageId,
): HistoryStack {
  return state.histories.page[pageId] ?? EMPTY_HISTORY;
}

export function canUndoProject(
  state: WorkspaceCommandState,
  projectId: ProjectId,
): boolean {
  return getProjectHistory(state, projectId).past.length > 0;
}

export function canRedoProject(
  state: WorkspaceCommandState,
  projectId: ProjectId,
): boolean {
  return getProjectHistory(state, projectId).future.length > 0;
}

export function clearProjectHistory(
  state: WorkspaceCommandState,
  projectId: ProjectId,
): WorkspaceCommandState {
  if (state.histories.project[projectId] === undefined) return state;

  const projectHistories = { ...state.histories.project };
  delete projectHistories[projectId];
  return {
    ...state,
    histories: {
      workspace: state.histories.workspace,
      project: projectHistories,
      page: state.histories.page,
    },
  };
}

function createWorkspaceHistoryEntry(
  workspace: Workspace,
  command: WorkspaceCommand,
  previousActiveProjectId: ProjectId,
): WorkspaceHistoryEntry {
  if (command.type === 'workspace.project.add') {
    return withWorkspaceHistoryEstimate({
      historyId: `workspace-history:${command.commandId}`,
      command,
      previousActiveProjectId,
      projectSnapshot: cloneProject(findProject(workspace, command.project.id)),
    });
  }
  return withWorkspaceHistoryEstimate({
    historyId: `workspace-history:${command.commandId}`,
    command,
    previousActiveProjectId,
  });
}

function undoWorkspaceHistoryEntry(
  workspace: Workspace,
  entry: WorkspaceHistoryEntry,
): { workspace: Workspace; futureEntry: WorkspaceHistoryEntry } {
  const updatedAt = new Date().toISOString();
  if (entry.command.type === 'workspace.project.add') {
    const projectSnapshot = cloneProject(
      findProject(workspace, entry.command.project.id),
    );
    return {
      workspace: removeAddedProject(
        workspace,
        entry.command.project.id,
        entry.previousActiveProjectId,
        updatedAt,
      ),
      futureEntry: withWorkspaceHistoryEstimate({
        ...entry,
        projectSnapshot,
      }),
    };
  }
  return {
    workspace: selectWorkspaceProject(
      workspace,
      entry.previousActiveProjectId,
      updatedAt,
    ),
    futureEntry: entry,
  };
}

function redoWorkspaceHistoryEntry(
  workspace: Workspace,
  entry: WorkspaceHistoryEntry,
): { workspace: Workspace; pastEntry: WorkspaceHistoryEntry } {
  const updatedAt = new Date().toISOString();
  const previousActiveProjectId = workspace.activeProjectId;
  if (entry.command.type === 'workspace.project.add') {
    return {
      workspace: appendWorkspaceProject(
        workspace,
        entry.projectSnapshot,
        updatedAt,
      ),
      pastEntry: withWorkspaceHistoryEstimate({
        ...entry,
        previousActiveProjectId,
      }),
    };
  }
  return {
    workspace: selectWorkspaceProject(
      workspace,
      entry.command.projectId,
      updatedAt,
    ),
    pastEntry: withWorkspaceHistoryEstimate({
      ...entry,
      previousActiveProjectId,
    }),
  };
}

function removeAddedProject(
  workspace: Workspace,
  projectId: ProjectId,
  previousActiveProjectId: ProjectId,
  updatedAt: string,
): Workspace {
  findProject(workspace, projectId);
  const projects = workspace.projects.filter((project) => project.id !== projectId);
  if (projects.length === 0) {
    throw new Error('WORKSPACE_PROJECT_REQUIRED');
  }
  const preferredActiveProjectId = projects.some(
    (project) => project.id === previousActiveProjectId,
  )
    ? previousActiveProjectId
    : projects[0]!.id;
  const activeProjectId = projects.some(
    (project) => project.id === workspace.activeProjectId,
  )
    ? workspace.activeProjectId
    : preferredActiveProjectId;
  const nextWorkspace: Workspace = {
    ...workspace,
    projects,
    activeProjectId,
    updatedAt,
  };
  assertWorkspaceIntegrity(nextWorkspace);
  return nextWorkspace;
}

function retainReachableCommandHistories(
  state: WorkspaceCommandState,
): WorkspaceCommandState {
  const retainedProjects = [
    ...state.workspace.projects,
    ...getWorkspaceHistoryRestorableProjects(state),
  ];
  const projectIds = new Set(retainedProjects.map((project) => project.id));
  const pageIds = new Set(
    retainedProjects.flatMap((project) => project.pages.map((page) => page.id)),
  );
  return {
    ...state,
    histories: {
      workspace: state.histories.workspace,
      project: Object.fromEntries(
        Object.entries(state.histories.project).filter(([projectId]) =>
          projectIds.has(projectId),
        ),
      ),
      page: Object.fromEntries(
        Object.entries(state.histories.page).filter(([pageId]) => pageIds.has(pageId)),
      ),
    },
  };
}

function withWorkspaceHistoryEstimate<T extends Omit<WorkspaceHistoryEntry, 'estimatedBytes'>>(
  entry: T,
): T & { estimatedBytes: number } {
  return {
    ...entry,
    estimatedBytes: utf8ByteLength(JSON.stringify(entry)),
  };
}

function trimWorkspaceHistory(
  entries: WorkspaceHistoryEntry[],
  limitBytes: number,
): WorkspaceHistoryEntry[] {
  const next = [...entries];
  let total = next.reduce((sum, entry) => sum + entry.estimatedBytes, 0);
  while (next.length > 0 && total > limitBytes) {
    total -= next.shift()!.estimatedBytes;
  }
  return next;
}

const EMPTY_HISTORY: HistoryStack = Object.freeze({
  past: Object.freeze([]) as unknown as HistoryEntry[],
  future: Object.freeze([]) as unknown as HistoryEntry[],
});

function estimateHistoryBytes(
  beforeProject: Project,
  afterProject: Project,
  command: ProjectCommand,
): number {
  return utf8ByteLength(JSON.stringify({ beforeProject, afterProject, command }));
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
""",
)

replace_once(
    'packages/domain/src/layer-history.ts',
    """  createWorkspaceCommandState,
  dispatchProjectCommand,
  dispatchWorkspaceCommand,
  redoProjectCommand,
  redoWorkspaceCommand,
  undoProjectCommand,
  undoWorkspaceCommand,
""",
    """  createWorkspaceCommandState,
  dispatchProjectCommand,
  dispatchWorkspaceCommand,
  getWorkspaceHistoryRestorableProjects,
  redoProjectCommand,
  redoWorkspaceCommand,
  undoProjectCommand,
  undoWorkspaceCommand,
""",
)
replace_once(
    'packages/domain/src/layer-history.ts',
    """  return {
    ...result,
    layerHistories: state.layerHistories,
  };
}

export function undoWorkspaceCommandWithLayerHistory(
""",
    """  return retainWorkspaceReachablePageHistories({
    ...result,
    layerHistories: state.layerHistories,
  });
}

export function undoWorkspaceCommandWithLayerHistory(
""",
)
replace_once(
    'packages/domain/src/layer-history.ts',
    """  return {
    ...result,
    layerHistories: state.layerHistories,
  };
}

export function redoWorkspaceCommandWithLayerHistory(
""",
    """  return retainWorkspaceReachablePageHistories({
    ...result,
    layerHistories: state.layerHistories,
  });
}

export function redoWorkspaceCommandWithLayerHistory(
""",
)
replace_once(
    'packages/domain/src/layer-history.ts',
    """  return {
    ...result,
    layerHistories: state.layerHistories,
  };
}

export function dispatchProjectCommandWithLayerHistory(
""",
    """  return retainWorkspaceReachablePageHistories({
    ...result,
    layerHistories: state.layerHistories,
  });
}

export function dispatchProjectCommandWithLayerHistory(
""",
)
replace_once(
    'packages/domain/src/layer-history.ts',
    """function retainExistingPageHistories(
""",
    """function retainWorkspaceReachablePageHistories(
  state: LayerWorkspaceCommandState,
): LayerWorkspaceCommandState {
  const retainedProjects = [
    ...state.workspace.projects,
    ...getWorkspaceHistoryRestorableProjects(state),
  ];
  const pageIds = new Set(
    retainedProjects.flatMap((project) => project.pages.map((page) => page.id)),
  );
  const layerHistories = Object.fromEntries(
    Object.entries(state.layerHistories).filter(([pageId]) => pageIds.has(pageId)),
  );
  return { ...state, layerHistories };
}

function retainExistingPageHistories(
""",
)

replace_once(
    'packages/domain/src/canvas-state.ts',
    "import { type ProjectCommand } from './commands.js';\nimport { type WorkspaceCommand } from './workspace-commands.js';",
    "import { type ProjectCommand } from './commands.js';\nimport { getWorkspaceHistoryRestorableProjects } from './history.js';\nimport { type WorkspaceCommand } from './workspace-commands.js';",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    """  return {
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  };
}

export function undoWorkspaceCommandWithCanvasHistory(
""",
    """  return retainWorkspaceReachableCanvasHistories({
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  });
}

export function undoWorkspaceCommandWithCanvasHistory(
""",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    """  return {
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  };
}

export function redoWorkspaceCommandWithCanvasHistory(
""",
    """  return retainWorkspaceReachableCanvasHistories({
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  });
}

export function redoWorkspaceCommandWithCanvasHistory(
""",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    """  return {
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  };
}

export function dispatchProjectCommandWithCanvasHistory(
""",
    """  return retainWorkspaceReachableCanvasHistories({
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  });
}

export function dispatchProjectCommandWithCanvasHistory(
""",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    """function retainExistingCanvasHistories(
""",
    """function retainWorkspaceReachableCanvasHistories(
  state: CanvasWorkspaceCommandState,
): CanvasWorkspaceCommandState {
  const retainedProjects = [
    ...state.workspace.projects,
    ...getWorkspaceHistoryRestorableProjects(state),
  ];
  const pageIds = new Set(
    retainedProjects.flatMap((project) => project.pages.map((page) => page.id)),
  );
  const layerIds = new Set(
    retainedProjects.flatMap((project) =>
      project.pages.flatMap((page) =>
        getLayerDocument(page).layers.map((layer) => layer.id),
      ),
    ),
  );
  const canvasHistories = Object.fromEntries(
    Object.entries(state.canvasHistories)
      .filter(([pageId]) => pageIds.has(pageId))
      .map(([pageId, stack]) => [
        pageId,
        {
          past: stack.past.filter((entry) => layerIds.has(entry.command.layerId)),
          future: stack.future.filter((entry) => layerIds.has(entry.command.layerId)),
        },
      ]),
  );
  return { ...state, canvasHistories };
}

function retainExistingCanvasHistories(
""",
)

write(
    'apps/desktop/src/workspace-session-assets.ts',
    """import type { ProjectAssetLibrary } from '@live-board/domain';

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
""",
)

write(
    'apps/desktop/test/workspace-session-assets.test.ts',
    """import { describe, expect, it } from 'vitest';
import { createProjectAssetLibrary } from '@live-board/domain';
import { retainProjectAssetLibraries } from '../src/workspace-session-assets';

describe('workspace session assets', () => {
  it('現在またはRedo可能なProjectのLibraryを保持する', () => {
    const libraries = {
      p1: createProjectAssetLibrary(),
      p2: createProjectAssetLibrary(),
    };
    expect(retainProjectAssetLibraries(libraries, ['p1', 'p2'])).toBe(libraries);
  });

  it('復元不能になったProjectのLibraryを回収する', () => {
    const libraries = {
      p1: createProjectAssetLibrary(),
      p2: createProjectAssetLibrary(),
    };
    const next = retainProjectAssetLibraries(libraries, ['p1']);
    expect(Object.keys(next)).toEqual(['p1']);
    expect(Object.keys(libraries)).toEqual(['p1', 'p2']);
  });
});
""",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  createProject,\n  createProjectAssetLibrary,\n  createSelectEditPageCommand,",
    "  createProject,\n  createProjectAssetLibrary,\n  createSelectEditPageCommand,\n  createSelectProjectCommand,",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  getProjectHistory,\n  importProjectAsset,",
    "  getProjectHistory,\n  getWorkspaceHistoryRetainedProjectIds,\n  importProjectAsset,",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "import { useWorkspacePersistence } from './useWorkspacePersistence';",
    "import { useWorkspacePersistence } from './useWorkspacePersistence';\nimport { retainProjectAssetLibraries } from './workspace-session-assets';",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  const broadcastControls = useBroadcastControls({
""",
    """  const retainedAssetProjectIds = getWorkspaceHistoryRetainedProjectIds(commandState);
  const retainedAssetProjectIdsSignature = retainedAssetProjectIds.join('|');
  const broadcastControls = useBroadcastControls({
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  useEffect(() => {
    if (currentProjectTabsState !== projectTabsState) {
      setProjectTabsState(currentProjectTabsState);
    }
  }, [currentProjectTabsState, projectTabsState]);

  useEffect(() => {
    const liveBoardApi = window.liveBoard;
""",
    """  useEffect(() => {
    if (currentProjectTabsState !== projectTabsState) {
      setProjectTabsState(currentProjectTabsState);
    }
  }, [currentProjectTabsState, projectTabsState]);

  useEffect(() => {
    setAssetLibraries((current) =>
      retainProjectAssetLibraries(current, retainedAssetProjectIds),
    );
  }, [retainedAssetProjectIdsSignature]);

  useEffect(() => {
    const liveBoardApi = window.liveBoard;
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """      setCommandState((current) => ({
        ...current,
        workspace: selectWorkspaceProject(current.workspace, projectId),
      }));
""",
    """      setCommandState((current) =>
        dispatchWorkspaceCommandWithCanvasHistory(
          current,
          createSelectProjectCommand(
            current.workspace.id,
            projectId,
            createCommandMetadata('project-select'),
          ),
        ),
      );
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  selectWorkspaceProject,\n",
    "",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "function undoProjectAddition(): void {",
    "function undoProjectOperation(): void {",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "function redoProjectAddition(): void {",
    "function redoProjectOperation(): void {",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """          canUndoProjectAdd={canUndoWorkspace(commandState)}
          canRedoProjectAdd={canRedoWorkspace(commandState)}
""",
    """          canUndoProjectOperation={canUndoWorkspace(commandState)}
          canRedoProjectOperation={canRedoWorkspace(commandState)}
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """          onUndoProjectAdd={undoProjectAddition}
          onRedoProjectAdd={redoProjectAddition}
""",
    """          onUndoProjectOperation={undoProjectOperation}
          onRedoProjectOperation={redoProjectOperation}
""",
)

write(
    'apps/desktop/src/ProjectTabs.tsx',
    """import { useMemo, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import type { Project } from '@live-board/domain';
import {
  closeProjectTab,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  type ProjectTabsState,
} from './project-tabs-model';
import './project-tabs.css';

export interface ProjectTabsProps {
  tabs: ProjectTabsState;
  projects: readonly Project[];
  activeProjectId: string;
  hasUnsavedChanges: boolean;
  canUndoProjectOperation: boolean;
  canRedoProjectOperation: boolean;
  onTabsChange: Dispatch<SetStateAction<ProjectTabsState>>;
  onSelect(projectId: string): void;
  onCreate(): void;
  onUndoProjectOperation(): void;
  onRedoProjectOperation(): void;
}

export function ProjectTabs({
  tabs,
  projects,
  activeProjectId,
  hasUnsavedChanges,
  canUndoProjectOperation,
  canRedoProjectOperation,
  onTabsChange,
  onSelect,
  onCreate,
  onUndoProjectOperation,
  onRedoProjectOperation,
}: ProjectTabsProps) {
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const openProjects = projects.filter((project) => tabs.openProjectIds.includes(project.id));
  const canReopen = tabs.recentlyClosedProjectIds.length > 0;

  function selectAndFocus(projectId: string): void {
    onSelect(projectId);
    window.requestAnimationFrame(() => tabRefs.current.get(projectId)?.focus());
  }

  function close(projectId: string): void {
    const result = closeProjectTab(tabs, projectId, activeProjectId);
    onTabsChange(result.state);
    if (result.nextActiveProjectId !== activeProjectId) {
      selectAndFocus(result.nextActiveProjectId);
    }
  }

  function reopen(): void {
    const result = reopenLastProjectTab(tabs, projectIds);
    onTabsChange(result.state);
    if (result.reopenedProjectId !== null) selectAndFocus(result.reopenedProjectId);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!isNavigationKey(event.key)) return;
    event.preventDefault();
    selectAndFocus(
      resolveProjectTabNavigation(tabs.openProjectIds, activeProjectId, event.key),
    );
  }

  return (
    <div className="project-tabs-shell">
      <div className="document-tabs" role="tablist" aria-label="プロジェクト">
        {openProjects.map((project) => {
          const active = project.id === activeProjectId;
          return (
            <div className="project-tab-item" key={project.id}>
              <button
                ref={(element) => {
                  if (element === null) tabRefs.current.delete(project.id);
                  else tabRefs.current.set(project.id, element);
                }}
                type="button"
                role="tab"
                className="project-tab-select"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                data-unsaved={active && hasUnsavedChanges ? 'true' : 'false'}
                onClick={() => onSelect(project.id)}
                onKeyDown={navigate}
              >
                <span>{project.name}</span>
                {active && hasUnsavedChanges ? (
                  <span className="project-tab-dirty" aria-label="未保存の変更あり">●</span>
                ) : null}
              </button>
              <button
                type="button"
                className="project-tab-close"
                aria-label={`${project.name}のタブを閉じる`}
                disabled={tabs.openProjectIds.length <= 1}
                onClick={() => close(project.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="project-tab-actions">
        <span className="project-tabs-save-status" role="status">
          {hasUnsavedChanges
            ? 'ワークスペースに未保存の変更あり'
            : 'ワークスペース保存済み'}
        </span>
        <button
          type="button"
          aria-label="Project操作を元に戻す"
          disabled={!canUndoProjectOperation}
          onClick={onUndoProjectOperation}
        >
          操作を元に戻す
        </button>
        <button
          type="button"
          aria-label="Project操作をやり直す"
          disabled={!canRedoProjectOperation}
          onClick={onRedoProjectOperation}
        >
          操作をやり直す
        </button>
        <button type="button" onClick={reopen} disabled={!canReopen}>
          閉じたタブを復元
        </button>
        <button type="button" onClick={onCreate} aria-label="プロジェクトを追加">
          ＋
        </button>
      </div>
    </div>
  );
}

function isNavigationKey(
  key: string,
): key is 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End';
}
""",
)

write(
    'packages/domain/test/workspace-command-history.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  canRedoWorkspace,
  canUndoWorkspace,
  createAddProjectCommand,
  createPage,
  createProject,
  createSelectProjectCommand,
  createWorkspace,
  createWorkspaceCommandState,
  dispatchWorkspaceCommand,
  findProject,
  getWorkspaceHistory,
  getWorkspaceHistoryBytes,
  redoWorkspaceCommand,
  replaceProject,
  undoWorkspaceCommand,
} from '../src/index.js';

const TIMESTAMP = '2026-07-29T00:00:00.000Z';

function project(projectId: string) {
  return createProject({
    id: projectId,
    workspaceId: 'workspace-1',
    name: projectId,
    pages: [
      createPage({
        id: `${projectId}:page:1`,
        projectId,
        name: 'ページ 1',
        createdAt: TIMESTAMP,
      }),
    ],
    createdAt: TIMESTAMP,
  });
}

function workspace() {
  return createWorkspace({
    id: 'workspace-1',
    name: 'Workspace',
    projects: [project('project-1')],
    createdAt: TIMESTAMP,
  });
}

describe('workspace command history', () => {
  it('Project追加だけをUndoし、既存Projectの後続編集を維持する', () => {
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace()),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-1',
        createdAt: TIMESTAMP,
      }),
    );
    const existing = findProject(added.workspace, 'project-1');
    const editedState = {
      ...added,
      workspace: replaceProject(
        added.workspace,
        { ...existing, name: '既存Projectの後続編集' },
        TIMESTAMP,
      ),
    };

    const undone = undoWorkspaceCommand(editedState);
    expect(undone.workspace.projects.map((candidate) => candidate.id)).toEqual([
      'project-1',
    ]);
    expect(findProject(undone.workspace, 'project-1').name).toBe(
      '既存Projectの後続編集',
    );
    expect(canRedoWorkspace(undone)).toBe(true);
  });

  it('追加Projectの現在内容をUndo時に退避し、Redoで復元する', () => {
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace()),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-1',
        createdAt: TIMESTAMP,
      }),
    );
    const addedProject = findProject(added.workspace, 'project-2');
    const editedState = {
      ...added,
      workspace: replaceProject(
        added.workspace,
        { ...addedProject, name: '編集済みProject' },
        TIMESTAMP,
      ),
    };

    const redone = redoWorkspaceCommand(undoWorkspaceCommand(editedState));
    expect(findProject(redone.workspace, 'project-2').name).toBe('編集済みProject');
  });

  it('Project選択をUndo・Redoできる', () => {
    const initial = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace()),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-add',
        createdAt: TIMESTAMP,
      }),
    );
    const selected = dispatchWorkspaceCommand(
      initial,
      createSelectProjectCommand('workspace-1', 'project-1', {
        commandId: 'command-select',
        createdAt: TIMESTAMP,
      }),
    );
    expect(selected.workspace.activeProjectId).toBe('project-1');
    expect(undoWorkspaceCommand(selected).workspace.activeProjectId).toBe('project-2');
    expect(
      redoWorkspaceCommand(undoWorkspaceCommand(selected)).workspace.activeProjectId,
    ).toBe('project-1');
  });

  it('Workspace履歴を推定バイト数上限内へ切り詰める', () => {
    let state = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace(), 100, 2_000),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-add',
        createdAt: TIMESTAMP,
      }),
    );
    for (let index = 0; index < 30; index += 1) {
      state = dispatchWorkspaceCommand(
        state,
        createSelectProjectCommand(
          'workspace-1',
          index % 2 === 0 ? 'project-1' : 'project-2',
          { commandId: `command-select-${index}`, createdAt: TIMESTAMP },
        ),
      );
    }
    expect(getWorkspaceHistoryBytes(state)).toBeLessThanOrEqual(2_000);
    expect(getWorkspaceHistory(state).past.length).toBeLessThan(31);
    expect(canUndoWorkspace(state)).toBe(true);
  });
});
""",
)

replace_once(
    'tests/e2e/project-tabs-desktop.spec.ts',
    "Projectタブを追加・Undo・切り替え・閉じる・ホーム往復後に復元できる",
    "Projectタブを追加・Project操作Undo・切り替え・閉じる・ホーム往復後に復元できる",
)
replace_once(
    'tests/e2e/project-tabs-desktop.spec.ts',
    "Project追加を元に戻す",
    "Project操作を元に戻す",
)
replace_once(
    'tests/e2e/project-tabs-desktop.spec.ts',
    "Project追加をやり直す",
    "Project操作をやり直す",
)
replace_once(
    'tests/e2e/project-tabs-desktop.spec.ts',
    """  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: '新しいプロジェクトのタブを閉じる' }).click();
""",
    """  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Project操作を元に戻す' }).click();
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Project操作をやり直す' }).click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: '新しいプロジェクトのタブを閉じる' }).click();
""",
)

Path('.github/workflows/fix-project-tab-command-history.yml').unlink(missing_ok=True)
Path('.github/scripts/fix-project-tab-command-history.py').unlink(missing_ok=True)
