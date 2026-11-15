use crate::git::execute_git_commit_and_push;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub const INACTIVITY_SYNC_DELAY_SECS: u64 = 60;

#[derive(Default)]
struct SyncInner {
    generation: u64,
    last_dir: Option<PathBuf>,
    remote_url: Option<String>,
    pat_token: Option<String>,
}

#[derive(Clone, Default)]
pub struct SyncEngine {
    inner: Arc<Mutex<SyncInner>>,
    conflict_locked: Arc<AtomicBool>,
}

impl SyncEngine {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(SyncInner::default())),
            conflict_locked: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn set_conflict_locked(&self, locked: bool) {
        self.conflict_locked.store(locked, Ordering::SeqCst);
    }

    pub fn is_conflict_locked(&self) -> bool {
        self.conflict_locked.load(Ordering::SeqCst)
    }

    pub fn notify_activity(
        &self,
        dir: PathBuf,
        remote_url: Option<String>,
        pat_token: Option<String>,
    ) {
        self.notify_activity_with_delay(
            dir,
            remote_url,
            pat_token,
            Duration::from_secs(INACTIVITY_SYNC_DELAY_SECS),
        );
    }

    pub fn notify_activity_with_delay(
        &self,
        dir: PathBuf,
        remote_url: Option<String>,
        pat_token: Option<String>,
        delay: Duration,
    ) {
        if self.is_conflict_locked() {
            return;
        }

        let current_gen = {
            let mut guard = match self.inner.lock() {
                Ok(g) => g,
                Err(poisoned) => poisoned.into_inner(),
            };
            guard.generation += 1;
            guard.last_dir = Some(dir);
            if remote_url.is_some() {
                guard.remote_url = remote_url;
            }
            if pat_token.is_some() {
                guard.pat_token = pat_token;
            }
            guard.generation
        };

        let shared = Arc::clone(&self.inner);
        let conflict_flag = Arc::clone(&self.conflict_locked);
        thread::spawn(move || {
            thread::sleep(delay);
            if conflict_flag.load(Ordering::SeqCst) {
                return;
            }
            let target = {
                let guard = match shared.lock() {
                    Ok(g) => g,
                    Err(poisoned) => poisoned.into_inner(),
                };
                if guard.generation != current_gen {
                    return;
                }
                guard.last_dir.clone().map(|d| {
                    (
                        d,
                        guard.remote_url.clone(),
                        guard.pat_token.clone(),
                    )
                })
            };

            if let Some((target_dir, remote, token)) = target {
                // Silent network error handling: commit locally and ignore push failure if offline
                let _ = execute_git_commit_and_push(
                    &target_dir,
                    remote.as_deref(),
                    token.as_deref(),
                    true,
                );
            }
        });
    }
}
