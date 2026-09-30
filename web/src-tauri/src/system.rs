//! System module (desktop only): read-only CPU, memory, battery, graphics, network and process
//! facts from the `system_info` crate. Nothing is stored, sent or written.

use std::sync::{Arc, Mutex};

use ::system_info::{Info, Monitor, Proc};
use tauri::State;

/// Keeps the sampler between calls (CPU load is the difference of two readings).
#[derive(Default)]
pub struct SystemMonitor(Arc<Mutex<Monitor>>);

#[tauri::command]
pub async fn system_info(state: State<'_, SystemMonitor>) -> Result<Info, String> {
    let monitor = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        monitor
            .lock()
            .map(|mut m| m.snapshot())
            .map_err(|_| "internal".to_string())
    })
    .await
    .map_err(|_| "internal".to_string())?
}

/// The ten programs that use the most memory (display only).
#[tauri::command]
pub async fn system_processes(state: State<'_, SystemMonitor>) -> Result<Vec<Proc>, String> {
    let monitor = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        monitor
            .lock()
            .map(|mut m| m.top_processes(10))
            .map_err(|_| "internal".to_string())
    })
    .await
    .map_err(|_| "internal".to_string())?
}
