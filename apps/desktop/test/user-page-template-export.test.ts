import { describe, expect, it } from 'vitest';
import {
  assertLayerDocumentIntegrity,
  createLayer,
  createPage,
  createProjectAssetLibrary,
  importProjectAsset,
  type LayerDocument,
  type Page,
} from '@live-board/domain';
import {
  createUserPageTemplateExportFile,
  createUserPageTemplateExportFileName,
  USER_PAGE_TEMPLATE_EXPORT_KIND,
  USER_PAGE_TEMPLATE_EXPORT_MAGIC,
  USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION,
} from '../src/user-page-template-export';
import {
  persistUserPageTemplateAssetPayloads,
} from '../src/user-page-template-assets';
import type {
  UserPageTemplateAssetPayload,
  UserPageTemplateAssetPayloadStore,
} from '../src/user-page-template-asset-payload-store';
import { createUserPageTemplate } from '../src/user-page-templates';

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

function parseBundle(bytes: Uint8Array): {
  manifest: Record<string, unknown>;
  payloadBytes: Uint8Array;
} {
  const magicBytes = new TextEncoder().encode(USER_PAGE_TEMPLATE_EXPORT_MAGIC);
  expect(bytes.slice(0, magicBytes.byteLength)).toEqual(magicBytes);
  const manifestLength = new DataView(
    bytes.buffer,
    bytes.byteOffset + magicBytes.byteLength,
    4,
  ).getUint32(0, true);
  const manifestStart = magicBytes.byteLength + 4;
  const manifestEnd = manifestStart + manifestLength;
  const manifest = JSON.parse(
    new TextDecoder().decode(bytes.slice(manifestStart, manifestEnd)),
  ) as Record<string, unknown>;
  return {
    manifest,
    payloadBytes: bytes.slice(manifestEnd),
  };
}

describe('マイPageテンプレートExport', () => {
  it('Assetなしテンプレートをversion付きbundleとして書き出す', async () => {
    const template = createUserPageTemplate({
      templateId: 'user-template:empty-export',
      name: '配信テンプレート',
      page: createPage({
        id: 'page-1',
        projectId: 'project-1',
        name: '配信テンプレート',
      }),
      createdAt: '2026-08-17T00:00:00.000Z',
    });

    const file = await createUserPageTemplateExportFile({
      template,
      assetPayloadStore: new MemoryPayloadStore(),
      exportedAt: '2026-08-17T01:00:00.000Z',
    });
    const parsed = parseBundle(file.bytes);

    expect(file.fileName).toBe('配信テンプレート.liveboard-template');
    expect(parsed.manifest.kind).toBe(USER_PAGE_TEMPLATE_EXPORT_KIND);
    expect(parsed.manifest.schemaVersion).toBe(USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION);
    expect(parsed.manifest.exportedAt).toBe('2026-08-17T01:00:00.000Z');
    expect(parsed.manifest.assetPayloads).toEqual([]);
    expect(parsed.payloadBytes).toHaveLength(0);
  });

  it('Asset binaryをBase64化せずraw bytesとしてmanifest後方へ同梱する', async () => {
    const payloadStore = new MemoryPayloadStore();
    const imported = importProjectAsset(createProjectAssetLibrary(), {
      fileName: 'logo.png',
      declaredMime: 'image/png',
      bytes: pngBytes(),
      createdAt: '2026-08-17T00:00:00.000Z',
    });
    const template = createUserPageTemplate({
      templateId: 'user-template:asset-export',
      name: 'ロゴ付き',
      page: imagePage(imported.asset.id),
      assetLibrary: imported.library,
      createdAt: '2026-08-17T00:10:00.000Z',
    });
    await persistUserPageTemplateAssetPayloads(imported.library.assets, payloadStore);

    const file = await createUserPageTemplateExportFile({
      template,
      assetPayloadStore: payloadStore,
      exportedAt: '2026-08-17T01:00:00.000Z',
    });
    const parsed = parseBundle(file.bytes);
    const manifestJson = JSON.stringify(parsed.manifest);
    const assetPayloads = parsed.manifest.assetPayloads as Array<Record<string, unknown>>;

    expect(manifestJson).not.toContain('data:image/');
    expect(manifestJson).not.toContain(TINY_PNG_BASE64);
    expect(assetPayloads).toEqual([
      {
        assetId: imported.asset.id,
        offset: 0,
        byteLength: imported.asset.byteLength,
      },
    ]);
    expect(parsed.payloadBytes).toEqual(pngBytes());
  });

  it('Asset binaryが欠損している場合はファイル生成前に拒否する', async () => {
    const imported = importProjectAsset(createProjectAssetLibrary(), {
      fileName: 'logo.png',
      declaredMime: 'image/png',
      bytes: pngBytes(),
      createdAt: '2026-08-17T00:00:00.000Z',
    });
    const template = createUserPageTemplate({
      templateId: 'user-template:missing-export',
      name: '欠損',
      page: imagePage(imported.asset.id),
      assetLibrary: imported.library,
      createdAt: '2026-08-17T00:10:00.000Z',
    });

    await expect(createUserPageTemplateExportFile({
      template,
      assetPayloadStore: new MemoryPayloadStore(),
      exportedAt: '2026-08-17T01:00:00.000Z',
    })).rejects.toThrow('Assetバイナリが見つかりません');
  });

  it('改ざんされたAsset binaryを既存Runtime Validationで拒否する', async () => {
    const payloadStore = new MemoryPayloadStore();
    const imported = importProjectAsset(createProjectAssetLibrary(), {
      fileName: 'logo.png',
      declaredMime: 'image/png',
      bytes: pngBytes(),
      createdAt: '2026-08-17T00:00:00.000Z',
    });
    const template = createUserPageTemplate({
      templateId: 'user-template:tampered-export',
      name: '改ざん',
      page: imagePage(imported.asset.id),
      assetLibrary: imported.library,
      createdAt: '2026-08-17T00:10:00.000Z',
    });
    await persistUserPageTemplateAssetPayloads(imported.library.assets, payloadStore);
    payloadStore.overwrite(imported.asset.id, new Uint8Array(imported.asset.byteLength).fill(1));

    await expect(createUserPageTemplateExportFile({
      template,
      assetPayloadStore: payloadStore,
      exportedAt: '2026-08-17T01:00:00.000Z',
    })).rejects.toThrow();
  });

  it('Windowsで扱えないファイル名文字と予約名を安全化する', () => {
    expect(createUserPageTemplateExportFileName('配信:本番/01')).toBe(
      '配信_本番_01.liveboard-template',
    );
    expect(createUserPageTemplateExportFileName('CON')).toBe('_CON.liveboard-template');
    expect(createUserPageTemplateExportFileName('...')).toBe('page-template.liveboard-template');
  });
});
