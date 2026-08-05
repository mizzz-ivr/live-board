export type ProjectTabShortcutAction =
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
