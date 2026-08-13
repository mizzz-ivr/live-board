# マイPageテンプレート

## 目的

ユーザーが編集したPageをマイテンプレートとして端末内に保存し、別Project・別Workspaceでも再利用できるようにします。

ビルトインテンプレートとは異なり、マイテンプレートはユーザー操作で増減するアプリローカルデータです。Workspace本体とはライフサイクルが異なるため、`.liveboard`アーカイブへ混在させません。

## 保存境界

マイテンプレートはDesktop Rendererのローカルストアへ、次のキーで保存します。

`live-board:user-page-templates:v1`

保存データにはschema versionを持たせ、Workspace保存・Autosave・Recoveryとは独立させます。`localStorage`は外部入力境界として扱い、読み込み時に型アサーションだけへ依存せずLayer実データをRuntime Validationします。

初期制限は以下です。

- 最大50件
- 1テンプレート最大256KiB
- 全テンプレート合計最大2MiB
- 直前に削除した復元候補1件も合計容量へ含める
- テンプレート名は1〜80文字
- NFKC正規化・大文字小文字を無視した同名保存は禁止

## 保存時の処理

現在の編集Pageをそのまま保存せず、一度テンプレート専用IDへ変換します。

1. Page / LayerDocumentの整合性を検証
2. Asset参照可否を検証
3. Page ID / Project IDをテンプレート専用IDへ変更
4. 全Layer IDをテンプレート専用IDへ再採番
5. `parentId`を再マップ
6. Folderの`childLayerIds`を再マップ
7. `rootLayerIds`を再マップ
8. `activeLayerId`を再マップ
9. Rasterの`sourceLayerIds`を再マップ
10. 再度LayerDocument整合性を検証
11. 件数・1件容量・合計容量を検証して保存

この処理により、元Workspace / 元Project / 元Pageの内部IDをマイテンプレートへ持ち込みません。

## 再利用時の処理

マイテンプレートからPageを作る際は、保存時のテンプレート専用IDを現在Project向けの新規IDへもう一度変換します。

- 新規Page IDを生成
- 全Layer IDを新規生成
- Layer内のID参照をすべて新IDへ再マップ
- 現在Project IDへ付け替え
- LayerDocument整合性を検証
- 既存`page.add` Commandで追加

そのため、テンプレート作成専用のPage履歴は追加せず、通常のPage追加と同じUndo / Redoを利用します。

## Assetの扱い

初期版では、`image`または`raster` Layerが`assetId`を参照しているPageは保存できません。

理由は、Project Asset LibraryがProject単位で管理されており、Layerだけを別Projectへ移すとAsset参照切れが発生するためです。

`assetId`が`null`のLayerは保存可能です。Rasterの`sourceLayerIds`は、現在も存在するLayer IDだけを再マップします。Layer結合で削除済みになった履歴IDは生成Pageへ持ち込みません。

将来Asset付きテンプレートへ対応する場合は、Asset binary / metadataの複製、SHA重複排除、容量制限、Project Asset Libraryへの登録を同一トランザクションとして設計します。

## 破損データへの対応

- JSON全体が解析不能な場合は空状態へ復旧
- schema versionが将来版の場合は原本を変更せず機能を停止
- schema version自体が欠損・不正な場合は空状態へ復旧
- 一部エントリだけ不正な場合は、そのエントリだけ除外
- Layerのtype / content / transform / Raster drawingを実行時検証し、描画不能なエントリを除外
- 重複ID / 重複名は後続エントリを除外
- 件数・容量上限を超えるエントリは除外
- 復旧できた正常データは可能な範囲でストアへ書き戻す
- localStorage自体を利用できない場合は、アプリ本体を止めずマイテンプレート機能だけを利用不可にする

## UI

Pageテンプレートギャラリーを次の3領域に分けます。

1. 現在のPageを保存
2. ビルトインテンプレート
3. マイテンプレート

マイテンプレートでは以下を行えます。

- 現在Pageを名前付きで保存
- 保存済みテンプレートからPage作成
- 保存済みテンプレート削除
- 直前に削除した1件を永続ストアから復元
- 保存件数確認
- 保存不可理由・復旧メッセージ確認

削除はPage操作履歴とは別のローカル設定変更なので確認ダイアログを表示します。直前に削除した1件はストア内に復元候補として保持し、「削除を元に戻す」で再読込後も復元できます。次の削除が行われると復元候補は更新されます。

## コマンドパレット

既存の「テンプレートからPageを作成」コマンドから同じギャラリーを開きます。

検索語として以下を追加します。

- `my template`
- `マイテンプレート`
- `保存`
- `再利用`

新しいグローバルショートカットは追加しません。

## 変更しない範囲

- `.liveboard` schema
- Workspace Autosave / Recovery
- Electron IPC
- OBS Protocol
- Project Asset Library形式
- Projectタブ永続化形式
- Workspace Command履歴

## テスト観点

### Unit

- 保存時・再利用時の二段階ID再採番
- Folder / root / active / Raster参照の再マップ
- 結合済みRasterの削除済み履歴IDを除外
- LayerDocument整合性
- Layer type / Rich Content / Transform / Raster drawingのRuntime Validation
- Asset参照Pageの保存拒否
- 保存 / 再読込 / 削除 / 削除復元
- 未対応schemaの原本保持
- NFKC同名拒否
- JSON全体破損からの復旧
- 一部エントリ破損時の正常データ保持
- コマンドパレット検索

### E2E

- ビルトインPageを作成
- 現在Pageをマイテンプレートへ保存
- reload後もマイテンプレートが残る
- マイテンプレートからPageを再生成
- Layer構成が復元される
- マイテンプレートを確認付きで削除
- 削除後にreloadしても直前の1件を復元できる
- 既存ビルトインテンプレート、Undo / Redo、コマンドパレット、Project操作の回帰

## 将来拡張

優先候補は次の通りです。

1. Asset付きマイテンプレート
2. マイテンプレート名変更・複製
3. タグ・検索・お気に入り
4. テンプレートExport / Import
5. チーム共有・クラウド同期