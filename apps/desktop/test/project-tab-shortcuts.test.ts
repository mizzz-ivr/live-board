import { describe, expect, it } from 'vitest';
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
