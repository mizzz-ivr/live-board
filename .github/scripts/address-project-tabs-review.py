from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding='utf-8')
    if old not in content:
        raise RuntimeError(f'anchor not found: {path}\n{old[:180]}')
    file_path.write_text(content.replace(old, new, 1), encoding='utf-8')


def write(path: str, content: str) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding='utf-8')


replace_once(
    'packages/domain/src/model.ts',
    "  | 'WORKSPACE_PROJECT_REQUIRED'\n  | 'PROJECT_PAGE_REQUIRED'",
    "  | 'WORKSPACE_PROJECT_REQUIRED'\n  | 'WORKSPACE_NOT_FOUND'\n  | 'PROJECT_PAGE_REQUIRED'",
)

replace_once(
    'packages/domain/src/index.ts',
    "export * from './workspace-projects.js';\nexport * from './commands.js';",
    "export * from './workspace-projects.js';\nexport * from './workspace-commands.js';\nexport * from './commands.js';",
)

replace_once(
    'packages/domain/src/layer-history.ts',
    "import { type ProjectCommand } from './commands.js';",
    "import { type ProjectCommand } from './commands.js';\nimport { type WorkspaceCommand } from './workspace-commands.js';",
)
replace_once(
    'packages/domain/src/layer-history.ts',
    """  createWorkspaceCommandState,
  dispatchProjectCommand,
  redoProjectCommand,
  undoProjectCommand,
  type WorkspaceCommandState,
""",
    """  createWorkspaceCommandState,
  dispatchProjectCommand,
  dispatchWorkspaceCommand,
  redoProjectCommand,
  redoWorkspaceCommand,
  undoProjectCommand,
  undoWorkspaceCommand,
  type WorkspaceCommandState,
""",
)
replace_once(
    'packages/domain/src/layer-history.ts',
    """export function dispatchProjectCommandWithLayerHistory(
""",
    """export function dispatchWorkspaceCommandWithLayerHistory(
  state: LayerWorkspaceCommandState,
  command: WorkspaceCommand,
): LayerWorkspaceCommandState {
  const result = dispatchWorkspaceCommand(state, command);
  return {
    ...result,
    layerHistories: state.layerHistories,
  };
}

export function undoWorkspaceCommandWithLayerHistory(
  state: LayerWorkspaceCommandState,
): LayerWorkspaceCommandState {
  const result = undoWorkspaceCommand(state);
  return {
    ...result,
    layerHistories: state.layerHistories,
  };
}

export function redoWorkspaceCommandWithLayerHistory(
  state: LayerWorkspaceCommandState,
): LayerWorkspaceCommandState {
  const result = redoWorkspaceCommand(state);
  return {
    ...result,
    layerHistories: state.layerHistories,
  };
}

export function dispatchProjectCommandWithLayerHistory(
""",
)

replace_once(
    'packages/domain/src/canvas-state.ts',
    """  dispatchProjectCommandWithLayerHistory,
  redoProjectCommandWithLayerHistory,
  undoProjectCommandWithLayerHistory,
  createLayerWorkspaceCommandState,
""",
    """  dispatchProjectCommandWithLayerHistory,
  dispatchWorkspaceCommandWithLayerHistory,
  redoProjectCommandWithLayerHistory,
  redoWorkspaceCommandWithLayerHistory,
  undoProjectCommandWithLayerHistory,
  undoWorkspaceCommandWithLayerHistory,
  createLayerWorkspaceCommandState,
""",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    "import { type ProjectCommand } from './commands.js';",
    "import { type ProjectCommand } from './commands.js';\nimport { type WorkspaceCommand } from './workspace-commands.js';",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    """export function dispatchProjectCommandWithCanvasHistory(
""",
    """export function dispatchWorkspaceCommandWithCanvasHistory(
  state: CanvasWorkspaceCommandState,
  command: WorkspaceCommand,
): CanvasWorkspaceCommandState {
  const result = dispatchWorkspaceCommandWithLayerHistory(state, command);
  return {
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  };
}

export function undoWorkspaceCommandWithCanvasHistory(
  state: CanvasWorkspaceCommandState,
): CanvasWorkspaceCommandState {
  const result = undoWorkspaceCommandWithLayerHistory(state);
  return {
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  };
}

export function redoWorkspaceCommandWithCanvasHistory(
  state: CanvasWorkspaceCommandState,
): CanvasWorkspaceCommandState {
  const result = redoWorkspaceCommandWithLayerHistory(state);
  return {
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  };
}

export function dispatchProjectCommandWithCanvasHistory(
""",
)

replace_once(
    'apps/desktop/src/useWorkspacePersistence.ts',
    "  revision: number;\n  hasUnsavedChanges: boolean;",
    "  revision: number;\n  workspaceSessionRevision: number;\n  hasUnsavedChanges: boolean;",
)
replace_once(
    'apps/desktop/src/useWorkspacePersistence.ts',
    "  const [revision, setRevision] = useState(0);\n  const [lastExplicitSaveRevision",
    "  const [revision, setRevision] = useState(0);\n  const [workspaceSessionRevision, setWorkspaceSessionRevision] = useState(0);\n  const [lastExplicitSaveRevision",
)
replace_once(
    'apps/desktop/src/useWorkspacePersistence.ts',
    """      setLastExplicitSaveRevision(nextDocument === null ? null : 0);
      input.setCommandState(createCanvasWorkspaceCommandState(bundle.workspace));
""",
    """      setLastExplicitSaveRevision(nextDocument === null ? null : 0);
      setWorkspaceSessionRevision((current) => current + 1);
      input.setCommandState(createCanvasWorkspaceCommandState(bundle.workspace));
""",
)
replace_once(
    'apps/desktop/src/useWorkspacePersistence.ts',
    "    revision,\n    hasUnsavedChanges,",
    "    revision,\n    workspaceSessionRevision,\n    hasUnsavedChanges,",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  appendWorkspaceProject,\n  canRedoCanvas,\n  canRedoProject,\n  canUndoCanvas,\n  canUndoProject,",
    "  canRedoCanvas,\n  canRedoProject,\n  canRedoWorkspace,\n  canUndoCanvas,\n  canUndoProject,\n  canUndoWorkspace,",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  createAddLayerCommand,\n  createAddPageCommand,",
    "  createAddLayerCommand,\n  createAddPageCommand,\n  createAddProjectCommand,",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  createBroadcastSnapshot,\n  createCanvasWorkspaceCommandState,",
    "  createCanvasWorkspaceCommandState,",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  dispatchProjectCommandWithCanvasHistory,\n  getCanvasHistory,",
    "  dispatchProjectCommandWithCanvasHistory,\n  dispatchWorkspaceCommandWithCanvasHistory,\n  getCanvasHistory,",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  redoProjectCommandWithCanvasHistory,\n  selectWorkspaceProject,\n  undoCanvasCommand,\n  undoProjectCommandWithCanvasHistory,",
    "  redoProjectCommandWithCanvasHistory,\n  redoWorkspaceCommandWithCanvasHistory,\n  selectWorkspaceProject,\n  undoCanvasCommand,\n  undoProjectCommandWithCanvasHistory,\n  undoWorkspaceCommandWithCanvasHistory,",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "import { publishBroadcastSnapshotWithAssets } from './broadcast-ipc';",
    "import { publishActiveProjectBroadcastSnapshot } from './project-broadcast-sync';",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """    projectIds,
    project.id,
  );
""",
    """    projectIds,
    project.id,
    persistence.workspaceSessionRevision,
  );
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """    const snapshot = createBroadcastSnapshot(
      workspace,
      project.id,
      revision,
      new Date().toISOString(),
      assetLibrary,
    );
    void publishBroadcastSnapshotWithAssets(
      liveBoardApi,
      requestId,
      snapshot,
      registeredBroadcastAssetHashesRef.current,
    )
""",
    """    void publishActiveProjectBroadcastSnapshot({
      api: liveBoardApi,
      requestId,
      workspace,
      revision,
      generatedAt: new Date().toISOString(),
      assetLibrary,
      registeredSha256: registeredBroadcastAssetHashesRef.current,
    })
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """      setCommandState((current) => ({
        ...current,
        workspace: appendWorkspaceProject(current.workspace, nextProject, timestamp),
      }));
""",
    """      setCommandState((current) =>
        dispatchWorkspaceCommandWithCanvasHistory(
          current,
          createAddProjectCommand(
            current.workspace.id,
            nextProject,
            createCommandMetadata('project-add'),
          ),
        ),
      );
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  function duplicateEditPage(): void {
""",
    """  function undoProjectAddition(): void {
    setCommandState((current) => undoWorkspaceCommandWithCanvasHistory(current));
    setSelection(null);
    setSelectionMode(null);
    setViewport(DEFAULT_CANVAS_VIEWPORT);
    setDomainError(null);
  }

  function redoProjectAddition(): void {
    setCommandState((current) => redoWorkspaceCommandWithCanvasHistory(current));
    setSelection(null);
    setSelectionMode(null);
    setViewport(DEFAULT_CANVAS_VIEWPORT);
    setDomainError(null);
  }

  function duplicateEditPage(): void {
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """          hasUnsavedChanges={persistence.hasUnsavedChanges}
          onTabsChange={setProjectTabsState}
          onSelect={selectProject}
          onCreate={createProjectTab}
""",
    """          hasUnsavedChanges={persistence.hasUnsavedChanges}
          canUndoProjectAdd={canUndoWorkspace(commandState)}
          canRedoProjectAdd={canRedoWorkspace(commandState)}
          onTabsChange={setProjectTabsState}
          onSelect={selectProject}
          onCreate={createProjectTab}
          onUndoProjectAdd={undoProjectAddition}
          onRedoProjectAdd={redoProjectAddition}
""",
)

write(
    'apps/desktop/src/project-broadcast-sync.ts',
    """import {
  createBroadcastSnapshot,
  type ProjectAssetLibrary,
  type Workspace,
} from '@live-board/domain';
import {
  publishBroadcastSnapshotWithAssets,
  type BroadcastIpcApi,
  type BroadcastPublishResponse,
} from './broadcast-ipc';

export function publishActiveProjectBroadcastSnapshot(input: {
  api: BroadcastIpcApi;
  requestId: string;
  workspace: Workspace;
  revision: number;
  generatedAt: string;
  assetLibrary: ProjectAssetLibrary;
  registeredSha256: Set<string>;
}): Promise<BroadcastPublishResponse> {
  const snapshot = createBroadcastSnapshot(
    input.workspace,
    input.workspace.activeProjectId,
    input.revision,
    input.generatedAt,
    input.assetLibrary,
  );
  return publishBroadcastSnapshotWithAssets(
    input.api,
    input.requestId,
    snapshot,
    input.registeredSha256,
  );
}
""",
)

write(
    'apps/desktop/test/project-broadcast-sync.test.ts',
    """import { describe, expect, it, vi } from 'vitest';
import {
  createPage,
  createProject,
  createProjectAssetLibrary,
  createWorkspace,
  selectWorkspaceProject,
} from '@live-board/domain';
import type { BroadcastSnapshotDescriptor } from '@live-board/obs-protocol';
import { publishActiveProjectBroadcastSnapshot } from '../src/project-broadcast-sync';

const TIMESTAMP = '2026-07-29T00:00:00.000Z';

function project(projectId: string, pageId: string) {
  return createProject({
    id: projectId,
    workspaceId: 'workspace-1',
    name: projectId,
    pages: [
      createPage({
        id: pageId,
        projectId,
        name: pageId,
        createdAt: TIMESTAMP,
      }),
    ],
    activeBroadcastPageId: pageId,
    createdAt: TIMESTAMP,
  });
}

describe('active project broadcast sync', () => {
  it('選択Projectの配信PageをIPC Snapshotとしてpublishする', async () => {
    const workspace = selectWorkspaceProject(
      createWorkspace({
        id: 'workspace-1',
        name: 'Workspace',
        projects: [
          project('project-1', 'page-1'),
          project('project-2', 'page-2'),
        ],
        activeProjectId: 'project-1',
        createdAt: TIMESTAMP,
      }),
      'project-2',
      TIMESTAMP,
    );
    const published: BroadcastSnapshotDescriptor[] = [];
    const api = {
      registerBroadcastAssets: vi.fn(async (requestId: string) => ({
        requestId,
        registeredSha256: [],
      })),
      publishBroadcastSnapshot: vi.fn(
        async (requestId: string, snapshot: BroadcastSnapshotDescriptor) => {
          published.push(snapshot);
          return { requestId, acceptedRevision: snapshot.revision };
        },
      ),
    };

    await publishActiveProjectBroadcastSnapshot({
      api,
      requestId: 'request-1',
      workspace,
      revision: 7,
      generatedAt: TIMESTAMP,
      assetLibrary: createProjectAssetLibrary(),
      registeredSha256: new Set(),
    });

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      projectId: 'project-2',
      pageId: 'page-2',
      revision: 7,
    });
  });
});
""",
)

Path('.github/workflows/address-project-tabs-review.yml').unlink(missing_ok=True)
Path('.github/scripts/address-project-tabs-review.py').unlink(missing_ok=True)
