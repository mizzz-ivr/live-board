# Project削除 受け入れ条件

Project削除機能は、次を満たした状態を完了とします。

- 削除確認をキャンセルした場合、Workspace・タブ・履歴を変更しない
- 削除確認を承認した場合だけ対象Projectを削除する
- 最後の1Projectでは削除ボタンを無効化し、Domainでも削除を拒否する
- アクティブProject削除時は残存Projectへ安全に切り替える
- 非アクティブProject削除時は現在の選択を維持する
- UndoでProjectの内容・元位置・削除前の選択状態を復元する
- Undo後に編集してからRedoした場合、次のUndoで最新内容を復元する
- 削除ProjectがUndo可能な間はAssetと関連履歴を保持する
- 復元不能になったProjectのAssetと関連履歴をメモリ上へ残さない
- `.liveboard`、Electron IPC、OBS Protocolの形式を変更しない
- Develop CIとWindows Packageを同一headで成功させる
