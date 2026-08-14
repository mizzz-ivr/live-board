import { describe, expect, it } from 'vitest';
import {
  assertLayerDocumentIntegrity,
  createLayer,
  createPage,
  createProjectAssetLibrary,
  importProjectAsset,
  type LayerDocument,
  type Page,
  type ProjectAssetLibrary,
} from '@live-board/domain';
import {
  USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY,
  USER_PAGE_TEMPLATE_STORAGE_KEY,
  createUserPageTemplate,
  getUserPageTemplateSaveEligibility,
  instantiateUserPageTemplateWithAssets,
  loadUserPageTemplates,
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

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7qkAAAAASUVORK5CYII=';

function pngBytes(): Uint8Array {
  return Uint8Array.from(globalThis.atob(TINY_PNG_BASE64), (value) => value.charCodeAt(0));
}

function assetLibrary(): ProjectAssetLibrary {
  return importProjectAsset(createProjectAssetLibrary(), {
    fileName: 'logo.png',
    declaredMime: 'image/png',
    bytes: pngBytes(),
    createdAt: '2026-08-14T00:00:00.000Z',
  }).library;
}

function imagePage(assetId: string): Page {
  const pageId = 'asset-page';
  const image = createLayer({
    id: 'image-layer',
    pageId,
    name: '配信ロゴ',
    type: 'image',
    content: { assetId, width: 1, height: 1 },
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
      name: 'ロゴ付きPage',
    }),
    layerDocument,
  };
}

function emptyPage(): Page {
  return createPage({
    id: 'empty-page',
    projectId: 'source-project',
    name: '旧テンプレート',
  });
}

describe('Asset付きマイPageテンプレート', () => {
  it('参照Assetを同梱し、別Projectへ再利用してもSHA重複排除する', () => {
    const sourceLibrary = assetLibrary();
    const sourceAsset = sourceLibrary.assets[0]!;
    const page = imagePage(sourceAsset.id);

    expect(getUserPageTemplateSaveEligibility(page, sourceLibrary)).toEqual({
      allowed: true,
      reason: null,
    });

    const template = createUserPageTemplate({
      templateId: 'user-template:asset-supported',
      name: 'ロゴ付き',
      page,
      assetLibrary: sourceLibrary,
      createdAt: '2026-08-14T00:10:00.000Z',
    });
    expect(template.assets).toHaveLength(1);
    expect(template.assets[0]?.sha256).toBe(sourceAsset.sha256);

    const first = instantiateUserPageTemplateWithAssets({
      template,
      projectId: 'target-project',
      pageId: 'target-page-1',
      assetLibrary: createProjectAssetLibrary(),
      createdAt: '2026-08-14T00:20:00.000Z',
      createLayerId: () => 'target-image-1',
    });
    expect(first.assetLibrary.assets).toHaveLength(1);
    const firstImage = first.page.layerDocument?.layers.find((layer) => layer.type === 'image');
    expect(firstImage?.type === 'image' ? firstImage.content.assetId : null).toBe(sourceAsset.id);

    const second = instantiateUserPageTemplateWithAssets({
      template,
      projectId: 'target-project',
      pageId: 'target-page-2',
      assetLibrary: first.assetLibrary,
      createdAt: '2026-08-14T00:30:00.000Z',
      createLayerId: () => 'target-image-2',
    });
    expect(second.assetLibrary.assets).toHaveLength(1);
    expect(second.assetLibrary.totalBytes).toBe(first.assetLibrary.totalBytes);
  });

  it('Pageが参照するAssetがLibraryにない場合は保存を拒否する', () => {
    const eligibility = getUserPageTemplateSaveEligibility(
      imagePage('asset:missing'),
      createProjectAssetLibrary(),
    );
    expect(eligibility.allowed).toBe(false);
    expect(eligibility.reason).toContain('Assetが見つかりません');
  });

  it('XML entityを含む安全なSVG Assetを保存・再読込できる', () => {
    const storage = new MemoryStorage();
    const svg = new TextEncoder().encode(`
      <svg viewBox="0 0 100 100">
        <text x="10" y="20" font-family="A &amp; B">SAFE</text>
      </svg>`);
    const imported = importProjectAsset(createProjectAssetLibrary(), {
      fileName: 'entity.svg',
      declaredMime: 'image/svg+xml',
      bytes: svg,
      createdAt: '2026-08-14T00:00:00.000Z',
    });
    const template = createUserPageTemplate({
      templateId: 'user-template:svg-entity',
      name: 'SVG entity',
      page: imagePage(imported.asset.id),
      assetLibrary: imported.library,
      createdAt: '2026-08-14T00:10:00.000Z',
    });
    saveUserPageTemplate(storage, template);

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.warnings).toEqual([]);
    expect(loaded.templates).toHaveLength(1);
    expect(loaded.templates[0]?.assets[0]?.dataUrl).toBe(template.assets[0]?.dataUrl);
  });

  it('改ざんされた同梱Assetだけを含むテンプレートを読み込み時に除外する', () => {
    const storage = new MemoryStorage();
    const sourceLibrary = assetLibrary();
    const template = createUserPageTemplate({
      templateId: 'user-template:tampered-asset',
      name: '改ざん検証',
      page: imagePage(sourceLibrary.assets[0]!.id),
      assetLibrary: sourceLibrary,
      createdAt: '2026-08-14T00:10:00.000Z',
    });
    saveUserPageTemplate(storage, template);

    const document = JSON.parse(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY) ?? '{}') as {
      templates: Array<{ assets: Array<{ dataUrl: string }> }>;
    };
    const dataUrl = document.templates[0]!.assets[0]!.dataUrl;
    document.templates[0]!.assets[0]!.dataUrl = `${dataUrl.slice(0, -4)}AAAA`;
    storage.setItem(USER_PAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(document));

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.templates).toEqual([]);
    expect(loaded.warnings).toContain('読み込めないマイテンプレートを1件除外しました。');
  });

  it('壊れた旧v1ストアは原本を保持し、v2の安全な空状態へ復旧する', () => {
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

  it('旧v1ストアをAssetなしv2テンプレートとしてコピー移行し、旧データを保持する', () => {
    const storage = new MemoryStorage();
    const current = createUserPageTemplate({
      templateId: 'user-template:legacy',
      name: '旧テンプレート',
      page: emptyPage(),
      createdAt: '2026-08-14T00:00:00.000Z',
    });
    const legacyTemplate = { ...current } as Record<string, unknown>;
    delete legacyTemplate.assets;
    const legacyRaw = JSON.stringify({
      schemaVersion: 1,
      templates: [legacyTemplate],
      lastDeletedTemplate: null,
    });
    storage.setItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY, legacyRaw);

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.templates).toHaveLength(1);
    expect(loaded.templates[0]?.assets).toEqual([]);
    expect(storage.getItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY)).toBe(legacyRaw);
    expect(storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY)).not.toBeNull();
  });
});
