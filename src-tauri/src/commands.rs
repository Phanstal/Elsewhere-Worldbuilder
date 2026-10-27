use base64::{engine::general_purpose::STANDARD, Engine as _};

/// Writes an export produced in the webview to the path the user picked in the
/// native save dialog. The dialog is the only source of this path.
#[tauri::command]
pub fn save_export(path: String, data_base64: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(data_base64)
        .map_err(|error| format!("invalid export data: {error}"))?;
    std::fs::write(&path, bytes).map_err(|error| format!("could not write export: {error}"))
}

#[cfg(test)]
mod tests {
    use super::save_export;
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    #[test]
    fn writes_decoded_export_to_the_selected_path() {
        let directory =
            std::env::temp_dir().join(format!("elsewhere-export-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).expect("create temp directory");
        let path = directory.join("world.elsew");

        save_export(
            path.to_string_lossy().into_owned(),
            STANDARD.encode("{\"format\":\"elsew\",\"version\":1}"),
        )
        .expect("save export");

        let written = std::fs::read_to_string(&path).expect("read export");
        assert_eq!(written, "{\"format\":\"elsew\",\"version\":1}");

        std::fs::remove_dir_all(&directory).expect("clean up temp directory");
    }
}
