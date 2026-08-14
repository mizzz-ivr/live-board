import { describe, expect, it } from 'vitest';
import {
  assertLayerDocumentIntegrity,
  createLayer,
  createPage,
  type LayerDocument,
  type Page,
} from '@live-board/domain';
import {
  USER_PAGE_TEMPLATE_STORAGE_KEY,
  UserPageTemplateError,
  createUserPageTemplate,
  deleteUserPageTemplate,
  getUserPageTemplateSaveEligibility,
  instantiateUserPageTemplate,
  loadUserPageTemplates,
  restoreLastDeletedUserPageTemplate,
  saveUserPageTemplate,
  type UserPageTemplateStorage,
} from '../src/user-page-templates';

class MemoryStorage implements UserPageTemplateStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function structuredPage(): Page {
  const pageId = 'source-page';
  const background = createLayer({
    id: 'source-background',
    pageId,
    name: '背景',
    type: 'background',
    content: { color: '#111827' },
  });
  const folderBase = createLayer({
    id: 'source-folder',
    pageId,
    name: '情報',
    type: 'folder',
  });
  const text = createLayer({
    id: 'source-text',
    pageId,
    parentId: folderBase.id,
    name: 'タイトル',
    type: 'text',
    content: {
      text: 'CUSTOM SCENE',
      fontFamily: 'sans-serif',
      fontSize: 64,
      color: '#F8FAFC',
    },
  });
  const raster = createLayer({
    id: 'source-raster',
    pageId,
    parentId: folderBase.id,
    name: '描画参照',
    type: 'raster',
    content: {
      assetId: null,
      sourceLayerIds: [text.id, 'deleted-history-layer'],
    },
  });
  const folder = {
    ...folderBase,
    childLayerIds: [text.id, raster.id],
  };
  const layerDocument: LayerDocument = {
    layers: [background, folder, text, raster],
    rootLayerIds: [background.id, folder.id],
    activeLayerId: text.id,
  };
  assertLayerDocumentIntegrity(pageId, layerDocument);
  return {
    ...createPage({
      id: pageId,
      projectId: 'source-project',
      name: 'カスタム待機',
    }),
    layerDocument,
  };
}

function assetPage(): Page {
  const pageId = 'asset-page';
  const image = createLayer({
    id: 'asset-image',
    pageId,
    name: 'ロゴ画像',
    type: 'image',
    content: {
      assetId: 'asset:logo',
      width: 640,
      height: 360,
    },
  });
  const layerDocument: LayerDocument = {
    layers: [image],
    rootLayerIds: [image.id],
    activeLayerId: image.id,
  };
  assertLayerDocumentIntegrity(pageId, layerDocument);
  return {
    ...createPage({
      id: pageId,
      projectId: 'source-project',
      name: 'Asset付きPage',
    }),
    layerDocument,
  };
}

describe('マイPageテンプレート', () => {
  it('Page保存時と再利用時にLayer参照IDをすべて再採番する', () => {
    const source = structuredPage();
    const template = createUserPageTemplate({
      templateId: 'user-template:test-1',
      name: 'カスタム待機',
      page: source,
      createdAt: '2026-08-13T00:00:00.000Z',
    });

    expect(template.page.id).not.toBe(source.id);
    expect(template.page.projectId).not.toBe(source.projectId);
    expect(JSON.stringify(template.page)).not.toContain('source-folder');
    expect(JSON.stringify(template.page)).not.toContain('source-text');

    const ids = ['new-background', 'new-folder', 'new-text', 'new-raster'];
    let index = 0;
    const page = instantiateUserPageTemplate({
      template,
      projectId: 'target-project',
      pageId: 'target-page',
      createdAt: '2026-08-13T01:00:00.000Z',
      createLayerId: () => ids[index++]!,
    });

    expect(page.id).toBe('target-page');
    expect(page.projectId).toBe('target-project');
    expect(page.name).toBe('カスタム待機');
    expect(page.layerDocument?.rootLayerIds).toEqual(['new-background', 'new-folder']);
    expect(page.layerDocument?.activeLayerId).toBe('new-text');
    expect(page.layerDocument?.layers.every((layer) => layer.pageId === page.id)).toBe(true);

    const folder = page.layerDocument?.layers.find((layer) => layer.type === 'folder');
    expect(folder?.type === 'folder' ? folder.childLayerIds : []).toEqual([
      'new-text',
      'new-raster',
    ]);
    const raster = page.layerDocument?.layers.find((layer) => layer.type === 'raster');
    expect(raster?.type === 'raster' ? raster.content.sourceLayerIds : []).toEqual([
      'new-text',
    ]);
    assertLayerDocumentIntegrity(page.id, page.layerDocument!);
  });

  it('参照AssetがLibraryに存在しないPageは保存対象外にする', () => {
    const page = assetPage();
    const eligibility = getUserPageTemplateSaveEligibility(page);
    expect(eligibility.allowed).toBe(false);
    expect(eligibility.reason).toContain('Assetが見つかりません');

    expect(() =>
      createUserPageTemplate({
        templateId: 'user-template:asset',
        name: 'Asset付き',
        page,
        createdAt: '2026-08-13T00:00:00.000Z',
      }),
    ).toThrowError(UserPageTemplateError);
  });

  it('保存・再読込・削除をWorkspaceとは独立したストアで行う', () => {
    const storage = new MemoryStorage();
    const template = createUserPageTemplate({
      templateId: 'user-template:store',
      name: 'マイ待機',
      page: structuredPage(),
      createdAt: '2026-08-13T00:00:00.000Z',
    });

    saveUserPageTemplate(storage, template);
    const loaded = loadUserPageTemplates(storage);
    expect(loaded.warnings).toEqual([]);
    expect(loaded.templates).toHaveLength(1);
    expect(loaded.templates[0]?.name).toBe('マイ待機');

    const deleted = deleteUserPageTemplate(storage, template.id);
    expect(deleted.templates).toEqual([]);
    expect(deleted.lastDeletedTemplate?.name).toBe('マイ待機');
    expect(loadUserPageTemplates(storage).templates).toEqual([]);
    expect(loadUserPageTemplates(storage).lastDeletedTemplate?.name).toBe('マイ待機');

    const restored = restoreLastDeletedUserPageTemplate(storage);
    expect(restored.templates.map((item) => item.name)).toEqual(['マイ待機']);
    expect(restored.lastDeletedTemplate).toBeNull();
  });

  it('NFKCと大文字小文字を無視して同名テンプレートの重複を拒否する', () => {
    const storage = new MemoryStorage();
    const first = createUserPageTemplate({
      templateId: 'user-template:first',
      name: 'My Scene',
      page: structuredPage(),
      createdAt: '2026-08-13T00:00:00.000Z',
    });
    const second = createUserPageTemplate({
      templateId: 'user-template:second',
      name: 'ＭＹ　ＳＣＥＮＥ',
      page: structuredPage(),
      createdAt: '2026-08-13T00:01:00.000Z',
    });
    saveUserPageTemplate(storage, first);

    expect(() => saveUserPageTemplate(storage, second)).toThrowError(
      /既に存在します/,
    );
  });

  it('Layer content・transform・drawingが不正なエントリだけを除外する', () => {
    const storage = new MemoryStorage();
    const valid = createUserPageTemplate({
      templateId: 'user-template:runtime-valid',
      name: '正常Runtime',
      page: structuredPage(),
      createdAt: '2026-08-13T00:00:00.000Z',
    });
    const invalid = JSON.parse(JSON.stringify(valid)) as {
      id: string;
      name: string;
      page: {
        layerDocument?: {
          layers: Array<Record<string, unknown>>;
        };
      };
    };
    invalid.id = 'user-template:runtime-invalid';
    invalid.name = '不正Runtime';
    const text = invalid.page.layerDocument?.layers.find(
      (layer) => layer.type === 'text',
    );
    if (text === undefined || typeof text.content !== 'object' || text.content === null) {
      throw new Error('text test fixture not found');
    }
    delete (text.content as Record<string, unknown>).fontFamily;
    text.transform = { x: 0, y: 0, scaleX: 0, scaleY: 1, rotation: 0 };

    storage.setItem(
      USER_PAGE_TEMPLATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        templates: [valid, invalid],
        lastDeletedTemplate: null,
      }),
    );

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.templates.map((item) => item.name)).toEqual(['正常Runtime']);
    expect(loaded.warnings).toContain('読み込めないマイテンプレートを1件除外しました。');
  });

  it('未対応schemaは原本を削除せず読み込みを停止する', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 3, templates: [{ future: true }] });
    storage.setItem(USER_PAGE_TEMPLATE_STORAGE_KEY, raw);

    expect(() => loadUserPageTemplates(storage)).toThrowError(
      /データは変更せず保持しています/,
    );
    expect(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY)).toBe(raw);
  });

  it('壊れたストア全体は空状態へ復旧する', () => {
    const storage = new MemoryStorage();
    storage.setItem(USER_PAGE_TEMPLATE_STORAGE_KEY, '{broken-json');

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.templates).toEqual([]);
    expect(loaded.warnings[0]).toContain('空状態へ復旧');
    expect(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY)).toBeNull();
  });

  it('壊れたエントリだけを除外して正常テンプレートを保持する', () => {
    const storage = new MemoryStorage();
    const template = createUserPageTemplate({
      templateId: 'user-template:valid',
      name: '正常',
      page: structuredPage(),
      createdAt: '2026-08-13T00:00:00.000Z',
    });
    storage.setItem(
      USER_PAGE_TEMPLATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        templates: [template, { id: 'broken-entry' }],
      }),
    );

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.templates.map((item) => item.name)).toEqual(['正常']);
    expect(loaded.warnings).toContain('読み込めないマイテンプレートを1件除外しました。');

    const sanitized = JSON.parse(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY) ?? '{}') as {
      templates?: unknown[];
    };
    expect(sanitized.templates).toHaveLength(1);
  });
});
