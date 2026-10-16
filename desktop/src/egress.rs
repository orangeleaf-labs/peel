//! The hosts `proxy_http_request` may reach.
//!
//! The proxy runs outside the WebView, so the CSP `connect-src` does not bound it. Every URL it
//! is asked for, and every redirect it would follow, is checked here first: HTTPS only, no
//! credentials in the URL, a domain name rather than an IP address, the default port, and a host
//! on the static list below, or a cloud storage endpoint the user approved
//! (`crate::storage_endpoints`).

use std::collections::HashSet;
use std::fmt;
use std::sync::Arc;

use reqwest::Method;
use url::{Host, Url};

/// Hosts reached at any path, each with the feature that needs it. Exact names only: none of
/// these services puts objects on per-request subdomains.
const ALLOWED_HOSTS: &[&str] = &[
    // AI chat: the Anthropic Messages API.
    "api.anthropic.com",
    // Online fonts, Google Fonts provider: family metadata, CSS, and font files.
    "fonts.google.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    // Online fonts, Fontsource provider: family list and font details.
    "api.fontsource.org",
    // Online fonts, Bunny Fonts provider: family list, CSS, and font files.
    "fonts.bunny.net",
    // Online fonts, Fontshare provider: family list and CSS, then the font files.
    "api.fontshare.com",
    "cdn.fontshare.com",
    // Pasting from Figma: the signed image URLs the image batch lookup below returns.
    "s3-alpha-sig.figma.com",
    "s3-alpha.figma.com",
];

/// Hosts that serve arbitrary third-party content, allowed only under one path prefix.
const ALLOWED_PATH_PREFIXES: &[(&str, &str)] = &[
    // Online fonts, Fontsource provider: font files on jsDelivr's Fontsource mirror.
    ("cdn.jsdelivr.net", "/fontsource/"),
];

/// Hosts allowed for one request only: its method and a path shape, with no query.
struct Endpoint {
    host: &'static str,
    method: Method,
    path: fn(&str) -> bool,
}

const ALLOWED_ENDPOINTS: &[Endpoint] = &[
    // Pasting from Figma: the image batch lookup for the copied file
    // (`src/app/editor/clipboard/figma-images.ts`).
    Endpoint {
        host: "www.figma.com",
        method: Method::POST,
        path: figma_image_batch,
    },
];

/// `/file/<key>/image/batch`, where a Figma file key is letters, digits, `-` and `_`.
fn figma_image_batch(path: &str) -> bool {
    path.strip_prefix("/file/")
        .and_then(|rest| rest.strip_suffix("/image/batch"))
        .is_some_and(|key| {
            !key.is_empty()
                && key
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        })
}

/// Whether a path holds an encoded `/` or `\`, which a server may decode into a segment
/// separator after the prefix was compared.
fn encodes_separator(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.contains("%2f") || lower.contains("%5c")
}

/// The most redirects one request follows, each re-checked against the list.
pub const MAX_REDIRECTS: usize = 5;

/// Why a URL may not be requested. Nothing has been sent when this is returned.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EgressError {
    Invalid(String),
    NotHttps,
    Userinfo,
    NoDomain,
    IpAddress,
    Local(String),
    Port(String),
    NotAllowed(String),
    /// A host the static list limits to a path or a request, which an approval may not widen.
    Limited(String),
}

impl fmt::Display for EgressError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(reason) => write!(f, "Blocked request: invalid URL ({reason})"),
            Self::NotHttps => write!(f, "Blocked request: only HTTPS URLs are allowed"),
            Self::Userinfo => write!(
                f,
                "Blocked request: URLs with a user name or password are not allowed"
            ),
            Self::NoDomain => write!(f, "Blocked request: the URL has no host name"),
            Self::IpAddress => write!(f, "Blocked request: IP address hosts are not allowed"),
            Self::Local(host) => write!(f, "Blocked request: {host} is a local host"),
            Self::Port(authority) => write!(
                f,
                "Blocked request: {authority} uses a port that is not allowed"
            ),
            Self::NotAllowed(host) => write!(f, "Blocked request: {host} is not an allowed host"),
            Self::Limited(host) => write!(
                f,
                "Blocked request: {host} is allowed only for specific requests and cannot be a storage endpoint"
            ),
        }
    }
}

impl std::error::Error for EgressError {}

/// The domain of an HTTPS URL without credentials, lowercased by the URL parser.
pub(crate) fn https_domain(url: &Url) -> Result<&str, EgressError> {
    if url.scheme() != "https" {
        return Err(EgressError::NotHttps);
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(EgressError::Userinfo);
    }
    match url.host() {
        None => Err(EgressError::NoDomain),
        Some(Host::Ipv4(_)) | Some(Host::Ipv6(_)) => Err(EgressError::IpAddress),
        Some(Host::Domain(domain)) => {
            // `localhost.` is the same local name as `localhost`.
            let name = domain.strip_suffix('.').unwrap_or(domain);
            if name == "localhost" || name.ends_with(".localhost") {
                Err(EgressError::Local(domain.to_owned()))
            } else {
                Ok(domain)
            }
        }
    }
}

/// `host` or `host:port`, the form storage approvals are kept in.
pub(crate) fn authority(domain: &str, port: Option<u16>) -> String {
    match port {
        Some(port) => format!("{domain}:{port}"),
        None => domain.to_owned(),
    }
}

/// Whether the static list allows `domain` only under a path prefix or for one request, so it
/// may never be approved as a storage endpoint, at any port.
pub(crate) fn has_static_limits(domain: &str) -> bool {
    ALLOWED_PATH_PREFIXES
        .iter()
        .any(|(host, _)| *host == domain)
        || ALLOWED_ENDPOINTS
            .iter()
            .any(|endpoint| endpoint.host == domain)
}

/// `method` is None for a redirect hop, whose method reqwest does not expose; hosts limited to
/// one method then refuse it.
fn statically_allowed(domain: &str, url: &Url, method: Option<&Method>) -> bool {
    let path = url.path();
    ALLOWED_HOSTS.contains(&domain)
        || ALLOWED_PATH_PREFIXES.iter().any(|(host, prefix)| {
            *host == domain && path.starts_with(prefix) && !encodes_separator(path)
        })
        || ALLOWED_ENDPOINTS.iter().any(|endpoint| {
            endpoint.host == domain
                && method == Some(&endpoint.method)
                && url.query().is_none()
                && (endpoint.path)(path)
        })
}

/// The static list plus the storage endpoints the user approved, as of one request.
#[derive(Clone, Debug, Default)]
pub struct Allowed {
    approved: Arc<HashSet<String>>,
}

impl Allowed {
    pub fn new(approved: Arc<HashSet<String>>) -> Self {
        Self { approved }
    }

    /// Accepts a URL the proxy may send to with `method`, or says why not. `method` is None for
    /// a redirect hop.
    pub fn check(&self, url: &Url, method: Option<&Method>) -> Result<(), EgressError> {
        let domain = https_domain(url)?;
        // `port()` is None for the default port, which the parser drops from
        // `https://example.com:443`.
        let authority = authority(domain, url.port());
        // An approval never lifts the limits of a host the static list limits.
        if self.approved.contains(&authority) && !has_static_limits(domain) {
            return Ok(());
        }
        if url.port().is_some() {
            return Err(EgressError::Port(authority));
        }
        if statically_allowed(domain, url, method) {
            Ok(())
        } else {
            Err(EgressError::NotAllowed(authority))
        }
    }

    pub fn check_str(&self, url: &str, method: &Method) -> Result<Url, EgressError> {
        let parsed = Url::parse(url).map_err(|error| EgressError::Invalid(error.to_string()))?;
        self.check(&parsed, Some(method))?;
        Ok(parsed)
    }
}

/// The redirect policy for a request: each hop is checked like the first URL.
pub fn redirect_policy(allowed: Allowed, follow: bool) -> reqwest::redirect::Policy {
    checked_redirects(follow, move |url| allowed.check(url, None))
}

fn checked_redirects(
    follow: bool,
    hop: impl Fn(&Url) -> Result<(), EgressError> + Send + Sync + 'static,
) -> reqwest::redirect::Policy {
    if !follow {
        return reqwest::redirect::Policy::none();
    }
    reqwest::redirect::Policy::custom(move |attempt| {
        // `previous()` starts with the first URL, so it holds one URL per redirect followed so
        // far plus that one: this is redirect number `previous().len()`.
        if attempt.previous().len() > MAX_REDIRECTS {
            return attempt.error("too many redirects");
        }
        match hop(attempt.url()) {
            Ok(()) => attempt.follow(),
            Err(error) => attempt.error(error),
        }
    })
}

/// An error with its sources, as reqwest's own message omits why a redirect failed.
pub fn error_chain(error: &dyn std::error::Error) -> String {
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(current) = source {
        message.push_str(": ");
        message.push_str(&current.to_string());
        source = current.source();
    }
    message
}

/// Whether a failed request stopped at a redirect this module refused.
pub fn refused_redirect(error: &reqwest::Error) -> bool {
    let mut source = std::error::Error::source(error);
    while let Some(current) = source {
        if current.is::<EgressError>() {
            return true;
        }
        source = current.source();
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use EgressError::*;

    fn check(url: &str) -> Result<(), EgressError> {
        Allowed::default().check_str(url, &Method::GET).map(|_| ())
    }

    fn assert_cases(cases: &[(&str, Result<(), EgressError>)]) {
        for (url, expected) in cases {
            assert_eq!(&check(url), expected, "{url}");
        }
    }

    fn refused(host: &str) -> Result<(), EgressError> {
        Err(NotAllowed(host.into()))
    }

    #[test]
    fn allows_listed_hosts() {
        assert_cases(&[
            ("https://api.anthropic.com/v1/messages", Ok(())),
            ("https://fonts.gstatic.com/s/inter/v13/a.woff2", Ok(())),
            // The default port spelled out is the default port.
            ("https://api.anthropic.com:443/v1/messages", Ok(())),
            // Host names are case-insensitive.
            ("https://API.Anthropic.COM/v1/messages", Ok(())),
        ]);
    }

    #[test]
    fn rejects_unlisted_hosts_and_schemes() {
        assert_cases(&[
            ("https://evil.com/collect", refused("evil.com")),
            ("https://anthropic.com/", refused("anthropic.com")),
            ("http://api.anthropic.com/v1/messages", Err(NotHttps)),
            ("ftp://api.anthropic.com/", Err(NotHttps)),
            ("file:///etc/passwd", Err(NotHttps)),
        ]);
        assert!(matches!(check("not a url"), Err(Invalid(_))));
    }

    #[test]
    fn rejects_ip_literals_and_local_hosts() {
        assert_cases(&[
            ("https://127.0.0.1/", Err(IpAddress)),
            ("https://10.0.0.1/", Err(IpAddress)),
            ("https://169.254.169.254/latest/meta-data", Err(IpAddress)),
            ("https://[::1]/", Err(IpAddress)),
            // Integer and hex spellings parse as IPv4 addresses.
            ("https://2130706433/", Err(IpAddress)),
            ("https://0x7f.0.0.1/", Err(IpAddress)),
            ("https://localhost/", Err(Local("localhost".into()))),
            // A trailing dot names the same local host.
            ("https://localhost./", Err(Local("localhost.".into()))),
            (
                "https://foo.localhost./",
                Err(Local("foo.localhost.".into())),
            ),
            (
                "https://api.anthropic.com.localhost/",
                Err(Local("api.anthropic.com.localhost".into())),
            ),
        ]);
    }

    #[test]
    fn rejects_userinfo_and_other_ports() {
        assert_cases(&[
            // The real host is evil.com; api.anthropic.com is only the user name.
            ("https://api.anthropic.com@evil.com/", Err(Userinfo)),
            ("https://user:pass@api.anthropic.com/", Err(Userinfo)),
            ("https://:pass@api.anthropic.com/", Err(Userinfo)),
            (
                "https://api.anthropic.com:8443/",
                Err(Port("api.anthropic.com:8443".into())),
            ),
        ]);
    }

    #[test]
    fn matches_whole_host_names_only() {
        assert_cases(&[
            (
                "https://evilapi.anthropic.com/",
                refused("evilapi.anthropic.com"),
            ),
            (
                "https://api.anthropic.com.evil.com/",
                refused("api.anthropic.com.evil.com"),
            ),
            (
                "https://x.api.anthropic.com/",
                refused("x.api.anthropic.com"),
            ),
            // A trailing dot names the same host but is not on the list; refusing it is safe.
            ("https://api.anthropic.com./", refused("api.anthropic.com.")),
        ]);
    }

    #[test]
    fn limits_path_prefixed_hosts_to_their_prefix() {
        let jsdelivr = refused("cdn.jsdelivr.net");
        assert_cases(&[
            (
                "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2",
                Ok(()),
            ),
            (
                "https://cdn.jsdelivr.net/npm/some-package/index.js",
                jsdelivr.clone(),
            ),
            (
                "https://cdn.jsdelivr.net/gh/user/repo/file",
                jsdelivr.clone(),
            ),
            // Dot segments are resolved before the prefix is compared.
            (
                "https://cdn.jsdelivr.net/fontsource/../npm/x",
                jsdelivr.clone(),
            ),
            (
                "https://cdn.jsdelivr.net/fontsource/%2e%2e/npm/x",
                jsdelivr.clone(),
            ),
            ("https://cdn.jsdelivr.net/fontsourcex/", jsdelivr.clone()),
            // An encoded separator could be decoded into `/` or `\` after the prefix matched.
            (
                "https://cdn.jsdelivr.net/fontsource/..%2fnpm/x",
                jsdelivr.clone(),
            ),
            (
                "https://cdn.jsdelivr.net/fontsource/..%2Fnpm/x",
                jsdelivr.clone(),
            ),
            (
                "https://cdn.jsdelivr.net/fontsource/..%5cnpm/x",
                jsdelivr.clone(),
            ),
            ("https://cdn.jsdelivr.net/fontsource/..%5Cnpm/x", jsdelivr),
        ]);
    }

    #[test]
    fn limits_figma_to_the_image_batch_lookup() {
        let figma = refused("www.figma.com");
        let post = |url: &str| Allowed::default().check_str(url, &Method::POST).map(|_| ());
        assert_eq!(
            post("https://www.figma.com/file/AbC123-x_y/image/batch"),
            Ok(())
        );
        for url in [
            "https://www.figma.com/",
            "https://www.figma.com/file/abc",
            "https://www.figma.com/file//image/batch",
            "https://www.figma.com/file/a/b/image/batch",
            "https://www.figma.com/file/a%2fb/image/batch",
            "https://www.figma.com/file/abc/image/batch/extra",
            "https://www.figma.com/file/abc/image/batch?leak=1",
            "https://www.figma.com/api/multiplayer/abc",
            "https://www.figma.com/file/x/../../api/upload/image/batch",
        ] {
            assert_eq!(post(url), figma.clone(), "{url}");
        }
        for method in [Method::GET, Method::PUT, Method::DELETE] {
            assert_eq!(
                Allowed::default()
                    .check_str("https://www.figma.com/file/abc/image/batch", &method)
                    .map(|_| ()),
                figma.clone(),
                "{method}"
            );
        }
        // A redirect hop's method is unknown, so it may not land on the method-limited host.
        let url = Url::parse("https://www.figma.com/file/abc/image/batch").expect("url");
        assert_eq!(Allowed::default().check(&url, None), figma);
    }

    #[test]
    fn allows_approved_storage_endpoints_only() {
        let approved = ["s3.example.com", "minio.example.com:9000"];
        let allowed = Allowed::new(Arc::new(approved.iter().map(|h| (*h).into()).collect()));
        for (url, ok) in [
            ("https://s3.example.com/bucket/key", true),
            ("https://minio.example.com:9000/bucket", true),
            ("https://minio.example.com/bucket", false),
            ("https://s3.example.com:9000/bucket", false),
            ("http://s3.example.com/bucket", false),
            ("https://other.s3.example.com/bucket", false),
        ] {
            assert_eq!(allowed.check_str(url, &Method::GET).is_ok(), ok, "{url}");
        }
    }

    #[test]
    fn approvals_do_not_widen_limited_hosts() {
        let approved = ["cdn.jsdelivr.net", "www.figma.com", "www.figma.com:8443"];
        let allowed = Allowed::new(Arc::new(approved.iter().map(|h| (*h).into()).collect()));
        for url in [
            "https://cdn.jsdelivr.net/npm/some-package/index.js",
            "https://www.figma.com/api/multiplayer/abc",
            "https://www.figma.com:8443/file/abc/image/batch",
        ] {
            assert!(allowed.check_str(url, &Method::GET).is_err(), "{url}");
        }
        assert!(allowed
            .check_str(
                "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2",
                &Method::GET
            )
            .is_ok());
    }

    /// Serves one redirect on a loopback port and reports how many requests it answered.
    fn redirect_server(location: &'static str) -> (String, std::sync::mpsc::Receiver<usize>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let address = listener.local_addr().expect("address");
        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut served = 0;
            if let Ok((mut stream, _)) = listener.accept() {
                let _ = stream.read(&mut [0u8; 4096]);
                let response = format!(
                    "HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                );
                let _ = stream.write_all(response.as_bytes());
                served += 1;
            }
            let _ = sender.send(served);
        });
        (format!("http://{address}/start"), receiver)
    }

    fn get(start: &str, follow: bool) -> Result<reqwest::Response, reqwest::Error> {
        // The first hop is loopback HTTP only so the test needs no network; the proxy itself
        // never sends it, because `check` refuses it before a client is built.
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(redirect_policy(Allowed::default(), follow))
            .build()
            .expect("client");
        tauri::async_runtime::block_on(client.get(start).send())
    }

    #[test]
    fn redirects_are_checked_like_the_first_url() {
        for (location, reason) in [
            (
                "https://evil.example.com/collect",
                "evil.example.com is not an allowed host",
            ),
            ("http://api.anthropic.com/v1/messages", "only HTTPS"),
        ] {
            let (start, served) = redirect_server(location);
            let error = get(&start, true).expect_err("the redirect must be refused");
            assert!(error.is_redirect(), "{location}");
            assert!(refused_redirect(&error), "{location}");
            assert!(error_chain(&error).contains(reason), "{location}");
            assert_eq!(served.recv().expect("served"), 1);
        }
    }

    /// Serves a chain of `hops` redirects on one loopback port, then a 200.
    fn redirect_chain(hops: usize) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
        let address = listener.local_addr().expect("address");
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { return };
                let mut buffer = [0u8; 4096];
                let read = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..read]);
                let step: usize = request
                    .split_whitespace()
                    .nth(1)
                    .and_then(|path| path.strip_prefix('/'))
                    .and_then(|step| step.parse().ok())
                    .unwrap_or(0);
                let response = if step < hops {
                    format!(
                        "HTTP/1.1 302 Found\r\nLocation: http://{address}/{}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                        step + 1
                    )
                } else {
                    "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_owned()
                };
                let _ = stream.write_all(response.as_bytes());
            }
        });
        format!("http://{address}/0")
    }

    #[test]
    fn follows_at_most_max_redirects() {
        // Loopback hops pass here so the test needs no network; `check` itself refuses them.
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(checked_redirects(true, |_| Ok(())))
            .build()
            .expect("client");
        let get = |hops| tauri::async_runtime::block_on(client.get(redirect_chain(hops)).send());

        let response = get(MAX_REDIRECTS).expect("a chain of MAX_REDIRECTS is followed");
        assert_eq!(response.status().as_u16(), 200);
        assert!(response
            .url()
            .path()
            .ends_with(&format!("/{MAX_REDIRECTS}")));

        let error = get(MAX_REDIRECTS + 1).expect_err("one more redirect is refused");
        assert!(error.is_redirect());
        assert!(error_chain(&error).contains("too many redirects"));
    }

    #[test]
    fn redirects_are_not_followed_when_disabled() {
        let (start, _served) = redirect_server("https://evil.example.com/collect");
        let response = get(&start, false).expect("response");
        assert_eq!(response.status().as_u16(), 302);
    }
}
