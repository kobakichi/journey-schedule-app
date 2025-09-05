# スタイル / 規約

## バックエンド（Express + TypeScript）
- ルーティング: REST 風 `/api/*`、認証済みルートはミドルウェア `ensureAuth` を適用
- バリデーション: Zod で body/query を検証
- 認証: Google ID トークン→JWT(httpOnly cookie, sameSite=lax, secure=prod)
- DB: Prisma（スキーマで `User`, `DaySchedule`, `ScheduleItem`, `ItemKind`）。`userId+date` はユニーク
- 日付/時刻: 日付は `YYYY-MM-DD` を受け取り `DateOnly` で保存。時刻は `HH:mm` 入力→当日ISOに変換

## フロントエンド（React + Vite）
- 関数コンポーネント + Hooks。ルーティングは `react-router-dom`、`/day/:date` と `/calendar/:date`
- UI: カレンダー（5分刻みのドラッグ移動/最小15分リサイズ）。空白クリックで追加シート
- API ラッパ: `src/api.ts` に fetch + 正規化（ISO/enum小文字化など）
- テーマ: `theme.ts`（ライト/ダーク/自動）。react-three-fiber で背景演出

## 命名/小規模規約
- TypeScript 型は `PascalCase`（例: `DaySchedule`, `ScheduleItem`）
- 変数/関数は `camelCase`
- API の `kind` はバックでは `GENERAL/MOVE`（enum）、フロントでは小文字 `'general'/'move'` に正規化
- CSS クラスは `styles.css` に定義（ユーティリティ風の命名）

## 推奨（未導入）
- ESLint/Prettier の導入（CI 連携含む）
- `.nvmrc` など Node バージョンピン止め
- ルート `.editorconfig`
