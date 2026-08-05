from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding='utf-8')
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: replacement target count is {count}, expected 1')
    file_path.write_text(content.replace(old, new, 1), encoding='utf-8')


shortcut_source = """export type ProjectTabShortcutAction =
  | 'close-active'
  | 'reopen-last'
  | 'rename-active';

export interface ProjectTabShortcutInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  editableTarget: boolean;
}

export function resolveProjectTabShortcut(
  input: ProjectTabShortcutInput,
): ProjectTabShortcutAction | null {
  if (
    input.defaultPrevented ||
    input.repeat ||
    input.isComposing ||
    input.editableTarget ||
    input.altKey
  ) {
    return null;
  }

  if (
    input.key === 'F2' &&
    !input.ctrlKey &&
    !input.metaKey &&
    !input.shiftKey
  ) {
    return 'rename-active';
  }

  const hasSinglePrimaryModifier = input.ctrlKey !== input.metaKey;
  if (!hasSinglePrimaryModifier) return null;

  const key = input.key.toLowerCase();
  if (key === 'w' && !input.shiftKey) return 'close-active';
  if (key === 't' && input.shiftKey) return 'reopen-last';
  return null;
}

export function isEditableProjectTabShortcutTarget(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  ) !== null;
}
"""
Path('apps/desktop/src/project-tab-shortcuts.ts').write_text(
    shortcut_source,
    encoding='utf-8',
)

shortcut_test = """import { describe, expect, it } from 'vitest';
import {
  resolveProjectTabShortcut,
  type ProjectTabShortcutInput,
} from '../src/project-tab-shortcuts';

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

describe('project tab shortcuts', () => {
  it('CtrlまたはCmd+WをCloseとして解決する', () => {
    expect(resolveProjectTabShortcut(shortcut({ key: 'w', ctrlKey: true }))).toBe(
      'close-active',
    );
    expect(resolveProjectTabShortcut(shortcut({ key: 'W', metaKey: true }))).toBe(
      'close-active',
    );
  });

  it('CtrlまたはCmd+Shift+Tを復元として解決する', () => {
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 't', ctrlKey: true, shiftKey: true }),
      ),
    ).toBe('reopen-last');
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'T', metaKey: true, shiftKey: true }),
      ),
    ).toBe('reopen-last');
  });

  it('修飾キーなしのF2を名前変更として解決する', () => {
    expect(resolveProjectTabShortcut(shortcut({ key: 'F2' }))).toBe(
      'rename-active',
    );
  });

  it('入力中・IME変換中・キーリピート・処理済みイベントを無視する', () => {
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'w', ctrlKey: true, editableTarget: true }),
      ),
    ).toBeNull();
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'w', ctrlKey: true, isComposing: true }),
      ),
    ).toBeNull();
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'w', ctrlKey: true, repeat: true }),
      ),
    ).toBeNull();
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'w', ctrlKey: true, defaultPrevented: true }),
      ),
    ).toBeNull();
  });

  it('Alt併用・CtrlとCmd同時・余分なShiftを拒否する', () => {
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'w', ctrlKey: true, altKey: true }),
      ),
    ).toBeNull();
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'w', ctrlKey: true, metaKey: true }),
      ),
    ).toBeNull();
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: 'w', ctrlKey: true, shiftKey: true }),
      ),
    ).toBeNull();
    expect(
      resolveProjectTabShortcut(shortcut({ key: 'F2', ctrlKey: true })),
    ).toBeNull();
  });

  it('未定義キーを無視する', () => {
    expect(
      resolveProjectTabShortcut(shortcut({ key: 'n', ctrlKey: true })),
    ).toBeNull();
  });
});
"""
Path('apps/desktop/test/project-tab-shortcuts.test.ts').write_text(
    shortcut_test,
    encoding='utf-8',
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    """  useMemo,\n  useRef,\n""",
    """  useEffect,\n  useMemo,\n  useRef,\n""",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    """} from './project-tabs-model';\nimport './project-tabs.css';\n""",
    """} from './project-tabs-model';\nimport {\n  isEditableProjectTabShortcutTarget,\n  resolveProjectTabShortcut,\n} from './project-tab-shortcuts';\nimport './project-tabs.css';\n""",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    """  function handleTabKeyDown(\n""",
    """  useEffect(() => {\n    function handleWindowKeyDown(event: globalThis.KeyboardEvent): void {\n      const action = resolveProjectTabShortcut({\n        key: event.key,\n        ctrlKey: event.ctrlKey,\n        metaKey: event.metaKey,\n        shiftKey: event.shiftKey,\n        altKey: event.altKey,\n        repeat: event.repeat,\n        isComposing: event.isComposing,\n        defaultPrevented: event.defaultPrevented,\n        editableTarget: isEditableProjectTabShortcutTarget(event.target),\n      });\n      if (action === null) return;\n\n      event.preventDefault();\n      event.stopPropagation();\n\n      if (action === 'close-active') {\n        const result = closeProjectTab(tabs, activeProjectId, activeProjectId);\n        onTabsChange(result.state);\n        if (result.nextActiveProjectId !== activeProjectId) {\n          onSelect(result.nextActiveProjectId);\n          focusTab(result.nextActiveProjectId);\n        }\n        return;\n      }\n\n      if (action === 'reopen-last') {\n        const result = reopenLastProjectTab(tabs, projectIds);\n        onTabsChange(result.state);\n        if (result.reopenedProjectId !== null) {\n          onSelect(result.reopenedProjectId);\n          focusTab(result.reopenedProjectId);\n        }\n        return;\n      }\n\n      const activeProject = projectsById.get(activeProjectId);\n      if (activeProject !== undefined) rename(activeProject);\n    }\n\n    window.addEventListener('keydown', handleWindowKeyDown, true);\n    return () => window.removeEventListener('keydown', handleWindowKeyDown, true);\n  }, [\n    activeProjectId,\n    onRename,\n    onSelect,\n    onTabsChange,\n    projectIds,\n    projectsById,\n    tabs,\n  ]);\n\n  function handleTabKeyDown(\n""",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    """                aria-label={`${project.name}の名前を変更`}\n                onClick={() => rename(project)}\n""",
    """                aria-label={`${project.name}の名前を変更`}\n                title=\"F2\"\n                onClick={() => rename(project)}\n""",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    """                title={pinned ? 'ピン留めを解除すると閉じられます' : undefined}\n""",
    """                title={\n                  pinned\n                    ? 'ピン留めを解除すると閉じられます（Ctrl/Cmd+W）'\n                    : 'Ctrl/Cmd+W'\n                }\n""",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    """        <button type=\"button\" onClick={reopen} disabled={!canReopen}>\n          閉じたタブを復元\n        </button>\n""",
    """        <button\n          type=\"button\"\n          title=\"Ctrl/Cmd+Shift+T\"\n          onClick={reopen}\n          disabled={!canReopen}\n        >\n          閉じたタブを復元\n        </button>\n""",
)

e2e_path = Path('tests/e2e/project-tabs-desktop.spec.ts')
e2e_content = e2e_path.read_text(encoding='utf-8')
e2e_test = r"""

test('ショートカットでProjectタブを名前変更・Close・復元できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);

  page.once('dialog', async (dialog) => dialog.accept('ショートカットProject'));
  await page.keyboard.press('F2');
  const renamedTab = tablist.getByRole('tab', { name: /ショートカットProject/ });
  await expect(renamedTab).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Control+W');
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '閉じたタブを復元' })).toBeEnabled();

  await page.keyboard.press('Control+Shift+T');
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(renamedTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', {
    name: 'ショートカットProjectのタブをピン留め',
  }).click();
  await page.keyboard.press('Control+W');
  await expect(tablist.getByRole('tab')).toHaveCount(2);

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.dataset.testid = 'project-shortcut-editable';
    document.body.append(input);
  });
  await page.getByTestId('project-shortcut-editable').dispatchEvent('keydown', {
    key: 'w',
    ctrlKey: true,
    bubbles: true,
  });
  await expect(tablist.getByRole('tab')).toHaveCount(2);
});
"""
if "ショートカットでProjectタブを名前変更・Close・復元できる" in e2e_content:
    raise RuntimeError('E2E shortcut test already exists')
e2e_path.write_text(e2e_content.rstrip() + e2e_test + '\n', encoding='utf-8')

print('Project tab shortcuts implementation applied')
