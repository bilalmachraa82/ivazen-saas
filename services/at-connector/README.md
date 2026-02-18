# AT Connector (VPS)

Small HTTP service that talks to the official AT e-Fatura SOAP/mTLS endpoints using OpenSSL (Node.js).

This exists because Supabase Edge (Deno/rustls) can fail TLS handshakes with AT legacy cipher suites.

## API

`POST /v1/invoices`

Headers:
- `Authorization: Bearer <CONNECTOR_TOKEN>`

Body:
```json
{
  "environment": "production",
  "clientNif": "555555555",
  "username": "555555555/1",
  "password": "plain-text-password",
  "type": "ambos",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}
```

Notes:
- AT limits invoice queries to at most 1 month per SOAP request; this service automatically splits longer ranges into monthly chunks and paginates.

Response (example):
```json
{
  "success": true,
  "compras": { "totalRecords": 10, "invoices": [] },
  "vendas": { "totalRecords": 2, "invoices": [] }
}
```

## Environment Variables

- `PORT` (default `8787`)
- `CONNECTOR_TOKEN` (required)
- `AT_PUBLIC_CERT_PATH` (required) path to AT public cert (e.g. `Chave Cifra Publica AT 2027.cer`)
- TLS identity (required) provide either:
  - PFX: `AT_PFX_PATH` + `AT_PFX_PASSPHRASE`
  - PEM (recommended): `AT_KEY_PEM_PATH` + `AT_CERT_PEM_PATH` (+ optional `AT_KEY_PEM_PASSPHRASE`)
- `AT_TLS_MIN_VERSION` (optional, default `TLSv1.2`)
- `AT_TLS_CIPHERS` (optional) OpenSSL cipher string, if you need to force legacy suites
- `AT_TLS_LEGACY_SERVER_CONNECT` (optional `1` to enable OpenSSL legacy server connect)
- `AT_DOCS_PER_PAGE` (optional, default `5000`, max `5000`) docs per page for SOAP pagination

## Convert PFX to PEM (recommended)

Node/OpenSSL can fail to load some `.pfx` files depending on how they were generated/encrypted.
If that happens, use PEM key+cert instead:

```bash
# Private key (keep this file secret)
openssl pkcs12 -in at.pfx -nocerts -nodes -out at-key.pem

# Client certificate
openssl pkcs12 -in at.pfx -clcerts -nokeys -out at-cert.pem
```

## Run (no Docker)

```bash
cd services/at-connector
PORT=8787 CONNECTOR_TOKEN=... \
  AT_KEY_PEM_PATH=/etc/ivazen/at-key.pem \
  AT_CERT_PEM_PATH=/etc/ivazen/at-cert.pem \
  AT_PUBLIC_CERT_PATH=/etc/ivazen/at-public-2027.cer \
  node src/index.js
```

## Run (Docker)

```bash
docker build -t at-connector .
docker run -p 8787:8787 \
  -e CONNECTOR_TOKEN=... \
  -e AT_KEY_PEM_PATH=/run/secrets/at-key.pem \
  -e AT_CERT_PEM_PATH=/run/secrets/at-cert.pem \
  -e AT_PUBLIC_CERT_PATH=/run/secrets/at-public-2027.cer \
  -v /etc/ivazen/at-key.pem:/run/secrets/at-key.pem:ro \
  -v /etc/ivazen/at-cert.pem:/run/secrets/at-cert.pem:ro \
  -v /etc/ivazen/at-public-2027.cer:/run/secrets/at-public-2027.cer:ro \
  at-connector
```

## Notes

- Never log or persist passwords.
- Use HTTPS in front of this service (nginx/caddy) and restrict access.
