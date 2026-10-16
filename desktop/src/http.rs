use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    Method,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::Manager;
use tokio::sync::oneshot;

use crate::egress::{check_str, error_chain, redirect_policy, refused_redirect};

#[derive(Clone, Deserialize, Serialize)]
pub struct ProxyHttpHeader {
    name: String,
    value: String,
}

#[derive(Deserialize)]
pub struct ProxyHttpRequest {
    /// Chosen by the page so it can cancel the request before the head arrives.
    id: String,
    url: String,
    method: Option<String>,
    headers: Option<Vec<ProxyHttpHeader>>,
    body: Option<Vec<u8>>,
    max_response_bytes: Option<usize>,
    follow_redirects: Option<bool>,
    timeout_ms: Option<u64>,
}

/// Status and headers; the body follows on the request's channel.
#[derive(Serialize)]
pub struct ProxyHttpHead {
    status: u16,
    headers: Vec<ProxyHttpHeader>,
    url: String,
}

/// `network` marks failures to reach the server or read from it, which the page
/// reports the way `fetch` does so callers can retry them. `blocked` marks a URL or
/// redirect the egress allow-list refused, which no retry can fix.
#[derive(Serialize)]
pub struct ProxyHttpError {
    network: bool,
    blocked: bool,
    message: String,
}

impl ProxyHttpError {
    fn request(message: impl Into<String>) -> Self {
        Self {
            network: false,
            blocked: false,
            message: message.into(),
        }
    }

    fn blocked(message: impl Into<String>) -> Self {
        Self {
            network: false,
            blocked: true,
            message: message.into(),
        }
    }

    fn network(error: reqwest::Error) -> Self {
        if error.is_redirect() {
            return Self {
                network: false,
                blocked: refused_redirect(&error),
                message: error_chain(&error),
            };
        }
        Self {
            network: true,
            blocked: false,
            message: error.to_string(),
        }
    }
}

/// The end of a body on the request's channel; chunks before it are raw bytes.
#[derive(Serialize)]
#[serde(untagged)]
enum ProxyHttpBodyEnd {
    Done { done: bool },
    Error { error: ProxyHttpError },
}

/// Requests in flight, so the page can cancel one, and cancellations that arrived
/// first: Tauri runs `proxy_http_request` on its own task, so `cancel_http_request`
/// can run before the request is registered.
#[derive(Default)]
pub struct ProxyHttpRequests(Mutex<Requests>);

#[derive(Default)]
struct Requests {
    tasks: HashMap<String, JoinHandle<()>>,
    cancelled: HashSet<String>,
}

impl Requests {
    /// Stops a registered request, or refuses it when it registers later.
    fn cancel(&mut self, id: String) {
        match self.tasks.remove(&id) {
            Some(task) => task.abort(),
            None => {
                self.cancelled.insert(id);
            }
        }
    }

    /// Whether a request may start; false once the page cancelled it.
    fn admit(&mut self, id: &str) -> bool {
        !self.cancelled.remove(id)
    }
}

impl ProxyHttpRequests {
    fn requests(&self) -> std::sync::MutexGuard<'_, Requests> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn cancelled() -> ProxyHttpError {
    ProxyHttpError::request("The request was cancelled")
}

type HeadResult = Result<ProxyHttpHead, ProxyHttpError>;

fn request_headers(headers: Option<Vec<ProxyHttpHeader>>) -> HeaderMap {
    let mut mapped = HeaderMap::new();
    for header in headers.unwrap_or_default() {
        let Ok(header_name) = HeaderName::from_bytes(header.name.as_bytes()) else {
            continue;
        };
        let Ok(header_value) = HeaderValue::from_str(&header.value) else {
            continue;
        };
        mapped.insert(header_name, header_value);
    }
    mapped
}

fn request_method(method: Option<String>) -> Result<Method, ProxyHttpError> {
    let raw = method.unwrap_or_else(|| "GET".into());
    Method::from_bytes(raw.as_bytes()).map_err(|e| ProxyHttpError::request(e.to_string()))
}

async fn send(request: ProxyHttpRequest) -> Result<reqwest::Response, ProxyHttpError> {
    // Checked before a client exists, so a refused URL causes no network I/O.
    let parsed =
        check_str(&request.url).map_err(|error| ProxyHttpError::blocked(error.to_string()))?;

    let follow = request.follow_redirects.unwrap_or(true);
    let client = reqwest::Client::builder()
        // Every hop is re-checked against the same allow-list.
        .redirect(redirect_policy(follow))
        // An idle limit, not a total one: a streamed model response can run for
        // minutes while still delivering bytes. Callers cap the total with timeout_ms.
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| ProxyHttpError::request(e.to_string()))?;
    let mut builder = client
        .request(request_method(request.method)?, parsed)
        .headers(request_headers(request.headers));
    if let Some(body) = request.body {
        builder = builder.body(body);
    }
    if let Some(timeout_ms) = request.timeout_ms {
        if timeout_ms == 0 {
            return Err(ProxyHttpError::request("timeoutMs must be greater than 0"));
        }
        builder = builder.timeout(Duration::from_millis(timeout_ms));
    }
    builder.send().await.map_err(ProxyHttpError::network)
}

fn size_limit_error() -> ProxyHttpError {
    ProxyHttpError::request("HTTP response exceeds the configured size limit")
}

fn end_body(on_body: &Channel<InvokeResponseBody>, end: ProxyHttpBodyEnd) {
    if let Ok(json) = serde_json::to_string(&end) {
        let _ = on_body.send(InvokeResponseBody::Json(json));
    }
}

async fn run(
    request: ProxyHttpRequest,
    head: oneshot::Sender<HeadResult>,
    on_body: Channel<InvokeResponseBody>,
) {
    let limit = request.max_response_bytes;
    let mut response = match send(request).await {
        Ok(response) => response,
        Err(error) => {
            let _ = head.send(Err(error));
            return;
        }
    };
    if let (Some(limit), Some(content_length)) = (limit, response.content_length()) {
        if content_length > limit as u64 {
            let _ = head.send(Err(size_limit_error()));
            return;
        }
    }
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            Some(ProxyHttpHeader {
                name: name.as_str().to_owned(),
                value: value.to_str().ok()?.to_owned(),
            })
        })
        .collect();
    let sent = head.send(Ok(ProxyHttpHead {
        status: response.status().as_u16(),
        headers,
        url: response.url().to_string(),
    }));
    if sent.is_err() {
        return;
    }

    let mut received = 0;
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                received += chunk.len();
                if limit.is_some_and(|limit| received > limit) {
                    end_body(
                        &on_body,
                        ProxyHttpBodyEnd::Error {
                            error: size_limit_error(),
                        },
                    );
                    return;
                }
                if on_body
                    .send(InvokeResponseBody::Raw(chunk.to_vec()))
                    .is_err()
                {
                    return;
                }
            }
            Ok(None) => {
                end_body(&on_body, ProxyHttpBodyEnd::Done { done: true });
                return;
            }
            Err(error) => {
                end_body(
                    &on_body,
                    ProxyHttpBodyEnd::Error {
                        error: ProxyHttpError::network(error),
                    },
                );
                return;
            }
        }
    }
}

/// Sends a request from the native side, out of reach of WebView CORS. Resolves
/// with the head as soon as it arrives and streams the body to `on_body`. Only
/// URLs the egress allow-list accepts are sent (`crate::egress`).
#[tauri::command]
pub async fn proxy_http_request<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    request: ProxyHttpRequest,
    on_body: Channel<InvokeResponseBody>,
) -> HeadResult {
    let id = request.id.clone();
    let (head, head_received) = oneshot::channel();
    {
        // Held while spawning, so the task cannot remove its entry before it exists.
        let state = app.state::<ProxyHttpRequests>();
        let mut requests = state.requests();
        if !requests.admit(&id) {
            return Err(cancelled());
        }
        let task_app = app.clone();
        let task_id = id.clone();
        let task = tauri::async_runtime::spawn(async move {
            run(request, head, on_body).await;
            task_app
                .state::<ProxyHttpRequests>()
                .requests()
                .tasks
                .remove(&task_id);
        });
        if let Some(previous) = requests.tasks.insert(id, task) {
            previous.abort();
        }
    }
    head_received.await.map_err(|_| cancelled())?
}

/// Stops a request and its body stream, closing the connection.
#[tauri::command]
pub fn cancel_http_request(requests: tauri::State<'_, ProxyHttpRequests>, id: String) {
    requests.requests().cancel(id);
}

#[cfg(test)]
mod tests {
    use super::{send, ProxyHttpRequest, Requests};

    fn request(url: &str) -> ProxyHttpRequest {
        ProxyHttpRequest {
            id: "test".into(),
            url: url.into(),
            method: None,
            headers: None,
            body: None,
            max_response_bytes: None,
            follow_redirects: None,
            timeout_ms: None,
        }
    }

    #[test]
    fn refused_urls_fail_as_blocked_before_any_request() {
        // A loopback listener that would see the request if one were sent.
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        listener.set_nonblocking(true).expect("nonblocking");
        let port = listener.local_addr().expect("address").port();
        for url in [
            format!("http://127.0.0.1:{port}/"),
            format!("https://127.0.0.1:{port}/"),
            "https://api.anthropic.com@evil.com/".to_owned(),
            "https://evil.com/collect".to_owned(),
        ] {
            let Err(error) = tauri::async_runtime::block_on(send(request(&url))) else {
                panic!("{url} must be refused");
            };
            assert!(error.blocked, "{url}");
            assert!(!error.network, "{url}");
            assert!(error.message.starts_with("Blocked request"), "{url}");
        }
        assert!(listener.accept().is_err(), "no connection may be made");
    }

    #[test]
    fn a_cancel_before_registration_refuses_the_request() {
        let mut requests = Requests::default();
        requests.cancel("early".into());

        assert!(!requests.admit("early"));
        // The refusal is spent; the id is not refused again.
        assert!(requests.admit("early"));
        assert!(requests.admit("other"));
    }
}
