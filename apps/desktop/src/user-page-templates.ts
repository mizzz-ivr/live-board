import {
  assertLayerDocumentIntegrity,
  createPage,
  getLayerDocument,
  type Layer,
  type LayerDocument,
  type Page,
} from '@live-board/domain';

export const USER_PAGE_TEMPLATE_SCHEMA_VERSION = 1 as const;
export const USER_PAGE_TEMPLATE_STORAGE_KEY = 'live-board:user-page-templates:v1';
export const USER_PAGE_TEMPLATE_LIMIT = 50;
export const USER_PAGE_TEMPLATE_MAX_BYTES = 256 * 1024;
export const USER_PAGE_TEMPLATE_TOTAL_BYTES = 2 * 1024 * 1024;

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
}

export interface UserPageTemplateEligibility {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface UserPageTemplateLoadResult {
  readonly templates: UserPageTemplate[];
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
}

export function getUserPageTemplateSaveEligibility(
  page: Page,
): UserPageTemplateEligibility {
  const document = getLayerDocument(page);
  const unsupported = document.layers.filter(
    (layer) =>
      (layer.type === 'image' || layer.type === 'raster')
      && layer.content.assetId !== null,
  );

  if (unsupported.length === 0) {
    return { allowed: true, reason: null };
  }

  const names = unsupported
    .slice(0, 3)
    .map((layer) => `「${layer.name}」`)
    .join('、');
  const suffix = unsupported.length > 3 ? `ほか${unsupported.length - 3}件` : '';
  return {
    allowed: false,
    reason:
      `Asset参照を含むLayer（${names}${suffix}）は現在マイテンプレートへ保存できません。`
      + '画像・描画Assetの複製対応後に保存可能になります。',
  };
}

export function createUserPageTemplate(input: {
  readonly templateId: string;
  readonly name: string;
  readonly page: Page;
  readonly createdAt: string;
}): UserPageTemplate {
  assertTemplateId(input.templateId);
  const name = normalizeTemplateName(input.name);
  const eligibility = getUserPageTemplateSaveEligibility(input.page);
  if (!eligibility.allowed) {
    throw new UserPageTemplateError(
      'ASSET_REFERENCE_UNSUPPORTED',
      eligibility.reason ?? 'Asset参照を含むPageは保存できません。',
    );
  }

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
  };
  assertTemplateByteSize(template);
  return cloneTemplate(template);
}

export function instantiateUserPageTemplate(input: {
  readonly template: UserPageTemplate;
  readonly projectId: string;
  readonly pageId: string;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}): Page {
  const template = validateStoredTemplate(input.template);
  return clonePageWithRemappedLayerIds({
    sourcePage: template.page,
    projectId: input.projectId,
    pageId: input.pageId,
    name: template.name,
    createdAt: input.createdAt,
    createLayerId: input.createLayerId,
  });
}

export function loadUserPageTemplates(
  storage: UserPageTemplateStorage,
): UserPageTemplateLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(USER_PAGE_TEMPLATE_STORAGE_KEY);
  } catch (error: unknown) {
    throw storageError(error);
  }

  if (raw === null) return { templates: [], warnings: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    recoverBrokenStore(storage);
    return {
      templates: [],
      warnings: ['マイテンプレート保存データが壊れていたため、安全な空状態へ復旧しました。'],
    };
  }

  if (
    !isRecord(parsed)
    || parsed.schemaVersion !== USER_PAGE_TEMPLATE_SCHEMA_VERSION
    || !Array.isArray(parsed.templates)
  ) {
    recoverBrokenStore(storage);
    return {
      templates: [],
      warnings: ['未対応または不正なマイテンプレート保存データを検出し、空状態へ復旧しました。'],
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
      if (utf8ByteLength(serializeStore(next)) > USER_PAGE_TEMPLATE_TOTAL_BYTES) {
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

  if (warnings.length > 0 || templates.length !== parsed.templates.length) {
    try {
      persistTemplates(storage, templates);
    } catch {
      warnings.push('復旧後のマイテンプレート保存データを書き戻せませんでした。');
    }
  }

  return { templates: templates.map(cloneTemplate), warnings };
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
  persistTemplates(storage, next);
  return {
    templates: next.map(cloneTemplate),
    warnings: current.warnings,
  };
}

export function deleteUserPageTemplate(
  storage: UserPageTemplateStorage,
  templateId: string,
): UserPageTemplateLoadResult {
  const current = loadUserPageTemplates(storage);
  const next = current.templates.filter((template) => template.id !== templateId);
  if (next.length !== current.templates.length) persistTemplates(storage, next);
  return {
    templates: next.map(cloneTemplate),
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
        sourceLayerIds: layer.content.sourceLayerIds.map((id) =>
          mapRequiredLayerId(idMap, id, 'sourceLayerIds'),
        ),
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
  const document = cloneJson(rawPage.layerDocument as unknown as LayerDocument);
  if (!Array.isArray(document.layers) || !Array.isArray(document.rootLayerIds)) {
    throw new Error('INVALID_TEMPLATE_LAYER_DOCUMENT');
  }
  assertLayerDocumentIntegrity(metadata.id, document);

  const page: Page = { ...metadata, layerDocument: document };
  const eligibility = getUserPageTemplateSaveEligibility(page);
  if (!eligibility.allowed) {
    throw new UserPageTemplateError(
      'ASSET_REFERENCE_UNSUPPORTED',
      eligibility.reason ?? 'Asset参照を含むPageは保存できません。',
    );
  }

  const template: UserPageTemplate = {
    id,
    name,
    createdAt,
    updatedAt,
    preview: derivePreview(page),
    page,
  };
  assertTemplateByteSize(template);
  return cloneTemplate(template);
}

function persistTemplates(
  storage: UserPageTemplateStorage,
  templates: readonly UserPageTemplate[],
): void {
  if (templates.length > USER_PAGE_TEMPLATE_LIMIT) {
    throw new UserPageTemplateError(
      'TEMPLATE_LIMIT_REACHED',
      `マイテンプレートは最大${USER_PAGE_TEMPLATE_LIMIT}件まで保存できます。`,
    );
  }

  const serialized = serializeStore(templates);
  if (utf8ByteLength(serialized) > USER_PAGE_TEMPLATE_TOTAL_BYTES) {
    throw new UserPageTemplateError(
      'TEMPLATE_STORE_TOO_LARGE',
      'マイテンプレートの合計保存容量が2MiBを超えます。',
    );
  }

  try {
    storage.setItem(USER_PAGE_TEMPLATE_STORAGE_KEY, serialized);
  } catch (error: unknown) {
    throw storageError(error);
  }
}

function serializeStore(templates: readonly UserPageTemplate[]): string {
  const document: UserPageTemplateStoreDocument = {
    schemaVersion: USER_PAGE_TEMPLATE_SCHEMA_VERSION,
    templates,
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
      'このPageはマイテンプレート1件あたりの保存上限256KiBを超えています。',
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
