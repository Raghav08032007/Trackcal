"""Prepare a meal photo before it leaves our server for the AI provider.

The browser already shrinks photos and drops metadata; this repeats it on the server so an old client or a direct
request can't send a full-size photo with EXIF (GPS location, device, time) to a third party.
- decodes the image (rejects anything Pillow can't read, or whose content doesn't match its declared type)
- refuses decompression bombs before decoding pixels
- applies the EXIF orientation, then drops all metadata
- longest side at most 1024 px, re-encoded as JPEG
Nothing is written to disk.
"""
import base64
import io

from PIL import Image, ImageOps

MAX_SIDE = 1024
MAX_PIXELS = 40_000_000  # ~8000 x 5000; larger is refused before decoding
FORMATS = {'jpeg': 'JPEG', 'png': 'PNG', 'webp': 'WEBP'}


class PhotoError(ValueError):
    pass


def prepare(data_url: str) -> str:
    """'data:image/<kind>;base64,...' -> 'data:image/jpeg;base64,...' (resized, no metadata)."""
    try:
        kind = data_url[len('data:image/'):data_url.index(';')]
        raw = base64.b64decode(data_url.split(',', 1)[1], validate=True)
    except (ValueError, IndexError):
        raise PhotoError('The file is not a valid supported image under 10 MB.')
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format != FORMATS.get(kind): raise PhotoError('The file is not a valid supported image under 10 MB.')
            width, height = image.size
            if width * height > MAX_PIXELS: raise PhotoError('This photo has too many pixels. Use a normal phone photo.')
            image = ImageOps.exif_transpose(image)
            image = image.convert('RGB')
            image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            image.save(output, 'JPEG', quality=85, optimize=True)  # no exif= argument: metadata is not written
    except PhotoError:
        raise
    except Exception:
        raise PhotoError('The file is not a valid supported image under 10 MB.')
    return 'data:image/jpeg;base64,' + base64.b64encode(output.getvalue()).decode()
