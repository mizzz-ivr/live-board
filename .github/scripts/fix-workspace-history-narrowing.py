from pathlib import Path

path = Path('packages/domain/src/history.ts')
content = path.read_text(encoding='utf-8')
content = content.replace(
"""  return state.histories.workspace.future.flatMap((entry) =>
    entry.command.type === 'workspace.project.add'
      ? [cloneProject(entry.projectSnapshot)]
      : [],
  );
""",
"""  return state.histories.workspace.future.flatMap((entry) =>
    isAddProjectWorkspaceHistoryEntry(entry)
      ? [cloneProject(entry.projectSnapshot)]
      : [],
  );
""",
1,
)
content = content.replace(
"if (entry.command.type === 'workspace.project.add') {",
"if (isAddProjectWorkspaceHistoryEntry(entry)) {",
2,
)
anchor = """function removeAddedProject(
"""
guard = """function isAddProjectWorkspaceHistoryEntry(
  entry: WorkspaceHistoryEntry,
): entry is AddProjectWorkspaceHistoryEntry {
  return entry.command.type === 'workspace.project.add';
}

function removeAddedProject(
"""
if anchor not in content:
    raise RuntimeError('guard anchor not found')
content = content.replace(anchor, guard, 1)
path.write_text(content, encoding='utf-8')

Path('.github/workflows/fix-workspace-history-narrowing.yml').unlink(missing_ok=True)
Path('.github/scripts/fix-workspace-history-narrowing.py').unlink(missing_ok=True)
