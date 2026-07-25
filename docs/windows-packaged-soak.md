# Windowsパッケージ反復soak test

## 1. 目的

Windows向け未署名Release Candidateのパッケージ済みElectron Mainで、次のライフサイクルを同一プロセス内で繰り返し、単発smoke testでは検出しづらい初期化・終了処理の不整合とRSS増加傾向を確認します。

```text
パッケージ資源確認
→ 一時永続化領域作成
→ 永続化サービス初期化
→ loopback OBS Bridge起動
→ token付きOverlay URLをHTTP取得
→ HTML root確認
→ Bridge終了
→ 一時永続化領域削除
```

本試験は実OBS Browser Source、GPU描画、ユーザー操作を含む8時間実機試験の代替ではありません。

## 2. 実行方法

パッケージ済みexeへ次の引数を渡します。

```powershell
LiveBoard.exe `
  --smoke-test `
  --smoke-output=C:\temp\live-board-soak.json `
  --smoke-iterations=100
```

`--smoke-iterations`は1〜500の整数だけを受理します。省略時は従来どおり1回です。

## 3. 計測項目

結果JSONへ次の集計値だけを出力します。

- 成功した反復回数
- 最終反復のhost・port・HTTP status
- 初回・最終・最大RSS
- 初回から最終までのRSS増加量
- 反復所要時間の最大値
- 反復所要時間のp95

接続token、Workspaceパス、インストール先、runner固有パス、反復ごとの一時ディレクトリは出力しません。

## 4. CI品質ゲート

`.github/workflows/windows-packaged-soak.yml`はWindows runnerでunpacked版を生成し、既定100回の反復を実行します。

| 項目 | 基準 |
|---|---:|
| 失敗回数 | 0件 |
| Overlay HTTP status | 全反復200 |
| 1反復の最大所要時間 | 15秒以下 |
| 最大RSS | 1GiB以下 |
| 初回から最終までのRSS増加 | 256MiB以下 |

閾値は異常な増加を早期検出するための粗いCI基準です。Windows runnerの負荷やElectronのGCタイミングで値は変動するため、通常値が蓄積した後に必要に応じて狭めます。

結果JSONはソースhead SHAを含むworkflow artifact名で14日保持します。

### 初回実測

Windows Packaged Soak run `30142006235`、Windows Server 2025 runner、100回反復で取得しました。

| 項目 | 実測 |
|---|---:|
| 成功反復 | 100 / 100 |
| Overlay HTTP status | 200 |
| 初回RSS | 75,960,320 byte（約72.44MiB） |
| 最終RSS | 87,085,056 byte（約83.05MiB） |
| 最大RSS | 87,085,056 byte（約83.05MiB） |
| RSS増加 | 11,124,736 byte（約10.61MiB） |
| 最大反復所要時間 | 68ms |
| p95反復所要時間 | 21ms |

これはGitHub-hosted runner上の値です。実利用端末、OBS、GPUドライバー、ウイルス対策ソフトを含む値ではありません。

## 5. 失敗時の確認順序

1. 失敗した反復回数とエラー名を確認する
2. Overlay資源の欠落かHTTP取得失敗かを切り分ける
3. Bridgeのport確保・close処理を確認する
4. 一時永続化領域の作成・削除権限を確認する
5. RSSが継続増加する場合は、Bridge listener、WebSocket、HTTP server、Asset registryの参照保持を確認する
6. 再現条件を固定してから、実機長時間試験へ進む

## 6. 対象外

- OBS Browser Source実体との接続
- Canvas／GPUの描画負荷
- 4K実画像のデコードと切り替え
- スリープ復帰・ディスプレイ構成変更
- ウイルス対策ソフト動作中の保存
- 実時間8時間の連続操作
- Windowsコード署名とSmartScreen評価

これらは配布候補artifactを使用する実機検証チェックリストで別途確認します。
