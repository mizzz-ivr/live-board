from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text(encoding='utf-8')
    if content.count(old) != 1:
        raise RuntimeError(f'{path}: replacement anchor count={content.count(old)}')
    target.write_text(content.replace(old, new, 1), encoding='utf-8')


replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "import {\n  isEditableProjectTabShortcutTarget,\n  resolveProjectTabShortcut,\n} from './project-tab-shortcuts';\nimport './project-tabs.css';",
    "import { ProjectTabShortcutHelpDialog } from './ProjectTabShortcutHelpDialog';\nimport {\n  isEditableProjectTabShortcutTarget,\n  resolveProjectTabShortcut,\n} from './project-tab-shortcuts';\nimport './project-tabs.css';",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "  const [dropTarget, setDropTarget] = useState<ProjectTabDropTarget | null>(null);\n  const openProjects = tabs.openProjectIds.flatMap((projectId) => {",
    "  const [dropTarget, setDropTarget] = useState<ProjectTabDropTarget | null>(null);\n  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);\n  const shortcutHelpButtonRef = useRef<HTMLButtonElement>(null);\n  const shortcutHelpReturnFocusRef = useRef<HTMLElement | null>(null);\n  const openProjects = tabs.openProjectIds.flatMap((projectId) => {",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "  const canReopen =\n    tabs.recentlyClosedTabs.length > 0 || tabs.closedProjectIds.length > 0;\n\n  function selectAndFocus(projectId: string): void {",
    "  const canReopen =\n    tabs.recentlyClosedTabs.length > 0 || tabs.closedProjectIds.length > 0;\n\n  function openShortcutHelp(): void {\n    const activeElement = document.activeElement;\n    shortcutHelpReturnFocusRef.current =\n      activeElement instanceof HTMLElement &&\n      activeElement !== document.body &&\n      activeElement !== document.documentElement\n        ? activeElement\n        : shortcutHelpButtonRef.current;\n    setShortcutHelpOpen(true);\n  }\n\n  function closeShortcutHelp(): void {\n    setShortcutHelpOpen(false);\n    const returnFocus = shortcutHelpReturnFocusRef.current;\n    window.requestAnimationFrame(() => {\n      if (returnFocus?.isConnected) returnFocus.focus();\n      else shortcutHelpButtonRef.current?.focus();\n    });\n  }\n\n  function selectAndFocus(projectId: string): void {",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "      if (action === null) return;\n\n      event.preventDefault();\n      event.stopPropagation();\n\n      if (action === 'close-active') {",
    "      if (action === null) return;\n\n      event.preventDefault();\n      event.stopPropagation();\n\n      if (action === 'show-help') {\n        if (shortcutHelpOpen) closeShortcutHelp();\n        else openShortcutHelp();\n        return;\n      }\n\n      if (shortcutHelpOpen) return;\n\n      if (action === 'close-active') {",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "    projectsById,\n    tabs,\n  ]);",
    "    projectsById,\n    shortcutHelpOpen,\n    tabs,\n  ]);",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "        <button type=\"button\" onClick={onCreate} aria-label=\"プロジェクトを追加\">\n          ＋\n        </button>\n      </div>\n    </div>",
    "        <button\n          ref={shortcutHelpButtonRef}\n          type=\"button\"\n          aria-label=\"キーボードショートカットを表示\"\n          title=\"?\"\n          onClick={openShortcutHelp}\n        >\n          ?\n        </button>\n        <button type=\"button\" onClick={onCreate} aria-label=\"プロジェクトを追加\">\n          ＋\n        </button>\n      </div>\n      <ProjectTabShortcutHelpDialog\n        open={shortcutHelpOpen}\n        onRequestClose={closeShortcutHelp}\n      />\n    </div>",
)

(ROOT / 'apps/desktop/src/project-tab-shortcuts.ts').write_text("""export type ProjectTabShortcutAction =
  | 'close-active'
  | 'reopen-last'
  | 'rename-active'
  | 'show-help';

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

export interface ProjectTabShortcutDisplayItem {
  readonly id: string;
  readonly label: string;
  readonly keys: readonly string[];
  readonly description: string;
}

export interface ProjectTabShortcutGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly ProjectTabShortcutDisplayItem[];
}

type PrimaryModifierRequirement = 'none' | 'single';
type ShiftRequirement = 'forbidden' | 'required' | 'either';

interface GlobalProjectTabShortcutBinding
  extends ProjectTabShortcutDisplayItem {
  readonly action: ProjectTabShortcutAction;
  readonly eventKeys: readonly string[];
  readonly primaryModifier: PrimaryModifierRequirement;
  readonly shift: ShiftRequirement;
}

const GLOBAL_PROJECT_TAB_SHORTCUTS: readonly GlobalProjectTabShortcutBinding[] = [
  {
    id: 'rename-active',
    action: 'rename-active',
    label: 'アクティブProject名を変更',
    keys: ['F2'],
    description: '現在選択しているProjectの名前変更ダイアログを開きます。',
    eventKeys: ['F2'],
    primaryModifier: 'none',
    shift: 'forbidden',
  },
  {
    id: 'close-active',
    action: 'close-active',
    label: 'アクティブタブを閉じる',
    keys: ['Ctrl/Cmd', 'W'],
    description: 'ピン留めされていないアクティブタブを閉じます。',
    eventKeys: ['w'],
    primaryModifier: 'single',
    shift: 'forbidden',
  },
  {
    id: 'reopen-last',
    action: 'reopen-last',
    label: '閉じたタブを復元',
    keys: ['Ctrl/Cmd', 'Shift', 'T'],
    description: '直近または保存済みの閉じたProjectタブを復元します。',
    eventKeys: ['t'],
    primaryModifier: 'single',
    shift: 'required',
  },
  {
    id: 'show-help',
    action: 'show-help',
    label: 'ショートカット一覧を表示',
    keys: ['?'],
    description: 'このキーボードショートカット一覧を開閉します。',
    eventKeys: ['?'],
    primaryModifier: 'none',
    shift: 'either',
  },
];

export const PROJECT_TAB_SHORTCUT_GROUPS: readonly ProjectTabShortcutGroup[] = [
  {
    id: 'project-tab-actions',
    title: 'Projectタブ操作',
    items: GLOBAL_PROJECT_TAB_SHORTCUTS.map(
      ({ id, label, keys, description }) => ({ id, label, keys, description }),
    ),
  },
  {
    id: 'project-tab-navigation',
    title: 'タブ移動・並び替え',
    items: [
      {
        id: 'navigate-previous-next',
        label: '前後のタブへ移動',
        keys: ['← / →'],
        description: '現在の表示順で前後のProjectタブを選択します。',
      },
      {
        id: 'navigate-first-last',
        label: '先頭・末尾のタブへ移動',
        keys: ['Home / End'],
        description: '現在の表示順の先頭または末尾を選択します。',
      },
      {
        id: 'reorder-tab',
        label: 'タブを左右へ並び替え',
        keys: ['Ctrl/Cmd', 'Shift', '← / →'],
        description: '同じピン留め領域内で選択中のタブを移動します。',
      },
    ],
  },
];

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

  const binding = GLOBAL_PROJECT_TAB_SHORTCUTS.find((candidate) =>
    matchesShortcutBinding(input, candidate),
  );
  return binding?.action ?? null;
}

export function isEditableProjectTabShortcutTarget(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  ) !== null;
}

function matchesShortcutBinding(
  input: ProjectTabShortcutInput,
  binding: GlobalProjectTabShortcutBinding,
): boolean {
  const normalizedKey = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  if (!binding.eventKeys.includes(normalizedKey)) return false;

  const hasSinglePrimaryModifier = input.ctrlKey !== input.metaKey;
  if (
    binding.primaryModifier === 'none'
      ? input.ctrlKey || input.metaKey
      : !hasSinglePrimaryModifier
  ) {
    return false;
  }

  if (binding.shift === 'required' && !input.shiftKey) return false;
  if (binding.shift === 'forbidden' && input.shiftKey) return false;
  return true;
}
""", encoding='utf-8')

(ROOT / 'apps/desktop/src/ProjectTabShortcutHelpDialog.tsx').write_text("""import { useEffect, useRef, type MouseEvent } from 'react';
import { PROJECT_TAB_SHORTCUT_GROUPS } from './project-tab-shortcuts';
import './project-tab-shortcut-help.css';

export interface ProjectTabShortcutHelpDialogProps {
  open: boolean;
  onRequestClose(): void;
}

export function ProjectTabShortcutHelpDialog({
  open,
  onRequestClose,
}: ProjectTabShortcutHelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) onRequestClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="project-tab-shortcut-dialog"
      aria-labelledby="project-tab-shortcut-dialog-title"
      aria-describedby="project-tab-shortcut-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="project-tab-shortcut-dialog-panel">
        <header className="project-tab-shortcut-dialog-header">
          <div>
            <p className="project-tab-shortcut-dialog-eyebrow">Keyboard help</p>
            <h2 id="project-tab-shortcut-dialog-title">
              キーボードショートカット
            </h2>
            <p id="project-tab-shortcut-dialog-description">
              Projectタブで利用できる主要なキーボード操作です。
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="project-tab-shortcut-dialog-close"
            aria-label="キーボードショートカット一覧を閉じる"
            onClick={onRequestClose}
          >
            閉じる
          </button>
        </header>

        <div className="project-tab-shortcut-groups">
          {PROJECT_TAB_SHORTCUT_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`${group.id}-title`}>
              <h3 id={`${group.id}-title`}>{group.title}</h3>
              <dl className="project-tab-shortcut-list">
                {group.items.map((item) => (
                  <div className="project-tab-shortcut-row" key={item.id}>
                    <div>
                      <dt>{item.label}</dt>
                      <dd>{item.description}</dd>
                    </div>
                    <div
                      className="project-tab-shortcut-keys"
                      aria-label={item.keys.join(' + ')}
                    >
                      {item.keys.map((key, index) => (
                        <span key={`${item.id}-${key}`}>
                          {index > 0 ? (
                            <span className="project-tab-shortcut-plus" aria-hidden="true">
                              +
                            </span>
                          ) : null}
                          <kbd>{key}</kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <p className="project-tab-shortcut-dialog-note">
          入力欄やIME変換中はProjectタブのショートカットを実行しません。
        </p>
      </div>
    </dialog>
  );
}
""", encoding='utf-8')

(ROOT / 'apps/desktop/src/project-tab-shortcut-help.css').write_text(""".project-tab-shortcut-dialog {
  width: min(760px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 32px));
  overflow: auto;
  border: 1px solid #64748b;
  border-radius: 16px;
  background: #111827;
  padding: 0;
  color: #f8fafc;
  box-shadow: 0 24px 80px rgb(0 0 0 / 55%);
}

.project-tab-shortcut-dialog::backdrop {
  background: rgb(2 6 23 / 78%);
  backdrop-filter: blur(3px);
}

.project-tab-shortcut-dialog-panel {
  padding: 24px;
}

.project-tab-shortcut-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid #334155;
  padding-bottom: 18px;
}

.project-tab-shortcut-dialog-header h2 {
  margin: 4px 0 6px;
  font-size: 24px;
}

.project-tab-shortcut-dialog-header p {
  margin: 0;
  color: #cbd5e1;
}

.project-tab-shortcut-dialog-eyebrow {
  color: #93c5fd !important;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.project-tab-shortcut-dialog-close {
  flex: 0 0 auto;
  border: 1px solid #64748b;
  border-radius: 8px;
  background: #273449;
  padding: 8px 14px;
  color: #f8fafc;
  cursor: pointer;
}

.project-tab-shortcut-dialog-close:hover,
.project-tab-shortcut-dialog-close:focus-visible {
  border-color: #93c5fd;
  background: #334155;
}

.project-tab-shortcut-groups {
  display: grid;
  gap: 22px;
  padding-top: 20px;
}

.project-tab-shortcut-groups h3 {
  margin: 0 0 10px;
  color: #bfdbfe;
  font-size: 14px;
}

.project-tab-shortcut-list {
  display: grid;
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid #334155;
  border-radius: 10px;
  background: #334155;
}

.project-tab-shortcut-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  background: #182234;
  padding: 13px 15px;
}

.project-tab-shortcut-row dt {
  font-weight: 700;
}

.project-tab-shortcut-row dd {
  margin: 4px 0 0;
  color: #94a3b8;
  font-size: 12px;
}

.project-tab-shortcut-keys {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.project-tab-shortcut-keys > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.project-tab-shortcut-plus {
  color: #64748b;
  font-size: 11px;
}

.project-tab-shortcut-keys kbd {
  min-width: 30px;
  border: 1px solid #64748b;
  border-bottom-width: 3px;
  border-radius: 6px;
  background: #0f172a;
  padding: 5px 8px;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 11px;
  text-align: center;
}

.project-tab-shortcut-dialog-note {
  margin: 18px 0 0;
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 640px) {
  .project-tab-shortcut-dialog-panel {
    padding: 18px;
  }

  .project-tab-shortcut-dialog-header {
    gap: 12px;
  }

  .project-tab-shortcut-dialog-header h2 {
    font-size: 20px;
  }

  .project-tab-shortcut-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .project-tab-shortcut-keys {
    flex-wrap: wrap;
  }
}
""", encoding='utf-8')

(ROOT / 'apps/desktop/test/project-tab-shortcut-help.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  PROJECT_TAB_SHORTCUT_GROUPS,
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

describe('project tab shortcut help', () => {
  it('?をショートカット一覧表示として解決する', () => {
    expect(
      resolveProjectTabShortcut(shortcut({ key: '?', shiftKey: true })),
    ).toBe('show-help');
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: '?', shiftKey: true, editableTarget: true }),
      ),
    ).toBeNull();
    expect(
      resolveProjectTabShortcut(
        shortcut({ key: '?', shiftKey: true, repeat: true }),
      ),
    ).toBeNull();
  });

  it('一覧定義のIDが重複せず、主要操作とナビゲーションを含む', () => {
    const items = PROJECT_TAB_SHORTCUT_GROUPS.flatMap((group) => group.items);
    const ids = items.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'rename-active',
        'close-active',
        'reopen-last',
        'show-help',
        'navigate-previous-next',
        'navigate-first-last',
        'reorder-tab',
      ]),
    );
    expect(items.find((item) => item.id === 'show-help')?.keys).toEqual(['?']);
  });
});
""", encoding='utf-8')

(ROOT / 'tests/e2e/project-tab-shortcut-help.spec.ts').write_text("""import { expect, test } from '@playwright/test';

test('ショートカット一覧をボタンと?キーから開閉し、フォーカスを管理できる', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  const helpButton = page.getByRole('button', {
    name: 'キーボードショートカットを表示',
  });
  const dialog = page.getByRole('dialog', { name: 'キーボードショートカット' });
  const closeButton = page.getByRole('button', {
    name: 'キーボードショートカット一覧を閉じる',
  });

  await helpButton.click();
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(dialog.getByText('アクティブタブを閉じる')).toBeVisible();
  await expect(dialog.getByText('タブを左右へ並び替え')).toBeVisible();

  await page.keyboard.press('Control+W');
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(dialog).toBeVisible();

  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('Tab');
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest('dialog') !== null),
      )
      .toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(helpButton).toBeFocused();

  await page.keyboard.press('Shift+/');
  await expect(dialog).toBeVisible();

  await dialog.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(dialog).not.toBeVisible();

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.dataset.testid = 'shortcut-help-editable';
    document.body.append(input);
  });
  const input = page.getByTestId('shortcut-help-editable');
  await input.focus();
  await page.keyboard.press('Shift+/');
  await expect(dialog).not.toBeVisible();
});
""", encoding='utf-8')
