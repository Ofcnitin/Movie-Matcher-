# Keeping the TMDB key out of your GitHub repo

The version in `cinematch.jsx` (the Claude artifact) has the key baked
directly into the source — that's fine for previewing here, but if you
copy this code into a real project and push it to GitHub, **don't commit
it that way**. Anyone browsing your repo's files or history would see it
in plain text permanently, even if you remove it in a later commit.

## Setup (Vite/CRA-style project)

1. Copy `.env.example` → `.env` and paste your real key into `.env`.
2. Copy `.gitignore` into your project root (or merge the `.env` line
   into your existing one) — this stops `.env` from ever being staged.
3. In `cinematch.jsx`, replace the hardcoded key with:

   ```js
   const DEFAULT_TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
   ```

4. Commit and push as normal — only `.env.example` (no real key) ever
   reaches GitHub. Each person who clones the repo makes their own `.env`.
5. When you deploy (Vercel/Netlify/etc.), add `VITE_TMDB_API_KEY` as an
   environment variable in that platform's dashboard, not in the repo.

## The part this doesn't solve

This only keeps the key out of your **repo**. Once the app is built and
running in someone's browser, the key still gets sent as a plain URL
parameter on every request to TMDB — so it's visible in that browser's
Network tab regardless. There's no client-side-only way around that; a
truly hidden key requires a small backend/proxy that holds the key
server-side and the app calls your server instead of TMDB directly.
If that ever matters to you (e.g. the key starts getting abused), that
proxy is the next step — happy to build one if you want it.

## If the key ever leaks or gets abused

Regenerate it at https://www.themoviedb.org/settings/api and swap the
new value into `.env` (or your host's environment variables). Nothing
else in the app needs to change.


## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file from `.env.example`.
3. Put your TMDB key in `.env`:
   ```env
   VITE_TMDB_API_KEY=your_tmdb_api_key_here
   ```
4. Start the app:
   ```bash
   npm run dev
   ```

### Security

Do **not** commit `.env` or any file containing your real API key. `.env` is ignored by Git through `.gitignore`; `.env.example` is safe to commit because it contains only a placeholder.
