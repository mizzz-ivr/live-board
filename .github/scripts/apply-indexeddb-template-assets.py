from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:140]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


path = 'apps/desktop/src/user-page-templates.ts'
replace_once(path, "  type ProjectAsset,\n", "")
replace_once(
    path,
    "  mergeUserPageTemplateAssets,\n  validateUserPageTemplateAssets,\n} from './user-page-template-assets';",
    "  mergeUserPageTemplateAssets,\n"
    "  toUserPageTemplateAssetMetadata,\n"
    "  validateUserPageTemplateAssets,\n"
    "  type UserPageTemplateAssetMetadata,\n"
    "} from './user-page-template-assets';\n"
    "import type { UserPageTemplateAssetPayloadStore } from './user-page-template-asset-payload-store';",
)
replace_once(
    path,
    "export const USER_PAGE_TEMPLATE_MAX_BYTES = 2 * 1024 * 1024;\n"
    "export const USER_PAGE_TEMPLATE_TOTAL_BYTES = 4 * 1024 * 1024;",
    "export const USER_PAGE_TEMPLATE_MAX_BYTES = 256 * 1024;\n"
    "export const USER_PAGE_TEMPLATE_TOTAL_BYTES = 2 * 1024 * 1024;",
)
replace_once(
    path,
    "  readonly assets: readonly ProjectAsset[];",
    "  readonly assets: readonly UserPageTemplateAssetMetadata[];",
)
replace_once(
    path,
    "  const assets = collectUserPageTemplateAssets(input.page, assetLibrary);",
    "  const assets = toUserPageTemplateAssetMetadata(\n"
    "    collectUserPageTemplateAssets(input.page, assetLibrary),\n"
    "  );",
)
old_instantiate = """export function instantiateUserPageTemplateWithAssets(input: {
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
new_instantiate = """export async function instantiateUserPageTemplateWithAssets(input: {
  readonly template: UserPageTemplate;
  readonly projectId: string;
  readonly pageId: string;
  readonly assetLibrary: ProjectAssetLibrary;
  readonly assetPayloadStore: UserPageTemplateAssetPayloadStore;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): Promise<InstantiatedUserPageTemplate> {
  const template = validateStoredTemplate(input.template);
  const assetLibrary = await mergeUserPageTemplateAssets(
    input.assetLibrary,
    template.assets,
    input.assetPayloadStore,
  );
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
    "      'マイテンプレートの合計保存容量が4MiBを超えます。',",
    "      'マイテンプレートの合計metadata保存容量が2MiBを超えます。',",
)
replace_once(
    path,
    "      'このPageはマイテンプレート1件あたりの保存上限2MiBを超えています。',",
    "      'このPageはマイテンプレート1件あたりのmetadata保存上限256KiBを超えています。',",
)

path = 'apps/desktop/src/useUserPageTemplates.ts'
replace_once(path, "import { useCallback, useState } from 'react';", "import { useCallback, useEffect, useState } from 'react';")
replace_once(
    path,
    "} from './user-page-templates';",
    "} from './user-page-templates';\n"
    "import {\n"
    "  collectUserPageTemplateAssetReferenceIds,\n"
    "  collectUserPageTemplateAssets,\n"
    "  garbageCollectUserPageTemplateAssetPayloads,\n"
    "  persistUserPageTemplateAssetPayloads,\n"
    "} from './user-page-template-assets';\n"
    "import { getBrowserUserPageTemplateAssetPayloadStore } from './user-page-template-asset-payload-store';",
)
replace_once(
    path,
    "  savePage(page: Page, name: string, assetLibrary: ProjectAssetLibrary): boolean;\n"
    "  removeTemplate(templateId: string): boolean;\n"
    "  restoreDeletedTemplate(): boolean;",
    "  savePage(page: Page, name: string, assetLibrary: ProjectAssetLibrary): Promise<boolean>;\n"
    "  removeTemplate(templateId: string): Promise<boolean>;\n"
    "  restoreDeletedTemplate(): Promise<boolean>;",
)
replace_once(
    path,
    "  const [state, setState] = useState<UserPageTemplateState>(loadInitialState);\n\n"
    "  const savePage = useCallback((",
    "  const [state, setState] = useState<UserPageTemplateState>(loadInitialState);\n\n"
    "  useEffect(() => {\n"
    "    const initial = loadInitialState();\n"
    "    if (!initial.enabled) return;\n"
    "    void garbageCollectResult({\n"
    "      templates: initial.templates,\n"
    "      lastDeletedTemplate: initial.lastDeletedTemplate,\n"
    "    }).catch(() => undefined);\n"
    "  }, []);\n\n"
    "  const savePage = useCallback(async (",
)
replace_once(
    path,
    "  ): boolean => {\n    try {\n      const storage = browserStorage();",
    "  ): Promise<boolean> => {\n    try {\n      const storage = browserStorage();",
)
replace_once(
    path,
    "      const result = saveUserPageTemplate(storage, template);",
    "      const sourceAssets = collectUserPageTemplateAssets(page, assetLibrary);\n"
    "      await persistUserPageTemplateAssetPayloads(\n"
    "        sourceAssets,\n"
    "        getBrowserUserPageTemplateAssetPayloadStore(),\n"
    "      );\n"
    "      let result;\n"
    "      try {\n"
    "        result = saveUserPageTemplate(storage, template);\n"
    "      } catch (error: unknown) {\n"
    "        await garbageCollectCurrentStoreBestEffort();\n"
    "        throw error;\n"
    "      }\n"
    "      const gcWarning = await garbageCollectResult(result).catch(() =>\n"
    "        '不要なAssetバイナリの整理に失敗しました。',\n"
    "      );",
)
replace_once(
    path,
    "        message: result.warnings.length > 0\n"
    "          ? `「${template.name}」を保存しました。${result.warnings.join(' ')}`\n"
    "          : `「${template.name}」をマイテンプレートへ保存しました。`,",
    "        message: [\n"
    "          `「${template.name}」をマイテンプレートへ保存しました。`,\n"
    "          ...result.warnings,\n"
    "          ...(gcWarning === undefined ? [] : [gcWarning]),\n"
    "        ].join(' '),",
)
replace_once(
    path,
    "  const removeTemplate = useCallback((templateId: string): boolean => {",
    "  const removeTemplate = useCallback(async (templateId: string): Promise<boolean> => {",
)
replace_once(
    path,
    "      const result = deleteUserPageTemplate(storage, templateId);\n      setState({",
    "      const result = deleteUserPageTemplate(storage, templateId);\n"
    "      const gcWarning = await garbageCollectResult(result).catch(() =>\n"
    "        '不要なAssetバイナリの整理に失敗しました。',\n"
    "      );\n"
    "      setState({",
)
replace_once(
    path,
    "        message: result.warnings.length > 0\n"
    "          ? `マイテンプレートを削除しました。${result.warnings.join(' ')}`\n"
    "          : 'マイテンプレートを削除しました。',",
    "        message: [\n"
    "          'マイテンプレートを削除しました。',\n"
    "          ...result.warnings,\n"
    "          ...(gcWarning === undefined ? [] : [gcWarning]),\n"
    "        ].join(' '),",
)
replace_once(
    path,
    "  const restoreDeletedTemplate = useCallback((): boolean => {",
    "  const restoreDeletedTemplate = useCallback(async (): Promise<boolean> => {",
)
replace_once(
    path,
    "      const result = restoreLastDeletedUserPageTemplate(browserStorage());\n      setState({",
    "      const result = restoreLastDeletedUserPageTemplate(browserStorage());\n"
    "      const gcWarning = await garbageCollectResult(result).catch(() =>\n"
    "        '不要なAssetバイナリの整理に失敗しました。',\n"
    "      );\n"
    "      setState({",
)
replace_once(
    path,
    "        message: result.warnings.length > 0\n"
    "          ? `削除したマイテンプレートを復元しました。${result.warnings.join(' ')}`\n"
    "          : '削除したマイテンプレートを復元しました。',",
    "        message: [\n"
    "          '削除したマイテンプレートを復元しました。',\n"
    "          ...result.warnings,\n"
    "          ...(gcWarning === undefined ? [] : [gcWarning]),\n"
    "        ].join(' '),",
)
append = """

async function garbageCollectResult(result: {
  readonly templates: readonly UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
}): Promise<void> {
  const referenced = collectUserPageTemplateAssetReferenceIds([
    ...result.templates,
    ...(result.lastDeletedTemplate === null ? [] : [result.lastDeletedTemplate]),
  ]);
  await garbageCollectUserPageTemplateAssetPayloads(
    getBrowserUserPageTemplateAssetPayloadStore(),
    referenced,
  );
}

async function garbageCollectCurrentStoreBestEffort(): Promise<void> {
  try {
    const current = loadUserPageTemplates(browserStorage());
    await garbageCollectResult(current);
  } catch {
    // 将来schemaやストレージ障害時は未知の参照を消さない。
  }
}
"""
file = Path(path)
text = file.read_text(encoding='utf-8')
if 'async function garbageCollectResult(' not in text:
    file.write_text(text.rstrip() + append, encoding='utf-8')

path = 'apps/desktop/src/AppV2.tsx'
replace_once(
    path,
    "} from './user-page-templates';",
    "} from './user-page-templates';\n"
    "import { getBrowserUserPageTemplateAssetPayloadStore } from './user-page-template-asset-payload-store';",
)
replace_once(
    path,
    "  function addPageFromUserTemplate(templateId: string): void {",
    "  async function addPageFromUserTemplate(templateId: string): Promise<void> {",
)
replace_once(
    path,
    "      const instantiated = instantiateUserPageTemplateWithAssets({",
    "      const instantiated = await instantiateUserPageTemplateWithAssets({",
)
replace_once(
    path,
    "        assetLibrary,\n        createdAt,",
    "        assetLibrary,\n"
    "        assetPayloadStore: getBrowserUserPageTemplateAssetPayloadStore(),\n"
    "        createdAt,",
)
replace_once(
    path,
    "  function saveEditPageAsUserTemplate(name: string): void {\n"
    "    if (userPageTemplates.savePage(editPage, name, assetLibrary)) setDomainError(null);\n"
    "  }\n\n"
    "  function deleteUserPageTemplate(templateId: string): void {\n"
    "    if (userPageTemplates.removeTemplate(templateId)) setDomainError(null);\n"
    "  }\n\n"
    "  function restoreDeletedUserPageTemplate(): void {\n"
    "    if (userPageTemplates.restoreDeletedTemplate()) setDomainError(null);\n"
    "  }",
    "  async function saveEditPageAsUserTemplate(name: string): Promise<void> {\n"
    "    if (await userPageTemplates.savePage(editPage, name, assetLibrary)) setDomainError(null);\n"
    "  }\n\n"
    "  async function deleteUserPageTemplate(templateId: string): Promise<void> {\n"
    "    if (await userPageTemplates.removeTemplate(templateId)) setDomainError(null);\n"
    "  }\n\n"
    "  async function restoreDeletedUserPageTemplate(): Promise<void> {\n"
    "    if (await userPageTemplates.restoreDeletedTemplate()) setDomainError(null);\n"
    "  }",
)
