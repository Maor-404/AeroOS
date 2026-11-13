package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type MemoryInfo struct {
	TotalGB    float64 `json:"totalGb"`
	UsedGB     float64 `json:"usedGb"`
	Percent    float64 `json:"percent"`
	ZramActive bool    `json:"zramActive"`
}

type DiskInfo struct {
	TotalGB float64 `json:"totalGb"`
	UsedGB  float64 `json:"usedGb"`
	Percent float64 `json:"percent"`
}

type GameModeInfo struct {
	Installed bool `json:"installed"`
	Active    bool `json:"active"`
}

type SysctlInfo struct {
	Swappiness  string `json:"swappiness"`
	MaxMapCount string `json:"maxMapCount"`
	Congestion  string `json:"congestion"`
	Qdisc       string `json:"qdisc"`
}

type SystemSnapshot struct {
	Mode       string       `json:"mode"`
	Hostname   string       `json:"hostname"`
	OS         string       `json:"os"`
	Kernel     string       `json:"kernel"`
	Arch       string       `json:"arch"`
	Uptime     string       `json:"uptime"`
	Compositor string       `json:"compositor"`
	Wayland    bool         `json:"wayland"`
	CPUPercent float64      `json:"cpuPercent"`
	CPUCores   int          `json:"cpuCores"`
	Memory     MemoryInfo   `json:"memory"`
	Disk       DiskInfo     `json:"disk"`
	GameMode   GameModeInfo `json:"gamemode"`
	Sysctl     SysctlInfo   `json:"sysctl"`
}

func resolveDir(candidates ...string) string {
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return c
		}
	}
	return candidates[len(candidates)-1]
}

func resolveBin(name string) string {
	exe, _ := os.Executable()
	if exe != "" {
		near := filepath.Join(filepath.Dir(exe), name)
		if info, err := os.Stat(near); err == nil && !info.IsDir() {
			return near
		}
	}
	cwd, _ := os.Getwd()
	if cwd != "" {
		local := filepath.Join(cwd, name)
		if info, err := os.Stat(local); err == nil && !info.IsDir() {
			return local
		}
	}
	installed := filepath.Join("/usr/local/bin", name)
	if info, err := os.Stat(installed); err == nil && !info.IsDir() {
		return installed
	}
	if p, err := exec.LookPath(name); err == nil {
		return p
	}
	return name
}

func readCPUSample() (uint64, uint64, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0, err
	}
	lines := strings.SplitN(string(data), "\n", 2)
	fields := strings.Fields(lines[0])
	if len(fields) < 5 {
		return 0, 0, fmt.Errorf("unexpected /proc/stat")
	}
	var total, idle uint64
	for i, f := range fields[1:] {
		v, _ := strconv.ParseUint(f, 10, 64)
		total += v
		if i == 3 || i == 4 {
			idle += v
		}
	}
	return idle, total, nil
}

func readCPUPercent() float64 {
	i1, t1, err1 := readCPUSample()
	if err1 != nil {
		return 0
	}
	time.Sleep(80 * time.Millisecond)
	i2, t2, err2 := readCPUSample()
	if err2 != nil || t2 <= t1 {
		return 0
	}
	pct := (1.0 - float64(i2-i1)/float64(t2-t1)) * 100.0
	return float64(int(pct*10+0.5)) / 10.0
}

func readMemoryInfo() MemoryInfo {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return MemoryInfo{}
	}
	vals := map[string]uint64{}
	for _, line := range strings.Split(string(data), "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) > 0 {
			v, _ := strconv.ParseUint(fields[0], 10, 64)
			vals[parts[0]] = v
		}
	}
	totalKB := vals["MemTotal"]
	availKB := vals["MemAvailable"]
	if availKB == 0 {
		availKB = vals["MemFree"]
	}
	var usedKB uint64
	if totalKB > availKB {
		usedKB = totalKB - availKB
	}
	var pct float64
	if totalKB > 0 {
		pct = float64(int((float64(usedKB)/float64(totalKB))*1000+0.5)) / 10.0
	}
	zram := false
	matches, _ := filepath.Glob("/sys/block/zram*/disksize")
	for _, m := range matches {
		b, err := os.ReadFile(m)
		if err == nil {
			sz, _ := strconv.ParseUint(strings.TrimSpace(string(b)), 10, 64)
			if sz > 0 {
				zram = true
				break
			}
		}
	}
	round1 := func(kb uint64) float64 {
		gb := float64(kb) / (1024.0 * 1024.0)
		return float64(int(gb*10+0.5)) / 10.0
	}
	return MemoryInfo{
		TotalGB:    round1(totalKB),
		UsedGB:     round1(usedKB),
		Percent:    pct,
		ZramActive: zram,
	}
}

func readDiskInfo() DiskInfo {
	var st syscall.Statfs_t
	if err := syscall.Statfs("/", &st); err != nil {
		return DiskInfo{}
	}
	total := st.Blocks * uint64(st.Bsize)
	free := st.Bavail * uint64(st.Bsize)
	var used uint64
	if total > free {
		used = total - free
	}
	var pct float64
	if total > 0 {
		pct = float64(int((float64(used)/float64(total))*1000+0.5)) / 10.0
	}
	round1 := func(b uint64) float64 {
		gb := float64(b) / (1024.0 * 1024.0 * 1024.0)
		return float64(int(gb*10+0.5)) / 10.0
	}
	return DiskInfo{
		TotalGB: round1(total),
		UsedGB:  round1(used),
		Percent: pct,
	}
}

func readOSName() string {
	b, err := os.ReadFile("/etc/os-release")
	if err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(line, "PRETTY_NAME=") {
				return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
			}
		}
	}
	return "Linux"
}

func readKernelRelease() string {
	if b, err := os.ReadFile("/proc/sys/kernel/osrelease"); err == nil {
		return strings.TrimSpace(string(b))
	}
	return runtime.GOOS
}

func readUptime() string {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return "—"
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return "—"
	}
	secsFloat, _ := strconv.ParseFloat(fields[0], 64)
	secs := int(secsFloat)
	days := secs / 86400
	hours := (secs % 86400) / 3600
	mins := (secs % 3600) / 60
	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, mins)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, mins)
	}
	return fmt.Sprintf("%dm", mins)
}

func readSysctl(key, fallback string) string {
	p := filepath.Join("/proc/sys", strings.ReplaceAll(key, ".", "/"))
	b, err := os.ReadFile(p)
	if err != nil {
		return fallback
	}
	return strings.TrimSpace(string(b))
}

func checkGameMode() GameModeInfo {
	_, err := exec.LookPath("gamemoded")
	installed := err == nil
	active := false
	if installed {
		out, err := exec.Command("gamemoded", "-s").CombinedOutput()
		if err == nil && strings.Contains(strings.ToLower(string(out)), "active") {
			active = true
		}
	}
	return GameModeInfo{Installed: installed, Active: active}
}

func getSystemSnapshot() SystemSnapshot {
	host, _ := os.Hostname()
	comp := os.Getenv("XDG_CURRENT_DESKTOP")
	if comp == "" {
		if os.Getenv("WAYLAND_DISPLAY") != "" {
			comp = "Sway / Wayland"
		} else {
			comp = "Desktop / Local Host"
		}
	}
	return SystemSnapshot{
		Mode:       "live",
		Hostname:   host,
		OS:         readOSName(),
		Kernel:     readKernelRelease(),
		Arch:       runtime.GOARCH,
		Uptime:     readUptime(),
		Compositor: comp,
		Wayland:    os.Getenv("WAYLAND_DISPLAY") != "",
		CPUPercent: readCPUPercent(),
		CPUCores:   runtime.NumCPU(),
		Memory:     readMemoryInfo(),
		Disk:       readDiskInfo(),
		GameMode:   checkGameMode(),
		Sysctl: SysctlInfo{
			Swappiness:  readSysctl("vm.swappiness", "N/A"),
			MaxMapCount: readSysctl("vm.max_map_count", "N/A"),
			Congestion:  readSysctl("net.ipv4.tcp_congestion_control", "N/A"),
			Qdisc:       readSysctl("net.core.default_qdisc", "N/A"),
		},
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func isValidLocalOrigin(r *http.Request, port int) bool {
	host := r.Host
	if host != fmt.Sprintf("127.0.0.1:%d", port) && host != fmt.Sprintf("localhost:%d", port) {
		return false
	}
	origin := r.Header.Get("Origin")
	if origin != "" &&
		origin != fmt.Sprintf("http://127.0.0.1:%d", port) &&
		origin != fmt.Sprintf("http://localhost:%d", port) {
		return false
	}
	return true
}

func openNativeWindow(url string) {
	if p, err := exec.LookPath("aero-browser"); err == nil {
		cmd := exec.Command(p, "--app", url)
		_ = cmd.Run()
		return
	}
	for _, b := range []string{"brave-browser", "brave", "chromium", "chromium-browser", "google-chrome"} {
		if p, err := exec.LookPath(b); err == nil {
			cmd := exec.Command(p, "--app="+url, "--class=aero-hub", "--no-first-run")
			_ = cmd.Run()
			return
		}
	}
	_ = exec.Command("xdg-open", url).Start()
}

func main() {
	tab := flag.String("tab", "overview", "Initial tab")
	portFlag := flag.Int("port", 0, "Port on 127.0.0.1 (0 = ephemeral)")
	serveOnly := flag.Bool("serve-only", false, "Serve HTTP API without launching GUI window")
	flag.Parse()

	cwd, _ := os.Getwd()
	hubDir := resolveDir("/usr/share/aeroos/hub", filepath.Join(cwd, "docs", "hub"))
	themeDir := resolveDir("/usr/share/aeroos/themes", filepath.Join(cwd, "configs", "themes"))
	wallDir := resolveDir("/usr/share/aeroos/wallpapers", filepath.Join(cwd, "docs", "assets", "wallpapers"))
	assetsDir := resolveDir("/usr/share/aeroos/assets", filepath.Join(cwd, "docs", "assets"))

	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *portFlag))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[-] Failed to bind 127.0.0.1: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	allowedThemes := map[string]bool{"aero": true, "nordic": true, "sonokai": true, "nostalgia9x": true}

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "mode": "live", "version": "2.0.0", "runtime": "go"})
	})

	mux.HandleFunc("/api/system", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, getSystemSnapshot())
	})

	mux.HandleFunc("/api/themes", func(w http.ResponseWriter, r *http.Request) {
		home, _ := os.UserHomeDir()
		current := "aero"
		if b, err := os.ReadFile(filepath.Join(home, ".config", "aeroos", "current-theme")); err == nil {
			if s := strings.TrimSpace(string(b)); s != "" {
				current = s
			}
		}
		var themes []map[string]any
		for _, tid := range []string{"aero", "nordic", "sonokai", "nostalgia9x"} {
			b, err := os.ReadFile(filepath.Join(themeDir, tid, "theme.json"))
			if err != nil {
				continue
			}
			var item map[string]any
			if json.Unmarshal(b, &item) == nil {
				item["active"] = (tid == current)
				themes = append(themes, item)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"current": current, "themes": themes})
	})

	mux.HandleFunc("/api/theme", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
			return
		}
		if !isValidLocalOrigin(r, port) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden origin"})
			return
		}
		var body struct {
			Theme string `json:"theme"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
			return
		}
		if !allowedThemes[body.Theme] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Unknown theme"})
			return
		}
		out, err := exec.Command(resolveBin("aero-theme"), body.Theme).CombinedOutput()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": string(out)})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "theme": body.Theme, "output": strings.TrimSpace(string(out))})
	})

	mux.HandleFunc("/api/webapps", func(w http.ResponseWriter, r *http.Request) {
		webappBin := resolveBin("aero-webapp")
		switch r.Method {
		case http.MethodGet:
			out, err := exec.Command(webappBin, "list", "--json").Output()
			if err != nil {
				writeJSON(w, http.StatusOK, map[string]any{"installed": []any{}, "catalog": []any{}})
				return
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(out)
		case http.MethodPost:
			if !isValidLocalOrigin(r, port) {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden origin"})
				return
			}
			var body struct {
				Name     string `json:"name"`
				URL      string `json:"url"`
				Category string `json:"category"`
				Engine   string `json:"engine"`
				Color    string `json:"color"`
				Slug     string `json:"slug"`
			}
			if err := json.NewDecoder(io.LimitReader(r.Body, 8192)).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
				return
			}
			args := []string{"install", "--name", body.Name, "--url", body.URL}
			if body.Category != "" {
				args = append(args, "--category", body.Category)
			}
			if body.Engine != "" {
				args = append(args, "--engine", body.Engine)
			}
			if body.Color != "" {
				args = append(args, "--color", body.Color)
			}
			if body.Slug != "" {
				args = append(args, "--slug", body.Slug)
			}
			out, err := exec.Command(webappBin, args...).CombinedOutput()
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": strings.TrimSpace(string(out))})
				return
			}
			var rec any
			_ = json.Unmarshal(out, &rec)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "app": rec})
		case http.MethodDelete:
			if !isValidLocalOrigin(r, port) {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden origin"})
				return
			}
			slug := r.URL.Query().Get("slug")
			if slug == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing slug"})
				return
			}
			if err := exec.Command(webappBin, "remove", slug).Run(); err != nil {
				writeJSON(w, http.StatusNotFound, map[string]any{"ok": false})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
	})

	mux.HandleFunc("/api/webapps/launch", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !isValidLocalOrigin(r, port) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden"})
			return
		}
		var body struct {
			Slug string `json:"slug"`
		}
		_ = json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body)
		if err := exec.Command(resolveBin("aero-webapp"), "launch", body.Slug).Run(); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"ok": false})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	mux.HandleFunc("/api/action", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !isValidLocalOrigin(r, port) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden"})
			return
		}
		var body struct {
			Action string `json:"action"`
		}
		_ = json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body)
		home, _ := os.UserHomeDir()
		dispatch := map[string][]string{
			"open-terminal":     {"kitty"},
			"open-files":        {"thunar"},
			"open-aero-browser": {resolveBin("aero-browser")},
			"open-browser":      {"brave-browser"},
			"open-app-center":   {"/usr/local/bin/bauh"},
			"open-theme-menu":   {resolveBin("aero-theme"), "--menu"},
			"open-power-menu":   {resolveBin("aero-power")},
			"lock-screen":       {"swaylock", "-C", filepath.Join(home, ".config", "swaylock", "config")},
		}
		cmdArgs, ok := dispatch[body.Action]
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Unsupported action"})
			return
		}
		cmd := exec.Command(cmdArgs[0], cmdArgs[1:]...)
		if err := cmd.Start(); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": body.Action})
	})

	mux.Handle("/assets/wallpapers/", http.StripPrefix("/assets/wallpapers/", http.FileServer(http.Dir(wallDir))))
	mux.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir(assetsDir))))
	mux.Handle("/", http.FileServer(http.Dir(hubDir)))

	targetURL := fmt.Sprintf("http://127.0.0.1:%d/?tab=%s", port, *tab)
	srv := &http.Server{Handler: mux}

	if *serveOnly {
		fmt.Printf("AeroOS Control Hub serving at %s\n", targetURL)
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			os.Exit(1)
		}
		return
	}

	go func() {
		_ = srv.Serve(ln)
	}()
	openNativeWindow(targetURL)
	_ = srv.Close()
}
