use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RawMarkdownFile {
    pub filename: String,
    pub content: String,
}

/// Resolves the local storage directory for `.md` files.
/// Uses `dir_path` if provided, else `GOAL_MANAGER_DATA_DIR` env var,
/// else defaults to `<current_dir>/goals`.
pub fn resolve_data_dir(dir_path: Option<&str>) -> Result<PathBuf, String> {
    let base = if let Some(custom) = dir_path.filter(|s| !s.trim().is_empty()) {
        PathBuf::from(custom)
    } else if let Ok(env_dir) = std::env::var("GOAL_MANAGER_DATA_DIR") {
        PathBuf::from(env_dir)
    } else {
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Failed to resolve current directory: {}", e))?;
        if cwd.file_name().and_then(|n| n.to_str()) == Some("src-tauri")
            && let Some(parent) = cwd.parent()
        {
            parent.join("goals")
        } else {
            cwd.join("goals")
        }
    };

    if !base.exists() {
        fs::create_dir_all(&base)
            .map_err(|e| format!("Failed to create directory {}: {}", base.display(), e))?;
    }

    Ok(base)
}

fn sanitize_md_filename(filename: &str) -> Result<String, String> {
    let trimmed = filename.trim();
    if trimmed.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }
    let path = Path::new(trimmed);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid filename".to_string())?;

    if file_name != trimmed || file_name.contains("..") {
        return Err("Path traversal is not allowed in filename".to_string());
    }

    let normalized = if file_name.ends_with(".md") {
        file_name.to_string()
    } else {
        format!("{}.md", file_name)
    };

    Ok(normalized)
}

pub fn read_all_files_from_dir(dir: &Path) -> Result<Vec<RawMarkdownFile>, String> {
    if !dir.exists() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory {}: {}", dir.display(), e))?;
    }

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut files = Vec::new();
    for entry_result in entries {
        let entry = entry_result.map_err(|e| format!("Directory entry error: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("md") {
            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| "Non-UTF8 filename encountered".to_string())?
                .to_string();
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file {}: {}", filename, e))?;
            files.push(RawMarkdownFile { filename, content });
        }
    }

    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

pub fn write_file_to_dir(dir: &Path, filename: &str, content: &str) -> Result<String, String> {
    if !dir.exists() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory {}: {}", dir.display(), e))?;
    }

    let safe_name = sanitize_md_filename(filename)?;
    let full_path = dir.join(&safe_name);
    fs::write(&full_path, content)
        .map_err(|e| format!("Failed to write file {}: {}", safe_name, e))?;
    Ok(safe_name)
}

#[tauri::command]
pub fn read_all_files(dir_path: Option<String>) -> Result<Vec<RawMarkdownFile>, String> {
    let dir = resolve_data_dir(dir_path.as_deref())?;
    read_all_files_from_dir(&dir)
}

#[tauri::command]
pub fn write_file(
    filename: String,
    content: String,
    dir_path: Option<String>,
    sync_engine: tauri::State<'_, crate::sync::SyncEngine>,
) -> Result<String, String> {
    if sync_engine.is_conflict_locked() {
        return Err(
            "GIT_CONFLICT_LOCKED: Write blocked due to unresolved Git conflict.".to_string(),
        );
    }
    let dir = resolve_data_dir(dir_path.as_deref())?;
    let written = write_file_to_dir(&dir, &filename, &content)?;
    sync_engine.notify_activity(dir, None, None);
    Ok(written)
}
