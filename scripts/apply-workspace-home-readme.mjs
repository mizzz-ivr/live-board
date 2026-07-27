import { readFile, writeFile } from 'node:fs/promises';

const path = 'README.md';
let source = await readFile(path, 'utf8');

function replaceOnce(before, after) {
  if (!source.includes(before)) {
    throw new Error(`README_WORKSPACE_HOME_TARGET_NOT_FOUND: ${before.slice(0, 80)}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  'M3「保存・復旧・性能・配信操作性」に加え、画像Asset分離配信、Renderer–Main／OBS OverlayのLayer差分転送、Windows向け未署名RCパッケージ生成まで実装しています。',
  'M3「保存・復旧・性能・配信操作性」に加え、画像Asset分離配信、Renderer–Main／OBS OverlayのLayer差分転送、Windows向け未署名RCパッケージ生成、起動時のWorkspaceホームまで実装しています。',
);

replaceOnce(
  '- 最近使用、お気に入り、複製、インポート',
  '- 起動直後のWorkspaceホーム、新規作成、最近使用、お気に入り、クラッシュ復元\n- 最近使用、お気に入り、複製、インポート',
);

replaceOnce(
  'RendererからNode.js APIへ直接アクセスできない構成です。\n\n### Windows配布パッケージ',
  'RendererからNode.js APIへ直接アクセスできない構成です。\n\n### Workspaceホーム\n\n通常起動では最初にWorkspaceホームを表示します。\n\n- 新しいWorkspaceを作成\n- `.liveboard`ファイルを選択して開く\n- 最近使用したWorkspaceをお気に入り優先で表示\n- 検証済みクラッシュ復元候補を復元・破棄\n- 未保存の編集セッションをメモリ上に保持してホームとEditorを往復\n- Browser PreviewではファイルI/Oと復元操作を無効化\n\nホーム表示中は配信ショートカットとRendererからMainへのOBS同期を停止し、Editorへ戻った時点で最新状態を再同期します。詳細は[ワークスペースホーム設計](docs/workspace-home.md)を参照してください。\n\n### Windows配布パッケージ',
);

replaceOnce(
  '- Windowsパッケージはコード未署名で、SmartScreen reputationを持ちません。正式配布には署名・リリース手順・ロールバック方針が必要です。',
  '- Workspaceホームは同一Renderer内の編集セッションを1件だけ保持します。複数Workspaceの同時編集、ファイル削除、OS上の名前変更は未対応です。\n- Windowsパッケージはコード未署名で、SmartScreen reputationを持ちません。正式配布には署名・リリース手順・ロールバック方針が必要です。',
);

replaceOnce(
  '- [永続化・自動保存・クラッシュ復元](docs/persistence.md)',
  '- [永続化・自動保存・クラッシュ復元](docs/persistence.md)\n- [ワークスペースホーム](docs/workspace-home.md)',
);

await writeFile(path, source);
