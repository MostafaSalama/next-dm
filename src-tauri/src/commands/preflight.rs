use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub url: String,
    pub filename: String,
    pub size: i64,
    pub supports_range: bool,
}

fn url_decode(s: &str) -> String {
    let mut bytes = Vec::with_capacity(s.len());
    let mut iter = s.bytes();
    while let Some(b) = iter.next() {
        if b == b'%' {
            let hi = iter.next();
            let lo = iter.next();
            if let (Some(h), Some(l)) = (hi, lo) {
                if let Ok(hex_str) = std::str::from_utf8(&[h, l]) {
                    if let Ok(decoded) = u8::from_str_radix(hex_str, 16) {
                        bytes.push(decoded);
                        continue;
                    }
                }
            }
            bytes.push(b'%');
        } else if b == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8(bytes).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned())
}

fn filename_from_url(url: &str) -> String {
    let path = url.split('?').next().unwrap_or(url);
    let path = path.split('#').next().unwrap_or(path);
    let segment = path.rsplit('/').next().unwrap_or("download");
    let decoded = url_decode(segment);
    let name = decoded.trim();
    if name.is_empty() { "download".to_string() } else { name.to_string() }
}

fn filename_from_content_disposition(header: &str) -> Option<String> {
    for part in header.split(';') {
        let part = part.trim();
        if let Some(val) = part.strip_prefix("filename*=") {
            let decoded = url_decode(val.split('\'').last().unwrap_or(val));
            let decoded = decoded.trim().trim_matches('"');
            if !decoded.is_empty() {
                return Some(decoded.to_string());
            }
        }
        if let Some(val) = part.strip_prefix("filename=") {
            let name = val.trim_matches('"').trim_matches('\'').trim();
            if !name.is_empty() {
                return Some(name.to_string());
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
                let final_url = resp.url().to_string();

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
                    .and_then(|v| {
                        v.to_str().ok()
                            .map(|s| s.to_string())
                            .or_else(|| String::from_utf8_lossy(v.as_bytes()).into_owned().into())
                    })
                    .and_then(|v| filename_from_content_disposition(&v))
                    .unwrap_or_else(|| filename_from_url(&final_url));

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
