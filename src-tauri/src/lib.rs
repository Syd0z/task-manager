pub mod fs;
pub mod git;
pub mod sync;

use fs::{delete_file, read_all_files, write_file};
use git::{get_conflict_status, git_commit_and_push, git_pull};
use sync::SyncEngine;
use tauri::{Manager, PhysicalSize, Size};

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
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main")
                && let Ok(Some(monitor)) = window.current_monitor()
            {
                // sqrt(0.60) ≈ 0.775 on both axes => rectangular window occupying ~60% of screen area
                let factor = 0.775_f64;
                let size = monitor.size();
                let target_w = ((size.width as f64) * factor).round() as u32;
                let target_h = ((size.height as f64) * factor).round() as u32;
                let _ = window.set_size(Size::Physical(PhysicalSize::new(target_w, target_h)));
                let _ = window.center();
            }
            Ok(())
        })
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
