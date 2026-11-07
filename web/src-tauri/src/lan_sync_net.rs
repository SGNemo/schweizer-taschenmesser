//! The operating-system side of the LAN hub's network decision: which IPv4 interfaces exist, which
//! of them have a default route, and which network (id, category) Windows has put them in.
//!
//! Windows only. Network id and category come from the Windows network list (NLA,
//! `INetworkListManager`), interfaces and default routes from `GetAdaptersAddresses`; adapters are
//! matched by their adapter GUID. Anything unexpected (COM error, no list) is an `Err`, which the
//! hub treats as "do not listen". On other systems the hub has no way to identify a home network,
//! so [`SystemNetwork`] always errs and the hub never listens there (the gateway-MAC fallback of the
//! concept is not built; the shipped desktop app is Windows).

use ::lan_sync::hub::netpolicy::{IfaceInfo, NetError, NetworkInfo};

pub struct SystemNetwork;

#[cfg(not(windows))]
impl NetworkInfo for SystemNetwork {
    fn interfaces(&self) -> Result<Vec<IfaceInfo>, NetError> {
        Err(NetError)
    }
}

#[cfg(windows)]
impl NetworkInfo for SystemNetwork {
    fn interfaces(&self) -> Result<Vec<IfaceInfo>, NetError> {
        win::interfaces()
    }
}

#[cfg(windows)]
mod win {
    use super::{IfaceInfo, NetError};
    use ::lan_sync::hub::netpolicy::NetCategory;
    use std::collections::HashMap;
    use std::net::{IpAddr, Ipv4Addr};
    use windows::core::GUID;
    use windows::Win32::Foundation::{ERROR_BUFFER_OVERFLOW, ERROR_SUCCESS, RPC_E_CHANGED_MODE};
    use windows::Win32::NetworkManagement::IpHelper::{
        GetAdaptersAddresses, GAA_FLAG_INCLUDE_GATEWAYS, GAA_FLAG_SKIP_ANYCAST,
        GAA_FLAG_SKIP_DNS_SERVER, GAA_FLAG_SKIP_MULTICAST, IP_ADAPTER_ADDRESSES_LH,
    };
    use windows::Win32::NetworkManagement::Ndis::IfOperStatusUp;
    use windows::Win32::Networking::NetworkListManager::{
        INetworkListManager, NetworkListManager,
        NLM_NETWORK_CATEGORY_PRIVATE, NLM_NETWORK_CATEGORY_PUBLIC,
        NLM_NETWORK_CATEGORY_DOMAIN_AUTHENTICATED,
    };
    use windows::Win32::Networking::WinSock::{AF_INET, SOCKADDR_IN};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    /// Adapter GUID (upper case, with braces, like `AdapterName`) -> (network id, category).
    fn nla() -> Result<HashMap<String, (String, NetCategory)>, NetError> {
        let mut out = HashMap::new();
        // SAFETY: plain COM calls on this thread; every interface pointer is owned by the windows
        // crate's smart pointers and released on drop.
        unsafe {
            // already initialised in another mode on this thread is fine
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            if hr.is_err() && hr != RPC_E_CHANGED_MODE {
                return Err(NetError);
            }
            let list: INetworkListManager =
                CoCreateInstance(&NetworkListManager, None, CLSCTX_ALL).map_err(|_| NetError)?;
            let conns = list
                .GetNetworkConnections()
                .map_err(|_| NetError)?;
            loop {
                let mut one = [None];
                let mut fetched = 0u32;
                conns
                    .Next(&mut one, Some(&mut fetched))
                    .map_err(|_| NetError)?;
                let Some(conn) = one[0].take() else { break };
                if fetched == 0 {
                    break;
                }
                let adapter: GUID = conn.GetAdapterId().map_err(|_| NetError)?;
                let net = conn.GetNetwork().map_err(|_| NetError)?;
                let id: GUID = net.GetNetworkId().map_err(|_| NetError)?;
                let cat = match net.GetCategory().map_err(|_| NetError)? {
                    c if c == NLM_NETWORK_CATEGORY_PRIVATE => NetCategory::Private,
                    c if c == NLM_NETWORK_CATEGORY_PUBLIC => NetCategory::Public,
                    c if c == NLM_NETWORK_CATEGORY_DOMAIN_AUTHENTICATED => NetCategory::Domain,
                    _ => NetCategory::Unknown,
                };
                out.insert(guid_key(&adapter), (format!("{id:?}"), cat));
            }
        }
        Ok(out)
    }

    /// `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`, upper case (the format of `AdapterName`).
    fn guid_key(g: &GUID) -> String {
        format!("{{{g:?}}}").to_ascii_uppercase()
    }

    pub fn interfaces() -> Result<Vec<IfaceInfo>, NetError> {
        let networks = nla()?;
        let flags = GAA_FLAG_INCLUDE_GATEWAYS
            | GAA_FLAG_SKIP_ANYCAST
            | GAA_FLAG_SKIP_MULTICAST
            | GAA_FLAG_SKIP_DNS_SERVER;
        // 8-byte aligned buffer, grown until the call fits
        let mut size: u32 = 16 * 1024;
        let mut buf: Vec<u64> = Vec::new();
        for _ in 0..4 {
            buf = vec![0u64; (size as usize).div_ceil(8)];
            let head = buf.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
            // SAFETY: `head` points to a zeroed buffer of at least `size` bytes.
            let rc = unsafe { GetAdaptersAddresses(u32::from(AF_INET.0), flags, None, Some(head), &mut size) };
            if rc == ERROR_SUCCESS.0 {
                return Ok(walk(buf.as_ptr().cast(), &networks));
            }
            if rc != ERROR_BUFFER_OVERFLOW.0 {
                return Err(NetError);
            }
        }
        drop(buf);
        Err(NetError)
    }

    fn walk(
        head: *const IP_ADAPTER_ADDRESSES_LH,
        networks: &HashMap<String, (String, NetCategory)>,
    ) -> Vec<IfaceInfo> {
        let mut out = Vec::new();
        let mut adapter = head;
        // SAFETY: the buffer filled by `GetAdaptersAddresses` is a valid linked list that stays
        // alive for the duration of this function; every pointer is checked for null first.
        unsafe {
            while !adapter.is_null() {
                let a = &*adapter;
                adapter = a.Next;
                if a.OperStatus != IfOperStatusUp || a.AdapterName.is_null() {
                    continue;
                }
                let name = a.AdapterName.to_string().unwrap_or_default().to_ascii_uppercase();
                let (network_id, category) = match networks.get(&name) {
                    Some((id, c)) => (Some(id.clone()), *c),
                    None => (None, NetCategory::Unknown),
                };
                let has_default_route = !a.FirstGatewayAddress.is_null();
                let mut u = a.FirstUnicastAddress;
                while !u.is_null() {
                    let ua = &*u;
                    u = ua.Next;
                    let sa = ua.Address.lpSockaddr;
                    if sa.is_null() || (ua.Address.iSockaddrLength as usize) < std::mem::size_of::<SOCKADDR_IN>() {
                        continue;
                    }
                    let v4 = &*sa.cast::<SOCKADDR_IN>();
                    if v4.sin_family != AF_INET {
                        continue;
                    }
                    let ip = Ipv4Addr::from(u32::from_be(v4.sin_addr.S_un.S_addr));
                    out.push(IfaceInfo {
                        ip: IpAddr::V4(ip),
                        prefix: ua.OnLinkPrefixLength,
                        has_default_route,
                        category,
                        network_id: network_id.clone(),
                    });
                }
            }
        }
        out
    }
}
