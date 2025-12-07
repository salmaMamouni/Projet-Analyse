import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './AdminManage.css';
import { Modal } from '../components/Modal';
import { showToast } from '../utils/toast';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '—';
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' Mo';
  } else {
    return (bytes / 1024).toFixed(2) + ' Ko';
  }
};

export function AdminManage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/files', {
        params: { q: searchQuery },
        headers: { 'X-Role': 'admin', 'Authorization': `Bearer ${token}` }
      });
      console.log('Files from backend:', response.data);
      if (response.data && response.data.length > 0) {
        console.log('First file size:', response.data[0].size, 'bytes');
        console.log('First file size in MB:', response.data[0].size / (1024*1024), 'MB');
        console.log('First file size in KB:', response.data[0].size / 1024, 'KB');
      }
      setFiles(response.data);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des fichiers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const [sortConfig, setSortConfig] = useState({ key: 'filename', direction: 'ascending' });

  const sortedFiles = React.useMemo(() => {
    let sortableFiles = [...files];
    if (sortConfig !== null) {
      sortableFiles.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        if (aVal < bVal) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableFiles;
  }, [files, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // eslint-disable-next-line no-unused-vars
  const handleDelete = async (filename) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce fichier?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/admin/delete',
        { filename },
        { headers: { 'X-Role': 'admin', 'Authorization': `Bearer ${token}` } }
      );
      console.log('Delete response:', response.data);
      setFiles(files.filter(f => f.filename !== filename));
      showToast('Fichier supprimé avec succès', 'success');
      fetchFiles(); // Recharger la liste
    } catch (err) {
      setError('Erreur lors de la suppression');
      console.error('Delete error:', err);
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const [selected, setSelected] = useState([]);
  const toggleSelect = (file) => {
    const id = file.corpus_relpath || file.path || file.filename;
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };
  const selectAll = () => {
    if (selected.length === files.length) setSelected([]);
    else setSelected(files.map(f=>f.corpus_relpath || f.path || f.filename));
  };

  const bulkDelete = async () => {
    if (!selected.length) return showToast('Aucun fichier sélectionné', 'info');
    const selectedFiles = files.filter(f => selected.includes(f.corpus_relpath || f.path || f.filename));
    const totalSize = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    if (!window.confirm(`Supprimer ${selected.length} fichier(s) (${totalSizeMB} Mo) ?`)) return;
    try{
      const token = localStorage.getItem('token');
      const deletedFilenames = [];
      for(const id of selected){
        const file = files.find(f=>(f.corpus_relpath || f.path || f.filename)===id);
        if(file) {
            await axios.post('http://localhost:5000/api/admin/delete', { filename: file.filename }, { headers: { 'X-Role': 'admin', 'Authorization': `Bearer ${token}` } });
            deletedFilenames.push(file.filename);
        }
      }
      setFiles(files.filter(f=>!deletedFilenames.includes(f.filename)));
      setSelected([]);
      showToast(`${deletedFilenames.length} fichier(s) supprimé(s)`, 'success');
      fetchFiles(); // Recharger la liste
    }catch(err){
      console.error('Erreur suppression:', err);
      showToast('Erreur suppression', 'error');
    }
  };

  const bulkDownload = async () => {
    if (!selected.length) return showToast('Aucun fichier sélectionné', 'info');
    try{
      const token = localStorage.getItem('token');
      let downloadCount = 0;
      for(const id of selected){
        const file = files.find(f=>(f.corpus_relpath || f.path || f.filename)===id);
        if(file){
          try {
            const pathToUse = file.corpus_relpath || file.path || file.filename;
            const resp = await axios.get('http://localhost:5000/api/admin/download', { 
              params: { path: pathToUse }, 
              headers: { 'X-Role': 'admin', 'Authorization': `Bearer ${token}` }, 
              responseType: 'blob' 
            });
            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement('a'); 
            link.href = url; 
            link.setAttribute('download', file.filename); 
            document.body.appendChild(link); 
            link.click(); 
            link.remove();
            window.URL.revokeObjectURL(url);
            downloadCount++;
            // Petit délai entre les téléchargements
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`Erreur téléchargement de ${file.filename}:`, err);
          }
        }
      }
      showToast(`${downloadCount} fichier(s) téléchargé(s)`, 'success');
    }catch(err){ 
      console.error('Erreur téléchargement:', err);
      showToast('Erreur téléchargement', 'error'); 
    }
  };

  const [modalData, setModalData] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const openStats = (filename) => {
    // Naviguer vers la page de stats avec le nom du fichier
    navigate(`/admin/stats?file=${encodeURIComponent(filename)}`);
  };
  
  const openView = (filename) => {
    // Ouvrir le document dans un nouvel onglet
    const viewUrl = `http://localhost:5000/api/admin/view?filename=${encodeURIComponent(filename)}`;
    window.open(viewUrl, '_blank');
  };

  const [wordCloudModal, setWordCloudModal] = useState(null);
  const openWordCloud = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get('http://localhost:5000/api/admin/file_stats', { 
        params: { filename }, 
        headers: { 'X-Role': 'admin', 'Authorization': `Bearer ${token}` } 
      });
      console.log('Word cloud response:', resp.data);
      console.log('Words:', resp.data.words);
      setWordCloudModal({ filename, words: resp.data.words || [] });
    } catch(err) { 
      console.error('Word cloud error:', err);
      showToast('Impossible de récupérer le nuage de mots', 'error'); 
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleDownload = async (file) => {
    try {
      const pathToUse = file.corpus_relpath || file.path || file.filename;
      if (!pathToUse) {
        showToast('Aucun chemin trouvé pour ce fichier', 'error');
        return;
      }
      
      const token = localStorage.getItem('token');
      const response = await axios.get(
        'http://localhost:5000/api/admin/download',
        {
          params: { path: pathToUse },
          headers: { 'X-Role': 'admin', 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.filename);
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
      showToast('Téléchargement démarré', 'success');
    } catch (err) {
      showToast('Erreur lors du téléchargement', 'error');
      console.error(err);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  };

  // Pagination logic
  const itemsPerPage = 8;
  const paginatedFiles = React.useMemo(() => {
    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    return sortedFiles.slice(indexOfFirst, indexOfLast);
  }, [sortedFiles, currentPage]);

  const totalPages = Math.ceil(sortedFiles.length / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return (
    <motion.div 
      className="admin-manage"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="manage-header" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#333', margin: 0 }}>
          📁 Gestion des documents
        </h1>
        <p style={{ color: '#999', margin: '8px 0 0 0' }}>
          {files.length} document(s) indexé(s)
        </p>
      </div>

      {/* Search Section */}
      <motion.div
        className="search-section"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: '30px' }}
      >
        <input
          type="text"
          placeholder="🔍 Rechercher un fichier ou un terme..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="search-input"
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: '10px',
            border: '2px solid #f0f0f0',
            fontSize: '14px',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        />
      </motion.div>

      {error && (
        <motion.div 
          className="error-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            padding: '16px',
            color: '#c33',
            marginBottom: '20px'
          }}
        >
          {error}
        </motion.div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
            📁
          </motion.div>
          <p style={{ color: '#999', marginTop: '16px' }}>Chargement des documents...</p>
        </div>
      ) : files.length === 0 ? (
        <motion.div 
          className="no-files"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px',
            border: '2px dashed #ddd'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>Aucun document trouvé</p>
          <small style={{ color: '#999' }}>Commencez par importer des fichiers depuis la page "Importer"</small>
        </motion.div>
      ) : (
        <motion.div 
          className="files-list"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Bulk Actions */}
          <motion.div
            className="bulk-actions-bar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
              {selected.length} / {files.length} sélectionné(s)
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <motion.button 
                onClick={bulkDownload} 
                disabled={!selected.length}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selected.length ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ddd',
                  color: 'white',
                  cursor: selected.length ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
                whileHover={selected.length ? { scale: 1.05 } : {}}
                whileTap={selected.length ? { scale: 0.98 } : {}}
              >
                ⬇️ Télécharger {selected.length > 0 && `(${selected.length})`}
              </motion.button>
              <motion.button 
                onClick={bulkDelete}
                disabled={!selected.length}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selected.length ? '#ff6b6b' : '#ddd',
                  color: 'white',
                  cursor: selected.length ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
                whileHover={selected.length ? { scale: 1.05 } : {}}
                whileTap={selected.length ? { scale: 0.98 } : {}}
              >
                🗑️ Supprimer {selected.length > 0 && `(${selected.length})`}
              </motion.button>
            </div>
          </motion.div>

          {/* Files Table */}
          <motion.div 
            className="table-container"
            variants={rowVariants}
            style={{
              background: 'white',
              borderRadius: '12px',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid #f0f0f0',
              width: '100%'
            }}
          >
            <table className="files-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb', borderBottom: '2px solid #f0f0f0' }}>
                <tr>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={selected.length===files.length && files.length > 0} 
                      onChange={selectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', cursor: 'pointer' }} onClick={() => requestSort('filename')}>
                    Nom {sortConfig.key === 'filename' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'left' }}>Path</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => requestSort('size')}>
                    Taille (Mo) {sortConfig.key === 'size' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => requestSort('type')}>
                    Type {sortConfig.key === 'type' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => requestSort('num_pages')}>
                    Pages {sortConfig.key === 'num_pages' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => requestSort('word_count')}>
                    Mots {sortConfig.key === 'word_count' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => requestSort('characters')}>
                    Caractères {sortConfig.key === 'characters' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', cursor: 'pointer' }} onClick={() => requestSort('date_import')}>
                    Date import {sortConfig.key === 'date_import' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedFiles.map((file, idx) => (
                  <motion.tr 
                    key={idx} 
                    className="file-row"
                    variants={rowVariants}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selected.includes(file.corpus_relpath || file.path || file.filename)} 
                        onChange={()=>toggleSelect(file)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: '500', color: '#333' }}>{file.filename}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#666', fontSize: '12px' }}>
                      {file.corpus_relpath || file.path || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                      {formatFileSize(file.size)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        background: '#f0f3ff',
                        color: '#667eea',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {file.type || file.filename.split('.').pop().toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                      {file.pages || file.num_pages || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                      {file.word_count ? file.word_count.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                      {file.characters ? file.characters.toLocaleString('fr-FR') : (file.char_count ? file.char_count.toLocaleString('fr-FR') : '—')}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#999', fontSize: '13px' }}>
                      {file.imported_at || file.date_import ? new Date(file.imported_at || file.date_import).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <motion.button 
                          onClick={() => openWordCloud(file.filename)}
                          style={{
                            padding: '6px 10px',
                            background: '#f0f3ff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#667eea',
                            fontWeight: '500'
                          }}
                          whileHover={{ scale: 1.1, background: '#e0e8ff' }}
                          whileTap={{ scale: 0.95 }}
                          title="Nuage de mots"
                        >
                          ☁️
                        </motion.button>
                        <motion.button 
                          onClick={() => openView(file.filename)}
                          style={{
                            padding: '6px 10px',
                            background: '#f0f3ff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#667eea',
                            fontWeight: '500'
                          }}
                          whileHover={{ scale: 1.1, background: '#e0e8ff' }}
                          whileTap={{ scale: 0.95 }}
                          title="Voir les informations"
                        >
                          📋
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                marginTop: '24px',
                padding: '20px',
                background: 'white',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}
            >
              <motion.button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={!hasPrevPage}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  background: hasPrevPage ? 'white' : '#f5f5f5',
                  color: hasPrevPage ? '#333' : '#999',
                  cursor: hasPrevPage ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                whileHover={hasPrevPage ? { scale: 1.05, background: '#f9fafb' } : {}}
                whileTap={hasPrevPage ? { scale: 0.98 } : {}}
              >
                ← Précédent
              </motion.button>

              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <motion.button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: page === currentPage ? '2px solid #667eea' : '1px solid #e0e0e0',
                      background: page === currentPage ? '#667eea' : 'white',
                      color: page === currentPage ? 'white' : '#333',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: page === currentPage ? '600' : '500',
                      minWidth: '36px',
                      textAlign: 'center'
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {page}
                  </motion.button>
                ))}
              </div>

              <motion.button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={!hasNextPage}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  background: hasNextPage ? 'white' : '#f5f5f5',
                  color: hasNextPage ? '#333' : '#999',
                  cursor: hasNextPage ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                whileHover={hasNextPage ? { scale: 1.05, background: '#f9fafb' } : {}}
                whileTap={hasNextPage ? { scale: 0.98 } : {}}
              >
                Suivant →
              </motion.button>

              <div style={{
                marginLeft: '12px',
                paddingLeft: '12px',
                borderLeft: '1px solid #e0e0e0',
                color: '#666',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                Page {currentPage} / {totalPages}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Modal for Stats/View */}
      {modalData && (
        <Modal 
          title={modalData.type==='stats'? `📈 Statistiques - ${modalData.data.filename}` : `👁️ Aperçu - ${modalData.data.filename}`} 
          onClose={()=>setModalData(null)}
        >
          {modalData.type !== 'stats' ? (
            <pre style={{
              whiteSpace:'pre-wrap',
              maxHeight:'60vh',
              overflow:'auto',
              background: '#f9f9f9',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.5',
              color: '#333'
            }}>
              {modalData.data.context || modalData.data.text || 'Aucun contenu disponible'}
            </pre>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  background: '#f0f3ff',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e8ff'
                }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#999', fontWeight: '500' }}>Pages</p>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>
                    {modalData.data.pages || '-'}
                  </div>
                </div>
                <div style={{
                  background: '#faf0ff',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #f0e8ff'
                }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#999', fontWeight: '500' }}>Caractères</p>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#764ba2' }}>
                    {modalData.data.characters?.toLocaleString() || '-'}
                  </div>
                </div>
                <div style={{
                  background: '#fff0f8',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #ffe8f0'
                }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#999', fontWeight: '500' }}>Mots</p>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#f5576c' }}>
                    {modalData.data.word_count?.toLocaleString() || '-'}
                  </div>
                </div>
              </div>
              <h4 style={{ marginTop: '24px', marginBottom: '16px', color: '#333', fontWeight: '600' }}>
                📊 Lemmes les plus fréquents
              </h4>
              <div style={{height:300, background: 'white', borderRadius: '8px', padding: '12px', border: '1px solid #f0f0f0'}}>
                <Bar 
                  data={{ 
                    labels: Object.keys(modalData.data.lemmas||{}).slice(0,20), 
                    datasets:[{ 
                      label:'Fréquence',
                      data: Object.values(modalData.data.lemmas||{}).slice(0,20), 
                      backgroundColor:'#667eea',
                      borderRadius: 6
                    }] 
                  }} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                  }} 
                />
              </div>
              <h4 style={{ marginTop: '24px', marginBottom: '12px', color: '#333', fontWeight: '600' }}>
                📝 Aperçu du contenu
              </h4>
              <pre style={{
                whiteSpace:'pre-wrap',
                maxHeight:180,
                overflow:'auto',
                background: '#f9f9f9',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: '1.4',
                color: '#666',
                margin: 0
              }}>
                {modalData.data.text_sample}
              </pre>
            </>
          )}
        </Modal>
      )}

      {/* Word Cloud Modal */}
      {wordCloudModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setWordCloudModal(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              border: '1px solid #e0e0e0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: '600' }}>
                ☁️ Nuage de mots - {wordCloudModal.filename}
              </h2>
              <button
                onClick={() => setWordCloudModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ 
              width: '100%', 
              minHeight: '300px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              borderRadius: '12px',
              padding: '30px',
              border: '2px solid #e0e0e0'
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
            
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <motion.button
                onClick={() => setWordCloudModal(null)}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102,126,234,0.3)'
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Fermer
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
