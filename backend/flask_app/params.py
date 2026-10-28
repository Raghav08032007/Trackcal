"""Parameter markers, errors and auth helpers that handlers declare in their signatures.

`Query/Form/File/Path` return Pydantic FieldInfo objects (so constraints such as ge, le and max_length
validate exactly as before), `Depends` names a dependency, and flask_app.binding binds all of them.
"""
from http import HTTPStatus
from types import SimpleNamespace

from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

from flask_app.errors import ApiError as HTTPException  # noqa: F401  (raise HTTPException(status, detail))

status = SimpleNamespace(**{f'HTTP_{code.value}_{code.name}': code.value for code in HTTPStatus})


class QueryInfo(FieldInfo): pass
class FormInfo(FieldInfo): pass
class FileInfo(FieldInfo): pass
class PathInfo(FieldInfo): pass


def _marker(kind, default, constraints):
    # Construct the subclass directly: FieldInfo.from_field() returns a plain FieldInfo and loses the marker type.
    return kind(default=PydanticUndefined if default is ... else default, **constraints)


def Query(default=PydanticUndefined, **constraints): return _marker(QueryInfo, default, constraints)
def Form(default=PydanticUndefined, **constraints): return _marker(FormInfo, default, constraints)
def File(default=PydanticUndefined, **constraints): return _marker(FileInfo, default, constraints)
def Path(default=PydanticUndefined, **constraints): return _marker(PathInfo, default, constraints)


class Depends:
    def __init__(self, dependency=None):
        self.dependency = dependency


class Request:
    """Annotation marker: the binder passes an object with .url.path, .headers, .client.host and .method."""


class UploadFile:
    """Annotation marker: the binder passes an upload with .filename, .content_type and async read()."""


def bearer_token(request: Request) -> str:
    scheme, _, token = request.headers.get('Authorization', '').partition(' ')
    if scheme.lower() != 'bearer' or not token:
        raise HTTPException(401, 'Not authenticated', {'WWW-Authenticate': 'Bearer'})
    return token


class OAuth2PasswordRequestForm:
    """The OAuth2 password-grant form fields (application/x-www-form-urlencoded)."""
    def __init__(self, username: str = Form(), password: str = Form(), grant_type: str | None = Form(None),
                 scope: str = Form(''), client_id: str | None = Form(None), client_secret: str | None = Form(None)):
        self.username, self.password, self.grant_type = username, password, grant_type
        self.scopes, self.client_id, self.client_secret = scope.split(), client_id, client_secret
