from pathlib import Path

def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected text not found in {path}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")

replace_once(
    "packages/domain/src/commands.ts",
    "  | 'page.duplicate'\n  | 'page.delete'",
    "  | 'page.duplicate'\n  | 'page.rename'\n  | 'page.delete'",
)
replace_once(
    "packages/domain/src/commands.ts",
    """export type DeletePageCommand = ProjectCommandBase<
  'page.delete',
  { pageId: PageId }
>;""",
    """export type RenamePageCommand = ProjectCommandBase<
  'page.rename',
  { pageId: PageId; name: string }
>;
export type DeletePageCommand = ProjectCommandBase<
  'page.delete',
  { pageId: PageId }
>;""",
)
replace_once(
    "packages/domain/src/commands.ts",
    "  | DuplicatePageCommand\n  | DeletePageCommand",
    "  | DuplicatePageCommand\n  | RenamePageCommand\n  | DeletePageCommand",
)
replace_once(
    "packages/domain/src/commands.ts",
    "export function createDeletePageCommand(\n  projectId: ProjectId,",
    """export function createRenamePageCommand(
  projectId: ProjectId,
  pageId: PageId,
  name: string,
  metadata: CommandMetadata,
): RenamePageCommand {
  const normalizedName = name.trim();
  if (normalizedName.length < 1 || normalizedName.length > 120) {
    throw new DomainError('INVALID_NAME', 'Entity name must be 1 to 120 characters');
  }

  return {
    ...createCommandBase('page.rename', projectId, metadata),
    payload: { pageId, name: normalizedName },
  };
}

export function createDeletePageCommand(
  projectId: ProjectId,""",
)
replace_once(
    "packages/domain/src/commands.ts",
    """    case 'page.duplicate':
      return duplicatePage(
        project,
        command.payload.sourcePageId,
        command.payload.page,
        command.createdAt,
      );
    case 'page.delete':""",
    """    case 'page.duplicate':
      return duplicatePage(
        project,
        command.payload.sourcePageId,
        command.payload.page,
        command.createdAt,
      );
    case 'page.rename':
      return renamePage(
        project,
        command.payload.pageId,
        command.payload.name,
        command.createdAt,
      );
    case 'page.delete':""",
)
replace_once(
    "packages/domain/src/commands.ts",
    "function deletePage(\n  project: Project,",
    """function renamePage(
  project: Project,
  pageId: PageId,
  name: string,
  updatedAt: string,
): Project {
  const pageIndex = project.pages.findIndex((page) => page.id === pageId);
  if (pageIndex < 0) {
    throw new DomainError('PAGE_NOT_FOUND', `Page not found: ${pageId}`);
  }

  const currentPage = project.pages[pageIndex]!;
  if (currentPage.name === name) return project;

  const pages = [...project.pages];
  pages[pageIndex] = { ...currentPage, name, updatedAt };
  return { ...project, pages, updatedAt };
}

function deletePage(
  project: Project,""",
)

replace_once(
    "packages/domain/test/workspace.test.ts",
    "  createMovePageCommand,\n  createPage,",
    "  createMovePageCommand,\n  createPage,\n  createRenamePageCommand,",
)
replace_once(
    "packages/domain/test/workspace.test.ts",
    "  it('削除対象が編集・配信ページの場合は隣接ページへ切り替える', () => {",
    """  it('Page名変更を正規化して履歴へ記録し、Undo・Redoできる', () => {
    let state = createStateWithPages(['page-1', 'page-2']);
    state = dispatchProjectCommand(
      state,
      createRenamePageCommand(
        PROJECT_ID,
        'page-2',
        '  待機画面  ',
        metadata('rename-page-2'),
      ),
    );

    expect(state.workspace.projects[0]?.pages[1]?.name).toBe('待機画面');
    state = undoProjectCommand(state, PROJECT_ID);
    expect(state.workspace.projects[0]?.pages[1]?.name).toBe('Page 2');
    state = redoProjectCommand(state, PROJECT_ID);
    expect(state.workspace.projects[0]?.pages[1]?.name).toBe('待機画面');
  });

  it('空または121文字以上のPage名変更を拒否する', () => {
    expect(() =>
      createRenamePageCommand(
        PROJECT_ID,
        'page-1',
        '   ',
        metadata('rename-page-empty'),
      ),
    ).toThrowError(DomainError);
    expect(() =>
      createRenamePageCommand(
        PROJECT_ID,
        'page-1',
        'a'.repeat(121),
        metadata('rename-page-long'),
      ),
    ).toThrowError(DomainError);
  });

  it('削除対象が編集・配信ページの場合は隣接ページへ切り替える', () => {""",
)
