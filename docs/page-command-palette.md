# Pageコマンドパレット

## 目的

`Ctrl/Cmd + K`で開くコマンドパレットから、現在ProjectのPage検索・切り替え・主要操作を実行できるようにします。

## 対応操作

- Page名検索と編集対象Pageへの切り替え
- Page追加
- 編集中Pageの複製
- Page名変更
- Page削除
- Pageを1つ上／下へ移動
- Page操作Undo／Redo

Page名変更は`page.rename`のProject Commandとして実装し、他のPage操作と同じProject履歴へ記録します。

## 安全性

- Page名はtrim後1〜120文字に制限します。
- `createRenamePageCommand`だけでなく、`applyProjectCommand`の適用時にも既存`createPage`を通してPage名のDomain不変条件を検証します。
- 同じPage名への変更はno-opとし、不要な履歴を追加しません。
- 最後の1Pageは削除できません。
- 先頭Pageの「上へ」と末尾Pageの「下へ」は無効です。
- コマンドパレットからのPage削除は確認ダイアログを経由します。
- 無効コマンドは理由を表示し、Arrowキー選択とEnter実行の対象外にします。

## テスト観点

- Page名変更のtrim・1〜120文字境界
- Page名変更のUndo／Redo
- 直接組み立てた不正な`page.rename` Commandの適用拒否
- Page検索と編集対象切り替え
- Page追加・複製・名前変更・削除・上下移動
- Page削除確認のキャンセル／実行
- 最後の1Page削除不可、先頭／末尾移動不可
- 既存Projectコマンド検索の回帰

## 変更しない範囲

- `.liveboard`スキーマ
- Workspace保存形式
- Electron IPC
- OBS Protocol
- Broadcast Snapshot
