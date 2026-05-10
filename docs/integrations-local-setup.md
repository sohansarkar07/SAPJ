# Integrations Local Setup (Gmail + Calendar + WhatsApp)

## 1) Environment Variables

Set these in `backend/.env`:

- `APP_BASE_URL=http://127.0.0.1:8000`
- `FRONTEND_BASE_URL=http://127.0.0.1:5500`
- `ENCRYPTION_KEY=<fernet key>`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/integrations/google/callback`
- `WHATSAPP_VERIFY_TOKEN=...`
- `WHATSAPP_ACCESS_TOKEN=...`
- `WHATSAPP_PHONE_NUMBER_ID=...`
- `WHATSAPP_APP_SECRET=...`

Generate a Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## 2) Google OAuth Setup

1. In Google Cloud Console create an OAuth client (Web).
2. Authorized redirect URI:
   - `http://127.0.0.1:8000/api/integrations/google/callback`
3. Add Gmail + Calendar readonly scopes.
4. Start backend and frontend.
5. Open Sources page and click **Connect** for Gmail/Calendar.

## 3) WhatsApp Cloud Webhook (local)

You need a public URL. Use ngrok (or Cloudflare tunnel):

```bash
ngrok http 8000
```

In Meta App webhook settings:

- Callback URL: `https://<your-ngrok>/api/integrations/whatsapp/webhook`
- Verify token: match `WHATSAPP_VERIFY_TOKEN`

Subscribe to message events for your WhatsApp app.

## 4) Manual Sync APIs

- `POST /api/integrations/sync-now` with `{"provider":"gmail"}`
- `POST /api/integrations/sync-now` with `{"provider":"calendar"}`
- `POST /api/integrations/sync-now` with `{"provider":"google"}`

## 5) Health Checks

- Session: `GET /api/session`
- Integration status + logs: `GET /api/integrations/status`
- WhatsApp verify: `GET /api/integrations/whatsapp/webhook?...`

