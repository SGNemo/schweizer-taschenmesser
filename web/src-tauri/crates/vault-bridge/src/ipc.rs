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
    use std::fs::{File, OpenOptions};
    use std::os::windows::io::FromRawHandle;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{
        CloseHandle, LocalFree, ERROR_PIPE_CONNECTED, HANDLE, HLOCAL, INVALID_HANDLE_VALUE,
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
        ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
        PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    const BUFFER: u32 = 64 * 1024;
    /// ERROR_PIPE_BUSY: every instance is in use right now (the next one is being created).
    const PIPE_BUSY: i32 = 231;

    pub struct Listener {
        name: Vec<u16>,
        sddl: Vec<u16>,
        first: AtomicBool,
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
            match OpenOptions::new().read(true).write(true).open(&ep.0) {
                Ok(inner) => return Ok(Stream { inner }),
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
        pub fn bind(ep: &Endpoint) -> io::Result<Listener> {
            // Only this user, nobody else (the default pipe DACL would let everyone read).
            let sddl = wide(&format!("D:P(A;;GA;;;{})", current_user_sid()?));
            Ok(Listener {
                name: wide(&ep.0),
                sddl,
                first: AtomicBool::new(true),
            })
        }

        /// Creates the next pipe instance and waits for a client. The first instance is created
        /// with `FILE_FLAG_FIRST_PIPE_INSTANCE`, so a process that squatted the name is detected
        /// instead of being served.
        pub fn accept(&self) -> io::Result<Stream> {
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
                if self.first.swap(false, Ordering::SeqCst) {
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
                    return Err(io::Error::last_os_error());
                }
                if let Err(e) = ConnectNamedPipe(handle, None) {
                    // A client that connected between create and connect is fine.
                    if e.code() != ERROR_PIPE_CONNECTED.to_hresult() {
                        let _ = CloseHandle(handle);
                        return Err(to_io(e));
                    }
                }
                Ok(Stream {
                    inner: File::from_raw_handle(handle.0),
                })
            }
        }
    }
}

pub use imp::{connect, Listener};
