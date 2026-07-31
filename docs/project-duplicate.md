# Project複製設計

## 目的

既存ProjectのPage・Layer・描画・Asset・配信設定を雛形として再利用しつつ、元Projectと独立して編集できる新しいProjectを作成します。

## 複製単位

Project複製では次をコピーします。

- Project名、Page構成、編集Page、配信Page、配信ロック
- Overlayテーマ、Transition、カスタムCSSを含む配信設定
- Pageの寸法、DPI、透過設定
- Layerの種類、内容、表示・ロック・合成設定
- Folder階層、Layer順、active Layer
- Raster描画、Transform、画像crop・反転などの拡張データ
- Project Asset Library

Project、Page、Layer、Asset Libraryは元データとオブジェクト参照を共有しません。

## ID変換

複製時に次のIDを再採番します。

- Project ID
- 全Page ID
- 全Layer ID

再採番に合わせて次の参照を更新します。

- `Page.projectId`
- `Project.activeEditPageId`
- `Project.activeBroadcastPageId`
- `Layer.pageId`
- `Layer.parentId`
- `FolderLayer.childLayerIds`
- `LayerDocument.rootLayerIds`
- `LayerDocument.activeLayerId`
- 現在のLayerを参照する`RasterLayer.content.sourceLayerIds`

生成IDが元IDと同じ場合、または複製内で重複した場合はDomain境界で拒否します。

Asset IDは画像内容のSHA-256から生成されるため再採番しません。複製したProject Asset Libraryへ同じAsset IDとバイナリを深いコピーし、Image／Raster Layerの参照を維持します。

## Commandと履歴

Project複製専用のWorkspace Commandは追加しません。再採番済みProjectを生成した後、既存の`workspace.project.add`としてWorkspace末尾へ追加し、複製Projectを選択します。

これにより既存の次の処理を再利用します。

- Project操作のUndo／Redo
- Undo時に複製Projectだけを除去する差分履歴
- Redo用Project Snapshotの保持
- Redo可能なProjectのAsset Library保持
- Redo分岐破棄後のProject／Page／Layer／Canvas履歴とAsset回収
- Workspace履歴の件数・推定バイト数上限

元ProjectのProject／Page／Layer／Canvas履歴は複製しません。

## Rendererセッション

複製Projectは通常タブ領域の末尾へ追加し、選択状態にします。元タブの並び順、ピン留め状態、閉じたタブ履歴は変更しません。

同一イベントループ内で複製操作が連続した場合も、最新のWorkspace Command Stateへ追加Commandを再適用し、先に追加されたProjectを失わないようにします。

## 永続化・OBS境界

Project複製は既存WorkspaceモデルとAsset Libraryへ合流するため、次は変更しません。

- `.liveboard` schema version
- Electron IPC contract
- OBS Protocol
- Broadcast Snapshot schema

複製後はWorkspace revisionと未保存状態が更新され、既存の自動保存・明示保存へ合流します。選択された複製Projectの配信Pageは、既存のOBS同期経路から送信されます。

## テスト境界

Unit Testでは次を固定します。

- 複数Pageとactive Page参照の再採番
- Folder親子関係、root／active Layer参照の再採番
- Raster描画、Transform、Asset参照の深いコピー
- 配信設定の深いコピー
- 120文字以内の複製名生成
- 元Project／Page／Layer IDの再利用拒否
- 複製内Page／Layer ID重複の拒否
- 複製後に元データを変更しないこと

Playwright E2Eでは次を確認します。

- タブからProjectを複製できる
- 複製Projectが選択される
- Page構成を維持する
- Workspace未保存表示へ反映する
- Undoで複製Projectだけを除去する
- Redoで複製Projectを復元する
- 既存のProject追加・選択・名前変更・固定・並び替えを壊さない

## 対象外

- Project削除
- 複製時の名前入力
- Project本体の並び順変更
- 元Projectの履歴コピー
- Asset IDの再採番
