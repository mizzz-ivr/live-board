from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'expected text not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    'packages/domain/src/commands.ts',
    "  clonePage,\n  type Page,",
    "  clonePage,\n  createPage,\n  type Page,",
)
replace_once(
    'packages/domain/src/commands.ts',
    """  const currentPage = project.pages[pageIndex]!;
  if (currentPage.name === name) return project;

  const pages = [...project.pages];
  pages[pageIndex] = { ...currentPage, name, updatedAt };
  return { ...project, pages, updatedAt };""",
    """  const currentPage = project.pages[pageIndex]!;
  const normalizedName = name.trim();
  if (currentPage.name === normalizedName) return project;

  const renamedPage = createPage({
    ...currentPage,
    name: normalizedName,
    updatedAt,
  });
  const pages = [...project.pages];
  pages[pageIndex] = renamedPage;
  return { ...project, pages, updatedAt };""",
)

replace_once(
    'packages/domain/test/workspace.test.ts',
    "  DomainError,\n  canRedoProject,",
    "  DomainError,\n  applyProjectCommand,\n  canRedoProject,",
)
marker = "  it('削除対象が編集・配信ページの場合は隣接ページへ切り替える', () => {"
path = Path('packages/domain/test/workspace.test.ts')
text = path.read_text(encoding='utf-8')
if marker not in text:
    raise RuntimeError('domain test insertion marker not found')
test = """  it('直接組み立てたPage名変更Commandでも不正名を拒否する', () => {
    const state = createStateWithPages(['page-1']);

    expect(() =>
      applyProjectCommand(state.workspace, {
        commandId: 'raw-rename-invalid',
        type: 'page.rename',
        scope: 'project',
        targetId: PROJECT_ID,
        payload: { pageId: 'page-1', name: '   ' },
        createdAt: '2026-07-22T00:00:00.000Z',
      }),
    ).toThrowError(DomainError);
  });

"""
path.write_text(text.replace(marker, test + marker, 1), encoding='utf-8')
