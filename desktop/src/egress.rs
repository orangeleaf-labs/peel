//! The hosts `proxy_http_request` may reach.
//!
//! The proxy runs outside the WebView, so the CSP `connect-src` does not bound it. Every URL it
//! is asked for, and every redirect it would follow, is checked here first: HTTPS only, no
//! credentials in the URL, a domain name rather than an IP address, the default port, and a host
//! on the static list below. User-configured cloud storage endpoints are not on it, so storage
//! requests are refused on desktop until the user can approve an endpoint.

use std::fmt;

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
    // Pasting from Figma: the image batch lookup for the copied file...
    "www.figma.com",
    // ...and the signed image URLs that lookup returns.
    "s3-alpha-sig.figma.com",
    "s3-alpha.figma.com",
];

/// Hosts that serve arbitrary third-party content, allowed only under one path prefix.
const ALLOWED_PATH_PREFIXES: &[(&str, &str)] = &[
    // Online fonts, Fontsource provider: font files on jsDelivr's Fontsource mirror.
    ("cdn.jsdelivr.net", "/fontsource/"),
];

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
        }
    }
}

impl std::error::Error for EgressError {}

/// The domain of an HTTPS URL without credentials, lowercased by the URL parser.
fn https_domain(url: &Url) -> Result<&str, EgressError> {
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
            if domain == "localhost" || domain.ends_with(".localhost") {
                Err(EgressError::Local(domain.to_owned()))
            } else {
                Ok(domain)
            }
        }
    }
}

fn statically_allowed(domain: &str, path: &str) -> bool {
    ALLOWED_HOSTS.contains(&domain)
        || ALLOWED_PATH_PREFIXES
            .iter()
            .any(|(host, prefix)| *host == domain && path.starts_with(prefix))
}

/// Accepts a URL the proxy may send to, or says why not.
pub fn check(url: &Url) -> Result<(), EgressError> {
    let domain = https_domain(url)?;
    // `port()` is None for the default port, which the parser drops from `https://h:443`.
    if let Some(port) = url.port() {
        return Err(EgressError::Port(format!("{domain}:{port}")));
    }
    if statically_allowed(domain, url.path()) {
        Ok(())
    } else {
        Err(EgressError::NotAllowed(domain.to_owned()))
    }
}

pub fn check_str(url: &str) -> Result<Url, EgressError> {
    let parsed = Url::parse(url).map_err(|error| EgressError::Invalid(error.to_string()))?;
    check(&parsed)?;
    Ok(parsed)
}

/// The redirect policy for a request: each hop is checked like the first URL.
pub fn redirect_policy(follow: bool) -> reqwest::redirect::Policy {
    if !follow {
        return reqwest::redirect::Policy::none();
    }
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS {
            return attempt.error("too many redirects");
        }
        match check(attempt.url()) {
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
        check_str(url).map(|_| ())
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
            ("https://www.figma.com/file/abc/image/batch", Ok(())),
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
            ("https://cdn.jsdelivr.net/fontsourcex/", jsdelivr),
        ]);
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
            .redirect(redirect_policy(follow))
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

    #[test]
    fn redirects_are_not_followed_when_disabled() {
        let (start, _served) = redirect_server("https://evil.example.com/collect");
        let response = get(&start, false).expect("response");
        assert_eq!(response.status().as_u16(), 302);
    }
}
