import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, FileText, Calendar } from 'lucide-react';
import './UserSearch.css';

export function UserSearch() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);
  const [error, setError] = useState(null);
  const [wordCloudModal, setWordCloudModal] = useState(null);

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const openWordCloud = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get('http://localhost:5000/api/admin/file_stats', { 
        params: { filename }, 
        headers: { 'X-Role': 'user', 'Authorization': `Bearer ${token}` } 
      });
      console.log('Word cloud response:', resp.data);
      setWordCloudModal({ filename, words: resp.data.words || [] });
    } catch(err) { 
      console.error('Word cloud error:', err);
    }
  };

  const performSearch = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/search', {
        params: { q: searchTerm },
        headers: { 'X-Role': 'user', 'Authorization': `Bearer ${token}` }
      });
      // Backend returns {results: {filename: {...}}, suggestions: []}
      // Convert object to array of entries for rendering
      const resultsArray = response.data.results ? Object.entries(response.data.results).map(([filename, data]) => ({ filename, ...data })) : [];
      setResults(resultsArray);
    } catch (err) {
      setError('Erreur lors de la recherche');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate file type statistics
  const getFileTypeStats = () => {
    const stats = {};
    results.forEach(result => {
      const type = result.type || 'unknown';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  };

  const fileTypeStats = getFileTypeStats();
  const fileTypeStatsText = Object.entries(fileTypeStats)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="user-search"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ padding: '40px 30px', maxWidth: '1400px', margin: '0 auto' }}
    >
      {/* Header */}
      <motion.div 
        variants={itemVariants}
        style={{ marginBottom: '30px' }}
      >
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '700', 
          color: '#1f2937',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          🔍 Recherche Documentaire
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>
          Explorez le corpus documentaire et trouvez les informations dont vous avez besoin
        </p>
      </motion.div>

      {/* Search Bar */}
      <motion.form 
        className="search-form"
        variants={itemVariants}
        onSubmit={handleSearch}
      >
        <div className="search-wrapper">
          <Search size={24} />
          <input
            type="text"
            placeholder="Rechercher des documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-field"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="search-submit"
          >
            Rechercher
          </motion.button>
        </div>
      </motion.form>

      {/* Results Info */}
      {!loading && results.length > 0 && (
        <motion.div className="results-info" variants={itemVariants}>
          <p>
            Environ <strong>{results.length}</strong> résultat(s) ({fileTypeStatsText})
          </p>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div className="error-message" variants={itemVariants}>
          ⚠️ {error}
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <motion.div className="loading" variants={itemVariants}>
          <div className="spinner"></div>
          <p>Recherche en cours...</p>
        </motion.div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <motion.div 
          className="results-list"
          variants={containerVariants}
        >
          {results.map((result, idx) => (
            <motion.div
              key={idx}
              className="result-item"
              variants={itemVariants}
              whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease'
              }}
            >
              <div className="result-content">
                <h3 style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: '600', 
                  color: '#1f2937', 
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📄 {result.filename}
                </h3>
                <p style={{ 
                  fontSize: '0.95rem', 
                  color: '#6b7280', 
                  lineHeight: '1.6',
                  marginBottom: '12px'
                }}>
                  {result.preview || result.context?.substring(0, 300) + '...' || 'Aucun aperçu disponible'}
                </p>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  gap: '16px', 
                  fontSize: '0.85rem',
                  color: '#9ca3af',
                  marginBottom: '8px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📅 {result.date_import ? new Date(result.date_import).toLocaleDateString('fr-FR') : 'Date inconnue'}
                  </span>
                  <span>·</span>
                  <span>Type: {result.type || 'unknown'}</span>
                  <span>·</span>
                  <span>Occurrences: {result.total_occurrences || 0}</span>
                </div>
                {result.word_occurrences && Object.keys(result.word_occurrences).length > 0 && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '10px 14px', 
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#0369a1',
                    borderLeft: '3px solid #0ea5e9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>
                      <strong>Fréquences:</strong> {Object.entries(result.word_occurrences)
                        .map(([word, count]) => `"${word}" (${count})`)
                        .join(', ')}
                    </span>
                    <motion.button
                      onClick={() => openWordCloud(result.filename)}
                      style={{
                        background: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        marginLeft: '12px'
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      ☁️ Nuage
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && query && (
        <motion.div className="no-results" variants={itemVariants}>
          <div className="no-results-icon">🔍</div>
          <h2>Aucun résultat</h2>
          <p>Nous n'avons trouvé aucun document correspondant à "{query}"</p>
          <p className="suggestion">Essayez d'autres mots-clés ou consultez la page d'accueil</p>
        </motion.div>
      )}

      {/* Initial State */}
      {!loading && results.length === 0 && !query && (
        <motion.div className="initial-state" variants={itemVariants}>
          <div className="initial-icon">📝</div>
          <h2>Commencez votre recherche</h2>
          <p>Entrez des mots-clés pour explorer le corpus documentaire</p>
        </motion.div>
      )}

      {/* Word Cloud Modal */}
      {wordCloudModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setWordCloudModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setWordCloudModal(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                lineHeight: 1,
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              ✕
            </button>
            <h2 style={{ marginBottom: '20px', color: '#1f2937', fontSize: '1.5rem' }}>
              ☁️ Nuage de mots - {wordCloudModal.filename}
            </h2>
            <div style={{ 
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              borderRadius: '12px',
              padding: '30px',
              border: '2px solid #e0e0e0',
              minHeight: '300px'
            }}>
              {wordCloudModal.words && wordCloudModal.words.length > 0 ? (
                wordCloudModal.words.slice(0, 50).map((wordItem, idx) => {
                  const text = Array.isArray(wordItem) ? wordItem[0] : wordItem.word || wordItem.text || wordItem;
                  const value = Array.isArray(wordItem) ? wordItem[1] : wordItem.count || wordItem.value || 1;
                  
                  const maxValue = Math.max(...wordCloudModal.words.map(w => Array.isArray(w) ? w[1] : (w.count || w.value || 1)));
                  const minValue = Math.min(...wordCloudModal.words.map(w => Array.isArray(w) ? w[1] : (w.count || w.value || 1)));
                  const fontSize = 14 + ((value - minValue) / (maxValue - minValue || 1)) * 34;
                  
                  const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
                  const color = colors[idx % colors.length];
                  return (
                    <motion.span
                      key={idx}
                      whileHover={{ scale: 1.2 }}
                      style={{
                        fontSize: `${fontSize}px`,
                        fontWeight: 'bold',
                        color: color,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        display: 'inline-block'
                      }}
                      title={`${text}: ${value}`}
                    >
                      {text}
                    </motion.span>
                  );
                })
              ) : (
                <p style={{ color: '#999', fontSize: '16px', fontWeight: '500' }}>
                  Aucune donnée de mots disponible
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
