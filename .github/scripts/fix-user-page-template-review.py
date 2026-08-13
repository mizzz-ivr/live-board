from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, got {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


model = "apps/desktop/src/user-page-templates.ts"
replace_once(
    model,
    """  | 'DUPLICATE_LAYER_ID'
  | 'STORAGE_UNAVAILABLE';""",
    """  | 'DUPLICATE_LAYER_ID'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'STORAGE_UNAVAILABLE';""",
)
replace_once(
    model,
    """export interface UserPageTemplateLoadResult {
  readonly templates: UserPageTemplate[];
  readonly warnings: string[];
}""",
    """export interface UserPageTemplateLoadResult {
  readonly templates: UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
  readonly warnings: string[];
}""",
)
replace_once(
    model,
    """interface UserPageTemplateStoreDocument {
  readonly schemaVersion: typeof USER_PAGE_TEMPLATE_SCHEMA_VERSION;
  readonly templates: readonly UserPageTemplate[];
}""",
    """interface UserPageTemplateStoreDocument {
  readonly schemaVersion: typeof USER_PAGE_TEMPLATE_SCHEMA_VERSION;
  readonly templates: readonly UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
}""",
)
replace_once(
    model,
    """  if (raw === null) return { templates: [], warnings: [] };""",
    """  if (raw === null) {
    return { templates: [], lastDeletedTemplate: null, warnings: [] };
  }""",
)
replace_once(
    model,
    """    return {
      templates: [],
      warnings: ['マイテンプレート保存データが壊れていたため、安全な空状態へ復旧しました。'],
    };
  }

  if (
    !isRecord(parsed)
    || parsed.schemaVersion !== USER_PAGE_TEMPLATE_SCHEMA_VERSION
    || !Array.isArray(parsed.templates)
  ) {
    recoverBrokenStore(storage);
    return {
      templates: [],
      warnings: ['未対応または不正なマイテンプレート保存データを検出し、空状態へ復旧しました。'],
    };
  }""",
    """    return {
      templates: [],
      lastDeletedTemplate: null,
      warnings: ['マイテンプレート保存データが壊れていたため、安全な空状態へ復旧しました。'],
    };
  }

  if (
    isRecord(parsed)
    && typeof parsed.schemaVersion === 'number'
    && parsed.schemaVersion !== USER_PAGE_TEMPLATE_SCHEMA_VERSION
  ) {
    throw new UserPageTemplateError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `このアプリではschema version ${parsed.schemaVersion}のマイテンプレートを読み込めません。データは変更せず保持しています。`,
    );
  }

  if (
    !isRecord(parsed)
    || parsed.schemaVersion !== USER_PAGE_TEMPLATE_SCHEMA_VERSION
    || !Array.isArray(parsed.templates)
  ) {
    recoverBrokenStore(storage);
    return {
      templates: [],
      lastDeletedTemplate: null,
      warnings: ['不正なマイテンプレート保存データを検出し、空状態へ復旧しました。'],
    };
  }""",
)
replace_once(
    model,
    """  if (warnings.length > 0 || templates.length !== parsed.templates.length) {
    try {
      persistTemplates(storage, templates);
    } catch {
      warnings.push('復旧後のマイテンプレート保存データを書き戻せませんでした。');
    }
  }

  return { templates: templates.map(cloneTemplate), warnings };
}""",
    """  let lastDeletedTemplate: UserPageTemplate | null = null;
  if (parsed.lastDeletedTemplate !== undefined && parsed.lastDeletedTemplate !== null) {
    try {
      const candidate = validateStoredTemplate(parsed.lastDeletedTemplate);
      const normalizedName = comparableTemplateName(candidate.name);
      const duplicatesActive =
        ids.has(candidate.id) || names.has(normalizedName);
      const fitsStore =
        utf8ByteLength(serializeStore(templates, candidate))
        <= USER_PAGE_TEMPLATE_TOTAL_BYTES;
      if (duplicatesActive || !fitsStore) {
        warnings.push('復元候補として保持できない削除済みテンプレートを除外しました。');
      } else {
        lastDeletedTemplate = candidate;
      }
    } catch {
      warnings.push('読み込めない削除済みテンプレートを除外しました。');
    }
  }

  if (
    warnings.length > 0
    || templates.length !== parsed.templates.length
    || (parsed.lastDeletedTemplate ?? null) !== null && lastDeletedTemplate === null
  ) {
    try {
      persistTemplates(storage, templates, lastDeletedTemplate);
    } catch {
      warnings.push('復旧後のマイテンプレート保存データを書き戻せませんでした。');
    }
  }

  return {
    templates: templates.map(cloneTemplate),
    lastDeletedTemplate:
      lastDeletedTemplate === null ? null : cloneTemplate(lastDeletedTemplate),
    warnings,
  };
}""",
)
replace_once(
    model,
    """  const next = [validated, ...current.templates];
  persistTemplates(storage, next);
  return {
    templates: next.map(cloneTemplate),
    warnings: current.warnings,
  };""",
    """  const next = [validated, ...current.templates];
  persistTemplates(storage, next, current.lastDeletedTemplate);
  return {
    templates: next.map(cloneTemplate),
    lastDeletedTemplate:
      current.lastDeletedTemplate === null
        ? null
        : cloneTemplate(current.lastDeletedTemplate),
    warnings: current.warnings,
  };""",
)
replace_once(
    model,
    """export function deleteUserPageTemplate(
  storage: UserPageTemplateStorage,
  templateId: string,
): UserPageTemplateLoadResult {
  const current = loadUserPageTemplates(storage);
  const next = current.templates.filter((template) => template.id !== templateId);
  if (next.length !== current.templates.length) persistTemplates(storage, next);
  return {
    templates: next.map(cloneTemplate),
    warnings: current.warnings,
  };
}""",
    """export function deleteUserPageTemplate(
  storage: UserPageTemplateStorage,
  templateId: string,
): UserPageTemplateLoadResult {
  const current = loadUserPageTemplates(storage);
  const deleted = current.templates.find((template) => template.id === templateId) ?? null;
  const next = current.templates.filter((template) => template.id !== templateId);
  const lastDeletedTemplate = deleted ?? current.lastDeletedTemplate;
  if (deleted !== null) persistTemplates(storage, next, deleted);
  return {
    templates: next.map(cloneTemplate),
    lastDeletedTemplate:
      lastDeletedTemplate === null ? null : cloneTemplate(lastDeletedTemplate),
    warnings: current.warnings,
  };
}

export function restoreLastDeletedUserPageTemplate(
  storage: UserPageTemplateStorage,
): UserPageTemplateLoadResult {
  const current = loadUserPageTemplates(storage);
  const deleted = current.lastDeletedTemplate;
  if (deleted === null) return current;

  if (current.templates.length >= USER_PAGE_TEMPLATE_LIMIT) {
    throw new UserPageTemplateError(
      'TEMPLATE_LIMIT_REACHED',
      `マイテンプレートは最大${USER_PAGE_TEMPLATE_LIMIT}件まで保存できます。`,
    );
  }

  const normalizedName = comparableTemplateName(deleted.name);
  if (
    current.templates.some(
      (candidate) =>
        candidate.id === deleted.id
        || comparableTemplateName(candidate.name) === normalizedName,
    )
  ) {
    throw new UserPageTemplateError(
      'DUPLICATE_TEMPLATE_NAME',
      `「${deleted.name}」と競合するマイテンプレートが存在するため復元できません。`,
    );
  }

  const next = [deleted, ...current.templates];
  persistTemplates(storage, next, null);
  return {
    templates: next.map(cloneTemplate),
    lastDeletedTemplate: null,
    warnings: current.warnings,
  };
}""",
)
replace_once(
    model,
    """        sourceLayerIds: layer.content.sourceLayerIds.map((id) =>
          mapRequiredLayerId(idMap, id, 'sourceLayerIds'),
        ),""",
    """        sourceLayerIds: layer.content.sourceLayerIds.flatMap((id) => {
          const mapped = idMap.get(id);
          return mapped === undefined ? [] : [mapped];
        }),""",
)
replace_once(
    model,
    """function persistTemplates(
  storage: UserPageTemplateStorage,
  templates: readonly UserPageTemplate[],
): void {""",
    """function persistTemplates(
  storage: UserPageTemplateStorage,
  templates: readonly UserPageTemplate[],
  lastDeletedTemplate: UserPageTemplate | null,
): void {""",
)
replace_once(
    model,
    """  const serialized = serializeStore(templates);""",
    """  const serialized = serializeStore(templates, lastDeletedTemplate);""",
)
replace_once(
    model,
    """function serializeStore(templates: readonly UserPageTemplate[]): string {
  const document: UserPageTemplateStoreDocument = {
    schemaVersion: USER_PAGE_TEMPLATE_SCHEMA_VERSION,
    templates,
  };""",
    """function serializeStore(
  templates: readonly UserPageTemplate[],
  lastDeletedTemplate: UserPageTemplate | null,
): string {
  const document: UserPageTemplateStoreDocument = {
    schemaVersion: USER_PAGE_TEMPLATE_SCHEMA_VERSION,
    templates,
    lastDeletedTemplate,
  };""",
)
# Existing load-loop size check must use null trash while collecting active entries.
replace_once(
    model,
    """      if (utf8ByteLength(serializeStore(next)) > USER_PAGE_TEMPLATE_TOTAL_BYTES) {""",
    """      if (utf8ByteLength(serializeStore(next, null)) > USER_PAGE_TEMPLATE_TOTAL_BYTES) {""",
)
# Broken-store recovery persistence uses null last deleted in any remaining call.
text = Path(model).read_text(encoding="utf-8")
text = text.replace("persistTemplates(storage, templates);", "persistTemplates(storage, templates, null);")
Path(model).write_text(text, encoding="utf-8")

hook = "apps/desktop/src/useUserPageTemplates.ts"
replace_once(
    hook,
    """  deleteUserPageTemplate,
  loadUserPageTemplates,
  saveUserPageTemplate,""",
    """  deleteUserPageTemplate,
  loadUserPageTemplates,
  restoreLastDeletedUserPageTemplate,
  saveUserPageTemplate,""",
)
replace_once(
    hook,
    """  readonly message: string | null;
  savePage(page: Page, name: string): boolean;
  removeTemplate(templateId: string): boolean;""",
    """  readonly message: string | null;
  readonly canRestoreDeleted: boolean;
  savePage(page: Page, name: string): boolean;
  removeTemplate(templateId: string): boolean;
  restoreDeletedTemplate(): boolean;""",
)
replace_once(
    hook,
    """  readonly templates: UserPageTemplate[];
  readonly message: string | null;""",
    """  readonly templates: UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
  readonly message: string | null;""",
)
replace_once(
    hook,
    """        templates: result.templates,
        message: result.warnings.length > 0""",
    """        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0""",
)
replace_once(
    hook,
    """        templates: result.templates,
        message: result.warnings.length > 0
          ? `マイテンプレートを削除しました。${result.warnings.join(' ')}`""",
    """        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0
          ? `マイテンプレートを削除しました。${result.warnings.join(' ')}`""",
)
replace_once(
    hook,
    """  return {
    enabled: state.enabled,
    templates: state.templates,
    message: state.message,
    savePage,
    removeTemplate,
  };""",
    """  const restoreDeletedTemplate = useCallback((): boolean => {
    try {
      const result = restoreLastDeletedUserPageTemplate(browserStorage());
      setState({
        enabled: true,
        templates: result.templates,
        lastDeletedTemplate: result.lastDeletedTemplate,
        message: result.warnings.length > 0
          ? `削除したマイテンプレートを復元しました。${result.warnings.join(' ')}`
          : '削除したマイテンプレートを復元しました。',
      });
      return true;
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        message: errorMessage(error, 'マイテンプレートの復元に失敗しました。'),
      }));
      return false;
    }
  }, []);

  return {
    enabled: state.enabled,
    templates: state.templates,
    message: state.message,
    canRestoreDeleted: state.lastDeletedTemplate !== null,
    savePage,
    removeTemplate,
    restoreDeletedTemplate,
  };""",
)
replace_once(
    hook,
    """      templates: result.templates,
      message: result.warnings.length === 0 ? null : result.warnings.join(' '),""",
    """      templates: result.templates,
      lastDeletedTemplate: result.lastDeletedTemplate,
      message: result.warnings.length === 0 ? null : result.warnings.join(' '),""",
)
replace_once(
    hook,
    """      enabled: false,
      templates: [],
      message:""",
    """      enabled: false,
      templates: [],
      lastDeletedTemplate: null,
      message:""",
)

dialog = "apps/desktop/src/PageTemplateDialog.tsx"
replace_once(
    dialog,
    """  userTemplates: readonly UserPageTemplate[];
  userTemplateMessage: string | null;
  onRequestClose(): void;""",
    """  userTemplates: readonly UserPageTemplate[];
  userTemplateMessage: string | null;
  canRestoreDeleted: boolean;
  onRequestClose(): void;""",
)
replace_once(
    dialog,
    """  onSaveCurrentPage(name: string): void;
  onDeleteUserTemplate(templateId: string): void;""",
    """  onSaveCurrentPage(name: string): void;
  onDeleteUserTemplate(templateId: string): void;
  onRestoreDeletedTemplate(): void;""",
)
replace_once(
    dialog,
    """  userTemplates,
  userTemplateMessage,
  onRequestClose,""",
    """  userTemplates,
  userTemplateMessage,
  canRestoreDeleted,
  onRequestClose,""",
)
replace_once(
    dialog,
    """  onSaveCurrentPage,
  onDeleteUserTemplate,
}: PageTemplateDialogProps) {""",
    """  onSaveCurrentPage,
  onDeleteUserTemplate,
  onRestoreDeletedTemplate,
}: PageTemplateDialogProps) {""",
)
replace_once(
    dialog,
    """          <div className=\"page-template-section-heading\">
            <div>
              <h3 id=\"user-template-heading\">マイテンプレート</h3>
              <p>自分で保存したPageを、別Projectや別Workspaceでも再利用できます。</p>
            </div>
          </div>""",
    """          <div className=\"page-template-section-heading\">
            <div>
              <h3 id=\"user-template-heading\">マイテンプレート</h3>
              <p>自分で保存したPageを、別Projectや別Workspaceでも再利用できます。</p>
            </div>
            <button
              type=\"button\"
              disabled={!canRestoreDeleted}
              onClick={onRestoreDeletedTemplate}
            >
              削除を元に戻す
            </button>
          </div>""",
)
replace_once(
    dialog,
    """                          `マイテンプレート「${template.name}」を削除します。\\nこの操作はPage操作のUndo対象ではありません。`,""",
    """                          `マイテンプレート「${template.name}」を削除します。\\n削除後は「削除を元に戻す」から直前の1件を復元できます。`,""",
)

app = "apps/desktop/src/AppV2.tsx"
replace_once(
    app,
    """  function deleteUserPageTemplate(templateId: string): void {
    if (userPageTemplates.removeTemplate(templateId)) setDomainError(null);
  }

  function selectProject""",
    """  function deleteUserPageTemplate(templateId: string): void {
    if (userPageTemplates.removeTemplate(templateId)) setDomainError(null);
  }

  function restoreDeletedUserPageTemplate(): void {
    if (userPageTemplates.restoreDeletedTemplate()) setDomainError(null);
  }

  function selectProject""",
)
replace_once(
    app,
    """        userTemplates={userPageTemplates.templates}
        userTemplateMessage={userPageTemplates.message}
        onRequestClose={closePageTemplateDialog}""",
    """        userTemplates={userPageTemplates.templates}
        userTemplateMessage={userPageTemplates.message}
        canRestoreDeleted={userPageTemplates.canRestoreDeleted}
        onRequestClose={closePageTemplateDialog}""",
)
replace_once(
    app,
    """        onSaveCurrentPage={saveEditPageAsUserTemplate}
        onDeleteUserTemplate={deleteUserPageTemplate}
      />""",
    """        onSaveCurrentPage={saveEditPageAsUserTemplate}
        onDeleteUserTemplate={deleteUserPageTemplate}
        onRestoreDeletedTemplate={restoreDeletedUserPageTemplate}
      />""",
)

test = "apps/desktop/test/user-page-templates.test.ts"
replace_once(
    test,
    """  loadUserPageTemplates,
  saveUserPageTemplate,""",
    """  loadUserPageTemplates,
  restoreLastDeletedUserPageTemplate,
  saveUserPageTemplate,""",
)
replace_once(
    test,
    """      sourceLayerIds: [text.id],""",
    """      sourceLayerIds: [text.id, 'deleted-history-layer'],""",
)
replace_once(
    test,
    """    const deleted = deleteUserPageTemplate(storage, template.id);
    expect(deleted.templates).toEqual([]);
    expect(loadUserPageTemplates(storage).templates).toEqual([]);""",
    """    const deleted = deleteUserPageTemplate(storage, template.id);
    expect(deleted.templates).toEqual([]);
    expect(deleted.lastDeletedTemplate?.name).toBe('マイ待機');
    expect(loadUserPageTemplates(storage).templates).toEqual([]);
    expect(loadUserPageTemplates(storage).lastDeletedTemplate?.name).toBe('マイ待機');

    const restored = restoreLastDeletedUserPageTemplate(storage);
    expect(restored.templates.map((item) => item.name)).toEqual(['マイ待機']);
    expect(restored.lastDeletedTemplate).toBeNull();""",
)
replace_once(
    test,
    """  it('壊れたストア全体は空状態へ復旧する', () => {""",
    """  it('未対応schemaは原本を削除せず読み込みを停止する', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 2, templates: [{ future: true }] });
    storage.setItem(USER_PAGE_TEMPLATE_STORAGE_KEY, raw);

    expect(() => loadUserPageTemplates(storage)).toThrowError(
      /データは変更せず保持しています/,
    );
    expect(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY)).toBe(raw);
  });

  it('壊れたストア全体は空状態へ復旧する', () => {""",
)

# Existing raw test fixture can omit lastDeletedTemplate because load treats it as optional.

e2e = "tests/e2e/page-template-gallery.spec.ts"
replace_once(
    e2e,
    """  await expect(dialog.getByText('まだマイテンプレートはありません。')).toBeVisible();
});""",
    """  await expect(dialog.getByText('まだマイテンプレートはありません。')).toBeVisible();
  const restoreButton = dialog.getByRole('button', { name: '削除を元に戻す' });
  await expect(restoreButton).toBeEnabled();

  await page.reload();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('button', { name: '削除を元に戻す' }).click();
  await expect(
    dialog.getByRole('button', {
      name: '待機カスタムマイテンプレートでPageを作成',
    }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: '削除を元に戻す' })).toBeDisabled();
});""",
)

docs = "docs/user-page-templates.md"
replace_once(
    docs,
    """- schema versionが不正な場合は空状態へ復旧""",
    """- schema versionが将来版の場合は原本を変更せず機能を停止
- schema version自体が欠損・不正な場合は空状態へ復旧""",
)
replace_once(
    docs,
    """- 保存済みテンプレート削除
- 保存件数確認""",
    """- 保存済みテンプレート削除
- 直前に削除した1件を永続ストアから復元
- 保存件数確認""",
)
replace_once(
    docs,
    """削除はPage操作履歴とは別のローカル設定変更なので、確認ダイアログを表示し、Page Undoの対象外であることを明記します。""",
    """削除はPage操作履歴とは別のローカル設定変更なので確認ダイアログを表示します。直前に削除した1件はストア内に復元候補として保持し、「削除を元に戻す」で再読込後も復元できます。次の削除が行われると復元候補は更新されます。""",
)
replace_once(
    docs,
    """- Rasterの`sourceLayerIds`はLayer内参照として再マップします。""",
    """- Rasterの`sourceLayerIds`は、現在も存在するLayer IDだけを再マップします。Layer結合で削除済みになった履歴IDは生成Pageへ持ち込みません。""",
)
