import csv,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
req=list(csv.DictReader(next((root/'docs').glob('09*')).open(encoding='utf-8-sig')))
tcs=list(csv.DictReader(next((root/'docs').glob('10*')).open(encoding='utf-8-sig')))
files={
'TPL':'app/src/model.ts;app/src/document.ts;app/src/App.tsx',
'LAY':'app/src/document.ts;app/src/Canvas.tsx;app/src/App.tsx',
'IMG':'app/src/assets.ts;app/src/renderer.ts;app/src/geometry.ts;app/src/Inspector.tsx',
'CMP':'app/src/geometry.ts;app/src/RegionEditor.tsx;app/src/Inspector.tsx;app/src/App.tsx',
'TXT':'app/src/renderer.ts;app/src/document.ts;app/src/Inspector.tsx',
'FNT':'app/src/assets.ts;app/src/renderer.ts;app/src/App.tsx',
'LBL':'app/src/model.ts;app/src/App.tsx;app/src/Inspector.tsx',
'AST':'app/src/assets.ts;app/src/renderer.ts;app/src/App.tsx',
'FX':'app/src/renderer.ts;app/src/Inspector.tsx',
'PRT':'app/src/geometry.ts;app/src/renderer.ts;app/src/Inspector.tsx;app/src/App.tsx',
'AUT':'app/src/model.ts;app/src/document.ts;app/src/App.tsx;app/src/storage.ts',
'DAT':'app/src/storage.ts;app/src/document.ts;app/src/operations.ts;app/src/App.tsx',
'EXP':'app/src/renderer.ts;app/src/App.tsx',
'UI':'app/src/Canvas.tsx;app/src/style.css;app/src/App.tsx',
'DBG':'app/src/diagnostics.ts;app/src/App.tsx',
'SEC':'app/src/assets.ts;app/src/storage.ts;app/src/diagnostics.ts;licenses/README.md',
'QA':'app/tests/core.test.ts;app/tests/e2e/studio.spec.ts;verification/known-issues.md;TEST_ENVIRONMENTS.md',
'OPS':'app/src/gate.ts;app/vite.config.ts;ops/pages-workflow.example.yml;DECISIONS.md'}
ui={'TPL':'プロジェクト → テンプレート原本 → 新規/原本を編集/バリエーションを追加/このテンプレートで投稿','LAY':'出力先 → 幅/高さ/安全余白比率；制作 → 詳細設定 → 配置と変形','IMG':'制作 → 画像を取り込む → 要素を追加 → 複数画像 → 詳細設定 → 画像スロット/分割線','CMP':'詳細設定 → 構図アシスト → 元画像上をドラッグ → 回転探索モード → 自動構図の候補を計算 → 候補1','TXT':'レイヤー → タイトル → 詳細設定 → 文字と文字単位装飾/全体の非破壊効果','FNT':'素材 → 素材ファイルを追加；設定 → Webフォント；詳細設定 → フォント名/インポートフォント','LBL':'設定 → ラベル管理；制作 → 公開ラベル；ラベルレイヤーの詳細設定','AST':'素材 → 素材ファイルを追加/主要色を抽出/キャンバスへ配置；要素を追加 → アイコン','FX':'要素を追加 → 調整レイヤー；詳細設定 → 効果対象/全体の非破壊効果 → 効果を追加','PRT':'要素を追加 → パーティクル → 詳細設定 → 粒子設定；粒子を動かす → この時刻を採用','AUT':'制作 → タイトル/サブタイトル；書き出し → 日付/シリーズ/連番/ファイル名テンプレート','DAT':'設定 → バックアップZIPを保存/バックアップを検証・取り込み/保存容量を確認；元に戻す/やり直す','EXP':'書き出し → 出力先を選択 → 一括PNGを生成 → PNG保存/ZIPにまとめて保存','UI':'制作 → モバイルのレイヤー/キャンバス/詳細設定；キャンバス選択・ドラッグ・回転/サイズハンドル','DBG':'診断 → 診断ログを有効にする/自己診断/素材なし診断ZIPを保存/隔離再現を開く','SEC':'素材・バックアップ取込 → 不正ファイル拒否；診断ZIP → 内容確認；licenses参照','QA':'verification/checklist.csvとtest-resultsを照合。実機は後続試験','OPS':'入口 → 合言葉 → 制作室を開く → ログアウト；合言葉変更/無効化はビルド設定'}
partial={
'TPL-004':'ラベル内アイコン一体切替は未完。独立アイコン・色・効果差分は操作可。BUG-0008',
'TPL-009':'存在しないID・不正パスを拒否。属性別の元revision競合解決UIは未完。',
'TPL-012':'暗黙同期なし。Variantの明示再同期あり。既存Projectへの原本再同期比較UIは未完。',
'LAY-006':'BUG-0004 親/安全域の基本解決のみ。回転親の座標編集は未完。',
'LAY-007':'循環と欠損は拒否。回転他要素のワールド行列基準は未完。BUG-0004',
'LAY-008':'Profile差分最優先。canvas以外のProfile frame差分解決は未完。BUG-0004',
'LAY-009':'text/labelのBBox衝突・はみ出し診断のみ。全種/回転形状の衝突ガイドは未完。',
'IMG-005':'ブラウザ標準EXIFデコード、合成JPEGは用意。実機向き照合未実施。BUG-0007',
'IMG-006':'全未ロック画像をProfile横整列。任意複数選択・個別間隔UIは未完。',
'IMG-007':'全未ロック画像の自動グリッド。任意行列指定UIは未完。',
'IMG-013':'多重線とセルを実装。割当ては詳細JSON、線追加時の自動継承が不十分。BUG-0007',
'CMP-005':'目標正規化位置を保存。元可視率・元クリップの完全スナップショット未完。BUG-0003',
'CMP-008':'代表点の指定辺までの距離を使用。複数辺・退出量の厳密保持未完。BUG-0003',
'CMP-012':'位置・倍率・5角度を共同評価。角度の局所精密化は未完。BUG-0003',
'CMP-019':'正倍率と上限厳守・余白ペナルティあり。極端比率の品質未確認。BUG-0003',
'CMP-020':'Asset共通領域とslot reference/専用領域を分離。元クリップ記録未完。BUG-0003',
'TXT-003':'書記素別計測・改行/折返し/字間/行間/揃え。日本語禁則・高度な字形形成未完。BUG-0006',
'TXT-009':'blur→alpha threshold試作。ユーザーのすみだまり見本との品質合意なし。BUG-0002',
'FNT-001':'HTTPSフォントファイル取得はセッション限定。Google Fonts CSS/永続URLは未完。BUG-0006',
'FNT-006':'欠損Asset/未読込/名前の可用性を検査し出力停止。個別グリフ欠落の検出は未完。BUG-0006',
'LBL-004':'背景/余白/角丸/文字効果。ラベル内アイコン一体組版は未完。BUG-0008',
'AST-001':'コード生成ベクター8種類で代替。豊富な内蔵SVGライブラリとしては未完。BUG-0008',
'AST-003':'独立iconレイヤーのVariant差分は実装。SVG文字グリフセットの管理は未完。BUG-0008',
'AST-007':'紙/破れ紙/プラ/テープは試作質感。破れの輪郭と視覚基準は未完。BUG-0002',
'AST-011':'抽出色と白のコントラスト比のみ。任意文字/背景のペア比較UI未完。',
'FX-004':'可変ぼかしマスクで領域指定。独立領域マスクの共通UIは不十分。BUG-0002',
'FX-005':'GPU81点の空間半径ぼかし。段差/負荷/実機画質未評価。BUG-0002',
'FX-011':'下層/同一グループ/ID対象/画像個別/コンテナ効果あり。文字背景・線だけを対象にするUI未完。',
'FX-012':'可変blurの反転/フェザーと画像形状マスクあり。全FX共通マスクは未完。BUG-0002',
'AUT-002':'書式と固定日付・手入力は対応。任意timezoneでの明示更新UI未完。BUG-0009',
'AUT-003':'シリーズキー別counterを保持。管理一覧UIなし。BUG-0009',
'DAT-005':'別ID複製のZIP復元は自動試験。実端末間移行は未検証。BUG-0001',
'DAT-006':'schema0内部形式→1をコピー移行。その他旧版なし、未来版拒否。BUG-0010',
'DAT-008':'容量表示・永続保存要求・ZIP導線。OS消去や実QuotaExceededは未試験。BUG-0010',
'DAT-009':'セッション内60操作Undo/Redo・DB復旧。履歴の永続化なし。BUG-0010',
'DAT-010':'原子取込・checksum・ZIP境界検証。大容量ストリーミング未実装。BUG-0013',
'DAT-013':'ZIPで移行するコードあり。iPhone↔iPad実機は未検証。BUG-0001',
'EXP-005':'同一描画器・同環境PNG決定論を検査。全FXのgolden網羅・端末間差は未検証。BUG-0012',
'EXP-006':'生成後の共有/別タブ画像/ZIPあり。iOS保存シートは未検証。BUG-0001',
'EXP-007':'PNG透明背景・プロファイル寸法あり。高解像度タイル・色管理・alpha品質未完。BUG-0007',
'UI-001':'Pointer選択/移動/回転/サイズ/パン/ピンチ。iOS実機と回転親内操作未確認。BUG-0001/0004',
'UI-002':'Chromiumモバイル表示で操作。Android実機と回転親内操作未確認。BUG-0001/0004',
'UI-004':'狭幅パネルは自動試験。OS回転・Split Viewの実機未確認。BUG-0001',
'UI-006':'描画時間表示あり。長時間メモリと性能閾値未測定。BUG-0011',
'UI-007':'context lost時の出力停止と状態保持あり。実復旧・再描画試験未実施。BUG-0001',
'UI-008':'44px主要タッチ領域・日本語・狭幅表示。支援技術/実機可読性未検証。',
'DBG-002':'座標・差分出所・選択表示。親を含む全変換行列表示未完。BUG-0004',
'DBG-003':'source/imageFX/clip/decoration/finalを選択。任意GPUターゲット画像採取未完。BUG-0005',
'DBG-007':'素材・本文なしZIPは実証。匿名構造のみで完全再現には不足。BUG-0005',
'DBG-009':'隔離セッションを復元、元DBを変更しない。FX/素材の完全再現未完。BUG-0005',
'DBG-010':'自己診断はschema/WebGL/PNG。DB/font故障注入は未完。状態トラッカーは全185件。BUG-0005',
'DBG-011':'描画時間と画像texture概算。GPU総量実測・中間target一覧は未完。BUG-0011',
'SEC-003':'外部画像URL取込は非提供。ローカル入力限定でtaint回避。外部画像CORS専用診断未完。',
'QA-002':'単体/結合/E2E実行。golden全網羅/他ブラウザ未完。BUG-0012',
'OPS-001':'入口とサブパスビルドは実装。実際のPagesは未公開。BUG-0014',
'OPS-003':'ビルド時ハッシュ設定・hash付きセッション。変更後の実配信試験未実施。BUG-0014',
'OPS-005':'外部ホストなし。distのみ配信する未有効の例を用意。配信未実施。BUG-0014',
'OPS-008':'VITE_GATE_ENABLED=falseで無効化可能。設定変更・公開は未実施。BUG-0014'}
not_started={'DBG-008':'素材同梱診断の個別同意UIと再現用データ合成は未実装。通常バックアップは代替にならない。BUG-0005'}
blocked={'QA-003':'iPhone/iPad/Android実機なし。端末試験記録は空欄のまま。BUG-0001','QA-008':'本人のiPhone/iPad実機受入は後続。未検証。BUG-0001','OPS-002':'βへのURL案内は未承認なので未実施。'}
ops={'OPS-004','OPS-007','QA-009','QA-010','QA-011'}
passed=set('TPL-001 TPL-003 TPL-005 TPL-006 TPL-007 TPL-011 LAY-003 LAY-004 LAY-005 IMG-001 IMG-009 IMG-010 IMG-011 IMG-014 IMG-017 CMP-001 CMP-002 CMP-003 CMP-004 CMP-006 CMP-007 CMP-009 CMP-010 CMP-011 CMP-013 CMP-014 CMP-015 CMP-016 CMP-018 CMP-021 TXT-008 PRT-005 AUT-001 AUT-004 AUT-005 AUT-006 DAT-001 DAT-002 DAT-003 DAT-004 DAT-012 EXP-001 EXP-002 EXP-003 EXP-004 UI-003 DBG-005 DBG-006 SEC-001 SEC-002 SEC-004 SEC-006 QA-001 QA-004 QA-005 QA-006 QA-007'.split())
# Passing means only the explicitly linked automated scenarios, not device acceptance.
allrows=[]
for r in req:
 rid=r['REQ-ID'];domain=r['分野'];impl='implemented';status='implemented_unverified';tests='未実施（要件全体）';issue='実機未検証。自動試験は記載シナリオの範囲のみ。'
 if rid in passed:status='automated_passed';tests='自動試験合格（記載範囲）'
 if rid in partial:impl='partial';status='implemented_unverified';issue=partial[rid];tests='要件全体は未試験（関連する自動試験の範囲は試験対応表参照）'
 if rid in not_started:impl='not_started';status='not_started';issue=not_started[rid];tests='未実施'
 if rid in blocked:impl='blocked';status='blocked';issue=blocked[rid];tests='未実施'
 if rid in ops:impl='documented';issue='運用手順を記録。実際の公開・β・後続改修は未実施。';tests='文書レビュー'
 implementation=files[domain] if rid not in not_started else 'verification/known-issues.md'
 testpath='app/tests/core.test.ts;app/tests/e2e/studio.spec.ts' if rid in passed or rid in partial else ''
 r.update(implementationFiles=implementation,implementationStatus=impl,status=status,testStatus=tests,deviceStatus='未検証',testIds=';'.join(t['TC-ID'] for t in tcs if t['REQ-ID']==rid),automatedTests=testpath,evidence='verification/test-results/unit.json;verification/test-results/e2e.json' if testpath else '',issues=issue,uiPath=ui[domain])
 allrows.append(r)
with (root/'verification/requirements_coverage.csv').open('w',encoding='utf-8-sig',newline='') as f:
 wr=csv.DictWriter(f,fieldnames=allrows[0].keys(),lineterminator="\n");wr.writeheader();wr.writerows(allrows)
byid={r['REQ-ID']:r for r in allrows};check=[]
for row in tcs:
 r=byid[row['REQ-ID']];row.update(actualUIPath=r['uiPath'],implementationFiles=r['implementationFiles'],diagnosticPath='診断 → 状態・保存 / レンダリング / レイヤー・出所 / 構図候補 / ログ',actualStatus='未実施（この初期TCを個別に全条件実行した証拠はない）',relatedEvidence=r['evidence'],deviceResult='未検証',issues=r['issues']);check.append(row)
with (root/'verification/checklist.csv').open('w',encoding='utf-8-sig',newline='') as f:
 wr=csv.DictWriter(f,fieldnames=check[0].keys(),lineterminator="\n");wr.writeheader();wr.writerows(check)
(root/'app/src/coverage.json').write_text(json.dumps([{'id':r['REQ-ID'],'name':r['要件'],'status':r['status']+' / '+r['implementationStatus'],'issues':r['issues']} for r in allrows],ensure_ascii=False,indent=2)+'\n')
from collections import Counter
print(Counter(r['implementationStatus'] for r in allrows));print(Counter(r['status'] for r in allrows))
