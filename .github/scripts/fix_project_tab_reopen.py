from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one target, found {count}")
    file_path.write_text(content.replace(old, new), encoding="utf-8")


replace_once(
    "apps/desktop/src/ProjectTabs.tsx",
    "  const canReopen = tabs.recentlyClosedTabs.length > 0;",
    "  const canReopen =\n    tabs.recentlyClosedTabs.length > 0 || tabs.closedProjectIds.length > 0;",
)

replace_once(
    "apps/desktop/src/project-tabs-model.ts",
    """  const recentlyClosedTab = state.recentlyClosedTabs.find(
    (tab) =>
      availableIds.has(tab.projectId) &&
      !state.openProjectIds.includes(tab.projectId),
  );
  if (recentlyClosedTab === undefined) {
""",
    """  const recentlyClosedTab =
    state.recentlyClosedTabs.find(
      (tab) =>
        availableIds.has(tab.projectId) &&
        !state.openProjectIds.includes(tab.projectId),
    ) ?? restoreClosedProjectTabCandidate(state, projectIds);
  if (recentlyClosedTab === undefined) {
""",
)

replace_once(
    "apps/desktop/src/project-tabs-model.ts",
    """function uniqueAvailableProjectIds(
""",
    """function restoreClosedProjectTabCandidate(
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
""",
)

Path("apps/desktop/test/project-tab-persistence-reopen.test.ts").write_text(
    """import { describe, expect, it } from 'vitest';
import {
  reopenLastProjectTab,
  restoreProjectTabsState,
} from '../src/project-tabs-model';

describe('persisted project tab reopen', () => {
  it('再読込後も保存済みの閉じたProjectをWorkspace順で復元できる', () => {
    const restored = restoreProjectTabsState(
      'workspace-1',
      ['p1', 'p2', 'p3'],
      'p1',
      {
        openProjectIds: ['p1', 'p3'],
        pinnedProjectIds: [],
      },
      4,
    );

    expect(restored.closedProjectIds).toEqual(['p2']);
    expect(restored.recentlyClosedTabs).toEqual([]);

    const reopened = reopenLastProjectTab(restored, ['p1', 'p2', 'p3']);
    expect(reopened.reopenedProjectId).toBe('p2');
    expect(reopened.state.openProjectIds).toEqual(['p1', 'p2', 'p3']);
    expect(reopened.state.closedProjectIds).toEqual([]);
  });
});
""",
    encoding="utf-8",
)

print("Project tab reopen fix applied")
