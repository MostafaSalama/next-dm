use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader, BufWriter};

pub async fn stitch_chunks(
    chunk_paths: &[String],
    destination: &str,
) -> Result<(), String> {
    let dest_path = PathBuf::from(destination);
    if let Some(parent) = dest_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let out_file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut writer = BufWriter::new(out_file);

    for path_str in chunk_paths {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            return Err(format!("Chunk file missing: {}", path_str));
        }

        let file = tokio::fs::File::open(&path)
            .await
            .map_err(|e| format!("Failed to open chunk {}: {}", path_str, e))?;
        let mut reader = BufReader::new(file);
        let mut buf = vec![0u8; 256 * 1024]; // 256 KB copy buffer

        loop {
            let n = reader
                .read(&mut buf)
                .await
                .map_err(|e| format!("Read error: {}", e))?;
            if n == 0 {
                break;
            }
            writer
                .write_all(&buf[..n])
                .await
                .map_err(|e| format!("Write error: {}", e))?;
        }
    }

    writer.flush().await.map_err(|e| format!("Flush error: {}", e))?;
    Ok(())
}

pub async fn cleanup_parts(chunk_paths: &[String], parts_dir: Option<&str>) {
    for path_str in chunk_paths {
        let _ = tokio::fs::remove_file(path_str).await;
    }
    if let Some(dir) = parts_dir {
        let _ = tokio::fs::remove_dir(dir).await;
    }
}
