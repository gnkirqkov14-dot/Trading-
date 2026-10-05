"""Обща HTTP сесия: User-Agent, повторни опити и пауза между заявките,
за да не натоварваме общинските сайтове."""
import time

import requests

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36 construction-leads/0.1"
)


class Http:
    def __init__(self, delay: float = 0.4, retries: int = 3, timeout: int = 60):
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.delay = delay
        self.retries = retries
        self.timeout = timeout
        self._last = 0.0

    def request(self, method: str, url: str, **kw) -> requests.Response:
        kw.setdefault("timeout", self.timeout)
        for attempt in range(self.retries):
            wait = self.delay - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()
            try:
                resp = self.session.request(method, url, **kw)
                if resp.status_code < 500:
                    resp.raise_for_status()
                    return resp
            except requests.ConnectionError:
                if attempt == self.retries - 1:
                    raise
            time.sleep(2 ** (attempt + 1))
        resp.raise_for_status()
        return resp

    def get(self, url: str, **kw) -> requests.Response:
        return self.request("GET", url, **kw)

    def post(self, url: str, **kw) -> requests.Response:
        return self.request("POST", url, **kw)
