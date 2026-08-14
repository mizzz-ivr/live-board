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

export const USER_PAGE_TEMPLATE_ASSET_MAX_BYTES = 1024 * 1024;
export const USER_PAGE_TEMPLATE_ASSET_MAX_COUNT = 100;

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

export function validateUserPageTemplateAssets(value: unknown): ProjectAsset[] {
  if (!Array.isArray(value)) throw new Error('INVALID_TEMPLATE_ASSETS');
  if (value.length > USER_PAGE_TEMPLATE_ASSET_MAX_COUNT) {
    throw new Error('マイテンプレートに含められるAsset数を超えています。');
  }

  let library = createProjectAssetLibrary();
  const seenSha256 = new Set<string>();

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
    const dataUrl = requiredString(candidate.dataUrl);
    const fileNames = validateFileNames(candidate.fileNames);
    if (candidate.animated !== false || typeof candidate.sanitized !== 'boolean') {
      throw new Error('INVALID_TEMPLATE_ASSET_METADATA');
    }
    const createdAt = requiredString(candidate.createdAt);
    const bytes = decodeDataUrl(dataUrl, mime);
    if (bytes.byteLength !== byteLength) throw new Error('INVALID_TEMPLATE_ASSET_BYTES');

    let result = importProjectAsset(library, {
      fileName: fileNames[0]!,
      declaredMime: mime,
      bytes,
      createdAt,
    });
    for (const fileName of fileNames.slice(1)) {
      result = importProjectAsset(result.library, {
        fileName,
        declaredMime: mime,
        bytes,
        createdAt,
      });
    }

    const canonical = result.asset;
    if (
      canonical.id !== id
      || canonical.sha256 !== sha256
      || canonical.mime !== mime
      || canonical.width !== width
      || canonical.height !== height
      || canonical.byteLength !== byteLength
      || canonical.dataUrl !== dataUrl
      || canonical.sanitized !== candidate.sanitized
    ) {
      throw new Error('INVALID_TEMPLATE_ASSET_INTEGRITY');
    }
    library = result.library;
  }

  assertAssetLimits(library.assets.length, library.totalBytes);
  return library.assets.map(cloneAsset);
}

export function assertUserPageTemplateAssetReferences(
  page: Page,
  assets: readonly ProjectAsset[],
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

export function mergeUserPageTemplateAssets(
  targetLibrary: ProjectAssetLibrary,
  assets: readonly ProjectAsset[],
): ProjectAssetLibrary {
  const validated = validateUserPageTemplateAssets(assets);
  let nextLibrary = targetLibrary;

  for (const asset of validated) {
    const bytes = decodeDataUrl(asset.dataUrl, asset.mime);
    let result = importProjectAsset(nextLibrary, {
      fileName: asset.fileNames[0]!,
      declaredMime: asset.mime,
      bytes,
      createdAt: asset.createdAt,
    });
    for (const fileName of asset.fileNames.slice(1)) {
      result = importProjectAsset(result.library, {
        fileName,
        declaredMime: asset.mime,
        bytes,
        createdAt: asset.createdAt,
      });
    }
    if (result.asset.id !== asset.id || result.asset.sha256 !== asset.sha256) {
      throw new Error('Assetの再検証結果がテンプレートと一致しません。');
    }
    nextLibrary = result.library;
  }

  return nextLibrary;
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
