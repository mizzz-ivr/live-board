import {
  assertLayerDocumentIntegrity,
  createLayer,
  createPage,
  withRichShapeContent,
  withRichTextContent,
  type BackgroundLayer,
  type Layer,
  type LayerDocument,
  type Page,
  type ShapeLayer,
  type TextLayer,
} from '@live-board/domain';

export type BuiltInPageTemplateId =
  | 'opening'
  | 'starting-soon'
  | 'talk'
  | 'break'
  | 'ending';

export interface BuiltInPageTemplate {
  readonly id: BuiltInPageTemplateId;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly preview: {
    readonly background: string;
    readonly accent: string;
    readonly foreground: string;
  };
}

interface CreatePageFromTemplateInput {
  readonly templateId: BuiltInPageTemplateId;
  readonly projectId: string;
  readonly pageId: string;
  readonly createdAt: string;
  readonly createLayerId: () => string;
}

interface BackgroundLayerSpec {
  readonly type: 'background';
  readonly name: string;
  readonly color: string;
}

interface ShapeLayerSpec {
  readonly type: 'shape';
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly cornerRadius?: number;
  readonly shape?: 'rectangle' | 'ellipse';
}

interface TextLayerSpec {
  readonly type: 'text';
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fontSize: number;
  readonly color: string;
  readonly fontWeight?: number;
  readonly align?: 'left' | 'center' | 'right';
  readonly lineHeight?: number;
  readonly maxWidth?: number | null;
  readonly active?: boolean;
}

type TemplateLayerSpec = BackgroundLayerSpec | ShapeLayerSpec | TextLayerSpec;

interface PageTemplateDefinition extends BuiltInPageTemplate {
  readonly layers: readonly TemplateLayerSpec[];
}

const PAGE_TEMPLATE_DEFINITIONS: Record<
  BuiltInPageTemplateId,
  PageTemplateDefinition
> = {
  opening: {
    id: 'opening',
    name: 'オープニング',
    description: '配信開始直後に使えるタイトル中心のイントロシーンです。',
    tags: ['intro', '開始', 'タイトル'],
    preview: {
      background: '#0B1020',
      accent: '#8B5CF6',
      foreground: '#F8FAFC',
    },
    layers: [
      { type: 'background', name: '背景', color: '#0B1020' },
      {
        type: 'shape',
        name: 'タイトルカード',
        x: 120,
        y: 170,
        width: 1680,
        height: 740,
        fill: '#111A33',
        stroke: '#26365F',
        strokeWidth: 4,
        cornerRadius: 44,
      },
      {
        type: 'shape',
        name: 'アクセントバー',
        x: 120,
        y: 170,
        width: 18,
        height: 740,
        fill: '#8B5CF6',
        stroke: '#8B5CF6',
        strokeWidth: 1,
        cornerRadius: 9,
      },
      {
        type: 'text',
        name: 'メインタイトル',
        x: 190,
        y: 310,
        text: 'LIVE BOARD',
        fontSize: 120,
        color: '#F8FAFC',
        fontWeight: 800,
        maxWidth: 1480,
        active: true,
      },
      {
        type: 'text',
        name: 'サブタイトル',
        x: 196,
        y: 470,
        text: '配信をはじめます',
        fontSize: 54,
        color: '#A78BFA',
        fontWeight: 600,
        maxWidth: 1480,
      },
      {
        type: 'text',
        name: '案内',
        x: 196,
        y: 800,
        text: 'WELCOME TO THE STREAM',
        fontSize: 30,
        color: '#94A3B8',
        fontWeight: 500,
        maxWidth: 1480,
      },
    ],
  },
  'starting-soon': {
    id: 'starting-soon',
    name: '配信開始待機',
    description: '開始前の待機画面としてそのまま使えるシーンです。',
    tags: ['starting soon', '待機', '開始前'],
    preview: {
      background: '#07111E',
      accent: '#22D3EE',
      foreground: '#F8FAFC',
    },
    layers: [
      { type: 'background', name: '背景', color: '#07111E' },
      {
        type: 'shape',
        name: '装飾サークル',
        x: 1320,
        y: 80,
        width: 520,
        height: 520,
        fill: '#0E7490',
        stroke: '#0E7490',
        strokeWidth: 1,
        shape: 'ellipse',
      },
      {
        type: 'shape',
        name: '待機カード',
        x: 210,
        y: 170,
        width: 1500,
        height: 740,
        fill: '#0F223A',
        stroke: '#164E63',
        strokeWidth: 3,
        cornerRadius: 48,
      },
      {
        type: 'text',
        name: 'メインタイトル',
        x: 210,
        y: 300,
        text: '配信開始まで\nお待ちください',
        fontSize: 94,
        color: '#F8FAFC',
        fontWeight: 800,
        align: 'center',
        lineHeight: 1.15,
        maxWidth: 1500,
        active: true,
      },
      {
        type: 'text',
        name: 'サブタイトル',
        x: 210,
        y: 610,
        text: 'STARTING SOON',
        fontSize: 34,
        color: '#67E8F9',
        fontWeight: 600,
        align: 'center',
        maxWidth: 1500,
      },
      {
        type: 'shape',
        name: 'アクセントライン',
        x: 520,
        y: 730,
        width: 880,
        height: 10,
        fill: '#22D3EE',
        stroke: '#22D3EE',
        strokeWidth: 1,
        cornerRadius: 5,
      },
    ],
  },
  talk: {
    id: 'talk',
    name: '雑談',
    description: 'コメントを見ながら話す配信向けの落ち着いたレイアウトです。',
    tags: ['chat', '雑談', 'トーク'],
    preview: {
      background: '#171827',
      accent: '#F59E0B',
      foreground: '#F8FAFC',
    },
    layers: [
      { type: 'background', name: '背景', color: '#171827' },
      {
        type: 'shape',
        name: 'サイドアクセント',
        x: 100,
        y: 120,
        width: 16,
        height: 840,
        fill: '#F59E0B',
        stroke: '#F59E0B',
        strokeWidth: 1,
        cornerRadius: 8,
      },
      {
        type: 'text',
        name: 'メインタイトル',
        x: 170,
        y: 150,
        text: '雑談タイム',
        fontSize: 92,
        color: '#F8FAFC',
        fontWeight: 800,
        maxWidth: 1500,
        active: true,
      },
      {
        type: 'text',
        name: 'サブタイトル',
        x: 175,
        y: 275,
        text: 'CHAT & TALK',
        fontSize: 30,
        color: '#FBBF24',
        fontWeight: 600,
        maxWidth: 1500,
      },
      {
        type: 'shape',
        name: 'コメントカード',
        x: 170,
        y: 720,
        width: 1580,
        height: 220,
        fill: '#24273B',
        stroke: '#3A3F5C',
        strokeWidth: 3,
        cornerRadius: 36,
      },
      {
        type: 'text',
        name: '案内',
        x: 230,
        y: 775,
        text: 'コメントを見ながら\nゆっくりお話しします',
        fontSize: 42,
        color: '#E2E8F0',
        fontWeight: 500,
        lineHeight: 1.35,
        maxWidth: 1460,
      },
    ],
  },
  break: {
    id: 'break',
    name: '休憩',
    description: '離席中に表示するシンプルな休憩シーンです。',
    tags: ['brb', '休憩', '離席'],
    preview: {
      background: '#0F172A',
      accent: '#60A5FA',
      foreground: '#F8FAFC',
    },
    layers: [
      { type: 'background', name: '背景', color: '#0F172A' },
      {
        type: 'shape',
        name: '装飾サークル',
        x: 1250,
        y: 100,
        width: 520,
        height: 520,
        fill: '#1D4ED8',
        stroke: '#1D4ED8',
        strokeWidth: 1,
        shape: 'ellipse',
      },
      {
        type: 'shape',
        name: 'アクセントライン',
        x: 200,
        y: 210,
        width: 90,
        height: 12,
        fill: '#60A5FA',
        stroke: '#60A5FA',
        strokeWidth: 1,
        cornerRadius: 6,
      },
      {
        type: 'text',
        name: 'メインタイトル',
        x: 200,
        y: 330,
        text: '少し休憩します',
        fontSize: 104,
        color: '#F8FAFC',
        fontWeight: 800,
        maxWidth: 1400,
        active: true,
      },
      {
        type: 'text',
        name: 'サブタイトル',
        x: 205,
        y: 490,
        text: 'BE RIGHT BACK',
        fontSize: 38,
        color: '#93C5FD',
        fontWeight: 600,
        maxWidth: 1400,
      },
      {
        type: 'text',
        name: '案内',
        x: 205,
        y: 760,
        text: 'まもなく戻ります',
        fontSize: 34,
        color: '#CBD5E1',
        fontWeight: 500,
        maxWidth: 1400,
      },
    ],
  },
  ending: {
    id: 'ending',
    name: 'エンディング',
    description: '配信終了時のお礼と締めのメッセージを表示します。',
    tags: ['ending', '終了', 'お礼'],
    preview: {
      background: '#0A0A0D',
      accent: '#EC4899',
      foreground: '#FAFAFA',
    },
    layers: [
      { type: 'background', name: '背景', color: '#0A0A0D' },
      {
        type: 'shape',
        name: '上アクセント',
        x: 280,
        y: 260,
        width: 1360,
        height: 6,
        fill: '#EC4899',
        stroke: '#EC4899',
        strokeWidth: 1,
        cornerRadius: 3,
      },
      {
        type: 'text',
        name: 'メインタイトル',
        x: 210,
        y: 350,
        text: 'ご視聴ありがとうございました',
        fontSize: 78,
        color: '#FAFAFA',
        fontWeight: 800,
        align: 'center',
        maxWidth: 1500,
        active: true,
      },
      {
        type: 'text',
        name: 'サブタイトル',
        x: 210,
        y: 500,
        text: 'THANKS FOR WATCHING',
        fontSize: 36,
        color: '#F9A8D4',
        fontWeight: 600,
        align: 'center',
        maxWidth: 1500,
      },
      {
        type: 'text',
        name: '案内',
        x: 210,
        y: 690,
        text: '次回の配信でまたお会いしましょう',
        fontSize: 34,
        color: '#D4D4D8',
        fontWeight: 500,
        align: 'center',
        maxWidth: 1500,
      },
      {
        type: 'shape',
        name: '下アクセント',
        x: 580,
        y: 820,
        width: 760,
        height: 6,
        fill: '#8B5CF6',
        stroke: '#8B5CF6',
        strokeWidth: 1,
        cornerRadius: 3,
      },
    ],
  },
};

export const BUILT_IN_PAGE_TEMPLATES: readonly BuiltInPageTemplate[] =
  Object.values(PAGE_TEMPLATE_DEFINITIONS).map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    tags: [...definition.tags],
    preview: { ...definition.preview },
  }));

export function createPageFromTemplate({
  templateId,
  projectId,
  pageId,
  createdAt,
  createLayerId,
}: CreatePageFromTemplateInput): Page {
  const definition = PAGE_TEMPLATE_DEFINITIONS[templateId];
  if (definition === undefined) {
    throw new Error(`Unknown page template: ${templateId}`);
  }

  const layers: Layer[] = [];
  const rootLayerIds: string[] = [];
  let activeLayerId: string | null = null;

  for (const spec of definition.layers) {
    const id = createLayerId();
    const layer = createTemplateLayer(spec, id, pageId, createdAt);
    layers.push(layer);
    rootLayerIds.push(id);
    if (spec.type === 'text' && spec.active) activeLayerId = id;
  }

  const layerDocument: LayerDocument = {
    layers,
    rootLayerIds,
    activeLayerId,
  };
  assertLayerDocumentIntegrity(pageId, layerDocument);

  return {
    ...createPage({
      id: pageId,
      projectId,
      name: definition.name,
      createdAt,
      updatedAt: createdAt,
    }),
    layerDocument,
  };
}

function createTemplateLayer(
  spec: TemplateLayerSpec,
  id: string,
  pageId: string,
  createdAt: string,
): Layer {
  if (spec.type === 'background') {
    const layer = createLayer({
      id,
      pageId,
      name: spec.name,
      type: 'background',
      movementLocked: true,
      content: { color: spec.color },
      createdAt,
      updatedAt: createdAt,
    });
    if (layer.type !== 'background') throw new Error('Invalid background layer');
    return layer as BackgroundLayer;
  }

  if (spec.type === 'shape') {
    const layer = createLayer({
      id,
      pageId,
      name: spec.name,
      type: 'shape',
      content: {
        shape: spec.shape ?? 'rectangle',
        fill: spec.fill,
        stroke: spec.stroke ?? spec.fill,
        strokeWidth: spec.strokeWidth ?? 1,
      },
      createdAt,
      updatedAt: createdAt,
    });
    if (layer.type !== 'shape') throw new Error('Invalid shape layer');
    const richLayer = withRichShapeContent(layer, {
      shape: spec.shape ?? 'rectangle',
      width: spec.width,
      height: spec.height,
      cornerRadius: spec.cornerRadius ?? 0,
      fill: spec.fill,
      stroke: spec.stroke ?? spec.fill,
      strokeWidth: spec.strokeWidth ?? 1,
    });
    return withTransform(richLayer, spec.x, spec.y);
  }

  const layer = createLayer({
    id,
    pageId,
    name: spec.name,
    type: 'text',
    content: {
      text: spec.text,
      fontFamily: 'sans-serif',
      fontSize: spec.fontSize,
      color: spec.color,
    },
    createdAt,
    updatedAt: createdAt,
  });
  if (layer.type !== 'text') throw new Error('Invalid text layer');
  const richLayer = withRichTextContent(layer, {
    text: spec.text,
    fontFamily: 'sans-serif',
    fontSize: spec.fontSize,
    fontWeight: spec.fontWeight ?? 400,
    align: spec.align ?? 'left',
    lineHeight: spec.lineHeight ?? 1.2,
    color: spec.color,
    maxWidth: spec.maxWidth ?? null,
  });
  return withTransform(richLayer, spec.x, spec.y);
}

function withTransform<T extends ShapeLayer | TextLayer>(
  layer: T,
  x: number,
  y: number,
): T {
  return {
    ...layer,
    transform: {
      x,
      y,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
  };
}
