# Supabase — database & backend tunnel registry

Project ref: **`mpzvaicxzbnfocytwpxk`**
Dashboard:   https://supabase.com/dashboard/project/mpzvaicxzbnfocytwpxk

## 1. Create the schema

Open the Supabase **SQL editor** and run the file:

```
supabase/migrations/20260421000000_tunnel_registry.sql
```

This creates:

- `public.tunnel_registry` — single-row table (id=1) storing the latest tunnel URL
- Trigger that bumps `updated_at` on every update
- Row-Level Security policies
  - `anon`         — read-only
  - `service_role` — full read / write
- Adds the table to `supabase_realtime` so the frontend receives push updates

## 2. Grab the two keys

From **Settings → API**:

| Key name          | Where it goes                       | Sensitivity         |
|-------------------|--------------------------------------|----------------------|
| `anon` public     | `frontend/.env.local` → `VITE_SUPABASE_ANON_KEY` | Safe in the browser |
| `service_role`    | `.env` → `SUPABASE_SERVICE_ROLE_KEY`  | **SECRET — local only** |

Never commit the service-role key. It bypasses every RLS policy.

## 3. Wire up the frontend

```
cp frontend/.env.example frontend/.env.local
# paste the anon key into VITE_SUPABASE_ANON_KEY
```

The frontend (`src/lib/supabase.js`) will:

1. Query `tunnel_registry` on startup
2. Subscribe to realtime changes so the backend URL updates the instant
   `auto_tunnel.py` publishes a new one.

## 4. Wire up the tunnel publisher

```
cp .env.example .env
# paste the service-role key into SUPABASE_SERVICE_ROLE_KEY
```

Then:

```
python auto_tunnel.py
```

Publishes on every tunnel start. Also falls back to the Cloudflare Worker KV
registry, and (optionally) sends an email if `TUNNEL_EMAIL_TO` and SMTP vars
are set.

## 5. MCP configuration (optional, for AI tooling)

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.supabase.com/mcp?project_ref=mpzvaicxzbnfocytwpxk"
      ]
    }
  }
}
```

Restart Windsurf after saving. Requires Windsurf ≥ 0.1.37.

## 6. Agent skills (optional)

```
npx skills add supabase/agent-skills
```
