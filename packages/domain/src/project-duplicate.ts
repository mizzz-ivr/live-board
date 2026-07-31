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
  if (input.id === sourceProject.id) {
    throw new Error(`Project id must differ from source: ${input.id}`);
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const sourcePageIds = new Set(
    sourceProject.pages.map((page) => page.id),
  );
  const sourceLayerIds = new Set(
    sourceProject.pages.flatMap((page) =>
      getLayerDocument(page).layers.map((layer) => layer.id),
    ),
  );
  const generatedPageIds = new Set<PageId>();
  const generatedLayerIds = new Set<LayerId>();
  const pageIdMap = new Map<PageId, PageId>();

  sourceProject.pages.forEach((page, index) => {
    const pageId = input.createPageId(page, index);
    assertFreshGeneratedId(
      pageId,
      sourcePageIds,
      generatedPageIds,
      'page',
    );
    pageIdMap.set(page.id, pageId);
  });

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
        sourceLayerIds,
        generatedLayerIds,
      ),
    };
  });

  const project = createProject({
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
  return sourceProject.broadcastSettings === undefined
    ? project
    : {
        ...project,
        broadcastSettings: cloneSerializable(sourceProject.broadcastSettings),
      };
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
  sourceLayerIds: ReadonlySet<LayerId>,
  generatedLayerIds: Set<LayerId>,
): LayerDocument {
  const sourceDocument = getLayerDocument(sourcePage);
  assertLayerDocumentIntegrity(sourcePage.id, sourceDocument);
  const layerIdMap = new Map<LayerId, LayerId>();

  sourceDocument.layers.forEach((layer, layerIndex) => {
    const layerId = input.createLayerId(layer, pageIndex, layerIndex);
    assertFreshGeneratedId(
      layerId,
      sourceLayerIds,
      generatedLayerIds,
      'layer',
    );
    layerIdMap.set(layer.id, layerId);
  });

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

function assertFreshGeneratedId<T extends string>(
  id: T,
  sourceIds: ReadonlySet<T>,
  generatedIds: Set<T>,
  entityName: 'page' | 'layer',
): void {
  if (sourceIds.has(id)) {
    throw new Error(
      `${entityName === 'page' ? 'Page' : 'Layer'} id must differ from source: ${id}`,
    );
  }
  if (generatedIds.has(id)) {
    throw new Error(`Duplicate ${entityName} id: ${id}`);
  }
  generatedIds.add(id);
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
