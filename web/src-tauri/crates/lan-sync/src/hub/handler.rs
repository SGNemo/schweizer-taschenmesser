//! [`Hub`]: the store behind one lock, the current key version and rotation.
//!
//! One request shape for everybody (the hub-local client in process and remote clients inside
//! Noise frames), JSON, camelCase:
//!
//! ```text
//! {"keyVersion":3,"type":"push","ops":[{collection,id,field,hlc,value},…]}
//!   → {"epoch":"…","accepted":2,"cursor":17}
//! {"keyVersion":3,"type":"pull","since":0,"limit":1000}   (both optional)
//!   → {"epoch":"…","ops":[…],"cursor":17,"more":false}
//! {"keyVersion":3,"type":"info"}
//!   → {"epoch":"…","keyVersion":3}
//! any failure → {"error":"<code>"}      (codes: `HubError::code`)
//! ```
//!
//! The key version is checked first, under the same lock as the store access, so a push that was
//! encrypted under version n can never land after the rotation to n+1 emptied the store.

use super::validate::{validate_push, HubError};
use super::{DEFAULT_PULL_LIMIT, MAX_PULL_LIMIT, MAX_REQUEST_BYTES};
use crate::trust::SessionRegistry;
use crate::{FieldOp, Store};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex, MutexGuard};

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Request {
    Push {
        ops: Vec<FieldOp>,
    },
    Pull {
        #[serde(default)]
        since: i64,
        #[serde(default = "default_limit")]
        limit: i64,
    },
    Info,
}

fn default_limit() -> i64 {
    DEFAULT_PULL_LIMIT as i64
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
struct Envelope {
    #[serde(rename = "keyVersion")]
    key_version: u32,
    #[serde(flatten)]
    request: Request,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Response {
    Push {
        epoch: String,
        accepted: usize,
        cursor: i64,
    },
    Pull {
        epoch: String,
        ops: Vec<FieldOp>,
        cursor: i64,
        more: bool,
    },
    Info {
        epoch: String,
        key_version: u32,
    },
    Error(HubError),
}

impl Response {
    pub fn to_json(&self) -> Vec<u8> {
        let v: Value = match self {
            Response::Push {
                epoch,
                accepted,
                cursor,
            } => json!({ "epoch": epoch, "accepted": accepted, "cursor": cursor }),
            Response::Pull {
                epoch,
                ops,
                cursor,
                more,
            } => json!({ "epoch": epoch, "ops": ops, "cursor": cursor, "more": more }),
            Response::Info { epoch, key_version } => {
                json!({ "epoch": epoch, "keyVersion": key_version })
            }
            Response::Error(e) => json!({ "error": e.code() }),
        };
        serde_json::to_vec(&v).unwrap_or_else(|_| br#"{"error":"internal"}"#.to_vec())
    }
}

/// Result of a rotation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rotated {
    pub version: u32,
    pub epoch: String,
}

struct Inner {
    store: Store,
    key_version: u32,
}

pub struct Hub {
    inner: Mutex<Inner>,
    sessions: Arc<SessionRegistry>,
}

impl Hub {
    /// `key_version` is the version of the data key currently held by the key store (it lives
    /// there, not here).
    pub fn new(store: Store, key_version: u32, sessions: Arc<SessionRegistry>) -> Self {
        Hub {
            inner: Mutex::new(Inner { store, key_version }),
            sessions,
        }
    }

    fn lock(&self) -> Result<MutexGuard<'_, Inner>, HubError> {
        self.inner.lock().map_err(|_| HubError::Internal)
    }

    pub fn key_version(&self) -> Result<u32, HubError> {
        Ok(self.lock()?.key_version)
    }

    /// Parses and answers one request body; always returns a JSON body (errors as `{"error"}`).
    pub fn handle_json(&self, body: &[u8], now_ms: u64) -> Vec<u8> {
        let response = match self.try_handle_json(body, now_ms) {
            Ok(r) => r,
            Err(e) => Response::Error(e),
        };
        response.to_json()
    }

    fn try_handle_json(&self, body: &[u8], now_ms: u64) -> Result<Response, HubError> {
        if body.len() > MAX_REQUEST_BYTES {
            return Err(HubError::BadRequest);
        }
        let env: Envelope = serde_json::from_slice(body).map_err(|_| HubError::BadRequest)?;
        self.handle(env.key_version, env.request, now_ms)
    }

    /// The typed entry point (the JSON one only parses).
    pub fn handle(
        &self,
        key_version: u32,
        request: Request,
        now_ms: u64,
    ) -> Result<Response, HubError> {
        let mut g = self.lock()?;
        if key_version != g.key_version {
            return Err(HubError::StaleKeyVersion);
        }
        match request {
            Request::Push { ops } => {
                validate_push(&ops, now_ms)?;
                let res = g.store.push(&ops).map_err(|_| HubError::Internal)?;
                Ok(Response::Push {
                    epoch: g.store.epoch().map_err(|_| HubError::Internal)?,
                    accepted: res.accepted,
                    cursor: res.cursor,
                })
            }
            Request::Pull { since, limit } => {
                let limit = usize::try_from(limit)
                    .ok()
                    .filter(|l| *l >= 1)
                    .ok_or(HubError::BadRequest)?;
                if limit > MAX_PULL_LIMIT {
                    return Err(HubError::LimitTooLarge);
                }
                if since < 0 {
                    return Err(HubError::BadRequest);
                }
                let res = g.store.pull(since, limit).map_err(|_| HubError::Internal)?;
                Ok(Response::Pull {
                    epoch: g.store.epoch().map_err(|_| HubError::Internal)?,
                    ops: res.ops,
                    cursor: res.cursor,
                    more: res.more,
                })
            }
            Request::Info => Ok(Response::Info {
                epoch: g.store.epoch().map_err(|_| HubError::Internal)?,
                key_version: g.key_version,
            }),
        }
    }

    /// Key rotation to `new_version` (must be exactly the current one + 1; the caller has already
    /// stored the new data key under that version). Under one lock: wipes the store (new epoch),
    /// switches the version and closes every open session. On any error nothing has changed.
    pub fn rotate_to(&self, new_version: u32) -> Result<Rotated, HubError> {
        let mut g = self.lock()?;
        if g.key_version.checked_add(1) != Some(new_version) {
            return Err(HubError::BadRequest);
        }
        let epoch = g.store.reset().map_err(|_| HubError::Internal)?;
        g.key_version = new_version;
        self.sessions.close_all();
        Ok(Rotated {
            version: new_version,
            epoch,
        })
    }
}
