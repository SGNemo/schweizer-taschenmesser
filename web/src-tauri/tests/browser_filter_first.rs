//! B3 (launch review 2026-11): on Windows a browser tab used to start loading its address before
//! the request filter was installed, and a failed filter left the tab unfiltered without a sign.
//! The hook code is Windows-only, so its order is pinned here on the source text.
use std::fs;

fn read(path: &str) -> String {
    fs::read_to_string(format!("{}/{path}", env!("CARGO_MANIFEST_DIR")))
        .unwrap()
        .replace("\r\n", "\n")
}

#[test]
fn a_windows_tab_opens_empty_and_navigates_only_after_the_filter() {
    let src = read("src/browser.rs");
    assert!(
        src.contains("let (first, then) = (\n        parse(\"about:blank\")?,"),
        "on Windows the webview starts at about:blank"
    );
    assert!(src.contains("WebviewUrl::External(first)"));
    let hook = src
        .find("crate::browser_win::hook(&app, &wv, tab);")
        .expect("hook");
    let go = src.find("wv.navigate(url)").expect("navigate");
    assert!(hook < go, "the filter is queued before the navigation");
}

#[test]
fn a_failed_filter_says_so() {
    let src = read("src/browser_win.rs");
    assert_eq!(src.matches("return failed();").count(), 3);
    assert!(src.contains("Event::Unfiltered { tab }"));
    assert!(!src.contains("let _ = core.add_WebResourceRequested("));
}
