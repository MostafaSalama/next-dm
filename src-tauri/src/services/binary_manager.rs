use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryInfo {
    pub available: bool,
    pub version: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinariesStatus {
    pub ytdlp: BinaryInfo,
    pub ffmpeg: BinaryInfo,
}

pub struct BinaryManager {
    bin_dir: PathBuf,
}

impl BinaryManager {
    pub fn new(app_data_dir: &Path) -> Self {
        let bin_dir = app_data_dir.join("bin");
        std::fs::create_dir_all(&bin_dir).ok();
        Self { bin_dir }
    }

    pub fn bin_dir(&self) -> &Path {
        &self.bin_dir
    }

    fn ytdlp_exe_name() -> &'static str {
        if cfg!(target_os = "windows") {
            "yt-dlp.exe"
        } else {
            "yt-dlp"
        }
    }

    fn ffmpeg_exe_name() -> &'static str {
        if cfg!(target_os = "windows") {
            "ffmpeg.exe"
        } else {
            "ffmpeg"
        }
    }

    pub fn resolve_ytdlp_path(&self, custom_path: &str) -> PathBuf {
        if !custom_path.is_empty() {
            let p = PathBuf::from(custom_path);
            if p.exists() {
                return p;
            }
        }
        self.bin_dir.join(Self::ytdlp_exe_name())
    }

    pub fn resolve_ffmpeg_path(&self, custom_path: &str) -> PathBuf {
        if !custom_path.is_empty() {
            let p = PathBuf::from(custom_path);
            if p.exists() {
                return p;
            }
        }
        self.bin_dir.join(Self::ffmpeg_exe_name())
    }

    pub async fn check_binary_version(path: &Path) -> Option<String> {
        if !path.exists() {
            return None;
        }
        let mut cmd = tokio::process::Command::new(path);
        cmd.arg("--version")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = cmd.output().await.ok()?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let first_line = stdout.lines().next().unwrap_or("").trim().to_string();
            if first_line.is_empty() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let first_stderr = stderr.lines().next().unwrap_or("").trim().to_string();
                if first_stderr.is_empty() {
                    Some("installed".to_string())
                } else {
                    Some(first_stderr)
                }
            } else {
                Some(first_line)
            }
        } else {
            // Some binaries (like FFmpeg) output version info even with non-zero exit on --version
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let combined = format!("{}{}", stdout, stderr);
            let version_line = combined.lines().next().unwrap_or("").trim().to_string();
            if version_line.is_empty() {
                None
            } else {
                Some(version_line)
            }
        }
    }

    pub async fn check_status(&self, custom_ytdlp: &str, custom_ffmpeg: &str) -> BinariesStatus {
        let ytdlp_path = self.resolve_ytdlp_path(custom_ytdlp);
        let ffmpeg_path = self.resolve_ffmpeg_path(custom_ffmpeg);

        let ytdlp_version = Self::check_binary_version(&ytdlp_path).await;
        let ffmpeg_version = Self::check_binary_version(&ffmpeg_path).await;

        BinariesStatus {
            ytdlp: BinaryInfo {
                available: ytdlp_version.is_some(),
                version: ytdlp_version.unwrap_or_default(),
                path: ytdlp_path.to_string_lossy().to_string(),
            },
            ffmpeg: BinaryInfo {
                available: ffmpeg_version.is_some(),
                version: ffmpeg_version.unwrap_or_default(),
                path: ffmpeg_path.to_string_lossy().to_string(),
            },
        }
    }

    pub async fn download_ytdlp(
        &self,
        app_handle: &tauri::AppHandle,
    ) -> Result<PathBuf, String> {
        let url = Self::ytdlp_download_url();
        let dest = self.bin_dir.join(Self::ytdlp_exe_name());
        self.download_file(url, &dest, "ytdlp", app_handle).await?;

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&dest)
                .map_err(|e| e.to_string())?
                .permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&dest, perms).map_err(|e| e.to_string())?;
        }

        Ok(dest)
    }

    pub async fn download_ffmpeg(
        &self,
        app_handle: &tauri::AppHandle,
    ) -> Result<PathBuf, String> {
        if cfg!(target_os = "windows") {
            let url = Self::ffmpeg_download_url();
            let archive_path = self.bin_dir.join("ffmpeg-release.zip");
            self.download_file(url, &archive_path, "ffmpeg", app_handle)
                .await?;
            self.extract_ffmpeg_from_archive(&archive_path).await
        } else if cfg!(target_os = "macos") {
            let url = "https://evermeet.cx/ffmpeg/ffmpeg-7.1.1.zip";
            let archive_path = self.bin_dir.join("ffmpeg-release.zip");
            self.download_file(url, &archive_path, "ffmpeg", app_handle)
                .await?;
            self.extract_ffmpeg_from_archive(&archive_path).await
        } else {
            let url = Self::ffmpeg_download_url();
            let dest = self.bin_dir.join(Self::ffmpeg_exe_name());
            self.download_file(url, &dest, "ffmpeg", app_handle)
                .await?;
            #[cfg(not(target_os = "windows"))]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&dest)
                    .map_err(|e| e.to_string())?
                    .permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&dest, perms).map_err(|e| e.to_string())?;
            }
            Ok(dest)
        }
    }

    async fn download_file(
        &self,
        url: &str,
        dest: &Path,
        binary_name: &str,
        app_handle: &tauri::AppHandle,
    ) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .map_err(|e| e.to_string())?;

        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to download {}: {}", binary_name, e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "Download failed with status {} for {}",
                resp.status(),
                binary_name
            ));
        }

        let total = resp.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let mut file = tokio::fs::File::create(dest)
            .await
            .map_err(|e| format!("Failed to create file: {}", e))?;

        use futures::StreamExt;
        use tokio::io::AsyncWriteExt;
        let mut stream = resp.bytes_stream();
        let mut last_emit = std::time::Instant::now();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download stream error: {}", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Write error: {}", e))?;
            downloaded += chunk.len() as u64;

            if last_emit.elapsed().as_millis() > 200 {
                let _ = tauri::Emitter::emit(
                    app_handle,
                    "binary_download_progress",
                    serde_json::json!({
                        "binary": binary_name,
                        "downloaded": downloaded,
                        "total": total,
                    }),
                );
                last_emit = std::time::Instant::now();
            }
        }

        file.flush()
            .await
            .map_err(|e| format!("Flush error: {}", e))?;

        let _ = tauri::Emitter::emit(
            app_handle,
            "binary_download_progress",
            serde_json::json!({
                "binary": binary_name,
                "downloaded": total,
                "total": total,
                "done": true,
            }),
        );

        Ok(())
    }

    async fn extract_ffmpeg_from_archive(&self, archive_path: &Path) -> Result<PathBuf, String> {
        let dest = self.bin_dir.join(Self::ffmpeg_exe_name());
        let archive_bytes = tokio::fs::read(archive_path)
            .await
            .map_err(|e| format!("Failed to read archive: {}", e))?;

        let target_name = Self::ffmpeg_exe_name().to_string();
        let archive_path_owned = archive_path.to_path_buf();

        tokio::task::spawn_blocking(move || {
            let archive_path = archive_path_owned;
            let cursor = std::io::Cursor::new(archive_bytes);
            let mut archive = zip::ZipArchive::new(cursor)
                .map_err(|e| format!("Failed to open zip: {}", e))?;

            for i in 0..archive.len() {
                let mut file = archive
                    .by_index(i)
                    .map_err(|e| format!("Zip entry error: {}", e))?;
                let name = file.name().to_string();
                let normalized = name.replace('\\', "/");
                let filename = normalized.rsplit('/').next().unwrap_or(&normalized);

                if filename == target_name {
                    let mut out = std::fs::File::create(&dest)
                        .map_err(|e| format!("Create file error: {}", e))?;
                    std::io::copy(&mut file, &mut out)
                        .map_err(|e| format!("Extract error: {}", e))?;

                    #[cfg(not(target_os = "windows"))]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let mut perms = std::fs::metadata(&dest)
                            .map_err(|e| e.to_string())?
                            .permissions();
                        perms.set_mode(0o755);
                        std::fs::set_permissions(&dest, perms).map_err(|e| e.to_string())?;
                    }

                    let _ = std::fs::remove_file(&archive_path);

                    return Ok(dest);
                }
            }
            Err(format!("ffmpeg binary ('{}') not found in archive", target_name))
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    pub async fn update_ytdlp(
        &self,
        app_handle: &tauri::AppHandle,
    ) -> Result<String, String> {
        let path = self.download_ytdlp(app_handle).await?;
        let version = Self::check_binary_version(&path)
            .await
            .unwrap_or_else(|| "unknown".to_string());
        Ok(version)
    }

    fn ytdlp_download_url() -> &'static str {
        if cfg!(target_os = "windows") {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        } else if cfg!(target_os = "macos") {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
        } else {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"
        }
    }

    fn ffmpeg_download_url() -> &'static str {
        if cfg!(target_os = "windows") {
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
        } else if cfg!(target_os = "macos") {
            "https://evermeet.cx/ffmpeg/ffmpeg-7.1.1.zip"
        } else {
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz"
        }
    }
}
