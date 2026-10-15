//! The MCP root folder picker.
//!
//! The JavaScript dialog command (`plugin:dialog|open`) adds whatever folder it returns to the
//! fs scope, and `tauri-plugin-persisted-scope` keeps that grant across restarts. The MCP root
//! is only handed to the MCP server process as an environment variable; the WebView never needs
//! to read or write inside it. Picking it through the dialog plugin's Rust API returns the path
//! without touching `fs_scope()`, so choosing the home folder does not open it to the WebView.

use tauri::{Runtime, Window};
use tauri_plugin_dialog::{DialogExt, FilePath};

/// The picked folder as a native path string; `None` when nothing usable was picked.
fn folder_path(picked: Option<FilePath>) -> Option<String> {
    picked
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
}

/// Shows a native folder picker over `window` and returns the chosen folder, or `None` when the
/// user cancels. Grants no file system access.
#[tauri::command]
pub async fn pick_mcp_root_folder<R: Runtime>(window: Window<R>) -> Option<String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .pick_folder(move |picked| {
            let _ = sender.send(picked);
        });
    folder_path(receiver.await.ok().flatten())
}

#[cfg(test)]
mod tests {
    use super::folder_path;
    use tauri_plugin_dialog::FilePath;

    #[test]
    fn cancel_returns_none() {
        assert_eq!(folder_path(None), None);
    }

    #[test]
    fn picked_folder_returns_its_path() {
        let folder = std::env::temp_dir().join("peel-mcp-root");
        assert_eq!(
            folder_path(Some(FilePath::Path(folder.clone()))),
            Some(folder.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn non_file_url_is_not_a_folder() {
        let url = url::Url::parse("https://example.com/folder").expect("url");
        assert_eq!(folder_path(Some(FilePath::Url(url))), None);
    }
}
