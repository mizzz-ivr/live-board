import { describe, expect, it } from 'vitest';
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
