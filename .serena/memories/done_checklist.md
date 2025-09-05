# 作業完了時のチェックリスト

- 動作確認
  - DB 起動中（docker compose ps）
  - Backend: `npm run build && npm start` がエラーなく起動する
  - Frontend: `npm run build && npm run preview` で主要画面が動く
  - `GET /api/health` が `{"ok": true}` を返す

- コード品質
  - 本リポジトリには公式の Lint/Format 設定は未導入（ESLint/Prettier なし）。導入する場合は別途合意の上で追加
  - TypeScript エラーなし（tsc）

- ドキュメント
  - 変更点を `README.md` に追記（起動手順/環境変数/APIの差分）

- 認証（任意機能）
  - Google OAuth クライアントID設定済みか確認（backend/.env と frontend/.env.local）

- リリース準備
  - `.env` に秘匿情報が入っていないことを確認し、`.env.example` を更新
