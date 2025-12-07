import React from "react";

export default function WordCloudChart({ words = [] }) {
  if (!words || words.length === 0)
    return <p className="text-muted text-center">Aucun mot à afficher.</p>;

  const sortedWords = words
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  if (sortedWords.length === 0) {
    return <p className="text-muted text-center">Aucun mot à afficher.</p>;
  }

  const maxCount = Math.max(...sortedWords.map(w => w[1]));
  const minCount = Math.min(...sortedWords.map(w => w[1]));

  const getSize = (count) => {
    const range = maxCount - minCount || 1;
    const normalized = (count - minCount) / range;
    return 12 + normalized * 32; // Entre 12px et 44px
  };

  const getColor = (index) => {
    const colors = [
      "#667eea", "#764ba2", "#f093fb", "#f5576c",
      "#4facfe", "#00f2fe", "#fa709a", "#fee140",
      "#30b0fe", "#a0e7e5", "#ff6b6b", "#4ecdc4",
      "#44a3d8", "#ff6348", "#9b59b6", "#3498db"
    ];
    return colors[index % colors.length];
  };

  return (
    <div style={{
      width: "100%",
      height: "350px",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: "15px",
      padding: "20px",
      background: "#fafafa",
      borderRadius: "8px"
    }}>
      {sortedWords.map(([word, count], index) => (
        <div
          key={`${word}-${index}`}
          style={{
            fontSize: `${getSize(count)}px`,
            fontWeight: "600",
            color: getColor(index),
            whiteSpace: "nowrap",
            cursor: "default",
            transition: "all 0.2s ease",
            padding: "4px 8px",
            borderRadius: "4px"
          }}
          onMouseEnter={(e) => {
            e.target.style.opacity = "0.7";
            e.target.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.opacity = "1";
            e.target.style.transform = "scale(1)";
          }}
          title={`${word}: ${count} occurrence${count > 1 ? 's' : ''}`}
        >
          {word}
        </div>
      ))}
    </div>
  );
}
