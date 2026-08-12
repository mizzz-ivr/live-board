import type { Project } from '@live-board/domain';
import { describe, expect, it } from 'vitest';
import {
  createProjectTabCommands,
  filterProjectTabCommands,
  findFirstEnabledProjectTabCommandIndex,
  moveProjectTabCommandSelection,
  type ProjectTabCommand,
} from '../src/project-command-palette-model';
import {
  closeProjectTab,
  createProjectTabsState,
  openProjectTab,
  toggleProjectTabPin,
} from '../src/project-tabs-model';
import {
  PROJECT_TAB_SHORTCUT_GROUPS,
  resolveProjectTabShortcut,
  type ProjectTabShortcutInput,
} from '../src/project-tab-shortcuts';

const projects = [
  { id: 'p1', name: '配信メイン' },
  { id: 'p2', name: 'ゲーム待機画面' },
  { id: 'p3', name: '雑談エンディング' },
] as Project[];

function shortcut(
  input: Partial<ProjectTabShortcutInput>,
): ProjectTabShortcutInput {
  return {
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    editableTarget: false,
    ...input,
  };
}

describe('project command palette', () => {
  it('Project切り替えと主要操作を生成し、状態に応じて無効化する', () => {
    let tabs = createProjectTabsState(
      'workspace-1',
      projects.map((project) => project.id),
    );
    tabs = toggleProjectTabPin(tabs, 'p1');

    const commands = createProjectTabCommands({
      projects,
      activeProjectId: 'p1',
      tabs,
      canUndoProjectOperation: false,
      canRedoProjectOperation: true,
      canUndoPageOperation: false,
      canRedoPageOperation: false,
    });

    expect(
      commands.filter((command) => command.kind === 'select-project'),
    ).toHaveLength(3);
    expect(
      commands.find((command) => command.id === 'close-active')?.disabled,
    ).toBe(true);
    expect(
      commands.find((command) => command.id === 'undo-project-operation')
        ?.disabled,
    ).toBe(true);
    expect(
      commands.find((command) => command.id === 'redo-project-operation')
        ?.disabled,
    ).toBe(false);
    expect(
      commands.find((command) => command.id === 'toggle-pin-active')?.label,
    ).toContain('解除');
  });

  it('NFKC・大文字小文字・前後空白を正規化し、複数語をAND検索する', () => {
    const commands = createProjectTabCommands({
      projects,
      activeProjectId: 'p1',
      tabs: createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']),
      canUndoProjectOperation: true,
      canRedoProjectOperation: false,
      canUndoPageOperation: false,
      canRedoPageOperation: false,
    });

    expect(
      filterProjectTabCommands(commands, '  ゲーム　待機  ').map(
        (command) => command.id,
      ),
    ).toEqual(['select-project:p2']);
    expect(
      filterProjectTabCommands(commands, 'PROJECT RENAME').map(
        (command) => command.id,
      ),
    ).toEqual(['rename-active']);
    expect(filterProjectTabCommands(commands, '一致しない')).toEqual([]);
  });

  it('アクティブProjectのPage候補と主要操作を生成し、境界条件を無効化する', () => {
    const pageProjects = [
      {
        id: 'p1',
        name: '配信メイン',
        activeEditPageId: 'page-1',
        activeBroadcastPageId: 'page-2',
        pages: [
          { id: 'page-1', name: 'オープニング' },
          { id: 'page-2', name: '待機画面' },
        ],
      },
    ] as unknown as Project[];
    const commands = createProjectTabCommands({
      projects: pageProjects,
      activeProjectId: 'p1',
      tabs: createProjectTabsState('workspace-1', ['p1']),
      canUndoProjectOperation: false,
      canRedoProjectOperation: false,
      canUndoPageOperation: true,
      canRedoPageOperation: false,
    });

    expect(
      commands.filter((command) => command.kind === 'select-page').map(
        (command) => command.pageId,
      ),
    ).toEqual(['page-1', 'page-2']);
    expect(commands.find((command) => command.id === 'move-page-up')?.disabled).toBe(true);
    expect(commands.find((command) => command.id === 'move-page-down')?.disabled).toBe(false);
    expect(commands.find((command) => command.id === 'delete-page')?.disabled).toBe(false);
    expect(commands.find((command) => command.id === 'undo-page-operation')?.disabled).toBe(false);
    expect(
      filterProjectTabCommands(commands, 'page 待機').map((command) => command.id),
    ).toContain('select-page:page-2');
    expect(
      filterProjectTabCommands(commands, 'template').map((command) => command.id),
    ).toEqual(['show-page-templates']);
  });

  it('無効候補を飛ばして循環選択し、全件無効では-1を返す', () => {
    const commands = [
      { id: 'a', disabled: true },
      { id: 'b', disabled: false },
      { id: 'c', disabled: true },
      { id: 'd', disabled: false },
    ] as ProjectTabCommand[];

    expect(findFirstEnabledProjectTabCommandIndex(commands)).toBe(1);
    expect(moveProjectTabCommandSelection(commands, 1, 1)).toBe(3);
    expect(moveProjectTabCommandSelection(commands, 3, 1)).toBe(1);
    expect(moveProjectTabCommandSelection(commands, 1, -1)).toBe(3);
    expect(
      moveProjectTabCommandSelection(
        commands.map((command) => ({ ...command, disabled: true })),
        0,
        1,
      ),
    ).toBe(-1);
  });

  it('閉じたProjectを指定して開き、Close履歴から除外する', () => {
    const initial = createProjectTabsState('workspace-1', ['p1', 'p2']);
    const closed = closeProjectTab(initial, 'p2', 'p1').state;
    const opened = openProjectTab(closed, 'p2');

    expect(opened.openProjectIds).toEqual(['p1', 'p2']);
    expect(opened.closedProjectIds).toEqual([]);
    expect(opened.recentlyClosedTabs).toEqual([]);
    expect(openProjectTab(opened, 'missing')).toBe(opened);
  });

  it('Ctrl/Cmd+Kをコマンドパレット表示として解決し、一覧にも掲載する', () => {
    expect(
      resolveProjectTabShortcut(shortcut({ key: 'k', ctrlKey: true })),
    ).toBe('show-command-palette');
    expect(
      resolveProjectTabShortcut(shortcut({ key: 'K', metaKey: true })),
    ).toBe('show-command-palette');
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'k', ctrlKey: true, editableTarget: true }),
      ),
    ).toBeNull();

    const item = PROJECT_TAB_SHORTCUT_GROUPS
      .flatMap((group) => group.items)
      .find((candidate) => candidate.id === 'show-command-palette');
    expect(item?.keys).toEqual(['Ctrl/Cmd', 'K']);
  });
});
