//! Windows recycle bin through `IFileOperation`, with a progress sink that turns a *permanent*
//! delete into an abort.
//!
//! Why not the `trash` crate: it runs the operation with `FOF_NO_UI`, which includes
//! `FOF_NOCONFIRMATION`, so an item that cannot go to the bin (network drive, too big, no bin on
//! the volume) is silently deleted for good. Here `PreDeleteItem` sees whether the item is really
//! headed for the bin (`TSF_DELETE_RECYCLE_IF_POSSIBLE`) and returns `E_ABORT` if not, before
//! anything happens. One operation per item, so a refusal is reported per item.

use crate::delete::{TrashError, Trasher};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering::Relaxed};
use std::sync::Arc;
use windows::core::{implement, Result, HRESULT, PCWSTR};
use windows::Win32::Foundation::E_ABORT;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::{
    FileOperation, IFileOperation, IFileOperationProgressSink, IFileOperationProgressSink_Impl,
    IShellItem, SHCreateItemFromParsingName, FILEOPERATION_FLAGS, FOFX_RECYCLEONDELETE,
    FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI, FOF_SILENT, TSF_DELETE_RECYCLE_IF_POSSIBLE,
};

#[derive(Default)]
struct Flags {
    /// `PreDeleteItem` saw an item that would not go to the recycle bin and aborted.
    refused: AtomicBool,
}

#[implement(IFileOperationProgressSink)]
struct Sink(Arc<Flags>);

#[allow(non_snake_case)]
impl IFileOperationProgressSink_Impl for Sink_Impl {
    fn StartOperations(&self) -> Result<()> {
        Ok(())
    }
    fn FinishOperations(&self, _hrresult: HRESULT) -> Result<()> {
        Ok(())
    }
    fn PreRenameItem(
        &self,
        _dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
        _psznewname: &PCWSTR,
    ) -> Result<()> {
        Ok(())
    }
    fn PostRenameItem(
        &self,
        _dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
        _psznewname: &PCWSTR,
        _hrrename: HRESULT,
        _psinewlycreated: windows::core::Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn PreMoveItem(
        &self,
        _dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
        _psidestinationfolder: windows::core::Ref<'_, IShellItem>,
        _psznewname: &PCWSTR,
    ) -> Result<()> {
        Ok(())
    }
    fn PostMoveItem(
        &self,
        _dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
        _psidestinationfolder: windows::core::Ref<'_, IShellItem>,
        _psznewname: &PCWSTR,
        _hrmove: HRESULT,
        _psinewlycreated: windows::core::Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn PreCopyItem(
        &self,
        _dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
        _psidestinationfolder: windows::core::Ref<'_, IShellItem>,
        _psznewname: &PCWSTR,
    ) -> Result<()> {
        Ok(())
    }
    fn PostCopyItem(
        &self,
        _dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
        _psidestinationfolder: windows::core::Ref<'_, IShellItem>,
        _psznewname: &PCWSTR,
        _hrcopy: HRESULT,
        _psinewlycreated: windows::core::Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn PreDeleteItem(
        &self,
        dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
    ) -> Result<()> {
        if dwflags & (TSF_DELETE_RECYCLE_IF_POSSIBLE.0 as u32) == 0 {
            self.0.refused.store(true, Relaxed);
            return Err(E_ABORT.into());
        }
        Ok(())
    }
    fn PostDeleteItem(
        &self,
        _dwflags: u32,
        _psiitem: windows::core::Ref<'_, IShellItem>,
        _hrdelete: HRESULT,
        _psinewlycreated: windows::core::Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn PreNewItem(
        &self,
        _dwflags: u32,
        _psidestinationfolder: windows::core::Ref<'_, IShellItem>,
        _psznewname: &PCWSTR,
    ) -> Result<()> {
        Ok(())
    }
    fn PostNewItem(
        &self,
        _dwflags: u32,
        _psidestinationfolder: windows::core::Ref<'_, IShellItem>,
        _pszname: &PCWSTR,
        _psztemplatename: &PCWSTR,
        _dwfileattributes: u32,
        _hrnew: HRESULT,
        _psinewitem: windows::core::Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn UpdateProgress(&self, _iworktotal: u32, _iworksofar: u32) -> Result<()> {
        Ok(())
    }
    fn ResetTimer(&self) -> Result<()> {
        Ok(())
    }
    fn PauseTimer(&self) -> Result<()> {
        Ok(())
    }
    fn ResumeTimer(&self) -> Result<()> {
        Ok(())
    }
}

/// The shell wants `C:\x`, not the `\\?\C:\x` form `canonicalize` returns.
fn parsing_name(path: &Path) -> Vec<u16> {
    let s = path.to_string_lossy();
    let s = if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        s.into_owned()
    };
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

pub struct ShellTrasher;

impl Trasher for ShellTrasher {
    fn trash(&self, path: &Path) -> std::result::Result<(), TrashError> {
        // SAFETY: COM is initialised for this call and balanced below; every interface pointer is
        // owned by a `windows` smart pointer; the wide string outlives the call that uses it.
        unsafe {
            let inited = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
            let result = (|| -> std::result::Result<(), TrashError> {
                let op: IFileOperation = CoCreateInstance(&FileOperation, None, CLSCTX_ALL)
                    .map_err(|_| TrashError::Failed("shell"))?;
                op.SetOperationFlags(FILEOPERATION_FLAGS(
                    FOF_ALLOWUNDO.0
                        | FOF_NOCONFIRMATION.0
                        | FOF_NOERRORUI.0
                        | FOF_SILENT.0
                        | FOFX_RECYCLEONDELETE.0,
                ))
                .map_err(|_| TrashError::Failed("shell"))?;
                let flags = Arc::new(Flags::default());
                let sink: IFileOperationProgressSink = Sink(flags.clone()).into();
                let cookie = op.Advise(&sink).map_err(|_| TrashError::Failed("shell"))?;
                let name = parsing_name(path);
                let outcome = (|| -> Result<bool> {
                    let item: IShellItem =
                        SHCreateItemFromParsingName(PCWSTR(name.as_ptr()), None)?;
                    op.DeleteItem(&item, None)?;
                    let performed = op.PerformOperations();
                    let aborted = op.GetAnyOperationsAborted()?.as_bool();
                    performed?;
                    Ok(aborted)
                })();
                let _ = op.Unadvise(cookie);
                if flags.refused.load(Relaxed) {
                    return Err(TrashError::Unavailable);
                }
                match outcome {
                    Ok(false) => Ok(()),
                    Ok(true) => Err(TrashError::Failed("aborted")),
                    Err(_) => Err(TrashError::Failed("shell")),
                }
            })();
            if inited {
                CoUninitialize();
            }
            result
        }
    }
}
