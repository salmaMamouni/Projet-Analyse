import React, { useState, useEffect, useRef } from "react";

export default function SearchBar({ onSearch, inputValue = null, onInputChange = null, modeValue = null, onModeChange = null }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("or");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const wrapperRef = useRef(null);

  const currentInput = inputValue !== null ? inputValue : input;
  const currentMode = modeValue !== null ? modeValue : mode;

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!currentInput || currentInput.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(currentInput.trim())}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(data.length > 0);
      } catch (err) {
        console.error("Erreur autocomplete:", err);
        setSuggestions([]);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [currentInput]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentInput || currentInput.trim() === "") {
      alert('Il faut écrire quelque chose');
      return;
    }
    setShowSuggestions(false);
    onSearch(currentInput, currentMode);
  };

  const handleSuggestionClick = (suggestion) => {
    if (onInputChange) onInputChange(suggestion);
    else setInput(suggestion);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[activeSuggestionIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="searchbar-shell">
      <div ref={wrapperRef} className="searchbar-input-wrap">
        <div className="searchbar-input">
          <span className="searchbar-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={currentInput}
            onChange={(e) => {
              if (onInputChange) onInputChange(e.target.value);
              else setInput(e.target.value);
              setActiveSuggestionIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button 
            type="submit" 
            className="searchbar-submit"
          >
            Rechercher
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul className="searchbar-suggestions">
            {suggestions.map((s, idx) => {
              const isExactMatch = s.toLowerCase().startsWith(currentInput.toLowerCase());
              return (
                <li
                  key={idx}
                  onClick={() => handleSuggestionClick(s)}
                  className={idx === activeSuggestionIndex ? 'active' : ''}
                  onMouseEnter={() => setActiveSuggestionIndex(idx)}
                >
                  <span className="searchbar-icon muted">🔍</span>
                  <span>{s}</span>
                  {!isExactMatch && <span className="hint">correction</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <select
        className="searchbar-mode"
        value={currentMode}
        onChange={(e) => {
          if (onModeChange) onModeChange(e.target.value);
          else setMode(e.target.value);
        }}
      >
        <option value="all_words_and">AND</option>
        <option value="or">OR</option>
        <option value="exact">Terme complet</option>
      </select>
    </form>
  );
}
