from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding='utf-8')
    if old not in content:
        raise RuntimeError(f'anchor not found: {path}\n{old[:220]}')
    file_path.write_text(content.replace(old, new, 1), encoding='utf-8')


replace_once(
    'packages/domain/src/canvas-state.ts',
    """export function dispatchProjectCommandWithCanvasHistory(
""",
    """export function getWorkspaceRedoRetainedBytesByProject(
  state: CanvasWorkspaceCommandState,
  externalProjectBytes: Readonly<Record<ProjectId, number>>,
): Record<ProjectId, number> {
  const currentProjectIds = new Set(
    state.workspace.projects.map((project) => project.id),
  );
  return Object.fromEntries(
    getWorkspaceHistoryRestorableProjects(state)
      .filter((project) => !currentProjectIds.has(project.id))
      .map((project) => {
        const pageIds = project.pages.map((page) => page.id);
        const relatedHistoryBytes =
          historyStackBytes(state.histories.project[project.id]) +
          pageIds.reduce(
            (total, pageId) =>
              total +
              historyStackBytes(state.histories.page[pageId]) +
              historyStackBytes(state.layerHistories[pageId]) +
              historyStackBytes(state.canvasHistories[pageId]),
            0,
          );
        const assetBytes = externalProjectBytes[project.id] ?? 0;
        return [
          project.id,
          relatedHistoryBytes +
            (Number.isSafeInteger(assetBytes) && assetBytes > 0 ? assetBytes : 0),
        ];
      }),
  );
}

export function dispatchProjectCommandWithCanvasHistory(
""",
)
replace_once(
    'packages/domain/src/canvas-state.ts',
    """function retainWorkspaceReachableCanvasHistories(
""",
    """function historyStackBytes(
  stack:
    | {
        past: readonly { estimatedBytes: number }[];
        future: readonly { estimatedBytes: number }[];
      }
    | undefined,
): number {
  if (stack === undefined) return 0;
  return [...stack.past, ...stack.future].reduce(
    (total, entry) => total + entry.estimatedBytes,
    0,
  );
}

function retainWorkspaceReachableCanvasHistories(
""",
)

replace_once(
    'packages/domain/src/index.ts',
    """  getCanvasHistoryBytes,
  getLayerTransform,
""",
    """  getCanvasHistoryBytes,
  getWorkspaceRedoRetainedBytesByProject,
  getLayerTransform,
""",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    """  getProjectHistory,
  getWorkspaceHistoryRetainedProjectIds,
""",
    """  getProjectHistory,
  getWorkspaceHistoryRetainedProjectIds,
  getWorkspaceRedoRetainedBytesByProject,
""",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    """    const externalProjectBytes = Object.fromEntries(
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
""",
    """    const assetBytesByProject = Object.fromEntries(
      Object.entries(assetLibraries).map(([projectId, library]) => [
        projectId,
        library.totalBytes,
      ]),
    );
    setCommandState((current) =>
      trimWorkspaceRedoHistoryForExternalProjectBytesWithCanvasHistory(
        current,
        getWorkspaceRedoRetainedBytesByProject(current, assetBytesByProject),
      ),
    );
""",
)

Path('.github/workflows/bound-redo-related-histories.yml').unlink(missing_ok=True)
Path('.github/scripts/bound-redo-related-histories.py').unlink(missing_ok=True)
