/// Peak resident memory of this process in bytes (for the evaluation); `None` where not available.
pub fn peak_memory_bytes() -> Option<u64> {
    #[cfg(target_os = "linux")]
    {
        let status = std::fs::read_to_string("/proc/self/status").ok()?;
        let line = status.lines().find(|l| l.starts_with("VmHWM:"))?;
        let kb: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
        Some(kb * 1024)
    }
    #[cfg(windows)]
    {
        use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
        use windows::Win32::System::Threading::GetCurrentProcess;
        let mut counters = PROCESS_MEMORY_COUNTERS::default();
        let size = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
        // SAFETY: `counters` is a valid, properly sized out-parameter for the current process.
        unsafe { GetProcessMemoryInfo(GetCurrentProcess(), &mut counters, size).ok()? };
        Some(counters.PeakWorkingSetSize as u64)
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        None
    }
}
