from pathlib import Path

def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected text not found in {path}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")

model = "apps/desktop/src/project-command-palette-model.ts"
replace_once(
    model,
    "  | 'redo-project-operation'\n  | 'show-shortcut-help';",
    """  | 'redo-project-operation'
  | 'select-page'
  | 'create-page'
  | 'duplicate-page'
  | 'rename-page'
  | 'delete-page'
  | 'move-page-up'
  | 'move-page-down'
  | 'undo-page-operation'
  | 'redo-page-operation'
  | 'show-shortcut-help';""",
)
replace_once(
    model,
    "  readonly disabled: boolean;\n  readonly projectId?: string;\n}",
    """  readonly disabled: boolean;
  readonly projectId?: string;
  readonly pageId?: string;
  readonly toIndex?: number;
}""",
)
replace_once(
    model,
    "  readonly canUndoProjectOperation: boolean;\n  readonly canRedoProjectOperation: boolean;\n}",
    """  readonly canUndoProjectOperation: boolean;
  readonly canRedoProjectOperation: boolean;
  readonly canUndoPageOperation: boolean;
  readonly canRedoPageOperation: boolean;
}""",
)
replace_once(
    model,
    """  canUndoProjectOperation,
  canRedoProjectOperation,
}: CreateProjectTabCommandsInput): ProjectTabCommand[] {""",
    """  canUndoProjectOperation,
  canRedoProjectOperation,
  canUndoPageOperation,
  canRedoPageOperation,
}: CreateProjectTabCommandsInput): ProjectTabCommand[] {""",
)
replace_once(
    model,
    """  const canReopen =
    tabs.recentlyClosedTabs.length > 0 || tabs.closedProjectIds.length > 0;

  const projectCommands = projects.map""",
    """  const canReopen =
    tabs.recentlyClosedTabs.length > 0 || tabs.closedProjectIds.length > 0;
  const activePages = activeProject?.pages ?? [];
  const activePageId = activeProject?.activeEditPageId ?? '';
  const activePageIndex = activePages.findIndex((page) => page.id === activePageId);
  const activePage = activePages[activePageIndex];

  const projectCommands = projects.map""",
)
replace_once(
    model,
    "  const activeName = activeProject?.name ?? 'Project';\n  const operationCommands: ProjectTabCommand[] = [",
    """  const pageCommands = activePages.map((page): ProjectTabCommand => {
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
  const operationCommands: ProjectTabCommand[] = [""",
)
replace_once(
    model,
    """    {
      id: 'show-shortcut-help',
      kind: 'show-shortcut-help',
      group: 'ヘルプ',""",
    """    {
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
      group: 'ヘルプ',""",
)
replace_once(
    model,
    "  return [...projectCommands, ...operationCommands];",
    "  return [...projectCommands, ...pageCommands, ...operationCommands];",
)

tabs = "apps/desktop/src/ProjectTabs.tsx"
replace_once(tabs, "import type { Project } from '@live-board/domain';", "import type { Page, Project } from '@live-board/domain';")
replace_once(
    tabs,
    """  canUndoProjectOperation: boolean;
  canRedoProjectOperation: boolean;
  onTabsChange:""",
    """  canUndoProjectOperation: boolean;
  canRedoProjectOperation: boolean;
  canUndoPageOperation: boolean;
  canRedoPageOperation: boolean;
  onTabsChange:""",
)
replace_once(
    tabs,
    """  onUndoProjectOperation(): void;
  onRedoProjectOperation(): void;
}""",
    """  onUndoProjectOperation(): void;
  onRedoProjectOperation(): void;
  onSelectPage(pageId: string): void;
  onCreatePage(): void;
  onDuplicatePage(): void;
  onDeletePage(pageId: string): void;
  onRenamePage(pageId: string, name: string): void;
  onMovePage(pageId: string, toIndex: number): void;
  onUndoPageOperation(): void;
  onRedoPageOperation(): void;
}""",
)
replace_once(
    tabs,
    """  canUndoProjectOperation,
  canRedoProjectOperation,
  onTabsChange,""",
    """  canUndoProjectOperation,
  canRedoProjectOperation,
  canUndoPageOperation,
  canRedoPageOperation,
  onTabsChange,""",
)
replace_once(
    tabs,
    """  onUndoProjectOperation,
  onRedoProjectOperation,
}: ProjectTabsProps) {""",
    """  onUndoProjectOperation,
  onRedoProjectOperation,
  onSelectPage,
  onCreatePage,
  onDuplicatePage,
  onDeletePage,
  onRenamePage,
  onMovePage,
  onUndoPageOperation,
  onRedoPageOperation,
}: ProjectTabsProps) {""",
)
replace_once(
    tabs,
    """        canUndoProjectOperation,
        canRedoProjectOperation,
      }),""",
    """        canUndoProjectOperation,
        canRedoProjectOperation,
        canUndoPageOperation,
        canRedoPageOperation,
      }),""",
)
replace_once(
    tabs,
    """      canRedoProjectOperation,
      canUndoProjectOperation,
      projects,""",
    """      canRedoPageOperation,
      canRedoProjectOperation,
      canUndoPageOperation,
      canUndoProjectOperation,
      projects,""",
)
replace_once(
    tabs,
    "  function executeCommandPaletteCommand(command: ProjectTabCommand): void {",
    """  function renamePage(page: Page): void {
    const requestedName = window.prompt(
      'Page名を入力してください（1〜120文字）',
      page.name,
    );
    if (requestedName === null) return;

    const normalizedName = requestedName.trim();
    if (normalizedName.length < 1 || normalizedName.length > 120) {
      window.alert('Page名は1〜120文字で入力してください');
      return;
    }
    onRenamePage(page.id, normalizedName);
  }

  function executeCommandPaletteCommand(command: ProjectTabCommand): void {""",
)
replace_once(
    tabs,
    """        case 'redo-project-operation':
          onRedoProjectOperation();
          return;
        case 'show-shortcut-help':""",
    """        case 'redo-project-operation':
          onRedoProjectOperation();
          return;
        case 'select-page':
          if (command.pageId !== undefined) onSelectPage(command.pageId);
          return;
        case 'create-page':
          onCreatePage();
          return;
        case 'duplicate-page':
          onDuplicatePage();
          return;
        case 'rename-page': {
          const activeProject = projectsById.get(activeProjectId);
          const page = activeProject?.pages.find(
            (candidate) => candidate.id === command.pageId,
          );
          if (page !== undefined) renamePage(page);
          return;
        }
        case 'delete-page': {
          const activeProject = projectsById.get(activeProjectId);
          const page = activeProject?.pages.find(
            (candidate) => candidate.id === command.pageId,
          );
          if (
            page !== undefined
            && window.confirm(
              `「${page.name}」を削除します。\\nこの操作はPage操作のUndoで元に戻せます。`,
            )
          ) {
            onDeletePage(page.id);
          }
          return;
        }
        case 'move-page-up':
        case 'move-page-down':
          if (command.pageId !== undefined && command.toIndex !== undefined) {
            onMovePage(command.pageId, command.toIndex);
          }
          return;
        case 'undo-page-operation':
          onUndoPageOperation();
          return;
        case 'redo-page-operation':
          onRedoPageOperation();
          return;
        case 'show-shortcut-help':""",
)

app = "apps/desktop/src/AppV2.tsx"
replace_once(app, "  createMovePageCommand,\n  createPage,", "  createMovePageCommand,\n  createPage,\n  createRenamePageCommand,")
replace_once(
    app,
    "  function duplicateEditPage(): void {",
    """  function renamePage(pageId: string, name: string): void {
    executeCommand(
      createRenamePageCommand(
        project.id,
        pageId,
        name,
        createCommandMetadata('page-rename'),
      ),
    );
  }

  function duplicateEditPage(): void {""",
)
replace_once(
    app,
    """          canUndoProjectOperation={canUndoWorkspace(commandState)}
          canRedoProjectOperation={canRedoWorkspace(commandState)}
          onTabsChange={setProjectTabsState}""",
    """          canUndoProjectOperation={canUndoWorkspace(commandState)}
          canRedoProjectOperation={canRedoWorkspace(commandState)}
          canUndoPageOperation={canUndoProject(commandState, project.id)}
          canRedoPageOperation={canRedoProject(commandState, project.id)}
          onTabsChange={setProjectTabsState}""",
)
replace_once(
    app,
    """          onUndoProjectOperation={undoProjectOperation}
          onRedoProjectOperation={redoProjectOperation}
        />""",
    """          onUndoProjectOperation={undoProjectOperation}
          onRedoProjectOperation={redoProjectOperation}
          onSelectPage={(pageId) =>
            executeCommand(
              createSelectEditPageCommand(
                project.id,
                pageId,
                createCommandMetadata('page-select-palette'),
              ),
            )
          }
          onCreatePage={addPage}
          onDuplicatePage={duplicateEditPage}
          onDeletePage={(pageId) =>
            executeCommand(
              createDeletePageCommand(
                project.id,
                pageId,
                createCommandMetadata('page-delete-palette'),
              ),
            )
          }
          onRenamePage={renamePage}
          onMovePage={(pageId, toIndex) =>
            executeCommand(
              createMovePageCommand(
                project.id,
                pageId,
                toIndex,
                createCommandMetadata('page-move-palette'),
              ),
            )
          }
          onUndoPageOperation={() => {
            setCommandState((current) =>
              undoProjectCommandWithCanvasHistory(current, project.id),
            );
            setDomainError(null);
          }}
          onRedoPageOperation={() => {
            setCommandState((current) =>
              redoProjectCommandWithCanvasHistory(current, project.id),
            );
            setDomainError(null);
          }}
        />""",
)

dialog = "apps/desktop/src/ProjectCommandPalette.tsx"
replace_once(
    dialog,
    """            <h2 id="project-command-palette-title">Projectコマンド</h2>
            <p id="project-command-palette-description">
              Projectの切り替えや主要操作を検索して実行します。
            </p>""",
    """            <h2 id="project-command-palette-title">Project / Pageコマンド</h2>
            <p id="project-command-palette-description">
              Project・Pageの切り替えや主要操作を検索して実行します。
            </p>""",
)
replace_once(dialog, '            placeholder="Project名または操作を検索"', '            placeholder="Project・Page名または操作を検索"')
replace_once(dialog, "            一致するProjectまたはコマンドがありません。", "            一致するProject・Pageまたはコマンドがありません。")

test_path = Path("apps/desktop/test/project-command-palette.test.ts")
text = test_path.read_text(encoding="utf-8")
text = text.replace(
    "      canRedoProjectOperation: true,\n",
    "      canRedoProjectOperation: true,\n      canUndoPageOperation: false,\n      canRedoPageOperation: false,\n",
)
text = text.replace(
    "      canRedoProjectOperation: false,\n",
    "      canRedoProjectOperation: false,\n      canUndoPageOperation: false,\n      canRedoPageOperation: false,\n",
)
marker = "  it('無効候補を飛ばして循環選択し、全件無効では-1を返す', () => {"
if marker not in text:
    raise RuntimeError("desktop unit insertion marker not found")
page_test = """  it('アクティブProjectのPage候補と主要操作を生成し、境界条件を無効化する', () => {
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
  });

"""
text = text.replace(marker, page_test + marker, 1)
test_path.write_text(text, encoding="utf-8")

existing_e2e = Path("tests/e2e/project-command-palette.spec.ts")
text = existing_e2e.read_text(encoding="utf-8")
text = text.replace("name: 'Projectコマンド'", "name: 'Project / Pageコマンド'")
text = text.replace("一致するProjectまたはコマンドがありません。", "一致するProject・Pageまたはコマンドがありません。")
existing_e2e.write_text(text, encoding="utf-8")

Path("tests/e2e/page-command-palette.spec.ts").write_text("""import { expect, test } from '@playwright/test';

test('コマンドパレットでPageを検索し、名前変更とUndo/Redoを実行できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  await page.getByRole('button', { name: 'ページを追加' }).click();
  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(2);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Project / Pageコマンド' });
  const search = dialog.getByRole('combobox', { name: 'コマンドを検索' });
  await search.fill('Pageを開く ページ 1');
  await page.keyboard.press('Enter');
  await expect(pageRows.nth(0)).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Control+K');
  await search.fill('page rename');
  page.once('dialog', async (prompt) => prompt.accept('待機オープニング'));
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-list')).toContainText('待機オープニング');

  await page.keyboard.press('Control+K');
  await search.fill('page undo');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-list')).toContainText('ページ 1');

  await page.keyboard.press('Control+K');
  await search.fill('page redo');
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-list')).toContainText('待機オープニング');
});

test('Page削除確認と移動境界を安全に扱う', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  await page.getByRole('button', { name: 'ページを追加' }).click();
  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(2);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Project / Pageコマンド' });
  const search = dialog.getByRole('combobox', { name: 'コマンドを検索' });

  await search.fill('page 下へ');
  await expect(dialog.getByRole('option', { name: /編集中Pageを下へ移動/ }))
    .toHaveAttribute('aria-disabled', 'true');

  await search.fill('page 上へ');
  await page.keyboard.press('Enter');
  await expect(pageRows.nth(0)).toContainText('ページ 2');

  await page.keyboard.press('Control+K');
  await search.fill('page delete');
  page.once('dialog', async (confirm) => confirm.dismiss());
  await page.keyboard.press('Enter');
  await expect(pageRows).toHaveCount(2);

  await page.keyboard.press('Control+K');
  await search.fill('page delete');
  page.once('dialog', async (confirm) => confirm.accept());
  await page.keyboard.press('Enter');
  await expect(pageRows).toHaveCount(1);

  await page.keyboard.press('Control+K');
  await search.fill('page delete');
  await expect(dialog.getByRole('option', { name: /編集中Pageを削除/ }))
    .toHaveAttribute('aria-disabled', 'true');
});
""", encoding="utf-8")

Path("docs/page-command-palette.md").write_text("""# Pageコマンドパレット

## 目的

`Ctrl/Cmd + K`で開くコマンドパレットから、現在ProjectのPage検索・切り替え・主要操作を実行できるようにします。

## 対応操作

- Page名検索と編集対象Pageへの切り替え
- Page追加
- 編集中Pageの複製
- Page名変更
- Page削除
- Pageを1つ上／下へ移動
- Page操作Undo／Redo

Page名変更は`page.rename`のProject Commandとして実装し、他のPage操作と同じProject履歴へ記録します。

## 安全性

- Page名はtrim後1〜120文字に制限します。
- 最後の1Pageは削除できません。
- 先頭Pageの「上へ」と末尾Pageの「下へ」は無効です。
- コマンドパレットからのPage削除は確認ダイアログを経由します。
- 無効コマンドは理由を表示し、Arrowキー選択とEnter実行の対象外にします。

## 変更しない範囲

- `.liveboard`スキーマ
- Workspace保存形式
- Electron IPC
- OBS Protocol
- Broadcast Snapshot
""", encoding="utf-8")
