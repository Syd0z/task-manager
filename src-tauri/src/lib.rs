pub mod fs;
pub mod git;
pub mod sync;

use fs::{delete_file, read_all_files, write_file};
use git::{get_conflict_status, git_commit_and_push, git_pull};
use sync::SyncEngine;

#[tauri::command]
fn greet(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        Ok("Hello World from Rust (IPC Ready)!".to_string())
    } else {
        Ok(format!(
            "Hello, {}! IPC connection with Rust is active.",
            trimmed
        ))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SyncEngine::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            read_all_files,
            write_file,
            delete_file,
            git_pull,
            git_commit_and_push,
            get_conflict_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
