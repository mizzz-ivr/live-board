from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:100]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


path = 'apps/desktop/src/user-page-templates.ts'
replace_once(
    path,
    """  let raw: string | null;
  try {
    raw = storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY);
    if (raw === null) raw = storage.getItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY);
  } catch (error: unknown) {
""",
    """  let raw: string | null;
  let loadedFromLegacy = false;
  try {
    raw = storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY);
    if (raw === null) {
      raw = storage.getItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY);
      loadedFromLegacy = raw !== null;
    }
  } catch (error: unknown) {
""",
)
replace_once(path, "    recoverBrokenStore(storage);\n", "    recoverBrokenStore(storage, loadedFromLegacy);\n")
replace_once(path, "    recoverBrokenStore(storage);\n", "    recoverBrokenStore(storage, loadedFromLegacy);\n")
replace_once(
    path,
    """function recoverBrokenStore(storage: UserPageTemplateStorage): void {
  try {
    storage.removeItem(USER_PAGE_TEMPLATE_STORAGE_KEY);
  } catch {
    // 読み込み側は空状態へ復旧できるため、削除失敗は追加例外にしない。
  }
}
""",
    """function recoverBrokenStore(
  storage: UserPageTemplateStorage,
  preserveLegacy: boolean,
): void {
  try {
    storage.setItem(
      USER_PAGE_TEMPLATE_STORAGE_KEY,
      serializeStore([], null),
    );
    return;
  } catch {
    // v1からの復旧ではダウングレード用原本を残す。
  }

  if (preserveLegacy) return;
  try {
    storage.removeItem(USER_PAGE_TEMPLATE_STORAGE_KEY);
  } catch {
    // 呼び出し側は空状態を返すため、追加例外にはしない。
  }
}
""",
)

path = 'apps/desktop/test/user-page-templates.test.ts'
replace_once(
    path,
    """    expect(loaded.templates).toEqual([]);
    expect(loaded.warnings[0]).toContain('空状態へ復旧');
    expect(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY)).toBeNull();
  });
""",
    """    expect(loaded.templates).toEqual([]);
    expect(loaded.warnings[0]).toContain('空状態へ復旧');
    expect(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY)).not.toBeNull();

    const reloaded = loadUserPageTemplates(storage);
    expect(reloaded.templates).toEqual([]);
    expect(reloaded.warnings).toEqual([]);
  });
""",
)

path = 'apps/desktop/test/user-page-template-assets.test.ts'
text = Path(path).read_text(encoding='utf-8')
marker = """  it('旧v1ストアをAssetなしv2テンプレートとしてコピー移行し、旧データを保持する', () => {
"""
addition = """  it('壊れた旧v1ストアは原本を保持し、v2の安全な空状態へ復旧する', () => {
    const storage = new MemoryStorage();
    const legacyRaw = '{broken-legacy-json';
    storage.setItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY, legacyRaw);

    const recovered = loadUserPageTemplates(storage);
    expect(recovered.templates).toEqual([]);
    expect(recovered.warnings[0]).toContain('空状態へ復旧');
    expect(storage.getItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY)).toBe(legacyRaw);
    expect(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY)).not.toBeNull();

    const reloaded = loadUserPageTemplates(storage);
    expect(reloaded.templates).toEqual([]);
    expect(reloaded.warnings).toEqual([]);
  });

"""
if marker not in text:
    raise SystemExit('legacy migration test marker not found')
Path(path).write_text(text.replace(marker, addition + marker, 1), encoding='utf-8')
