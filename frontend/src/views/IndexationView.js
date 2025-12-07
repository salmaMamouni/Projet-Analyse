import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import SearchResults from "../components/SearchResults";
import "./IndexationView.css";

export default function IndexationView() {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('all_words_and');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const totalResults = Array.isArray(results)
    ? results.length
    : (results && typeof results === "object" ? Object.keys(results).length : 0);

  const modeLabels = {
    all_words_and: "Tous les mots",
    or: "Au moins un mot",
    exact: "Expression exacte"
  };

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await fetch('/api/documents', { headers: { 'X-Role': 'user' } });
        const docs = await response.json();
        const types = [...new Set(docs.map(d => d.type).filter(Boolean))];
        setAvailableTypes(types);
      } catch (err) {
        console.error("Erreur récupération types:", err);
      }
    };
    fetchTypes();
  }, []);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    const initialMode = searchParams.get('mode') || 'all_words_and';
    const initialTypes = searchParams.get('types');

    if (initialTypes) {
      setSelectedTypes(initialTypes.split(',').filter(Boolean));
    }

    if (initialQuery) {
      setQuery(initialQuery);
      setMode(initialMode);
      handleSearch(initialQuery, initialMode, true, initialTypes ? initialTypes.split(',').filter(Boolean) : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!query) return;
    handleSearch(query, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypes]);

  const handleSearch = async (q, nextMode = mode, skipUrlUpdate = false, typesOverride = null) => {
    const trimmedQuery = (q || '').trim();
    if (!trimmedQuery) return;

    const appliedMode = nextMode || 'all_words_and';
    const appliedTypes = Array.isArray(typesOverride) ? typesOverride : selectedTypes;

    setQuery(trimmedQuery);
    setMode(appliedMode);
    setLoading(true);
    setError(null);

    try {
      const typesParam = appliedTypes.length > 0 ? `&types=${appliedTypes.join(',')}` : '';
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(trimmedQuery)}&mode=${appliedMode}${typesParam}`,
        { headers: { 'X-Role': 'user' } }
      );
      const data = await response.json();
      setResults(data.results || []);

      if (!skipUrlUpdate) {
        const nextParams = { q: trimmedQuery, mode: appliedMode };
        if (appliedTypes.length > 0) nextParams.types = appliedTypes.join(',');
        setSearchParams(nextParams);
      }
    } catch (err) {
      console.error("Erreur de recherche :", err);
      setError("Recherche impossible pour le moment. Merci de réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-search-page">
      <div className="search-shell">
        <div className="search-card">
          <SearchBar
            onSearch={handleSearch}
            inputValue={query}
            onInputChange={(v) => setQuery(v)}
            modeValue={mode}
            onModeChange={(m) => setMode(m)}
          />

          {availableTypes.length > 0 && (
            <div className="type-filter">
              <p className="label">Type de document</p>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${selectedTypes.length === 0 ? 'chip-active' : ''}`}
                  onClick={() => setSelectedTypes([])}
                >
                  Tous
                </button>
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`chip ${selectedTypes.includes(type) ? 'chip-active' : ''}`}
                    onClick={() => {
                      setSelectedTypes((prev) =>
                        prev.includes(type)
                          ? prev.filter((t) => t !== type)
                          : [...prev, type]
                      );
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="results-panel">
          {error && <div className="error-banner">{error}</div>}

          {loading ? (
            <div className="loading-block">
              <div className="spinner" aria-hidden />
              <p>Recherche en cours...</p>
            </div>
          ) : (
            <>
              {query && (
                <div className="results-header">
                  <div>
                    <p className="label">Résultats</p>
                    <h4>{totalResults} document{totalResults > 1 ? 's' : ''} trouvé{totalResults > 1 ? 's' : ''}</h4>
                    <p className="muted">
                      Mode : {modeLabels[mode] || mode} · {selectedTypes.length > 0 ? `Types : ${selectedTypes.join(', ')}` : 'Tous les types'}
                    </p>
                  </div>
                </div>
              )}

              <SearchResults
                results={results}
                query={query}
                onWordClick={(word) => {
                  const newQuery = query ? `${query} ${word}` : word;
                  setQuery(newQuery);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
