# Pageテンプレートギャラリー

## 目的

空のPageを毎回ゼロから組み立てるのではなく、配信でよく使うシーンをビルトインテンプレートから作成できるようにします。

テンプレートは専用の保存形式ではありません。作成時に既存のPage / Layer構造へ展開し、その後は通常のPageとして編集・保存・配信します。

## ビルトインテンプレート

- オープニング
- 配信開始待機
- 雑談
- 休憩
- エンディング

各テンプレートは背景・図形・テキストLayerを含みます。画像Assetや外部URLへ依存しないため、オフラインでも同じ構成を生成できます。

## 操作導線

### Pageパネル

ページ見出しの「テンプレート」からギャラリーを開き、任意のシーンを選択します。アクセシブル名は既存の「ページを追加」と競合しないよう「Pageテンプレートを開く」としています。

### コマンドパレット

`Ctrl/Cmd + K`で「テンプレートからPageを作成」を検索すると、同じギャラリーを開けます。

## 履歴

テンプレートから生成したPageは既存の`page.add` CommandでProjectへ追加します。

そのため:

- Page操作Undoで作成前へ戻せる
- Page操作Redoで同じPage / Layer構造を復元できる
- テンプレート専用Undo履歴は追加しない

## データ設計

テンプレート定義はDesktop側のビルトインコンテンツとして保持します。

生成時に以下を行います。

1. Page IDを新規生成
2. 各Layer IDを新規生成
3. background / shape / text Layerを生成
4. TransformとRich Layer Contentを設定
5. `assertLayerDocumentIntegrity`でLayerDocumentを検証
6. 検証済みPageを`page.add`で追加

保存時には既存Page / Layerデータだけが`.liveboard`へ保存されます。テンプレートIDやテンプレート定義そのものは保存しません。

## 安全性

- Layer ID重複はDomain整合性検証で拒否します。
- テンプレートダイアログはネイティブ`dialog`で表示します。
- 表示中は背面Projectショートカットを実行しません。
- Esc、閉じるボタン、背景クリックで閉じます。
- 閉じた後はPageパネルまたはコマンドパレットの起点へフォーカスを戻します。
- 生成に失敗した場合はPageを追加せず、ダイアログを開いたままエラーを表示できる状態を維持します。

## テスト観点

- 5テンプレートすべてのLayerDocument整合性
- background / shape / text Layerの生成
- Layer ID重複拒否
- 既存Broadcast Snapshotへの変換
- `page.add`履歴によるUndo / Redo
- Pageパネルとコマンドパレットの両導線
- ダイアログ表示中の背面ショートカット抑止
- Esc後のフォーカス復帰
- 既存「ページを追加」操作の回帰

## 変更しない範囲

- `.liveboard` schema
- Workspace保存形式
- Electron IPC
- OBS Protocol
- Asset保存形式
- Projectタブ永続化形式

## 将来拡張

初回実装ではビルトインのみです。将来ユーザーテンプレートを追加する場合は、既存Workspace Archiveへ直接テンプレート定義を混在させず、独立したテンプレート保存境界を設計します。
