import { describe, expect, it } from 'vitest';
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
