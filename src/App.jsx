import React, { useState, useEffect, useRef, useCallback } from "react";
import { Film, Star, Check, X, Shuffle, Sparkles, Settings, Search, Loader2, Trash2, Ticket, ChevronRight, ArrowLeft } from "lucide-react";

/* ---------------------------------------------------------
   CINÉ.MATCH — a marquee-lit movie recommendation ticket booth
   Built on the TMDB API.
--------------------------------------------------------- */

const IMG_POSTER = "https://image.tmdb.org/t/p/w342";
const IMG_THUMB = "https://image.tmdb.org/t/p/w92";
const IMG_BACKDROP = "https://image.tmdb.org/t/p/w780";

// Default TMDB key so visitors never have to enter one themselves.
// Comes from an env var (set in .env locally, or your host's
// dashboard when deployed) so it never gets committed to git.
// NOTE: this offers no real secrecy — every TMDB request sends this
// key as a plain query param, so it's visible in any browser's
// Network tab regardless of how it's stored in source.
const DEFAULT_TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

const MOODS = [
  { id: "feelgood", label: "Feel-Good", sub: "warm & easy", genres: [35, 10751], sort: "popularity.desc" },
  { id: "cozy", label: "Cozy Night In", sub: "soft & romantic", genres: [10749, 16], sort: "popularity.desc" },
  { id: "edge", label: "Edge of Seat", sub: "tense thrillers", genres: [53, 9648], sort: "popularity.desc" },
  { id: "mindbend", label: "Mind-Bending", sub: "sci-fi & mystery", genres: [878, 9648], sort: "vote_average.desc" },
  { id: "tearjerker", label: "Tear-Jerker", sub: "bring tissues", genres: [18], sort: "vote_average.desc" },
  { id: "laugh", label: "Laugh Out Loud", sub: "straight comedy", genres: [35], sort: "popularity.desc" },
  { id: "epic", label: "Epic Adventure", sub: "big & bold", genres: [12, 28], sort: "popularity.desc" },
  { id: "chilling", label: "Spine-Chilling", sub: "horror night", genres: [27], sort: "popularity.desc" },
];

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function tmdb(apiKey, path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("include_adult", "false");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.status_message || `TMDB request failed (${res.status})`);
  }
  return res.json();
}

function yearOf(m) {
  return (m.release_date || "").slice(0, 4) || "—";
}

/* ---------------- Storage helpers ---------------- */
async function loadKey(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
  }
}

/* ================= Sprocket divider (signature motif) ================= */
function Sprocket({ flip }) {
  const holes = new Array(28).fill(0);
  return (
    <div className={`sprocket ${flip ? "sprocket-flip" : ""}`}>
      {holes.map((_, i) => (
        <span key={i} className="sprocket-hole" />
      ))}
    </div>
  );
}

/* ================= Movie poster card ================= */
function PosterCard({ movie, onWatched, onDismiss, watched, showDismiss = true, meta }) {
  const [img, setImg] = useState(true);
  return (
    <div className="stub">
      <div className="stub-poster">
        {movie.poster_path && img ? (
          <img
            src={`${IMG_POSTER}${movie.poster_path}`}
            alt={movie.title}
            onError={() => setImg(false)}
            loading="lazy"
          />
        ) : (
          <div className="stub-noimg"><Film size={28} /></div>
        )}
        {watched && (
          <div className="stub-watched-flag"><Check size={13} /> Watched</div>
        )}
      </div>
      <Sprocket />
      <div className="stub-body">
        <h3 className="stub-title">{movie.title}</h3>
        <div className="stub-meta">
          <span>{yearOf(movie)}</span>
          <span className="dot">•</span>
          <span className="stub-rating"><Star size={11} fill="currentColor" /> {movie.vote_average ? movie.vote_average.toFixed(1) : "—"}</span>
          {meta}
        </div>
        {movie.overview && <p className="stub-overview">{movie.overview}</p>}
        <div className="stub-actions">
          {!watched ? (
            <button className="btn btn-amber" onClick={() => onWatched(movie)}>
              <Check size={14} /> Mark watched
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => onWatched(movie, true)}>
              <Trash2 size={14} /> Remove from collection
            </button>
          )}
          {showDismiss && !watched && (
            <button className="btn-icon" title="Not interested" onClick={() => onDismiss(movie.id)}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Search-to-pick input for onboarding ================= */
function FavoritePicker({ index, value, onPick, apiKey, disabled }) {
  const [query, setQuery] = useState(value ? value.title : "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 350);
  const boxRef = useRef(null);

  useEffect(() => {
    if (value) return;
    if (!debounced || debounced.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    tmdb(apiKey, "/search/movie", { query: debounced })
      .then((d) => {
        if (!cancelled) setResults((d.results || []).slice(0, 6));
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [debounced, apiKey, value]);

  useEffect(() => {
    function onClickAway(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  return (
    <div className="picker" ref={boxRef}>
      <div className="picker-num">{index + 1}</div>
      <div className="picker-input-wrap">
        {value ? (
          <div className="picker-chosen">
            {value.poster_path && <img src={`${IMG_THUMB}${value.poster_path}`} alt="" />}
            <div className="picker-chosen-text">
              <strong>{value.title}</strong>
              <span>{yearOf(value)}</span>
            </div>
            <button className="btn-icon" onClick={() => onPick(index, null)} title="Clear">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="picker-field">
              <Search size={14} className="picker-search-icon" />
              <input
                disabled={disabled}
                placeholder="Search a movie you love…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
              />
              {loading && <Loader2 size={14} className="spin" />}
            </div>
            {open && results.length > 0 && (
              <div className="picker-dropdown">
                {results.map((m) => (
                  <button
                    key={m.id}
                    className="picker-option"
                    onClick={() => { onPick(index, m); setOpen(false); setQuery(m.title); }}
                  >
                    {m.poster_path ? (
                      <img src={`${IMG_THUMB}${m.poster_path}`} alt="" />
                    ) : (
                      <div className="picker-option-noimg"><Film size={12} /></div>
                    )}
                    <div className="picker-option-text">
                      <strong>{m.title}</strong>
                      <span>{yearOf(m)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ================= API key gate ================= */
function ApiKeyScreen({ onSave }) {
  const [val, setVal] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!val.trim()) return;
    setChecking(true);
    setError("");
    try {
      await tmdb(val.trim(), "/configuration");
      onSave(val.trim());
    } catch (err) {
      setError("That key didn't work. Double-check it and try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="marquee-title">
          <span className="bulb" /><span className="bulb" /><span className="bulb" /><span className="bulb" /><span className="bulb" />
          <h1>CINÉ·MATCH</h1>
          <span className="bulb" /><span className="bulb" /><span className="bulb" /><span className="bulb" /><span className="bulb" />
        </div>
        <p className="gate-sub">Your personal ticket booth for movie suggestions, powered by TMDB.</p>
        <form onSubmit={submit} className="gate-form">
          <label>TMDB API key (v3 auth)</label>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Paste your key here"
            autoFocus
          />
          {error && <div className="gate-error">{error}</div>}
          <button className="btn btn-amber btn-block" disabled={checking}>
            {checking ? <><Loader2 size={15} className="spin" /> Checking…</> : <>Enter the booth <ChevronRight size={15} /></>}
          </button>
        </form>
        <a className="gate-link" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
          Don't have a key? Get a free one from TMDB →
        </a>
        <p className="gate-note">Stored privately for you in this app — it never leaves your device except to talk to TMDB directly.</p>
      </div>
    </div>
  );
}

/* ================= Onboarding: pick 5 favorites ================= */
function Onboarding({ apiKey, onComplete }) {
  const [picks, setPicks] = useState([null, null, null, null, null]);
  const handlePick = (i, movie) => {
    setPicks((prev) => {
      const next = [...prev];
      next[i] = movie;
      return next;
    });
  };
  const filled = picks.filter(Boolean);
  const canSubmit = filled.length === 5 && new Set(filled.map((m) => m.id)).size === 5;

  return (
    <div className="onboard">
      <div className="marquee-title small">
        <span className="bulb" /><span className="bulb" /><span className="bulb" />
        <h1>Name your five</h1>
        <span className="bulb" /><span className="bulb" /><span className="bulb" />
      </div>
      <p className="onboard-sub">Pick five movies you already love. We'll use them to build your first reel of suggestions.</p>
      <div className="picker-list">
        {picks.map((p, i) => (
          <FavoritePicker key={i} index={i} value={p} onPick={handlePick} apiKey={apiKey} />
        ))}
      </div>
      {filled.length === 5 && !canSubmit && (
        <div className="gate-error" style={{ textAlign: "center" }}>Pick five different movies.</div>
      )}
      <button className="btn btn-amber btn-block" disabled={!canSubmit} onClick={() => onComplete(filled)}>
        <Ticket size={15} /> Print my ticket
      </button>
    </div>
  );
}

/* ================= Recommendations tab ================= */
function RecommendTab({ apiKey, favorites, watchedIds, dismissed, onWatched, onDismiss }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshFlag, setRefreshFlag] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const scored = new Map();
        for (const fav of favorites) {
          const [recRes, simRes] = await Promise.all([
            tmdb(apiKey, `/movie/${fav.id}/recommendations`, { page: 1 }),
            tmdb(apiKey, `/movie/${fav.id}/similar`, { page: 1 }),
          ]);
          [...(recRes.results || []), ...(simRes.results || [])].forEach((m, idx) => {
            if (!m || m.adult) return;
            if ((m.vote_count || 0) < 15) return;
            const weight = Math.max(1, 20 - idx);
            const cur = scored.get(m.id) || { movie: m, score: 0, matches: 0 };
            cur.score += weight;
            cur.matches += 1;
            scored.set(m.id, cur);
          });
        }
        const favIds = new Set(favorites.map((f) => f.id));
        let list = Array.from(scored.values())
          .filter((x) => !favIds.has(x.movie.id) && !watchedIds.has(x.movie.id) && !dismissed.has(x.movie.id))
          .map((x) => ({ ...x, final: x.score * Math.log2(x.matches + 1) }))
          .sort((a, b) => b.final - a.final)
          .slice(0, 24)
          .map((x) => x.movie);
        if (!cancelled) setRecs(list);
      } catch (err) {
        if (!cancelled) setError(err.message || "Something went wrong fetching recommendations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [apiKey, favorites, refreshFlag]);

  const visible = recs.filter((m) => !dismissed.has(m.id) && !watchedIds.has(m.id));

  return (
    <div>
      <div className="tab-head">
        <div>
          <h2>Your reel</h2>
          <p>Built from {favorites.map((f) => f.title).join(", ")}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setRefreshFlag((f) => f + 1)}>
          <Sparkles size={14} /> Re-cut the reel
        </button>
      </div>
      {loading && <div className="loading"><Loader2 size={18} className="spin" /> Threading the film…</div>}
      {error && <div className="gate-error">{error}</div>}
      {!loading && !error && visible.length === 0 && (
        <div className="empty">No picks left in this reel — dismiss fewer, or re-cut it.</div>
      )}
      <div className="grid">
        {visible.map((m) => (
          <PosterCard
            key={m.id}
            movie={m}
            watched={false}
            onWatched={(mov) => onWatched(mov)}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

/* ================= Mood tab ================= */
function MoodTab({ apiKey, watchedIds, dismissed, onWatched, onDismiss }) {
  const [active, setActive] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pick(mood) {
    setActive(mood);
    setLoading(true);
    setError("");
    try {
      const page = 1 + Math.floor(Math.random() * 5);
      const data = await tmdb(apiKey, "/discover/movie", {
        with_genres: mood.genres.join(","),
        sort_by: mood.sort,
        "vote_count.gte": 100,
        page,
      });
      const list = (data.results || []).filter((m) => !watchedIds.has(m.id) && !dismissed.has(m.id));
      setResults(list);
    } catch (err) {
      setError(err.message || "Couldn't load that mood.");
    } finally {
      setLoading(false);
    }
  }

  if (!active) {
    return (
      <div>
        <div className="tab-head">
          <div>
            <h2>What's the mood tonight?</h2>
            <p>Pick a feeling, get a screening.</p>
          </div>
        </div>
        <div className="mood-grid">
          {MOODS.map((m) => (
            <button key={m.id} className="mood-tile" onClick={() => pick(m)}>
              <span className="mood-label">{m.label}</span>
              <span className="mood-sub">{m.sub}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-head">
        <div>
          <button className="btn btn-ghost" onClick={() => setActive(null)}><ArrowLeft size={14} /> Moods</button>
          <h2 style={{ marginTop: 8 }}>{active.label}</h2>
          <p>{active.sub}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => pick(active)}>
          <Sparkles size={14} /> Shuffle picks
        </button>
      </div>
      {loading && <div className="loading"><Loader2 size={18} className="spin" /> Setting the mood…</div>}
      {error && <div className="gate-error">{error}</div>}
      <div className="grid">
        {results.filter((m) => !watchedIds.has(m.id) && !dismissed.has(m.id)).map((m) => (
          <PosterCard key={m.id} movie={m} watched={false} onWatched={onWatched} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

/* ================= Random tab ================= */
function RandomTab({ apiKey, watchedIds, dismissed, onWatched, onDismiss }) {
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState(false);

  const spin = useCallback(async () => {
    setLoading(true);
    setError("");
    setReveal(false);
    try {
      const sorts = ["popularity.desc", "vote_average.desc", "revenue.desc"];
      let found = null;
      let attempts = 0;
      while (!found && attempts < 5) {
        attempts += 1;
        const sort = sorts[Math.floor(Math.random() * sorts.length)];
        const page = 1 + Math.floor(Math.random() * 40);
        const data = await tmdb(apiKey, "/discover/movie", {
          sort_by: sort,
          "vote_count.gte": 150,
          page,
        });
        const pool = (data.results || []).filter((m) => !watchedIds.has(m.id) && !dismissed.has(m.id) && m.poster_path);
        if (pool.length > 0) found = pool[Math.floor(Math.random() * pool.length)];
      }
      if (!found) setError("Ran out of surprises — try again in a moment.");
      setMovie(found);
      setTimeout(() => setReveal(true), 60);
    } catch (err) {
      setError(err.message || "The projector jammed.");
    } finally {
      setLoading(false);
    }
  }, [apiKey, watchedIds, dismissed]);

  return (
    <div>
      <div className="tab-head">
        <div>
          <h2>Surprise screening</h2>
          <p>One random pick, house's choice.</p>
        </div>
        <button className="btn btn-amber" onClick={spin} disabled={loading}>
          {loading ? <Loader2 size={14} className="spin" /> : <Shuffle size={14} />} {movie ? "Roll again" : "Roll the reel"}
        </button>
      </div>
      {error && <div className="gate-error">{error}</div>}
      {!movie && !loading && !error && (
        <div className="empty">Press "Roll the reel" for a random pick from TMDB's catalog.</div>
      )}
      {movie && (
        <div className={`random-stage ${reveal ? "reveal" : ""}`}>
          <PosterCard movie={movie} watched={false} onWatched={onWatched} onDismiss={onDismiss} showDismiss={false} />
        </div>
      )}
    </div>
  );
}

/* ================= Collection tab ================= */
function CollectionTab({ watched, onWatched }) {
  if (watched.length === 0) {
    return <div className="empty">Nothing in your collection yet — mark movies as watched to file them here.</div>;
  }
  const sorted = [...watched].sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
  return (
    <div>
      <div className="tab-head">
        <div>
          <h2>Your collection</h2>
          <p>{watched.length} movie{watched.length === 1 ? "" : "s"} watched</p>
        </div>
      </div>
      <div className="grid">
        {sorted.map((m) => (
          <PosterCard key={m.id} movie={m} watched onWatched={onWatched} onDismiss={() => {}} showDismiss={false} />
        ))}
      </div>
    </div>
  );
}

/* ================= App shell ================= */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [watched, setWatched] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [tab, setTab] = useState("recommend");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    (async () => {
      const [k, f, w, d] = await Promise.all([
        loadKey("tmdb-api-key", null),
        loadKey("cinematch-favorites", []),
        loadKey("cinematch-watched", []),
        loadKey("cinematch-dismissed", []),
      ]);
      setApiKey(k || DEFAULT_TMDB_KEY);
      setFavorites(f);
      setWatched(w);
      setDismissedIds(d);
      setLoaded(true);
    })();
  }, []);

  const watchedIds = new Set(watched.map((m) => m.id));
  const dismissedSet = new Set(dismissedIds);

  async function handleSaveKey(key) {
    setApiKey(key);
    await saveKey("tmdb-api-key", key);
  }

  async function handleOnboardComplete(picks) {
    setFavorites(picks);
    await saveKey("cinematch-favorites", picks);
  }

  async function handleWatched(movie, remove = false) {
    setWatched((prev) => {
      let next;
      if (remove) {
        next = prev.filter((m) => m.id !== movie.id);
      } else if (prev.some((m) => m.id === movie.id)) {
        next = prev;
      } else {
        next = [...prev, { ...movie, watchedAt: Date.now() }];
      }
      saveKey("cinematch-watched", next);
      return next;
    });
  }

  async function handleDismiss(id) {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveKey("cinematch-dismissed", next);
      return next;
    });
  }

  async function handleResetFavorites() {
    setFavorites([]);
    setShowSettings(false);
    await saveKey("cinematch-favorites", []);
  }

  async function handleChangeKey() {
    setApiKey(null);
    setShowSettings(false);
  }

  return (
    <div className="app">
      <Styles />
      {!loaded ? (
        <div className="loading full"><Loader2 size={20} className="spin" /> Warming the projector…</div>
      ) : !apiKey ? (
        <ApiKeyScreen onSave={handleSaveKey} />
      ) : favorites.length < 5 ? (
        <Onboarding apiKey={apiKey} onComplete={handleOnboardComplete} />
      ) : (
        <div className="shell">
          <header className="header">
            <div className="brand">
              <Film size={18} />
              <span>CINÉ·MATCH</span>
            </div>
            <nav className="tabs">
              <button className={tab === "recommend" ? "tab active" : "tab"} onClick={() => setTab("recommend")}>For You</button>
              <button className={tab === "mood" ? "tab active" : "tab"} onClick={() => setTab("mood")}>Moods</button>
              <button className={tab === "random" ? "tab active" : "tab"} onClick={() => setTab("random")}>Random</button>
              <button className={tab === "collection" ? "tab active" : "tab"} onClick={() => setTab("collection")}>
                Collection{watched.length > 0 ? ` (${watched.length})` : ""}
              </button>
            </nav>
            <button className="btn-icon" onClick={() => setShowSettings((s) => !s)} title="Settings">
              <Settings size={17} />
            </button>
          </header>
          {showSettings && (
            <div className="settings-panel">
              <button className="btn btn-ghost" onClick={handleResetFavorites}>Change your five favorites</button>
              <button className="btn btn-ghost" onClick={handleChangeKey}>Use a different API key</button>
            </div>
          )}
          <Sprocket />
          <main className="main">
            {tab === "recommend" && (
              <RecommendTab
                apiKey={apiKey}
                favorites={favorites}
                watchedIds={watchedIds}
                dismissed={dismissedSet}
                onWatched={handleWatched}
                onDismiss={handleDismiss}
              />
            )}
            {tab === "mood" && (
              <MoodTab apiKey={apiKey} watchedIds={watchedIds} dismissed={dismissedSet} onWatched={handleWatched} onDismiss={handleDismiss} />
            )}
            {tab === "random" && (
              <RandomTab apiKey={apiKey} watchedIds={watchedIds} dismissed={dismissedSet} onWatched={handleWatched} onDismiss={handleDismiss} />
            )}
            {tab === "collection" && <CollectionTab watched={watched} onWatched={handleWatched} />}
          </main>
        </div>
      )}
    </div>
  );
}

/* ================= Styles ================= */
function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

      :root {
        --bg: #0B0E14;
        --panel: #12161F;
        --panel-raised: #1A2030;
        --border: #232A3A;
        --amber: #F2B705;
        --amber-dim: #8a6b0a;
        --teal: #3FA9A0;
        --green: #6FCF97;
        --text: #F5F3EE;
        --muted: #8A93A6;
      }
      * { box-sizing: border-box; }
      .app {
        background: radial-gradient(ellipse at top, #161c29 0%, var(--bg) 55%);
        min-height: 100vh;
        color: var(--text);
        font-family: 'Inter', sans-serif;
        padding-bottom: 40px;
      }
      button { font-family: inherit; cursor: pointer; }
      input { font-family: inherit; }

      /* Marquee bulbs */
      .marquee-title {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .marquee-title h1 {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 52px;
        letter-spacing: 4px;
        color: var(--amber);
        text-shadow: 0 0 18px rgba(242,183,5,0.45);
        margin: 0;
      }
      .marquee-title.small h1 { font-size: 34px; }
      .bulb {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--amber);
        box-shadow: 0 0 8px rgba(242,183,5,0.9);
        animation: flicker 2.4s infinite ease-in-out;
      }
      .bulb:nth-child(2n) { animation-delay: .4s; }
      .bulb:nth-child(3n) { animation-delay: .8s; }
      @keyframes flicker { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
      @media (prefers-reduced-motion: reduce) { .bulb { animation: none; } }

      /* Gate / onboarding */
      .gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .gate-card {
        max-width: 420px; width: 100%;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 32px 28px;
        text-align: center;
      }
      .gate-sub { color: var(--muted); margin: 6px 0 24px; font-size: 14px; }
      .gate-form { display: flex; flex-direction: column; gap: 10px; text-align: left; }
      .gate-form label { font-size: 12px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; letter-spacing: 0.5px; }
      .gate-form input {
        background: var(--panel-raised); border: 1px solid var(--border); color: var(--text);
        padding: 12px 14px; border-radius: 8px; font-size: 14px; outline: none;
      }
      .gate-form input:focus { border-color: var(--amber); }
      .gate-error { color: #ff8080; font-size: 13px; margin: 4px 0; }
      .gate-link { display: block; margin-top: 16px; font-size: 13px; color: var(--teal); text-decoration: none; }
      .gate-link:hover { text-decoration: underline; }
      .gate-note { margin-top: 14px; font-size: 11px; color: var(--muted); }

      .onboard { max-width: 640px; margin: 0 auto; padding: 48px 20px; }
      .onboard-sub { text-align: center; color: var(--muted); margin-bottom: 28px; }
      .picker-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
      .picker { display: flex; align-items: center; gap: 12px; position: relative; }
      .picker-num {
        font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: var(--amber);
        width: 28px; text-align: center; flex-shrink: 0;
      }
      .picker-input-wrap { flex: 1; position: relative; }
      .picker-field {
        display: flex; align-items: center; gap: 8px;
        background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
      }
      .picker-field:focus-within { border-color: var(--amber); }
      .picker-field input { flex: 1; background: transparent; border: none; color: var(--text); outline: none; font-size: 14px; }
      .picker-search-icon { color: var(--muted); flex-shrink: 0; }
      .picker-dropdown {
        position: absolute; top: 105%; left: 0; right: 0; z-index: 20;
        background: var(--panel-raised); border: 1px solid var(--border); border-radius: 8px;
        overflow: hidden; max-height: 280px; overflow-y: auto;
      }
      .picker-option { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; background: none; border: none; text-align: left; }
      .picker-option:hover { background: rgba(242,183,5,0.08); }
      .picker-option img { width: 30px; height: 45px; object-fit: cover; border-radius: 3px; }
      .picker-option-noimg { width: 30px; height: 45px; background: var(--panel); display: flex; align-items: center; justify-content: center; color: var(--muted); border-radius: 3px; }
      .picker-option-text { display: flex; flex-direction: column; }
      .picker-option-text strong { font-size: 13px; }
      .picker-option-text span { font-size: 11px; color: var(--muted); }
      .picker-chosen { display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--amber-dim); border-radius: 8px; padding: 6px 10px; }
      .picker-chosen img { width: 30px; height: 45px; object-fit: cover; border-radius: 3px; }
      .picker-chosen-text { display: flex; flex-direction: column; flex: 1; }
      .picker-chosen-text strong { font-size: 13px; }
      .picker-chosen-text span { font-size: 11px; color: var(--muted); }

      /* Buttons */
      .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 7px; border: 1px solid var(--border); background: var(--panel-raised); color: var(--text); font-size: 13px; font-weight: 500; }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn-amber { background: var(--amber); color: #1a1400; border-color: var(--amber); font-weight: 600; }
      .btn-amber:hover:not(:disabled) { background: #ffcb2e; }
      .btn-ghost { background: transparent; }
      .btn-ghost:hover { border-color: var(--amber-dim); }
      .btn-block { width: 100%; justify-content: center; margin-top: 6px; }
      .btn-icon { background: none; border: none; color: var(--muted); padding: 6px; border-radius: 6px; display: flex; align-items: center; }
      .btn-icon:hover { color: var(--text); background: rgba(255,255,255,0.06); }
      .spin { animation: spin 1s linear infinite; }
      @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Shell / header */
      .shell { max-width: 1100px; margin: 0 auto; padding: 20px; }
      .header { display: flex; align-items: center; gap: 20px; padding: 6px 4px 14px; flex-wrap: wrap; }
      .brand { display: flex; align-items: center; gap: 8px; font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 2px; color: var(--amber); }
      .tabs { display: flex; gap: 4px; flex: 1; }
      .tab { background: none; border: none; color: var(--muted); padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; }
      .tab.active { color: var(--bg); background: var(--amber); }
      .tab:not(.active):hover { color: var(--text); }
      .settings-panel { display: flex; gap: 10px; padding: 0 4px 14px; }

      .sprocket { display: flex; justify-content: space-between; padding: 0 2px; margin: 6px 0 18px; opacity: 0.5; }
      .sprocket-hole { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }

      .tab-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
      .tab-head h2 { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 1px; margin: 0 0 2px; }
      .tab-head p { color: var(--muted); font-size: 13px; margin: 0; }

      .loading { display: flex; align-items: center; gap: 8px; color: var(--muted); padding: 30px 0; justify-content: center; font-size: 14px; }
      .loading.full { min-height: 100vh; }
      .empty { color: var(--muted); text-align: center; padding: 40px 0; font-size: 14px; border: 1px dashed var(--border); border-radius: 10px; }

      /* Grid + stub card */
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 18px; }
      .stub { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
      .stub-poster { position: relative; aspect-ratio: 2/3; background: var(--panel-raised); }
      .stub-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .stub-noimg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--muted); }
      .stub-watched-flag { position: absolute; top: 8px; right: 8px; background: var(--green); color: #0a1f14; font-size: 11px; font-weight: 700; padding: 3px 7px; border-radius: 5px; display: flex; align-items: center; gap: 3px; }
      .stub .sprocket { margin: 0; padding: 6px 8px; background: var(--panel-raised); }
      .stub-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .stub-title { font-size: 15px; font-weight: 700; margin: 0; line-height: 1.25; }
      .stub-meta { display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); }
      .stub-rating { display: flex; align-items: center; gap: 3px; color: var(--amber); }
      .stub-meta .dot { opacity: 0.5; }
      .stub-overview { font-size: 12px; color: var(--muted); line-height: 1.4; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .stub-actions { margin-top: auto; display: flex; align-items: center; gap: 6px; }
      .stub-actions .btn { flex: 1; justify-content: center; }

      /* Mood grid */
      .mood-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
      .mood-tile {
        background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px 14px;
        display: flex; flex-direction: column; gap: 4px; text-align: left;
      }
      .mood-tile:hover { border-color: var(--teal); background: var(--panel-raised); }
      .mood-label { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.5px; color: var(--teal); }
      .mood-sub { font-size: 12px; color: var(--muted); }

      /* Random stage */
      .random-stage { max-width: 260px; margin: 0 auto; opacity: 0; transform: translateY(8px); transition: opacity .35s ease, transform .35s ease; }
      .random-stage.reveal { opacity: 1; transform: translateY(0); }
      @media (prefers-reduced-motion: reduce) { .random-stage { transition: none; opacity: 1; transform: none; } }

      @media (max-width: 560px) {
        .marquee-title h1 { font-size: 36px; }
        .header { flex-direction: column; align-items: stretch; }
        .tabs { overflow-x: auto; }
      }
    `}</style>
  );
}
