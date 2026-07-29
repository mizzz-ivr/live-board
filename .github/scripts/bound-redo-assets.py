from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding='utf-8')
    if old not in content:
        raise RuntimeError(f'anchor not found: {path}\n{old[:220]}')
    file_path.write_text(content.replace(old, new, 1), encoding='utf-8')


replace_once(
    'packages/domain/src/history.ts',
    """export function dispatchProjectCommand(
""",
    """export function trimWorkspaceRedoHistoryForExternalProjectBytes(
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
""",
)
replace_once(
    'packages/domain/src/history.ts',
    """function withWorkspaceHistoryEstimate<T extends Omit<WorkspaceHistoryEntry, 'estimatedBytes'>>(
""",
    """function getWorkspaceHistoryAndExternalBytes(
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
""",
)

replace_once(
    'packages/domain/src/layer-history.ts',
    """  getWorkspaceHistoryRestorableProjects,
  redoProjectCommand,
""",
    """  getWorkspaceHistoryRestorableProjects,
  redoProjectCommand,
  trimWorkspaceRedoHistoryForExternalProjectBytes,
""",
)
replace_once(
    'packages/domain/src/layer-history.ts',
    """export function dispatchProjectCommandWithLayerHistory(
""",
    """export function trimWorkspaceRedoHistoryForExternalProjectBytesWithLayerHistory(
  state: LayerWorkspaceCommandState,
  externalProjectBytes: Readonly<Record<ProjectId, number>>,
): LayerWorkspaceCommandState {
  const result = trimWorkspaceRedoHistoryForExternalProjectBytes(
    state,
    externalProjectBytes,
  );
  if (result === state) return state;
  return retainWorkspaceReachablePageHistories({
    ...result,
    layerHistories: state.layerHistories,
  });
}

export function dispatchProjectCommandWithLayerHistory(
""",
)

replace_once(
    'packages/domain/src/canvas-state.ts',
    """  redoWorkspaceCommandWithLayerHistory,
  undoProjectCommandWithLayerHistory,
""",
    """  redoWorkspaceCommandWithLayerHistory,
  trimWorkspaceRedoHistoryForExternalProjectBytesWithLayerHistory,
  undoProjectCommandWithLayerHistory,
""",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    """export function dispatchProjectCommandWithCanvasHistory(
""",
    """export function trimWorkspaceRedoHistoryForExternalProjectBytesWithCanvasHistory(
  state: CanvasWorkspaceCommandState,
  externalProjectBytes: Readonly<Record<ProjectId, number>>,
): CanvasWorkspaceCommandState {
  const result = trimWorkspaceRedoHistoryForExternalProjectBytesWithLayerHistory(
    state,
    externalProjectBytes,
  );
  if (result === state) return state;
  return retainWorkspaceReachableCanvasHistories({
    ...result,
    canvasHistories: state.canvasHistories,
    canvasHistoryMemoryLimitBytes: state.canvasHistoryMemoryLimitBytes,
  });
}

export function dispatchProjectCommandWithCanvasHistory(
""",
)

replace_once(
    'packages/domain/src/index.ts',
    """  redoWorkspaceCommandWithLayerHistory,
  undoProjectCommandWithLayerHistory,
""",
    """  redoWorkspaceCommandWithLayerHistory,
  trimWorkspaceRedoHistoryForExternalProjectBytesWithLayerHistory,
  undoProjectCommandWithLayerHistory,
""",
)
replace_once(
    'packages/domain/src/index.ts',
    """  redoWorkspaceCommandWithCanvasHistory,
  undoCanvasCommand,
""",
    """  redoWorkspaceCommandWithCanvasHistory,
  trimWorkspaceRedoHistoryForExternalProjectBytesWithCanvasHistory,
  undoCanvasCommand,
""",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  redoWorkspaceCommandWithCanvasHistory,
  undoCanvasCommand,
""",
    """  redoWorkspaceCommandWithCanvasHistory,
  trimWorkspaceRedoHistoryForExternalProjectBytesWithCanvasHistory,
  undoCanvasCommand,
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  const retainedAssetProjectIds = getWorkspaceHistoryRetainedProjectIds(commandState);
  const retainedAssetProjectIdsSignature = retainedAssetProjectIds.join('|');
""",
    """  const retainedAssetProjectIds = getWorkspaceHistoryRetainedProjectIds(commandState);
  const retainedAssetProjectIdsSignature = retainedAssetProjectIds.join('|');
  const workspaceFutureHistorySignature = commandState.histories.workspace.future
    .map((entry) => entry.historyId)
    .join('|');
  const assetLibraryBytesSignature = Object.entries(assetLibraries)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([projectId, library]) => `${projectId}:${library.totalBytes}`)
    .join('|');
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  useEffect(() => {
    setAssetLibraries((current) =>
      retainProjectAssetLibraries(current, retainedAssetProjectIds),
    );
  }, [retainedAssetProjectIdsSignature]);

  useEffect(() => {
""",
    """  useEffect(() => {
    const externalProjectBytes = Object.fromEntries(
      Object.entries(assetLibraries).map(([projectId, library]) => [
        projectId,
        library.totalBytes,
      ]),
    );
    setCommandState((current) =>
      trimWorkspaceRedoHistoryForExternalProjectBytesWithCanvasHistory(
        current,
        externalProjectBytes,
      ),
    );
  }, [assetLibraryBytesSignature, workspaceFutureHistorySignature]);

  useEffect(() => {
    setAssetLibraries((current) =>
      retainProjectAssetLibraries(current, retainedAssetProjectIds),
    );
  }, [retainedAssetProjectIdsSignature]);

  useEffect(() => {
""",
)

replace_once(
    'packages/domain/test/workspace-command-history.test.ts',
    """  replaceProject,
  undoWorkspaceCommand,
""",
    """  replaceProject,
  trimWorkspaceRedoHistoryForExternalProjectBytes,
  undoWorkspaceCommand,
""",
)
replace_once(
    'packages/domain/test/workspace-command-history.test.ts',
    """  it('Workspace履歴を推定バイト数上限内へ切り詰める', () => {
""",
    """  it('Redo用Projectの外部Asset容量も履歴上限へ含める', () => {
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace(), 100, 2_000),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-add',
        createdAt: TIMESTAMP,
      }),
    );
    const undone = undoWorkspaceCommand(added);
    expect(canRedoWorkspace(undone)).toBe(true);

    const trimmed = trimWorkspaceRedoHistoryForExternalProjectBytes(undone, {
      'project-2': 4_000,
    });
    expect(canRedoWorkspace(trimmed)).toBe(false);
    expect(trimmed.histories.workspace.future).toEqual([]);
  });

  it('Workspace履歴を推定バイト数上限内へ切り詰める', () => {
""",
)

Path('.github/workflows/bound-redo-assets.yml').unlink(missing_ok=True)
Path('.github/scripts/bound-redo-assets.py').unlink(missing_ok=True)
