# マイPageテンプレート Import設計

## 目的

`.liveboard-template`を未信頼入力として検証し、Assetを含むマイPageテンプレートを別環境から安全に取り込めるようにする。

Export元がLive Board自身であってもファイル内容は信頼せず、全検証が完了するまでlocalStorage / IndexedDBの正式状態へ反映しない。

## 対象

- PR #61で定義した`.liveboard-template` schema version 1
- Assetなしテンプレート
- PNG / JPEG / WebP / GIF静止画 / SVG Asset付きテンプレート
- Export時の既存上限内のデータ

## 対象外

- 未知のExport schema version
- 複数ファイルの一括Import
- 名前重複時の自動リネーム・上書き
- 動画・音声Asset
- クラウド同期、チーム共有

## 検証順序

Importは次の順番で処理する。

1. `File.size`を確認し、2MiB超過を`arrayBuffer()`前に拒否
2. magic `LIVEBOARD_PAGE_TEMPLATE\0`をbyte単位で完全一致確認
3. `manifestLength`をuint32 little-endianとして読み取る
4. manifestが1byte以上512KiB以下かつファイル境界内であることを確認
5. manifestをfatal UTF-8 decodeし、JSON parse
6. `kind` / `schemaVersion` / `exportedAt`を検証
7. 既存`UserPageTemplate` Runtime Validationを一時メモリStorage経由で再利用
8. `assetPayloads`を検証
9. raw payloadだけを保持する一時読み取り専用Payload Storeを構築
10. 既存Asset Runtime ValidationでSHA-256 / MIME / 寸法 / byteLength / SVG sanitize結果を再確認
11. 全検証成功後に新しい`user-template:*` IDでローカルsnapshotを再生成
12. Asset binaryをIndexedDBへ保存
13. template metadataをlocalStorageへ保存
14. 保存失敗時は既存GC経路で未参照Asset binaryを回収

## Asset payload境界

`assetPayloads`には以下を要求する。

- metadataのAsset件数と完全一致
- `assetId`重複なし
- metadataに存在しない`assetId`を拒否
- `offset`は0以上のsafe integer
- `byteLength`は1以上のsafe integer
- metadataの`byteLength`と一致
- payload領域からのout-of-boundsを拒否
- rangeの重複を拒否
- payload領域のgapを拒否
- 末尾の未参照binaryを拒否

Exportが生成するcanonical bundleだけを受理することで、parser differentialや隠しpayloadを持つ非正規ファイルを正式状態へ入れない。

## 外部IDを採用しない理由

Import manifest内の`template.id`、Page ID、Layer IDは外部入力である。

Runtime Validationでは構造確認のため一時的に読み取るが、正式保存時には`createUserPageTemplate`を再実行し、以下をローカルで再生成する。

- `user-template:*` ID
- template snapshot用Project ID
- template snapshot用Page ID
- 全Layer IDと内部参照
- `createdAt` / `updatedAt`
- preview

これにより別環境から持ち込まれたIDの衝突や、外部IDを内部状態へ固定することを避ける。

## 保存とロールバック

Importは既存のマイテンプレートmutation queueへ統合し、保存・削除・復元と直列化する。

永続化順序は以下とする。

```plain text
完全検証
  ↓
新規ローカルsnapshot生成
  ↓
Asset binary → IndexedDB
  ↓
template metadata → localStorage
```

localStorage保存に失敗した場合、既存template metadataは変更されず、先に保存した未参照Asset binaryはbest-effort GCで回収する。

名前重複は既存`saveUserPageTemplate`の検証で拒否し、既存テンプレートを暗黙上書きしない。

## UI / アクセシビリティ

PageテンプレートDialogの「マイテンプレート」見出しへ「読み込む」を追加する。

- ファイル選択は`.liveboard-template`を案内
- 同一ファイルの再選択を可能にするため選択後にinput valueをクリア
- Import中はDialog全体をbusy状態にする
- Export / 保存 / 削除 / 復元 / Page作成との同時操作を抑止
- 既存`aria-busy`と`role="status" aria-live="polite"`で処理状態を通知
- 保存領域が利用できない場合はImportボタンも無効化

## テスト観点

正常系:

- AssetなしExport → Import
- Asset付きExport → Import
- Import後に新しいtemplate / Page / Layer IDへ再生成
- Import済みAssetから別ProjectでPageを作成可能

異常系・境界値:

- 2MiB超過をファイル読み込み前に拒否
- magic不一致
- 未知schema version
- 壊れたJSON / 非UTF-8 manifest
- manifest length不正 / out-of-bounds
- Asset集合不一致
- offset / byteLength不正
- payload overlap / gap / out-of-bounds / trailing binary
- Asset SHA改ざん
- MIME / 画像形式 / SVG安全性不正
- 名前重複
- localStorage保存失敗後に既存状態を保持

回帰:

- マイテンプレート保存・削除・復元
- Export
- Asset付きテンプレートからPage作成
- Dialogのfocus / busy / status表示
