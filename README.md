# Azul Online

Files: `index.html` (game), `engine.js` (rules), `config.js` (public Supabase keys), `api/act.js` (server), `supabase.sql` (database).

1. Supabase: create a project, run `supabase.sql` in the SQL Editor.
2. Upload everything in this folder to the root of your GitHub repo (keep the `api` folder as is).
3. Vercel: import the repo, framework "Other". Add environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (service_role key, server only), then redeploy.
4. Optional: put your Supabase URL and anon key in `config.js` for instant updates (otherwise the game refreshes every 4 seconds).
5. Open the site, create a room, copy the invitation link and share it.
