use std::path::Path;
use tokio::io::AsyncBufReadExt;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone)]
pub struct VideoProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub eta_seconds: f64,
    pub phase: String,
}

pub struct VideoDownloadConfig {
    pub format_id: String,
    pub output_format: String,
    pub subtitles: Vec<String>,
    pub embed_subs: bool,
    pub embed_thumbnail: bool,
}

pub async fn run_video_download(
    ytdlp_path: &Path,
    ffmpeg_path: &Path,
    url: &str,
    config: &VideoDownloadConfig,
    output_dir: &Path,
    output_filename: &str,
    cancel_token: CancellationToken,
    progress_callback: impl Fn(VideoProgress) + Send + 'static,
) -> Result<(), String> {
    let output_template = output_dir
        .join(output_filename)
        .to_string_lossy()
        .to_string();

    let mut args: Vec<String> = vec![
        "--newline".to_string(),
        "--no-colors".to_string(),
        "--no-warnings".to_string(),
        "--progress-template".to_string(),
        "download:PROGRESS %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.speed)s %(progress.eta)s".to_string(),
    ];

    if ffmpeg_path.exists() {
        if let Some(ffmpeg_dir) = ffmpeg_path.parent() {
            args.push("--ffmpeg-location".to_string());
            args.push(ffmpeg_dir.to_string_lossy().to_string());
        }
    }

    if !config.format_id.is_empty() {
        args.push("-f".to_string());
        args.push(config.format_id.clone());
    }

    if !config.output_format.is_empty() {
        args.push("--merge-output-format".to_string());
        args.push(config.output_format.clone());
    }

    if !config.subtitles.is_empty() {
        if config.embed_subs {
            args.push("--embed-subs".to_string());
        } else {
            args.push("--write-sub".to_string());
        }
        args.push("--sub-langs".to_string());
        args.push(config.subtitles.join(","));
    }

    if config.embed_thumbnail {
        args.push("--embed-thumbnail".to_string());
    }

    args.push("-o".to_string());
    args.push(output_template);

    args.push(url.to_string());

    let mut cmd = tokio::process::Command::new(ytdlp_path);
    cmd.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start yt-dlp: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture yt-dlp stdout")?;

    let stderr = child
        .stderr
        .take()
        .ok_or("Failed to capture yt-dlp stderr")?;

    let stderr_handle = tokio::spawn(async move {
        let reader = tokio::io::BufReader::new(stderr);
        let mut lines = reader.lines();
        let mut error_lines = Vec::new();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.contains("ERROR") {
                error_lines.push(line);
            }
        }
        error_lines
    });

    let cancel = cancel_token.clone();
    let child_id = child.id();

    let cancel_handle = tokio::spawn(async move {
        cancel.cancelled().await;
        if let Some(pid) = child_id {
            kill_process(pid);
        }
    });

    let reader = tokio::io::BufReader::new(stdout);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if cancel_token.is_cancelled() {
            break;
        }
        if let Some(progress) = parse_progress_line(&line) {
            progress_callback(progress);
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for yt-dlp: {}", e))?;

    cancel_handle.abort();

    if cancel_token.is_cancelled() {
        return Err("cancelled".to_string());
    }

    if !status.success() {
        let error_lines = stderr_handle.await.unwrap_or_default();
        let msg = if error_lines.is_empty() {
            format!("yt-dlp exited with code {}", status.code().unwrap_or(-1))
        } else {
            error_lines.join("; ")
        };
        return Err(msg);
    }

    progress_callback(VideoProgress {
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bps: 0,
        eta_seconds: 0.0,
        phase: "complete".to_string(),
    });

    Ok(())
}

fn parse_progress_line(line: &str) -> Option<VideoProgress> {
    let line = line.trim();
    if !line.starts_with("PROGRESS ") {
        if line.starts_with("[download]") {
            return parse_fallback_progress(line);
        }
        return None;
    }

    let parts: Vec<&str> = line["PROGRESS ".len()..].split_whitespace().collect();
    if parts.len() < 4 {
        return None;
    }

    let downloaded = parse_numeric(parts[0]);
    let total = parse_numeric(parts[1]);
    let speed = parse_numeric(parts[2]);
    let eta = parse_float(parts[3]);

    Some(VideoProgress {
        downloaded_bytes: downloaded,
        total_bytes: total,
        speed_bps: speed,
        eta_seconds: eta,
        phase: "downloading".to_string(),
    })
}

fn parse_fallback_progress(line: &str) -> Option<VideoProgress> {
    if line.contains("Merging") || line.contains("merging") {
        return Some(VideoProgress {
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            eta_seconds: 0.0,
            phase: "merging".to_string(),
        });
    }

    if line.contains("has already been downloaded") {
        return Some(VideoProgress {
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            eta_seconds: 0.0,
            phase: "complete".to_string(),
        });
    }

    if line.contains('%') {
        let pct_str = line
            .split('%')
            .next()?
            .rsplit_once(|c: char| !c.is_ascii_digit() && c != '.')
            .map(|(_, n)| n)
            .unwrap_or("");
        let _pct: f64 = pct_str.parse().ok()?;

        let total = if line.contains(" of ") {
            line.split(" of ")
                .nth(1)
                .and_then(|s| parse_size_str(s.split_whitespace().next().unwrap_or("")))
                .unwrap_or(0)
        } else {
            0
        };

        let speed = if line.contains(" at ") {
            line.split(" at ")
                .nth(1)
                .and_then(|s| parse_size_str(s.split_whitespace().next().unwrap_or("")))
                .unwrap_or(0)
        } else {
            0
        };

        let downloaded = if total > 0 {
            (total as f64 * _pct / 100.0) as u64
        } else {
            0
        };

        return Some(VideoProgress {
            downloaded_bytes: downloaded,
            total_bytes: total,
            speed_bps: speed,
            eta_seconds: 0.0,
            phase: "downloading".to_string(),
        });
    }

    None
}

fn parse_numeric(s: &str) -> u64 {
    let cleaned = s.trim().replace(',', "");
    if cleaned == "NA" || cleaned == "N/A" || cleaned.is_empty() {
        return 0;
    }
    cleaned.parse::<f64>().unwrap_or(0.0) as u64
}

fn parse_float(s: &str) -> f64 {
    let cleaned = s.trim().replace(',', "");
    if cleaned == "NA" || cleaned == "N/A" || cleaned.is_empty() {
        return 0.0;
    }
    cleaned.parse::<f64>().unwrap_or(0.0)
}

fn parse_size_str(s: &str) -> Option<u64> {
    let s = s.trim();
    if s.ends_with("GiB") || s.ends_with("GB") {
        let num: f64 = s.trim_end_matches("GiB").trim_end_matches("GB").trim().parse().ok()?;
        Some((num * 1073741824.0) as u64)
    } else if s.ends_with("MiB") || s.ends_with("MB") {
        let num: f64 = s.trim_end_matches("MiB").trim_end_matches("MB").trim().parse().ok()?;
        Some((num * 1048576.0) as u64)
    } else if s.ends_with("KiB") || s.ends_with("KB") {
        let num: f64 = s.trim_end_matches("KiB").trim_end_matches("KB").trim().parse().ok()?;
        Some((num * 1024.0) as u64)
    } else if s.ends_with("MiB/s") || s.ends_with("MB/s") {
        let num: f64 = s.trim_end_matches("MiB/s").trim_end_matches("MB/s").trim().parse().ok()?;
        Some((num * 1048576.0) as u64)
    } else if s.ends_with("KiB/s") || s.ends_with("KB/s") {
        let num: f64 = s.trim_end_matches("KiB/s").trim_end_matches("KB/s").trim().parse().ok()?;
        Some((num * 1024.0) as u64)
    } else {
        s.parse::<u64>().ok()
    }
}

fn kill_process(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x08000000u32)
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
    }
}
