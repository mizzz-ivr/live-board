from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if marker in text:
        return
    file.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


path = 'apps/desktop/src/user-page-templates.ts'
replace_once(path, "  createPage,\n", "  createPage,\n  createProjectAssetLibrary,\n")
replace_once(path, "  type Page,\n", "  type Page,\n  type ProjectAsset,\n  type ProjectAssetLibrary,\n")
replace_once(
    path,
    "import { parseRasterDrawing } from '@live-board/obs-protocol';\n",
    "import { parseRasterDrawing } from '@live-board/obs-protocol';\nimport {\n"
    "  assertUserPageTemplateAssetReferences,\n"
    "  collectUserPageTemplateAssets,\n"
    "  mergeUserPageTemplateAssets,\n"
    "  validateUserPageTemplateAssets,\n"
    "} from './user-page-template-assets';\n",
)
replace_once(
    path,
    "export const USER_PAGE_TEMPLATE_SCHEMA_VERSION = 1 as const;\n"
    "export const USER_PAGE_TEMPLATE_STORAGE_KEY = 'live-board:user-page-templates:v1';\n"
    "export const USER_PAGE_TEMPLATE_LIMIT = 50;\n"
    "export const USER_PAGE_TEMPLATE_MAX_BYTES = 256 * 1024;\n"
    "export const USER_PAGE_TEMPLATE_TOTAL_BYTES = 2 * 1024 * 1024;",
    "export const USER_PAGE_TEMPLATE_SCHEMA_VERSION = 2 as const;\n"
    "export const USER_PAGE_TEMPLATE_STORAGE_KEY = 'live-board:user-page-templates:v2';\n"
    "export const USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY = 'live-board:user-page-templates:v1';\n"
    "export const USER_PAGE_TEMPLATE_LIMIT = 50;\n"
    "export const USER_PAGE_TEMPLATE_MAX_BYTES = 2 * 1024 * 1024;\n"
    "export const USER_PAGE_TEMPLATE_TOTAL_BYTES = 4 * 1024 * 1024;",
)
replace_once(
    path,
    "  readonly preview: UserPageTemplatePreview;\n  readonly page: Page;\n}",
    "  readonly preview: UserPageTemplatePreview;\n  readonly page: Page;\n  readonly assets: readonly ProjectAsset[];\n}",
)
replace_once(
    path,
    "  | 'UNSUPPORTED_SCHEMA_VERSION'\n  | 'STORAGE_UNAVAILABLE';",
    "  | 'UNSUPPORTED_SCHEMA_VERSION'\n  | 'ASSET_LIBRARY_REQUIRED'\n  | 'STORAGE_UNAVAILABLE';",
)
old_eligibility = """export function getUserPageTemplateSaveEligibility(
  page: Page,
): UserPageTemplateEligibility {
  const document = getLayerDocument(page);
  const unsupported = document.layers.filter(
    (layer) =>
      (layer.type === 'image' || layer.type === 'raster')
      && layer.content.assetId !== null,
  );

  if (unsupported.length === 0) {
    return { allowed: true, reason: null };
  }

  const names = unsupported
    .slice(0, 3)
    .map((layer) => `「${layer.name}」`)
    .join('、');
  const suffix = unsupported.length > 3 ? `ほか${unsupported.length - 3}件` : '';
  return {
    allowed: false,
    reason:
      `Asset参照を含むLayer（${names}${suffix}）は現在マイテンプレートへ保存できません。`
      + '画像・描画Assetの複製対応後に保存可能になります。',
  };
}
"""
new_eligibility = """export function getUserPageTemplateSaveEligibility(
  page: Page,
  assetLibrary: ProjectAssetLibrary = createProjectAssetLibrary(),
): UserPageTemplateEligibility {
  try {
    collectUserPageTemplateAssets(page, assetLibrary);
    return { allowed: true, reason: null };
  } catch (error: unknown) {
    return {
      allowed: false,
      reason: error instanceof Error
        ? error.message
        : 'Pageが参照するAssetをマイテンプレートへ保存できません。',
    };
  }
}
"""
replace_once(path, old_eligibility, new_eligibility)
replace_once(
    path,
    "  readonly page: Page;\n  readonly createdAt: string;\n}): UserPageTemplate {",
    "  readonly page: Page;\n  readonly assetLibrary?: ProjectAssetLibrary;\n  readonly createdAt: string;\n}): UserPageTemplate {",
)
replace_once(
    path,
    "  const eligibility = getUserPageTemplateSaveEligibility(input.page);\n"
    "  if (!eligibility.allowed) {\n"
    "    throw new UserPageTemplateError(\n"
    "      'ASSET_REFERENCE_UNSUPPORTED',\n"
    "      eligibility.reason ?? 'Asset参照を含むPageは保存できません。',\n"
    "    );\n"
    "  }\n\n",
    "  const assetLibrary = input.assetLibrary ?? createProjectAssetLibrary();\n"
    "  const eligibility = getUserPageTemplateSaveEligibility(input.page, assetLibrary);\n"
    "  if (!eligibility.allowed) {\n"
    "    throw new UserPageTemplateError(\n"
    "      'ASSET_REFERENCE_UNSUPPORTED',\n"
    "      eligibility.reason ?? 'Pageが参照するAssetを保存できません。',\n"
    "    );\n"
    "  }\n"
    "  const assets = collectUserPageTemplateAssets(input.page, assetLibrary);\n\n",
)
replace_once(
    path,
    "    preview: derivePreview(page),\n    page,\n  };",
    "    preview: derivePreview(page),\n    page,\n    assets,\n  };",
)
old_instantiate = """export function instantiateUserPageTemplate(input: {
  readonly template: UserPageTemplate;
  readonly projectId: string;
  readonly pageId: string;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): Page {
  const template = validateStoredTemplate(input.template);
  return clonePageWithRemappedLayerIds({
    sourcePage: template.page,
    projectId: input.projectId,
    pageId: input.pageId,
    name: template.name,
    createdAt: input.createdAt,
    createLayerId: input.createLayerId,
  });
}
"""
new_instantiate = """export interface InstantiatedUserPageTemplate {
  readonly page: Page;
  readonly assetLibrary: ProjectAssetLibrary;
}

export function instantiateUserPageTemplate(input: {
  readonly template: UserPageTemplate;
  readonly projectId: string;
  readonly pageId: string;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): Page {
  const template = validateStoredTemplate(input.template);
  if (template.assets.length > 0) {
    throw new UserPageTemplateError(
      'ASSET_LIBRARY_REQUIRED',
      'Asset付きマイテンプレートはAsset Libraryを指定して作成してください。',
    );
  }
  return clonePageWithRemappedLayerIds({
    sourcePage: template.page,
    projectId: input.projectId,
    pageId: input.pageId,
    name: template.name,
    createdAt: input.createdAt,
    createLayerId: input.createLayerId,
  });
}

export function instantiateUserPageTemplateWithAssets(input: {
  readonly template: UserPageTemplate;
  readonly projectId: string;
  readonly pageId: string;
  readonly assetLibrary: ProjectAssetLibrary;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): InstantiatedUserPageTemplate {
  const template = validateStoredTemplate(input.template);
  const assetLibrary = mergeUserPageTemplateAssets(input.assetLibrary, template.assets);
  const page = clonePageWithRemappedLayerIds({
    sourcePage: template.page,
    projectId: input.projectId,
    pageId: input.pageId,
    name: template.name,
    createdAt: input.createdAt,
    createLayerId: input.createLayerId,
  });
  assertUserPageTemplateAssetReferences(page, template.assets);
  return { page, assetLibrary };
}
"""
replace_once(path, old_instantiate, new_instantiate)
replace_once(
    path,
    "  try {\n    raw = storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY);\n  } catch (error: unknown) {",
    "  try {\n"
    "    raw = storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY);\n"
    "    if (raw === null) raw = storage.getItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY);\n"
    "  } catch (error: unknown) {",
)
insert_marker = """  if (
    isRecord(parsed)
    && typeof parsed.schemaVersion === 'number'
    && parsed.schemaVersion !== USER_PAGE_TEMPLATE_SCHEMA_VERSION
  ) {"""
replace_once(
    path,
    insert_marker,
    """  let migratedLegacy = false;
  if (isRecord(parsed) && parsed.schemaVersion === 1) {
    parsed = migrateLegacyStoreDocument(parsed);
    migratedLegacy = true;
  }

""" + insert_marker,
)
replace_once(
    path,
    "  if (\n    warnings.length > 0\n",
    "  if (\n    migratedLegacy\n    || warnings.length > 0\n",
)
old_stored_eligibility = """  const page: Page = { ...metadata, layerDocument: document };
  const eligibility = getUserPageTemplateSaveEligibility(page);
  if (!eligibility.allowed) {
    throw new UserPageTemplateError(
      'ASSET_REFERENCE_UNSUPPORTED',
      eligibility.reason ?? 'Asset参照を含むPageは保存できません。',
    );
  }

  const template: UserPageTemplate = {
    id,
    name,
    createdAt,
    updatedAt,
    preview: derivePreview(page),
    page,
  };"""
new_stored_eligibility = """  const page: Page = { ...metadata, layerDocument: document };
  const assets = validateUserPageTemplateAssets(value.assets);
  assertUserPageTemplateAssetReferences(page, assets);

  const template: UserPageTemplate = {
    id,
    name,
    createdAt,
    updatedAt,
    preview: derivePreview(page),
    page,
    assets,
  };"""
replace_once(path, old_stored_eligibility, new_stored_eligibility)
replace_once(
    path,
    "function persistTemplates(\n",
    """function migrateLegacyStoreDocument(
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(value.templates)) return value;
  const migrateTemplate = (candidate: unknown): unknown =>
    isRecord(candidate) ? { ...candidate, assets: [] } : candidate;
  return {
    ...value,
    schemaVersion: USER_PAGE_TEMPLATE_SCHEMA_VERSION,
    templates: value.templates.map(migrateTemplate),
    lastDeletedTemplate:
      value.lastDeletedTemplate === undefined || value.lastDeletedTemplate === null
        ? null
        : migrateTemplate(value.lastDeletedTemplate),
  };
}

function persistTemplates(
""",
)
replace_once(
    path,
    "      'マイテンプレートの合計保存容量が2MiBを超えます。',",
    "      'マイテンプレートの合計保存容量が4MiBを超えます。',",
)
replace_once(
    path,
    "      'このPageはマイテンプレート1件あたりの保存上限256KiBを超えています。',",
    "      'このPageはマイテンプレート1件あたりの保存上限2MiBを超えています。',",
)

path = 'apps/desktop/src/useUserPageTemplates.ts'
replace_once(
    path,
    "import type { Page } from '@live-board/domain';",
    "import type { Page, ProjectAssetLibrary } from '@live-board/domain';",
)
replace_once(
    path,
    "  savePage(page: Page, name: string): boolean;",
    "  savePage(page: Page, name: string, assetLibrary: ProjectAssetLibrary): boolean;",
)
replace_once(
    path,
    "  const savePage = useCallback((page: Page, name: string): boolean => {",
    "  const savePage = useCallback((\n"
    "    page: Page,\n"
    "    name: string,\n"
    "    assetLibrary: ProjectAssetLibrary,\n"
    "  ): boolean => {",
)
replace_once(
    path,
    "        page,\n        createdAt,",
    "        page,\n        assetLibrary,\n        createdAt,",
)

path = 'apps/desktop/src/AppV2.tsx'
replace_once(
    path,
    "  instantiateUserPageTemplate,\n",
    "  instantiateUserPageTemplateWithAssets,\n",
)
old_asset_order = """  const editPage =
    project.pages.find((candidate) => candidate.id === project.activeEditPageId) ??
    project.pages[0]!;
  const userTemplateEligibility = getUserPageTemplateSaveEligibility(editPage);
  const userTemplateSaveDisabledReason = !userPageTemplates.enabled
    ? userPageTemplates.message ?? 'マイテンプレート保存領域を利用できません。'
    : userTemplateEligibility.reason;
  const broadcastPage =
    project.pages.find((candidate) => candidate.id === project.activeBroadcastPageId) ??
    project.pages[0]!;
  const assetLibrary = assetLibraries[project.id] ?? createProjectAssetLibrary();"""
new_asset_order = """  const editPage =
    project.pages.find((candidate) => candidate.id === project.activeEditPageId) ??
    project.pages[0]!;
  const assetLibrary = assetLibraries[project.id] ?? createProjectAssetLibrary();
  const userTemplateEligibility = getUserPageTemplateSaveEligibility(
    editPage,
    assetLibrary,
  );
  const userTemplateSaveDisabledReason = !userPageTemplates.enabled
    ? userPageTemplates.message ?? 'マイテンプレート保存領域を利用できません。'
    : userTemplateEligibility.reason;
  const broadcastPage =
    project.pages.find((candidate) => candidate.id === project.activeBroadcastPageId) ??
    project.pages[0]!;"""
replace_once(path, old_asset_order, new_asset_order)
old_user_add = """      const page = instantiateUserPageTemplate({
        template,
        projectId: project.id,
        pageId: createEntityId('page'),
        createdAt,
        createLayerId: () => createEntityId('layer-user-template'),
      });
      setCommandState((current) =>
        dispatchProjectCommandWithCanvasHistory(
          current,
          createAddPageCommand(
            project.id,
            page,
            createCommandMetadata('page-user-template-add'),
          ),
        ),
      );"""
new_user_add = """      const instantiated = instantiateUserPageTemplateWithAssets({
        template,
        projectId: project.id,
        pageId: createEntityId('page'),
        assetLibrary,
        createdAt,
        createLayerId: () => createEntityId('layer-user-template'),
      });
      const command = createAddPageCommand(
        project.id,
        instantiated.page,
        createCommandMetadata('page-user-template-add'),
      );
      const validatedState = dispatchProjectCommandWithCanvasHistory(commandState, command);
      setAssetLibraries((current) => ({
        ...current,
        [project.id]: instantiated.assetLibrary,
      }));
      setCommandState((current) =>
        current === commandState
          ? validatedState
          : dispatchProjectCommandWithCanvasHistory(current, command),
      );"""
replace_once(path, old_user_add, new_user_add)
replace_once(
    path,
    "    if (userPageTemplates.savePage(editPage, name)) setDomainError(null);",
    "    if (userPageTemplates.savePage(editPage, name, assetLibrary)) setDomainError(null);",
)

path = 'apps/desktop/src/PageTemplateDialog.tsx'
replace_once(
    path,
    "              <p>Asset非依存のPageを、Workspaceとは別のローカルテンプレートとして保存します。</p>",
    "              <p>Pageと参照画像Assetを、Workspaceとは別のローカルテンプレートとして保存します。</p>",
)
replace_once(
    path,
    "                      <span>保存済みPageから新しいPageを作成します。</span>\n"
    "                      <small>{new Date(template.createdAt).toLocaleString()}</small>",
    "                      <span>保存済みPageから新しいPageを作成します。</span>\n"
    "                      <small>Asset {template.assets.length}件 · {new Date(template.createdAt).toLocaleString()}</small>",
)

path = 'apps/desktop/test/user-page-templates.test.ts'
replace_once(
    path,
    "    const raw = JSON.stringify({ schemaVersion: 2, templates: [{ future: true }] });",
    "    const raw = JSON.stringify({ schemaVersion: 3, templates: [{ future: true }] });",
)
replace_once(
    path,
    "  it('Asset参照を含むPageは保存対象外にする', () => {",
    "  it('参照AssetがLibraryに存在しないPageは保存対象外にする', () => {",
)
replace_once(
    path,
    "    expect(eligibility.reason).toContain('ロゴ画像');",
    "    expect(eligibility.reason).toContain('Assetが見つかりません');",
)

path = 'tests/e2e/page-template-gallery.spec.ts'
append_once(
    path,
    "Asset付きPageをマイテンプレートへ保存し",
    r"""
test('Asset付きPageをマイテンプレートへ保存し、再利用時にAssetを重複排除する', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7qkAAAAASUVORK5CYII=',
    'base64',
  );
  await page.getByLabel('画像ファイルを選択').setInputFiles({
    name: 'template-logo.png',
    mimeType: 'image/png',
    buffer: png,
  });
  const assetRows = page.locator('.asset-list .asset-row');
  await expect(assetRows).toHaveCount(1);
  await expect(assetRows.first()).toContainText('template-logo.png');

  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  let dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('textbox', { name: 'マイテンプレート名' }).fill('ロゴ付きシーン');
  await dialog.getByRole('button', {
    name: '現在のPageをマイテンプレートに保存',
  }).click();
  await expect(dialog.getByRole('status')).toContainText('ロゴ付きシーン');
  await expect(dialog.getByText(/Asset 1件/)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await expect(assetRows).toHaveCount(0);

  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('button', {
    name: 'ロゴ付きシーンマイテンプレートでPageを作成',
  }).click();
  await expect(assetRows).toHaveCount(1);
  await expect(assetRows.first()).toContainText('template-logo.png');

  const pageRows = page.locator('.page-list .page-row');
  await expect(pageRows).toHaveCount(2);
  await page.getByRole('button', { name: 'Pageテンプレートを開く' }).click();
  dialog = page.getByRole('dialog', { name: 'Pageテンプレート' });
  await dialog.getByRole('button', {
    name: 'ロゴ付きシーンマイテンプレートでPageを作成',
  }).click();
  await expect(pageRows).toHaveCount(3);
  await expect(assetRows).toHaveCount(1);
});
""",
)

path = 'docs/user-page-templates.md'
append_once(
    path,
    '## Asset付きテンプレート（schema version 2）',
    """
## Asset付きテンプレート（schema version 2）

画像・Raster Layerが参照するProject Assetもマイテンプレートへ同梱できます。保存対象は現在Pageから実際に参照されているAssetだけです。

- 保存キーは`live-board:user-page-templates:v2`
- 旧`v1`ストアはAssetなしテンプレートとしてv2へコピー移行し、旧キーの原本は削除しない
- 同梱Asset実バイト合計は1テンプレート1MiBまで
- 1テンプレートJSONは2MiBまで
- ストア全体JSONは4MiBまで
- Asset IDは既存どおりSHA-256 content-addressed IDを利用
- 再利用時はdata URLを再デコードし、既存`importProjectAsset`でMIME・SVG・寸法・容量・SHAを再検証
- 同じSHAのAssetが対象Projectに存在する場合は重複登録しない
- 参照切れAsset、改ざんAsset、容量超過はPage/Asset Libraryのどちらも変更する前に拒否

動画・音声Asset、クラウド同期、Export / Importは引き続き対象外です。
""",
)
