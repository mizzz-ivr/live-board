# Windowsパッケージ反復soak test設計

## 1. 目的

パッケージ済みLive BoardのElectron Mainを同一プロセス内で反復し、次のライフサイクルが継続して成立することを確認します。

1. 一時永続化領域の作成
2. 永続化サービスの初期化
3. loopback限定OBS Bridgeの起動
4. token付きOverlay URLのHTTP取得
5. Overlay HTMLのReact root確認
6. OBS Bridgeの終了
7. 一時永続化領域の削除

単発のpackaged smoke testでは検出しづらい、Bridge開始・終了の反復失敗、リソース解放漏れ、RSSの単調増加を早期に検出するための品質ゲートです。

## 2. 実行方法

Windows x64の`win-unpacked/LiveBoard.exe`、NSISインストール後のexe、またはportable版で実行します。

### 既定の1回smoke

```powershell
LiveBoard.exe `
  --smoke-test `
  --smoke-output=C:\temp\live-board-smoke.json
```

### 100回soak

```powershell
LiveBoard.exe `
  --smoke-test `
  --smoke-iterations=100 `
  --smoke-output=C:\temp\live-board-soak.json
```

`--smoke-iterations`は1〜500の整数だけを受理します。省略時は1です。

次は起動前に拒否します。

- 0、負数、小数、文字列
- 501以上
- 同じ引数の重複
- `--smoke-test`なしでの`--smoke-iterations`指定

## 3. 結果JSON

成功時は終了コード0を返し、指定したファイルへ次の集計値だけを書き込みます。

```json
{
  "ok": true,
  "version": "0.1.0",
  "host": "127.0.0.1",
  "port": 49152,
  "overlayStatus": 200,
  "iterations": 100,
  "successfulIterations": 100,
  "p95DurationMs": 25.4,
  "maxDurationMs": 48.9,
  "initialRssBytes": 120000000,
  "finalRssBytes": 124000000,
  "maxRssBytes": 130000000,
  "rssDeltaBytes": 4000000
}
```

### 所要時間

- `p95DurationMs`: 95%の反復がこの時間以内に完了した値
- `maxDurationMs`: 最も時間がかかった1反復

計測範囲には永続化初期化、Bridge起動、Overlay取得、Bridge終了、一時領域削除を含みます。

### RSS

- `initialRssBytes`: 反復開始前のMainプロセスRSS
- `finalRssBytes`: 最終反復のクリーンアップ後RSS
- `maxRssBytes`: 計測中に観測した最大RSS
- `rssDeltaBytes`: 最終RSSから初回RSSを引いた値

GCの実行タイミングは強制しません。単一runの絶対値だけでメモリリークと断定せず、同一fixtureの継続的な傾向と実機計測を合わせて判断します。

## 4. 公開しない情報

結果JSONとCIログには次を含めません。

- OBS接続token
- token付きOverlay URL
- Workspaceパス
- インストール先
- `RUNNER_TEMP`等のrunner固有パス
- ユーザー名

結果の公開フィールドはUnit TestとWindows CIの両方で固定します。

## 5. Windows Package CI

`.github/workflows/windows-package.yml`では、パッケージ生成後に次を実施します。

1. 既存の1回packaged smoke test
2. 100回packaged soak test
3. 集計JSONのschema確認
4. 品質ゲート判定
5. 診断JSONをworkflow artifactへ保存

診断artifact名:

```text
live-board-windows-soak-<source head SHA>
```

保持期間は14日です。

## 6. 初期品質ゲート

| 項目 | 閾値 |
|---|---:|
| 成功反復数 | 100 / 100 |
| Overlay HTTP status | 全反復で200 |
| 最終RSS増加量 | 128MiB以下 |
| 最大RSS | 768MiB以下 |
| 1反復の最大所要時間 | 10秒以下 |

閾値はGitHub ActionsのWindows runnerでの退行防止値です。実測値が十分小さい場合でも、根拠なく厳格化してCIを不安定にせず、複数runの傾向を確認してから調整します。

## 7. 失敗時の確認順序

1. `successfulIterations`が指定回数と一致するか
2. `overlayStatus`が200か
3. `maxDurationMs`が一時的なrunner遅延か継続的な遅延か
4. `rssDeltaBytes`が複数runで単調増加しているか
5. `maxRssBytes`が初回起動時だけ高いのか、反復ごとに増えるのか
6. Bridge closeまたは一時領域削除で停止していないか

失敗時に閾値だけを緩和せず、同じsource head SHAで再現性を確認します。

## 8. この試験で確認できないこと

このsoak testはElectron Main内のライフサイクル試験であり、次の代替ではありません。

- OBS Browser Source実体の起動
- Desktop Rendererでの描画操作
- GPU／Canvasメモリ
- 4K実画像のデコード
- 自動保存中のUI停止
- スリープ復帰
- ディスプレイ構成変更
- ウイルス対策ソフトの影響
- 実時間8時間の配信

これらは未署名RCを別Windows端末へ配置し、実OBSを接続した受け入れ試験で確認します。

## 9. 後続判断

100回soakが安定した後、次の順で実機検証を進めます。

1. portable版で1時間のOBS接続試験
2. 複数4K画像を含む描画・ページ切り替え・保存
3. スリープ復帰とOBS再接続
4. ウイルス対策ソフト動作中の保存
5. 8時間連続試験

実機結果は対象version、source head SHA、Windows build、GPU、OBS version、成果物SHA-256と合わせて記録します。
