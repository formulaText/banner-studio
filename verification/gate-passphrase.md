# 合言葉変更の検証記録

実施日: 2026-11-07 JST。基点: main `9339824`。ブランチ: `fix/gate-passphrase-ba7demo`。

合言葉を `banner-demo` から `ba7demo` へ変更しました。アプリ変更は既定ハッシュと入口のヒント文字列のみです。セッション処理、ゲート設定の上書き機構、その他のアプリ機能は変更していません。

新しいSHA-256: `141328dc7f8cadee4e30d0f747725219aaac9e6a9dd67abc665d4a106ba3dfbf`。

## 実行結果

環境: Linux、Node.js v24.22.1、npm 11.9.0、Chromium 156.0.8078.79、SwiftShader。PC表示1440×1000とPixel 7エミュレーションを使用しました。

| 検査（npmはappディレクトリで実行） | 結果 |
|---|---|
| `npm ci --cache ../work/npm-cache` | 成功、197パッケージ、lock変更なし |
| `npm run typecheck` | 成功 |
| `npm run lint` | 成功 |
| `npm test` | 2ファイル・28件合格（既存23件＋ゲート5件） |
| `npm run build` | 成功、既存の500 kB超チャンク警告あり |
| `PLAYWRIGHT_JSON_OUTPUT_NAME=../work/gate-e2e.json npm run e2e -- --reporter=list,json` | 12件合格、既存の同一エンジン重複2件スキップ |
| `node verification/pages-smoke.mjs`（ローカル静的サーバー） | PC／モバイル表示とも成功 |
| `python scripts/verify_requirements.py` | 成功、185REQ／218TC、実機合格0 |
| 変更テストのPrettier検査・`git diff --check` | 成功 |

実行出力: [gate-passphrase.log](test-results/gate-passphrase.log)。最初の `npm ci` は既定キャッシュへの書込みに失敗したため、workspace内のキャッシュを指定して成功しました。依存やlockは変更していません。既存の単体／E2Eの過去記録は保持しています。

## 確認した動作

- `ba7demo` でログインでき、`banner-demo` と誤入力では編集画面へ進めない。
- 旧ハッシュを保存したセッションでは、リロードしても入口が表示される（単体・E2E）。
- 新合言葉でログインした後、リロードしてもセッションが保持される。
- ログアウトでセッションが消え、リロード後も入口が表示される。
- ログアウト後も旧合言葉は拒否され、新合言葉で再ログインできる。
- ビルド成果物でも新旧入力、セッション保持、ログアウト・再ログイン、新規セッションを確認。アセット404・ページ例外なし。

静的サーバーの起動方法は [既存スモーク手順](pages-preparation.md#成果物スモークの再実行) を使用しました。外部への配信はしていません。

## 変更範囲と未検証

README、環境設定例、引継ぎ、配信手順、スモーク試験を新合言葉に合わせました。過去の配信準備記録は旧合言葉を当時の値と明示し、現在値を追記しました。旧文字列は拒否テストと変更履歴にのみ残しています。

GitHub Pages設定・ワークフローは変更せず、手動起動・公開・mainへの直接コミット・マージは行っていません。iPhone/iPad等の実機と実配信先は未検証です。関連REQはOPS-001/003ですが、既存の全REQ判定と既知バグは維持します。
