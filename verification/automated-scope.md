# 自動試験の範囲と限界

実行結果: `test-results/unit.json` / `test-results/e2e.json`。テスト名が証拠の最小単位。requirements_coverage.csvの自動合格は下記の関連シナリオのみであり、要求文の全境界条件を証明しない。未記載の条件は未試験。

| テスト名/場所 | 実際に確認する内容 | 主な対応 |
|---|---|---|
| core: RV-TPL-01/02, missing patches | 差分順序、出所、原本不変、欠損/危険パス拒否 | TPL-001/003/005/006/007/009/011 |
| core: layout ratio, anchor, safe and cycles | 比率、安全域の右下anchor、循環拒否 | LAY-003/004/005/006/007 |
| core: Unicode graphemes, date and filename | 結合文字・家族絵文字、日付/ゼロ詰め、禁止文字/重複名 | TXT-008,AUT-001/004/006,EXP-004 |
| core: geometry contracts | 真の多角形面積、複数線面積、線非表示時分割維持、fixed/bounded/0°、決定論、競合、制約拒否 | IMG-009/010/011/014,CMP-009/010/011/013/014/015/018/021 |
| core: particle time and seed repeat | seed/時刻の同入力一致と時刻変更差 | PRT-005 |
| core: persistence and safety, additional operations, asset-bearing backup | IndexedDB CAS、原子中断、ZIP往復・SHA256・別ID・サイズ/パス、素材許諾除外、匿名化、リング300件、履歴、schema0 | DAT-001/002/003/004/006/009/010/012,DBG-005/006,SEC-002/004/006 |
| E2E: gate wrong, correct, session reload and logout | 不一致拒否、一致進入、セッション継続、ログアウト | OPS-001/003 |
| E2E: S1 Template → Variant → Project → 3 PNG and persistence | UI作成、3種寸法PNGを実ダウンロード、タイトル再読込 | TPL-001/003/005/006/007,EXP-001/002/003,DAT-001 |
| E2E: backup and anonymous diagnostics, safe SVG import, no outgoing content | ZIP取込、匿名ZIPの本文/素材不在、隔離UI、SVG script/event/外部参照除去、対象操作時の外向通信不在 | DBG-007/009,SEC-001/002/004 |
| E2E: renderer integration | グループFX隔離ピクセル、同一PNG一致、split個別/全体FX差、可変blur/inkシェーダー描画、フォント欠損エラー | FX-001/002/005,IMG-014/017,EXP-005,FNT-006 |
| E2E: mobile layout and diagnostics | 狭幅横スクロールなし、canvas、診断到達、自己診断PNG | UI-003/004,DBG-010 |
| E2E: S2/S3 composition | 複数SVG→slot、元画像keep領域ドラッグ、bounded候補採用、Profile限定差分をDB検査、3出力 | IMG-001,CMP-001/002/003/004/006/007/016 |
| E2E: formal serial | 手動42で2回正式出力→next43維持、不明フォントの出力停止 | AUT-005,FNT-006 |

QA-001/004～007の証拠は試験そのもの・台帳・確認項目書の存在と整合検査。品質条件全体の合格ではない。

## 実施していない代表条件

- 初期TC218件の全手順、S1～S6すべての実機受入、端末間バックアップ往復。
- WebFont実サーバー404/CORS/速度試験、フォント個別グリフ不足、実メモリ枯渇・OSストレージ消去。
- 本番配信/ゲート設定変更/無効化の実サイト検証。
- 全効果のgolden、回転親の正しい操作、長時間メモリ増加、GPU lost/restore。
- 実画像/フォントの権利確認、実サービスの推奨寸法/セーフエリア照合。

画面保存と出力PNGは合成データのみ。画像をgoldenとして自動承認した記録ではない。
