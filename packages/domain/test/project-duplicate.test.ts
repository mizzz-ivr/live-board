import { describe, expect, it } from 'vitest';
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
