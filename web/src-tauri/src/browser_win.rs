//! Windows only: request-level ad/tracker blocking for browser tabs through WebView2's
//! `WebResourceRequested`. It only looks at the address of each request and may answer it with an
//! empty 403, and denies every permission request of the page (camera, microphone, location …); it
//! injects nothing into the page. Decisions: `browser::decide_request`.

use tauri::{AppHandle, Url, Webview};
use webview2_com::{
    take_pwstr,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_2, COREWEBVIEW2_PERMISSION_STATE_DENY, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
    },
    PermissionRequestedEventHandler, WebResourceRequestedEventHandler,
};
use windows_next::core::{w, Interface, PWSTR};

/// Start watching the requests of the tab's webview. Failures leave the tab unfiltered.
pub fn hook(app: &AppHandle, webview: &Webview, tab: u32) {
    let app = app.clone();
    let _ = webview.with_webview(move |platform| unsafe {
        let Ok(core) = platform.controller().CoreWebView2() else {
            return;
        };
        // Camera, microphone, location, notifications, clipboard …: the page never gets any of them.
        let deny = PermissionRequestedEventHandler::create(Box::new(|_, args| {
            if let Some(args) = args {
                args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?;
            }
            Ok(())
        }));
        let mut permission_token = 0i64;
        let _ = core.add_PermissionRequested(&deny, &mut permission_token);
        let Ok(env) = core.cast::<ICoreWebView2_2>().and_then(|c| c.Environment()) else {
            return;
        };
        if core
            .AddWebResourceRequestedFilter(w!("*"), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)
            .is_err()
        {
            return;
        }
        let handler = WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else {
                return Ok(());
            };
            let request = args.Request()?;
            let mut uri = PWSTR::null();
            request.Uri(&mut uri)?;
            let uri = take_pwstr(uri);
            if let Ok(url) = Url::parse(&uri) {
                if crate::browser::decide_request(&app, tab, &url) {
                    let response =
                        env.CreateWebResourceResponse(None, 403, w!("Blocked"), w!(""))?;
                    args.SetResponse(&response)?;
                }
            }
            Ok(())
        }));
        let mut token = 0i64;
        let _ = core.add_WebResourceRequested(&handler, &mut token);
    });
}
