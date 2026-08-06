export type ProjectTabShortcutAction =
  | 'close-active'
  | 'reopen-last'
  | 'rename-active'
  | 'show-command-palette'
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
    id: 'show-command-palette',
    action: 'show-command-palette',
    label: 'コマンドパレットを表示',
    keys: ['Ctrl/Cmd', 'K'],
    description: 'Project切り替えや主要操作を検索実行します。',
    eventKeys: ['k'],
    primaryModifier: 'single',
    shift: 'forbidden',
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
