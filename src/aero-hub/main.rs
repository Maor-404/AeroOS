use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

fn parse_json_strings(body: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let chars: Vec<char> = body.chars().collect();
    let len = chars.len();
    let mut i = 0;

    fn read_str(chars: &[char], idx: &mut usize) -> Option<String> {
        if *idx >= chars.len() || chars[*idx] != '"' {
            return None;
        }
        *idx += 1;
        let mut s = String::new();
        while *idx < chars.len() {
            let c = chars[*idx];
            *idx += 1;
            if c == '"' {
                return Some(s);
            }
            if c == '\\' && *idx < chars.len() {
                let esc = chars[*idx];
                *idx += 1;
                match esc {
                    '"' => s.push('"'),
                    '\\' => s.push('\\'),
                    '/' => s.push('/'),
                    'n' => s.push('\n'),
                    'r' => s.push('\r'),
                    't' => s.push('\t'),
                    other => s.push(other),
                }
            } else {
                s.push(c);
            }
        }
        None
    }

    while i < len {
        if chars[i] == '"' {
            if let Some(key) = read_str(&chars, &mut i) {
                while i < len && chars[i].is_whitespace() {
                    i += 1;
                }
                if i < len && chars[i] == ':' {
                    i += 1;
                    while i < len && chars[i].is_whitespace() {
                        i += 1;
                    }
                    if i < len && chars[i] == '"' {
                        if let Some(val) = read_str(&chars, &mut i) {
                            map.insert(key, val);
                            continue;
                        }
                    }
                }
            }
        }
        i += 1;
    }
    map
}

fn resolve_dir(candidates: &[&str]) -> PathBuf {
    for c in candidates {
        let p = Path::new(c);
        if p.is_dir() {
            return p.to_path_buf();
        }
    }
    PathBuf::from(candidates[candidates.len() - 1])
}

fn resolve_bin(name: &str) -> String {
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            let near = dir.join(name);
            if near.is_file() {
                return near.to_string_lossy().into_owned();
            }
        }
    }
    if let Ok(cwd) = env::current_dir() {
        let local = cwd.join(name);
        if local.is_file() {
            return local.to_string_lossy().into_owned();
        }
    }
    let installed = Path::new("/usr/local/bin").join(name);
    if installed.is_file() {
        return installed.to_string_lossy().into_owned();
    }
    name.to_string()
}

fn find_in_path(bin: &str) -> Option<String> {
    if let Ok(path_var) = env::var("PATH") {
        for dir in path_var.split(':') {
            let full = Path::new(dir).join(bin);
            if full.is_file() {
                return Some(full.to_string_lossy().into_owned());
            }
        }
    }
    None
}

fn read_cpu_sample() -> Option<(u64, u64)> {
    let data = fs::read_to_string("/proc/stat").ok()?;
    let line = data.lines().next()?;
    let mut fields = line.split_whitespace();
    let _label = fields.next()?;
    let mut total: u64 = 0;
    let mut idle: u64 = 0;
    for (idx, f) in fields.enumerate() {
        let v: u64 = f.parse().unwrap_or(0);
        total = total.saturating_add(v);
        if idx == 3 || idx == 4 {
            idle = idle.saturating_add(v);
        }
    }
    Some((idle, total))
}

fn read_cpu_percent() -> f64 {
    let Some((i1, t1)) = read_cpu_sample() else {
        return 0.0;
    };
    thread::sleep(Duration::from_millis(80));
    let Some((i2, t2)) = read_cpu_sample() else {
        return 0.0;
    };
    if t2 <= t1 {
        return 0.0;
    }
    let pct = (1.0 - (i2.saturating_sub(i1) as f64) / ((t2 - t1) as f64)) * 100.0;
    (pct * 10.0).round() / 10.0
}

fn read_memory_info() -> (f64, f64, f64, bool) {
    let data = fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let mut vals: HashMap<&str, u64> = HashMap::new();
    for line in data.lines() {
        if let Some((k, rest)) = line.split_once(':') {
            if let Some(num) = rest.split_whitespace().next() {
                if let Ok(v) = num.parse::<u64>() {
                    vals.insert(k, v);
                }
            }
        }
    }
    let total_kb = *vals.get("MemTotal").unwrap_or(&0);
    let avail_kb = *vals
        .get("MemAvailable")
        .or_else(|| vals.get("MemFree"))
        .unwrap_or(&0);
    let used_kb = total_kb.saturating_sub(avail_kb);
    let pct = if total_kb > 0 {
        (((used_kb as f64) / (total_kb as f64)) * 1000.0).round() / 10.0
    } else {
        0.0
    };
    let mut zram = false;
    if let Ok(entries) = fs::read_dir("/sys/block") {
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with("zram") {
                if let Ok(sz) = fs::read_to_string(entry.path().join("disksize")) {
                    if sz.trim().parse::<u64>().unwrap_or(0) > 0 {
                        zram = true;
                        break;
                    }
                }
            }
        }
    }
    let to_gb = |kb: u64| ((kb as f64 / (1024.0 * 1024.0)) * 10.0).round() / 10.0;
    (to_gb(total_kb), to_gb(used_kb), pct, zram)
}

fn read_disk_info() -> (f64, f64, f64) {
    let out = Command::new("df").args(["-P", "-k", "/"]).output();
    let Ok(out) = out else {
        return (0.0, 0.0, 0.0);
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let Some(line) = text.lines().nth(1) else {
        return (0.0, 0.0, 0.0);
    };
    let cols: Vec<&str> = line.split_whitespace().collect();
    if cols.len() < 4 {
        return (0.0, 0.0, 0.0);
    }
    let total_kb: u64 = cols[1].parse().unwrap_or(0);
    let used_kb: u64 = cols[2].parse().unwrap_or(0);
    let pct = if total_kb > 0 {
        (((used_kb as f64) / (total_kb as f64)) * 1000.0).round() / 10.0
    } else {
        0.0
    };
    let to_gb = |kb: u64| ((kb as f64 / (1024.0 * 1024.0)) * 10.0).round() / 10.0;
    (to_gb(total_kb), to_gb(used_kb), pct)
}

fn read_os_name() -> String {
    if let Ok(data) = fs::read_to_string("/etc/os-release") {
        for line in data.lines() {
            if let Some(rest) = line.strip_prefix("PRETTY_NAME=") {
                return rest.trim_matches('"').to_string();
            }
        }
    }
    "Linux".to_string()
}

fn read_kernel_release() -> String {
    fs::read_to_string("/proc/sys/kernel/osrelease")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| env::consts::OS.to_string())
}

fn read_hostname() -> String {
    fs::read_to_string("/proc/sys/kernel/hostname")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "aeroos".to_string())
}

fn read_uptime() -> String {
    let Ok(data) = fs::read_to_string("/proc/uptime") else {
        return "—".to_string();
    };
    let secs = data
        .split_whitespace()
        .next()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0) as u64;
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let mins = (secs % 3600) / 60;
    if days > 0 {
        format!("{}d {}h {}m", days, hours, mins)
    } else if hours > 0 {
        format!("{}h {}m", hours, mins)
    } else {
        format!("{}m", mins)
    }
}

fn read_sysctl(key: &str, fallback: &str) -> String {
    let rel = key.replace('.', "/");
    let path = Path::new("/proc/sys").join(rel);
    fs::read_to_string(path)
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| fallback.to_string())
}

fn check_gamemode() -> (bool, bool) {
    let installed = find_in_path("gamemoded").is_some();
    let mut active = false;
    if installed {
        if let Ok(out) = Command::new("gamemoded").arg("-s").output() {
            let combined = format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            )
            .to_lowercase();
            if out.status.success() && combined.contains("active") {
                active = true;
            }
        }
    }
    (installed, active)
}

fn build_system_json() -> String {
    let hostname = read_hostname();
    let os_name = read_os_name();
    let kernel = read_kernel_release();
    let arch = env::consts::ARCH;
    let uptime = read_uptime();
    let wayland = env::var("WAYLAND_DISPLAY").map(|v| !v.is_empty()).unwrap_or(false);
    let comp = env::var("XDG_CURRENT_DESKTOP")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            if wayland {
                "Sway / Wayland".to_string()
            } else {
                "Desktop / Local Host".to_string()
            }
        });
    let cpu_pct = read_cpu_percent();
    let cpu_cores = thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    let (mem_total, mem_used, mem_pct, zram) = read_memory_info();
    let (disk_total, disk_used, disk_pct) = read_disk_info();
    let (gm_installed, gm_active) = check_gamemode();
    let swappiness = read_sysctl("vm.swappiness", "N/A");
    let max_map = read_sysctl("vm.max_map_count", "N/A");
    let congestion = read_sysctl("net.ipv4.tcp_congestion_control", "N/A");
    let qdisc = read_sysctl("net.core.default_qdisc", "N/A");

    format!(
        "{{\"mode\":\"live\",\"hostname\":\"{}\",\"os\":\"{}\",\"kernel\":\"{}\",\"arch\":\"{}\",\"uptime\":\"{}\",\"compositor\":\"{}\",\"wayland\":{},\"cpuPercent\":{:.1},\"cpuCores\":{},\"memory\":{{\"totalGb\":{:.1},\"usedGb\":{:.1},\"percent\":{:.1},\"zramActive\":{}}},\"disk\":{{\"totalGb\":{:.1},\"usedGb\":{:.1},\"percent\":{:.1}}},\"gamemode\":{{\"installed\":{},\"active\":{}}},\"sysctl\":{{\"swappiness\":\"{}\",\"maxMapCount\":\"{}\",\"congestion\":\"{}\",\"qdisc\":\"{}\"}}}}",
        json_escape(&hostname),
        json_escape(&os_name),
        json_escape(&kernel),
        json_escape(arch),
        json_escape(&uptime),
        json_escape(&comp),
        wayland,
        cpu_pct,
        cpu_cores,
        mem_total,
        mem_used,
        mem_pct,
        zram,
        disk_total,
        disk_used,
        disk_pct,
        gm_installed,
        gm_active,
        json_escape(&swappiness),
        json_escape(&max_map),
        json_escape(&congestion),
        json_escape(&qdisc)
    )
}

fn send_response(stream: &mut TcpStream, status: &str, content_type: &str, body: &[u8]) {
    let header = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        status,
        content_type,
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn send_json(stream: &mut TcpStream, status: &str, json: &str) {
    send_response(stream, status, "application/json; charset=utf-8", json.as_bytes());
}

fn mime_for(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn serve_static(stream: &mut TcpStream, base: &Path, rel_path: &str) {
    let trimmed = rel_path.trim_start_matches('/');
    let rel = if trimmed.is_empty() { "index.html" } else { trimmed };
    let candidate = base.join(rel);
    let Ok(canon_base) = base.canonicalize() else {
        send_response(stream, "404 Not Found", "text/plain", b"Not Found");
        return;
    };
    let target = if candidate.is_dir() {
        candidate.join("index.html")
    } else {
        candidate
    };
    let Ok(canon_target) = target.canonicalize() else {
        send_response(stream, "404 Not Found", "text/plain", b"Not Found");
        return;
    };
    if !canon_target.starts_with(&canon_base) || !canon_target.is_file() {
        send_response(stream, "403 Forbidden", "text/plain", b"Forbidden");
        return;
    }
    match fs::read(&canon_target) {
        Ok(bytes) => send_response(stream, "200 OK", mime_for(&canon_target), &bytes),
        Err(_) => send_response(stream, "404 Not Found", "text/plain", b"Not Found"),
    }
}

fn is_valid_local_origin(headers: &HashMap<String, String>, port: u16) -> bool {
    let host = headers.get("host").map(|s| s.as_str()).unwrap_or("");
    let expected_ip = format!("127.0.0.1:{}", port);
    let expected_lh = format!("localhost:{}", port);
    if host != expected_ip && host != expected_lh {
        return false;
    }
    if let Some(origin) = headers.get("origin") {
        let ok_ip = format!("http://127.0.0.1:{}", port);
        let ok_lh = format!("http://localhost:{}", port);
        if origin != &ok_ip && origin != &ok_lh {
            return false;
        }
    }
    true
}

fn query_param(query: &str, key: &str) -> Option<String> {
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == key {
                return Some(url_decode(v));
            }
        }
    }
    None
}

fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        } else if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[derive(Clone)]
struct ServerDirs {
    hub: PathBuf,
    themes: PathBuf,
    wallpapers: PathBuf,
    assets: PathBuf,
}

fn handle_client(mut stream: TcpStream, port: u16, dirs: ServerDirs) {
    let mut reader = BufReader::new(stream.try_clone().unwrap());
    let mut req_line = String::new();
    if reader.read_line(&mut req_line).unwrap_or(0) == 0 {
        return;
    }
    let parts: Vec<&str> = req_line.trim_end().split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }
    let method = parts[0];
    let full_target = parts[1];
    let (path, query) = full_target.split_once('?').unwrap_or((full_target, ""));

    let mut headers = HashMap::new();
    let mut content_len: usize = 0;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).unwrap_or(0) == 0 {
            break;
        }
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            break;
        }
        if let Some((k, v)) = trimmed.split_once(':') {
            let key = k.trim().to_ascii_lowercase();
            let val = v.trim().to_string();
            if key == "content-length" {
                content_len = val.parse::<usize>().unwrap_or(0).min(65536);
            }
            headers.insert(key, val);
        }
    }

    let mut body_bytes = vec![0u8; content_len];
    if content_len > 0 {
        let _ = reader.read_exact(&mut body_bytes);
    }
    let body = String::from_utf8_lossy(&body_bytes).into_owned();
    let home = env::var("HOME").unwrap_or_else(|_| "/home/antigravity".to_string());

    match (method, path) {
        ("GET", "/api/health") => {
            send_json(
                &mut stream,
                "200 OK",
                "{\"ok\":true,\"mode\":\"live\",\"version\":\"2.0.0\",\"runtime\":\"rust\"}",
            );
        }
        ("GET", "/api/system") => {
            send_json(&mut stream, "200 OK", &build_system_json());
        }
        ("GET", "/api/themes") => {
            let current_path = Path::new(&home).join(".config/aeroos/current-theme");
            let current = fs::read_to_string(current_path)
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "aero".to_string());
            let mut items = Vec::new();
            for tid in ["aero", "nordic", "sonokai", "nostalgia9x"] {
                let tpath = dirs.themes.join(tid).join("theme.json");
                if let Ok(raw) = fs::read_to_string(tpath) {
                    let trimmed = raw.trim();
                    if let Some(inner) = trimmed.strip_suffix('}') {
                        let active = tid == current;
                        items.push(format!("{},\"active\":{}}}", inner, active));
                    }
                }
            }
            let json = format!(
                "{{\"current\":\"{}\",\"themes\":[{}]}}",
                json_escape(&current),
                items.join(",")
            );
            send_json(&mut stream, "200 OK", &json);
        }
        ("POST", "/api/theme") => {
            if !is_valid_local_origin(&headers, port) {
                send_json(&mut stream, "403 Forbidden", "{\"error\":\"Forbidden origin\"}");
                return;
            }
            let fields = parse_json_strings(&body);
            let theme = fields.get("theme").map(|s| s.as_str()).unwrap_or("");
            if !matches!(theme, "aero" | "nordic" | "sonokai" | "nostalgia9x") {
                send_json(&mut stream, "400 Bad Request", "{\"error\":\"Unknown theme\"}");
                return;
            }
            match Command::new(resolve_bin("aero-theme")).arg(theme).output() {
                Ok(out) if out.status.success() => {
                    let msg = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    send_json(
                        &mut stream,
                        "200 OK",
                        &format!(
                            "{{\"ok\":true,\"theme\":\"{}\",\"output\":\"{}\"}}",
                            json_escape(theme),
                            json_escape(&msg)
                        ),
                    );
                }
                Ok(out) => {
                    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
                    send_json(
                        &mut stream,
                        "500 Internal Server Error",
                        &format!("{{\"ok\":false,\"error\":\"{}\"}}", json_escape(&err)),
                    );
                }
                Err(e) => {
                    send_json(
                        &mut stream,
                        "500 Internal Server Error",
                        &format!("{{\"ok\":false,\"error\":\"{}\"}}", json_escape(&e.to_string())),
                    );
                }
            }
        }
        ("GET", "/api/webapps") => {
            let webapp_bin = resolve_bin("aero-webapp");
            match Command::new(webapp_bin).args(["list", "--json"]).output() {
                Ok(out) if out.status.success() => {
                    send_response(
                        &mut stream,
                        "200 OK",
                        "application/json; charset=utf-8",
                        &out.stdout,
                    );
                }
                _ => {
                    send_json(&mut stream, "200 OK", "{\"installed\":[],\"catalog\":[]}");
                }
            }
        }
        ("POST", "/api/webapps") => {
            if !is_valid_local_origin(&headers, port) {
                send_json(&mut stream, "403 Forbidden", "{\"error\":\"Forbidden origin\"}");
                return;
            }
            let fields = parse_json_strings(&body);
            let name = fields.get("name").cloned().unwrap_or_default();
            let url = fields.get("url").cloned().unwrap_or_default();
            let mut args = vec![
                "install".to_string(),
                "--name".to_string(),
                name,
                "--url".to_string(),
                url,
            ];
            for (k, flag) in [
                ("category", "--category"),
                ("engine", "--engine"),
                ("color", "--color"),
                ("slug", "--slug"),
            ] {
                if let Some(v) = fields.get(k).filter(|s| !s.is_empty()) {
                    args.push(flag.to_string());
                    args.push(v.clone());
                }
            }
            match Command::new(resolve_bin("aero-webapp")).args(&args).output() {
                Ok(out) if out.status.success() => {
                    let app_json = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    let payload = if app_json.starts_with('{') {
                        format!("{{\"ok\":true,\"app\":{}}}", app_json)
                    } else {
                        "{\"ok\":true}".to_string()
                    };
                    send_json(&mut stream, "200 OK", &payload);
                }
                Ok(out) => {
                    let err = format!(
                        "{}{}",
                        String::from_utf8_lossy(&out.stdout),
                        String::from_utf8_lossy(&out.stderr)
                    );
                    send_json(
                        &mut stream,
                        "400 Bad Request",
                        &format!("{{\"error\":\"{}\"}}", json_escape(err.trim())),
                    );
                }
                Err(e) => {
                    send_json(
                        &mut stream,
                        "500 Internal Server Error",
                        &format!("{{\"error\":\"{}\"}}", json_escape(&e.to_string())),
                    );
                }
            }
        }
        ("DELETE", "/api/webapps") => {
            if !is_valid_local_origin(&headers, port) {
                send_json(&mut stream, "403 Forbidden", "{\"error\":\"Forbidden origin\"}");
                return;
            }
            let Some(slug) = query_param(query, "slug").filter(|s| !s.is_empty()) else {
                send_json(&mut stream, "400 Bad Request", "{\"error\":\"Missing slug\"}");
                return;
            };
            match Command::new(resolve_bin("aero-webapp"))
                .args(["remove", &slug])
                .status()
            {
                Ok(st) if st.success() => send_json(&mut stream, "200 OK", "{\"ok\":true}"),
                _ => send_json(&mut stream, "404 Not Found", "{\"ok\":false}"),
            }
        }
        ("POST", "/api/webapps/launch") => {
            if !is_valid_local_origin(&headers, port) {
                send_json(&mut stream, "403 Forbidden", "{\"error\":\"Forbidden\"}");
                return;
            }
            let fields = parse_json_strings(&body);
            let slug = fields.get("slug").map(|s| s.as_str()).unwrap_or("");
            match Command::new(resolve_bin("aero-webapp"))
                .args(["launch", slug])
                .status()
            {
                Ok(st) if st.success() => send_json(&mut stream, "200 OK", "{\"ok\":true}"),
                _ => send_json(&mut stream, "404 Not Found", "{\"ok\":false}"),
            }
        }
        ("POST", "/api/action") => {
            if !is_valid_local_origin(&headers, port) {
                send_json(&mut stream, "403 Forbidden", "{\"error\":\"Forbidden\"}");
                return;
            }
            let fields = parse_json_strings(&body);
            let action = fields.get("action").map(|s| s.as_str()).unwrap_or("");
            let swaylock_cfg = format!("{}/.config/swaylock/config", home);
            let aero_browser = resolve_bin("aero-browser");
            let aero_theme = resolve_bin("aero-theme");
            let aero_power = resolve_bin("aero-power");
            let cmd_args: Option<Vec<&str>> = match action {
                "open-terminal" => Some(vec!["kitty"]),
                "open-files" => Some(vec!["thunar"]),
                "open-aero-browser" => Some(vec![aero_browser.as_str()]),
                "open-browser" => Some(vec!["brave-browser"]),
                "open-app-center" => Some(vec!["gnome-software"]),
                "open-theme-menu" => Some(vec![aero_theme.as_str(), "--menu"]),
                "open-power-menu" => Some(vec![aero_power.as_str()]),
                "lock-screen" => Some(vec!["swaylock", "-C", swaylock_cfg.as_str()]),
                _ => None,
            };
            let Some(args) = cmd_args else {
                send_json(&mut stream, "400 Bad Request", "{\"error\":\"Unsupported action\"}");
                return;
            };
            match Command::new(args[0])
                .args(&args[1..])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
            {
                Ok(_) => send_json(
                    &mut stream,
                    "200 OK",
                    &format!("{{\"ok\":true,\"action\":\"{}\"}}", json_escape(action)),
                ),
                Err(e) => send_json(
                    &mut stream,
                    "404 Not Found",
                    &format!("{{\"error\":\"{}\"}}", json_escape(&e.to_string())),
                ),
            }
        }
        ("GET", p) if p.starts_with("/assets/wallpapers/") => {
            let rel = p.trim_start_matches("/assets/wallpapers/");
            serve_static(&mut stream, &dirs.wallpapers, rel);
        }
        ("GET", p) if p.starts_with("/assets/") => {
            let rel = p.trim_start_matches("/assets/");
            serve_static(&mut stream, &dirs.assets, rel);
        }
        ("GET", p) => {
            serve_static(&mut stream, &dirs.hub, p);
        }
        _ => {
            send_json(&mut stream, "405 Method Not Allowed", "{\"error\":\"Method not allowed\"}");
        }
    }
}

fn open_native_window(url: &str) {
    let ab = resolve_bin("aero-browser");
    if Path::new(&ab).is_file() || find_in_path("aero-browser").is_some() {
        let _ = Command::new(ab).args(["--app", url]).status();
        return;
    }
    for browser in ["brave-browser", "brave", "chromium", "chromium-browser", "google-chrome"] {
        if let Some(p) = find_in_path(browser) {
            let _ = Command::new(p)
                .args([&format!("--app={}", url), "--class=aero-hub", "--no-first-run"])
                .status();
            return;
        }
    }
    let _ = Command::new("xdg-open").arg(url).spawn();
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut tab = "overview".to_string();
    let mut port_req: u16 = 0;
    let mut bind_addr = "127.0.0.1".to_string();
    let mut serve_only = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--tab" if i + 1 < args.len() => {
                tab = args[i + 1].clone();
                i += 2;
            }
            "--port" if i + 1 < args.len() => {
                port_req = args[i + 1].parse().unwrap_or(0);
                i += 2;
            }
            "--bind" if i + 1 < args.len() => {
                bind_addr = args[i + 1].clone();
                i += 2;
            }
            "--serve-only" => {
                serve_only = true;
                i += 1;
            }
            _ => i += 1,
        }
    }

    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let hub_fallback = cwd.join("docs/hub");
    let theme_fallback = cwd.join("configs/themes");
    let wall_fallback = cwd.join("docs/assets/wallpapers");
    let assets_fallback = cwd.join("docs/assets");

    let dirs = ServerDirs {
        hub: resolve_dir(&["/usr/share/aeroos/hub", hub_fallback.to_str().unwrap_or("docs/hub")]),
        themes: resolve_dir(&["/usr/share/aeroos/themes", theme_fallback.to_str().unwrap_or("configs/themes")]),
        wallpapers: resolve_dir(&[
            "/usr/share/aeroos/wallpapers",
            wall_fallback.to_str().unwrap_or("docs/assets/wallpapers"),
        ]),
        assets: resolve_dir(&["/usr/share/aeroos/assets", assets_fallback.to_str().unwrap_or("docs/assets")]),
    };

    let listener = match TcpListener::bind((bind_addr.as_str(), port_req)) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[-] Failed to bind {}: {}", bind_addr, e);
            std::process::exit(1);
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(port_req);
    let target_url = format!("http://127.0.0.1:{}/?tab={}", port, tab);

    if serve_only {
        println!("AeroOS Control Hub serving at {}", target_url);
        for stream in listener.incoming().flatten() {
            let d = dirs.clone();
            thread::spawn(move || handle_client(stream, port, d));
        }
        return;
    }

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let d = dirs.clone();
            thread::spawn(move || handle_client(stream, port, d));
        }
    });

    open_native_window(&target_url);
}
