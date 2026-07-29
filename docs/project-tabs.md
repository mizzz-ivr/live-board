# Projectタブ設計

## 目的

Workspace内の複数ProjectをEditorで切り替え、作業対象を明確にします。タブを閉じる操作は表示セッションの整理であり、Projectデータの削除ではありません。

## 永続化される状態

`.liveboard`へ保存される正本は既存Workspaceモデルです。

- `projects`
- `activeProjectId`
- 各ProjectのPage・Layer・配信設定
- Project単位のAsset Library

Project追加とProject選択はWorkspaceを変更するため、既存のrevision検知、自動保存、明示保存へ合流します。保存形式とIPCは変更しません。

## Rendererセッションだけの状態

次は同一Rendererプロセス内だけで保持します。

- 開いているProjectタブ
- 直近に閉じたProjectタブ（最大10件）

タブを閉じても`workspace.projects`、Page、Layer、Asset、Undo / Redo履歴を削除しません。Workspaceを開き直すと全Projectをタブとして表示します。

## 操作

- `＋`: 初期Pageを持つProjectを追加して選択
- タブクリック: `activeProjectId`を変更
- `ArrowLeft` / `ArrowRight`: 開いているタブを循環
- `Home` / `End`: 先頭・末尾タブへ移動
- `×`: タブを閉じる。最後の1件は閉じられない
- `閉じたタブを復元`: 直近に閉じたタブをLIFOで復元して選択

## 未保存表示

保存単位はWorkspace全体です。Project単位の保存済み状態は持たないため、タブ領域にはWorkspace全体の未保存状態を表示し、アクティブタブへ同じ状態のマーカーを付けます。

## OBS同期

Project選択で`activeProjectId`が変わると、既存のOBS同期effectが選択Projectの配信Pageを新しいSnapshotとして送信します。Projectごとの`activeBroadcastPageId`と配信ロック状態は維持されます。

## エラー境界

Domain層で次を拒否します。

- 存在しないProjectの選択
- 重複Project IDの追加
- 別Workspaceに属するProjectの追加
- Workspace整合性を壊す更新

## 対象外

- Project本体の削除、名前変更、複製
- タブのピン留め、ドラッグ並び替え
- 閉じたタブ状態の永続化
- 別ウィンドウへの分離
- 複数Workspaceの同時編集
