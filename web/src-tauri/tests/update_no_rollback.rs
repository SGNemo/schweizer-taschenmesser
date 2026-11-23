//! NS2 (launch review 2026-11): the portable swap is Windows-only, so the order of its checks is
//! pinned here on the source text: signature, then the payload's own version, then the swap.
use std::fs;

#[test]
fn the_portable_update_checks_the_signed_version_before_the_swap() {
    let src = fs::read_to_string(format!("{}/src/update.rs", env!("CARGO_MANIFEST_DIR")))
        .unwrap()
        .replace("\r\n", "\n");
    // only inside the function that does the swap, so a mention elsewhere cannot fool the order
    let start = src.find("fn install_portable(").expect("install_portable");
    let body = &src[start..];
    let body = &body[..body.find("\n}\n").expect("end of install_portable")];
    let sig = body
        .find("portable::verify_payload(")
        .expect("signature check");
    let version = body.find("portable::not_older(").expect("version check");
    let swap = body.find("portable::swap(").expect("swap");
    assert!(sig < version && version < swap);
}
