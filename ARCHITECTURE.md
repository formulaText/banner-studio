# 初回統合実装の構成

2026-11-06。資料はAGENTS.md、docs/00〜29、CLAUDE.mdを確認。docs/01と09（185要件）を基準、後続の25〜29と今回の開発依頼を優先した。開発・テスト・専用ブランチ・PRは今回承認済み。デプロイ、mainマージ、招待、課金は未承認。

- `app/src/model.ts`: Zodの保存スキーマ。Template / Variant / Project / Profile / Assetを分離。
- `document.ts`: スナップショット、安定IDのパッチ、出所、レイアウト、Undo/Redo。原本へ自動書戻ししない。
- `geometry.ts`: ポリゴン分割、交差面積、keep/avoid・角度制約・決定論的探索、seed付き粒子。
- `renderer.ts`: PixiJS v8.22.0 / WebGL2。文字組みとグラデーション用にCanvas2Dをテクスチャ生成に限定使用。画像のFX→クリップ→装飾線→全体FX。同じ描画器をプレビュー・PNGに使用。
- `storage.ts`: IndexedDB/Dexie、世代番号の競合検知、workspaceとBlobの原子保存、SHA256付きZIP、別IDでの取込。
- `assets.ts`: SVGサニタイズ、画像・フォント形式検査、色抽出。実制作素材をネットワークへ送信しない。
- `diagnostics.ts`: リングログ、匿名構造ZIP、隔離再現。完全な素材付き再現は未完成。
- `App.tsx`, `Canvas.tsx`, `Inspector.tsx`: 日本語React UI、モバイルパネル、簡易ゲート。

実際の依存バージョンはapp/package.jsonおよびpackage-lock.jsonを正本とする。Node 24.22.1 / npm 11.9.0で検証。ブラウザの追加ダウンロードはcdn.playwright.devが環境ポリシーで拒否。既存ChromiumでPCとモバイル表示を自動試験する。WebKit/Firefox/iOS・Android実機は未検証。
