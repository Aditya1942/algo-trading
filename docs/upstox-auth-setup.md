# Upstox Authentication Setup

## Prerequisites

- An [Upstox](https://upstox.com/) demat/trading account
- A registered API app on the Upstox Developer Portal

## Step 1: Create an API App

1. Go to the **Upstox Developer Portal**: [https://account.upstox.com/developer/apps](https://account.upstox.com/developer/apps)
2. Log in with your Upstox credentials
3. Click **"New App"**
4. Fill in the required fields:
   - **App Name**: anything (e.g. `algo-trading-local`)
   - **Redirect URI**: `http://localhost:8081/auth/callback`
   - **Description**: optional
5. Submit and wait for approval (usually instant for personal use)

## Step 2: Get Your Credentials

Once your app is created, you'll see:

| Field | Where to find | Maps to env var |
|-------|--------------|-----------------|
| **API Key** | App details page → "API Key" | `UPSTOX_CLIENT_ID` |
| **API Secret** | App details page → "API Secret" | `UPSTOX_CLIENT_SECRET` |
| **Redirect URI** | The URI you entered during app creation | `UPSTOX_REDIRECT_URI` |

## Step 3: Configure Environment

Copy the example env file and fill in your credentials:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
UPSTOX_CLIENT_ID=your_api_key_here
UPSTOX_CLIENT_SECRET=your_api_secret_here
UPSTOX_REDIRECT_URI=http://localhost:8081/auth/callback
```

## Step 4: Authenticate

1. Start the server:
   ```bash
   bun run server
   ```
2. Open your browser: [http://localhost:8081/auth/login](http://localhost:8081/auth/login)
3. You'll be redirected to Upstox login page
4. Log in and authorize the app
5. Upstox redirects back to your server with an auth code
6. The server exchanges the code for an access token and stores it in SQLite

After this one-time flow, the token persists in the database and auto-refreshes.

## How the Auth Flow Works

```
Browser → /auth/login → Upstox OAuth consent page
                              ↓ (user approves)
Upstox → /auth/callback?code=xxx → server exchanges code for token
                                        ↓
                              Token stored in SQLite → auto-refresh on expiry
```

## Check Auth Status

```
GET http://localhost:8081/api/v1/auth/status
```

Returns whether a valid token exists.

## Official Upstox Documentation

| Resource | Link |
|----------|------|
| API Documentation | [https://upstox.com/developer/api-documentation/](https://upstox.com/developer/api-documentation/) |
| Developer Portal (manage apps) | [https://account.upstox.com/developer/apps](https://account.upstox.com/developer/apps) |
| OAuth2 Auth Flow | [https://upstox.com/developer/api-documentation/authentication](https://upstox.com/developer/api-documentation/authentication) |
| API Key & Secret Guide | [https://upstox.com/developer/api-documentation/open-api](https://upstox.com/developer/api-documentation/open-api) |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Invalid redirect URI" | Ensure `UPSTOX_REDIRECT_URI` in `.env` matches exactly what you entered in the Upstox Developer Portal |
| "Invalid API key" | Double-check `UPSTOX_CLIENT_ID` — it's the API Key, not the App ID |
| Token expired, no auto-refresh | Re-authenticate by visiting `/auth/login` again |
| App not approved | Check app status on the Developer Portal; personal apps are usually auto-approved |
