//! System module (desktop only): read-only CPU, memory, battery, graphics, network and process
//! facts from the `system_info` crate. Nothing is stored, sent or written.

use std::sync::{Arc, Mutex};

use ::system_info::{DiskIo, Info, Monitor, Proc};
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

/// Read/write speed per volume since the previous call (display only).
#[tauri::command]
pub async fn system_disk_io(state: State<'_, SystemMonitor>) -> Result<Vec<DiskIo>, String> {
    let monitor = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        monitor
            .lock()
            .map(|mut m| m.disk_io())
            .map_err(|_| "internal".to_string())
    })
    .await
    .map_err(|_| "internal".to_string())?
}

/// Opens the Windows Task Manager (the only way to end a program: Nemo itself never does).
#[tauri::command]
pub fn system_open_task_manager() -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("taskmgr.exe")
            .spawn()
            .map(|_| ())
            .map_err(|_| "unsupported".to_string())
    }
    #[cfg(not(windows))]
    {
        Err("unsupported".to_string())
    }
}
