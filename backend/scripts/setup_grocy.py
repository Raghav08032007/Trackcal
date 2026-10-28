"""Optional portable Grocy service for Windows; downloads official vendor releases."""
import hashlib
import json
from pathlib import Path
import zipfile
import shutil
import requests

runtime = Path(__file__).resolve().parents[1] / "runtime"
runtime.mkdir(exist_ok=True)
session = requests.Session()
session.headers["User-Agent"] = "TrackCal-Local-Setup/1.0"
def download(url, target, checksum=None):
    if not target.exists():
        temp = target.with_suffix(".part")
        with session.get(url, stream=True, timeout=(15, 120)) as response:
            response.raise_for_status()
            with temp.open("wb") as output:
                for chunk in response.iter_content(1024 * 1024): output.write(chunk)
        temp.replace(target)
    if checksum and hashlib.file_digest(target.open("rb"), "sha256").hexdigest() != checksum:
        raise RuntimeError("Official archive checksum mismatch; no extraction performed")
def extract(archive, destination):
    destination.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as package:
        for item in package.infolist():
            if not (destination / item.filename).resolve().is_relative_to(destination.resolve()): raise RuntimeError("Unsafe archive path")
        package.extractall(destination)
metadata = session.get("https://windows.php.net/downloads/releases/releases.json", timeout=20)
metadata.raise_for_status()
php = metadata.json()["8.5"]["nts-vs17-x64"]["zip"]
download("https://windows.php.net/downloads/releases/" + php["path"], runtime / "php.zip", php["sha256"])
extract(runtime / "php.zip", runtime / "php")
download("https://github.com/grocy/grocy/releases/download/v4.7.1/grocy_4.7.1.zip", runtime / "grocy.zip")
extract(runtime / "grocy.zip", runtime / "grocy")
configuration = runtime / "grocy" / "data" / "config.php"
if not configuration.exists(): shutil.copyfile(runtime / "grocy" / "config-dist.php", configuration)
(runtime / "php" / "php.ini").write_text('extension_dir="ext"\n' + '\n'.join('extension=' + name for name in ['pdo_sqlite','sqlite3','mbstring','gd','intl','fileinfo','curl','openssl','zip']) + '\ndate.timezone=Asia/Kolkata\n')
(runtime / "grocy-router.php").write_text('''<?php
$root = __DIR__ . '/grocy/public';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = realpath($root . $path);
if ($file !== false && str_starts_with($file, realpath($root) . DIRECTORY_SEPARATOR) && is_file($file)) return false;
require $root . '/index.php';
''')
(runtime / "grocy-manifest.json").write_text(json.dumps({"source":"https://github.com/grocy/grocy","version":"4.7.1","php_archive":php["path"],"php_sha256":php["sha256"]},indent=2))
print("Portable Grocy installed. Start from backend: runtime/php/php.exe -c runtime/php/php.ini -S 127.0.0.1:9283 -t runtime/grocy/public runtime/grocy-router.php")
