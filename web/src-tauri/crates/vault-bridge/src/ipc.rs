//! The local channel between the native host and the app: a named pipe on Windows (current user
//! only, remote clients rejected), a 0600 Unix socket elsewhere (development and tests).
//!
//! Strictly request/response per connection, so a handle is never read and written from two
//! threads at once (synchronous Windows pipe handles would serialise and deadlock on that).

use std::io::{self, Read, Write};

/// Pipe name (Windows) or socket path (elsewhere).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Endpoint(pub String);

impl Endpoint {
    /// One channel per user. A Dev-Preview and a release app share it on purpose: the browser knows
    /// only one registered host, and the second app to start fails to bind instead of stealing it.
    pub fn for_user(user: &str) -> Endpoint {
        let user: String = user
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
            .collect();
        #[cfg(windows)]
        {
            Endpoint(format!(r"\\.\pipe\nemo-vault-{user}"))
        }
        #[cfg(not(windows))]
        {
            let dir = std::env::var_os("XDG_RUNTIME_DIR")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            Endpoint(
                dir.join(format!("nemo-vault-{user}.sock"))
                    .to_string_lossy()
                    .into_owned(),
            )
        }
    }
}

pub struct Stream {
    #[cfg(unix)]
    inner: std::os::unix::net::UnixStream,
    #[cfg(windows)]
    inner: std::fs::File,
    /// Server side: counts as one of this process's instances of the name until dropped.
    #[cfg(windows)]
    _own: Option<imp::Own>,
}

impl Read for Stream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.inner.read(buf)
    }
}

impl Write for Stream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.inner.write(buf)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

#[cfg(unix)]
mod imp {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::net::{UnixListener, UnixStream};

    pub struct Listener {
        inner: UnixListener,
        path: String,
    }

    pub fn connect(ep: &Endpoint) -> io::Result<Stream> {
        Ok(Stream {
            inner: UnixStream::connect(&ep.0)?,
        })
    }

    impl Listener {
        pub fn bind(ep: &Endpoint) -> io::Result<Listener> {
            if std::fs::metadata(&ep.0).is_ok() {
                // A live server answers; a leftover file from a crashed run does not.
                if UnixStream::connect(&ep.0).is_ok() {
                    return Err(io::Error::new(
                        io::ErrorKind::AddrInUse,
                        "another instance owns the channel",
                    ));
                }
                let _ = std::fs::remove_file(&ep.0);
            }
            let inner = UnixListener::bind(&ep.0)?;
            std::fs::set_permissions(&ep.0, std::fs::Permissions::from_mode(0o600))?;
            Ok(Listener {
                inner,
                path: ep.0.clone(),
            })
        }

        pub fn accept(&self) -> io::Result<Stream> {
            Ok(Stream {
                inner: self.inner.accept()?.0,
            })
        }
    }

    impl Drop for Listener {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::collections::HashMap;
    use std::fs::{File, OpenOptions};
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::FromRawHandle;
    use std::sync::Mutex;
    use std::time::Duration;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{
        CloseHandle, LocalFree, ERROR_NO_DATA, ERROR_PIPE_CONNECTED, HANDLE, HLOCAL,
        INVALID_HANDLE_VALUE,
    };
    use windows::Win32::Security::Authorization::{
        ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
        SDDL_REVISION_1,
    };
    use windows::Win32::Security::{
        GetTokenInformation, TokenUser, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY,
        TOKEN_USER,
    };
    use windows::Win32::Storage::FileSystem::{
        FILE_FLAGS_AND_ATTRIBUTES, FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX,
    };
    use windows::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PIPE_READMODE_BYTE,
        PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    const BUFFER: u32 = 64 * 1024;
    /// ERROR_PIPE_BUSY: every instance is in use right now (the next one is being created).
    const PIPE_BUSY: i32 = 231;
    /// ERROR_ACCESS_DENIED: what `FILE_FLAG_FIRST_PIPE_INSTANCE` gives when the name exists already.
    const ACCESS_DENIED: i32 = 5;
    /// `SECURITY_SQOS_PRESENT` and `SECURITY_IDENTIFICATION` (winbase.h). Defined locally so the
    /// flag does not depend on which `windows` crate feature exports them.
    const SECURITY_SQOS_PRESENT: u32 = 0x0010_0000;
    const SECURITY_IDENTIFICATION: u32 = 0x0001_0000;

    /// How many instances of each pipe name this process holds right now (free, connected or in
    /// a stream). While it is above zero the name is the app's own, so the next instance does not
    /// need `FILE_FLAG_FIRST_PIPE_INSTANCE` (which would fail on the app's own instances, e.g. a
    /// browser connection still open across a bridge restart). At zero it must be a first
    /// instance again, so a process that took the name in between is detected.
    static OWN: Mutex<Option<HashMap<Vec<u16>, usize>>> = Mutex::new(None);

    fn own_count(name: &[u16]) -> usize {
        let map = OWN.lock().unwrap_or_else(|e| e.into_inner());
        map.as_ref().and_then(|m| m.get(name).copied()).unwrap_or(0)
    }

    /// One counted instance of a name; the count drops with it.
    pub struct Own(Vec<u16>);

    impl Own {
        fn new(name: &[u16]) -> Own {
            let mut map = OWN.lock().unwrap_or_else(|e| e.into_inner());
            *map.get_or_insert_with(HashMap::new)
                .entry(name.to_vec())
                .or_insert(0) += 1;
            Own(name.to_vec())
        }
    }

    impl Drop for Own {
        fn drop(&mut self) {
            let mut map = OWN.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(m) = map.as_mut() {
                if let Some(n) = m.get_mut(&self.0) {
                    *n = n.saturating_sub(1);
                    if *n == 0 {
                        m.remove(&self.0);
                    }
                }
            }
        }
    }

    /// A pipe instance this process created and has not handed to a client yet. The kernel handle
    /// is owned here and closed exactly once (on drop, or by the `File` it becomes).
    struct Instance {
        handle: HANDLE,
        own: Option<Own>,
    }

    // SAFETY: an owned kernel handle may be used and closed from any thread; it is closed once.
    unsafe impl Send for Instance {}

    impl Instance {
        fn into_stream(mut self) -> Stream {
            let handle = std::mem::replace(&mut self.handle, INVALID_HANDLE_VALUE);
            let own = self.own.take();
            Stream {
                inner: unsafe { File::from_raw_handle(handle.0) },
                _own: own,
            }
        }
    }

    impl Drop for Instance {
        fn drop(&mut self) {
            if self.handle != INVALID_HANDLE_VALUE {
                unsafe {
                    let _ = CloseHandle(self.handle);
                }
            }
        }
    }

    /// Owns the pipe name for as long as it serves (X2). `bind` creates an instance before the
    /// server starts – as the first instance of the name unless the app holds it already – and
    /// every `accept` keeps a free instance: it creates the next one before handing the connected
    /// one out, and a client that gives up before the connection is complete does not cost the
    /// free instance (it is disconnected and reused).
    pub struct Listener {
        name: Vec<u16>,
        sddl: Vec<u16>,
        spare: Mutex<Option<Instance>>,
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn to_io(e: windows::core::Error) -> io::Error {
        io::Error::from_raw_os_error(e.code().0 & 0xFFFF)
    }

    /// `S-1-5-21-…` of the user this process runs as.
    fn current_user_sid() -> io::Result<String> {
        unsafe {
            let mut token = HANDLE::default();
            OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).map_err(to_io)?;
            let mut len = 0u32;
            let _ = GetTokenInformation(token, TokenUser, None, 0, &mut len);
            // u64 elements keep the buffer 8-byte aligned for the TOKEN_USER view below.
            let mut buf = vec![0u64; (len as usize).div_ceil(8).max(1)];
            let result = GetTokenInformation(
                token,
                TokenUser,
                Some(buf.as_mut_ptr().cast()),
                len,
                &mut len,
            );
            let _ = CloseHandle(token);
            result.map_err(to_io)?;
            let user = &*(buf.as_ptr().cast::<TOKEN_USER>());
            let mut text = PWSTR::null();
            ConvertSidToStringSidW(user.User.Sid, &mut text).map_err(to_io)?;
            let sid = text
                .to_string()
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "sid"));
            let _ = LocalFree(Some(HLOCAL(text.0.cast())));
            sid
        }
    }

    pub fn connect(ep: &Endpoint) -> io::Result<Stream> {
        // The server briefly has no free instance between two clients; retry for a moment, but
        // fail fast when the app is not running at all (NotFound).
        let mut last = io::Error::from(io::ErrorKind::NotFound);
        for _ in 0..6 {
            // Without an explicit quality of service the pipe server may impersonate this client
            // at impersonation level. The name is predictable and machine-global, so a process of
            // another user that squatted it must get the client's identity at most.
            match OpenOptions::new()
                .read(true)
                .write(true)
                .security_qos_flags(SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION)
                .open(&ep.0)
            {
                Ok(inner) => return Ok(Stream { inner, _own: None }),
                Err(e) if e.raw_os_error() == Some(PIPE_BUSY) => {
                    last = e;
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(e) => return Err(e),
            }
        }
        Err(last)
    }

    impl Listener {
        /// Fails with `AddrInUse` when another process already holds the name.
        pub fn bind(ep: &Endpoint) -> io::Result<Listener> {
            // Only this user, nobody else (the default pipe DACL would let everyone read).
            let sddl = wide(&format!("D:P(A;;GA;;;{})", current_user_sid()?));
            let listener = Listener {
                name: wide(&ep.0),
                sddl,
                spare: Mutex::new(None),
            };
            let first = listener.create_next()?;
            *listener.spare.lock().unwrap_or_else(|e| e.into_inner()) = Some(first);
            Ok(listener)
        }

        /// Waits for a client on the free instance, then creates the next one before returning.
        pub fn accept(&self) -> io::Result<Stream> {
            loop {
                let spare = self.spare.lock().unwrap_or_else(|e| e.into_inner()).take();
                let instance = match spare {
                    Some(instance) => instance,
                    // Only after an earlier creation failed.
                    None => self.create_next()?,
                };
                let connected = unsafe { ConnectNamedPipe(instance.handle, None) };
                match connected {
                    Ok(()) => {}
                    // A client that connected between create and connect is fine.
                    Err(e) if e.code() == ERROR_PIPE_CONNECTED.to_hresult() => {}
                    Err(e) => {
                        // Keep the instance (and with it the name): reset it for the next client.
                        unsafe {
                            let _ = DisconnectNamedPipe(instance.handle);
                        }
                        *self.spare.lock().unwrap_or_else(|e| e.into_inner()) = Some(instance);
                        if e.code() == ERROR_NO_DATA.to_hresult() {
                            continue; // the client gave up before the connection was complete
                        }
                        return Err(to_io(e));
                    }
                }
                // The connected instance still holds the name while the next one is created; if
                // that fails, the next `accept` tries again (as a first instance once none is left).
                if let Ok(next) = self.create_next() {
                    *self.spare.lock().unwrap_or_else(|e| e.into_inner()) = Some(next);
                }
                return Ok(instance.into_stream());
            }
        }

        /// A first instance when the app holds none of the name, otherwise one more of its own.
        fn create_next(&self) -> io::Result<Instance> {
            self.create(own_count(&self.name) == 0)
        }

        fn create(&self, first: bool) -> io::Result<Instance> {
            unsafe {
                let mut descriptor = PSECURITY_DESCRIPTOR::default();
                ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    PCWSTR(self.sddl.as_ptr()),
                    SDDL_REVISION_1,
                    &mut descriptor,
                    None,
                )
                .map_err(to_io)?;
                let attributes = SECURITY_ATTRIBUTES {
                    nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
                    lpSecurityDescriptor: descriptor.0,
                    bInheritHandle: false.into(),
                };
                let mut open_mode = PIPE_ACCESS_DUPLEX;
                if first {
                    open_mode |= FILE_FLAGS_AND_ATTRIBUTES(FILE_FLAG_FIRST_PIPE_INSTANCE.0);
                }
                let handle = CreateNamedPipeW(
                    PCWSTR(self.name.as_ptr()),
                    open_mode,
                    PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                    PIPE_UNLIMITED_INSTANCES,
                    BUFFER,
                    BUFFER,
                    0,
                    Some(&attributes),
                );
                let _ = LocalFree(Some(HLOCAL(descriptor.0)));
                if handle == INVALID_HANDLE_VALUE {
                    let e = io::Error::last_os_error();
                    if first && e.raw_os_error() == Some(ACCESS_DENIED) {
                        return Err(io::Error::new(
                            io::ErrorKind::AddrInUse,
                            "another process owns the channel",
                        ));
                    }
                    return Err(e);
                }
                Ok(Instance {
                    handle,
                    own: Some(Own::new(&self.name)),
                })
            }
        }
    }
}

pub use imp::{connect, Listener};
