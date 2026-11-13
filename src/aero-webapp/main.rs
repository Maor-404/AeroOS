use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Clone)]
struct WebApp {
    slug: String,
    name: String,
    url: String,
    category: String,
    engine: String,
    color: String,
    icon: String,
    desktop_file: String,
}

struct CatalogItem {
    slug: &'static str,
    name: &'static str,
    url: &'static str,
    category: &'static str,
    description: &'static str,
    color: &'static str,
}

const CATALOG: &[CatalogItem] = &[
    CatalogItem {
        slug: "github",
        name: "GitHub",
        url: "https://github.com",
        category: "Development",
        description: "Repositories, pull requests, issues, and Actions",
        color: "#38bdf8",
    },
    CatalogItem {
        slug: "excalidraw",
        name: "Excalidraw",
        url: "https://excalidraw.com",
        category: "Graphics",
        description: "Fast collaborative whiteboard and architecture diagrams",
        color: "#2dd4bf",
    },
    CatalogItem {
        slug: "photopea",
        name: "Photopea",
        url: "https://www.photopea.com",
        category: "Graphics",
        description: "Full-featured PSD, XCF, and raster/vector image editor",
        color: "#38bdf8",
    },
    CatalogItem {
        slug: "mdn-docs",
        name: "MDN Web Docs",
        url: "https://developer.mozilla.org",
        category: "Development",
        description: "Web platform reference for HTML, CSS, and JavaScript",
        color: "#34d399",
    },
    CatalogItem {
        slug: "openstreetmap",
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org",
        category: "Network",
        description: "Open geographic maps and route planning",
        color: "#34d399",
    },
    CatalogItem {
        slug: "wikipedia",
        name: "Wikipedia",
        url: "https://www.wikipedia.org",
        category: "Office",
        description: "Free multilingual encyclopedia as a fast desktop app",
        color: "#94a3b8",
    },
    CatalogItem {
        slug: "codepen",
        name: "CodePen",
        url: "https://codepen.io",
        category: "Development",
        description: "Frontend playground for HTML, CSS, and JavaScript",
        color: "#7dd3fc",
    },
    CatalogItem {
        slug: "jitsi-meet",
        name: "Jitsi Meet",
        url: "https://meet.jit.si",
        category: "Network",
        description: "Encrypted browser video conferencing",
        color: "#38bdf8",
    },
];

fn home_dir() -> PathBuf {
    PathBuf::from(env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()))
}

fn app_dir() -> PathBuf {
    home_dir().join(".local/share/aeroos/webapps")
}

fn icon_dir() -> PathBuf {
    app_dir().join("icons")
}

fn profile_dir() -> PathBuf {
    app_dir().join("profiles")
}

fn desktop_dir() -> PathBuf {
    home_dir().join(".local/share/applications")
}

fn registry_path() -> PathBuf {
    app_dir().join("registry.tsv")
}

fn ensure_dirs() {
    let _ = fs::create_dir_all(app_dir());
    let _ = fs::create_dir_all(icon_dir());
    let _ = fs::create_dir_all(profile_dir());
    let _ = fs::create_dir_all(desktop_dir());
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = true;
    for ch in input.trim().to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "webapp".to_string()
    } else {
        trimmed.chars().take(48).collect()
    }
}

fn validate_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.chars().any(|c| c.is_whitespace()) {
        return Err("URL must be non-empty and contain no whitespace".to_string());
    }
    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{}", trimmed)
    };
    if !(candidate.starts_with("https://") || candidate.starts_with("http://")) {
        return Err(format!("Invalid HTTP/HTTPS URL: {}", raw));
    }
    Ok(candidate)
}

fn sanitize_field(s: &str) -> String {
    s.replace('\t', " ").replace('\n', " ").replace('\r', " ")
}

fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c => out.push(c),
        }
    }
    out
}

fn webapp_to_json(a: &WebApp) -> String {
    format!(
        "{{\"slug\":\"{}\",\"name\":\"{}\",\"url\":\"{}\",\"category\":\"{}\",\"engine\":\"{}\",\"color\":\"{}\",\"icon\":\"{}\",\"desktopFile\":\"{}\"}}",
        json_escape(&a.slug),
        json_escape(&a.name),
        json_escape(&a.url),
        json_escape(&a.category),
        json_escape(&a.engine),
        json_escape(&a.color),
        json_escape(&a.icon),
        json_escape(&a.desktop_file),
    )
}

fn catalog_to_json() -> String {
    let items: Vec<String> = CATALOG
        .iter()
        .map(|c| {
            format!(
                "{{\"slug\":\"{}\",\"name\":\"{}\",\"url\":\"{}\",\"category\":\"{}\",\"description\":\"{}\",\"color\":\"{}\"}}",
                json_escape(c.slug),
                json_escape(c.name),
                json_escape(c.url),
                json_escape(c.category),
                json_escape(c.description),
                json_escape(c.color),
            )
        })
        .collect();
    format!("[{}]", items.join(","))
}

fn load_registry() -> Vec<WebApp> {
    ensure_dirs();
    let path = registry_path();
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let mut apps = Vec::new();
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() >= 8 {
            apps.push(WebApp {
                slug: cols[0].to_string(),
                name: cols[1].to_string(),
                url: cols[2].to_string(),
                category: cols[3].to_string(),
                engine: cols[4].to_string(),
                color: cols[5].to_string(),
                icon: cols[6].to_string(),
                desktop_file: cols[7].to_string(),
            });
        }
    }
    apps
}

fn save_registry(apps: &[WebApp]) {
    ensure_dirs();
    let mut buf = String::new();
    for a in apps {
        buf.push_str(&format!(
            "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
            sanitize_field(&a.slug),
            sanitize_field(&a.name),
            sanitize_field(&a.url),
            sanitize_field(&a.category),
            sanitize_field(&a.engine),
            sanitize_field(&a.color),
            sanitize_field(&a.icon),
            sanitize_field(&a.desktop_file),
        ));
    }
    let _ = fs::write(registry_path(), buf);
}

fn generate_svg_icon(slug: &str, name: &str, color: &str) -> PathBuf {
    ensure_dirs();
    let icon_path = icon_dir().join(format!("{}.svg", slug));
    let mut initials: String = name
        .split_whitespace()
        .filter_map(|w| w.chars().next())
        .take(2)
        .map(|c| c.to_ascii_uppercase())
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    if initials.is_empty() {
        initials = "W".to_string();
    }
    let safe_color = if color.starts_with('#')
        && color.len() == 7
        && color.chars().skip(1).all(|c| c.is_ascii_hexdigit())
    {
        color
    } else {
        "#38bdf8"
    };

    let svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\">\n  <rect x=\"4\" y=\"4\" width=\"56\" height=\"56\" rx=\"16\" fill=\"#091828\"/>\n  <rect x=\"5\" y=\"5\" width=\"54\" height=\"54\" rx=\"15\" stroke=\"{0}\" stroke-opacity=\"0.55\" stroke-width=\"2\"/>\n  <text x=\"32\" y=\"40\" text-anchor=\"middle\" font-family=\"Inter, sans-serif\" font-weight=\"700\" font-size=\"24\" fill=\"{0}\">{1}</text>\n</svg>\n",
        safe_color, initials
    );
    let _ = fs::write(&icon_path, svg);
    icon_path
}

fn which(bin: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    for dir in env::split_paths(&path_var) {
        let candidate = dir.join(bin);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn self_exec_path() -> String {
    let installed = Path::new("/usr/local/bin/aero-webapp");
    if installed.is_file() {
        return installed.display().to_string();
    }
    env::current_exe()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "aero-webapp".to_string())
}

fn install_webapp(
    name: &str,
    url: &str,
    category: &str,
    engine: &str,
    color: &str,
    slug_opt: Option<&str>,
) -> Result<WebApp, String> {
    let clean_name = name.trim();
    if clean_name.is_empty() {
        return Err("WebApp name cannot be empty".to_string());
    }
    let clean_url = validate_url(url)?;
    let slug = slugify(slug_opt.unwrap_or(clean_name));
    let clean_engine = match engine {
        "auto" | "brave" | "aero-browser" | "qtwebengine" => engine,
        _ => "auto",
    };
    let clean_category: String = category
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == ';')
        .collect();
    let final_category = if clean_category.is_empty() {
        "Network".to_string()
    } else {
        clean_category
    };

    let icon_path = generate_svg_icon(&slug, clean_name, color);
    let desktop_file = desktop_dir().join(format!("aero-webapp-{}.desktop", slug));
    let exec_bin = self_exec_path();

    let desktop_content = format!(
        "[Desktop Entry]\nName={}\nComment=AeroOS WebApp ({})\nExec={} launch {}\nIcon={}\nTerminal=false\nType=Application\nCategories={};WebApp;\nStartupWMClass=aero-webapp-{}\n",
        clean_name,
        clean_url,
        exec_bin,
        slug,
        icon_path.display(),
        final_category,
        slug
    );
    fs::write(&desktop_file, desktop_content).map_err(|e| e.to_string())?;

    let record = WebApp {
        slug: slug.clone(),
        name: clean_name.to_string(),
        url: clean_url,
        category: final_category,
        engine: clean_engine.to_string(),
        color: color.to_string(),
        icon: icon_path.display().to_string(),
        desktop_file: desktop_file.display().to_string(),
    };

    let mut apps: Vec<WebApp> = load_registry()
        .into_iter()
        .filter(|a| a.slug != slug)
        .collect();
    apps.push(record.clone());
    save_registry(&apps);
    Ok(record)
}

fn remove_webapp(slug: &str) -> bool {
    let target_slug = slugify(slug);
    let apps = load_registry();
    let before = apps.len();
    let remaining: Vec<WebApp> = apps.into_iter().filter(|a| a.slug != target_slug).collect();
    save_registry(&remaining);

    let _ = fs::remove_file(desktop_dir().join(format!("aero-webapp-{}.desktop", target_slug)));
    let _ = fs::remove_file(icon_dir().join(format!("{}.svg", target_slug)));
    let _ = fs::remove_dir_all(profile_dir().join(&target_slug));
    remaining.len() < before
}

fn launch_webapp(slug: &str) -> i32 {
    let target_slug = slugify(slug);
    let apps = load_registry();
    let Some(entry) = apps.iter().find(|a| a.slug == target_slug) else {
        eprintln!("[-] WebApp '{}' is not installed.", target_slug);
        return 1;
    };

    let browser = ["brave-browser", "brave", "chromium", "chromium-browser", "google-chrome"]
        .iter()
        .find_map(|b| which(b));

    if entry.engine == "aero-browser" || entry.engine == "qtwebengine" || (entry.engine == "auto" && browser.is_none()) {
        if let Some(ab) = which("aero-browser") {
            let _ = Command::new(ab)
                .args(["--app", &entry.url])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
            return 0;
        }
    }

    if let Some(b) = browser {
        let prof = profile_dir().join(&target_slug);
        let _ = fs::create_dir_all(&prof);
        let _ = Command::new(b)
            .arg(format!("--app={}", entry.url))
            .arg(format!("--user-data-dir={}", prof.display()))
            .arg(format!("--class=aero-webapp-{}", target_slug))
            .arg("--no-first-run")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        return 0;
    }

    let _ = Command::new("xdg-open")
        .arg(&entry.url)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    0
}

fn open_menu() -> i32 {
    let apps = load_registry();
    if apps.is_empty() {
        if let Some(hub) = which("aero-hub") {
            let _ = Command::new(hub).args(["--tab", "webapps"]).spawn();
            return 0;
        }
        println!("No WebApps installed yet.");
        return 0;
    }

    let mut lines: Vec<String> = apps
        .iter()
        .map(|a| format!("{}  ({})  [{}]", a.name, a.url, a.slug))
        .collect();
    lines.push("+ Manage WebApps in AeroOS Hub".to_string());

    if env::var("WAYLAND_DISPLAY").is_ok() {
        if let Some(wofi) = which("wofi") {
            if let Ok(mut child) = Command::new(wofi)
                .args(["--dmenu", "--prompt", "Launch WebApp...", "--lines", "8"])
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .spawn()
            {
                if let Some(mut stdin) = child.stdin.take() {
                    let _ = stdin.write_all(lines.join("\n").as_bytes());
                }
                if let Ok(out) = child.wait_with_output() {
                    let choice = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if choice.is_empty() {
                        return 0;
                    }
                    if choice.starts_with("+ Manage WebApps") {
                        if let Some(hub) = which("aero-hub") {
                            let _ = Command::new(hub).args(["--tab", "webapps"]).spawn();
                        }
                        return 0;
                    }
                    if let (Some(start), Some(end)) = (choice.rfind('['), choice.rfind(']')) {
                        if end > start + 1 {
                            return launch_webapp(&choice[start + 1..end]);
                        }
                    }
                }
            }
        }
    }

    for (idx, a) in apps.iter().enumerate() {
        println!("{}) {} - {}", idx + 1, a.name, a.url);
    }
    0
}

fn print_help() {
    println!("AeroOS WebApp & PWA Manager (Rust)");
    println!("Usage:");
    println!("  aero-webapp list [--json]");
    println!("  aero-webapp catalog [--json]");
    println!("  aero-webapp install --name <NAME> --url <URL> [--category CAT] [--engine auto|brave|aero-browser] [--color #HEX] [--slug SLUG]");
    println!("  aero-webapp remove <SLUG>");
    println!("  aero-webapp launch <SLUG>");
    println!("  aero-webapp menu");
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_help();
        return;
    }

    match args[1].as_str() {
        "list" => {
            let as_json = args.iter().any(|a| a == "--json");
            let apps = load_registry();
            if as_json {
                let inst: Vec<String> = apps.iter().map(webapp_to_json).collect();
                println!("{{\"installed\":[{}],\"catalog\":{}}}", inst.join(","), catalog_to_json());
            } else if apps.is_empty() {
                println!("No WebApps installed.");
            } else {
                for a in apps {
                    println!("- {} [{}] -> {} ({})", a.name, a.slug, a.url, a.engine);
                }
            }
        }
        "catalog" => {
            let as_json = args.iter().any(|a| a == "--json");
            if as_json {
                println!("{}", catalog_to_json());
            } else {
                for c in CATALOG {
                    println!("- {} [{}] ({}): {}", c.name, c.slug, c.category, c.url);
                }
            }
        }
        "install" => {
            let mut name = String::new();
            let mut url = String::new();
            let mut category = "Network".to_string();
            let mut engine = "auto".to_string();
            let mut color = "#38bdf8".to_string();
            let mut slug: Option<String> = None;

            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--name" if i + 1 < args.len() => { name = args[i + 1].clone(); i += 2; }
                    "--url" if i + 1 < args.len() => { url = args[i + 1].clone(); i += 2; }
                    "--category" if i + 1 < args.len() => { category = args[i + 1].clone(); i += 2; }
                    "--engine" if i + 1 < args.len() => { engine = args[i + 1].clone(); i += 2; }
                    "--color" if i + 1 < args.len() => { color = args[i + 1].clone(); i += 2; }
                    "--slug" if i + 1 < args.len() => { slug = Some(args[i + 1].clone()); i += 2; }
                    _ => { i += 1; }
                }
            }

            match install_webapp(&name, &url, &category, &engine, &color, slug.as_deref()) {
                Ok(rec) => println!("{}", webapp_to_json(&rec)),
                Err(e) => {
                    eprintln!("[-] {}", e);
                    std::process::exit(1);
                }
            }
        }
        "remove" => {
            if args.len() < 3 {
                eprintln!("[-] Missing slug");
                std::process::exit(1);
            }
            if remove_webapp(&args[2]) {
                println!("Removed.");
            } else {
                println!("Not found.");
                std::process::exit(1);
            }
        }
        "launch" => {
            if args.len() < 3 {
                eprintln!("[-] Missing slug");
                std::process::exit(1);
            }
            std::process::exit(launch_webapp(&args[2]));
        }
        "menu" => {
            std::process::exit(open_menu());
        }
        _ => print_help(),
    }
}
