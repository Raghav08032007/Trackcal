"""Package an explicit source allowlist without Git metadata, secrets, uploads or installed runtimes."""
import argparse
import hashlib
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo

TREE_RULES={
    "backend/routers":{'.py'},"backend/services":{'.py'},"backend/scripts":{'.py'},
    "backend/tests":{'.py','.png','.wav'},"backend/migrations":{'.sql'},
    "frontend/web/src":{'.ts','.tsx','.css','.svg','.ico'},
    "frontend/web/tests":{'.ts','.tsx','.mjs','.json'},
    "frontend/web/public":{'.svg','.png','.ico','.csv','.js','.json','.webmanifest'},
    "infrastructure":{'.sh','.md'},"docs":{'.md'},".github/workflows":{'.yml','.yaml'},
}
FILES={"README.md","compose.production.yml","compose.integrations.yml",".env.production.example",
       "backend/Dockerfile","backend/Dockerfile.ocr","backend/.dockerignore","backend/.env.example","backend/integrations.env.example",
       "frontend/web/Dockerfile","frontend/web/.dockerignore","frontend/web/package.json","frontend/web/package-lock.json",
       "frontend/web/tsconfig.json","frontend/web/next.config.ts","frontend/web/next-env.d.ts",
       "frontend/web/postcss.config.mjs","frontend/web/eslint.config.mjs","frontend/web/vitest.config.ts","frontend/web/vitest.config.mts",
       "infrastructure/Caddyfile"}

def source_files(root):
    root=Path(root).resolve()
    candidates=set(FILES)
    for pattern in ("backend/*.py","backend/requirements*.txt"):
        candidates.update(path.relative_to(root).as_posix() for path in root.glob(pattern))
    for directory,extensions in TREE_RULES.items():
        base=root/directory
        if base.exists():
            for path in base.rglob('*'):
                if path.suffix in extensions and not any(part.startswith('.') or part=='__pycache__' for part in path.relative_to(base).parts):
                    candidates.add(path.relative_to(root).as_posix())
    for name in sorted(candidates):
        path=root/name
        # Reject links/junctions in any component, even if they resolve inside the source tree.
        if any(part.is_symlink() or getattr(part,'is_junction',lambda:False)() for part in (path,*path.parents) if part!=root):
            continue
        if path.is_file() and path.resolve().is_relative_to(root): yield name,path

def package_source(root,output):
    root=Path(root).resolve();output=Path(output).resolve()
    if output.exists(): raise ValueError("Output already exists. Choose a new archive path.")
    files=list(source_files(root))
    required={'frontend/web/package-lock.json','frontend/web/src/app/page.tsx','backend/main.py','compose.production.yml'}
    if not required.issubset({name for name,_ in files}): raise ValueError("Required application source is missing.")
    output.parent.mkdir(parents=True,exist_ok=True)
    manifest=[]
    try:
        with ZipFile(output,'x',compression=ZIP_DEFLATED) as archive:
            for name,path in files:
                data=path.read_bytes();manifest.append(f'{hashlib.sha256(data).hexdigest()}  {name}')
                info=ZipInfo(name,date_time=(2026,1,1,0,0,0));info.compress_type=ZIP_DEFLATED
                archive.writestr(info,data)
            archive.writestr('SOURCE_MANIFEST.sha256','\n'.join(manifest)+'\n')
        verify_source(output)
    except Exception:
        output.unlink(missing_ok=True)
        raise
    return len(files)

def verify_source(path):
    with ZipFile(path) as archive:
        if archive.testzip(): raise ValueError('Archive integrity check failed.')
        for line in archive.read('SOURCE_MANIFEST.sha256').decode().splitlines():
            digest,name=line.split('  ',1)
            if hashlib.sha256(archive.read(name)).hexdigest()!=digest: raise ValueError('Source digest mismatch.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    count=package_source(Path(__file__).resolve().parents[2],args.output)
    print(f'Packaged and hash-verified {count} source files. No deployment or publication performed.')

if __name__=='__main__': main()
