import { invoke } from "@tauri-apps/api/core";
import { RawFilePayload } from "@/store/useGoalStore";

export interface GitPullResponse {
  success: boolean;
  has_conflict: boolean;
  error_flag: boolean;
  message: string;
}

export interface GitSyncResponse {
  committed: boolean;
  pushed: boolean;
  message: string;
}

export async function ipcReadAllFiles(
  dirPath?: string
): Promise<RawFilePayload[]> {
  return invoke<RawFilePayload[]>("read_all_files", {
    dirPath: dirPath ?? null,
  });
}

export async function ipcWriteFile(
  filename: string,
  content: string,
  dirPath?: string
): Promise<string> {
  return invoke<string>("write_file", {
    filename,
    content,
    dirPath: dirPath ?? null,
  });
}

export async function ipcDeleteFile(
  filename: string,
  dirPath?: string
): Promise<string> {
  return invoke<string>("delete_file", {
    filename,
    dirPath: dirPath ?? null,
  });
}

export async function ipcGitPull(
  dirPath?: string,
  remoteUrl?: string,
  patToken?: string
): Promise<GitPullResponse> {
  return invoke<GitPullResponse>("git_pull", {
    dirPath: dirPath ?? null,
    remoteUrl: remoteUrl ?? null,
    patToken: patToken ?? null,
  });
}

export async function ipcGitCommitAndPush(
  dirPath?: string,
  remoteUrl?: string,
  patToken?: string
): Promise<GitSyncResponse> {
  return invoke<GitSyncResponse>("git_commit_and_push", {
    dirPath: dirPath ?? null,
    remoteUrl: remoteUrl ?? null,
    patToken: patToken ?? null,
  });
}
