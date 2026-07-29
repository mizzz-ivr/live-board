import { describe, expect, it } from 'vitest';
import {
  closeProjectTab,
  createProjectTabsState,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  synchronizeProjectTabsState,
} from '../src/project-tabs-model';

describe('project tabs model', () => {
  it('Workspace切り替え時は全Projectを開く', () => {
    const state = createProjectTabsState('workspace-1', ['p1', 'p2']);
    const next = synchronizeProjectTabsState(state, 'workspace-2', ['p3', 'p4'], 'p3');
    expect(next).toEqual({
      workspaceId: 'workspace-2',
      sessionRevision: 0,
      openProjectIds: ['p3', 'p4'],
      recentlyClosedProjectIds: [],
    });
  });

  it('同じWorkspace IDでも読込セッションが変われば全Projectを開き直す', () => {
    const state = closeProjectTab(
      createProjectTabsState('workspace-1', ['p1', 'p2'], 3),
      'p2',
      'p1',
    ).state;
    const next = synchronizeProjectTabsState(
      state,
      'workspace-1',
      ['p1', 'p2'],
      'p1',
      4,
    );
    expect(next).toEqual({
      workspaceId: 'workspace-1',
      sessionRevision: 4,
      openProjectIds: ['p1', 'p2'],
      recentlyClosedProjectIds: [],
    });
  });

  it('新規Projectを自動的に開く', () => {
    const state = createProjectTabsState('workspace-1', ['p1']);
    const next = synchronizeProjectTabsState(state, 'workspace-1', ['p1', 'p2'], 'p2');
    expect(next.openProjectIds).toEqual(['p1', 'p2']);
  });

  it('アクティブタブを閉じると右隣、末尾では左隣を選ぶ', () => {
    const state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    const middle = closeProjectTab(state, 'p2', 'p2');
    expect(middle.state.openProjectIds).toEqual(['p1', 'p3']);
    expect(middle.nextActiveProjectId).toBe('p3');

    const last = closeProjectTab(state, 'p3', 'p3');
    expect(last.nextActiveProjectId).toBe('p2');
  });

  it('非アクティブタブを閉じても選択を維持する', () => {
    const state = createProjectTabsState('workspace-1', ['p1', 'p2']);
    expect(closeProjectTab(state, 'p2', 'p1').nextActiveProjectId).toBe('p1');
  });

  it('最後の1タブは閉じない', () => {
    const state = createProjectTabsState('workspace-1', ['p1']);
    expect(closeProjectTab(state, 'p1', 'p1')).toEqual({
      state,
      nextActiveProjectId: 'p1',
    });
  });

  it('直近に閉じたタブをLIFOで元のProject順へ復元する', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    state = closeProjectTab(state, 'p2', 'p1').state;
    state = closeProjectTab(state, 'p3', 'p1').state;

    const first = reopenLastProjectTab(state, ['p1', 'p2', 'p3']);
    expect(first.reopenedProjectId).toBe('p3');
    expect(first.state.openProjectIds).toEqual(['p1', 'p3']);

    const second = reopenLastProjectTab(first.state, ['p1', 'p2', 'p3']);
    expect(second.reopenedProjectId).toBe('p2');
    expect(second.state.openProjectIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('左右キーは循環し、HomeとEndで端へ移動する', () => {
    const ids = ['p1', 'p2', 'p3'];
    expect(resolveProjectTabNavigation(ids, 'p1', 'ArrowLeft')).toBe('p3');
    expect(resolveProjectTabNavigation(ids, 'p3', 'ArrowRight')).toBe('p1');
    expect(resolveProjectTabNavigation(ids, 'p2', 'Home')).toBe('p1');
    expect(resolveProjectTabNavigation(ids, 'p2', 'End')).toBe('p3');
  });
});
