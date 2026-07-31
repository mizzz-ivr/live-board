# Projectタブ設計

## 目的

Workspace内の複数ProjectをEditorで切り替え、作業対象を明確にします。タブを閉じる操作は表示セッションの整理であり、Projectデータの削除ではありません。

## 永続化される状態

`.liveboard`へ保存される正本は既存Workspaceモデルです。

- `projects`
- `activeProjectId`
- 各ProjectのPage・Layer・配信設定
- Project単位のAsset Library

Project追加・複製・選択・名前変更はWorkspaceを変更するため、既存のrevision検知、自動保存、明示保存へ合流します。保存形式とIPCは変更しません。

## Project操作のCommand履歴

Project追加・選択・名前変更は`WorkspaceCommand`として実行します。Project複製はPage・Layer IDを再採番したProjectを生成し、既存の`workspace.project.add`として実行します。

- `workspace.project.add`: Projectを追加して選択
- `workspace.project.select`: 既存Projectを選択
- `workspace.project.rename`: Project名を変更
- `Project操作を元に戻す`: 直近の追加・選択・名前変更をUndo
- `Project操作をやり直す`: Undoした操作をRedo

Workspace全体のSnapshotは履歴へ保存しません。Project追加履歴は次だけを保持します。

- 追加対象ProjectのSnapshot
- 操作前の`activeProjectId`
- Command metadata

追加ProjectをUndoするときは対象ProjectだけをWorkspaceから除去します。追加後に既存Projectへ加えたPage・Layer・Canvas編集は変更しません。一方、追加Project自身はUndo時点の内容をRedo用Snapshotへ更新するため、追加Projectを編集してからUndoしてもRedoで編集済み内容を復元できます。

Project選択履歴は操作前後のProject IDだけを保持します。選択変更も保存対象・OBS送信先を変更するDomain操作としてUndo / Redoできます。

Project名変更履歴は変更前の名前とCommand上の変更後の名前を保持します。Undo / RedoではProject ID、Page、Layer、Asset、配信設定を変更せず、名前と更新日時だけを切り替えます。

Workspace履歴は件数上限に加えて推定バイト数上限を適用します。履歴entryの推定サイズだけでなく、Redo可能なProjectに紐づいて保持する次の容量もProject単位で合算します。

- Asset Libraryの`totalBytes`
- Project / Page Command履歴の`estimatedBytes`
- Layer履歴の`estimatedBytes`
- Canvas履歴の`estimatedBytes`

上限超過時は古いRedo entryから破棄し、対応するProjectが復元不能になった後にAsset Libraryと関連履歴を一緒に回収します。

タブを閉じる、ピン留めする、並び替える操作はRendererセッション状態の変更だけであり、Workspace Command履歴には記録しません。

## 到達不能データの回収

Project追加をUndoした直後はRedo可能なため、追加Projectに紐づく次のデータを保持します。

- Project Asset Library
- Project / Page履歴
- Layer履歴
- Canvas履歴

その後に別のProject操作を実行してRedo分岐が破棄された場合、または関連履歴・Asset容量込みのWorkspace履歴上限によってRedo entryが削除された場合、現在のWorkspaceにもRedo履歴にも存在しないProjectを到達不能と判定し、上記データをRendererメモリから回収します。

## Rendererセッションだけの状態

次は同一Rendererプロセス内だけで保持します。

- 開いているProjectタブと表示順
- ピン留めしたProjectタブとピン留め領域内の順序
- 直近に閉じた通常タブと閉じる前の位置（最大10件）

タブを閉じても`workspace.projects`、Page、Layer、Asset、Undo / Redo履歴を削除しません。ピン留めタブは誤操作防止のため、ピン留め解除するまで閉じられません。

タブ状態は`AppV2`でEditorセッションとして保持します。そのため、ホームへ戻って「編集を続ける」を選んだ場合は、開いているタブ、並び順、ピン留め、復元履歴を維持します。

一方、Workspaceの新規作成、ファイル読込、最近使用からの読込、インポート、クラッシュ復元などでBundleを再適用した場合は、`workspaceSessionRevision`を更新します。同じWorkspace IDを再読込した場合でも、セッションrevisionの変更を検知して全Projectを元のProject順で開き直し、以前の並び順・ピン留め・閉じたタブ履歴を持ち越しません。

## ピン留めと並び替え

ピン留めタブは通常タブより左側へ表示します。

- ピン留めすると、対象タブをピン留め領域の末尾へ移動
- ピン留め解除すると、対象タブを通常タブ領域の先頭へ移動
- ピン留め領域内と通常タブ領域内では相対順を変更可能
- ピン留め境界を越えるドラッグ／キーボード移動は拒否
- 新規Projectは通常タブ領域の末尾へ追加
- 閉じた通常タブは、閉じる前の通常タブ領域内の位置へ復元

タブ順とピン留め状態はProject本体の順序を変更せず、`.liveboard`へ保存しません。

## 操作

- `＋`: 初期Pageを持つProjectを追加して選択
- `複製`: Page・Layer・描画・Asset参照・配信設定を保持した独立Projectを追加して選択
- `名前`: 1〜120文字のProject名へ変更
- `操作を元に戻す`: 直近のProject追加・選択・名前変更をUndo
- `操作をやり直す`: UndoしたProject操作をRedo
- タブクリック: `activeProjectId`をCommand経由で変更
- `ArrowLeft` / `ArrowRight`: 現在の表示順で開いているタブを循環
- `Home` / `End`: 表示順の先頭・末尾タブへ移動
- `Ctrl`または`Command`＋`Shift`＋左右キー: 同じピン領域内でタブを移動
- ドラッグ＆ドロップ: 同じピン領域内でタブを任意位置へ移動
- `固定` / `解除`: タブのピン留めを切り替え
- `×`: 通常タブを閉じる。最後の1件とピン留めタブは閉じられない
- `閉じたタブを復元`: 直近に閉じた通常タブをLIFOで復元して選択

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
- Project複製でPage・Layer IDと参照を再採番し、描画・Transform・Asset参照・配信設定を維持する
- Project複製をUndo / Redoでき、Redo可能な間はAsset Libraryを保持する
- Project名変更をUndo / Redoできる
- 無効なProject名をDomain境界で拒否する
- Workspace履歴が推定バイト数上限を超えない
- Redo可能なProjectのAsset容量をWorkspace履歴上限へ含める
- Redo可能なProjectのProject / Page / Layer / Canvas履歴容量をWorkspace履歴上限へ含める
- 容量超過でRedo entryが削除されたProjectを保持対象から外す
- Redo可能なProjectのAsset・Layer・Canvas履歴を保持する
- Redo分岐破棄後に到達不能データを回収する
- ピン留めタブを左側へ集約してCloseを拒否する
- ピン留め境界を越える並び替えを拒否する
- ドラッグとキーボードで同じ領域内を並び替えられる
- 閉じた通常タブを閉じる前の位置へ復元する
- ホーム往復では並び順とピン留め状態を維持する
- 同一Workspace ID再読込ではタブ状態を初期化する
- 選択Projectの配信PageをOBS IPCへ送信する

## エラー境界

Domain層で次を拒否します。

- 存在しないProjectの選択・名前変更
- 空文字、空白のみ、121文字以上のProject名
- 重複Project IDの追加
- 別Workspaceに属するProjectの追加
- 対象Workspace IDが一致しないWorkspace Command
- Workspace整合性を壊す更新

Rendererタブモデルでは次を無変更として扱います。

- 存在しないタブのピン留め・移動・Close
- ピン留め領域と通常タブ領域を越える移動
- 先頭より左、末尾より右へのキーボード移動
- 最後の1タブまたはピン留めタブのClose

## 対象外

- Project本体の削除
- Project本体の並び順変更
- タブ状態の永続化
- 別ウィンドウへの分離
- 複数Workspaceの同時編集
