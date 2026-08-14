import {
  assertLayerDocumentIntegrity,
  assertLayerTransform,
  createPage,
  createProjectAssetLibrary,
  getLayerDocument,
  getRichImageContent,
  getRichShapeContent,
  getRichTextContent,
  type BackgroundLayer,
  type FolderLayer,
  type ImageLayer,
  type Layer,
  type LayerDocument,
  type Page,
  type ProjectAsset,
  type ProjectAssetLibrary,
  type RasterLayer,
  type ShapeLayer,
  type TextLayer,
} from '@live-board/domain';
import { parseRasterDrawing } from '@live-board/obs-protocol';
import {
  assertUserPageTemplateAssetReferences,
  collectUserPageTemplateAssets,
  mergeUserPageTemplateAssets,
  validateUserPageTemplateAssets,
} from './user-page-template-assets';

export const USER_PAGE_TEMPLATE_SCHEMA_VERSION = 2 as const;
export const USER_PAGE_TEMPLATE_STORAGE_KEY = 'live-board:user-page-templates:v2';
export const USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY = 'live-board:user-page-templates:v1';
export const USER_PAGE_TEMPLATE_LIMIT = 50;
export const USER_PAGE_TEMPLATE_MAX_BYTES = 2 * 1024 * 1024;
export const USER_PAGE_TEMPLATE_TOTAL_BYTES = 4 * 1024 * 1024;

export interface UserPageTemplatePreview {
  readonly background: string;
  readonly accent: string;
  readonly foreground: string;
}

export interface UserPageTemplate {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly preview: UserPageTemplatePreview;
  readonly page: Page;
  readonly assets: readonly ProjectAsset[];
}

export interface UserPageTemplateEligibility {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface UserPageTemplateLoadResult {
  readonly templates: UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
  readonly warnings: string[];
}

export interface UserPageTemplateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type UserPageTemplateErrorCode =
  | 'INVALID_TEMPLATE_ID'
  | 'INVALID_TEMPLATE_NAME'
  | 'DUPLICATE_TEMPLATE_NAME'
  | 'TEMPLATE_LIMIT_REACHED'
  | 'TEMPLATE_TOO_LARGE'
  | 'TEMPLATE_STORE_TOO_LARGE'
  | 'ASSET_REFERENCE_UNSUPPORTED'
  | 'INVALID_LAYER_REFERENCE'
  | 'DUPLICATE_LAYER_ID'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'ASSET_LIBRARY_REQUIRED'
  | 'STORAGE_UNAVAILABLE';

export class UserPageTemplateError extends Error {
  readonly code: UserPageTemplateErrorCode;

  constructor(code: UserPageTemplateErrorCode, message: string) {
    super(message);
    this.name = 'UserPageTemplateError';
    this.code = code;
  }
}

interface UserPageTemplateStoreDocument {
  readonly schemaVersion: typeof USER_PAGE_TEMPLATE_SCHEMA_VERSION;
  readonly templates: readonly UserPageTemplate[];
  readonly lastDeletedTemplate: UserPageTemplate | null;
}

export function getUserPageTemplateSaveEligibility(
  page: Page,
  assetLibrary: ProjectAssetLibrary = createProjectAssetLibrary(),
): UserPageTemplateEligibility {
  try {
    collectUserPageTemplateAssets(page, assetLibrary);
    return { allowed: true, reason: null };
  } catch (error: unknown) {
    return {
      allowed: false,
      reason: error instanceof Error
        ? error.message
        : 'Pageが参照するAssetをマイテンプレートへ保存できません。',
    };
  }
}

export function createUserPageTemplate(input: {
  readonly templateId: string;
  readonly name: string;
  readonly page: Page;
  readonly assetLibrary?: ProjectAssetLibrary;
  readonly createdAt: string;
}): UserPageTemplate {
  assertTemplateId(input.templateId);
  const name = normalizeTemplateName(input.name);
  const assetLibrary = input.assetLibrary ?? createProjectAssetLibrary();
  const eligibility = getUserPageTemplateSaveEligibility(input.page, assetLibrary);
  if (!eligibility.allowed) {
    throw new UserPageTemplateError(
      'ASSET_REFERENCE_UNSUPPORTED',
      eligibility.reason ?? 'Pageが参照するAssetを保存できません。',
    );
  }
  const assets = collectUserPageTemplateAssets(input.page, assetLibrary);

  const snapshotProjectId = `template-project:${input.templateId}`;
  const snapshotPageId = `template-page:${input.templateId}`;
  let index = 0;
  const page = clonePageWithRemappedLayerIds({
    sourcePage: input.page,
    projectId: snapshotProjectId,
    pageId: snapshotPageId,
    name,
    createdAt: input.createdAt,
    createLayerId: () => {
      index += 1;
      return `template-layer:${input.templateId}:${index}`;
    },
  });

  const template: UserPageTemplate = {
    id: input.templateId,
    name,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    preview: derivePreview(page),
    page,
    assets,
  };
  assertTemplateByteSize(template);
  return cloneTemplate(template);
}

export interface InstantiatedUserPageTemplate {
  readonly page: Page;
  readonly assetLibrary: ProjectAssetLibrary;
}

export function instantiateUserPageTemplate(input: {
  readonly template: UserPageTemplate;
  readonly projectId: string;
  readonly pageId: string;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): Page {
  const template = validateStoredTemplate(input.template);
  if (template.assets.length > 0) {
    throw new UserPageTemplateError(
      'ASSET_LIBRARY_REQUIRED',
      'Asset付きマイテンプレートはAsset Libraryを指定して作成してください。',
    );
  }
  return clonePageWithRemappedLayerIds({
    sourcePage: template.page,
    projectId: input.projectId,
    pageId: input.pageId,
    name: template.name,
    createdAt: input.createdAt,
    createLayerId: input.createLayerId,
  });
}

export function instantiateUserPageTemplateWithAssets(input: {
  readonly template: UserPageTemplate;
  readonly projectId: string;
  readonly pageId: string;
  readonly assetLibrary: ProjectAssetLibrary;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): InstantiatedUserPageTemplate {
  const template = validateStoredTemplate(input.template);
  const assetLibrary = mergeUserPageTemplateAssets(input.assetLibrary, template.assets);
  const page = clonePageWithRemappedLayerIds({
    sourcePage: template.page,
    projectId: input.projectId,
    pageId: input.pageId,
    name: template.name,
    createdAt: input.createdAt,
    createLayerId: input.createLayerId,
  });
  assertUserPageTemplateAssetReferences(page, template.assets);
  return { page, assetLibrary };
}

export function loadUserPageTemplates(
  storage: UserPageTemplateStorage,
): UserPageTemplateLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY);
    if (raw === null) raw = storage.getItem(USER_PAGE_TEMPLATE_LEGACY_STORAGE_KEY);
  } catch (error: unknown) {
    throw storageError(error);
  }

  if (raw === null) {
    return { templates: [], lastDeletedTemplate: null, warnings: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    recoverBrokenStore(storage);
    return {
      templates: [],
      lastDeletedTemplate: null,
      warnings: ['マイテンプレート保存データが壊れていたため、安全な空状態へ復旧しました。'],
    };
  }

  let migratedLegacy = false;
  if (isRecord(parsed) && parsed.schemaVersion === 1) {
    parsed = migrateLegacyStoreDocument(parsed);
    migratedLegacy = true;
  }

  if (
    isRecord(parsed)
    && typeof parsed.schemaVersion === 'number'
    && parsed.schemaVersion !== USER_PAGE_TEMPLATE_SCHEMA_VERSION
  ) {
    throw new UserPageTemplateError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `このアプリではschema version ${parsed.schemaVersion}のマイテンプレートを読み込めません。データは変更せず保持しています。`,
    );
  }

  if (
    !isRecord(parsed)
    || parsed.schemaVersion !== USER_PAGE_TEMPLATE_SCHEMA_VERSION
    || !Array.isArray(parsed.templates)
  ) {
    recoverBrokenStore(storage);
    return {
      templates: [],
      lastDeletedTemplate: null,
      warnings: ['不正なマイテンプレート保存データを検出し、空状態へ復旧しました。'],
    };
  }

  const templates: UserPageTemplate[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const candidate of parsed.templates) {
    if (templates.length >= USER_PAGE_TEMPLATE_LIMIT) {
      warnings.push(`上限${USER_PAGE_TEMPLATE_LIMIT}件を超えたテンプレートを除外しました。`);
      break;
    }

    try {
      const template = validateStoredTemplate(candidate);
      const normalizedName = comparableTemplateName(template.name);
      if (ids.has(template.id) || names.has(normalizedName)) {
        warnings.push(`重複したマイテンプレート「${template.name}」を除外しました。`);
        continue;
      }

      const next = [...templates, template];
      if (utf8ByteLength(serializeStore(next, null)) > USER_PAGE_TEMPLATE_TOTAL_BYTES) {
        warnings.push('保存容量上限を超えるマイテンプレートを除外しました。');
        continue;
      }

      ids.add(template.id);
      names.add(normalizedName);
      templates.push(template);
    } catch {
      warnings.push('読み込めないマイテンプレートを1件除外しました。');
    }
  }

  let lastDeletedTemplate: UserPageTemplate | null = null;
  if (parsed.lastDeletedTemplate !== undefined && parsed.lastDeletedTemplate !== null) {
    try {
      const candidate = validateStoredTemplate(parsed.lastDeletedTemplate);
      const normalizedName = comparableTemplateName(candidate.name);
      const duplicatesActive =
        ids.has(candidate.id) || names.has(normalizedName);
      const fitsStore =
        utf8ByteLength(serializeStore(templates, candidate))
        <= USER_PAGE_TEMPLATE_TOTAL_BYTES;
      if (duplicatesActive || !fitsStore) {
        warnings.push('復元候補として保持できない削除済みテンプレートを除外しました。');
      } else {
        lastDeletedTemplate = candidate;
      }
    } catch {
      warnings.push('読み込めない削除済みテンプレートを除外しました。');
    }
  }

  if (
    migratedLegacy
    || warnings.length > 0
    || templates.length !== parsed.templates.length
    || (parsed.lastDeletedTemplate ?? null) !== null && lastDeletedTemplate === null
  ) {
    try {
      persistTemplates(storage, templates, lastDeletedTemplate);
    } catch {
      warnings.push('復旧後のマイテンプレート保存データを書き戻せませんでした。');
    }
  }

  return {
    templates: templates.map(cloneTemplate),
    lastDeletedTemplate:
      lastDeletedTemplate === null ? null : cloneTemplate(lastDeletedTemplate),
    warnings,
  };
}

export function saveUserPageTemplate(
  storage: UserPageTemplateStorage,
  template: UserPageTemplate,
): UserPageTemplateLoadResult {
  const current = loadUserPageTemplates(storage);
  const validated = validateStoredTemplate(template);

  if (current.templates.length >= USER_PAGE_TEMPLATE_LIMIT) {
    throw new UserPageTemplateError(
      'TEMPLATE_LIMIT_REACHED',
      `マイテンプレートは最大${USER_PAGE_TEMPLATE_LIMIT}件まで保存できます。`,
    );
  }

  const comparableName = comparableTemplateName(validated.name);
  if (
    current.templates.some(
      (candidate) => comparableTemplateName(candidate.name) === comparableName,
    )
  ) {
    throw new UserPageTemplateError(
      'DUPLICATE_TEMPLATE_NAME',
      `「${validated.name}」という名前のマイテンプレートは既に存在します。`,
    );
  }

  const next = [validated, ...current.templates];
  persistTemplates(storage, next, current.lastDeletedTemplate);
  return {
    templates: next.map(cloneTemplate),
    lastDeletedTemplate:
      current.lastDeletedTemplate === null
        ? null
        : cloneTemplate(current.lastDeletedTemplate),
    warnings: current.warnings,
  };
}

export function deleteUserPageTemplate(
  storage: UserPageTemplateStorage,
  templateId: string,
): UserPageTemplateLoadResult {
  const current = loadUserPageTemplates(storage);
  const deleted = current.templates.find((template) => template.id === templateId) ?? null;
  const next = current.templates.filter((template) => template.id !== templateId);
  const lastDeletedTemplate = deleted ?? current.lastDeletedTemplate;
  if (deleted !== null) persistTemplates(storage, next, deleted);
  return {
    templates: next.map(cloneTemplate),
    lastDeletedTemplate:
      lastDeletedTemplate === null ? null : cloneTemplate(lastDeletedTemplate),
    warnings: current.warnings,
  };
}

export function restoreLastDeletedUserPageTemplate(
  storage: UserPageTemplateStorage,
): UserPageTemplateLoadResult {
  const current = loadUserPageTemplates(storage);
  const deleted = current.lastDeletedTemplate;
  if (deleted === null) return current;

  if (current.templates.length >= USER_PAGE_TEMPLATE_LIMIT) {
    throw new UserPageTemplateError(
      'TEMPLATE_LIMIT_REACHED',
      `マイテンプレートは最大${USER_PAGE_TEMPLATE_LIMIT}件まで保存できます。`,
    );
  }

  const normalizedName = comparableTemplateName(deleted.name);
  if (
    current.templates.some(
      (candidate) =>
        candidate.id === deleted.id
        || comparableTemplateName(candidate.name) === normalizedName,
    )
  ) {
    throw new UserPageTemplateError(
      'DUPLICATE_TEMPLATE_NAME',
      `「${deleted.name}」と競合するマイテンプレートが存在するため復元できません。`,
    );
  }

  const next = [deleted, ...current.templates];
  persistTemplates(storage, next, null);
  return {
    templates: next.map(cloneTemplate),
    lastDeletedTemplate: null,
    warnings: current.warnings,
  };
}

function clonePageWithRemappedLayerIds(input: {
  readonly sourcePage: Page;
  readonly projectId: string;
  readonly pageId: string;
  readonly name: string;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): Page {
  const sourceDocument = getLayerDocument(input.sourcePage);
  assertLayerDocumentIntegrity(input.sourcePage.id, sourceDocument);

  const idMap = new Map<string, string>();
  const generatedIds = new Set<string>();
  for (const layer of sourceDocument.layers) {
    const nextId = input.createLayerId();
    assertGeneratedLayerId(nextId, generatedIds);
    generatedIds.add(nextId);
    idMap.set(layer.id, nextId);
  }

  const layerDocument: LayerDocument = {
    layers: sourceDocument.layers.map((layer) =>
      remapLayer(layer, idMap, input.pageId, input.createdAt),
    ),
    rootLayerIds: sourceDocument.rootLayerIds.map((id) =>
      mapRequiredLayerId(idMap, id, 'rootLayerIds'),
    ),
    activeLayerId:
      sourceDocument.activeLayerId === null
        ? null
        : mapRequiredLayerId(idMap, sourceDocument.activeLayerId, 'activeLayerId'),
  };

  assertLayerDocumentIntegrity(input.pageId, layerDocument);

  return {
    ...createPage({
      id: input.pageId,
      projectId: input.projectId,
      name: input.name,
      width: input.sourcePage.width,
      height: input.sourcePage.height,
      dpi: input.sourcePage.dpi,
      transparent: input.sourcePage.transparent,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
    layerDocument,
  };
}

function remapLayer(
  layer: Layer,
  idMap: ReadonlyMap<string, string>,
  pageId: string,
  createdAt: string,
): Layer {
  const cloned = cloneJson(layer);
  const base = {
    ...cloned,
    id: mapRequiredLayerId(idMap, layer.id, 'layer.id'),
    pageId,
    parentId:
      layer.parentId === null
        ? null
        : mapRequiredLayerId(idMap, layer.parentId, 'parentId'),
    createdAt,
    updatedAt: createdAt,
  };

  if (layer.type === 'folder') {
    return {
      ...base,
      type: 'folder',
      childLayerIds: layer.childLayerIds.map((id) =>
        mapRequiredLayerId(idMap, id, 'childLayerIds'),
      ),
    };
  }

  if (layer.type === 'raster') {
    return {
      ...base,
      type: 'raster',
      content: {
        ...cloneJson(layer.content),
        sourceLayerIds: layer.content.sourceLayerIds.flatMap((id) => {
          const mapped = idMap.get(id);
          return mapped === undefined ? [] : [mapped];
        }),
      },
    };
  }

  return base as Layer;
}

function validateStoredTemplate(value: unknown): UserPageTemplate {
  if (!isRecord(value)) throw new Error('INVALID_TEMPLATE');
  const id = requiredString(value.id);
  assertTemplateId(id);
  const name = normalizeTemplateName(requiredString(value.name));
  const createdAt = requiredString(value.createdAt);
  const updatedAt = requiredString(value.updatedAt);

  if (!isRecord(value.page)) throw new Error('INVALID_TEMPLATE_PAGE');
  const rawPage = value.page;
  const pageId = requiredString(rawPage.id);
  const projectId = requiredString(rawPage.projectId);
  const pageName = requiredString(rawPage.name);
  const width = requiredNumber(rawPage.width);
  const height = requiredNumber(rawPage.height);
  const dpi = requiredNumber(rawPage.dpi);
  if (typeof rawPage.transparent !== 'boolean') throw new Error('INVALID_TEMPLATE_PAGE');
  if (!isRecord(rawPage.layerDocument)) throw new Error('INVALID_TEMPLATE_LAYER_DOCUMENT');

  const metadata = createPage({
    id: pageId,
    projectId,
    name: pageName,
    width,
    height,
    dpi,
    transparent: rawPage.transparent,
    createdAt: requiredString(rawPage.createdAt),
    updatedAt: requiredString(rawPage.updatedAt),
  });
  const document = validateStoredLayerDocumentPayload(
    metadata.id,
    cloneJson(rawPage.layerDocument),
  );
  assertLayerDocumentIntegrity(metadata.id, document);

  const page: Page = { ...metadata, layerDocument: document };
  const assets = validateUserPageTemplateAssets(value.assets);
  assertUserPageTemplateAssetReferences(page, assets);

  const template: UserPageTemplate = {
    id,
    name,
    createdAt,
    updatedAt,
    preview: derivePreview(page),
    page,
    assets,
  };
  assertTemplateByteSize(template);
  return cloneTemplate(template);
}

function validateStoredLayerDocumentPayload(
  pageId: string,
  value: unknown,
): LayerDocument {
  if (!isRecord(value) || !Array.isArray(value.layers) || !Array.isArray(value.rootLayerIds)) {
    throw new Error('INVALID_TEMPLATE_LAYER_DOCUMENT');
  }

  const layers = value.layers.map((layer) => validateStoredLayerPayload(pageId, layer));
  const rootLayerIds = validateStringArray(value.rootLayerIds, 'rootLayerIds');
  const activeLayerId =
    value.activeLayerId === null
      ? null
      : requiredString(value.activeLayerId);

  return { layers, rootLayerIds, activeLayerId };
}

function validateStoredLayerPayload(pageId: string, value: unknown): Layer {
  if (!isRecord(value)) throw new Error('INVALID_TEMPLATE_LAYER');

  const type = value.type;
  if (
    type !== 'raster'
    && type !== 'text'
    && type !== 'image'
    && type !== 'shape'
    && type !== 'background'
    && type !== 'folder'
  ) {
    throw new Error('INVALID_TEMPLATE_LAYER_TYPE');
  }

  const id = requiredString(value.id);
  const storedPageId = requiredString(value.pageId);
  if (storedPageId !== pageId) throw new Error('INVALID_TEMPLATE_LAYER_PAGE');
  const parentId = value.parentId === null ? null : requiredString(value.parentId);
  const name = requiredString(value.name);
  if (name.trim().length < 1 || name.length > 200) throw new Error('INVALID_TEMPLATE_LAYER_NAME');

  const visible = requiredBoolean(value.visible);
  const editLocked = requiredBoolean(value.editLocked);
  const movementLocked = requiredBoolean(value.movementLocked);
  const alphaLocked = requiredBoolean(value.alphaLocked);
  const opacity = requiredFiniteNumber(value.opacity);
  if (opacity < 0 || opacity > 1) throw new Error('INVALID_TEMPLATE_LAYER_OPACITY');

  const blendMode = validateBlendMode(value.blendMode);

  const color = validateNullableColor(value.color);
  const createdAt = requiredString(value.createdAt);
  const updatedAt = requiredString(value.updatedAt);
  const transform = validateStoredTransform(value.transform);

  const base = {
    id,
    pageId: storedPageId,
    parentId,
    name: name.trim(),
    visible,
    editLocked,
    movementLocked,
    alphaLocked,
    opacity,
    blendMode,
    color,
    createdAt,
    updatedAt,
    ...(transform === undefined ? {} : { transform }),
  };

  if (type === 'folder') {
    const layer: FolderLayer = {
      ...base,
      type: 'folder',
      childLayerIds: validateStringArray(value.childLayerIds, 'childLayerIds'),
    };
    return layer;
  }

  if (!isRecord(value.content)) throw new Error('INVALID_TEMPLATE_LAYER_CONTENT');

  if (type === 'raster') {
    const assetId = validateNullableId(value.content.assetId, 'INVALID_RASTER_ASSET_ID');
    const sourceLayerIds = validateStringArray(
      value.content.sourceLayerIds,
      'sourceLayerIds',
    );
    const layer: RasterLayer = {
      ...base,
      type: 'raster',
      content: { assetId, sourceLayerIds },
      ...(value.drawing === undefined
        ? {}
        : { drawing: parseRasterDrawing(value.drawing) }),
    };
    return layer;
  }

  if (type === 'text') {
    const candidate = {
      ...base,
      type: 'text',
      content: cloneJson(value.content),
    } as TextLayer;
    return { ...candidate, content: getRichTextContent(candidate) } as TextLayer;
  }

  if (type === 'image') {
    const candidate = {
      ...base,
      type: 'image',
      content: cloneJson(value.content),
    } as ImageLayer;
    return { ...candidate, content: getRichImageContent(candidate) } as ImageLayer;
  }

  if (type === 'shape') {
    const candidate = {
      ...base,
      type: 'shape',
      content: cloneJson(value.content),
    } as ShapeLayer;
    return { ...candidate, content: getRichShapeContent(candidate) } as ShapeLayer;
  }

  const backgroundColor = validateRequiredColor(value.content.color);
  const layer: BackgroundLayer = {
    ...base,
    type: 'background',
    content: { color: backgroundColor },
  };
  return layer;
}

function validateStoredTransform(value: unknown): Layer['transform'] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('INVALID_TEMPLATE_LAYER_TRANSFORM');
  const transform = {
    x: requiredFiniteNumber(value.x),
    y: requiredFiniteNumber(value.y),
    scaleX: requiredFiniteNumber(value.scaleX),
    scaleY: requiredFiniteNumber(value.scaleY),
    rotation: requiredFiniteNumber(value.rotation),
  };
  assertLayerTransform(transform);
  return transform;
}

function validateStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`INVALID_TEMPLATE_${field}`);
  return value.map((entry) => requiredString(entry));
}

function validateBlendMode(value: unknown): Layer['blendMode'] {
  if (
    value === 'normal'
    || value === 'multiply'
    || value === 'screen'
    || value === 'add'
    || value === 'overlay'
  ) {
    return value;
  }
  throw new Error('INVALID_TEMPLATE_LAYER_BLEND_MODE');
}

function validateNullableId(value: unknown, code: string): string | null {
  if (value === null) return null;
  const id = requiredString(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,159}$/.test(id)) throw new Error(code);
  return id;
}

function validateNullableColor(value: unknown): string | null {
  if (value === null) return null;
  return validateRequiredColor(value);
}

function validateRequiredColor(value: unknown): string {
  if (
    typeof value !== 'string'
    || !/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/.test(value)
  ) {
    throw new Error('INVALID_TEMPLATE_LAYER_COLOR');
  }
  return value;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('INVALID_BOOLEAN');
  return value;
}

function requiredFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('INVALID_NUMBER');
  }
  return value;
}

function migrateLegacyStoreDocument(
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(value.templates)) return value;
  const migrateTemplate = (candidate: unknown): unknown =>
    isRecord(candidate) ? { ...candidate, assets: [] } : candidate;
  return {
    ...value,
    schemaVersion: USER_PAGE_TEMPLATE_SCHEMA_VERSION,
    templates: value.templates.map(migrateTemplate),
    lastDeletedTemplate:
      value.lastDeletedTemplate === undefined || value.lastDeletedTemplate === null
        ? null
        : migrateTemplate(value.lastDeletedTemplate),
  };
}

function persistTemplates(
  storage: UserPageTemplateStorage,
  templates: readonly UserPageTemplate[],
  lastDeletedTemplate: UserPageTemplate | null,
): void {
  if (templates.length > USER_PAGE_TEMPLATE_LIMIT) {
    throw new UserPageTemplateError(
      'TEMPLATE_LIMIT_REACHED',
      `マイテンプレートは最大${USER_PAGE_TEMPLATE_LIMIT}件まで保存できます。`,
    );
  }

  const serialized = serializeStore(templates, lastDeletedTemplate);
  if (utf8ByteLength(serialized) > USER_PAGE_TEMPLATE_TOTAL_BYTES) {
    throw new UserPageTemplateError(
      'TEMPLATE_STORE_TOO_LARGE',
      'マイテンプレートの合計保存容量が4MiBを超えます。',
    );
  }

  try {
    storage.setItem(USER_PAGE_TEMPLATE_STORAGE_KEY, serialized);
  } catch (error: unknown) {
    throw storageError(error);
  }
}

function serializeStore(
  templates: readonly UserPageTemplate[],
  lastDeletedTemplate: UserPageTemplate | null,
): string {
  const document: UserPageTemplateStoreDocument = {
    schemaVersion: USER_PAGE_TEMPLATE_SCHEMA_VERSION,
    templates,
    lastDeletedTemplate,
  };
  return JSON.stringify(document);
}

function recoverBrokenStore(storage: UserPageTemplateStorage): void {
  try {
    storage.removeItem(USER_PAGE_TEMPLATE_STORAGE_KEY);
  } catch {
    // 読み込み側は空状態へ復旧できるため、削除失敗は追加例外にしない。
  }
}

function derivePreview(page: Page): UserPageTemplatePreview {
  const document = getLayerDocument(page);
  const background = document.layers.find((layer) => layer.type === 'background');
  const shape = document.layers.find(
    (layer) => layer.type === 'shape' && layer.content.fill !== null,
  );
  const text = document.layers.find((layer) => layer.type === 'text');

  return {
    background:
      background?.type === 'background' ? background.content.color : '#111827',
    accent:
      shape?.type === 'shape'
        ? shape.content.fill ?? shape.content.stroke
        : '#60A5FA',
    foreground:
      text?.type === 'text' ? text.content.color : '#F8FAFC',
  };
}

function normalizeTemplateName(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > 80) {
    throw new UserPageTemplateError(
      'INVALID_TEMPLATE_NAME',
      'マイテンプレート名は1〜80文字で入力してください。',
    );
  }
  return normalized;
}

function comparableTemplateName(value: string): string {
  return normalizeTemplateName(value).toLocaleLowerCase();
}

function assertTemplateId(value: string): void {
  if (
    value.length < 1
    || value.length > 160
    || !/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(value)
  ) {
    throw new UserPageTemplateError(
      'INVALID_TEMPLATE_ID',
      `不正なマイテンプレートIDです: ${value}`,
    );
  }
}

function assertGeneratedLayerId(value: string, used: ReadonlySet<string>): void {
  if (
    value.length < 1
    || value.length > 160
    || !/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(value)
  ) {
    throw new UserPageTemplateError(
      'INVALID_LAYER_REFERENCE',
      `不正なLayer IDが生成されました: ${value}`,
    );
  }
  if (used.has(value)) {
    throw new UserPageTemplateError(
      'DUPLICATE_LAYER_ID',
      `Layer IDが重複しました: ${value}`,
    );
  }
}

function mapRequiredLayerId(
  idMap: ReadonlyMap<string, string>,
  sourceId: string,
  field: string,
): string {
  const mapped = idMap.get(sourceId);
  if (mapped === undefined) {
    throw new UserPageTemplateError(
      'INVALID_LAYER_REFERENCE',
      `${field}が存在しないLayerを参照しています: ${sourceId}`,
    );
  }
  return mapped;
}

function assertTemplateByteSize(template: UserPageTemplate): void {
  if (utf8ByteLength(JSON.stringify(template)) > USER_PAGE_TEMPLATE_MAX_BYTES) {
    throw new UserPageTemplateError(
      'TEMPLATE_TOO_LARGE',
      'このPageはマイテンプレート1件あたりの保存上限2MiBを超えています。',
    );
  }
}

function storageError(error: unknown): UserPageTemplateError {
  return new UserPageTemplateError(
    'STORAGE_UNAVAILABLE',
    error instanceof Error
      ? `マイテンプレート保存領域を利用できません: ${error.message}`
      : 'マイテンプレート保存領域を利用できません。',
  );
}

function cloneTemplate(template: UserPageTemplate): UserPageTemplate {
  return cloneJson(template);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1) throw new Error('INVALID_STRING');
  return value;
}

function requiredNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('INVALID_NUMBER');
  }
  return value;
}
