use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    sync::{
        atomic::{AtomicU8, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};

use sha2::{Digest, Sha256, Sha512};

use crate::{
    job::{HashCheck, State},
    manager::{Inner, REMOVE_DELETE, RUN},
    name::{file_name_from_disposition, unique_name},
};

const CHUNK: usize = 64 * 1024;
const REPORT_EVERY: Duration = Duration::from_millis(250);
const SAVE_EVERY: Duration = Duration::from_secs(2);

enum Outcome {
    Done,
    Stopped,
    Failed(&'static str),
}

/// Hex digest of a file: SHA-512 when `long`, else SHA-256.
pub(crate) fn hash_file(path: &std::path::Path, long: bool) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut buf = vec![0u8; 1 << 20];
    if long {
        let mut h = Sha512::new();
        loop {
            let n = file.read(&mut buf).ok()?;
            if n == 0 {
                break;
            }
            h.update(&buf[..n]);
        }
        Some(hex(&h.finalize()))
    } else {
        let mut h = Sha256::new();
        loop {
            let n = file.read(&mut buf).ok()?;
            if n == 0 {
                break;
            }
            h.update(&buf[..n]);
        }
        Some(hex(&h.finalize()))
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// `total` from a `Content-Range: bytes a-b/total` header.
fn range_total(value: &str) -> Option<u64> {
    value.rsplit('/').next()?.trim().parse().ok()
}

/// Entry point of a job's thread: downloads, then records the outcome in the job list.
pub(crate) fn run(inner: &Arc<Inner>, id: u64, stop: &Arc<AtomicU8>) {
    let outcome = download(inner, id, stop);
    // A removed job is already gone from the list, so these updates then change nothing.
    match outcome {
        Outcome::Done => {}
        Outcome::Stopped => inner.update(id, |j| {
            j.state = State::Paused;
            j.speed_bps = 0;
        }),
        Outcome::Failed(why) => inner.update(id, |j| {
            j.state = State::Failed;
            j.error = Some(why.into());
            j.speed_bps = 0;
        }),
    }
}

fn download(inner: &Arc<Inner>, id: u64, stop: &Arc<AtomicU8>) -> Outcome {
    let Some(job) = inner.job(id) else {
        return Outcome::Stopped;
    };
    if !job.dir.is_dir() {
        return Outcome::Failed("io");
    }
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(None)
        .timeout_connect(Some(Duration::from_secs(30)))
        .http_status_as_error(false)
        .build()
        .into();

    // Two tries: a 416 (the partial file is longer than the file on the server) restarts from zero.
    let mut attempt = 0;
    let (response, mut have) = loop {
        let part = inner.job(id).map(|j| j.part_path());
        let Some(part) = part else {
            return Outcome::Stopped;
        };
        let have = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
        let mut request = agent.get(&job.url);
        if have > 0 {
            request = request.header("Range", format!("bytes={have}-"));
        }
        let response = match request.call() {
            Ok(r) => r,
            Err(_) => return Outcome::Failed("http"),
        };
        let status = response.status().as_u16();
        if status == 416 && attempt == 0 {
            let _ = fs::remove_file(&part);
            attempt += 1;
            continue;
        }
        if !(status == 200 || status == 206) {
            return Outcome::Failed("http");
        }
        break (response, have);
    };

    let status = response.status().as_u16();
    let append = have > 0 && status == 206;
    if !append {
        have = 0;
    }
    let header = |name: &str| {
        response
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned)
    };
    let total = if status == 206 {
        header("content-range").as_deref().and_then(range_total)
    } else {
        header("content-length").and_then(|v| v.trim().parse().ok())
    };

    // A fresh start may take the server's file name (once; a partial file keeps its name).
    if !append {
        let wanted = header("content-disposition")
            .as_deref()
            .and_then(file_name_from_disposition);
        if let Some(name) = wanted {
            let current = inner.job(id).map(|j| j.file_name).unwrap_or_default();
            let _ = fs::remove_file(job.dir.join(format!("{current}.part")));
            let unique = unique_name(&job.dir, &name, &|n| inner.name_taken(&job.dir, n, id));
            inner.update(id, |j| j.file_name = unique);
        }
    }
    inner.update(id, |j| {
        j.total = total;
        j.done = have;
        j.error = None;
    });
    let Some(part) = inner.job(id).map(|j| j.part_path()) else {
        return Outcome::Stopped;
    };
    let mut file = match OpenOptions::new()
        .create(true)
        .write(true)
        .append(append)
        .truncate(!append)
        .open(&part)
    {
        Ok(f) => f,
        Err(_) => return Outcome::Failed("io"),
    };

    let mut body = response.into_body().into_reader();
    let mut buf = vec![0u8; CHUNK];
    let mut done = have;
    let mut window = Instant::now();
    let mut window_bytes: u64 = 0;
    let mut last_report = Instant::now();
    let mut last_save = Instant::now();
    let mut last_report_bytes = done;

    loop {
        if stop.load(Ordering::Relaxed) != RUN {
            let _ = file.flush();
            drop(file);
            cleanup_if_removed(stop, &part);
            inner.update(id, |j| j.done = done);
            return Outcome::Stopped;
        }
        let n = match body.read(&mut buf) {
            Ok(n) => n,
            Err(_) => {
                let _ = file.flush();
                return Outcome::Failed("http");
            }
        };
        if n == 0 {
            break;
        }
        if file.write_all(&buf[..n]).is_err() {
            return Outcome::Failed("io");
        }
        done += n as u64;
        window_bytes += n as u64;

        // Speed limit: the job's own, else an equal share of the global one.
        let own = inner.job(id).map(|j| j.limit_bps).unwrap_or(0);
        let global = inner.global_bps.load(Ordering::Relaxed);
        let rate = if own > 0 {
            own
        } else if global > 0 {
            (global / inner.running().max(1) as u64).max(1)
        } else {
            0
        };
        if rate > 0 {
            let need = Duration::from_secs_f64(window_bytes as f64 / rate as f64);
            while window.elapsed() < need {
                if stop.load(Ordering::Relaxed) != RUN {
                    break;
                }
                thread::sleep(Duration::from_millis(20).min(need - window.elapsed()));
            }
        }
        if window.elapsed() >= Duration::from_secs(1) {
            window = Instant::now();
            window_bytes = 0;
        }

        if last_report.elapsed() >= REPORT_EVERY {
            let secs = last_report.elapsed().as_secs_f64().max(0.001);
            let speed = ((done - last_report_bytes) as f64 / secs) as u64;
            inner.update(id, |j| {
                j.done = done;
                j.speed_bps = speed;
            });
            inner.notify();
            last_report = Instant::now();
            last_report_bytes = done;
            if last_save.elapsed() >= SAVE_EVERY {
                inner.persist();
                last_save = Instant::now();
            }
        }
    }
    let _ = file.flush();
    drop(file);

    // Finished: size, then checksum, then the final name (never over an existing file).
    let size = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    if let Some(t) = total {
        if size != t {
            let _ = fs::remove_file(&part);
            return Outcome::Failed("size");
        }
    }
    let sha256 = hash_file(&part, false);
    let expected = inner.job(id).and_then(|j| j.expected_hash);
    let mut check = None;
    if let Some(exp) = &expected {
        let actual = if exp.len() == 128 {
            hash_file(&part, true)
        } else {
            sha256.clone()
        };
        if actual.as_deref() != Some(exp.as_str()) {
            let _ = fs::remove_file(&part);
            inner.update(id, |j| {
                j.sha256 = sha256.clone();
                j.hash_check = Some(HashCheck::Mismatch);
            });
            return Outcome::Failed("checksum");
        }
        check = Some(HashCheck::Match);
    }
    let Some(current) = inner.job(id) else {
        let _ = fs::remove_file(&part);
        return Outcome::Stopped;
    };
    let final_name = if current.dir.join(&current.file_name).exists() {
        unique_name(&current.dir, &current.file_name, &|n| {
            inner.name_taken(&current.dir, n, id)
        })
    } else {
        current.file_name.clone()
    };
    if fs::rename(&part, current.dir.join(&final_name)).is_err() {
        return Outcome::Failed("io");
    }
    inner.update(id, |j| {
        j.file_name = final_name;
        j.state = State::Done;
        j.done = size;
        j.total = Some(size);
        j.speed_bps = 0;
        j.sha256 = sha256;
        j.hash_check = check;
    });
    Outcome::Done
}

/// A removed job with "delete data" takes its partial file with it.
fn cleanup_if_removed(stop: &AtomicU8, part: &std::path::Path) {
    if stop.load(Ordering::Relaxed) == REMOVE_DELETE {
        let _ = fs::remove_file(part);
    }
}
