from zipfile import ZipFile
import pytest
from scripts.package_source import package_source,verify_source

def test_packaged_source_includes_embedded_frontend_but_excludes_private_runtime(tmp_path):
    root=tmp_path/'project'
    fixtures={
        'frontend/web/package-lock.json':'{}','frontend/web/src/app/page.tsx':'export default function Page(){}',
        'backend/main.py':'print("application")','compose.production.yml':'services: {}',
        'frontend/web/.env.local':'private-provider-key','backend/.env':'private-db-password',
        'backend/uploads/private.png':'private-upload','frontend/web/node_modules/private.js':'dependency',
        'frontend/web/.git/config':'private-remote','backend/services/.env':'private-env',
    }
    for name,data in fixtures.items():
        path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(data)
    output=tmp_path/'source.zip'; assert package_source(root,output)==4
    verify_source(output)
    with ZipFile(output) as archive:
        names=archive.namelist()
        assert 'frontend/web/src/app/page.tsx' in names
        assert 'SOURCE_MANIFEST.sha256' in names
        assert not any('.env' in name or '.git' in name or 'uploads' in name or 'node_modules' in name for name in names)
        assert not any(b'private-' in archive.read(name) for name in names)
    with pytest.raises(ValueError): package_source(root,output)
