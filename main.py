import os
import re
import json
import time
import queue
import threading
import logging
import requests
import socketserver
from logging.handlers import RotatingFileHandler

# =========================
# CONFIG
# =========================
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 5141

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

RAW_LOG_FILE = "noti_raw.log"
APP_LOG_FILE = "noti_app.log"

# Bật/tắt các loại event Suricata muốn gửi
ALLOWED_SURICATA_EVENT_TYPES = {
    "alert",
    "dns",
    # "http",
    # "tls",
    # "flow",
}

# Chỉ gửi filterlog khi action là block
ONLY_SEND_FILTERLOG_BLOCK = True

# Chống spam
DEDUP_SECONDS = 30
TELEGRAM_INTERVAL = 1.0

# Nếu muốn chỉ theo dõi domain DNS nhất định, điền vào đây.
# Để [] thì gửi mọi DNS event hợp lệ.
WATCH_DNS_DOMAINS = []  # ví dụ: ["ai.com", "openai.com", "github.com"]

telegram_queue = queue.Queue()
recent_cache = {}
recent_lock = threading.Lock()

# =========================
# LOGGING
# =========================
logger = logging.getLogger("noti")
logger.setLevel(logging.INFO)

fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

console_handler = logging.StreamHandler()
console_handler.setFormatter(fmt)
logger.addHandler(console_handler)

app_handler = RotatingFileHandler(APP_LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
app_handler.setFormatter(fmt)
logger.addHandler(app_handler)

raw_logger = logging.getLogger("noti-raw")
raw_logger.setLevel(logging.INFO)
raw_handler = RotatingFileHandler(RAW_LOG_FILE, maxBytes=20 * 1024 * 1024, backupCount=5, encoding="utf-8")
raw_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
raw_logger.addHandler(raw_handler)

# =========================
# HELPERS
# =========================
def escape_html(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def send_telegram(text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text[:4000],
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    try:
        r = requests.post(url, json=payload, timeout=10)
        if r.status_code == 200:
            return True
        logger.error("Telegram API lỗi %s: %s", r.status_code, r.text)
        return False
    except Exception as e:
        logger.exception("Lỗi gửi Telegram: %s", e)
        return False


def telegram_worker():
    logger.info("Telegram worker started")
    while True:
        msg = telegram_queue.get()
        if msg is None:
            break

        ok = send_telegram(msg)
        if ok:
            logger.info("Đã gửi Telegram")
        else:
            logger.warning("Gửi Telegram thất bại")

        time.sleep(TELEGRAM_INTERVAL)
        telegram_queue.task_done()


def add_recent_key(key: str) -> bool:
    now = time.time()
    with recent_lock:
        expired = [k for k, ts in recent_cache.items() if now - ts > DEDUP_SECONDS]
        for k in expired:
            recent_cache.pop(k, None)

        if key in recent_cache:
            return True

        recent_cache[key] = now
        return False


# =========================
# SURICATA PARSER
# =========================
def extract_json_from_syslog(line: str):
    idx = line.find("{")
    if idx == -1:
        return None
    json_part = line[idx:]
    try:
        return json.loads(json_part)
    except json.JSONDecodeError:
        return None


def suricata_dedup_key(evt: dict) -> str:
    event_type = evt.get("event_type", "")
    src_ip = evt.get("src_ip", "")
    src_port = evt.get("src_port", "")
    dst_ip = evt.get("dest_ip", "")
    dst_port = evt.get("dest_port", "")
    proto = evt.get("proto", "")

    if event_type == "dns":
        dns = evt.get("dns", {})
        return f"suricata:dns:{src_ip}:{src_port}:{dst_ip}:{dst_port}:{proto}:{dns.get('rrname','')}:{dns.get('rrtype','')}"
    if event_type == "alert":
        alert = evt.get("alert", {})
        return f"suricata:alert:{src_ip}:{src_port}:{dst_ip}:{dst_port}:{proto}:{alert.get('signature','')}"
    if event_type == "http":
        http = evt.get("http", {})
        return f"suricata:http:{src_ip}:{src_port}:{dst_ip}:{dst_port}:{http.get('hostname','')}:{http.get('url','')}"
    if event_type == "tls":
        tls = evt.get("tls", {})
        return f"suricata:tls:{src_ip}:{src_port}:{dst_ip}:{dst_port}:{tls.get('sni','')}"
    return f"suricata:{event_type}:{src_ip}:{src_port}:{dst_ip}:{dst_port}:{proto}"


def should_send_suricata(evt: dict) -> bool:
    event_type = evt.get("event_type", "")
    if event_type not in ALLOWED_SURICATA_EVENT_TYPES:
        return False

    if event_type == "dns" and WATCH_DNS_DOMAINS:
        rrname = evt.get("dns", {}).get("rrname", "").lower()
        return any(d.lower() in rrname for d in WATCH_DNS_DOMAINS)

    return True


def format_suricata_dns(evt: dict) -> str:
    dns = evt.get("dns", {})
    return (
        f"<b>Suricata DNS</b>\n"
        f"<b>Time:</b> {escape_html(evt.get('timestamp', ''))}\n"
        f"<b>Interface:</b> {escape_html(evt.get('in_iface', ''))}\n"
        f"<b>Source:</b> <code>{escape_html(evt.get('src_ip', ''))}:{escape_html(evt.get('src_port', ''))}</code>\n"
        f"<b>Destination:</b> <code>{escape_html(evt.get('dest_ip', ''))}:{escape_html(evt.get('dest_port', ''))}</code>\n"
        f"<b>Protocol:</b> {escape_html(evt.get('proto', ''))}\n"
        f"<b>Query:</b> <code>{escape_html(dns.get('rrname', ''))}</code>\n"
        f"<b>Type:</b> {escape_html(dns.get('rrtype', ''))}"
    )


def format_suricata_alert(evt: dict) -> str:
    alert = evt.get("alert", {})
    return (
        f"<b>Suricata ALERT</b>\n"
        f"<b>Time:</b> {escape_html(evt.get('timestamp', ''))}\n"
        f"<b>Interface:</b> {escape_html(evt.get('in_iface', ''))}\n"
        f"<b>Signature:</b> <code>{escape_html(alert.get('signature', ''))}</code>\n"
        f"<b>Category:</b> {escape_html(alert.get('category', ''))}\n"
        f"<b>Severity:</b> {escape_html(alert.get('severity', ''))}\n"
        f"<b>Source:</b> <code>{escape_html(evt.get('src_ip', ''))}:{escape_html(evt.get('src_port', ''))}</code>\n"
        f"<b>Destination:</b> <code>{escape_html(evt.get('dest_ip', ''))}:{escape_html(evt.get('dest_port', ''))}</code>\n"
        f"<b>Protocol:</b> {escape_html(evt.get('proto', ''))}"
    )


def format_suricata_http(evt: dict) -> str:
    http = evt.get("http", {})
    return (
        f"<b>Suricata HTTP</b>\n"
        f"<b>Time:</b> {escape_html(evt.get('timestamp', ''))}\n"
        f"<b>Source:</b> <code>{escape_html(evt.get('src_ip', ''))}:{escape_html(evt.get('src_port', ''))}</code>\n"
        f"<b>Destination:</b> <code>{escape_html(evt.get('dest_ip', ''))}:{escape_html(evt.get('dest_port', ''))}</code>\n"
        f"<b>Method:</b> {escape_html(http.get('http_method', ''))}\n"
        f"<b>Host:</b> <code>{escape_html(http.get('hostname', ''))}</code>\n"
        f"<b>URL:</b> <code>{escape_html(http.get('url', ''))}</code>"
    )


def format_suricata_tls(evt: dict) -> str:
    tls = evt.get("tls", {})
    return (
        f"<b>Suricata TLS</b>\n"
        f"<b>Time:</b> {escape_html(evt.get('timestamp', ''))}\n"
        f"<b>Source:</b> <code>{escape_html(evt.get('src_ip', ''))}:{escape_html(evt.get('src_port', ''))}</code>\n"
        f"<b>Destination:</b> <code>{escape_html(evt.get('dest_ip', ''))}:{escape_html(evt.get('dest_port', ''))}</code>\n"
        f"<b>SNI:</b> <code>{escape_html(tls.get('sni', ''))}</code>\n"
        f"<b>Version:</b> {escape_html(tls.get('version', ''))}\n"
        f"<b>Subject:</b> <code>{escape_html(tls.get('subject', ''))}</code>"
    )


def format_suricata_flow(evt: dict) -> str:
    flow = evt.get("flow", {})
    return (
        f"<b>Suricata FLOW</b>\n"
        f"<b>Time:</b> {escape_html(evt.get('timestamp', ''))}\n"
        f"<b>Source:</b> <code>{escape_html(evt.get('src_ip', ''))}:{escape_html(evt.get('src_port', ''))}</code>\n"
        f"<b>Destination:</b> <code>{escape_html(evt.get('dest_ip', ''))}:{escape_html(evt.get('dest_port', ''))}</code>\n"
        f"<b>Protocol:</b> {escape_html(evt.get('proto', ''))}\n"
        f"<b>State:</b> {escape_html(flow.get('state', ''))}\n"
        f"<b>Reason:</b> {escape_html(flow.get('reason', ''))}"
    )


def format_suricata_event(evt: dict) -> str:
    event_type = evt.get("event_type", "")
    if event_type == "dns":
        return format_suricata_dns(evt)
    if event_type == "alert":
        return format_suricata_alert(evt)
    if event_type == "http":
        return format_suricata_http(evt)
    if event_type == "tls":
        return format_suricata_tls(evt)
    if event_type == "flow":
        return format_suricata_flow(evt)

    return (
        f"<b>Suricata Event</b>\n"
        f"<b>Type:</b> {escape_html(event_type)}\n"
        f"<code>{escape_html(json.dumps(evt, ensure_ascii=False))}</code>"
    )


# =========================
# PFSENSE FILTERLOG PARSER
# =========================
def extract_filterlog_line(line: str):
    """
    Ví dụ:
    <134>Apr 20 23:47:26 filterlog[22900]: 4,,,1000000103,em0,match,block,in,4,0x0,,48,34691,0,none,6,tcp,44,192.168.75.134,192.168.75.242,45065,21,0,S,4122395639,,1024,,mss
    """
    m = re.search(r'filterlog\[\d+\]:\s*(.*)$', line)
    if not m:
        return None

    payload = m.group(1).strip()
    parts = [p.strip() for p in payload.split(",")]

    result = {
        "raw": line,
        "type": "filterlog",
        "rule": "",
        "interface": "",
        "reason": "",
        "action": "",
        "direction": "",
        "ip_version": "",
        "proto_id": "",
        "proto_text": "",
        "src_ip": "",
        "dst_ip": "",
        "src_port": "",
        "dst_port": "",
        "tcp_flags": "",
    }

    try:
        # Mapping gần đúng cho mẫu IPv4 thường thấy
        # 0=sub_rule,1=anchor,2=tracker?,3=rule,4=iface,5=reason,6=action,7=direction,8=ipver...
        result["rule"] = parts[3] if len(parts) > 3 else ""
        result["interface"] = parts[4] if len(parts) > 4 else ""
        result["reason"] = parts[5] if len(parts) > 5 else ""
        result["action"] = parts[6] if len(parts) > 6 else ""
        result["direction"] = parts[7] if len(parts) > 7 else ""
        result["ip_version"] = parts[8] if len(parts) > 8 else ""
        result["proto_id"] = parts[15] if len(parts) > 15 else ""
        result["proto_text"] = parts[16] if len(parts) > 16 else ""
        result["src_ip"] = parts[18] if len(parts) > 18 else ""
        result["dst_ip"] = parts[19] if len(parts) > 19 else ""
        result["src_port"] = parts[20] if len(parts) > 20 else ""
        result["dst_port"] = parts[21] if len(parts) > 21 else ""
        result["tcp_flags"] = parts[23] if len(parts) > 23 else ""
    except Exception:
        return None

    if not result["src_ip"] or not result["dst_ip"]:
        return None

    return result


def should_send_filterlog(flt: dict) -> bool:
    if ONLY_SEND_FILTERLOG_BLOCK:
        return flt.get("action", "").lower() == "block"
    return True


def filterlog_dedup_key(flt: dict) -> str:
    return (
        f"filterlog:{flt.get('action','')}:{flt.get('interface','')}:"
        f"{flt.get('src_ip','')}:{flt.get('src_port','')}:"
        f"{flt.get('dst_ip','')}:{flt.get('dst_port','')}:"
        f"{flt.get('proto_text','')}"
    )


def format_filterlog_telegram(flt: dict) -> str:
    return (
        f"<b>pfSense FILTERLOG</b>\n"
        f"<b>Action:</b> {escape_html(flt.get('action', ''))}\n"
        f"<b>Interface:</b> {escape_html(flt.get('interface', ''))}\n"
        f"<b>Direction:</b> {escape_html(flt.get('direction', ''))}\n"
        f"<b>Protocol:</b> {escape_html(flt.get('proto_text', ''))}\n"
        f"<b>Source:</b> <code>{escape_html(flt.get('src_ip', ''))}:{escape_html(flt.get('src_port', ''))}</code>\n"
        f"<b>Destination:</b> <code>{escape_html(flt.get('dst_ip', ''))}:{escape_html(flt.get('dst_port', ''))}</code>\n"
        f"<b>Rule:</b> <code>{escape_html(flt.get('rule', ''))}</code>\n"
        f"<b>Reason:</b> {escape_html(flt.get('reason', ''))}\n"
        f"<b>Flags:</b> {escape_html(flt.get('tcp_flags', ''))}"
    )


# =========================
# UDP SERVER
# =========================
class SyslogUDPHandler(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            data = self.request[0].strip()
            line = data.decode("utf-8", errors="replace")
            raw_logger.info(line)

            # 1) thử parse Suricata JSON
            evt = extract_json_from_syslog(line)
            if evt:
                event_type = evt.get("event_type", "unknown")
                logger.info(
                    "Nhận Suricata event_type=%s src=%s dst=%s",
                    event_type, evt.get("src_ip", ""), evt.get("dest_ip", "")
                )

                if not should_send_suricata(evt):
                    return

                dedup = suricata_dedup_key(evt)
                if add_recent_key(dedup):
                    logger.info("Bỏ log Suricata trùng")
                    return

                text = format_suricata_event(evt)
                telegram_queue.put(text)
                return

            # 2) thử parse pfSense filterlog
            flt = extract_filterlog_line(line)
            if flt:
                logger.info(
                    "Nhận filterlog action=%s src=%s dst=%s dport=%s",
                    flt.get("action", ""),
                    flt.get("src_ip", ""),
                    flt.get("dst_ip", ""),
                    flt.get("dst_port", ""),
                )

                if not should_send_filterlog(flt):
                    return

                dedup = filterlog_dedup_key(flt)
                if add_recent_key(dedup):
                    logger.info("Bỏ filterlog trùng")
                    return

                text = format_filterlog_telegram(flt)
                telegram_queue.put(text)
                return

            logger.warning("Không parse được log: %s", line[:300])

        except Exception as e:
            logger.exception("Handler error: %s", e)


class ThreadedUDPServer(socketserver.ThreadingMixIn, socketserver.UDPServer):
    allow_reuse_address = True


def main():
    worker = threading.Thread(target=telegram_worker, daemon=True)
    worker.start()

    server = ThreadedUDPServer((LISTEN_HOST, LISTEN_PORT), SyslogUDPHandler)
    logger.info("Đang lắng nghe syslog UDP tại %s:%s", LISTEN_HOST, LISTEN_PORT)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Dừng server")
    finally:
        server.shutdown()
        server.server_close()
        telegram_queue.put(None)


if __name__ == "__main__":
    main()
