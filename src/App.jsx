import React, { useState, useEffect, useRef, useCallback } from "react";
import { Film, Star, Check, X, Shuffle, Sparkles, Settings, Search, Loader2, Trash2, Ticket, ChevronRight, ArrowLeft, Sun, Moon } from "lucide-react";

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

/* ================= Theme toggle (light / dark glass) ================= */
function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === "light";
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-label="Toggle light and dark mode"
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
      <span>{isLight ? "Dark" : "Light"}</span>
    </button>
  );
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
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    (async () => {
      const [k, f, w, d, t] = await Promise.all([
        loadKey("tmdb-api-key", null),
        loadKey("cinematch-favorites", []),
        loadKey("cinematch-watched", []),
        loadKey("cinematch-dismissed", []),
        loadKey("cinematch-theme", null),
      ]);
      setApiKey(k || DEFAULT_TMDB_KEY);
      setFavorites(f);
      setWatched(w);
      setDismissedIds(d);
      setTheme(
        t || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      );
      setLoaded(true);
    })();
  }, []);

  function handleToggleTheme() {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      saveKey("cinematch-theme", next);
      return next;
    });
  }

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
    <div className="app" data-theme={theme}>
      <Styles />
      <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
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
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600&display=swap');

      /* ============ Neumorphic + glass design tokens ============ */
      :root {
        color-scheme: dark;
        --bg: #000000;
        --surface: #050505;

        --amber: #5EC6FF;
        --amber-strong: #B9E8FF;
        --amber-dim: #1E7BAE;
        --teal: #4FE3D3;
        --green: #74E8A8;
        --danger: #FF7A7A;

        --text: #FFFFFF;
        --muted: #A6ABB8;

        /* neumorphic shadow pair: light = highlight, dark = deep shadow */
        --neu-light: rgba(255,255,255,0.045);
        --neu-dark: rgba(0,0,0,0.85);
        --neu-border: rgba(255,255,255,0.07);

        --neu-out: 7px 7px 15px var(--neu-dark), -7px -7px 15px var(--neu-light);
        --neu-out-sm: 4px 4px 9px var(--neu-dark), -4px -4px 9px var(--neu-light);
        --neu-out-lg: 10px 10px 22px var(--neu-dark), -10px -10px 22px var(--neu-light);
        --neu-in: inset 5px 5px 10px var(--neu-dark), inset -5px -5px 10px var(--neu-light);
        --neu-in-sm: inset 3px 3px 7px var(--neu-dark), inset -3px -3px 7px var(--neu-light);

        /* glass touch — used only on floating/overlay surfaces */
        --glass-bg: rgba(255,255,255,0.055);
        --glass-border: rgba(255,255,255,0.14);
        --glass-blur: blur(20px) saturate(170%);
        --glass-sheen: linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 45%);
      }

      [data-theme="light"] {
        color-scheme: light;
        --bg: #FFFFFF;
        --surface: #FFFFFF;

        --amber: #0B84C9;
        --amber-strong: #2AA6E0;
        --amber-dim: #8FD3F4;
        --teal: #0B8A7E;
        --green: #16884E;
        --danger: #C23B3B;

        --text: #0A0A0B;
        --muted: #62636E;

        --neu-light: rgba(255,255,255,0.95);
        --neu-dark: rgba(163,177,198,0.55);
        --neu-border: rgba(0,0,0,0.05);

        --glass-bg: rgba(255,255,255,0.55);
        --glass-border: rgba(255,255,255,0.85);
        --glass-sheen: linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0) 45%);
      }

      * { box-sizing: border-box; }
      .app {
        position: relative;
        background: var(--bg);
        min-height: 100vh;
        color: var(--text);
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        padding-bottom: 40px;
        transition: background .3s ease, color .3s ease;
      }
      button { font-family: inherit; cursor: pointer; }
      input { font-family: inherit; }
      h1, h2, h3 { font-weight: 800; }

      .shell, .gate, .onboard { position: relative; z-index: 1; }

      /* ============ Base neumorphic surface (flat, borderless, shadow-defined) ============ */
      .gate-card, .stub, .mood-tile, .empty, .picker-chosen, .picker-option-noimg {
        position: relative;
        background: var(--surface);
        box-shadow: var(--neu-out);
        border: 1px solid var(--neu-border);
      }
      /* subtle glass sheen laid over the neumorphic surface — the "touch of glass" */
      .gate-card::before, .stub::before, .mood-tile::before {
        content: "";
        position: absolute; inset: 0;
        background: var(--glass-sheen);
        pointer-events: none;
        border-radius: inherit;
      }

      /* ============ Floating / overlay surfaces get real glass (blur) ============ */
      .theme-toggle, .header, .picker-dropdown, .picker-field, .settings-panel {
        background: var(--glass-bg);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        border: 1px solid var(--glass-border);
      }

      /* Theme toggle — floating glass + neumorphic pill */
      .theme-toggle {
        position: fixed; top: 16px; right: 16px; z-index: 50;
        display: flex; align-items: center; gap: 6px;
        color: var(--text);
        font-weight: 700;
        font-size: 12px;
        padding: 10px 14px;
        border-radius: 999px;
        box-shadow: var(--neu-out-sm);
        transition: transform .15s ease, box-shadow .15s ease;
      }
      .theme-toggle:hover { transform: translateY(-1px); }
      .theme-toggle:active { transform: translateY(0) scale(0.97); box-shadow: var(--neu-in-sm); }

      /* Marquee bulbs */
      .marquee-title { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 6px; }
      .marquee-title h1 {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 52px;
        letter-spacing: 4px;
        color: var(--amber);
        margin: 0;
        font-weight: 800;
      }
      .marquee-title.small h1 { font-size: 34px; }
      .bulb {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--amber);
        box-shadow: 0 0 10px rgba(94,198,255,0.8);
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
        border-radius: 26px;
        padding: 36px 30px;
        text-align: center;
        box-shadow: var(--neu-out-lg);
      }
      .gate-sub { color: var(--muted); margin: 6px 0 24px; font-size: 14px; font-weight: 600; }
      .gate-form { display: flex; flex-direction: column; gap: 10px; text-align: left; }
      .gate-form label { font-size: 12px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      .gate-form input {
        background: var(--surface);
        box-shadow: var(--neu-in);
        border: 1px solid var(--neu-border);
        border-radius: 14px;
        color: var(--text);
        font-weight: 700;
        padding: 13px 15px; font-size: 14px; outline: none;
      }
      .gate-form input::placeholder { color: var(--muted); font-weight: 600; opacity: 0.85; }
      .gate-form input:focus { box-shadow: var(--neu-in), 0 0 0 3px rgba(94,198,255,0.22); }
      .gate-error { color: var(--danger); font-size: 13px; margin: 4px 0; font-weight: 700; }
      .gate-link { display: block; margin-top: 16px; font-size: 13px; color: var(--teal); text-decoration: none; font-weight: 700; }
      .gate-link:hover { text-decoration: underline; }
      .gate-note { margin-top: 14px; font-size: 11px; color: var(--muted); font-weight: 600; }

      .onboard { max-width: 640px; margin: 0 auto; padding: 48px 20px; }
      .onboard-sub { text-align: center; color: var(--muted); margin-bottom: 28px; font-weight: 600; }
      .picker-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
      .picker { display: flex; align-items: center; gap: 12px; position: relative; }
      .picker-num { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: var(--amber); width: 28px; text-align: center; flex-shrink: 0; }
      .picker-input-wrap { flex: 1; position: relative; }
      .picker-field {
        display: flex; align-items: center; gap: 8px;
        border-radius: 14px; padding: 11px 13px;
        box-shadow: var(--neu-in-sm);
      }
      .picker-field:focus-within { box-shadow: var(--neu-in-sm), 0 0 0 3px rgba(94,198,255,0.2); }
      .picker-field input { flex: 1; background: transparent; border: none; color: var(--text); outline: none; font-size: 14px; font-weight: 700; }
      .picker-field input::placeholder { color: var(--muted); font-weight: 600; }
      .picker-search-icon { color: var(--muted); flex-shrink: 0; }
      .picker-dropdown {
        position: absolute; top: 105%; left: 0; right: 0; z-index: 20;
        border-radius: 16px;
        overflow: hidden; max-height: 280px; overflow-y: auto;
        box-shadow: var(--neu-out);
      }
      .picker-option { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 11px; background: none; border: none; text-align: left; }
      .picker-option:hover { background: rgba(94,198,255,0.14); }
      .picker-option img { width: 30px; height: 45px; object-fit: cover; border-radius: 6px; }
      .picker-option-noimg { width: 30px; height: 45px; display: flex; align-items: center; justify-content: center; color: var(--muted); border-radius: 6px; box-shadow: var(--neu-in-sm); }
      .picker-option-text { display: flex; flex-direction: column; }
      .picker-option-text strong { font-size: 13px; color: var(--text); font-weight: 700; }
      .picker-option-text span { font-size: 11px; color: var(--muted); font-weight: 600; }
      .picker-chosen { display: flex; align-items: center; gap: 10px; border-radius: 14px; padding: 7px 11px; }
      .picker-chosen img { width: 30px; height: 45px; object-fit: cover; border-radius: 6px; }
      .picker-chosen-text { display: flex; flex-direction: column; flex: 1; }
      .picker-chosen-text strong { font-size: 13px; font-weight: 700; }
      .picker-chosen-text span { font-size: 11px; color: var(--muted); font-weight: 600; }

      /* ============ Buttons — neumorphic raised, press to inset ============ */
      .btn {
        display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 999px;
        background: var(--surface); color: var(--text);
        border: 1px solid var(--neu-border);
        font-size: 13px; font-weight: 700;
        box-shadow: var(--neu-out-sm);
        transition: transform .12s ease, box-shadow .12s ease;
      }
      .btn:hover:not(:disabled) { transform: translateY(-1px); }
      .btn:active:not(:disabled) { transform: translateY(0); box-shadow: var(--neu-in-sm); }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn-amber {
        background: linear-gradient(135deg, var(--amber-strong), var(--amber));
        color: #06222E; border-color: transparent; font-weight: 800;
        box-shadow: 6px 6px 14px rgba(0,0,0,0.35), -6px -6px 14px rgba(255,255,255,0.04), 0 0 0 1px rgba(94,198,255,0.25);
      }
      [data-theme="light"] .btn-amber { color: #06222E; box-shadow: 6px 6px 14px rgba(163,177,198,0.5), -6px -6px 14px rgba(255,255,255,0.9), 0 0 0 1px rgba(11,132,201,0.15); }
      .btn-amber:hover:not(:disabled) { background: linear-gradient(135deg, #DCF2FF, var(--amber-strong)); transform: translateY(-1px); }
      .btn-amber:active:not(:disabled) { box-shadow: inset 4px 4px 10px rgba(0,0,0,0.35), inset -4px -4px 10px rgba(255,255,255,0.08); }
      .btn-ghost { background: var(--surface); }
      .btn-ghost:hover { color: var(--amber); }
      .btn-block { width: 100%; justify-content: center; margin-top: 6px; }
      .btn-icon {
        background: var(--surface); border: 1px solid var(--neu-border); color: var(--text); padding: 9px; border-radius: 999px; display: flex; align-items: center;
        box-shadow: var(--neu-out-sm);
        transition: transform .12s ease, box-shadow .12s ease;
      }
      .btn-icon:hover { color: var(--amber); transform: translateY(-1px); }
      .btn-icon:active { box-shadow: var(--neu-in-sm); transform: translateY(0); }
      .spin { animation: spin 1s linear infinite; }
      @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Shell / header — glass, sticky feel */
      .shell { max-width: 1100px; margin: 0 auto; padding: 20px; }
      .header {
        display: flex; align-items: center; gap: 20px; padding: 12px 18px; flex-wrap: wrap;
        border-radius: 22px; margin-bottom: 4px;
        box-shadow: var(--neu-out-sm);
        position: sticky; top: 12px; z-index: 10;
      }
      .brand { display: flex; align-items: center; gap: 8px; font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 2px; color: var(--amber); }
      .tabs { display: flex; gap: 4px; flex: 1; flex-wrap: wrap; }
      .tab { background: transparent; border: 1px solid transparent; color: var(--muted); padding: 9px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; }
      .tab.active {
        color: var(--amber); background: var(--surface);
        box-shadow: var(--neu-in-sm);
      }
      .tab:not(.active):hover { color: var(--text); }
      .settings-panel { display: flex; gap: 10px; padding: 12px 14px; margin-top: 8px; border-radius: 18px; flex-wrap: wrap; }

      .sprocket { display: flex; justify-content: space-between; padding: 0 2px; margin: 14px 0 18px; opacity: 0.6; }
      .sprocket-hole { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); opacity: 0.5; }

      .tab-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
      .tab-head h2 { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 1px; margin: 0 0 2px; color: var(--text); font-weight: 800; }
      .tab-head p { color: var(--muted); font-size: 13px; margin: 0; font-weight: 600; }

      .loading { display: flex; align-items: center; gap: 8px; color: var(--text); font-weight: 700; padding: 30px 0; justify-content: center; font-size: 14px; }
      .loading.full { min-height: 100vh; }
      .empty { color: var(--text); font-weight: 700; text-align: center; padding: 40px 0; font-size: 14px; border-radius: 18px; }

      /* Grid + stub card */
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 20px; }
      .stub {
        border-radius: 20px; overflow: hidden; display: flex; flex-direction: column;
        transition: transform .2s ease, box-shadow .2s ease;
      }
      .stub:hover { transform: translateY(-3px); box-shadow: var(--neu-out-lg); }
      .stub-poster { position: relative; aspect-ratio: 2/3; background: var(--surface); }
      .stub-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .stub-noimg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--muted); }
      .stub-watched-flag {
        position: absolute; top: 8px; right: 8px; color: #06210f; font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 999px; display: flex; align-items: center; gap: 3px;
        background: var(--green);
        backdrop-filter: var(--glass-blur);
        -webkit-backdrop-filter: var(--glass-blur);
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      }
      .stub .sprocket { margin: 0; padding: 8px 8px; background: transparent; border-bottom: 1px solid var(--neu-border); opacity: 1; }
      .stub-body { padding: 13px 14px 15px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .stub-title { font-size: 15px; font-weight: 800; margin: 0; line-height: 1.25; color: var(--text); }
      .stub-meta { display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); font-weight: 600; }
      .stub-rating { display: flex; align-items: center; gap: 3px; color: var(--amber); font-weight: 700; }
      .stub-meta .dot { opacity: 0.5; }
      .stub-overview { font-size: 12px; color: var(--muted); font-weight: 600; line-height: 1.45; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .stub-actions { margin-top: auto; display: flex; align-items: center; gap: 6px; }
      .stub-actions .btn { flex: 1; justify-content: center; }

      /* Mood grid */
      .mood-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
      .mood-tile {
        border-radius: 18px; padding: 22px 16px;
        display: flex; flex-direction: column; gap: 4px; text-align: left;
        transition: transform .18s ease, box-shadow .18s ease;
      }
      .mood-tile:hover { transform: translateY(-2px); box-shadow: var(--neu-out-lg); }
      .mood-tile:active { box-shadow: var(--neu-in); transform: translateY(0); }
      .mood-label { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.5px; color: var(--teal); font-weight: 800; }
      .mood-sub { font-size: 12px; color: var(--muted); font-weight: 600; }

      /* Random stage */
      .random-stage { max-width: 260px; margin: 0 auto; opacity: 0; transform: translateY(8px); transition: opacity .35s ease, transform .35s ease; }
      .random-stage.reveal { opacity: 1; transform: translateY(0); }
      @media (prefers-reduced-motion: reduce) { .random-stage { transition: none; opacity: 1; transform: none; } }

      @media (max-width: 560px) {
        .marquee-title h1 { font-size: 36px; }
        .header { flex-direction: column; align-items: stretch; position: static; }
        .tabs { overflow-x: auto; }
        .theme-toggle { top: 10px; right: 10px; padding: 8px 11px; }
      }
    `}</style>
  );
}
