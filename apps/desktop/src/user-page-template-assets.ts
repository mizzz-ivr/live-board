import {
  createProjectAssetLibrary,
  findProjectAsset,
  getLayerDocument,
  importProjectAsset,
  type Page,
  type ProjectAsset,
  type ProjectAssetLibrary,
  type ProjectAssetMime,
} from '@live-board/domain';
import type {
  UserPageTemplateAssetPayloadStore,
} from './user-page-template-asset-payload-store';

export const USER_PAGE_TEMPLATE_ASSET_MAX_BYTES = 1024 * 1024;
export const USER_PAGE_TEMPLATE_ASSET_MAX_COUNT = 100;

export interface UserPageTemplateAssetMetadata {
  readonly id: string;
  readonly sha256: string;
  readonly mime: ProjectAssetMime;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly fileNames: readonly string[];
  readonly animated: false;
  readonly sanitized: boolean;
  readonly createdAt: string;
}

const SUPPORTED_MIMES = new Set<ProjectAssetMime>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export function collectUserPageTemplateAssets(
  page: Page,
  library: ProjectAssetLibrary,
): ProjectAsset[] {
  const referencedIds = referencedAssetIds(page);
  const assets: ProjectAsset[] = [];
  let totalBytes = 0;

  for (const assetId of referencedIds) {
    const asset = findProjectAsset(library, assetId);
    if (asset === null) {
      throw new Error(`Pageが参照するAssetが見つかりません: ${assetId}`);
    }
    assets.push(asset);
    totalBytes += asset.byteLength;
  }

  assertAssetLimits(assets.length, totalBytes);
  return assets.map(cloneAsset);
}

export function toUserPageTemplateAssetMetadata(
  assets: readonly ProjectAsset[],
): UserPageTemplateAssetMetadata[] {
  assertAssetLimits(
    assets.length,
    assets.reduce((total, asset) => total + asset.byteLength, 0),
  );
  return assets.map((asset) => ({
    id: asset.id,
    sha256: asset.sha256,
    mime: asset.mime,
    width: asset.width,
    height: asset.height,
    byteLength: asset.byteLength,
    fileNames: [...asset.fileNames],
    animated: false,
    sanitized: asset.sanitized,
    createdAt: asset.createdAt,
  }));
}

export function validateUserPageTemplateAssets(
  value: unknown,
): UserPageTemplateAssetMetadata[] {
  if (!Array.isArray(value)) throw new Error('INVALID_TEMPLATE_ASSETS');
  if (value.length > USER_PAGE_TEMPLATE_ASSET_MAX_COUNT) {
    throw new Error('マイテンプレートに含められるAsset数を超えています。');
  }

  const result: UserPageTemplateAssetMetadata[] = [];
  const seenSha256 = new Set<string>();
  let totalBytes = 0;

  for (const candidate of value) {
    if (!isRecord(candidate)) throw new Error('INVALID_TEMPLATE_ASSET');
    const id = requiredString(candidate.id);
    const sha256 = requiredString(candidate.sha256).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha256) || id !== `asset:${sha256}`) {
      throw new Error('INVALID_TEMPLATE_ASSET_ID');
    }
    if (seenSha256.has(sha256)) throw new Error('DUPLICATE_TEMPLATE_ASSET');
    seenSha256.add(sha256);

    const mime = validateMime(candidate.mime);
    const width = requiredPositiveNumber(candidate.width);
    const height = requiredPositiveNumber(candidate.height);
    const byteLength = requiredPositiveInteger(candidate.byteLength);
    const fileNames = validateFileNames(candidate.fileNames);
    if (candidate.animated !== false || typeof candidate.sanitized !== 'boolean') {
      throw new Error('INVALID_TEMPLATE_ASSET_METADATA');
    }
    const createdAt = requiredString(candidate.createdAt);
    totalBytes += byteLength;
    result.push({
      id,
      sha256,
      mime,
      width,
      height,
      byteLength,
      fileNames,
      animated: false,
      sanitized: candidate.sanitized,
      createdAt,
    });
  }

  assertAssetLimits(result.length, totalBytes);
  return result;
}

export async function persistUserPageTemplateAssetPayloads(
  assets: readonly ProjectAsset[],
  payloadStore: UserPageTemplateAssetPayloadStore,
): Promise<void> {
  if (assets.length === 0) return;
  const validated = assets.map((asset) => validateProjectAssetForPayload(asset));
  await payloadStore.putMany(
    validated.map((asset) => ({
      assetId: asset.id,
      bytes: decodeDataUrl(asset.dataUrl, asset.mime),
    })),
  );
}

export async function hydrateUserPageTemplateAssets(
  metadata: readonly UserPageTemplateAssetMetadata[],
  payloadStore: UserPageTemplateAssetPayloadStore,
): Promise<ProjectAsset[]> {
  const validatedMetadata = validateUserPageTemplateAssets(metadata);
  let library = createProjectAssetLibrary();

  for (const item of validatedMetadata) {
    const bytes = await payloadStore.get(item.id);
    if (bytes === null) {
      throw new Error(`マイテンプレートのAssetバイナリが見つかりません: ${item.id}`);
    }
    if (bytes.byteLength !== item.byteLength) {
      throw new Error(`マイテンプレートのAssetサイズが一致しません: ${item.id}`);
    }

    let imported = importProjectAsset(library, {
      fileName: item.fileNames[0]!,
      declaredMime: item.mime,
      bytes,
      createdAt: item.createdAt,
    });
    for (const fileName of item.fileNames.slice(1)) {
      imported = importProjectAsset(imported.library, {
        fileName,
        declaredMime: item.mime,
        bytes,
        createdAt: item.createdAt,
      });
    }

    const canonical = imported.asset;
    if (
      canonical.id !== item.id
      || canonical.sha256 !== item.sha256
      || canonical.mime !== item.mime
      || canonical.width !== item.width
      || canonical.height !== item.height
      || canonical.byteLength !== item.byteLength
      || canonical.sanitized !== item.sanitized
      || canonical.dataUrl !== encodeDataUrl(bytes, item.mime)
    ) {
      throw new Error(`マイテンプレートAssetの整合性検証に失敗しました: ${item.id}`);
    }
    library = imported.library;
  }

  assertAssetLimits(library.assets.length, library.totalBytes);
  return library.assets.map(cloneAsset);
}

export async function validateUserPageTemplateAssetPayloads(
  metadata: readonly UserPageTemplateAssetMetadata[],
  payloadStore: UserPageTemplateAssetPayloadStore,
): Promise<void> {
  await hydrateUserPageTemplateAssets(metadata, payloadStore);
}

export function assertUserPageTemplateAssetReferences(
  page: Page,
  assets: readonly UserPageTemplateAssetMetadata[],
): void {
  const referencedIds = referencedAssetIds(page);
  const assetIds = new Set(assets.map((asset) => asset.id));

  for (const assetId of referencedIds) {
    if (!assetIds.has(assetId)) {
      throw new Error(`テンプレート内に参照Assetがありません: ${assetId}`);
    }
  }
  for (const assetId of assetIds) {
    if (!referencedIds.has(assetId)) {
      throw new Error(`Pageから参照されていないAssetが含まれています: ${assetId}`);
    }
  }
}

export async function mergeUserPageTemplateAssets(
  targetLibrary: ProjectAssetLibrary,
  metadata: readonly UserPageTemplateAssetMetadata[],
  payloadStore: UserPageTemplateAssetPayloadStore,
): Promise<ProjectAssetLibrary> {
  const assets = await hydrateUserPageTemplateAssets(metadata, payloadStore);
  let nextLibrary = targetLibrary;

  for (const asset of assets) {
    const bytes = decodeDataUrl(asset.dataUrl, asset.mime);
    let imported = importProjectAsset(nextLibrary, {
      fileName: asset.fileNames[0]!,
      declaredMime: asset.mime,
      bytes,
      createdAt: asset.createdAt,
    });
    for (const fileName of asset.fileNames.slice(1)) {
      imported = importProjectAsset(imported.library, {
        fileName,
        declaredMime: asset.mime,
        bytes,
        createdAt: asset.createdAt,
      });
    }
    if (imported.asset.id !== asset.id || imported.asset.sha256 !== asset.sha256) {
      throw new Error('Assetの再検証結果がテンプレートと一致しません。');
    }
    nextLibrary = imported.library;
  }

  return nextLibrary;
}

export async function garbageCollectUserPageTemplateAssetPayloads(
  payloadStore: UserPageTemplateAssetPayloadStore,
  referencedAssetIds: ReadonlySet<string>,
): Promise<void> {
  const storedIds = await payloadStore.listAssetIds();
  await payloadStore.deleteMany(
    storedIds.filter((assetId) => !referencedAssetIds.has(assetId)),
  );
}

export function collectUserPageTemplateAssetReferenceIds(
  templates: readonly { readonly assets: readonly UserPageTemplateAssetMetadata[] }[],
): Set<string> {
  return new Set(
    templates.flatMap((template) => template.assets.map((asset) => asset.id)),
  );
}

function referencedAssetIds(page: Page): Set<string> {
  const result = new Set<string>();
  for (const layer of getLayerDocument(page).layers) {
    if (
      (layer.type === 'image' || layer.type === 'raster')
      && layer.content.assetId !== null
    ) {
      result.add(layer.content.assetId);
    }
  }
  return result;
}

function validateProjectAssetForPayload(asset: ProjectAsset): ProjectAsset {
  const metadata = toUserPageTemplateAssetMetadata([asset])[0]!;
  const bytes = decodeDataUrl(asset.dataUrl, metadata.mime);
  if (bytes.byteLength !== metadata.byteLength) {
    throw new Error(`Assetバイナリサイズがmetadataと一致しません: ${asset.id}`);
  }
  return cloneAsset(asset);
}

function assertAssetLimits(count: number, totalBytes: number): void {
  if (count > USER_PAGE_TEMPLATE_ASSET_MAX_COUNT) {
    throw new Error(`マイテンプレートのAssetは最大${USER_PAGE_TEMPLATE_ASSET_MAX_COUNT}件です。`);
  }
  if (totalBytes > USER_PAGE_TEMPLATE_ASSET_MAX_BYTES) {
    throw new Error('マイテンプレートに同梱するAssetは合計1MiB以内にしてください。');
  }
}

function validateMime(value: unknown): ProjectAssetMime {
  if (typeof value !== 'string' || !SUPPORTED_MIMES.has(value as ProjectAssetMime)) {
    throw new Error('INVALID_TEMPLATE_ASSET_MIME');
  }
  return value as ProjectAssetMime;
}

function validateFileNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error('INVALID_TEMPLATE_ASSET_FILE_NAMES');
  }
  return value.map((entry) => {
    const name = requiredString(entry);
    if (name.length > 255) throw new Error('INVALID_TEMPLATE_ASSET_FILE_NAME');
    return name;
  });
}

function decodeDataUrl(dataUrl: string, mime: ProjectAssetMime): Uint8Array {
  const prefix = `data:${mime};base64,`;
  if (!dataUrl.startsWith(prefix)) throw new Error('INVALID_TEMPLATE_ASSET_DATA_URL');
  const payload = dataUrl.slice(prefix.length);
  if (payload.length < 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new Error('INVALID_TEMPLATE_ASSET_BASE64');
  }
  let decoded: string;
  try {
    decoded = globalThis.atob(payload);
  } catch {
    throw new Error('INVALID_TEMPLATE_ASSET_BASE64');
  }
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function encodeDataUrl(bytes: Uint8Array, mime: ProjectAssetMime): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${globalThis.btoa(binary)}`;
}

function cloneAsset(asset: ProjectAsset): ProjectAsset {
  return { ...asset, fileNames: [...asset.fileNames] };
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1) throw new Error('INVALID_STRING');
  return value;
}

function requiredPositiveNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('INVALID_POSITIVE_NUMBER');
  }
  return value;
}

function requiredPositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error('INVALID_POSITIVE_INTEGER');
  }
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
