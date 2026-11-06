> **Ver.0.3.2の確定方針（2026-11-06）**：開発・サイト配信はGitHubのみ。GitHub Freeの公開リポジトリからGitHub Pagesで配信し、初期から知人βまでサイトは公開状態を維持する。アプリの入口には、偶然の訪問者に対する軽い障壁としてJavaScript製の簡易パスワード入力画面を設ける。これは本物の認証・アクセス制御ではなく、公開ソースや配信ファイルを隠せない。GitHubリポジトリの公開設定変更・初回デプロイ・本体開発は別途本人の承認が必要。優先する詳細は`docs/29_GitHubPages公開と簡易パスワード画面.md`。

# Claude Codeなどの開発AI向け指示

このファイルは`AGENTS.md`と同じ方針を適用するための案内。最初に`AGENTS.md`と`docs/06_AI一括開発実行指示書.md`を全文読み込むこと。要件は`docs/01_統合要件定義.md`および`docs/09_要件トレーサビリティ.csv`を正本とする。利用者への報告・UIは日本語。

- 一括開発を優先：内部で複数回の実装と検証を進めるが、ユーザーに小機能ごとの承認を要求しない。
- PixiJS/WebGL2、テンプレート差分、領域メタデータ、回転許可の構図補正、非破壊効果、モバイル編集、保存/PNG書き出し、診断機能、テストを対象から落とさない。
- テストが未実行なら「未実行」。UIのみなら「仮実装」。バージョンやブラウザ機能は調査し、利用可能と推測しない。
- 作品画像・ロゴ・サイン・フォント実体・入力文字列は、診断出力や外部送信で既定除外。許可付きの場合のみ同梱。
- 作業終了時にGit差分・テスト結果・未達REQ-ID・再開手順を`HANDOFF.md`へ記録。

## 開発前の設計レビュー追補
`docs/15_設計レビュー結果.md`、`docs/16_設計決定台帳.md`、`docs/17_仕様契約_継承と永続化.md`、`docs/18_仕様契約_座標と構図最適化.md`、`docs/19_仕様契約_描画とエフェクト.md`、`docs/20_仕様契約_文字素材安全.md`、`docs/21_品質ゲートと受入判定.md`、`docs/22_事前条件_サービス実測と未確定事項.md`も参照。旧資料の暫定記述と設計契約が矛盾する場合は設計契約を優先し、REQ-IDの変更を独断で行わない。


## Ver.0.3 operation constraints
Read docs/25-28. Do not start coding or publish a site based on the preparation pack alone. The owner tests on iPhone/iPad and needs Japanese mobile instructions for GitHub. Initial site access must be owner-only, later invite-only beta requires explicit approval, public release a separate approval. Data stays in the local browser plus exported backup. After initial full implementation, iterate on isolated modules and design mocks before integration and regression testing.
