> **Ver.0.3.2の確定方針（2026-11-06）**：開発・サイト配信はGitHubのみ。GitHub Freeの公開リポジトリからGitHub Pagesで配信し、初期から知人βまでサイトは公開状態を維持する。アプリの入口には、偶然の訪問者に対する軽い障壁としてJavaScript製の簡易パスワード入力画面を設ける。これは本物の認証・アクセス制御ではなく、公開ソースや配信ファイルを隠せない。GitHubリポジトリの公開設定変更・初回デプロイ・本体開発は別途本人の承認が必要。優先する詳細は`docs/29_GitHubPages公開と簡易パスワード画面.md`。

# Development agent instructions

このリポジトリは日本語話者が利用する、iOS Safari/Android Chrome優先のバナー制作Webアプリである。ユーザーへの報告とドキュメントは原則日本語。README、REQ-ID、設計上の重大な変更を保持する。

## 参照資料
`docs/00_README_開発パック.md`と`docs/06_AI一括開発実行指示書.md`を最初に読み、`docs/01_統合要件定義.md`、`docs/09_要件トレーサビリティ.csv`、`docs/04_デバッグ・診断仕様.md`、`docs/05_検証計画・確認項目作成手順.md`を要求の正本として扱う。詳細設計は`docs/02_技術設計・データモデル.md`、根拠は`docs/03_先行研究・技術根拠.md`、未決事項は`docs/08_未決定事項・リスク台帳.md`。

## 開発方針
- ユーザーは小さいMVPの連続納品ではなく、初回から全体が操作できる統合アプリを希望する。内部で段階実装・テスト・コミットすることは必要だが、細かい承認で停止しない。
- 主描画エンジンの候補はPixiJS v8/WebGL2。文書モデルとレンダラーは疎結合にする。
- Template、Variant、Project、OutputProfile、Assetを分離。プロジェクトから原テンプレートへ自動書き戻さない。
- 自動構図補正はkeep/avoid領域、アンカー、回転固定/許可、角度範囲、手動overrideを扱い、評価明細を診断表示する。
- 診断パネル、ログ、素材なし診断ZIP、機能状態トラッカー、障害再現、保存/復元、回帰テストを初回から実装する。
- 未実装を実装済と偽らない。擬似ボタンを作ったらplaceholderと報告する。実機検証がない場合は未検証と記す。
- 画像、署名、作品テキスト、フォント実体を診断やネットワークへ無断送信しない。
- 実際のコードに対する確認項目書は実装完了後に生成し、`docs/09`/`docs/10`と連携する。

## 毎作業セッションの終了時
1. `typecheck`, `lint`, `test`, `build`を実行し、結果を残す。できない場合は理由を書く。
2. 完了/未完REQ-ID、既知バグ、変更したコード、次のコマンドを`HANDOFF.md`に書く。
3. Gitコミット可能なら動作状態をコミットする。
4. ユーザーには簡潔に実績と未確認事項を報告。実機で試していないものは「実機合格」と呼ばない。

## 開発前の設計レビュー追補
`docs/15_設計レビュー結果.md`、`docs/16_設計決定台帳.md`、`docs/17_仕様契約_継承と永続化.md`、`docs/18_仕様契約_座標と構図最適化.md`、`docs/19_仕様契約_描画とエフェクト.md`、`docs/20_仕様契約_文字素材安全.md`、`docs/21_品質ゲートと受入判定.md`、`docs/22_事前条件_サービス実測と未確定事項.md`も参照。旧資料の暫定記述と設計契約が矛盾する場合は設計契約を優先し、REQ-IDの変更を独断で行わない。


## Ver.0.3 operation constraints
Read docs/25 through docs/28. No repository connection, deployment, beta invite, release, or substantive implementation before the user explicitly authorizes each applicable action. The owner tests on iPhone/iPad, prefers browser-local data plus backup files, and requires Japanese step-by-step mobile GitHub instructions. GitHub Free public repo and GitHub Pages are the sole repository and hosting solution. Initial and beta sites are technically public, but a JavaScript-only password UI provides a casual obstacle (not authentication or security); beta URL sharing and wider announcement still require approval. After the initial integrated build, use isolated modules, mock review for UI, and integration regression tests.

## Ver.0.3.1 の準備/公開制約
- 本人はChatGPT Pro、GitHubリポジトリ作成済み。準備タスクではZIP展開・docs配置・Gitコミットのみが許可され、本体開発を開始しない。
- GitHubリポジトリはPublicとし、GitHub Pagesの公開サイトへ簡易パスワードUIを載せる。いずれも秘匿性を持たない。
- 初回デプロイ・URL共有・β案内はそれぞれ明示承認が必要。
