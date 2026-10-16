//! Cloud storage endpoints the user let the proxy reach.
//!
//! Storage endpoints are user-configured, so they cannot be on the static egress list. They are
//! added only through `approve_storage_endpoint`, which asks in a native dialog the WebView cannot
//! answer, and the approvals are kept in the app config folder, which the WebView cannot write.

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use tauri::{Manager, Runtime, Window};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use url::Url;

use crate::egress::{authority, https_domain, Allowed, EgressError};

const APPROVALS_FILE: &str = "approved-storage-hosts.json";

/// The authority (`host` or `host:port`) of a storage endpoint as the S3 client builds it:
/// HTTPS when no scheme is given. Rejects what the proxy could never reach.
pub fn storage_endpoint_authority(endpoint: &str) -> Result<String, EgressError> {
    let trimmed = endpoint.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err(EgressError::Invalid("the storage endpoint is empty".into()));
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_owned()
    } else {
        format!("https://{trimmed}")
    };
    let url = Url::parse(&with_scheme).map_err(|error| EgressError::Invalid(error.to_string()))?;
    let domain = https_domain(&url)?;
    // A single-label name resolves only on a local network or search domain.
    if !domain.trim_end_matches('.').contains('.') {
        return Err(EgressError::Local(domain.to_owned()));
    }
    Ok(authority(domain, url.port()))
}

/// Approved storage endpoints, shared by every request, and where they are saved.
pub struct StorageEndpoints {
    approved: RwLock<Arc<HashSet<String>>>,
    file: Option<PathBuf>,
    /// One approval dialog at a time, so a second request for the same host waits for the first.
    approving: tokio::sync::Mutex<()>,
}

impl StorageEndpoints {
    /// Loads the saved approvals, dropping any entry that would not pass approval today.
    pub fn load(file: Option<PathBuf>) -> Self {
        let approved = file
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path).ok())
            .map(|text| parse_approvals(&text))
            .unwrap_or_default();
        Self {
            approved: RwLock::new(Arc::new(approved)),
            file,
            approving: tokio::sync::Mutex::new(()),
        }
    }

    /// What one request may reach: the static list plus the approvals as of now.
    pub fn allowed(&self) -> Allowed {
        let approved = self
            .approved
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        Allowed::new(Arc::clone(&approved))
    }

    fn approve(&self, authority: String) -> Result<(), String> {
        let snapshot = {
            let mut approved = self
                .approved
                .write()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let mut next = HashSet::clone(&approved);
            next.insert(authority);
            *approved = Arc::new(next);
            Arc::clone(&approved)
        };
        let Some(file) = &self.file else {
            return Ok(());
        };
        let mut hosts: Vec<&String> = snapshot.iter().collect();
        hosts.sort();
        let json = serde_json::to_string_pretty(&hosts).map_err(|error| error.to_string())?;
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let partial = file.with_extension("json.partial");
        std::fs::write(&partial, json).map_err(|error| error.to_string())?;
        std::fs::rename(&partial, file).map_err(|error| error.to_string())
    }
}

fn parse_approvals(text: &str) -> HashSet<String> {
    serde_json::from_str::<Vec<String>>(text)
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| storage_endpoint_authority(entry).as_deref() == Ok(entry.as_str()))
        .collect()
}

pub fn approvals_file<R: Runtime>(app: &tauri::AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(APPROVALS_FILE))
}

/// Lets the proxy reach a cloud storage endpoint once the user agrees in a native dialog.
/// Resolves true when the endpoint may be used: already allowed, or approved now.
#[tauri::command]
pub async fn approve_storage_endpoint<R: Runtime>(
    window: Window<R>,
    endpoints: tauri::State<'_, StorageEndpoints>,
    endpoint: String,
) -> Result<bool, String> {
    let authority = storage_endpoint_authority(&endpoint).map_err(|error| {
        format!("{error}. Cloud storage endpoints must be https:// addresses with a domain name.")
    })?;
    let _approving = endpoints.approving.lock().await;
    let probe = Url::parse(&format!("https://{authority}/")).map_err(|error| error.to_string())?;
    // No method: a host the list allows for one request only is not already allowed.
    if endpoints.allowed().check(&probe, None).is_ok() {
        return Ok(true);
    }

    let name = window.app_handle().package_info().name.clone();
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window
        .dialog()
        .message(format!(
            "Allow {name} to connect to {authority} for cloud storage?\n\n\
             {name} will send your documents to this server. Allow it only if you set up \
             this storage endpoint yourself."
        ))
        .title("Cloud storage")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Allow".into(),
            "Don't Allow".into(),
        ))
        .parent(&window)
        .show(move |allowed| {
            let _ = sender.send(allowed);
        });
    if !receiver.await.unwrap_or(false) {
        return Ok(false);
    }
    if let Err(error) = endpoints.approve(authority) {
        // The approval holds for this session; the dialog returns on the next launch.
        eprintln!("Could not save the approved storage endpoint: {error}");
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use EgressError::*;

    #[test]
    fn endpoints_normalize_to_an_authority() {
        for (endpoint, expected) in [
            (
                "https://s3.eu-west-1.amazonaws.com/",
                "s3.eu-west-1.amazonaws.com",
            ),
            (
                "  ACCOUNT.r2.cloudflarestorage.com ",
                "account.r2.cloudflarestorage.com",
            ),
            ("https://minio.example.com:9000", "minio.example.com:9000"),
            ("https://s3.example.com:443", "s3.example.com"),
        ] {
            assert_eq!(
                storage_endpoint_authority(endpoint),
                Ok(expected.into()),
                "{endpoint}"
            );
        }
    }

    #[test]
    fn endpoints_the_proxy_could_never_reach_are_refused() {
        for (endpoint, expected) in [
            ("http://s3.example.com", NotHttps),
            ("https://127.0.0.1:9000", IpAddress),
            ("192.168.1.10", IpAddress),
            ("https://localhost:9000", Local("localhost".into())),
            ("minio", Local("minio".into())),
            ("https://s3.example.com@evil.com", Userinfo),
        ] {
            assert_eq!(
                storage_endpoint_authority(endpoint),
                Err(expected),
                "{endpoint}"
            );
        }
        assert!(storage_endpoint_authority(" ").is_err());
    }

    #[test]
    fn saved_approvals_drop_entries_that_would_not_pass() {
        let approvals = parse_approvals(
            r#"["s3.example.com", "minio.example.com:9000", "127.0.0.1", "http://x.example.com", "localhost", "S3.UPPER.com"]"#,
        );
        let mut entries: Vec<_> = approvals.into_iter().collect();
        entries.sort();
        assert_eq!(entries, vec!["minio.example.com:9000", "s3.example.com"]);
        assert!(parse_approvals("not json").is_empty());
    }

    #[test]
    fn approvals_reach_the_proxy_and_persist() {
        let dir = std::env::temp_dir().join(format!("peel-egress-{}", std::process::id()));
        let file = dir.join(APPROVALS_FILE);
        let _ = std::fs::remove_file(&file);
        let endpoints = StorageEndpoints::load(Some(file.clone()));
        let url = "https://s3.example.com/bucket";
        assert!(endpoints
            .allowed()
            .check_str(url, &reqwest::Method::GET)
            .is_err());
        endpoints.approve("s3.example.com".into()).expect("saved");
        assert!(endpoints
            .allowed()
            .check_str(url, &reqwest::Method::GET)
            .is_ok());

        let reloaded = StorageEndpoints::load(Some(file));
        assert!(reloaded
            .allowed()
            .check_str(url, &reqwest::Method::GET)
            .is_ok());
        let _ = std::fs::remove_dir_all(dir);
    }
}
