import { createLayer, type Layer } from '@live-board/domain';
import { describe, expect, it } from 'vitest';
import {
  filterLayersForPanel,
  normalizeLayerSearchQuery,
  type LayerPanelFilter,
} from '../src/layer-panel-filter.js';

const ALL: LayerPanelFilter = {
  query: '',
  type: 'all',
  visibility: 'all',
};

function layer(
  id: string,
  name: string,
  type: Layer['type'],
  options: { parentId?: string | null; visible?: boolean } = {},
): Layer {
  return createLayer({
    id,
    pageId: 'page:1',
    parentId: options.parentId ?? null,
    name,
    type,
    visible: options.visible ?? true,
  });
}

const layers = [
  layer('folder:main', 'メイン グループ', 'folder'),
  layer('text:title', 'ＨＥＲＴＡ Main Title', 'text', { parentId: 'folder:main' }),
  layer('shape:accent', 'Accent Line', 'shape', { parentId: 'folder:main' }),
  layer('image:logo', 'Sponsor Logo', 'image', { visible: false }),
];

describe('Layer Panel filter', () => {
  it('検索語をNFKC・小文字・単一空白へ正規化する', () => {
    expect(normalizeLayerSearchQuery('  ＨＥＲＴＡ   MAIN\tTitle ')).toBe(
      'herta main title',
    );
  });

  it('条件なしではpaint orderをそのまま返し入力配列を変更しない', () => {
    const source = [...layers];
    const result = filterLayersForPanel(source, ALL);

    expect(result.isActive).toBe(false);
    expect(result.matchCount).toBe(4);
    expect(result.layers.map((item) => item.id)).toEqual(layers.map((item) => item.id));
    expect(source).toEqual(layers);
  });

  it('名前検索は複数語ANDで一致する', () => {
    const result = filterLayersForPanel(layers, {
      ...ALL,
      query: 'herta title',
    });

    expect(result.matchCount).toBe(1);
    expect(result.layers.map((item) => item.id)).toEqual([
      'folder:main',
      'text:title',
    ]);
  });

  it('種類と表示状態を組み合わせて絞り込む', () => {
    const hiddenImage = filterLayersForPanel(layers, {
      query: '',
      type: 'image',
      visibility: 'hidden',
    });
    const visibleImage = filterLayersForPanel(layers, {
      query: '',
      type: 'image',
      visibility: 'visible',
    });

    expect(hiddenImage.matchCount).toBe(1);
    expect(hiddenImage.layers.map((item) => item.id)).toEqual(['image:logo']);
    expect(visibleImage.matchCount).toBe(0);
    expect(visibleImage.layers).toEqual([]);
  });

  it('子Layerが一致した場合は祖先Folderだけを文脈として残す', () => {
    const nested = [
      layer('folder:root', 'Root', 'folder'),
      layer('folder:child', 'Child', 'folder', { parentId: 'folder:root' }),
      layer('text:target', 'Target Caption', 'text', { parentId: 'folder:child' }),
      layer('text:other', 'Other Caption', 'text'),
    ];

    const result = filterLayersForPanel(nested, {
      query: 'target',
      type: 'text',
      visibility: 'visible',
    });

    expect(result.matchCount).toBe(1);
    expect(result.layers.map((item) => item.id)).toEqual([
      'folder:root',
      'folder:child',
      'text:target',
    ]);
  });

  it('条件に一致しない場合は0件を返す', () => {
    const result = filterLayersForPanel(layers, {
      ...ALL,
      query: 'not-found',
    });

    expect(result.isActive).toBe(true);
    expect(result.matchCount).toBe(0);
    expect(result.layers).toEqual([]);
  });
});
