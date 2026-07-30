import { describe, expect, it } from 'vitest';
import {
  closeProjectTab,
  createProjectTabsState,
  moveProjectTab,
  moveProjectTabByOffset,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  synchronizeProjectTabsState,
  toggleProjectTabPin,
} from '../src/project-tabs-model';

describe('project tabs model', () => {
  it('Workspace切り替え時は全Projectを開き、セッション状態を初期化する', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2']);
    state = toggleProjectTabPin(state, 'p2');
    const next = synchronizeProjectTabsState(state, 'workspace-2', ['p3', 'p4'], 'p3');
    expect(next).toEqual({
      workspaceId: 'workspace-2',
      sessionRevision: 0,
      openProjectIds: ['p3', 'p4'],
      pinnedProjectIds: [],
      recentlyClosedTabs: [],
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
      pinnedProjectIds: [],
      recentlyClosedTabs: [],
    });
  });

  it('カスタム順とピン留めを維持し、新規Projectを通常タブ末尾へ開く', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2']);
    state = moveProjectTab(state, 'p2', 'p1', 'before');
    state = toggleProjectTabPin(state, 'p1');

    const next = synchronizeProjectTabsState(
      state,
      'workspace-1',
      ['p1', 'p2', 'p3'],
      'p2',
    );
    expect(next.openProjectIds).toEqual(['p1', 'p2', 'p3']);
    expect(next.pinnedProjectIds).toEqual(['p1']);
  });

  it('ピン留めしたタブを左側へ移動し、Closeを拒否する', () => {
    const state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    const pinned = toggleProjectTabPin(state, 'p2');
    expect(pinned.openProjectIds).toEqual(['p2', 'p1', 'p3']);
    expect(pinned.pinnedProjectIds).toEqual(['p2']);
    expect(closeProjectTab(pinned, 'p2', 'p2')).toEqual({
      state: pinned,
      nextActiveProjectId: 'p2',
    });

    const unpinned = toggleProjectTabPin(pinned, 'p2');
    expect(unpinned.openProjectIds).toEqual(['p2', 'p1', 'p3']);
    expect(unpinned.pinnedProjectIds).toEqual([]);
  });

  it('同じピン領域内だけ並び替え、境界を越える移動を拒否する', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    state = toggleProjectTabPin(state, 'p1');
    const reordered = moveProjectTab(state, 'p3', 'p2', 'before');
    expect(reordered.openProjectIds).toEqual(['p1', 'p3', 'p2']);
    expect(moveProjectTab(reordered, 'p1', 'p3', 'after')).toBe(reordered);
  });

  it('キーボード並び替えは同じ領域内で端を越えない', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    state = toggleProjectTabPin(state, 'p1');
    const moved = moveProjectTabByOffset(state, 'p3', -1);
    expect(moved.openProjectIds).toEqual(['p1', 'p3', 'p2']);
    expect(moveProjectTabByOffset(moved, 'p3', -1)).toBe(moved);
    expect(moveProjectTabByOffset(moved, 'p1', 1)).toBe(moved);
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

  it('閉じた通常タブをLIFOで閉じる前の並び位置へ復元する', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    state = moveProjectTab(state, 'p3', 'p1', 'before');
    state = closeProjectTab(state, 'p1', 'p3').state;
    state = closeProjectTab(state, 'p2', 'p3').state;

    const first = reopenLastProjectTab(state, ['p1', 'p2', 'p3']);
    expect(first.reopenedProjectId).toBe('p2');
    expect(first.state.openProjectIds).toEqual(['p3', 'p2']);

    const second = reopenLastProjectTab(first.state, ['p1', 'p2', 'p3']);
    expect(second.reopenedProjectId).toBe('p1');
    expect(second.state.openProjectIds).toEqual(['p3', 'p1', 'p2']);
  });

  it('ピン留め領域を維持して通常タブを復元する', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    state = toggleProjectTabPin(state, 'p3');
    state = closeProjectTab(state, 'p1', 'p2').state;

    const reopened = reopenLastProjectTab(state, ['p1', 'p2', 'p3']);
    expect(reopened.state.openProjectIds).toEqual(['p3', 'p1', 'p2']);
    expect(reopened.state.pinnedProjectIds).toEqual(['p3']);
  });

  it('左右キーは循環し、HomeとEndで現在の表示順の端へ移動する', () => {
    const ids = ['p3', 'p1', 'p2'];
    expect(resolveProjectTabNavigation(ids, 'p3', 'ArrowLeft')).toBe('p2');
    expect(resolveProjectTabNavigation(ids, 'p2', 'ArrowRight')).toBe('p3');
    expect(resolveProjectTabNavigation(ids, 'p1', 'Home')).toBe('p3');
    expect(resolveProjectTabNavigation(ids, 'p1', 'End')).toBe('p2');
  });
});
