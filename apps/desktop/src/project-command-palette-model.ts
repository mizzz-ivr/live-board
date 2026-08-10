import type { Project } from '@live-board/domain';
import {
  isProjectTabPinned,
  type ProjectTabsState,
} from './project-tabs-model';

export type ProjectTabCommandKind =
  | 'select-project'
  | 'create-project'
  | 'duplicate-active'
  | 'rename-active'
  | 'delete-active'
  | 'toggle-pin-active'
  | 'close-active'
  | 'reopen-last'
  | 'undo-project-operation'
  | 'redo-project-operation'
  | 'select-page'
  | 'create-page'
  | 'duplicate-page'
  | 'rename-page'
  | 'delete-page'
  | 'move-page-up'
  | 'move-page-down'
  | 'undo-page-operation'
  | 'redo-page-operation'
  | 'show-shortcut-help';

export interface ProjectTabCommand {
  readonly id: string;
  readonly kind: ProjectTabCommandKind;
  readonly group: string;
  readonly label: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly disabled: boolean;
  readonly projectId?: string;
  readonly pageId?: string | undefined;
  readonly toIndex?: number | undefined;
}

export interface CreateProjectTabCommandsInput {
  readonly projects: readonly Project[];
  readonly activeProjectId: string;
  readonly tabs: ProjectTabsState;
  readonly canUndoProjectOperation: boolean;
  readonly canRedoProjectOperation: boolean;
  readonly canUndoPageOperation: boolean;
  readonly canRedoPageOperation: boolean;
}

export function createProjectTabCommands({
  projects,
  activeProjectId,
  tabs,
  canUndoProjectOperation,
  canRedoProjectOperation,
  canUndoPageOperation,
  canRedoPageOperation,
}: CreateProjectTabCommandsInput): ProjectTabCommand[] {
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const activePinned = isProjectTabPinned(tabs, activeProjectId);
  const canCloseActive = tabs.openProjectIds.length > 1 && !activePinned;
  const canReopen =
    tabs.recentlyClosedTabs.length > 0 || tabs.closedProjectIds.length > 0;
  const activePages = activeProject?.pages ?? [];
  const activePageId = activeProject?.activeEditPageId ?? '';
  const activePageIndex = activePages.findIndex((page) => page.id === activePageId);
  const activePage = activePages[activePageIndex];

  const projectCommands = projects.map((project): ProjectTabCommand => {
    const open = tabs.openProjectIds.includes(project.id);
    const pinned = isProjectTabPinned(tabs, project.id);
    const active = project.id === activeProjectId;
    return {
      id: `select-project:${project.id}`,
      kind: 'select-project',
      group: 'Projectを開く',
      label: project.name,
      description: active
        ? '現在選択中のProjectです。'
        : open
          ? '開いているProjectタブへ切り替えます。'
          : '閉じているProjectタブを開いて切り替えます。',
      keywords: [
        'project',
        'プロジェクト',
        '切り替え',
        '開く',
        open ? '開いている' : '閉じている',
        pinned ? 'ピン留め 固定' : '',
        project.name,
      ],
      disabled: false,
      projectId: project.id,
    };
  });

  const pageCommands = activePages.map((page): ProjectTabCommand => {
    const active = page.id === activePageId;
    const broadcasting = page.id === activeProject?.activeBroadcastPageId;
    return {
      id: `select-page:${page.id}`,
      kind: 'select-page',
      group: 'Pageを開く',
      label: page.name,
      description: active
        ? '現在編集中のPageです。'
        : broadcasting
          ? '配信中のPageを編集対象へ切り替えます。'
          : '編集対象Pageへ切り替えます。',
      keywords: [
        'page',
        'ページ',
        '切り替え',
        '開く',
        active ? '編集中' : '待機中',
        broadcasting ? '配信中' : '',
        page.name,
      ],
      disabled: false,
      pageId: page.id,
    };
  });

  const activeName = activeProject?.name ?? 'Project';
  const activePageName = activePage?.name ?? 'Page';
  const operationCommands: ProjectTabCommand[] = [
    {
      id: 'create-project',
      kind: 'create-project',
      group: 'Project操作',
      label: '新しいProjectを作成',
      description: '空のProjectを追加して選択します。',
      keywords: ['project', 'プロジェクト', '新規', '作成', '追加'],
      disabled: false,
    },
    {
      id: 'duplicate-active',
      kind: 'duplicate-active',
      group: 'Project操作',
      label: 'アクティブProjectを複製',
      description: `${activeName}のPage構成を複製します。`,
      keywords: ['project', 'プロジェクト', '複製', 'コピー', activeName],
      disabled: activeProject === undefined,
    },
    {
      id: 'rename-active',
      kind: 'rename-active',
      group: 'Project操作',
      label: 'アクティブProject名を変更',
      description: `${activeName}の名前変更ダイアログを開きます。`,
      keywords: ['project', 'プロジェクト', '名前', '変更', 'rename', activeName],
      disabled: activeProject === undefined,
    },
    {
      id: 'delete-active',
      kind: 'delete-active',
      group: 'Project操作',
      label: 'アクティブProjectを削除',
      description:
        projects.length <= 1
          ? 'Workspaceには1件以上のProjectが必要です。'
          : `${activeName}を確認後に削除します。`,
      keywords: ['project', 'プロジェクト', '削除', 'delete', activeName],
      disabled: activeProject === undefined || projects.length <= 1,
    },
    {
      id: 'toggle-pin-active',
      kind: 'toggle-pin-active',
      group: 'タブ操作',
      label: activePinned
        ? 'アクティブタブのピン留めを解除'
        : 'アクティブタブをピン留め',
      description: activePinned
        ? '通常タブへ戻してCloseできる状態にします。'
        : 'タブを左側へ固定し、Closeを防ぎます。',
      keywords: ['タブ', 'ピン留め', '固定', activePinned ? '解除' : '追加'],
      disabled: activeProject === undefined,
    },
    {
      id: 'close-active',
      kind: 'close-active',
      group: 'タブ操作',
      label: 'アクティブタブを閉じる',
      description: activePinned
        ? 'ピン留めを解除すると閉じられます。'
        : tabs.openProjectIds.length <= 1
          ? '最後の1タブは閉じられません。'
          : 'Project本体を削除せず、タブだけを閉じます。',
      keywords: ['タブ', '閉じる', 'close', 'ctrl w', 'cmd w'],
      disabled: !canCloseActive,
    },
    {
      id: 'reopen-last',
      kind: 'reopen-last',
      group: 'タブ操作',
      label: '閉じたタブを復元',
      description: canReopen
        ? '直近または保存済みの閉じたProjectタブを復元します。'
        : '復元できるProjectタブはありません。',
      keywords: ['タブ', '復元', 'reopen', 'ctrl shift t', 'cmd shift t'],
      disabled: !canReopen,
    },
    {
      id: 'undo-project-operation',
      kind: 'undo-project-operation',
      group: 'Project操作履歴',
      label: 'Project操作を元に戻す',
      description: canUndoProjectOperation
        ? '直前のProject作成・複製・削除・名前変更を元に戻します。'
        : '元に戻せるProject操作はありません。',
      keywords: ['project', 'プロジェクト', 'undo', '元に戻す', '履歴'],
      disabled: !canUndoProjectOperation,
    },
    {
      id: 'redo-project-operation',
      kind: 'redo-project-operation',
      group: 'Project操作履歴',
      label: 'Project操作をやり直す',
      description: canRedoProjectOperation
        ? '取り消したProject操作をやり直します。'
        : 'やり直せるProject操作はありません。',
      keywords: ['project', 'プロジェクト', 'redo', 'やり直す', '履歴'],
      disabled: !canRedoProjectOperation,
    },
    {
      id: 'create-page',
      kind: 'create-page',
      group: 'Page操作',
      label: '新しいPageを作成',
      description: `${activeName}へ空のPageを追加して編集対象にします。`,
      keywords: ['page', 'ページ', '新規', '作成', '追加', activeName],
      disabled: activeProject === undefined,
    },
    {
      id: 'duplicate-page',
      kind: 'duplicate-page',
      group: 'Page操作',
      label: '編集中Pageを複製',
      description: `${activePageName}を複製し、複製先を編集対象にします。`,
      keywords: ['page', 'ページ', '複製', 'コピー', 'duplicate', activePageName],
      disabled: activePage === undefined,
      pageId: activePage?.id,
    },
    {
      id: 'rename-page',
      kind: 'rename-page',
      group: 'Page操作',
      label: '編集中Page名を変更',
      description: `${activePageName}の名前変更ダイアログを開きます。`,
      keywords: ['page', 'ページ', '名前', '変更', 'rename', activePageName],
      disabled: activePage === undefined,
      pageId: activePage?.id,
    },
    {
      id: 'delete-page',
      kind: 'delete-page',
      group: 'Page操作',
      label: '編集中Pageを削除',
      description:
        activePages.length <= 1
          ? 'Projectには1件以上のPageが必要です。'
          : `${activePageName}を確認後に削除します。`,
      keywords: ['page', 'ページ', '削除', 'delete', activePageName],
      disabled: activePage === undefined || activePages.length <= 1,
      pageId: activePage?.id,
    },
    {
      id: 'move-page-up',
      kind: 'move-page-up',
      group: 'Page操作',
      label: '編集中Pageを上へ移動',
      description:
        activePageIndex <= 0
          ? 'このPageは既に先頭です。'
          : `${activePageName}を1つ上へ移動します。`,
      keywords: ['page', 'ページ', '上へ', '並び替え', 'move up', activePageName],
      disabled: activePageIndex <= 0,
      pageId: activePage?.id,
      toIndex: activePageIndex - 1,
    },
    {
      id: 'move-page-down',
      kind: 'move-page-down',
      group: 'Page操作',
      label: '編集中Pageを下へ移動',
      description:
        activePageIndex < 0 || activePageIndex >= activePages.length - 1
          ? 'このPageは既に末尾です。'
          : `${activePageName}を1つ下へ移動します。`,
      keywords: ['page', 'ページ', '下へ', '並び替え', 'move down', activePageName],
      disabled:
        activePageIndex < 0 || activePageIndex >= activePages.length - 1,
      pageId: activePage?.id,
      toIndex: activePageIndex + 1,
    },
    {
      id: 'undo-page-operation',
      kind: 'undo-page-operation',
      group: 'Page操作履歴',
      label: 'Page操作を元に戻す',
      description: canUndoPageOperation
        ? '直前のPage追加・複製・名前変更・削除・並び替えを元に戻します。'
        : '元に戻せるPage操作はありません。',
      keywords: ['page', 'ページ', 'undo', '元に戻す', '履歴'],
      disabled: !canUndoPageOperation,
    },
    {
      id: 'redo-page-operation',
      kind: 'redo-page-operation',
      group: 'Page操作履歴',
      label: 'Page操作をやり直す',
      description: canRedoPageOperation
        ? '取り消したPage操作をやり直します。'
        : 'やり直せるPage操作はありません。',
      keywords: ['page', 'ページ', 'redo', 'やり直す', '履歴'],
      disabled: !canRedoPageOperation,
    },
    {
      id: 'show-shortcut-help',
      kind: 'show-shortcut-help',
      group: 'ヘルプ',
      label: 'キーボードショートカット一覧を表示',
      description: 'Projectタブで利用できるキー操作を確認します。',
      keywords: ['ヘルプ', 'help', 'ショートカット', 'keyboard', '?'],
      disabled: false,
    },
  ];

  return [...projectCommands, ...pageCommands, ...operationCommands];
}

export function filterProjectTabCommands(
  commands: readonly ProjectTabCommand[],
  query: string,
): ProjectTabCommand[] {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [...commands];

  return commands.filter((command) => {
    const searchableText = normalizeSearchText(
      [command.label, command.description, command.group, ...command.keywords].join(
        ' ',
      ),
    );
    return tokens.every((token) => searchableText.includes(token));
  });
}

export function findFirstEnabledProjectTabCommandIndex(
  commands: readonly ProjectTabCommand[],
): number {
  return commands.findIndex((command) => !command.disabled);
}

export function moveProjectTabCommandSelection(
  commands: readonly ProjectTabCommand[],
  currentIndex: number,
  direction: -1 | 1,
): number {
  if (commands.length === 0 || commands.every((command) => command.disabled)) {
    return -1;
  }

  let index =
    currentIndex >= 0 && currentIndex < commands.length
      ? currentIndex
      : direction > 0
        ? -1
        : 0;
  for (let step = 0; step < commands.length; step += 1) {
    index = (index + direction + commands.length) % commands.length;
    if (!commands[index]!.disabled) return index;
  }
  return -1;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
