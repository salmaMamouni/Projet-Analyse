import React, { useState } from "react";
import { getDownloadUrl } from "../api/documentApi";
import WordCloudChart from "./WordCloudChart";
import 'bootstrap/dist/css/bootstrap.min.css';

export default function SearchResults({ results = [], query = "", onWordClick = null }) {
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 5;
  const [selectedWordCloud, setSelectedWordCloud] = useState(null);

  // Ensure results is an array
  const resultsArray = Array.isArray(results) ? results : (typeof results === 'object' && results !== null ? Object.entries(results).map(([filename, data]) => ({ filename, ...data })) : []);

  const indexOfLast = currentPage * resultsPerPage;
  const indexOfFirst = indexOfLast - resultsPerPage;
  const currentResults = resultsArray.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(resultsArray.length / resultsPerPage);

  const extractSnippet = (text = "", query, windowSize = 40) => {
    const words = text.split(/\s+/);
    const idx = words.findIndex(w => w.toLowerCase().includes(query.toLowerCase()));

    if (idx === -1) return words.slice(0, 50).join(" ") + "...";

    const start = Math.max(0, idx - windowSize);
    const end = Math.min(words.length, idx + windowSize + 1);
    return words.slice(start, end).join(" ") + "...";
  };

  const highlightText = (text = "", word) => {
    if (!word) return text;
    const regex = new RegExp(`(${word})`, "gi");
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === word.toLowerCase() ? (
        <span key={i} className="bg-warning fw-bold">
          {part}
        </span>
      ) : part
    );
  };

  const formatWords = (wordsArray = []) => {
    if (!wordsArray || wordsArray.length === 0) return [];
    const sorted = [...wordsArray].sort((a, b) => b[1] - a[1]).slice(0, 30);
    const maxValue = sorted[0]?.[1] || 1;
    const minValue = sorted[sorted.length - 1]?.[1] || 1;

    return sorted.map(([text, value]) => {
      const normalized = (value - minValue) / (maxValue - minValue + 1);
      const scaledValue = Math.pow(normalized, 0.6) * 100 + 10;
      return [text, scaledValue];
    });
  };

  const renderWordOccurrences = (wordOccurrences = {}) => {
    const entries = Object.entries(wordOccurrences || {});
    if (entries.length === 0) return null;

    const top = entries.sort((a, b) => b[1] - a[1]).slice(0, 6);
    return (
      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px', color: '#0f172a' }}>
        {top.map(([w, c]) => (
          <span
            key={w}
            style={{ cursor: onWordClick ? 'pointer' : 'default', fontWeight: 600, fontSize: '0.9rem' }}
            onClick={() => {
              if (onWordClick) onWordClick(w);
            }}
            title={`${c} occurrence${c > 1 ? 's' : ''}`}
          >
            {w} · {c}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-3">
      {currentResults.length === 0 ? (
        <div className="text-center text-muted py-5">
          <div style={{fontSize: '2rem', color: '#9aa0a6'}}>☁️</div>
          <p style={{ color: '#70757a', fontSize: '0.95rem' }}>Aucun résultat trouvé</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.875rem', color: '#70757a', marginBottom: '20px' }}>
            Environ {resultsArray.length} résultat{resultsArray.length > 1 ? 's' : ''}
          </div>
          {currentResults.map((item, idx) => (
            <div key={idx} className="mb-4" style={{ 
              borderBottom: '1px solid #ebebeb', 
              paddingBottom: '20px'
            }}>
              <div className="d-flex justify-content-between align-items-start mb-2" style={{ gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h5
                    className="mb-1"
                    style={{ 
                      cursor: "pointer", 
                      fontSize: "20px",
                      color: '#1a0dab',
                      fontWeight: '400'
                    }}
                    onClick={() => {
                      const url = getDownloadUrl(item.filename || item.name);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = item.filename || item.name;
                      a.target = '_blank';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                  >
                    {item.filename || item.name || "Sans nom"}
                  </h5>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {item.words && item.words.length > 0 && (
                    <button
                      className="btn btn-sm btn-outline-primary"
                      style={{ borderRadius: '12px', padding: '6px 10px' }}
                      onClick={() => setSelectedWordCloud(item)}
                      title="Nuage de mots"
                    >
                      ☁️
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    style={{ whiteSpace: 'nowrap', borderRadius: '12px', padding: '6px 10px' }}
                    onClick={() => {
                      const filename = item.filename || item.name || '';
                      const url = `${getDownloadUrl(filename)}`;
                      fetch(url, { headers: { 'X-Role': localStorage.getItem('userRole') || 'user' } })
                        .then(res => {
                          if (!res.ok) throw new Error('Téléchargement échoué');
                          return res.blob();
                        })
                        .then(blob => {
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(a.href);
                        })
                        .catch(err => {
                          console.error('Erreur téléchargement:', err);
                          alert('Impossible de télécharger le document');
                        });
                    }}
                    title="Télécharger le document"
                  >
                    📥
                  </button>
                </div>
              </div>

              <p style={{ 
                fontSize: "14px", 
                lineHeight: "1.58", 
                color: '#4d5156',
                marginBottom: '0.6rem'
              }}>
                {highlightText(extractSnippet(item.context, query), query)}
              </p>

              <div style={{ fontSize: '0.875rem', color: '#70757a', marginBottom: '6px' }}>
                📅 {item.date_import || '—'} · <strong>Type:</strong> {item.type || '—'} · <strong>Occurrences:</strong> {item.total_occurrences || 0}
              </div>
              {renderWordOccurrences(item.word_occurrences)}
            </div>
          ))}
        </>
      )}

      {totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center mt-4 gap-2">
          <button
            className="btn btn-sm"
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            title="Page précédente"
            style={{
              border: 'none',
              background: 'transparent',
              color: currentPage === 1 ? '#ccc' : '#1a0dab',
              fontSize: '1.1rem',
              padding: '8px 12px',
              cursor: currentPage === 1 ? 'default' : 'pointer'
            }}
          >
            ◀
          </button>
          
          <div className="d-flex align-items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => {
                return p === 1 || 
                       p === totalPages || 
                       (p >= currentPage - 2 && p <= currentPage + 2);
              })
              .map((pageNum, idx, arr) => {
                const prevNum = arr[idx - 1];
                const showEllipsis = prevNum && pageNum - prevNum > 1;
                
                return (
                  <React.Fragment key={pageNum}>
                    {showEllipsis && (
                      <span style={{ color: '#70757a', padding: '0 4px' }}>...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        border: 'none',
                        background: pageNum === currentPage ? '#4285f4' : 'transparent',
                        color: pageNum === currentPage ? 'white' : '#4285f4',
                        fontSize: '0.9rem',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: pageNum === currentPage ? '600' : '400',
                        minWidth: '36px'
                      }}
                    >
                      {pageNum}
                    </button>
                  </React.Fragment>
                );
              })}
          </div>

          <button
            className="btn btn-sm"
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            title="Page suivante"
            style={{
              border: 'none',
              background: 'transparent',
              color: currentPage === totalPages ? '#ccc' : '#1a0dab',
              fontSize: '1.1rem',
              padding: '8px 12px',
              cursor: currentPage === totalPages ? 'default' : 'pointer'
            }}
          >
            ▶
          </button>
        </div>
      )}

      {selectedWordCloud && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setSelectedWordCloud(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '900px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              border: '1px solid #e0e0e0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: '600' }}>
                ☁️ Nuage de mots - {selectedWordCloud.filename || selectedWordCloud.name || 'Document'}
              </h2>
              <button
                onClick={() => setSelectedWordCloud(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '22px',
                  cursor: 'pointer',
                  color: '#999'
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ marginBottom: '14px', color: '#666', fontSize: '0.9rem' }}>
              💡 Astuce: cliquez sur un mot pour l'ajouter à la barre de recherche.
            </p>

            <div style={{
              width: '100%',
              minHeight: '320px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              borderRadius: '12px',
              padding: '24px',
              border: '2px solid #e0e0e0'
            }}>
              <WordCloudChart
                words={formatWords(selectedWordCloud.words)}
                onWordClick={(word) => {
                  if (onWordClick) onWordClick(word);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
