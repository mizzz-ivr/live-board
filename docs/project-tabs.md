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

## Project追加のCommand履歴

Project追加は`WorkspaceCommand`として実行します。

- 追加後はWorkspace履歴からUndoできる
- Undo後はRedoできる
- Undo時点のWorkspace全体をRedo用Snapshotとして保持する
- 追加Projectを編集した後にUndoしても、Redoで編集済み内容を復元する
- 既存Project、Page、Layer、Canvasの履歴は別の履歴境界として維持する

タブを閉じる操作はRendererセッション状態の変更だけであり、Workspace Command履歴には記録しません。

## Rendererセッションだけの状態

次は同一Rendererプロセス内だけで保持します。

- 開いているProjectタブ
- 直近に閉じたProjectタブ（最大10件）

タブを閉じても`workspace.projects`、Page、Layer、Asset、Undo / Redo履歴を削除しません。

タブ状態は`AppV2`でEditorセッションとして保持します。そのため、ホームへ戻って「編集を続ける」を選んだ場合は、開いているタブと復元履歴を維持します。

一方、Workspaceの新規作成、ファイル読込、最近使用からの読込、インポート、クラッシュ復元などでBundleを再適用した場合は、`workspaceSessionRevision`を更新します。同じWorkspace IDを再読込した場合でも、セッションrevisionの変更を検知して全Projectをタブとして開き直し、以前の閉じたタブ履歴を持ち越しません。

## 操作

- `＋`: 初期Pageを持つProjectを追加して選択
- `追加を元に戻す`: 直近のProject追加をUndo
- `追加をやり直す`: UndoしたProject追加をRedo
- タブクリック: `activeProjectId`を変更
- `ArrowLeft` / `ArrowRight`: 開いているタブを循環
- `Home` / `End`: 先頭・末尾タブへ移動
- `×`: タブを閉じる。最後の1件は閉じられない
- `閉じたタブを復元`: 直近に閉じたタブをLIFOで復元して選択

## 未保存表示

保存単位はWorkspace全体です。Project単位の保存済み状態は持たないため、タブ領域にはWorkspace全体の未保存状態を表示し、アクティブタブへ同じ状態のマーカーを付けます。

## OBS同期

Project選択で`activeProjectId`が変わると、選択Projectの配信Pageを新しいSnapshotとして送信します。Projectごとの`activeBroadcastPageId`と配信ロック状態は維持されます。

OBS同期は`publishActiveProjectBroadcastSnapshot`へ集約し、Workspaceの`activeProjectId`からSnapshotを生成します。IPC境界の統合テストでは、Project 2を選択した状態で、公開されるSnapshot descriptorにProject 2のIDと配信Page IDが含まれることを確認します。

## エラー境界

Domain層で次を拒否します。

- 存在しないProjectの選択
- 重複Project IDの追加
- 別Workspaceに属するProjectの追加
- 対象Workspace IDが一致しないWorkspace Command
- Workspace整合性を壊す更新

## 対象外

- Project本体の削除、名前変更、複製
- タブのピン留め、ドラッグ並び替え
- 閉じたタブ状態の永続化
- 別ウィンドウへの分離
- 複数Workspaceの同時編集
