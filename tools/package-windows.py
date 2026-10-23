"""Package only the Windows runtime and public documentation. Build the palette first."""
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
files = [
    "README.md", "Install.cmd", "Install.ps1", "Uninstall.ps1",
    "docs/VALIDATION.md", "docs/LINUX.md",
    "dist/Effect Master.exe", "dist/Setup Effect Master.exe",
    "dist/Effect Master.jsx", "dist/Effect Master Core.js",
]
for name in files:
    if not (root / name).is_file():
        raise RuntimeError(f"Missing release component: {name}")
output = root / "releases/Effect-Master-0.4.0-Windows.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    for name in files:
        package.write(root / name, name)
print(f"Packaged {output.name} ({output.stat().st_size:,} bytes)")
