import {
  assertLayerDocumentIntegrity,
  createPageRenderSnapshot,
  getLayerDocument,
} from '@live-board/domain';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PAGE_TEMPLATES,
  createPageFromTemplate,
  type BuiltInPageTemplateId,
} from '../src/page-templates';

function layerIdFactory() {
  let sequence = 0;
  return () => `layer-template-${++sequence}`;
}

function createTemplatePage(templateId: BuiltInPageTemplateId) {
  return createPageFromTemplate({
    templateId,
    projectId: 'project-1',
    pageId: `page-${templateId}`,
    createdAt: '2026-08-12T00:00:00.000Z',
    createLayerId: layerIdFactory(),
  });
}

describe('page templates', () => {
  it('5種類のビルトイン配信シーンを公開する', () => {
    expect(BUILT_IN_PAGE_TEMPLATES.map((template) => template.id)).toEqual([
      'opening',
      'starting-soon',
      'talk',
      'break',
      'ending',
    ]);
    expect(new Set(BUILT_IN_PAGE_TEMPLATES.map((template) => template.name)).size)
      .toBe(BUILT_IN_PAGE_TEMPLATES.length);
  });

  it.each(BUILT_IN_PAGE_TEMPLATES)(
    '$nameテンプレートを整合したPage / Layer構造として生成する',
    (template) => {
      const page = createTemplatePage(template.id);
      const document = getLayerDocument(page);

      expect(page.name).toBe(template.name);
      expect(page.projectId).toBe('project-1');
      expect(document.layers.length).toBeGreaterThanOrEqual(5);
      expect(document.rootLayerIds).toHaveLength(document.layers.length);
      expect(new Set(document.rootLayerIds).size).toBe(document.layers.length);
      expect(document.activeLayerId).not.toBeNull();
      expect(document.layers.some((layer) => layer.type === 'background')).toBe(true);
      expect(document.layers.some((layer) => layer.type === 'shape')).toBe(true);
      expect(document.layers.some((layer) => layer.type === 'text')).toBe(true);
      expect(document.layers.some((layer) => layer.name === 'メインタイトル')).toBe(true);
      expect(() => assertLayerDocumentIntegrity(page.id, document)).not.toThrow();
    },
  );

  it('生成Pageを既存Broadcast Snapshotへそのまま変換できる', () => {
    const page = createTemplatePage('starting-soon');
    const document = getLayerDocument(page);
    const snapshot = createPageRenderSnapshot(
      page,
      'project-1',
      7,
      '2026-08-12T00:00:01.000Z',
    );

    expect(snapshot.pageId).toBe(page.id);
    expect(snapshot.pageName).toBe('配信開始待機');
    expect(snapshot.revision).toBe(7);
    expect(snapshot.layers).toHaveLength(document.layers.length);
    expect(snapshot.layers.some((layer) => layer.type === 'background')).toBe(true);
    expect(snapshot.layers.some((layer) => layer.type === 'text')).toBe(true);
  });

  it('Layer ID生成器が重複IDを返した場合は追加前に拒否する', () => {
    expect(() =>
      createPageFromTemplate({
        templateId: 'opening',
        projectId: 'project-1',
        pageId: 'page-duplicate-layer-id',
        createdAt: '2026-08-12T00:00:00.000Z',
        createLayerId: () => 'layer-duplicate',
      }),
    ).toThrow('Duplicate layer id');
  });
});
