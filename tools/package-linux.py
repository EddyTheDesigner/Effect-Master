"""Package the Linux x64 preview on any build host. Python 3, no third-party modules."""
import hashlib
import io
import pathlib
import tarfile
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = "0.4.0"
ELECTRON = "45.0.0"
NAME = f"electron-v{ELECTRON}-linux-x64.zip"
BASE = f"https://github.com/electron/electron/releases/download/v{ELECTRON}/"
CACHE = ROOT / "build-tools" / "electron"
CACHE.mkdir(parents=True, exist_ok=True)

def download(name):
    target = CACHE / name
    if not target.exists():
        request = urllib.request.Request(BASE + name, headers={"User-Agent": "Effect-Master-build"})
        with urllib.request.urlopen(request, timeout=120) as source, target.with_suffix(".partial").open("wb") as out:
            while block := source.read(1024 * 1024):
                out.write(block)
        target.with_suffix(".partial").replace(target)
    return target

checksums = download("SHASUMS256.txt").read_text()
expected = next(line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip("*") == NAME)
archive = download(NAME)
actual = hashlib.file_digest(archive.open("rb"), "sha256").hexdigest()
if actual != expected:
    raise RuntimeError("Electron checksum mismatch; refusing to package")
output = ROOT / "releases" / f"Effect-Master-{VERSION}-Linux-x64-preview.tar.gz"
output.parent.mkdir(exist_ok=True)
prefix = f"Effect-Master-{VERSION}-Linux-x64"

with tarfile.open(output, "w:gz") as package:
    def add(name, data, mode=0o644):
        entry = tarfile.TarInfo(prefix + "/" + name)
        entry.size, entry.mode, entry.mtime = len(data), mode, 0
        package.addfile(entry, io.BytesIO(data))

    with zipfile.ZipFile(archive) as runtime:
        for entry in runtime.infolist():
            name = entry.filename
            if entry.is_dir() or name == "resources/default_app.asar":
                continue
            if name.startswith("/") or ".." in pathlib.PurePosixPath(name).parts:
                raise RuntimeError("Invalid runtime archive path")
            mode = (entry.external_attr >> 16) & 0o777
            if name in ("electron", "chrome-sandbox", "chrome_crashpad_handler"):
                mode = 0o755
            add("effect-master" if name == "electron" else name, runtime.read(entry), mode or 0o644)
    for source in sorted((ROOT / "linux").iterdir()):
        if source.is_file():
            add("resources/app/" + source.name, source.read_bytes())
    add("resources/app/Effect Master Core.js", (ROOT / "dist/Effect Master Core.js").read_bytes())
    add("README.md", (ROOT / "docs/LINUX.md").read_bytes())
    add("USER-GUIDE.md", (ROOT / "README.md").read_bytes())
print(f"Packaged {output.name} ({output.stat().st_size:,} bytes)")
print(f"Electron {ELECTRON} official SHA-256 verified: {actual}")
