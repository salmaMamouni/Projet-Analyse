import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import './AdminStats.css';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/stats', {
        headers: { 'X-Role': 'admin', 'Authorization': `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (err) {
      setError('Erreur lors du chargement des statistiques');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
          📊
        </motion.div>
        <p style={{ marginTop: '20px', color: '#999' }}>Chargement des statistiques...</p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div 
        className="admin-stats"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div style={{ 
          background: '#fee', 
          border: '1px solid #fcc',
          borderRadius: '8px',
          padding: '20px',
          color: '#c33',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="admin-stats"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div 
        className="stats-header"
        variants={itemVariants}
        style={{ marginBottom: '40px' }}
      >
        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#333', margin: 0 }}>
          📊 Tableau de bord Analytics
        </h1>
        <p style={{ color: '#999', margin: '8px 0 0 0' }}>
          Vue d'ensemble de vos documents et statistiques
        </p>
      </motion.div>

      {stats && (
        <>
          {/* KPI Cards */}
          <motion.div 
            className="stats-grid"
            variants={containerVariants}
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '20px',
              marginBottom: '30px'
            }}
          >
            {[
              {
                icon: '📄',
                label: 'Documents',
                value: stats.total_docs ?? 0,
                color: '#667eea',
                lightColor: '#f0f3ff'
              },
              {
                icon: '🔤',
                label: 'Mots Indexés',
                value: (stats.total_words ?? 0).toLocaleString('fr-FR'),
                color: '#f093fb',
                lightColor: '#fff0f8'
              },
              {
                icon: '💾',
                label: 'Taille Totale',
                value: stats.total_size != null && stats.total_size > 0
                  ? (stats.total_size < 1024 * 1024 
                      ? `${(stats.total_size / 1024).toFixed(2)} Ko` 
                      : `${(stats.total_size / (1024 * 1024)).toFixed(2)} Mo`)
                  : '0 Mo',
                color: '#764ba2',
                lightColor: '#faf0ff'
              },
              {
                icon: '📊',
                label: 'Mots/Document',
                value: stats.total_docs > 0 ? Math.round(stats.total_words / stats.total_docs) : 0,
                color: '#4facfe',
                lightColor: '#e6f7ff'
              },
              {
                icon: '📈',
                label: 'Taille Moyenne',
                value: stats.total_docs > 0 && stats.total_size > 0
                  ? `${((stats.total_size / stats.total_docs) / 1024).toFixed(2)} Ko`
                  : '0 Ko',
                color: '#43e97b',
                lightColor: '#e6ffe9'
              },
              {
                icon: '⏱️',
                label: 'Dernier Import',
                value: stats.last_import && stats.last_import !== 'N/A' && stats.last_import !== 'Aucun'
                  ? (stats.last_import.includes('-') ? new Date(stats.last_import).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : stats.last_import)
                  : 'N/A',
                color: '#f5576c',
                lightColor: '#ffe0e6'
              }
            ].map((card, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="kpi-card"
                style={{
                  background: `linear-gradient(135deg, ${card.lightColor} 0%, white 100%)`,
                  border: `2px solid ${card.color}33`,
                  borderRadius: '16px',
                  padding: '24px',
                  cursor: 'pointer'
                }}
                whileHover={{ y: -5, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                  {card.icon}
                </div>
                <p style={{ fontSize: '12px', color: '#999', margin: '0 0 8px 0' }}>
                  {card.label}
                </p>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700',
                  color: card.color
                }}>
                  {card.value}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Charts Section */}
          <motion.div 
            className="charts-section"
            variants={containerVariants}
            style={{ marginTop: '40px' }}
          >
            {/* Files by Type - Bar Chart */}
            <motion.div
              variants={itemVariants}
              className="chart-card"
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                border: '1px solid #f0f0f0'
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginTop: 0 }}>
                📁 Distribution par type de fichier
              </h3>
              <Bar
                data={{
                  labels: Object.keys(stats.by_type).map(t => t.toUpperCase()),
                  datasets: [{
                    label: 'Nombre de fichiers',
                    data: Object.values(stats.by_type),
                    backgroundColor: [
                      '#667eea',
                      '#764ba2',
                      '#f093fb',
                      '#f5576c',
                      '#fa9b10'
                    ],
                    borderRadius: 8,
                    borderSkipped: false,
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      titleFont: { size: 13 },
                      bodyFont: { size: 12 },
                      padding: 12,
                      borderRadius: 8,
                      displayColors: true,
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { color: '#999' },
                      grid: { color: '#f0f0f0' }
                    },
                    x: {
                      ticks: { color: '#999' },
                      grid: { display: false }
                    }
                  }
                }}
              />
            </motion.div>

            {/* Files by Date - Line Chart */}
            <motion.div
              variants={itemVariants}
              className="chart-card"
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                border: '1px solid #f0f0f0'
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginTop: 0 }}>
                📈 Chronologie des imports
              </h3>
              <Line
                data={{
                  labels: stats.by_date ? stats.by_date.labels : [],
                  datasets: [{
                    label: 'Fichiers importés',
                    data: stats.by_date ? stats.by_date.data : [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102,126,234,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      titleFont: { size: 13 },
                      bodyFont: { size: 12 },
                      padding: 12,
                      borderRadius: 8,
                      displayColors: true,
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { color: '#999' },
                      grid: { color: '#f0f0f0' }
                    },
                    x: {
                      ticks: { color: '#999' },
                      grid: { color: '#f0f0f0' }
                    }
                  }
                }}
              />
            </motion.div>

            {/* Files Distribution - Doughnut Chart */}
            {Object.keys(stats.by_type).length > 0 && (
              <motion.div
                variants={itemVariants}
                className="chart-card"
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '28px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  border: '1px solid #f0f0f0',
                  maxWidth: '400px',
                  margin: '0 auto'
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginTop: 0 }}>
                  🎯 Composition des documents
                </h3>
                <Doughnut
                  data={{
                    labels: Object.keys(stats.by_type).map(t => t.toUpperCase()),
                    datasets: [{
                      data: Object.values(stats.by_type),
                      backgroundColor: [
                        '#667eea',
                        '#764ba2',
                        '#f093fb',
                        '#f5576c',
                        '#fa9b10'
                      ],
                      borderColor: 'white',
                      borderWidth: 2,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          color: '#666',
                          font: { size: 12 },
                          padding: 15
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        padding: 12,
                        borderRadius: 8,
                      }
                    }
                  }}
                />
              </motion.div>
            )}
          </motion.div>

          {/* Additional Statistics Section */}
          <motion.div 
            variants={containerVariants}
            style={{ marginTop: '40px' }}
          >
            {/* Top Words Table */}
            {stats.top_words && stats.top_words.length > 0 && (
              <motion.div
                variants={itemVariants}
                className="chart-card"
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '28px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  border: '1px solid #f0f0f0',
                  marginBottom: '30px'
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginTop: 0, marginBottom: '20px' }}>
                  🔥 Top 20 Mots les Plus Fréquents
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {stats.top_words.slice(0, 20).map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: `linear-gradient(135deg, ${['#667eea', '#764ba2', '#f093fb', '#f5576c', '#43e97b'][idx % 5]}15 0%, white 100%)`,
                        borderRadius: '8px',
                        border: `1px solid ${['#667eea', '#764ba2', '#f093fb', '#f5576c', '#43e97b'][idx % 5]}30`
                      }}
                    >
                      <span style={{ fontWeight: '600', color: '#333', fontSize: '13px' }}>
                        {idx + 1}. {item[0]}
                      </span>
                      <span style={{ 
                        background: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#43e97b'][idx % 5],
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {item[1].toLocaleString('fr-FR')}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* File Types Statistics */}
            {Object.keys(stats.by_type).length > 0 && (
              <motion.div
                variants={itemVariants}
                className="chart-card"
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '28px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  border: '1px solid #f0f0f0',
                  marginBottom: '30px'
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginTop: 0, marginBottom: '20px' }}>
                  📋 Détails par Type de Fichier
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {Object.entries(stats.by_type).map(([type, count], idx) => {
                    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#43e97b'];
                    const color = colors[idx % colors.length];
                    const percentage = stats.total_docs > 0 ? ((count / stats.total_docs) * 100).toFixed(1) : 0;
                    
                    return (
                      <motion.div
                        key={type}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ scale: 1.05 }}
                        style={{
                          background: `linear-gradient(135deg, ${color}15 0%, white 100%)`,
                          border: `2px solid ${color}`,
                          borderRadius: '12px',
                          padding: '20px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                          {type === 'pdf' ? '📕' : type === 'docx' ? '📘' : type === 'txt' ? '📝' : type === 'html' ? '🌐' : type === 'htm' ? '🌐' : '📄'}
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: color, marginBottom: '4px' }}>
                          {type.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#333', marginBottom: '4px' }}>
                          {count}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {percentage}% du total
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Timeline Statistics */}
            {stats.by_date && stats.by_date.labels && stats.by_date.labels.length > 0 && (
              <motion.div
                variants={itemVariants}
                className="chart-card"
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '28px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  border: '1px solid #f0f0f0',
                  marginBottom: '30px'
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginTop: 0, marginBottom: '20px' }}>
                  📅 Activité d'Import par Date
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stats.by_date.labels.map((date, idx) => {
                    const count = stats.by_date.data[idx];
                    const maxCount = Math.max(...stats.by_date.data);
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    
                    return (
                      <motion.div
                        key={date}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px'
                        }}
                      >
                        <div style={{ minWidth: '100px', fontSize: '13px', color: '#666', fontWeight: '500' }}>
                          {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ flex: 1, position: 'relative', height: '32px', background: '#f5f5f5', borderRadius: '8px', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.05 }}
                            style={{
                              height: '100%',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: '12px'
                            }}
                          >
                            <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>
                              {count} fichier{count > 1 ? 's' : ''}
                            </span>
                          </motion.div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Performance Metrics */}
            <motion.div
              variants={itemVariants}
              className="chart-card"
              style={{
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                border: '2px solid #667eea30',
                marginBottom: '30px'
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginTop: 0, marginBottom: '20px' }}>
                ⚡ Métriques de Performance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px' }}>📖 Densité de Contenu</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>
                    {stats.total_docs > 0 && stats.total_size > 0
                      ? `${(stats.total_words / (stats.total_size / 1024)).toFixed(2)}`
                      : '0'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>mots par Ko</div>
                </div>

                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px' }}>📚 Diversité de Format</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#764ba2' }}>
                    {Object.keys(stats.by_type).length}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>types différents</div>
                </div>

                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px' }}>📄 Nombre de Documents</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#f093fb' }}>
                    {stats.total_docs || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>fichiers importés</div>
                </div>

                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px' }}>💾 Taille Totale</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#43e97b' }}>
                    {stats.total_size > 0
                      ? `${(stats.total_size / (1024 * 1024)).toFixed(2)} MB`
                      : '0 MB'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>corpus stocké</div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Refresh Button */}
          <motion.div 
            style={{ textAlign: 'center', marginTop: '40px' }}
            variants={itemVariants}
          >
            <motion.button 
              onClick={fetchStats}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(102,126,234,0.3)'
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              🔄 Actualiser les données
            </motion.button>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
