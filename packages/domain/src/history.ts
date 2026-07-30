import {
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
  type RenameProjectCommand,
  type SelectProjectCommand,
  type WorkspaceCommand,
} from './workspace-commands.js';
import {
  appendWorkspaceProject,
  renameWorkspaceProject,
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

export interface RenameProjectWorkspaceHistoryEntry
  extends WorkspaceHistoryEntryBase {
  command: RenameProjectCommand;
  previousName: string;
}

export type WorkspaceHistoryEntry =
  | AddProjectWorkspaceHistoryEntry
  | SelectProjectWorkspaceHistoryEntry
  | RenameProjectWorkspaceHistoryEntry;

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
  if (!result.changed) return state;  const entry = createWorkspaceHistoryEntry(
  state.workspace,
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
    isAddProjectWorkspaceHistoryEntry(entry)
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

export function trimWorkspaceRedoHistoryForExternalProjectBytes(
  state: WorkspaceCommandState,
  externalProjectBytes: Readonly<Record<ProjectId, number>>,
): WorkspaceCommandState {
  const originalFuture = state.histories.workspace.future;
  if (originalFuture.length === 0) return state;

  let future = originalFuture;
  while (
    future.length > 0 &&
    getWorkspaceHistoryAndExternalBytes(
      state.histories.workspace.past,
      future,
      externalProjectBytes,
    ) > state.workspaceHistoryMemoryLimitBytes
  ) {
    future = future.slice(1);
  }
  if (future.length === originalFuture.length) return state;

  return retainReachableCommandHistories({
    ...state,
    histories: {
      workspace: {
        past: state.histories.workspace.past,
        future,
      },
      project: state.histories.project,
      page: state.histories.page,
    },
  });
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
  previousWorkspace: Workspace,
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
  if (command.type === 'workspace.project.rename') {
    return withWorkspaceHistoryEstimate({
      historyId: `workspace-history:${command.commandId}`,
      command,
      previousActiveProjectId,
      previousName: findProject(previousWorkspace, command.projectId).name,
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
  if (isAddProjectWorkspaceHistoryEntry(entry)) {
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
        projectSnapshot,      }),
  };
}
if (isRenameProjectWorkspaceHistoryEntry(entry)) {
  return {
    workspace: renameWorkspaceProject(
      workspace,
      entry.command.projectId,
      entry.previousName,
      updatedAt,
    ),
    futureEntry: entry,
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
  if (isAddProjectWorkspaceHistoryEntry(entry)) {
    return {
      workspace: appendWorkspaceProject(
        workspace,
        entry.projectSnapshot,
        updatedAt,
      ),
      pastEntry: withWorkspaceHistoryEstimate({
        ...entry,
        previousActiveProjectId,      }),
  };
}
if (isRenameProjectWorkspaceHistoryEntry(entry)) {
  return {
    workspace: renameWorkspaceProject(
      workspace,
      entry.command.projectId,
      entry.command.name,
      updatedAt,
    ),
    pastEntry: entry,
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

function isAddProjectWorkspaceHistoryEntry(
  entry: WorkspaceHistoryEntry,
): entry is AddProjectWorkspaceHistoryEntry {
  return entry.command.type === 'workspace.project.add';
}

function isRenameProjectWorkspaceHistoryEntry(
  entry: WorkspaceHistoryEntry,
): entry is RenameProjectWorkspaceHistoryEntry {
  return entry.command.type === 'workspace.project.rename';
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

function getWorkspaceHistoryAndExternalBytes(
  past: readonly WorkspaceHistoryEntry[],
  future: readonly WorkspaceHistoryEntry[],
  externalProjectBytes: Readonly<Record<ProjectId, number>>,
): number {
  const historyBytes = [...past, ...future].reduce(
    (total, entry) => total + entry.estimatedBytes,
    0,
  );
  const retainedProjectIds = new Set(
    future.flatMap((entry) =>
      isAddProjectWorkspaceHistoryEntry(entry)
        ? [entry.projectSnapshot.id]
        : [],
    ),
  );
  const externalBytes = [...retainedProjectIds].reduce((total, projectId) => {
    const bytes = externalProjectBytes[projectId] ?? 0;
    return total + (Number.isSafeInteger(bytes) && bytes > 0 ? bytes : 0);
  }, 0);
  return historyBytes + externalBytes;
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
