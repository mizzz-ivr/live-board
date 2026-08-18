import type { ProjectAssetLibrary } from '@live-board/domain';
import {
  collectUserPageTemplateAssetReferenceIds,
  garbageCollectUserPageTemplateAssetPayloads,
  hydrateUserPageTemplateAssets,
  persistUserPageTemplateAssetPayloads,
  type UserPageTemplateAssetMetadata,
} from './user-page-template-assets';
import type {
  UserPageTemplateAssetPayload,
  UserPageTemplateAssetPayloadStore,
} from './user-page-template-asset-payload-store';
import {
  USER_PAGE_TEMPLATE_EXPORT_KIND,
  USER_PAGE_TEMPLATE_EXPORT_MAGIC,
  USER_PAGE_TEMPLATE_EXPORT_MAX_BYTES,
  USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION,
} from './user-page-template-export';
import {
  USER_PAGE_TEMPLATE_SCHEMA_VERSION,
  USER_PAGE_TEMPLATE_STORAGE_KEY,
  createUserPageTemplate,
  loadUserPageTemplates,
  saveUserPageTemplate,
  type UserPageTemplate,
  type UserPageTemplateLoadResult,
  type UserPageTemplateStorage,
} from './user-page-templates';

const MANIFEST_LENGTH_BYTES = 4;
const MANIFEST_MAX_BYTES = 512 * 1024;

export interface UserPageTemplateImportFile {
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ValidatedUserPageTemplateImport {
  readonly sourceTemplate: UserPageTemplate;
  readonly assetLibrary: ProjectAssetLibrary;
  readonly exportedAt: string;
}

export interface PersistedUserPageTemplateImport {
  readonly template: UserPageTemplate;
  readonly result: UserPageTemplateLoadResult;
}

interface ImportAssetEntry {
  readonly assetId: string;
  readonly offset: number;
  readonly byteLength: number;
}

export async function readUserPageTemplateImportFile(
  file: UserPageTemplateImportFile,
): Promise<ValidatedUserPageTemplateImport> {
  if (!Number.isSafeInteger(file.size) || file.size < 1) {
    throw new Error('マイテンプレートImportファイルが空です。');
  }
  if (file.size > USER_PAGE_TEMPLATE_EXPORT_MAX_BYTES) {
    throw new Error('マイテンプレートImportファイルが2MiBを超えています。');
  }

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength !== file.size) {
    throw new Error('マイテンプレートImportファイルのサイズが読み込み前後で一致しません。');
  }
  return parseUserPageTemplateImportBytes(new Uint8Array(buffer));
}

export async function parseUserPageTemplateImportBytes(
  bytes: Uint8Array,
): Promise<ValidatedUserPageTemplateImport> {
  if (bytes.byteLength < 1) {
    throw new Error('マイテンプレートImportファイルが空です。');
  }
  if (bytes.byteLength > USER_PAGE_TEMPLATE_EXPORT_MAX_BYTES) {
    throw new Error('マイテンプレートImportファイルが2MiBを超えています。');
  }

  const magicBytes = new TextEncoder().encode(USER_PAGE_TEMPLATE_EXPORT_MAGIC);
  const headerBytes = magicBytes.byteLength + MANIFEST_LENGTH_BYTES;
  if (bytes.byteLength < headerBytes) {
    throw new Error('マイテンプレートImportファイルのヘッダーが不足しています。');
  }
  for (let index = 0; index < magicBytes.byteLength; index += 1) {
    if (bytes[index] !== magicBytes[index]) {
      throw new Error('マイテンプレートImportファイルの識別子が一致しません。');
    }
  }

  const manifestLength = new DataView(
    bytes.buffer,
    bytes.byteOffset + magicBytes.byteLength,
    MANIFEST_LENGTH_BYTES,
  ).getUint32(0, true);
  if (manifestLength < 1 || manifestLength > MANIFEST_MAX_BYTES) {
    throw new Error('マイテンプレートImportのmanifestサイズが不正です。');
  }

  const manifestStart = headerBytes;
  const manifestEnd = manifestStart + manifestLength;
  if (!Number.isSafeInteger(manifestEnd) || manifestEnd > bytes.byteLength) {
    throw new Error('マイテンプレートImportのmanifestがファイル境界を超えています。');
  }

  let manifestText: string;
  try {
    manifestText = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(manifestStart, manifestEnd),
    );
  } catch {
    throw new Error('マイテンプレートImportのmanifestがUTF-8ではありません。');
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error('マイテンプレートImportのmanifest JSONが壊れています。');
  }
  if (!isRecord(manifest)) {
    throw new Error('マイテンプレートImportのmanifest形式が不正です。');
  }
  if (manifest.kind !== USER_PAGE_TEMPLATE_EXPORT_KIND) {
    throw new Error('マイテンプレートImportのkindが一致しません。');
  }
  if (manifest.schemaVersion !== USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION) {
    throw new Error(
      typeof manifest.schemaVersion === 'number'
        ? `このアプリではschema version ${manifest.schemaVersion}のマイテンプレートImportを読み込めません。`
        : 'マイテンプレートImportのschema versionが不正です。',
    );
  }

  const exportedAt = requiredDateString(manifest.exportedAt, 'Export日時');
  const sourceTemplate = validateTemplateCandidate(manifest.template);
  const entries = validateAssetEntries(
    manifest.assetPayloads,
    sourceTemplate.assets,
    bytes.byteLength - manifestEnd,
  );

  const payloads = entries.map((entry) => ({
    assetId: entry.assetId,
    bytes: bytes.slice(
      manifestEnd + entry.offset,
      manifestEnd + entry.offset + entry.byteLength,
    ),
  }));
  const assets = await hydrateUserPageTemplateAssets(
    sourceTemplate.assets,
    new ReadOnlyPayloadStore(payloads),
  );
  const assetLibrary: ProjectAssetLibrary = {
    assets,
    totalBytes: assets.reduce((total, asset) => total + asset.byteLength, 0),
  };

  return { sourceTemplate, assetLibrary, exportedAt };
}

export function createLocalUserPageTemplateFromImport(input: {
  readonly imported: ValidatedUserPageTemplateImport;
  readonly templateId: string;
  readonly createdAt: string;
}): UserPageTemplate {
  return createUserPageTemplate({
    templateId: input.templateId,
    name: input.imported.sourceTemplate.name,
    page: input.imported.sourceTemplate.page,
    assetLibrary: input.imported.assetLibrary,
    createdAt: input.createdAt,
  });
}

export async function persistValidatedUserPageTemplateImport(input: {
  readonly imported: ValidatedUserPageTemplateImport;
  readonly storage: UserPageTemplateStorage;
  readonly assetPayloadStore: UserPageTemplateAssetPayloadStore;
  readonly templateId: string;
  readonly createdAt: string;
}): Promise<PersistedUserPageTemplateImport> {
  const template = createLocalUserPageTemplateFromImport({
    imported: input.imported,
    templateId: input.templateId,
    createdAt: input.createdAt,
  });

  await persistUserPageTemplateAssetPayloads(
    input.imported.assetLibrary.assets,
    input.assetPayloadStore,
  );

  try {
    return {
      template,
      result: saveUserPageTemplate(input.storage, template),
    };
  } catch (error: unknown) {
    await garbageCollectImportPayloadsBestEffort(input.storage, input.assetPayloadStore);
    throw error;
  }
}

function validateTemplateCandidate(value: unknown): UserPageTemplate {
  const storage = new TemplateValidationStorage(value);
  const result = loadUserPageTemplates(storage);
  if (result.templates.length !== 1 || result.warnings.length !== 0) {
    throw new Error('マイテンプレートImportに不正なtemplate metadataが含まれています。');
  }
  return result.templates[0]!;
}

function validateAssetEntries(
  value: unknown,
  metadata: readonly UserPageTemplateAssetMetadata[],
  payloadRegionLength: number,
): ImportAssetEntry[] {
  if (!Array.isArray(value) || value.length !== metadata.length) {
    throw new Error('マイテンプレートImportのAsset payload件数が一致しません。');
  }

  const metadataById = new Map(metadata.map((asset) => [asset.id, asset]));
  const seenIds = new Set<string>();
  const entries: ImportAssetEntry[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      throw new Error('マイテンプレートImportのAsset payload情報が不正です。');
    }
    const assetId = requiredString(candidate.assetId, 'Asset ID');
    if (seenIds.has(assetId)) {
      throw new Error(`マイテンプレートImportに重複したAsset IDがあります: ${assetId}`);
    }
    seenIds.add(assetId);
    const asset = metadataById.get(assetId);
    if (asset === undefined) {
      throw new Error(`マイテンプレートImportに未知のAsset payloadがあります: ${assetId}`);
    }

    const offset = requiredNonNegativeSafeInteger(candidate.offset, 'Asset offset');
    const byteLength = requiredPositiveSafeInteger(candidate.byteLength, 'Asset byteLength');
    if (byteLength !== asset.byteLength) {
      throw new Error(`マイテンプレートImportのAssetサイズがmetadataと一致しません: ${assetId}`);
    }
    if (byteLength > payloadRegionLength || offset > payloadRegionLength - byteLength) {
      throw new Error(`マイテンプレートImportのAsset payloadがファイル境界を超えています: ${assetId}`);
    }
    entries.push({ assetId, offset, byteLength });
  }

  for (const asset of metadata) {
    if (!seenIds.has(asset.id)) {
      throw new Error(`マイテンプレートImportにAsset payloadがありません: ${asset.id}`);
    }
  }

  const ordered = [...entries].sort((left, right) => left.offset - right.offset);
  let expectedOffset = 0;
  for (const entry of ordered) {
    if (entry.offset !== expectedOffset) {
      throw new Error('マイテンプレートImportのAsset payload範囲に重複または未参照領域があります。');
    }
    expectedOffset += entry.byteLength;
  }
  if (expectedOffset !== payloadRegionLength) {
    throw new Error('マイテンプレートImportに未参照のbinary payloadが含まれています。');
  }

  return entries;
}

async function garbageCollectImportPayloadsBestEffort(
  storage: UserPageTemplateStorage,
  payloadStore: UserPageTemplateAssetPayloadStore,
): Promise<void> {
  try {
    const current = loadUserPageTemplates(storage);
    const referenced = collectUserPageTemplateAssetReferenceIds([
      ...current.templates,
      ...(current.lastDeletedTemplate === null ? [] : [current.lastDeletedTemplate]),
    ]);
    await garbageCollectUserPageTemplateAssetPayloads(payloadStore, referenced);
  } catch {
    // 未知schemaやstorage障害時は既存参照を推測してbinaryを削除しない。
  }
}

class ReadOnlyPayloadStore implements UserPageTemplateAssetPayloadStore {
  private readonly payloads: ReadonlyMap<string, Uint8Array>;

  constructor(payloads: readonly UserPageTemplateAssetPayload[]) {
    this.payloads = new Map(
      payloads.map((payload) => [payload.assetId, new Uint8Array(payload.bytes)]),
    );
  }

  async get(assetId: string): Promise<Uint8Array | null> {
    const bytes = this.payloads.get(assetId);
    return bytes === undefined ? null : new Uint8Array(bytes);
  }

  async putMany(): Promise<void> {
    throw new Error('Import検証用Payload Storeは読み取り専用です。');
  }

  async listAssetIds(): Promise<string[]> {
    return [...this.payloads.keys()];
  }

  async deleteMany(): Promise<void> {
    throw new Error('Import検証用Payload Storeは読み取り専用です。');
  }
}

class TemplateValidationStorage implements UserPageTemplateStorage {
  private value: string | null;

  constructor(candidate: unknown) {
    this.value = JSON.stringify({
      schemaVersion: USER_PAGE_TEMPLATE_SCHEMA_VERSION,
      templates: [candidate],
      lastDeletedTemplate: null,
    });
  }

  getItem(key: string): string | null {
    return key === USER_PAGE_TEMPLATE_STORAGE_KEY ? this.value : null;
  }

  setItem(key: string, value: string): void {
    if (key === USER_PAGE_TEMPLATE_STORAGE_KEY) this.value = value;
  }

  removeItem(key: string): void {
    if (key === USER_PAGE_TEMPLATE_STORAGE_KEY) this.value = null;
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length < 1) {
    throw new Error(`マイテンプレートImportの${label}が不正です。`);
  }
  return value;
}

function requiredDateString(value: unknown, label: string): string {
  const text = requiredString(value, label);
  if (Number.isNaN(Date.parse(text))) {
    throw new Error(`マイテンプレートImportの${label}が不正です。`);
  }
  return text;
}

function requiredNonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`マイテンプレートImportの${label}が不正です。`);
  }
  return value;
}

function requiredPositiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`マイテンプレートImportの${label}が不正です。`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
