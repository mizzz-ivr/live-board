import type { Layer, LayerId, LayerType } from '@live-board/domain';

export type LayerTypeFilter = 'all' | LayerType;
export type LayerVisibilityFilter = 'all' | 'visible' | 'hidden';

export interface LayerPanelFilter {
  query: string;
  type: LayerTypeFilter;
  visibility: LayerVisibilityFilter;
}

export interface LayerPanelFilterResult {
  layers: Layer[];
  matchCount: number;
  isActive: boolean;
}

export function normalizeLayerSearchQuery(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

export function isLayerPanelFilterActive(filter: LayerPanelFilter): boolean {
  return (
    normalizeLayerSearchQuery(filter.query).length > 0 ||
    filter.type !== 'all' ||
    filter.visibility !== 'all'
  );
}

export function filterLayersForPanel(
  orderedLayers: readonly Layer[],
  filter: LayerPanelFilter,
): LayerPanelFilterResult {
  const normalizedQuery = normalizeLayerSearchQuery(filter.query);
  const queryTerms = normalizedQuery.length === 0 ? [] : normalizedQuery.split(' ');
  const isActive = isLayerPanelFilterActive(filter);

  if (!isActive) {
    return {
      layers: [...orderedLayers],
      matchCount: orderedLayers.length,
      isActive: false,
    };
  }

  const directMatches = orderedLayers.filter((layer) => {
    if (filter.type !== 'all' && layer.type !== filter.type) {
      return false;
    }
    if (filter.visibility === 'visible' && !layer.visible) {
      return false;
    }
    if (filter.visibility === 'hidden' && layer.visible) {
      return false;
    }

    const normalizedName = normalizeLayerSearchQuery(layer.name);
    return queryTerms.every((term) => normalizedName.includes(term));
  });

  const layerById = new Map<LayerId, Layer>(
    orderedLayers.map((layer) => [layer.id, layer]),
  );
  const includedIds = new Set<LayerId>(directMatches.map((layer) => layer.id));

  for (const layer of directMatches) {
    let parentId = layer.parentId;
    let visited = 0;
    while (parentId !== null && visited < orderedLayers.length) {
      const parent = layerById.get(parentId);
      if (parent === undefined) {
        break;
      }
      includedIds.add(parent.id);
      parentId = parent.parentId;
      visited += 1;
    }
  }

  return {
    layers: orderedLayers.filter((layer) => includedIds.has(layer.id)),
    matchCount: directMatches.length,
    isActive: true,
  };
}
