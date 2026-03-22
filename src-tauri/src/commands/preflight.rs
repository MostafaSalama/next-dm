use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub url: String,
    pub filename: String,
    pub size: i64,
    pub supports_range: bool,
}

fn filename_from_url(url: &str) -> String {
    url.rsplit('/')
        .next()
        .unwrap_or("download")
        .split('?')
        .next()
        .unwrap_or("download")
        .to_string()
}

fn filename_from_content_disposition(header: &str) -> Option<String> {
    for part in header.split(';') {
        let part = part.trim();
        if part.starts_with("filename*=") {
            if let Some(val) = part.strip_prefix("filename*=") {
                let decoded = val
                    .split('\'')
                    .last()
                    .unwrap_or(val)
                    .replace("%20", " ");
                if !decoded.is_empty() {
                    return Some(decoded);
                }
            }
        }
        if part.starts_with("filename=") {
            if let Some(val) = part.strip_prefix("filename=") {
                let name = val.trim_matches('"').trim_matches('\'');
                if !name.is_empty() {
                    return Some(name.to_string());
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn preflight_check(urls: Vec<String>) -> Result<Vec<FileInfo>, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for url in &urls {
        let info = match client.head(url).send().await {
            Ok(resp) => {
                let size = resp
                    .headers()
                    .get("content-length")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<i64>().ok())
                    .unwrap_or(0);

                let supports_range = resp
                    .headers()
                    .get("accept-ranges")
                    .and_then(|v| v.to_str().ok())
                    .map(|v| v.contains("bytes"))
                    .unwrap_or(false);

                let filename = resp
                    .headers()
                    .get("content-disposition")
                    .and_then(|v| v.to_str().ok())
                    .and_then(filename_from_content_disposition)
                    .unwrap_or_else(|| filename_from_url(url));

                FileInfo {
                    url: url.clone(),
                    filename,
                    size,
                    supports_range,
                }
            }
            Err(_) => FileInfo {
                url: url.clone(),
                filename: filename_from_url(url),
                size: 0,
                supports_range: false,
            },
        };

        results.push(info);
    }

    Ok(results)
}
