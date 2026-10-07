//! Native messaging framing: a 32-bit length in native byte order, then that many bytes of UTF-8
//! JSON. The same framing is used on the pipe between host and app. The length is checked against
//! a cap before anything is allocated.

use std::io::{self, Read, Write};

/// Largest message we accept or send (browsers allow 1 MB host → browser, much more the other way).
pub const MAX_MESSAGE: usize = 64 * 1024;

/// Reads one frame. `Ok(None)` is a clean end of input (the peer closed between two frames).
pub fn read_frame<R: Read>(reader: &mut R, max: usize) -> io::Result<Option<Vec<u8>>> {
    let mut len = [0u8; 4];
    let mut got = 0;
    while got < len.len() {
        match reader.read(&mut len[got..]) {
            Ok(0) if got == 0 => return Ok(None),
            Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
            Ok(n) => got += n,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(e),
        }
    }
    let len = u32::from_ne_bytes(len) as usize;
    if len > max {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "message too large",
        ));
    }
    let mut payload = vec![0u8; len];
    reader.read_exact(&mut payload)?;
    Ok(Some(payload))
}

pub fn write_frame<W: Write>(writer: &mut W, payload: &[u8], max: usize) -> io::Result<()> {
    if payload.len() > max {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "message too large",
        ));
    }
    let len = u32::try_from(payload.len())
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "message too large"))?;
    // One write, so a frame is never interleaved with another one.
    let mut buf = Vec::with_capacity(4 + payload.len());
    buf.extend_from_slice(&len.to_ne_bytes());
    buf.extend_from_slice(payload);
    writer.write_all(&buf)?;
    writer.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn round_trips_frames_back_to_back() {
        let mut buf = Vec::new();
        write_frame(&mut buf, b"{\"a\":1}", MAX_MESSAGE).unwrap();
        write_frame(&mut buf, b"{}", MAX_MESSAGE).unwrap();
        let mut input = Cursor::new(buf);
        assert_eq!(
            read_frame(&mut input, MAX_MESSAGE).unwrap().unwrap(),
            b"{\"a\":1}"
        );
        assert_eq!(read_frame(&mut input, MAX_MESSAGE).unwrap().unwrap(), b"{}");
        assert!(read_frame(&mut input, MAX_MESSAGE).unwrap().is_none());
    }

    #[test]
    fn rejects_oversize_before_allocating() {
        // Claims 4 GiB – must fail on the length alone, not try to read or allocate it.
        let mut input = Cursor::new(u32::MAX.to_ne_bytes().to_vec());
        let err = read_frame(&mut input, MAX_MESSAGE).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData);
        assert!(write_frame(&mut Vec::new(), &vec![0; MAX_MESSAGE + 1], MAX_MESSAGE).is_err());
    }

    #[test]
    fn truncated_frames_are_errors_not_end_of_input() {
        let mut head_only = Cursor::new(vec![1, 0]);
        assert_eq!(
            read_frame(&mut head_only, MAX_MESSAGE).unwrap_err().kind(),
            io::ErrorKind::UnexpectedEof
        );
        let mut body_short = Cursor::new([&5u32.to_ne_bytes()[..], b"ab"].concat());
        assert!(read_frame(&mut body_short, MAX_MESSAGE).is_err());
    }

    #[test]
    fn zero_length_frame_is_valid() {
        let mut input = Cursor::new(0u32.to_ne_bytes().to_vec());
        assert_eq!(
            read_frame(&mut input, MAX_MESSAGE).unwrap().unwrap(),
            Vec::<u8>::new()
        );
    }
}
