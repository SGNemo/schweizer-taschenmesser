//! X2 (launch review 2026-11): the app must own the pipe name before it serves, and keep owning it.
//! Another process that holds `\\.\pipe\nemo-vault-<user>` first – or grabs it in a gap between two
//! clients – must make the app report "taken" instead of serving beside it. Windows only (named
//! pipes); runs in the CI job "Native shell (Windows)".
#![cfg(windows)]

use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use vault_bridge::ipc::{connect, Endpoint, Listener};
use vault_bridge::server::Server;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
use windows::Win32::Storage::FileSystem::{
    FILE_FLAGS_AND_ATTRIBUTES, FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX,
};
use windows::Win32::System::Pipes::{
    CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};

/// A pipe name of its own per test (tests run in parallel).
fn endpoint() -> Endpoint {
    static N: AtomicUsize = AtomicUsize::new(0);
    Endpoint(format!(
        r"\\.\pipe\nemo-vault-test-{}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst)
    ))
}

/// What a squatter does: create the first instance of the name (default security).
fn squat(ep: &Endpoint) -> Option<HANDLE> {
    let name: Vec<u16> = ep.0.encode_utf16().chain(std::iter::once(0)).collect();
    let handle = unsafe {
        CreateNamedPipeW(
            PCWSTR(name.as_ptr()),
            PIPE_ACCESS_DUPLEX | FILE_FLAGS_AND_ATTRIBUTES(FILE_FLAG_FIRST_PIPE_INSTANCE.0),
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
            PIPE_UNLIMITED_INSTANCES,
            4096,
            4096,
            0,
            None,
        )
    };
    (handle != INVALID_HANDLE_VALUE).then_some(handle)
}

#[test]
fn a_name_held_by_another_process_is_reported_as_taken() {
    let ep = endpoint();
    let squatter = squat(&ep).expect("the test squats the name first");
    let err = Listener::bind(&ep)
        .err()
        .expect("bind must not succeed beside a squatter");
    assert_eq!(err.kind(), std::io::ErrorKind::AddrInUse);
    let err = Server::start(ep, |_| true)
        .err()
        .expect("the server must not start");
    assert_eq!(err.kind(), std::io::ErrorKind::AddrInUse);
    unsafe {
        let _ = CloseHandle(squatter);
    }
}

#[test]
fn a_second_app_instance_cannot_bind_the_same_name() {
    let ep = endpoint();
    let _first = Listener::bind(&ep).expect("first bind");
    let err = Listener::bind(&ep).err().expect("second bind must fail");
    assert_eq!(err.kind(), std::io::ErrorKind::AddrInUse);
}

#[test]
fn the_name_stays_owned_between_two_clients() {
    let ep = endpoint();
    let mut server = Server::start(ep.clone(), |_| false).expect("server starts");
    // Owned from the start …
    assert!(squat(&ep).is_none(), "the name is free right after start");
    // … and after a client came and went (the old code closed its only instance here).
    for _ in 0..3 {
        drop(connect(&ep).expect("client connects"));
        std::thread::sleep(Duration::from_millis(50));
        if let Some(h) = squat(&ep) {
            unsafe {
                let _ = CloseHandle(h);
            }
            panic!("another process could take the name between two clients");
        }
    }
    server.stop();
}

#[test]
fn a_restart_with_a_browser_connection_still_open_is_not_taken() {
    let ep = endpoint();
    let mut first = Server::start(ep.clone(), |_| false).expect("first start");
    let held = connect(&ep).expect("the browser host stays connected");
    std::thread::sleep(Duration::from_millis(50));
    first.stop();
    // The app's own open connection must not look like a foreign process.
    let mut second = Server::start(ep.clone(), |_| false).expect("restart while connected");
    assert!(!second.taken());
    drop(held);
    second.stop();
}

#[test]
fn a_client_that_gives_up_early_does_not_free_the_name() {
    let ep = endpoint();
    let mut server = Server::start(ep.clone(), |_| false).expect("server starts");
    let held = connect(&ep).expect("one host stays connected");
    for _ in 0..20 {
        drop(connect(&ep).expect("short client"));
    }
    std::thread::sleep(Duration::from_millis(150));
    assert!(
        squat(&ep).is_none(),
        "the name became free after aborted clients"
    );
    assert!(
        !server.taken(),
        "the app's own connections were taken for a foreign process"
    );
    // Still serving: another host can connect.
    drop(connect(&ep).expect("a later host connects"));
    drop(held);
    server.stop();
}
