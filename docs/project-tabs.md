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

## Project操作のCommand履歴

Project追加とProject選択は`WorkspaceCommand`として実行します。

- `workspace.project.add`: Projectを追加して選択
- `workspace.project.select`: 既存Projectを選択
- `Project操作を元に戻す`: 直近の追加または選択をUndo
- `Project操作をやり直す`: Undoした操作をRedo

Workspace全体のSnapshotは履歴へ保存しません。Project追加履歴は次だけを保持します。

- 追加対象ProjectのSnapshot
- 操作前の`activeProjectId`
- Command metadata

追加ProjectをUndoするときは対象ProjectだけをWorkspaceから除去します。追加後に既存Projectへ加えたPage・Layer・Canvas編集は変更しません。一方、追加Project自身はUndo時点の内容をRedo用Snapshotへ更新するため、追加Projectを編集してからUndoしてもRedoで編集済み内容を復元できます。

Project選択履歴は操作前後のProject IDだけを保持します。選択変更も保存対象・OBS送信先を変更するDomain操作としてUndo / Redoできます。

Workspace履歴は件数上限に加えて推定バイト数上限を適用します。履歴entryの推定サイズだけでなく、Redo可能なProjectに紐づいて保持するAsset Libraryの`totalBytes`も合算します。上限超過時は古いRedo entryから破棄し、対応するProjectが復元不能になった後にAsset Libraryと関連履歴を回収します。

タブを閉じる操作はRendererセッション状態の変更だけであり、Workspace Command履歴には記録しません。

## 到達不能データの回収

Project追加をUndoした直後はRedo可能なため、追加Projectに紐づく次のデータを保持します。

- Project Asset Library
- Project / Page履歴
- Layer履歴
- Canvas履歴

その後に別のProject操作を実行してRedo分岐が破棄された場合、またはAsset容量込みのWorkspace履歴上限によってRedo entryが削除された場合、現在のWorkspaceにもRedo履歴にも存在しないProjectを到達不能と判定し、上記データをRendererメモリから回収します。

## Rendererセッションだけの状態

次は同一Rendererプロセス内だけで保持します。

- 開いているProjectタブ
- 直近に閉じたProjectタブ（最大10件）

タブを閉じても`workspace.projects`、Page、Layer、Asset、Undo / Redo履歴を削除しません。

タブ状態は`AppV2`でEditorセッションとして保持します。そのため、ホームへ戻って「編集を続ける」を選んだ場合は、開いているタブと復元履歴を維持します。

一方、Workspaceの新規作成、ファイル読込、最近使用からの読込、インポート、クラッシュ復元などでBundleを再適用した場合は、`workspaceSessionRevision`を更新します。同じWorkspace IDを再読込した場合でも、セッションrevisionの変更を検知して全Projectをタブとして開き直し、以前の閉じたタブ履歴を持ち越しません。

## 操作

- `＋`: 初期Pageを持つProjectを追加して選択
- `操作を元に戻す`: 直近のProject追加またはProject選択をUndo
- `操作をやり直す`: UndoしたProject操作をRedo
- タブクリック: `activeProjectId`をCommand経由で変更
- `ArrowLeft` / `ArrowRight`: 開いているタブを循環
- `Home` / `End`: 先頭・末尾タブへ移動
- `×`: タブを閉じる。最後の1件は閉じられない
- `閉じたタブを復元`: 直近に閉じたタブをLIFOで復元して選択

## 未保存表示

保存単位はWorkspace全体です。Project単位の保存済み状態は持たないため、タブ領域にはWorkspace全体の未保存状態を表示し、アクティブタブへ同じ状態のマーカーを付けます。

## OBS同期

Project選択で`activeProjectId`が変わると、選択Projectの配信Pageを新しいSnapshotとして送信します。Projectごとの`activeBroadcastPageId`と配信ロック状態は維持されます。

OBS同期は`publishActiveProjectBroadcastSnapshot`へ集約し、Workspaceの`activeProjectId`からSnapshotを生成します。IPC境界の統合テストでは、Project 2を選択した状態で、公開されるSnapshot descriptorにProject 2のIDと配信Page IDが含まれることを確認します。

## 回帰テスト境界

以下を自動テストで固定します。

- Project追加Undoで既存Projectの後続編集を失わない
- 追加Projectの編集内容をRedoで復元する
- Project選択をUndo / Redoできる
- Workspace履歴が推定バイト数上限を超えない
- Redo可能なProjectのAsset容量をWorkspace履歴上限へ含める
- 容量超過でRedo entryが削除されたProjectを保持対象から外す
- Redo可能なProjectのAsset・Layer・Canvas履歴を保持する
- Redo分岐破棄後に到達不能データを回収する
- ホーム往復ではタブ状態を維持する
- 同一Workspace ID再読込ではタブ状態を初期化する
- 選択Projectの配信PageをOBS IPCへ送信する

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
