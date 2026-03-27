use crate::db::settings;
use crate::services::binary_manager::BinariesStatus;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Binary management commands ──────────────────────────────────────────

#[tauri::command]
pub async fn check_binaries(state: tauri::State<'_, AppState>) -> Result<BinariesStatus, String> {
    let (custom_ytdlp, custom_ffmpeg) = {
        let conn = state.db.conn();
        let yp = settings::get_setting(&conn, "ytdlp_path")
            .ok()
            .flatten()
            .unwrap_or_default();
        let fp = settings::get_setting(&conn, "ffmpeg_path")
            .ok()
            .flatten()
            .unwrap_or_default();
        (yp, fp)
    };
    Ok(state
        .binary_manager
        .check_status(&custom_ytdlp, &custom_ffmpeg)
        .await)
}

#[tauri::command]
pub async fn download_binary(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    which: String,
) -> Result<String, String> {
    match which.as_str() {
        "ytdlp" => {
            let path = state.binary_manager.download_ytdlp(&app_handle).await?;
            Ok(path.to_string_lossy().to_string())
        }
        "ffmpeg" => {
            let path = state.binary_manager.download_ffmpeg(&app_handle).await?;
            Ok(path.to_string_lossy().to_string())
        }
        _ => Err(format!("Unknown binary: {}", which)),
    }
}

#[tauri::command]
pub async fn update_ytdlp(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    state.binary_manager.update_ytdlp(&app_handle).await
}

// ── Video metadata extraction commands ──────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoFormat {
    pub format_id: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub height: Option<i64>,
    pub width: Option<i64>,
    pub fps: Option<f64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub filesize: Option<i64>,
    pub filesize_approx: Option<i64>,
    pub tbr: Option<f64>,
    pub format_note: Option<String>,
    pub has_video: bool,
    pub has_audio: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleInfo {
    pub ext: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub duration: f64,
    pub thumbnail: String,
    pub description: String,
    pub uploader: String,
    pub upload_date: String,
    pub platform: String,
    pub webpage_url: String,
    pub formats: Vec<VideoFormat>,
    pub subtitles: HashMap<String, Vec<SubtitleInfo>>,
    pub is_live: bool,
    pub playlist_id: Option<String>,
    pub playlist_title: Option<String>,
    pub playlist_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub entries: Vec<PlaylistEntry>,
    pub total_count: i64,
}

fn resolve_ytdlp_path(state: &AppState) -> Result<std::path::PathBuf, String> {
    let custom = {
        let conn = state.db.conn();
        settings::get_setting(&conn, "ytdlp_path")
            .ok()
            .flatten()
            .unwrap_or_default()
    };
    let path = state.binary_manager.resolve_ytdlp_path(&custom);
    if !path.exists() {
        return Err("yt-dlp is not installed. Please download it from Settings > Video Downloads.".to_string());
    }
    Ok(path)
}

fn parse_video_info(json: &serde_json::Value) -> VideoInfo {
    let formats_raw = json
        .get("formats")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let formats: Vec<VideoFormat> = formats_raw
        .iter()
        .filter_map(|f| {
            let format_id = f.get("format_id")?.as_str()?.to_string();
            let ext = f
                .get("ext")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let vcodec = f.get("vcodec").and_then(|v| v.as_str()).map(|s| s.to_string());
            let acodec = f.get("acodec").and_then(|v| v.as_str()).map(|s| s.to_string());
            let has_video = vcodec
                .as_deref()
                .map(|v| v != "none")
                .unwrap_or(false);
            let has_audio = acodec
                .as_deref()
                .map(|v| v != "none")
                .unwrap_or(false);

            Some(VideoFormat {
                format_id,
                ext,
                resolution: f.get("resolution").and_then(|v| v.as_str()).map(|s| s.to_string()),
                height: f.get("height").and_then(|v| v.as_i64()),
                width: f.get("width").and_then(|v| v.as_i64()),
                fps: f.get("fps").and_then(|v| v.as_f64()),
                vcodec,
                acodec,
                filesize: f.get("filesize").and_then(|v| v.as_i64()),
                filesize_approx: f.get("filesize_approx").and_then(|v| v.as_i64()),
                tbr: f.get("tbr").and_then(|v| v.as_f64()),
                format_note: f.get("format_note").and_then(|v| v.as_str()).map(|s| s.to_string()),
                has_video,
                has_audio,
            })
        })
        .collect();

    let subtitles_raw = json
        .get("subtitles")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let mut subtitles: HashMap<String, Vec<SubtitleInfo>> = HashMap::new();
    for (lang, subs) in subtitles_raw {
        if let Some(arr) = subs.as_array() {
            let infos: Vec<SubtitleInfo> = arr
                .iter()
                .filter_map(|s| {
                    Some(SubtitleInfo {
                        ext: s.get("ext")?.as_str()?.to_string(),
                        name: s.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    })
                })
                .collect();
            if !infos.is_empty() {
                subtitles.insert(lang, infos);
            }
        }
    }

    VideoInfo {
        id: json.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        title: json.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
        duration: json.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0),
        thumbnail: json.get("thumbnail").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        description: json
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        uploader: json
            .get("uploader")
            .or_else(|| json.get("channel"))
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string(),
        upload_date: json
            .get("upload_date")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        platform: json
            .get("extractor_key")
            .or_else(|| json.get("extractor"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        webpage_url: json
            .get("webpage_url")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        formats,
        subtitles,
        is_live: json.get("is_live").and_then(|v| v.as_bool()).unwrap_or(false),
        playlist_id: json.get("playlist_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        playlist_title: json.get("playlist_title").and_then(|v| v.as_str()).map(|s| s.to_string()),
        playlist_count: json.get("playlist_count").and_then(|v| v.as_i64()),
    }
}

#[tauri::command]
pub async fn video_extract_info(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<VideoInfo, String> {
    let ytdlp = resolve_ytdlp_path(&state)?;

    let mut cmd = tokio::process::Command::new(&ytdlp);
    cmd.args([
        "--dump-json",
        "--no-download",
        "--no-playlist",
        "--no-warnings",
        &url,
    ])
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        cmd.output(),
    )
    .await
    .map_err(|_| "Video info extraction timed out (60s). The URL may be invalid or yt-dlp is stuck.".to_string())?
    .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        log::info!("yt-dlp stderr: {}", stderr);
        log::info!("yt-dlp stdout: {}", stdout);
        let msg = stderr
            .lines()
            .find(|l| l.contains("ERROR"))
            .unwrap_or(&stderr)
            .trim();
        return Err(classify_ytdlp_error(msg));
    }

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

    Ok(parse_video_info(&json))
}

#[tauri::command]
pub async fn video_extract_playlist(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<PlaylistInfo, String> {
    let ytdlp = resolve_ytdlp_path(&state)?;

    let mut cmd = tokio::process::Command::new(&ytdlp);
    cmd.args([
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        &url,
    ])
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        cmd.output(),
    )
    .await
    .map_err(|_| "Playlist extraction timed out (120s). The URL may be invalid or yt-dlp is stuck.".to_string())?
    .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let msg = stderr
            .lines()
            .find(|l| l.contains("ERROR"))
            .unwrap_or(&stderr)
            .trim();
        return Err(classify_ytdlp_error(msg));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();

    if lines.is_empty() {
        return Err("No playlist entries found".to_string());
    }

    let mut entries: Vec<PlaylistEntry> = Vec::new();
    let mut playlist_title = String::new();
    let mut playlist_id = String::new();
    let mut uploader = String::new();

    for line in &lines {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
            if playlist_title.is_empty() {
                playlist_title = json
                    .get("playlist_title")
                    .or_else(|| json.get("playlist"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Playlist")
                    .to_string();
            }
            if playlist_id.is_empty() {
                playlist_id = json
                    .get("playlist_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
            }
            if uploader.is_empty() {
                uploader = json
                    .get("playlist_uploader")
                    .or_else(|| json.get("uploader"))
                    .or_else(|| json.get("channel"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown")
                    .to_string();
            }

            let id = json
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let title = json
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let entry_url = json
                .get("url")
                .or_else(|| json.get("webpage_url"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            entries.push(PlaylistEntry {
                id,
                title,
                url: entry_url,
                duration: json.get("duration").and_then(|v| v.as_f64()),
                thumbnail: json
                    .get("thumbnails")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.last())
                    .and_then(|t| t.get("url"))
                    .and_then(|v| v.as_str())
                    .or_else(|| json.get("thumbnail").and_then(|v| v.as_str()))
                    .map(|s| s.to_string()),
            });
        }
    }

    let total_count = entries.len() as i64;

    Ok(PlaylistInfo {
        id: playlist_id,
        title: playlist_title,
        uploader,
        entries,
        total_count,
    })
}

fn classify_ytdlp_error(msg: &str) -> String {
    let lower = msg.to_lowercase();
    if lower.contains("sign in") || lower.contains("age") || lower.contains("login") {
        "This video requires authentication. Try importing browser cookies in Settings.".to_string()
    } else if lower.contains("private") {
        "This video is private and cannot be accessed.".to_string()
    } else if lower.contains("not available") || lower.contains("unavailable") {
        "This video is not available in your region or has been removed.".to_string()
    } else if lower.contains("live") {
        "Live streams are not supported for download.".to_string()
    } else if lower.contains("drm") || lower.contains("protected") {
        "This content is DRM-protected and cannot be downloaded.".to_string()
    } else {
        format!("yt-dlp error: {}", msg)
    }
}
