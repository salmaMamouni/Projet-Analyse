from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from pathlib import Path
import json
import os
from datetime import datetime

from services.acquisition_service import read_corpus, process_file as acq_process_file
from services.normalisation_service import normalize_corpus, process_file as norm_process_file
from services.extraction_service import extract_corpus, extract_from_text
from services.visualisation_service import (
    compute_visualisation_data,
    stats_imports_by_date,
    get_all_imports
)

# Blueprint unique pour tout
document_bp = Blueprint("document_bp", __name__)

UPLOAD_DIR = Path("data/corpus")

# ------------------------------
# 📂 Upload de fichiers
# ------------------------------
@document_bp.route("/upload", methods=["POST"])
def upload_files():
    # Optionnel: reprocess_all=true pour forcer un recalcul complet
    reprocess_all = str(request.args.get('reprocess_all', '')).lower() in ('1', 'true', 'yes')

    files = request.files.getlist("files")
    if not files and not reprocess_all:
        return jsonify({"error": "Aucun fichier reçu"}), 400

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    logs = []

    # If requested, perform full reprocessing of the corpus and return
    if reprocess_all:
        # Read/copy corpus into raw_texts, normalize and extract all
        try:
            logs.append("🔁 Démarrage reprocess_all")
            rc = read_corpus(base_path=str(UPLOAD_DIR), corpus_dir=str(UPLOAD_DIR), output_path="data/processed/raw_texts")
            logs.append(f"📥 read_corpus terminé: {len(rc)} fichiers")
            normalize_corpus("data/processed/raw_texts", "data/processed/clean_texts")
            logs.append("🧼 normalize_corpus terminé")
            all_results = extract_corpus()
            logs.append(f"🧠 extract_corpus terminé: {len(all_results)} entrées")
            return jsonify({"message": "Reprocessing complet terminé ✅", "results": all_results, "logs": logs})
        except Exception as e:
            logs.append(f"❌ Erreur reprocess_all: {e}")
            return jsonify({"error": f"Erreur reprocess_all: {e}", "logs": logs}), 500

    saved_paths = []
    for file in files:
        filename = file.filename
        dest_path = UPLOAD_DIR / filename
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        file.save(dest_path)
        saved_paths.append(dest_path)

    # Traitement incrémental : ne traiter que les fichiers importés
    metadata_file = Path("data/processed/metadata.json")
    if metadata_file.exists():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                existing_meta = json.load(f)
        except Exception:
            existing_meta = {}
    else:
        existing_meta = {}

    results = {}
    summary = {"new": 0, "updated": 0}
    logs.append(f"📦 Fichiers reçus: {len(saved_paths)}")

    for saved in saved_paths:
        try:
            # Acquisition: copie dans corpus si nécessaire et extrait texte brut
            name, acq_meta = acq_process_file(saved, str(UPLOAD_DIR), Path("data/processed/raw_texts"))
            logs.append(f"📥 {saved.name}: acquisition OK")
            
            # Normalisation: nettoie le fichier brut et écrit dans clean_texts
            # Les fichiers .txt gardent le nom complet: texte_abeilles.pdf.txt
            raw_txt = Path("data/processed/raw_texts") / f"{name}.txt"
            clean_txt = Path("data/processed/clean_texts") / f"{name}.txt"
            norm_process_file(raw_txt, Path("data/processed/clean_texts"))
            logs.append(f"🧼 {saved.name}: normalisation OK")

            # Extraction: calcule mots/bigrams/context pour le fichier nettoyé
            _, extract_data = extract_from_text(clean_txt)
            logs.append(f"🧠 {saved.name}: extraction OK ({extract_data.get('total_tokens_after', 0)} tokens)")

            # Fusionner métadonnées existantes avec nouvelles données
            # Utiliser 'name' (nom avec extension) comme clé dans metadata
            merged = existing_meta.get(name, {})
            # acq_meta contient des infos utiles (type, path, thumbnail...)
            merged.update(acq_meta)
            merged.update(extract_data)

            # Garder date_import et type basés sur le fichier dans data/corpus
            corpus_candidate = UPLOAD_DIR / name
            
            if corpus_candidate.exists():
                merged["date_import"] = datetime.fromtimestamp(corpus_candidate.stat().st_mtime).strftime("%Y-%m-%d")
                merged["type"] = corpus_candidate.suffix.lstrip('.') if corpus_candidate.suffix else merged.get("type", "unknown")
                merged["size"] = corpus_candidate.stat().st_size
                merged["path"] = str(corpus_candidate.resolve())
                merged["filename"] = name
                # Ajouter corpus_relpath pour visualisation
                try:
                    merged["corpus_relpath"] = str(corpus_candidate.resolve().relative_to(UPLOAD_DIR.resolve())).replace('\\', '/')
                except Exception:
                    merged["corpus_relpath"] = name
            else:
                # Fallback: set today if file not found
                merged["date_import"] = datetime.utcnow().strftime("%Y-%m-%d")
                merged["type"] = merged.get("type", "unknown")
                merged["size"] = 0
                merged["path"] = None
                merged["filename"] = name
                merged["corpus_relpath"] = name

            existed_before = name in existing_meta
            existing_meta[name] = merged
            # Indicateur status (new / updated)
            status = "updated" if existed_before else "new"
            merged_with_status = dict(merged)
            merged_with_status["status"] = status
            results[name] = merged_with_status
            summary[status] += 1
            logs.append(f"✅ {saved.name}: {status}")
        except Exception as e:
            print(f"Erreur traitement fichier {saved}: {e}")
            logs.append(f"❌ {saved.name}: erreur {e}")

    # Sauvegarde des métadonnées fusionnées
    try:
        metadata_file.parent.mkdir(parents=True, exist_ok=True)
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(existing_meta, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Erreur écriture metadata.json : {e}")

    logs.append("🏁 Traitement incrémental terminé")
    return jsonify({"message": "Traitement incrémental terminé ✅", "summary": summary, "results": results, "logs": logs})


# ------------------------------
# 🛠️ Utilitaires
# ------------------------------
def levenshtein_distance(s1, s2):
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

# ------------------------------
# 🔍 Recherche de texte
# ------------------------------
@document_bp.route("/search", methods=["GET"])
def search_documents():
    query = request.args.get("q", "").strip().lower()
    mode = request.args.get("mode", "contains").lower()
    types_param = request.args.get("types", "").strip()
    
    # Parse types: comma-separated list or empty for all
    selected_types = [t.strip().lower() for t in types_param.split(",") if t.strip()] if types_param else []

    if not query:
        return jsonify({"error": "Paramètre 'q' requis"}), 400
    
    # Supprimer les espaces de la requête pour la recherche
    query_no_spaces = query.replace(" ", "")
    query_words = query.split()

    metadata_file = Path("data/processed/metadata.json")
    if not metadata_file.exists():
        return jsonify({"error": "Aucun document indexé"}), 404

    with open(metadata_file, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    results = {}
    all_words = set() # Collect all words for suggestions if needed

    for filename, data in metadata.items():
        text = data.get("context", "").lower()
        text_no_spaces = text.replace(" ", "")
        
        # Collect words for potential suggestions
        if not results: # Optimization: only collect if we might need them (though we iterate anyway)
             for w, _ in data.get("words", []):
                all_words.add(w.lower())

        match = False
        if mode == "contains":
            match = query_no_spaces in text_no_spaces
        elif mode == "not_contains":
            match = query_no_spaces not in text_no_spaces
        elif mode == "starts_with":
            match = text_no_spaces.startswith(query_no_spaces)
        elif mode == "ends_with":
            match = text_no_spaces.endswith(query_no_spaces)
        elif mode == "exact":
            # Search for exact phrase (with word boundaries)
            match = query in text  # Keep spaces for exact phrase matching
        elif mode == "all_words":
            match = all(word.replace(" ", "") in text_no_spaces for word in query.split())
        elif mode == "all_words_and":
            # ALL words must be present (AND logic)
            match = all(word.replace(" ", "") in text_no_spaces for word in query.split())
        elif mode == "or" or mode == "all_words_or":
            # At least one word must be present (OR logic)
            match = any(word.replace(" ", "") in text_no_spaces for word in query.split())

        if match:
            # 🔹 On cherche le fichier correspondant dans data/corpus en comparant les noms complets
            matched_file = UPLOAD_DIR / filename
            
            if not matched_file.exists():
                # Fallback: search recursively for exact filename
                found = list(UPLOAD_DIR.rglob(filename))
                if found:
                    matched_file = found[0]

            if matched_file.exists():
                date_import = datetime.fromtimestamp(matched_file.stat().st_mtime).strftime("%Y-%m-%d")
                doc_type = matched_file.suffix.lstrip('.') if matched_file.suffix else "unknown"
                file_size = matched_file.stat().st_size
            else:
                # Fallback: try to guess type from filename in metadata
                date_import = data.get("date_import", "Inconnue")
                parts = filename.rsplit('.', 1)
                if len(parts) > 1:
                    doc_type = parts[1]
                else:
                    doc_type = data.get("type", "unknown")
                file_size = 0
            
            # Filtrer par type si spécifié
            if selected_types and doc_type.lower() not in selected_types:
                continue

            # Count occurrences of each search word
            word_occurrences = {}
            total_occurrences = 0
            for word in query_words:
                word_clean = word.replace(" ", "")
                count = text_no_spaces.count(word_clean)
                if count > 0:
                    word_occurrences[word] = count
                    total_occurrences += count
            
            # Extract a preview snippet around the first occurrence
            preview = ""
            if text:
                # Find first occurrence position
                first_pos = text.find(query_words[0]) if query_words else -1
                if first_pos >= 0:
                    start = max(0, first_pos - 100)
                    end = min(len(text), first_pos + 200)
                    preview = text[start:end].strip()
                    if start > 0:
                        preview = "..." + preview
                    if end < len(text):
                        preview = preview + "..."
                else:
                    preview = text[:300] + "..." if len(text) > 300 else text

            results[filename] = {
                "filename": filename,
                "name": filename,
                "words": data.get("words", []),
                "bigrams": data.get("bigrams", []),
                "context": data.get("context", ""),
                "preview": preview,
                "total_tokens_after": data.get("total_tokens_after", 0),
                "date_import": date_import,
                "type": doc_type,
                "size": file_size,
                "word_occurrences": word_occurrences,
                "total_occurrences": total_occurrences,
            }

    # Sort results by total occurrences (descending)
    sorted_results = dict(sorted(results.items(), key=lambda x: x[1].get('total_occurrences', 0), reverse=True))

    # Remove duplicate content (keep only one version when same text)
    unique_results = {}
    seen_contexts = {}
    
    for filename, data in sorted_results.items():
        context = data.get('context', '').strip()
        
        # Check if we've already seen this exact content
        if context in seen_contexts:
            # Keep the one with shorter filename (prefer .htm over .html, or shorter name)
            existing_filename = seen_contexts[context]
            if len(filename) < len(existing_filename):
                # Replace with shorter filename
                del unique_results[existing_filename]
                unique_results[filename] = data
                seen_contexts[context] = filename
            # else: skip this duplicate
        else:
            unique_results[filename] = data
            seen_contexts[context] = filename
    
    sorted_results = unique_results

    # Si aucun résultat, générer des suggestions
    suggestions = []
    if not sorted_results and len(query) > 2:
        # Calculer la distance de Levenshtein avec tous les mots connus
        similar_words = []
        for w in all_words:
            # Ignorer les mots trop courts pour éviter le bruit
            if len(w) < 3:
                continue
                
            dist = levenshtein_distance(query, w)
            
            # Seuil de similarité adaptatif
            # Pour les mots courts (<= 4 chars), distance max 1
            # Pour les mots longs (> 4 chars), distance max 2
            max_dist = 1 if len(query) <= 4 else 2
            
            if dist <= max_dist: 
                similar_words.append((w, dist))
        
        # Trier par distance puis alphabétiquement
        similar_words.sort(key=lambda x: (x[1], x[0]))
        suggestions = [w for w, _ in similar_words[:5]]

    return jsonify({"results": sorted_results, "suggestions": suggestions})


# ------------------------------
# 📊 Visualisation (nuage + stats)
# ------------------------------
@document_bp.route("/visualisation", methods=["GET"])
def visualisation():
    """Retourne les données globales de visualisation (nuage de mots, stats globales, etc.)"""
    data = compute_visualisation_data()
    return jsonify(data)


# ------------------------------
# 📈 Statistiques d'imports (diagrammes par date, taille, types)
# ------------------------------
@document_bp.route("/visualisation/imports", methods=["GET"])
def imports_stats():
    """Retourne le nombre d'imports, leur taille et leurs types par date"""
    imports = get_all_imports()
    stats = stats_imports_by_date(imports)
    return jsonify(stats)


# ------------------------------
# 📄 Liste détaillée des documents (admin)
# ------------------------------
@document_bp.route("/documents", methods=["GET"])
def list_documents():
    """Retourne la liste des documents avec métadonnées essentielles sans le contexte."""
    metadata_file = Path("data/processed/metadata.json")
    if not metadata_file.exists():
        return jsonify([])
    try:
        with open(metadata_file, "r", encoding="utf-8") as f:
            metadata = json.load(f)
    except Exception as e:
        return jsonify({"error": f"Impossible de lire metadata.json: {e}"}), 500

    # Optional filters
    filter_type = (request.args.get("type") or '').strip().lower()
    date_from_s = (request.args.get("date_from") or '').strip()
    date_to_s = (request.args.get("date_to") or '').strip()

    def parse_date(s):
        try:
            return datetime.strptime(s, "%Y-%m-%d") if s else None
        except Exception:
            return None

    date_from = parse_date(date_from_s)
    date_to = parse_date(date_to_s)

    rows = []
    for key, data in metadata.items():
        # Tentative de retrouver le fichier d'origine
        original_path = data.get("path")
        if original_path and not Path(original_path).exists():
            # fallback: chercher par stem dans corpus
            for f in UPLOAD_DIR.glob("*"):
                if f.stem == key:
                    original_path = str(f)
                    break
        # Date import
        if original_path and Path(original_path).exists():
            date_import = datetime.fromtimestamp(Path(original_path).stat().st_mtime).strftime("%Y-%m-%d")
            size_bytes = Path(original_path).stat().st_size
        else:
            date_import = data.get("date_import", "Inconnue")
            size_bytes = None

        # Relative path within corpus for easy serving/downloading
        rel_in_corpus = None
        try:
            if original_path and Path(original_path).exists():
                rel_in_corpus = str(Path(original_path).resolve().relative_to(UPLOAD_DIR.resolve())).replace('\\', '/')
        except Exception:
            rel_in_corpus = None

        size_mb = (size_bytes / (1024 * 1024)) if isinstance(size_bytes, (int, float)) else None

        rows.append({
            "name": key,
            "date_import": date_import,
            "total_tokens_after": data.get("total_tokens_after"),
            "char_count_after": data.get("char_count_after") or data.get("char_count_before"),
            "type": data.get("type"),
            "num_pages": data.get("num_pages"),
            "path": original_path,
            "status": data.get("status"),
            "corpus_relpath": rel_in_corpus,
            "size_bytes": size_bytes,
            "size_mb": size_mb
        })

    # Apply filters if provided
    def keep(r):
        if filter_type and (r.get('type') or '').lower() != filter_type:
            return False
        if date_from or date_to:
            d = parse_date(r.get('date_import') or '')
            if not d:
                return False
            if date_from and d < date_from:
                return False
            if date_to and d > date_to:
                return False
        return True

    filtered_rows = [r for r in rows if keep(r)]

    return jsonify(filtered_rows)


from flask import send_from_directory

@document_bp.route("/data/corpus/<path:filename>")
def serve_file(filename):
    # Try to find the file by stem (name without extension) if exact match fails
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        # Fallback 1: search for exact filename recursively (e.g. in subfolders)
        found = list(UPLOAD_DIR.rglob(filename))
        if found:
            file_path = found[0]
        else:
            # Fallback 2: search by stem in corpus
            stem = Path(filename).stem
            for f in UPLOAD_DIR.rglob("*"):
                if f.is_file() and f.stem == stem:
                    file_path = f
                    break
    
    if not file_path.exists():
        return jsonify({"error": "Fichier non trouvé"}), 404
    
    # Déterminer le type MIME pour l'affichage inline
    mimetype = None
    ext = file_path.suffix.lower()
    if ext == '.pdf':
        mimetype = 'application/pdf'
    elif ext in ['.jpg', '.jpeg']:
        mimetype = 'image/jpeg'
    elif ext == '.png':
        mimetype = 'image/png'
    elif ext == '.txt':
        mimetype = 'text/plain'
    elif ext in ['.html', '.htm']:
        mimetype = 'text/html'
    
    # Si c'est un type affichable, on force l'affichage inline
    if mimetype:
        return send_from_directory(file_path.parent, file_path.name, mimetype=mimetype, as_attachment=False)
    
    # Sinon (docx, xlsx, etc.), ce sera un téléchargement par défaut du navigateur
    return send_from_directory(file_path.parent, file_path.name, as_attachment=False)


# ------------------------------
# 🔤 Autocomplétion pour la recherche
# ------------------------------
@document_bp.route("/autocomplete", methods=["GET"])
def autocomplete():
    """Suggère des mots pour l'autocomplétion basée sur les mots extraits."""
    prefix = (request.args.get("q") or "").strip().lower()
    if not prefix or len(prefix) < 2:
        return jsonify([])
    
    metadata_file = Path("data/processed/metadata.json")
    if not metadata_file.exists():
        return jsonify([])
    
    try:
        with open(metadata_file, "r", encoding="utf-8") as f:
            metadata = json.load(f)
    except Exception:
        return jsonify([])
    
    # Collecter tous les mots uniques
    all_words = set()
    for doc_data in metadata.values():
        words_list = doc_data.get("words", [])
        for w, _ in words_list:
            all_words.add(w.lower())
    
    # Filtrer par préfixe exact
    exact_matches = sorted([w for w in all_words if w.startswith(prefix)])[:10]
    
    # Si moins de 10 résultats, ajouter corrections orthographiques (distance de Levenshtein simple)
    if len(exact_matches) < 10:
        def levenshtein_distance(s1, s2):
            if len(s1) < len(s2):
                return levenshtein_distance(s2, s1)
            if len(s2) == 0:
                return len(s1)
            previous_row = range(len(s2) + 1)
            for i, c1 in enumerate(s1):
                current_row = [i + 1]
                for j, c2 in enumerate(s2):
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row
            return previous_row[-1]
        
        # Trouver mots similaires (distance <= 2)
        similar_words = []
        for w in all_words:
            if w not in exact_matches:
                dist = levenshtein_distance(prefix, w)
                if dist <= 2 and dist > 0:
                    similar_words.append((w, dist))
        
        # Trier par distance puis alphabétiquement
        similar_words.sort(key=lambda x: (x[1], x[0]))
        suggestions = exact_matches + [w for w, _ in similar_words[:15 - len(exact_matches)]]
    else:
        suggestions = exact_matches
    
    return jsonify(suggestions[:15])


# ------------------------------
# ⬇️ Téléchargement d'un document du corpus (forcé en pièce jointe)
# ------------------------------
@document_bp.route("/documents/download/<path:relpath>", methods=["GET"])
def download_document(relpath):
    # Sécurise en contraignant au dossier data/corpus
    return send_from_directory("data/corpus", relpath, as_attachment=True)


# ------------------------------
# 🗑️ Suppression d'un ou plusieurs documents (admin)
# ------------------------------
@document_bp.route("/documents", methods=["DELETE"])
def delete_documents():
    payload = request.get_json(silent=True) or {}
    names = payload.get("names") or []
    if not isinstance(names, list) or not names:
        return jsonify({"error": "Champ 'names' requis (liste)"}), 400

    metadata_file = Path("data/processed/metadata.json")
    if metadata_file.exists():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception:
            metadata = {}
    else:
        metadata = {}

    logs = []
    deleted = 0
    errors = []

    for name in names:
        try:
            # Supprimer fichiers traités
            raw_file = Path("data/processed/raw_texts") / f"{name}.txt"
            clean_file = Path("data/processed/clean_texts") / f"{name}.txt"
            for p in [raw_file, clean_file]:
                if p.exists():
                    try:
                        p.unlink()
                        logs.append(f"🗑️ Supprimé: {p}")
                    except Exception as e:
                        errors.append(f"Impossible de supprimer {p}: {e}")

            # Supprimer original dans corpus
            corpus_file = None
            # 1) via metadata.path si présent
            meta_entry = metadata.get(name, {})
            mpath = meta_entry.get("path")
            if mpath:
                p = Path(mpath)
                try:
                    # Valider que le fichier est bien sous data/corpus
                    if p.exists() and p.resolve().is_file() and UPLOAD_DIR.resolve() in p.resolve().parents:
                        corpus_file = p
                except Exception:
                    pass
            # 2) fallback: rechercher par stem direct dans data/corpus (non récursif)
            if not corpus_file:
                for f in UPLOAD_DIR.glob("**/*"):
                    if f.is_file() and f.stem == name:
                        corpus_file = f
                        break
            if corpus_file and corpus_file.exists():
                try:
                    corpus_file.unlink()
                    logs.append(f"🗑️ Supprimé (corpus): {corpus_file}")
                except Exception as e:
                    errors.append(f"Impossible de supprimer {corpus_file}: {e}")

            # Retirer des métadonnées
            if name in metadata:
                metadata.pop(name, None)
                deleted += 1
            else:
                logs.append(f"ℹ️ {name} non présent dans metadata.json")
        except Exception as e:
            errors.append(f"Erreur sur {name}: {e}")

    # Sauvegarder metadata.json mis à jour
    try:
        metadata_file.parent.mkdir(parents=True, exist_ok=True)
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=4)
    except Exception as e:
        errors.append(f"Erreur écriture metadata.json: {e}")

    return jsonify({
        "deleted": deleted,
        "errors": errors,
        "logs": logs
    })
