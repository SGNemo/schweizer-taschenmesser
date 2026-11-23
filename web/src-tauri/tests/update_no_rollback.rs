//! NS2 (launch review 2026-11): the portable swap is Windows-only, so the order of its checks is
//! pinned here on the source text: signature, then the payload's own version, then the swap.
use std::fs;

#[test]
fn the_portable_update_checks_the_signed_version_before_the_swap() {
    let src = fs::read_to_string(format!("{}/src/update.rs", env!("CARGO_MANIFEST_DIR")))
        .unwrap()
        .replace("\r\n", "\n");
    let sig = src
        .find("portable::verify_payload(")
        .expect("signature check");
    let version = src.find("portable::not_older(").expect("version check");
    let swap = src.find("portable::swap(").expect("swap");
    assert!(sig < version && version < swap);
}
