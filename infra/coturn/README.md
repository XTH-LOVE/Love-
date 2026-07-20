# Love小家 coturn

This directory is for a small Ubuntu VPS with a public IPv4 address.

## 1. DNS and certificates

Point `TURN_DOMAIN` to the VPS public IPv4 address. Put a valid certificate and key at:

```text
certs/fullchain.pem
certs/privkey.pem
```

The certificate must include the TURN domain. `turns:` on port 5349 is recommended for production.

## 2. Fill the config

Copy `.env.example` to `.env`, generate a long random `TURN_SHARED_SECRET`, then replace these values in `turnserver.conf`:

```text
static-auth-secret=...
realm=turn.example.com
server-name=turn.example.com
external-ip=your.public.ip
```

Do not commit the secret or certificates.

## 3. Firewall

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49160:49200/udp
sudo ufw allow 49160:49200/tcp
```

Also open the same ports in the cloud security group.

## 4. Start

```bash
docker compose up -d
docker logs -f love-home-coturn
```

The app's Supabase Edge Function uses the same `TURN_SHARED_SECRET` to issue short-lived credentials.

## 5. Deploy the credential function

From the project root, after linking the Supabase project:

```bash
supabase secrets set TURN_SHARED_SECRET="the-same-secret-as-coturn"
supabase secrets set TURN_URLS="turns:turn.example.com:5349,turn:turn.example.com:3478"
supabase secrets set TURN_CREDENTIAL_TTL="3600"
supabase functions deploy turn-credentials
```

The browser and APK request a one-hour credential after login. The long-lived shared secret stays in Supabase and on the VPS, never in the app bundle.

ZEGO 云通话使用独立的短期 Token。设置完成后部署：

```bash
supabase secrets set ZEGO_APP_ID="1962051148"
supabase secrets set ZEGO_SERVER_SECRET="你的新 ServerSecret"
supabase secrets set ZEGO_TOKEN_TTL="3600"
supabase functions deploy zego-token
```
