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
  collectUserPageTemplateAssetReferenceIds,
  garbageCollectUserPageTemplateAssetPayloads,
  persistUserPageTemplateAssetPayloads,
} from '../src/user-page-template-assets';
import type {
  UserPageTemplateAssetPayload,
  UserPageTemplateAssetPayloadStore,
} from '../src/user-page-template-asset-payload-store';
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

class MemoryPayloadStore implements UserPageTemplateAssetPayloadStore {
  private readonly values = new Map<string, Uint8Array>();

  async get(assetId: string): Promise<Uint8Array | null> {
    const value = this.values.get(assetId);
    return value === undefined ? null : new Uint8Array(value);
  }

  async putMany(payloads: readonly UserPageTemplateAssetPayload[]): Promise<void> {
    for (const payload of payloads) {
      this.values.set(payload.assetId, new Uint8Array(payload.bytes));
    }
  }

  async listAssetIds(): Promise<string[]> {
    return [...this.values.keys()];
  }

  async deleteMany(assetIds: readonly string[]): Promise<void> {
    for (const assetId of assetIds) this.values.delete(assetId);
  }

  overwrite(assetId: string, bytes: Uint8Array): void {
    this.values.set(assetId, new Uint8Array(bytes));
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
  it('Asset binaryをJSONへ埋め込まず、別Project再利用時にSHA重複排除する', async () => {
    const storage = new MemoryStorage();
    const payloadStore = new MemoryPayloadStore();
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
    expect('dataUrl' in template.assets[0]!).toBe(false);

    await persistUserPageTemplateAssetPayloads(sourceLibrary.assets, payloadStore);
    saveUserPageTemplate(storage, template);
    const raw = storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY) ?? '';
    expect(raw).not.toContain('data:image/');
    expect(raw).not.toContain(TINY_PNG_BASE64);

    const first = await instantiateUserPageTemplateWithAssets({
      template,
      projectId: 'target-project',
      pageId: 'target-page-1',
      assetLibrary: createProjectAssetLibrary(),
      assetPayloadStore: payloadStore,
      createdAt: '2026-08-14T00:20:00.000Z',
      createLayerId: () => 'target-image-1',
    });
    expect(first.assetLibrary.assets).toHaveLength(1);
    const firstImage = first.page.layerDocument?.layers.find((layer) => layer.type === 'image');
    expect(firstImage?.type === 'image' ? firstImage.content.assetId : null).toBe(sourceAsset.id);

    const second = await instantiateUserPageTemplateWithAssets({
      template,
      projectId: 'target-project',
      pageId: 'target-page-2',
      assetLibrary: first.assetLibrary,
      assetPayloadStore: payloadStore,
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

  it('XML entityを含む安全なSVG Assetをbinary store経由で再検証できる', async () => {
    const storage = new MemoryStorage();
    const payloadStore = new MemoryPayloadStore();
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
    await persistUserPageTemplateAssetPayloads(imported.library.assets, payloadStore);
    saveUserPageTemplate(storage, template);

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.warnings).toEqual([]);
    expect(loaded.templates).toHaveLength(1);
    const instantiated = await instantiateUserPageTemplateWithAssets({
      template: loaded.templates[0]!,
      projectId: 'target-project',
      pageId: 'target-svg-page',
      assetLibrary: createProjectAssetLibrary(),
      assetPayloadStore: payloadStore,
      createdAt: '2026-08-14T01:00:00.000Z',
      createLayerId: () => 'target-svg-image',
    });
    expect(instantiated.assetLibrary.assets[0]?.id).toBe(imported.asset.id);
  });

  it('改ざんされたIndexedDB相当のAsset binaryを再利用時に拒否する', async () => {
    const storage = new MemoryStorage();
    const payloadStore = new MemoryPayloadStore();
    const sourceLibrary = assetLibrary();
    const sourceAsset = sourceLibrary.assets[0]!;
    const template = createUserPageTemplate({
      templateId: 'user-template:tampered-asset',
      name: '改ざん検証',
      page: imagePage(sourceAsset.id),
      assetLibrary: sourceLibrary,
      createdAt: '2026-08-14T00:10:00.000Z',
    });
    await persistUserPageTemplateAssetPayloads(sourceLibrary.assets, payloadStore);
    saveUserPageTemplate(storage, template);
    payloadStore.overwrite(sourceAsset.id, Uint8Array.from([1, 2, 3, 4]));

    await expect(instantiateUserPageTemplateWithAssets({
      template: loadUserPageTemplates(storage).templates[0]!,
      projectId: 'target-project',
      pageId: 'target-page',
      assetLibrary: createProjectAssetLibrary(),
      assetPayloadStore: payloadStore,
      createdAt: '2026-08-14T01:00:00.000Z',
      createLayerId: () => 'target-image',
    })).rejects.toThrow(/サイズ|整合性|画像/);
  });

  it('参照されなくなったbinaryだけをGCし、参照中Assetを保持する', async () => {
    const payloadStore = new MemoryPayloadStore();
    const sourceLibrary = assetLibrary();
    const sourceAsset = sourceLibrary.assets[0]!;
    await persistUserPageTemplateAssetPayloads(sourceLibrary.assets, payloadStore);
    const orphanId = `asset:${'0'.repeat(64)}`;
    await payloadStore.putMany([{ assetId: orphanId, bytes: Uint8Array.from([1]) }]);
    const template = createUserPageTemplate({
      templateId: 'user-template:gc',
      name: 'GC',
      page: imagePage(sourceAsset.id),
      assetLibrary: sourceLibrary,
      createdAt: '2026-08-14T00:10:00.000Z',
    });

    await garbageCollectUserPageTemplateAssetPayloads(
      payloadStore,
      collectUserPageTemplateAssetReferenceIds([template]),
    );
    expect(await payloadStore.listAssetIds()).toEqual([sourceAsset.id]);
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
