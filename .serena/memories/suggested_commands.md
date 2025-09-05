# 推奨コマンド集

## 環境準備
- DB 起動: `docker compose up -d`
- DB 停止/破棄: `docker compose stop` / `docker compose down`
- DB ログ: `docker compose logs -f db`

## Backend（API）
- 依存関係: `cd backend && npm install`
- Prisma: `npm run prisma:generate` / `npm run prisma:migrate`
- 開発起動: `npm run dev`（http://localhost:4000）
- 本番ビルド/起動: `npm run build && npm start`
- ヘルスチェック: `curl http://localhost:4000/api/health`
- Prisma Studio: `npm run prisma:studio`

## Frontend（Web）
- 依存関係: `cd frontend && npm install`
- 開発起動: `npm run dev`（http://localhost:5173）
- 本番ビルド/プレビュー: `npm run build && npm run preview`

## 認証（設定）
- backend/.env: `GOOGLE_CLIENT_ID`, `JWT_SECRET` を設定
- frontend/.env.local: `VITE_GOOGLE_CLIENT_ID` を設定

## 補助
- APIヘルス: `curl -s http://localhost:4000/api/health | jq .`
- 依存の確認: `npm ls --depth=0`（各パッケージ）
