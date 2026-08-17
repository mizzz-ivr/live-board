import {
  assertLayerDocumentIntegrity,
  getLayerDocument,
} from '@live-board/domain';
import {
  assertUserPageTemplateAssetReferences,
  validateUserPageTemplateAssetPayloads,
  validateUserPageTemplateAssets,
} from './user-page-template-assets';
import type { UserPageTemplateAssetPayloadStore } from './user-page-template-asset-payload-store';
import type { UserPageTemplate } from './user-page-templates';

export const USER_PAGE_TEMPLATE_EXPORT_KIND = 'live-board-page-template' as const;
export const USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION = 1 as const;
export const USER_PAGE_TEMPLATE_EXPORT_EXTENSION = '.liveboard-template';
export const USER_PAGE_TEMPLATE_EXPORT_MIME = 'application/octet-stream';
export const USER_PAGE_TEMPLATE_EXPORT_MAGIC = 'LIVEBOARD_PAGE_TEMPLATE\0';
export const USER_PAGE_TEMPLATE_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

const MANIFEST_LENGTH_BYTES = 4;

export interface UserPageTemplateExportFile {
  readonly fileName: string;
  readonly mime: typeof USER_PAGE_TEMPLATE_EXPORT_MIME;
  readonly bytes: Uint8Array;
}

interface UserPageTemplateExportAssetEntry {
  readonly assetId: string;
  readonly offset: number;
  readonly byteLength: number;
}

interface UserPageTemplateExportManifest {
  readonly kind: typeof USER_PAGE_TEMPLATE_EXPORT_KIND;
  readonly schemaVersion: typeof USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly template: UserPageTemplate;
  readonly assetPayloads: readonly UserPageTemplateExportAssetEntry[];
}

export async function createUserPageTemplateExportFile(input: {
  readonly template: UserPageTemplate;
  readonly assetPayloadStore: UserPageTemplateAssetPayloadStore;
  readonly exportedAt: string;
}): Promise<UserPageTemplateExportFile> {
  assertExportedAt(input.exportedAt);
  assertLayerDocumentIntegrity(
    input.template.page.id,
    getLayerDocument(input.template.page),
  );

  const assets = validateUserPageTemplateAssets(input.template.assets);
  assertUserPageTemplateAssetReferences(input.template.page, assets);
  await validateUserPageTemplateAssetPayloads(assets, input.assetPayloadStore);

  const payloads: Uint8Array[] = [];
  const assetPayloads: UserPageTemplateExportAssetEntry[] = [];
  let payloadOffset = 0;

  for (const asset of assets) {
    const bytes = await input.assetPayloadStore.get(asset.id);
    if (bytes === null) {
      throw new Error(`マイテンプレートのAssetバイナリが見つかりません: ${asset.id}`);
    }
    if (bytes.byteLength !== asset.byteLength) {
      throw new Error(`マイテンプレートのAssetサイズが一致しません: ${asset.id}`);
    }

    const copy = new Uint8Array(bytes);
    payloads.push(copy);
    assetPayloads.push({
      assetId: asset.id,
      offset: payloadOffset,
      byteLength: copy.byteLength,
    });
    payloadOffset += copy.byteLength;
  }

  const template: UserPageTemplate = {
    ...input.template,
    preview: { ...input.template.preview },
    page: structuredClone(input.template.page),
    assets,
  };
  const manifest: UserPageTemplateExportManifest = {
    kind: USER_PAGE_TEMPLATE_EXPORT_KIND,
    schemaVersion: USER_PAGE_TEMPLATE_EXPORT_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    template,
    assetPayloads,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const magicBytes = new TextEncoder().encode(USER_PAGE_TEMPLATE_EXPORT_MAGIC);
  const totalBytes =
    magicBytes.byteLength
    + MANIFEST_LENGTH_BYTES
    + manifestBytes.byteLength
    + payloadOffset;

  if (manifestBytes.byteLength > 512 * 1024) {
    throw new Error('マイテンプレートExportのmanifestが512KiBを超えています。');
  }
  if (totalBytes > USER_PAGE_TEMPLATE_EXPORT_MAX_BYTES) {
    throw new Error('マイテンプレートExportファイルが2MiBを超えています。');
  }

  const bytes = new Uint8Array(totalBytes);
  let cursor = 0;
  bytes.set(magicBytes, cursor);
  cursor += magicBytes.byteLength;
  new DataView(bytes.buffer).setUint32(cursor, manifestBytes.byteLength, true);
  cursor += MANIFEST_LENGTH_BYTES;
  bytes.set(manifestBytes, cursor);
  cursor += manifestBytes.byteLength;
  for (const payload of payloads) {
    bytes.set(payload, cursor);
    cursor += payload.byteLength;
  }

  return {
    fileName: createUserPageTemplateExportFileName(template.name),
    mime: USER_PAGE_TEMPLATE_EXPORT_MIME,
    bytes,
  };
}

export function createUserPageTemplateExportFileName(templateName: string): string {
  const normalized = templateName
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  const sliced = Array.from(normalized).slice(0, 80).join('');
  const baseName = sliced.length === 0 ? 'page-template' : sliced;
  const safeBaseName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(baseName)
    ? `_${baseName}`
    : baseName;
  return `${safeBaseName}${USER_PAGE_TEMPLATE_EXPORT_EXTENSION}`;
}

export function downloadUserPageTemplateExportFile(
  file: UserPageTemplateExportFile,
): void {
  if (
    typeof document === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    throw new Error('この環境ではマイテンプレートを書き出せません。');
  }

  const rawBytes = file.bytes.buffer.slice(
    file.bytes.byteOffset,
    file.bytes.byteOffset + file.bytes.byteLength,
  );
  const blob = new Blob([rawBytes], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.hidden = true;
  document.body.append(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function assertExportedAt(value: string): void {
  if (value.length < 1 || Number.isNaN(Date.parse(value))) {
    throw new Error('不正なExport日時です。');
  }
}
