"""Bounded JSON HTTP transport; redirects cannot carry bearer credentials."""
import ipaddress
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler


def origin(value):
    parsed = urlsplit(value)
    loopback = parsed.hostname == 'localhost'
    try:
        loopback = loopback or ipaddress.ip_address(parsed.hostname).is_loopback
    except (ValueError, TypeError):
        pass
    if (parsed.scheme != 'https' and not (parsed.scheme == 'http' and loopback)) or not parsed.hostname:
        raise ValueError('Server must use HTTPS; only loopback may use HTTP.')
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('Server must be an origin without credentials, path, query or fragment.')
    return value.rstrip('/')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(server, token, method, path, body=None, content_type="application/json"):
    data = body if isinstance(body, bytes) else None if body is None else json.dumps(body, sort_keys=True, separators=(',', ':')).encode()
    req = Request(server + path, data=data, method=method,
                  headers={'Authorization': 'Bearer ' + token, 'Content-Type': content_type, 'User-Agent': 'HappyToHelp-Agent/0.1'})
    try:
        with build_opener(NoRedirect).open(req, timeout=25) as response:
            return json.loads(response.read(4 * 1024 * 1024))
    except HTTPError as error:
        # Server response bodies and URLs can contain credentials or hostile content.
        raise RuntimeError('Server rejected request (HTTP %d); pending state retained.' % error.code) from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise RuntimeError('Response unavailable or invalid; pending state retained. Retry the exact submission.') from None
