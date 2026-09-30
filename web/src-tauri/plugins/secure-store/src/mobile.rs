use serde::de::DeserializeOwned;
use serde_json::Value;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{models::*, Error, Result};

const ANDROID_PACKAGE: &str = "io.github.sgnemo.taschenmesser.securestore";

/// Registers the Kotlin plugin class (`SecureStorePlugin`).
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<SecureStore<R>> {
    let handle = api.register_android_plugin(ANDROID_PACKAGE, "SecureStorePlugin")?;
    Ok(SecureStore(handle))
}

pub struct SecureStore<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> SecureStore<R> {
    pub fn available(&self) -> Result<AvailableResponse> {
        self.0
            .run_mobile_plugin("available", ())
            .map_err(Into::into)
    }

    pub fn set(&self, request: SetRequest) -> Result<()> {
        validate_name(&request.name).map_err(Error::Invalid)?;
        validate_value(&request.value).map_err(Error::Invalid)?;
        self.0
            .run_mobile_plugin::<Value>("set", request)
            .map(drop)
            .map_err(Into::into)
    }

    pub fn get(&self, request: NameRequest) -> Result<ValueResponse> {
        validate_name(&request.name).map_err(Error::Invalid)?;
        self.0.run_mobile_plugin("get", request).map_err(Into::into)
    }

    pub fn delete(&self, request: NameRequest) -> Result<()> {
        validate_name(&request.name).map_err(Error::Invalid)?;
        self.0
            .run_mobile_plugin::<Value>("delete", request)
            .map(drop)
            .map_err(Into::into)
    }

    pub async fn biometric_seal(&self, request: SealRequest) -> Result<()> {
        validate_name(&request.name).map_err(Error::Invalid)?;
        validate_value(&request.secret).map_err(Error::Invalid)?;
        self.0
            .run_mobile_plugin_async::<Value>("biometricSeal", request)
            .await
            .map(drop)
            .map_err(Into::into)
    }

    pub async fn biometric_unseal(&self, request: UnsealRequest) -> Result<UnsealResponse> {
        validate_name(&request.name).map_err(Error::Invalid)?;
        self.0
            .run_mobile_plugin_async("biometricUnseal", request)
            .await
            .map_err(Into::into)
    }

    pub fn biometric_has(&self, request: NameRequest) -> Result<HasResponse> {
        validate_name(&request.name).map_err(Error::Invalid)?;
        self.0
            .run_mobile_plugin("biometricHas", request)
            .map_err(Into::into)
    }

    pub fn biometric_delete(&self, request: NameRequest) -> Result<()> {
        validate_name(&request.name).map_err(Error::Invalid)?;
        self.0
            .run_mobile_plugin::<Value>("biometricDelete", request)
            .map(drop)
            .map_err(Into::into)
    }

    pub fn set_secure_window(&self, request: SecureWindowRequest) -> Result<()> {
        self.0
            .run_mobile_plugin::<Value>("setSecureWindow", request)
            .map(drop)
            .map_err(Into::into)
    }
}
