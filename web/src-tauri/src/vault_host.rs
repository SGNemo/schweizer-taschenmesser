//! Host mode of the executable: the browser starts `Nemo.exe chrome-extension://<id>/` for native
//! messaging. This runs before Tauri exists – no window, no WebView2, no single-instance hand-over –
//! and only relays framed messages between the browser (stdio) and the running app (pipe).

use ::vault_bridge::host::relay;
use ::vault_bridge::ipc::connect;
use ::vault_bridge::manifest::{is_host_invocation, origin_arg_allowed};

/// True when the arguments (without the program name) ask for host mode.
pub fn is_host(args: &[String]) -> bool {
    is_host_invocation(args)
}

/// Runs the relay until the browser closes the connection; the return value is the exit code.
pub fn run(args: &[String]) -> i32 {
    let Some(origin) = args.first() else { return 2 };
    let endpoint = crate::vault_bridge::endpoint();
    let allowed = origin_arg_allowed(origin);
    let result = relay(
        origin,
        allowed,
        &mut std::io::stdin().lock(),
        &mut std::io::stdout().lock(),
        &|| connect(&endpoint),
    );
    i32::from(result.is_err())
}
