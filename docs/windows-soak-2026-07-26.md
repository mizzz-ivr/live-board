# Windows packaged soak test 実測レポート

## 実施情報

- 実施日: 2026-07-26
- GitHub Actions run: `30185070266`
- 対象head: `1278096d7b3e8a032d1474ed6dc047d9320c8daf`
- Runner: Windows Server 2025
- Electron: 43.1.1
- 反復回数: 100

## 結果

| 項目 | 実測 | 品質ゲート | 判定 |
|---|---:|---:|---|
| 成功回数 | 100 / 100 | 100 / 100 | 成功 |
| Overlay HTTP | 200 | 全反復200 | 成功 |
| p95所要時間 | 25.211ms | 15秒以内 | 成功 |
| 最大所要時間 | 69.592ms | 15秒以内 | 成功 |
| 初回RSS | 71,589,888byte（68.27MiB） | 比較元 | - |
| 最終RSS | 90,386,432byte（86.20MiB） | 増加128MiB以内 | 成功 |
| 最大RSS | 90,386,432byte（86.20MiB） | 増加256MiB以内 | 成功 |
| RSS増加 | 18,796,544byte（17.93MiB） | 128MiB以内 | 成功 |

永続化初期化、loopback OBS Bridge起動、Overlay HTTP取得、Bridge終了、一時領域削除を同一Electron Mainプロセスで100回完了しました。

## Artifact

- Artifact ID: `8626763985`
- 名前: `live-board-windows-unsigned-1278096d7b3e8a032d1474ed6dc047d9320c8daf`
- ZIPサイズ: `200,508,903byte`
- Digest: `sha256:cc27eadfafb352e5668dfedbb6baf9284dc7c445f282416509c46e6016c44bc5`
- 有効期限: 2026-08-09

Artifactには次を含みます。

- NSISインストーラー
- portable版
- `SHA256SUMS.txt`
- `package-manifest.json`
- `packaged-smoke.json`
- `packaged-soak.json`

## 公開情報の確認

診断JSONには次を含めていません。

- OBS接続token
- Overlay URL
- Workspaceパス
- インストール先
- GitHub Actions runner固有パス
- 反復ごとのポート履歴

## この結果で確認できないこと

- OBS Browser Source実体との接続
- Canvas描画と画像デコード
- GPUメモリとドライバー差異
- ウイルス対策ソフト動作中の保存
- スリープ復帰とディスプレイ変更
- 実時間8時間の連続操作

次の実機試験では、このartifactまたは同等の新しいRCを使用し、checksumとsource headを記録して検証します。
