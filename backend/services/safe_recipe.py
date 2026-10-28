"""Bounded HTTPS recipe fetches with DNS pinning; no private-network requests."""
import ipaddress
import socket
import ssl
from urllib.parse import urlparse, urljoin
import certifi
import urllib3
from flask_app.params import HTTPException

MAX_HTML = 2_000_000

def public_target(url: str):
    try:
        parsed = urlparse(url)
        valid = parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password and parsed.port in (None, 443)
    except ValueError:
        valid = False
    if not valid:
        raise HTTPException(422, "Use a public HTTPS recipe URL without credentials or a custom port")
    try:
        addresses = sorted({item[4][0] for item in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)})
    except OSError:
        raise HTTPException(422, "Recipe hostname could not be resolved")
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise HTTPException(422, "Private, local and reserved network addresses are not allowed")
    return parsed, addresses[0]

def fetch_recipe_html(url: str):
    for _ in range(4):
        parsed, address = public_target(url)
        pool = urllib3.HTTPSConnectionPool(address, port=443, server_hostname=parsed.hostname, assert_hostname=parsed.hostname,
            cert_reqs=ssl.CERT_REQUIRED, ca_certs=certifi.where(), timeout=urllib3.Timeout(connect=5, read=10))
        response = None
        try:
            target = parsed.path or "/"
            if parsed.query: target += "?" + parsed.query
            response = pool.urlopen("GET", target, headers={"Host": parsed.hostname, "User-Agent": "TrackCal/1.0 (user-requested recipe import)", "Accept": "text/html", "Accept-Encoding": "identity"},
                redirect=False, preload_content=False, retries=False)
            if response.status in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location: raise HTTPException(422, "Recipe redirect is missing a destination")
                url = urljoin(url, location)
                continue
            if response.status != 200: raise HTTPException(422, "The recipe website did not allow this import. Paste the ingredients instead.")
            if "html" not in response.headers.get("Content-Type", "").lower():
                raise HTTPException(422, "The URL must point to an HTML recipe page")
            content = response.read(MAX_HTML + 1)
            if len(content) > MAX_HTML: raise HTTPException(413, "Recipe page exceeds the 2 MB limit")
            return content.decode("utf-8", errors="replace"), url
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(502, "Could not retrieve the recipe securely. Paste its ingredients instead.")
        finally:
            if response: response.close()
            pool.close()
    raise HTTPException(422, "Recipe has too many redirects")
