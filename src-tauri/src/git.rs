use crate::fs::resolve_data_dir;
use crate::sync::SyncEngine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitPullResult {
    pub success: bool,
    pub has_conflict: bool,
    pub error_flag: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitSyncResult {
    pub committed: bool,
    pub pushed: bool,
    pub message: string_alias::String,
}

use std::string as string_alias;

fn git_cmd(dir: &Path) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(dir)
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .env("GIT_TERMINAL_PROMPT", "0");
    cmd
}

fn build_authenticated_remote(remote_url: Option<&str>, pat_token: Option<&str>) -> Option<String> {
    let url = remote_url?.trim();
    if url.is_empty() {
        return None;
    }
    if let Some(token) = pat_token.map(str::trim).filter(|t| !t.is_empty())
        && let Some(rest) = url.strip_prefix("https://")
    {
        let clean_rest = rest.split('@').next_back().unwrap_or(rest);
        return Some(format!("https://x-access-token:{}@{}", token, clean_rest));
    }
    Some(url.to_string())
}

pub fn ensure_git_repo(dir: &Path) -> Result<(), String> {
    let git_dir = dir.join(".git");
    if !git_dir.exists() {
        let output = git_cmd(dir)
            .arg("init")
            .output()
            .map_err(|e| format!("Failed to execute git init: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "git init failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let _ = git_cmd(dir)
            .args(["config", "user.name", "Goal Manager Local"])
            .output();
        let _ = git_cmd(dir)
            .args(["config", "user.email", "local@goal-manager.app"])
            .output();
    }
    Ok(())
}

pub fn has_unmerged_conflicts(dir: &Path) -> bool {
    if !dir.join(".git").exists() {
        return false;
    }
    if dir.join(".git").join("MERGE_HEAD").exists() {
        return true;
    }
    if let Ok(output) = git_cmd(dir).args(["ls-files", "-u"]).output()
        && !String::from_utf8_lossy(&output.stdout).trim().is_empty()
    {
        return true;
    }
    false
}

fn has_configured_remote(dir: &Path) -> bool {
    if let Ok(output) = git_cmd(dir).arg("remote").output() {
        return !String::from_utf8_lossy(&output.stdout).trim().is_empty();
    }
    false
}

pub fn execute_git_pull(
    dir: &Path,
    remote_url: Option<&str>,
    pat_token: Option<&str>,
) -> Result<GitPullResult, String> {
    ensure_git_repo(dir)?;

    if has_unmerged_conflicts(dir) {
        return Ok(GitPullResult {
            success: false,
            has_conflict: true,
            error_flag: true,
            message: "Repository has unresolved merge conflicts.".to_string(),
        });
    }

    let auth_remote = build_authenticated_remote(remote_url, pat_token);
    if auth_remote.is_none() && !has_configured_remote(dir) {
        return Ok(GitPullResult {
            success: true,
            has_conflict: false,
            error_flag: false,
            message: "Local repository without remote configured.".to_string(),
        });
    }

    let mut cmd = git_cmd(dir);
    cmd.arg("pull").arg("--no-edit");

    if let Some(remote) = auth_remote {
        cmd.arg(remote).arg("HEAD");
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}\n{}", stdout, stderr);

    if output.status.success() {
        return Ok(GitPullResult {
            success: true,
            has_conflict: false,
            error_flag: false,
            message: stdout.trim().to_string(),
        });
    }

    // If no remote tracking branch is configured yet on a local repo, treat as clean local state
    if combined.contains("There is no tracking information")
        || combined.contains("No remote repository specified")
        || combined.contains("does not appear to be a git repository")
        || combined.contains("couldn't find remote ref")
    {
        return Ok(GitPullResult {
            success: true,
            has_conflict: false,
            error_flag: false,
            message: "Local repository without remote tracking configured.".to_string(),
        });
    }

    let has_conflict = has_unmerged_conflicts(dir)
        || combined.contains("CONFLICT")
        || combined.contains("Automatic merge failed")
        || combined.contains("unmerged paths")
        || combined.contains("needs merge")
        || combined.contains("overwritten by merge");

    Ok(GitPullResult {
        success: false,
        has_conflict,
        error_flag: true,
        message: combined.trim().to_string(),
    })
}

pub fn execute_git_commit_and_push(
    dir: &Path,
    remote_url: Option<&str>,
    pat_token: Option<&str>,
    silent_network_errors: bool,
) -> Result<GitSyncResult, String> {
    ensure_git_repo(dir)?;

    if has_unmerged_conflicts(dir) {
        return Err("Sync blocked: unresolved Git conflict in repository.".to_string());
    }

    let add_output = git_cmd(dir)
        .args(["add", "-A"])
        .output()
        .map_err(|e| format!("Failed to execute git add: {}", e))?;

    if !add_output.status.success() {
        return Err(format!(
            "git add failed: {}",
            String::from_utf8_lossy(&add_output.stderr)
        ));
    }

    let status_output = git_cmd(dir)
        .args(["status", "--porcelain"])
        .output()
        .map_err(|e| format!("Failed to check git status: {}", e))?;

    let status_text = String::from_utf8_lossy(&status_output.stdout);
    let mut committed = false;

    if !status_text.trim().is_empty() {
        let commit_output = git_cmd(dir)
            .args(["commit", "-m", "chore(sync): update goals"])
            .output()
            .map_err(|e| format!("Failed to execute git commit: {}", e))?;

        if commit_output.status.success() {
            committed = true;
        } else {
            let stderr = String::from_utf8_lossy(&commit_output.stderr);
            if !stderr.contains("nothing to commit") {
                return Err(format!("git commit failed: {}", stderr.trim()));
            }
        }
    }

    let auth_remote = build_authenticated_remote(remote_url, pat_token);
    if auth_remote.is_none() && !has_configured_remote(dir) {
        return Ok(GitSyncResult {
            committed,
            pushed: false,
            message: "Committed locally; no remote configured.".to_string(),
        });
    }

    let mut push_cmd = git_cmd(dir);
    push_cmd.arg("push");

    if let Some(remote) = auth_remote {
        push_cmd.arg(remote).arg("HEAD");
    }

    match push_cmd.output() {
        Ok(push_out) if push_out.status.success() => Ok(GitSyncResult {
            committed,
            pushed: true,
            message: "Changes committed and pushed.".to_string(),
        }),
        Ok(push_out) => {
            let err_msg = String::from_utf8_lossy(&push_out.stderr).trim().to_string();
            if silent_network_errors {
                Ok(GitSyncResult {
                    committed,
                    pushed: false,
                    message:
                        "Committed locally; remote push skipped/ignored (offline or no remote)."
                            .to_string(),
                })
            } else {
                Err(format!("git push failed: {}", err_msg))
            }
        }
        Err(err) => {
            if silent_network_errors {
                Ok(GitSyncResult {
                    committed,
                    pushed: false,
                    message: "Committed locally; push process error silenced.".to_string(),
                })
            } else {
                Err(format!("Failed to execute git push: {}", err))
            }
        }
    }
}

#[tauri::command]
pub fn git_pull(
    dir_path: Option<String>,
    remote_url: Option<String>,
    pat_token: Option<String>,
    sync_engine: tauri::State<'_, SyncEngine>,
) -> Result<GitPullResult, String> {
    let dir = resolve_data_dir(dir_path.as_deref())?;
    let result = execute_git_pull(&dir, remote_url.as_deref(), pat_token.as_deref())?;
    // Only lock when an actual merge conflict is detected, never on offline/no-remote errors
    sync_engine.set_conflict_locked(result.has_conflict);
    Ok(result)
}

#[tauri::command]
pub fn git_commit_and_push(
    dir_path: Option<String>,
    remote_url: Option<String>,
    pat_token: Option<String>,
    sync_engine: tauri::State<'_, SyncEngine>,
) -> Result<GitSyncResult, String> {
    if sync_engine.is_conflict_locked() {
        return Err("GIT_CONFLICT_LOCKED: Resolve conflicts in an external editor first.".to_string());
    }
    let dir = resolve_data_dir(dir_path.as_deref())?;
    execute_git_commit_and_push(&dir, remote_url.as_deref(), pat_token.as_deref(), true)
}

#[tauri::command]
pub fn get_conflict_status(
    dir_path: Option<String>,
    sync_engine: tauri::State<'_, SyncEngine>,
) -> Result<bool, String> {
    let dir = resolve_data_dir(dir_path.as_deref())?;
    let disk_conflict = has_unmerged_conflicts(&dir);
    sync_engine.set_conflict_locked(disk_conflict);
    Ok(disk_conflict)
}
