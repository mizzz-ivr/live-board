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
  createUserPageTemplateExportFile,
  USER_PAGE_TEMPLATE_EXPORT_KIND,
  USER_PAGE_TEMPLATE_EXPORT_MAGIC,
  USER_PAGE_TEMPLATE_EXPORT_MAX_BYTES,
  USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION,
} from '../src/user-page-template-export';
import {
  createLocalUserPageTemplateFromImport,
  parseUserPageTemplateImportBytes,
  persistValidatedUserPageTemplateImport,
  readUserPageTemplateImportFile,
} from '../src/user-page-template-import';
import { persistUserPageTemplateAssetPayloads } from '../src/user-page-template-assets';
import type {
  UserPageTemplateAssetPayload,
  UserPageTemplateAssetPayloadStore,
} from '../src/user-page-template-asset-payload-store';
import {
  createUserPageTemplate,
  loadUserPageTemplates,
  saveUserPageTemplate,
  type UserPageTemplateStorage,
} from '../src/user-page-templates';

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
}

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

function svgBytes(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#000"/></svg>',
  );
}

function imagePage(assetIds: readonly string[]): Page {
  const pageId = 'asset-page';
  const layers = assetIds.map((assetId, index) => createLayer({
    id: `image-layer-${index + 1}`,
    pageId,
    name: `画像 ${index + 1}`,
    type: 'image',
    content: { assetId, width: index + 1, height: index + 1 },
  }));
  const layerDocument: LayerDocument = {
    layers,
    rootLayerIds: layers.map((layer) => layer.id),
    activeLayerId: layers[0]?.id ?? null,
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

function assetLibrary(count = 1): ProjectAssetLibrary {
  let library = createProjectAssetLibrary();
  library = importProjectAsset(library, {
    fileName: 'logo.png',
    declaredMime: 'image/png',
    bytes: pngBytes(),
    createdAt: '2026-08-18T00:00:00.000Z',
  }).library;
  if (count > 1) {
    library = importProjectAsset(library, {
      fileName: 'mark.svg',
      declaredMime: 'image/svg+xml',
      bytes: svgBytes(),
      createdAt: '2026-08-18T00:01:00.000Z',
    }).library;
  }
  return library;
}

function buildBundle(manifest: unknown, payload = new Uint8Array()): Uint8Array {
  const magic = new TextEncoder().encode(USER_PAGE_TEMPLATE_EXPORT_MAGIC);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const bytes = new Uint8Array(magic.byteLength + 4 + manifestBytes.byteLength + payload.byteLength);
  bytes.set(magic, 0);
  new DataView(bytes.buffer).setUint32(magic.byteLength, manifestBytes.byteLength, true);
  bytes.set(manifestBytes, magic.byteLength + 4);
  bytes.set(payload, magic.byteLength + 4 + manifestBytes.byteLength);
  return bytes;
}

function parseBundle(bytes: Uint8Array): {
  manifest: Record<string, unknown>;
  payload: Uint8Array;
} {
  const magic = new TextEncoder().encode(USER_PAGE_TEMPLATE_EXPORT_MAGIC);
  const manifestLength = new DataView(
    bytes.buffer,
    bytes.byteOffset + magic.byteLength,
    4,
  ).getUint32(0, true);
  const manifestStart = magic.byteLength + 4;
  const manifestEnd = manifestStart + manifestLength;
  return {
    manifest: JSON.parse(
      new TextDecoder().decode(bytes.slice(manifestStart, manifestEnd)),
    ) as Record<string, unknown>,
    payload: bytes.slice(manifestEnd),
  };
}

async function createAssetExport(count = 1) {
  const library = assetLibrary(count);
  const payloadStore = new MemoryPayloadStore();
  await persistUserPageTemplateAssetPayloads(library.assets, payloadStore);
  const template = createUserPageTemplate({
    templateId: 'user-template:source-import',
    name: '持ち運びテンプレート',
    page: imagePage(library.assets.map((asset) => asset.id)),
    assetLibrary: library,
    createdAt: '2026-08-18T00:10:00.000Z',
  });
  const file = await createUserPageTemplateExportFile({
    template,
    assetPayloadStore: payloadStore,
    exportedAt: '2026-08-18T00:20:00.000Z',
  });
  return { file, template, library };
}

describe('マイPageテンプレートImport', () => {
  it('AssetなしExportを読み込み、外部IDを使わずローカルsnapshotを再生成する', async () => {
    const source = createUserPageTemplate({
      templateId: 'user-template:external-id',
      name: 'Assetなし',
      page: createPage({
        id: 'external-page',
        projectId: 'external-project',
        name: 'Assetなし',
      }),
      createdAt: '2026-08-18T00:00:00.000Z',
    });
    const exported = await createUserPageTemplateExportFile({
      template: source,
      assetPayloadStore: new MemoryPayloadStore(),
      exportedAt: '2026-08-18T00:30:00.000Z',
    });

    const imported = await parseUserPageTemplateImportBytes(exported.bytes);
    const local = createLocalUserPageTemplateFromImport({
      imported,
      templateId: 'user-template:local-id',
      createdAt: '2026-08-18T00:40:00.000Z',
    });

    expect(imported.sourceTemplate.id).toBe(source.id);
    expect(local.id).toBe('user-template:local-id');
    expect(local.id).not.toBe(imported.sourceTemplate.id);
    expect(local.page.id).not.toBe(imported.sourceTemplate.page.id);
    expect(local.page.projectId).not.toBe(imported.sourceTemplate.page.projectId);
    expect(local.name).toBe(source.name);
    expect(local.assets).toEqual([]);
  });

  it('Asset付きExportのraw binaryを既存Runtime Validationで再検証して復元する', async () => {
    const { file, library } = await createAssetExport();
    const imported = await parseUserPageTemplateImportBytes(file.bytes);

    expect(imported.assetLibrary.assets).toHaveLength(1);
    expect(imported.assetLibrary.assets[0]?.id).toBe(library.assets[0]?.id);
    expect(imported.assetLibrary.assets[0]?.sha256).toBe(library.assets[0]?.sha256);
    expect(imported.assetLibrary.totalBytes).toBe(library.totalBytes);
  });

  it('2MiB超過ファイルはarrayBufferを読む前に拒否する', async () => {
    let read = false;
    await expect(readUserPageTemplateImportFile({
      size: USER_PAGE_TEMPLATE_EXPORT_MAX_BYTES + 1,
      async arrayBuffer() {
        read = true;
        return new ArrayBuffer(0);
      },
    })).rejects.toThrow('2MiB');
    expect(read).toBe(false);
  });

  it('magic不一致・未知schema・壊れたJSONを拒否する', async () => {
    const magicMismatch = buildBundle({
      kind: USER_PAGE_TEMPLATE_EXPORT_KIND,
      schemaVersion: USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION,
    });
    magicMismatch[0] = 0;
    await expect(parseUserPageTemplateImportBytes(magicMismatch)).rejects.toThrow('識別子');

    await expect(parseUserPageTemplateImportBytes(buildBundle({
      kind: USER_PAGE_TEMPLATE_EXPORT_KIND,
      schemaVersion: 999,
      exportedAt: '2026-08-18T00:00:00.000Z',
      template: {},
      assetPayloads: [],
    }))).rejects.toThrow('schema version 999');

    const magic = new TextEncoder().encode(USER_PAGE_TEMPLATE_EXPORT_MAGIC);
    const invalidJson = new TextEncoder().encode('{broken');
    const broken = new Uint8Array(magic.byteLength + 4 + invalidJson.byteLength);
    broken.set(magic, 0);
    new DataView(broken.buffer).setUint32(magic.byteLength, invalidJson.byteLength, true);
    broken.set(invalidJson, magic.byteLength + 4);
    await expect(parseUserPageTemplateImportBytes(broken)).rejects.toThrow('JSON');
  });

  it('manifest境界外参照と未参照binaryを拒否する', async () => {
    const { file } = await createAssetExport();
    const parsed = parseBundle(file.bytes);
    const assetPayloads = parsed.manifest.assetPayloads as Array<Record<string, unknown>>;
    assetPayloads[0]!.offset = parsed.payload.byteLength;
    await expect(parseUserPageTemplateImportBytes(
      buildBundle(parsed.manifest, parsed.payload),
    )).rejects.toThrow('ファイル境界');

    const valid = parseBundle(file.bytes);
    const withTrailing = new Uint8Array(valid.payload.byteLength + 1);
    withTrailing.set(valid.payload);
    withTrailing[withTrailing.length - 1] = 255;
    await expect(parseUserPageTemplateImportBytes(
      buildBundle(valid.manifest, withTrailing),
    )).rejects.toThrow('未参照');
  });

  it('Asset payload rangeの重複を拒否する', async () => {
    const { file } = await createAssetExport(2);
    const parsed = parseBundle(file.bytes);
    const assetPayloads = parsed.manifest.assetPayloads as Array<Record<string, unknown>>;
    expect(assetPayloads).toHaveLength(2);
    assetPayloads[1]!.offset = 0;

    await expect(parseUserPageTemplateImportBytes(
      buildBundle(parsed.manifest, parsed.payload),
    )).rejects.toThrow('重複');
  });

  it('metadataと同じbyteLengthでも改ざんされたAsset binaryを拒否する', async () => {
    const { file } = await createAssetExport();
    const parsed = parseBundle(file.bytes);
    const tampered = new Uint8Array(parsed.payload.byteLength).fill(1);

    await expect(parseUserPageTemplateImportBytes(
      buildBundle(parsed.manifest, tampered),
    )).rejects.toThrow();
  });

  it('Asset payload集合がmetadataと完全一致しない場合を拒否する', async () => {
    const { file } = await createAssetExport();
    const parsed = parseBundle(file.bytes);
    parsed.manifest.assetPayloads = [];

    await expect(parseUserPageTemplateImportBytes(
      buildBundle(parsed.manifest, parsed.payload),
    )).rejects.toThrow('件数');
  });

  it('名前重複でmetadata保存に失敗した場合、既存templateを保持し未参照binaryを回収する', async () => {
    const { file, library } = await createAssetExport();
    const imported = await parseUserPageTemplateImportBytes(file.bytes);
    const storage = new MemoryStorage();
    const payloadStore = new MemoryPayloadStore();
    const existing = createUserPageTemplate({
      templateId: 'user-template:existing',
      name: imported.sourceTemplate.name,
      page: createPage({
        id: 'existing-page',
        projectId: 'existing-project',
        name: imported.sourceTemplate.name,
      }),
      createdAt: '2026-08-18T01:00:00.000Z',
    });
    saveUserPageTemplate(storage, existing);

    await expect(persistValidatedUserPageTemplateImport({
      imported,
      storage,
      assetPayloadStore: payloadStore,
      templateId: 'user-template:new-import',
      createdAt: '2026-08-18T01:10:00.000Z',
    })).rejects.toThrow('既に存在');

    const reloaded = loadUserPageTemplates(storage);
    expect(reloaded.templates).toHaveLength(1);
    expect(reloaded.templates[0]?.id).toBe(existing.id);
    expect(reloaded.templates[0]?.name).toBe(existing.name);
    expect(await payloadStore.listAssetIds()).toEqual([]);
    expect(library.assets).toHaveLength(1);
  });
});
