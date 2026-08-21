# Layerパネル検索・絞り込み設計

## 目的

Layer数が増えたPageでも目的のLayerへ素早く到達できるよう、Layerパネルへ名前検索・種類・表示状態の絞り込みを追加する。

`docs/product-requirements.md` 5.5 のMVP要件「検索、絞り込み」を対象とする。

## 責務境界

検索条件はRenderer UI状態であり、Domainの`LayerDocument`を変更しない。

変更しないもの:

- `.liveboard`保存形式
- Workspace revision / 未保存判定
- Layer Command / Undo / Redo
- OBS Protocol / Broadcast Snapshot
- Project Asset Library

検索・絞り込みによってLayer自体を追加・削除・並び替えず、表示対象だけを派生させる。

## 検索仕様

Layer名だけを検索対象とする。

1. Unicode NFKC正規化
2. 小文字化
3. 連続空白を1文字へ正規化
4. 前後空白を除去
5. 空白区切りの複数語をAND条件で照合

曖昧一致、翻訳、Text Layer本文などの内容全文検索は行わない。

## 絞り込み条件

### 種類

- すべて
- ラスター
- テキスト
- 画像
- 図形
- 背景
- フォルダー

### 表示状態

- すべて
- 表示
- 非表示

名前・種類・表示状態はすべてAND条件で組み合わせる。

## Folder階層

子Layerが検索条件へ直接一致した場合、そのLayerへ到達するための祖先Folderを表示対象へ追加する。

祖先Folderは「検索一致件数」には含めず、階層コンテキストとしてのみ表示する。

例:

```text
Folder A
└── Folder B
    ├── Target Text
    └── Other Text
```

`Target`で検索した場合:

```text
Folder A       <- 文脈表示
└── Folder B   <- 文脈表示
    └── Target Text <- 直接一致
```

表示順は既存`listLayersInPaintOrder`の順序を保持する。

## 既存操作との関係

- 検索結果からLayerを選択した場合も既存`layer.select` Commandを使用する
- 表示切り替えも既存`layer.update` Commandを使用する
- 親Folderの選択肢は絞り込み前の全Folderから生成する
- 検索条件変更はLayer履歴へ記録しない
- Page切り替え時の結合対象選択クリアは既存仕様を維持する
- 検索条件そのものはRenderer内で保持し、Workspaceへ保存しない

### 結合対象と絞り込み

結合対象チェックは既存Renderer UI状態として保持する。フィルター変更だけを理由に暗黙解除しない。

一方、選択済みの結合対象が1件でも絞り込み外になった場合は「選択を結合」を無効化し、件数statusへ「結合対象N件が絞り込み外」と表示する。

これにより、画面から見えないLayerを誤って結合することを防ぎつつ、絞り込み解除後は元の選択状態から操作を再開できる。

## アクセシビリティ

- 名前検索はlabel付き`search` inputを使用する
- 種類・表示状態はlabel付き`select`を使用する
- 一致件数と絞り込み外の結合対象数は`role="status"` / `aria-live="polite"`で通知する
- 0件時は「条件に一致するレイヤーはありません」と明示する
- 解除操作はフィルター未設定時に無効化する
- 既存Layer listの`role="tree"` / `role="treeitem"`を維持する

## 性能

検索は現在PageのLayer一覧に対する線形処理とする。

- 直接一致判定: O(n)
- Layer ID map構築: O(n)
- 祖先探索: 通常のFolder深度に比例
- 最終paint order抽出: O(n)
- 絞り込み外の結合対象検出: O(n)

Domain側の最大Layer数を前提とし、検索用indexや永続キャッシュは導入しない。将来計測で必要性が確認された場合のみ最適化する。

## テスト観点

### Unit Test

- NFKC / 大文字小文字 / 空白正規化
- 複数語AND
- 種類フィルター
- 表示状態フィルター
- 条件組み合わせ
- 子Layer一致時の祖先Folder保持
- unrelated siblingを含めない
- 0件
- 入力paint orderを変更しない

### E2E

- Layer名検索
- Folder配下Layer検索時の祖先表示
- 種類×表示状態フィルター
- 0件表示
- フィルター解除
- 既存Layer選択・表示切り替えの回帰
- 結合対象が絞り込み外にある場合の選択結合抑止
- 絞り込み解除後の選択結合復帰
