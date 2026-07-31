import {
  assertLayerDocumentIntegrity,
  getLayerDocument,
  type Layer,
  type LayerDocument,
  type LayerId,
} from './layers.js';
import {
  createPage,
  createProject,
  type Page,
  type PageId,
  type Project,
  type ProjectId,
} from './model.js';

const PROJECT_COPY_SUFFIX = ' のコピー';
const MAX_PROJECT_NAME_LENGTH = 120;

export interface DuplicateProjectInput {
  id: ProjectId;
  name?: string;
  createdAt?: string;
  createPageId(sourcePage: Page, pageIndex: number): PageId;
  createLayerId(
    sourceLayer: Layer,
    pageIndex: number,
    layerIndex: number,
  ): LayerId;
}

export function duplicateProject(
  sourceProject: Project,
  input: DuplicateProjectInput,
): Project {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const pageIdMap = new Map(
    sourceProject.pages.map((page, index) => [
      page.id,
      input.createPageId(page, index),
    ]),
  );

  const pages = sourceProject.pages.map((sourcePage, pageIndex) => {
    const pageId = requireMappedId(pageIdMap, sourcePage.id, 'Page');
    const page = createPage({
      id: pageId,
      projectId: input.id,
      name: sourcePage.name,
      width: sourcePage.width,
      height: sourcePage.height,
      dpi: sourcePage.dpi,
      transparent: sourcePage.transparent,
      createdAt,
      updatedAt: createdAt,
    });
    if (sourcePage.layerDocument === undefined) return page;

    return {
      ...page,
      layerDocument: duplicateLayerDocument(
        sourcePage,
        pageId,
        pageIndex,
        input,
        createdAt,
      ),
    };
  });

  return createProject({
    id: input.id,
    workspaceId: sourceProject.workspaceId,
    name: input.name ?? createProjectCopyName(sourceProject.name),
    pages,
    activeEditPageId: requireMappedId(
      pageIdMap,
      sourceProject.activeEditPageId,
      'Edit Page',
    ),
    activeBroadcastPageId: requireMappedId(
      pageIdMap,
      sourceProject.activeBroadcastPageId,
      'Broadcast Page',
    ),
    broadcastPageLocked: sourceProject.broadcastPageLocked,
    createdAt,
    updatedAt: createdAt,
  });
}

export function createProjectCopyName(sourceName: string): string {
  const normalizedName = sourceName.trim();
  const maxBaseLength = MAX_PROJECT_NAME_LENGTH - PROJECT_COPY_SUFFIX.length;
  const baseName = normalizedName.slice(0, maxBaseLength).trimEnd();
  return baseName.length === 0 ? 'コピー' : `${baseName}${PROJECT_COPY_SUFFIX}`;
}

function duplicateLayerDocument(
  sourcePage: Page,
  targetPageId: PageId,
  pageIndex: number,
  input: DuplicateProjectInput,
  createdAt: string,
): LayerDocument {
  const sourceDocument = getLayerDocument(sourcePage);
  assertLayerDocumentIntegrity(sourcePage.id, sourceDocument);
  const layerIdMap = new Map(
    sourceDocument.layers.map((layer, layerIndex) => [
      layer.id,
      input.createLayerId(layer, pageIndex, layerIndex),
    ]),
  );

  const layers = sourceDocument.layers.map((sourceLayer) => {
    const layer = cloneSerializable(sourceLayer);
    layer.id = requireMappedId(layerIdMap, sourceLayer.id, 'Layer');
    layer.pageId = targetPageId;
    layer.parentId =
      sourceLayer.parentId === null
        ? null
        : requireMappedId(layerIdMap, sourceLayer.parentId, 'Parent Layer');
    layer.createdAt = createdAt;
    layer.updatedAt = createdAt;

    if (layer.type === 'folder') {
      layer.childLayerIds = sourceLayer.type === 'folder'
        ? sourceLayer.childLayerIds.map((layerId) =>
            requireMappedId(layerIdMap, layerId, 'Child Layer'),
          )
        : [];
    }
    if (layer.type === 'raster' && sourceLayer.type === 'raster') {
      layer.content.sourceLayerIds = sourceLayer.content.sourceLayerIds.map(
        (layerId) => layerIdMap.get(layerId) ?? layerId,
      );
    }
    return layer;
  });

  const document: LayerDocument = {
    layers,
    rootLayerIds: sourceDocument.rootLayerIds.map((layerId) =>
      requireMappedId(layerIdMap, layerId, 'Root Layer'),
    ),
    activeLayerId:
      sourceDocument.activeLayerId === null
        ? null
        : requireMappedId(
            layerIdMap,
            sourceDocument.activeLayerId,
            'Active Layer',
          ),
  };
  assertLayerDocumentIntegrity(targetPageId, document);
  return document;
}

function requireMappedId<T extends string>(
  idMap: ReadonlyMap<T, T>,
  sourceId: T,
  label: string,
): T {
  const mappedId = idMap.get(sourceId);
  if (mappedId === undefined) {
    throw new Error(`${label} mapping not found: ${sourceId}`);
  }
  return mappedId;
}

function cloneSerializable<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneSerializable(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneSerializable(item)]),
    ) as T;
  }
  return value;
}
