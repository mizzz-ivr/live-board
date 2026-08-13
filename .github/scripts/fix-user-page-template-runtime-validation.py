from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, got {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


model = "apps/desktop/src/user-page-templates.ts"
replace_once(
    model,
    """import {
  assertLayerDocumentIntegrity,
  createPage,
  getLayerDocument,
  type Layer,
  type LayerDocument,
  type Page,
} from '@live-board/domain';""",
    """import {
  assertLayerDocumentIntegrity,
  assertLayerTransform,
  createPage,
  getLayerDocument,
  getRichImageContent,
  getRichShapeContent,
  getRichTextContent,
  type BackgroundLayer,
  type FolderLayer,
  type ImageLayer,
  type Layer,
  type LayerDocument,
  type RasterLayer,
  type ShapeLayer,
  type TextLayer,
} from '@live-board/domain';
import { parseRasterDrawing } from '@live-board/obs-protocol';""",
)
replace_once(
    model,
    """  const document = cloneJson(rawPage.layerDocument as unknown as LayerDocument);
  if (!Array.isArray(document.layers) || !Array.isArray(document.rootLayerIds)) {
    throw new Error('INVALID_TEMPLATE_LAYER_DOCUMENT');
  }
  assertLayerDocumentIntegrity(metadata.id, document);""",
    """  const document = validateStoredLayerDocumentPayload(
    metadata.id,
    cloneJson(rawPage.layerDocument),
  );
  assertLayerDocumentIntegrity(metadata.id, document);""",
)
insert_before = """function persistTemplates(
  storage: UserPageTemplateStorage,"""
helper = r'''function validateStoredLayerDocumentPayload(
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

  const blendMode = value.blendMode;
  if (
    blendMode !== 'normal'
    && blendMode !== 'multiply'
    && blendMode !== 'screen'
    && blendMode !== 'add'
    && blendMode !== 'overlay'
  ) {
    throw new Error('INVALID_TEMPLATE_LAYER_BLEND_MODE');
  }

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

'''
replace_once(model, insert_before, helper + insert_before)

# Add an explicit corrupted-content regression test.
test = "apps/desktop/test/user-page-templates.test.ts"
needle = """  it('未対応schemaは原本を削除せず読み込みを停止する', () => {"""
new_test = """  it('Layer content・transform・drawingが不正なエントリだけを除外する', () => {
    const storage = new MemoryStorage();
    const valid = createUserPageTemplate({
      templateId: 'user-template:runtime-valid',
      name: '正常Runtime',
      page: structuredPage(),
      createdAt: '2026-08-13T00:00:00.000Z',
    });
    const invalid = JSON.parse(JSON.stringify(valid)) as {
      id: string;
      name: string;
      page: {
        layerDocument?: {
          layers: Array<Record<string, unknown>>;
        };
      };
    };
    invalid.id = 'user-template:runtime-invalid';
    invalid.name = '不正Runtime';
    const text = invalid.page.layerDocument?.layers.find(
      (layer) => layer.type === 'text',
    );
    if (text === undefined || typeof text.content !== 'object' || text.content === null) {
      throw new Error('text test fixture not found');
    }
    delete (text.content as Record<string, unknown>).fontFamily;
    text.transform = { x: 0, y: 0, scaleX: 0, scaleY: 1, rotation: 0 };

    storage.setItem(
      USER_PAGE_TEMPLATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        templates: [valid, invalid],
        lastDeletedTemplate: null,
      }),
    );

    const loaded = loadUserPageTemplates(storage);
    expect(loaded.templates.map((item) => item.name)).toEqual(['正常Runtime']);
    expect(loaded.warnings).toContain('読み込めないマイテンプレートを1件除外しました。');
  });

  it('未対応schemaは原本を削除せず読み込みを停止する', () => {"""
replace_once(test, needle, new_test)

docs = "docs/user-page-templates.md"
replace_once(
    docs,
    """- 一部エントリだけ不正な場合は、そのエントリだけ除外
- 重複ID / 重複名は後続エントリを除外""",
    """- 一部エントリだけ不正な場合は、そのエントリだけ除外
- Layerのtype / content / transform / Raster drawingを実行時検証し、描画不能なエントリを除外
- 重複ID / 重複名は後続エントリを除外""",
)
replace_once(
    docs,
    """- LayerDocument整合性
- Asset参照Pageの保存拒否""",
    """- LayerDocument整合性
- Layer type / Rich Content / Transform / Raster drawingのRuntime Validation
- Asset参照Pageの保存拒否""",
)
