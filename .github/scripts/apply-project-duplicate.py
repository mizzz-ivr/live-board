from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'replacement target not found: {path}\n{old[:240]}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


def write_new(path: str, content: str) -> None:
    file = Path(path)
    if file.exists():
        raise RuntimeError(f'file already exists: {path}')
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content, encoding='utf-8')


write_new(
    'packages/domain/src/project-duplicate.ts',
    r'''import {
  assertLayerDocumentIntegrity,
  getLayerDocument,
  type Layer,
  type LayerDocument,
  type LayerId,
} from './layers.js';
import {
  createPage,
  createProject,
  type Page,
  type PageId,
  type Project,
  type ProjectId,
} from './model.js';

const PROJECT_COPY_SUFFIX = ' のコピー';
const MAX_PROJECT_NAME_LENGTH = 120;

export interface DuplicateProjectInput {
  id: ProjectId;
  name?: string;
  createdAt?: string;
  createPageId(sourcePage: Page, pageIndex: number): PageId;
  createLayerId(
    sourceLayer: Layer,
    pageIndex: number,
    layerIndex: number,
  ): LayerId;
}

export function duplicateProject(
  sourceProject: Project,
  input: DuplicateProjectInput,
): Project {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const pageIdMap = new Map(
    sourceProject.pages.map((page, index) => [
      page.id,
      input.createPageId(page, index),
    ]),
  );

  const pages = sourceProject.pages.map((sourcePage, pageIndex) => {
    const pageId = requireMappedId(pageIdMap, sourcePage.id, 'Page');
    const page = createPage({
      id: pageId,
      projectId: input.id,
      name: sourcePage.name,
      width: sourcePage.width,
      height: sourcePage.height,
      dpi: sourcePage.dpi,
      transparent: sourcePage.transparent,
      createdAt,
      updatedAt: createdAt,
    });
    if (sourcePage.layerDocument === undefined) return page;

    return {
      ...page,
      layerDocument: duplicateLayerDocument(
        sourcePage,
        pageId,
        pageIndex,
        input,
        createdAt,
      ),
    };
  });

  return createProject({
    id: input.id,
    workspaceId: sourceProject.workspaceId,
    name: input.name ?? createProjectCopyName(sourceProject.name),
    pages,
    activeEditPageId: requireMappedId(
      pageIdMap,
      sourceProject.activeEditPageId,
      'Edit Page',
    ),
    activeBroadcastPageId: requireMappedId(
      pageIdMap,
      sourceProject.activeBroadcastPageId,
      'Broadcast Page',
    ),
    broadcastPageLocked: sourceProject.broadcastPageLocked,
    createdAt,
    updatedAt: createdAt,
  });
}

export function createProjectCopyName(sourceName: string): string {
  const normalizedName = sourceName.trim();
  const maxBaseLength = MAX_PROJECT_NAME_LENGTH - PROJECT_COPY_SUFFIX.length;
  const baseName = normalizedName.slice(0, maxBaseLength).trimEnd();
  return baseName.length === 0 ? 'コピー' : `${baseName}${PROJECT_COPY_SUFFIX}`;
}

function duplicateLayerDocument(
  sourcePage: Page,
  targetPageId: PageId,
  pageIndex: number,
  input: DuplicateProjectInput,
  createdAt: string,
): LayerDocument {
  const sourceDocument = getLayerDocument(sourcePage);
  assertLayerDocumentIntegrity(sourcePage.id, sourceDocument);
  const layerIdMap = new Map(
    sourceDocument.layers.map((layer, layerIndex) => [
      layer.id,
      input.createLayerId(layer, pageIndex, layerIndex),
    ]),
  );

  const layers = sourceDocument.layers.map((sourceLayer) => {
    const layer = cloneSerializable(sourceLayer);
    layer.id = requireMappedId(layerIdMap, sourceLayer.id, 'Layer');
    layer.pageId = targetPageId;
    layer.parentId =
      sourceLayer.parentId === null
        ? null
        : requireMappedId(layerIdMap, sourceLayer.parentId, 'Parent Layer');
    layer.createdAt = createdAt;
    layer.updatedAt = createdAt;

    if (layer.type === 'folder') {
      layer.childLayerIds = sourceLayer.type === 'folder'
        ? sourceLayer.childLayerIds.map((layerId) =>
            requireMappedId(layerIdMap, layerId, 'Child Layer'),
          )
        : [];
    }
    if (layer.type === 'raster' && sourceLayer.type === 'raster') {
      layer.content.sourceLayerIds = sourceLayer.content.sourceLayerIds.map(
        (layerId) => layerIdMap.get(layerId) ?? layerId,
      );
    }
    return layer;
  });

  const document: LayerDocument = {
    layers,
    rootLayerIds: sourceDocument.rootLayerIds.map((layerId) =>
      requireMappedId(layerIdMap, layerId, 'Root Layer'),
    ),
    activeLayerId:
      sourceDocument.activeLayerId === null
        ? null
        : requireMappedId(
            layerIdMap,
            sourceDocument.activeLayerId,
            'Active Layer',
          ),
  };
  assertLayerDocumentIntegrity(targetPageId, document);
  return document;
}

function requireMappedId<T extends string>(
  idMap: ReadonlyMap<T, T>,
  sourceId: T,
  label: string,
): T {
  const mappedId = idMap.get(sourceId);
  if (mappedId === undefined) {
    throw new Error(`${label} mapping not found: ${sourceId}`);
  }
  return mappedId;
}

function cloneSerializable<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneSerializable(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneSerializable(item)]),
    ) as T;
  }
  return value;
}
''',
)

replace_once(
    'packages/domain/src/index.ts',
    "export * from './workspace-projects.js';\n",
    "export * from './workspace-projects.js';\nexport * from './project-duplicate.js';\n",
)

replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  canUndoWorkspace,\n  cloneLayer,\n",
    "  canUndoWorkspace,\n  cloneLayer,\n  cloneProjectAssetLibrary,\n",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  dispatchWorkspaceCommandWithCanvasHistory,\n  getCanvasHistory,\n",
    "  dispatchWorkspaceCommandWithCanvasHistory,\n  duplicateProject,\n  findProject,\n  getCanvasHistory,\n",
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "  function renameProject(projectId: string, name: string): void {\n",
    r'''  function duplicateProjectTab(projectId: string): void {
    const timestamp = new Date().toISOString();
    try {
      const sourceProject = findProject(commandState.workspace, projectId);
      const nextProject = duplicateProject(sourceProject, {
        id: createEntityId('project'),
        createdAt: timestamp,
        createPageId: () => createEntityId('page'),
        createLayerId: () => createEntityId('layer'),
      });
      const nextCommandState = dispatchWorkspaceCommandWithCanvasHistory(
        commandState,
        createAddProjectCommand(
          commandState.workspace.id,
          nextProject,
          createCommandMetadata('project-duplicate'),
        ),
      );
      const sourceLibrary =
        assetLibraries[projectId] ?? createProjectAssetLibrary();

      setAssetLibraries((current) => ({
        ...current,
        [nextProject.id]: cloneProjectAssetLibrary(sourceLibrary),
      }));
      setCommandState(nextCommandState);
      setSelection(null);
      setSelectionMode(null);
      setViewport(DEFAULT_CANVAS_VIEWPORT);
      setAssetError(null);
      setDomainError(null);
    } catch (error: unknown) {
      setDomainError(
        error instanceof DomainError ? error.message : 'Projectの複製に失敗しました',
      );
    }
  }

  function renameProject(projectId: string, name: string): void {
''',
)
replace_once(
    'apps/desktop/src/AppV2.tsx',
    "          onCreate={createProjectTab}\n          onRename={renameProject}\n",
    "          onCreate={createProjectTab}\n          onDuplicate={duplicateProjectTab}\n          onRename={renameProject}\n",
)

replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "  onCreate(): void;\n  onRename(projectId: string, name: string): void;\n",
    "  onCreate(): void;\n  onDuplicate(projectId: string): void;\n  onRename(projectId: string, name: string): void;\n",
)
replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    "  onCreate,\n  onRename,\n",
    "  onCreate,\n  onDuplicate,\n  onRename,\n",
)
replace_once(
    'apps/desktop/src/ProjectTabs.tsx',
    r'''              <button
                type="button"
                className="project-tab-pin"
''',
    r'''              <button
                type="button"
                className="project-tab-duplicate"
                aria-label={`${project.name}を複製`}
                onClick={() => onDuplicate(project.id)}
              >
                複製
              </button>
              <button
                type="button"
                className="project-tab-pin"
''',
)

replace_once(
    'apps/desktop/src/project-tabs.css',
    ".project-tabs-shell .project-tab-rename,\n.project-tabs-shell .project-tab-pin,\n",
    ".project-tabs-shell .project-tab-rename,\n.project-tabs-shell .project-tab-duplicate,\n.project-tabs-shell .project-tab-pin,\n",
)
replace_once(
    'apps/desktop/src/project-tabs.css',
    ".project-tabs-shell .project-tab-rename,\n.project-tabs-shell .project-tab-pin,\n.project-tabs-shell .project-tab-close {\n",
    ".project-tabs-shell .project-tab-rename,\n.project-tabs-shell .project-tab-duplicate,\n.project-tabs-shell .project-tab-pin,\n.project-tabs-shell .project-tab-close {\n",
)
replace_once(
    'apps/desktop/src/project-tabs.css',
    ".project-tabs-shell .project-tab-rename,\n.project-tabs-shell .project-tab-pin {\n",
    ".project-tabs-shell .project-tab-rename,\n.project-tabs-shell .project-tab-duplicate,\n.project-tabs-shell .project-tab-pin {\n",
)
replace_once(
    'apps/desktop/src/project-tabs.css',
    ".project-tabs-shell .project-tab-rename:hover,\n.project-tabs-shell .project-tab-pin:hover,\n",
    ".project-tabs-shell .project-tab-rename:hover,\n.project-tabs-shell .project-tab-duplicate:hover,\n.project-tabs-shell .project-tab-pin:hover,\n",
)

write_new(
    'packages/domain/test/project-duplicate.test.ts',
    r'''import { describe, expect, it } from 'vitest';
import {
  createLayer,
  createPage,
  createProject,
  createProjectCopyName,
  duplicateProject,
  getLayerDocument,
  type FolderLayer,
  type RasterLayer,
} from '../src/index.js';

const CREATED_AT = '2026-07-31T00:00:00.000Z';
const DUPLICATED_AT = '2026-07-31T01:00:00.000Z';

function sourceProject() {
  const projectId = 'project-source';
  const firstPage = createPage({
    id: 'page-source-1',
    projectId,
    name: 'メイン',
    width: 1280,
    height: 720,
    dpi: 96,
    transparent: false,
    createdAt: CREATED_AT,
  });
  const folder = {
    ...createLayer({
      id: 'layer-folder',
      pageId: firstPage.id,
      name: 'グループ',
      type: 'folder',
      createdAt: CREATED_AT,
    }),
    childLayerIds: ['layer-raster', 'layer-image'],
  } as FolderLayer;
  const raster = {
    ...createLayer({
      id: 'layer-raster',
      pageId: firstPage.id,
      parentId: folder.id,
      name: '描画',
      type: 'raster',
      content: {
        assetId: 'asset:source-hash',
        sourceLayerIds: ['layer-image'],
      },
      createdAt: CREATED_AT,
    }),
    transform: {
      x: 10,
      y: 20,
      scaleX: 1.5,
      scaleY: 0.75,
      rotation: 15,
    },
    drawing: { revision: 2, strokes: [], fills: [] },
  } as RasterLayer;
  const image = createLayer({
    id: 'layer-image',
    pageId: firstPage.id,
    parentId: folder.id,
    name: '画像',
    type: 'image',
    content: { assetId: 'asset:source-hash', width: 640, height: 360 },
    createdAt: CREATED_AT,
  });
  const secondPage = createPage({
    id: 'page-source-2',
    projectId,
    name: '待機画面',
    createdAt: CREATED_AT,
  });

  return createProject({
    id: projectId,
    workspaceId: 'workspace-1',
    name: '配信用Project',
    pages: [
      {
        ...firstPage,
        layerDocument: {
          layers: [folder, raster, image],
          rootLayerIds: [folder.id],
          activeLayerId: raster.id,
        },
      },
      secondPage,
    ],
    activeEditPageId: firstPage.id,
    activeBroadcastPageId: secondPage.id,
    broadcastPageLocked: true,
    createdAt: CREATED_AT,
  });
}

describe('Project複製', () => {
  it('Page・Layer IDと参照を再採番し、描画・Transform・配信設定を独立コピーする', () => {
    const source = sourceProject();
    const duplicated = duplicateProject(source, {
      id: 'project-duplicate',
      createdAt: DUPLICATED_AT,
      createPageId: (_page, index) => `page-duplicate-${index + 1}`,
      createLayerId: (_layer, pageIndex, layerIndex) =>
        `layer-duplicate-${pageIndex + 1}-${layerIndex + 1}`,
    });

    expect(duplicated.id).toBe('project-duplicate');
    expect(duplicated.name).toBe('配信用Project のコピー');
    expect(duplicated.pages.map((page) => page.id)).toEqual([
      'page-duplicate-1',
      'page-duplicate-2',
    ]);
    expect(duplicated.pages.every((page) => page.projectId === duplicated.id)).toBe(true);
    expect(duplicated.activeEditPageId).toBe('page-duplicate-1');
    expect(duplicated.activeBroadcastPageId).toBe('page-duplicate-2');
    expect(duplicated.broadcastPageLocked).toBe(true);

    const sourceDocument = getLayerDocument(source.pages[0]!);
    const duplicatedDocument = getLayerDocument(duplicated.pages[0]!);
    expect(duplicatedDocument.rootLayerIds).toEqual(['layer-duplicate-1-1']);
    expect(duplicatedDocument.activeLayerId).toBe('layer-duplicate-1-2');
    expect(duplicatedDocument.layers.map((layer) => layer.id)).toEqual([
      'layer-duplicate-1-1',
      'layer-duplicate-1-2',
      'layer-duplicate-1-3',
    ]);

    const duplicatedFolder = duplicatedDocument.layers[0] as FolderLayer;
    const duplicatedRaster = duplicatedDocument.layers[1] as RasterLayer;
    expect(duplicatedFolder.childLayerIds).toEqual([
      'layer-duplicate-1-2',
      'layer-duplicate-1-3',
    ]);
    expect(duplicatedRaster.parentId).toBe('layer-duplicate-1-1');
    expect(duplicatedRaster.content.assetId).toBe('asset:source-hash');
    expect(duplicatedRaster.content.sourceLayerIds).toEqual([
      'layer-duplicate-1-3',
    ]);
    expect(duplicatedRaster.transform).toEqual({
      x: 10,
      y: 20,
      scaleX: 1.5,
      scaleY: 0.75,
      rotation: 15,
    });
    expect(duplicatedRaster.drawing).toEqual({
      revision: 2,
      strokes: [],
      fills: [],
    });
    expect(duplicatedRaster.drawing).not.toBe(
      (sourceDocument.layers[1] as RasterLayer).drawing,
    );

    duplicatedRaster.drawing!.revision = 99;
    expect((sourceDocument.layers[1] as RasterLayer).drawing!.revision).toBe(2);
    expect(source.pages.map((page) => page.id)).toEqual([
      'page-source-1',
      'page-source-2',
    ]);
  });

  it('長いProject名を120文字以内へ収める', () => {
    const copiedName = createProjectCopyName('あ'.repeat(120));
    expect(copiedName.length).toBeLessThanOrEqual(120);
    expect(copiedName.endsWith(' のコピー')).toBe(true);
  });

  it('Page ID生成が重複した場合は拒否する', () => {
    expect(() =>
      duplicateProject(sourceProject(), {
        id: 'project-duplicate',
        createdAt: DUPLICATED_AT,
        createPageId: () => 'page-duplicate',
        createLayerId: (_layer, pageIndex, layerIndex) =>
          `layer-duplicate-${pageIndex}-${layerIndex}`,
      }),
    ).toThrow('Duplicate page id');
  });

  it('Layer ID生成が重複した場合は拒否する', () => {
    expect(() =>
      duplicateProject(sourceProject(), {
        id: 'project-duplicate',
        createdAt: DUPLICATED_AT,
        createPageId: (_page, index) => `page-duplicate-${index}`,
        createLayerId: () => 'layer-duplicate',
      }),
    ).toThrow('Duplicate layer id');
  });
});
''',
)

replace_once(
    'tests/e2e/project-tabs-desktop.spec.ts',
    "\n\ntest('Project名を変更し、Project操作でUndo・Redoできる'",
    "\ntest('Projectを複製し、Page構成とProject操作Undo・Redoを維持できる', async ({ page }) => {\n  await page.goto('/');\n  await expect(page.getByTestId('canvas-surface')).toBeVisible();\n\n  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });\n  await page.getByRole('button', { name: 'ページを追加' }).click();\n  await expect(page.locator('.page-list .page-row')).toHaveCount(2);\n\n  await page.getByRole('button', { name: '新しいプロジェクトを複製' }).click();\n\n  const duplicatedTab = tablist.getByRole('tab', {\n    name: /新しいプロジェクト のコピー/,\n  });\n  await expect(tablist.getByRole('tab')).toHaveCount(2);\n  await expect(duplicatedTab).toHaveAttribute('aria-selected', 'true');\n  await expect(page.locator('.page-list .page-row')).toHaveCount(2);\n  await expect(page.getByText('ワークスペースに未保存の変更あり')).toBeVisible();\n\n  await page.getByRole('button', { name: 'Project操作を元に戻す' }).click();\n  await expect(tablist.getByRole('tab')).toHaveCount(1);\n  await expect(\n    tablist.getByRole('tab', { name: /新しいプロジェクト/ }),\n  ).toHaveAttribute('aria-selected', 'true');\n\n  await page.getByRole('button', { name: 'Project操作をやり直す' }).click();\n  await expect(tablist.getByRole('tab')).toHaveCount(2);\n  await expect(duplicatedTab).toHaveAttribute('aria-selected', 'true');\n  await expect(page.locator('.page-list .page-row')).toHaveCount(2);\n});\n\ntest('Project名を変更し、Project操作でUndo・Redoできる'",
)

replace_once(
    'README.md',
    "- Project追加、名前変更、タブ切り替え、タブを閉じる、直近タブの復元、Workspace単位の未保存表示\n",
    "- Project追加、複製、名前変更、タブ切り替え、タブを閉じる、直近タブの復元、Workspace単位の未保存表示\n",
)
replace_once(
    'README.md',
    "- Project名を変更し、Project操作としてUndo / Redo\n",
    "- ProjectをPage・Layer・Assetごと独立複製し、Project操作としてUndo / Redo\n- Project名を変更し、Project操作としてUndo / Redo\n",
)

replace_once(
    'docs/project-tabs.md',
    "Project追加・選択・名前変更はWorkspaceを変更するため、",
    "Project追加・複製・選択・名前変更はWorkspaceを変更するため、",
)
replace_once(
    'docs/project-tabs.md',
    "Project追加・選択・名前変更は`WorkspaceCommand`として実行します。\n",
    "Project追加・選択・名前変更は`WorkspaceCommand`として実行します。Project複製はPage・Layer IDを再採番したProjectを生成し、既存の`workspace.project.add`として実行します。\n",
)
replace_once(
    'docs/project-tabs.md',
    "- `名前`: 1〜120文字のProject名へ変更\n",
    "- `複製`: Page・Layer・描画・Asset参照・配信設定を保持した独立Projectを追加して選択\n- `名前`: 1〜120文字のProject名へ変更\n",
)
replace_once(
    'docs/project-tabs.md',
    "- Project名変更をUndo / Redoできる\n",
    "- Project複製でPage・Layer IDと参照を再採番し、描画・Transform・Asset参照・配信設定を維持する\n- Project複製をUndo / Redoでき、Redo可能な間はAsset Libraryを保持する\n- Project名変更をUndo / Redoできる\n",
)
replace_once(
    'docs/project-tabs.md',
    "- Project本体の削除、複製\n",
    "- Project本体の削除\n",
)
