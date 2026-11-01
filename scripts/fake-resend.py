"""A stand-in for Resend, for trying the waitlist emails on a Mac with no real mail (INT-163).

    python3 scripts/fake-resend.py

The Edge Functions post to it when RESEND_API_URL=http://host.docker.internal:8787/emails (see supabase/README.md,
Waitlist). Each message goes into the local Supabase inbox at http://127.0.0.1:54324, the same way Resend would deliver
it, including the List-Unsubscribe headers. A second request with an idempotency key it has already seen is accepted
and dropped, as Resend does. It only ever talks to the local inbox, never to the internet.
"""

import json
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

INBOX = 'http://127.0.0.1:54324/api/v1/send'
PORT = 8787
seen_keys = set()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('content-length', 0))))
        key = self.headers.get('idempotency-key')
        if key and key in seen_keys:
            print(f'dropped a repeat of {key}')
        else:
            if key:
                seen_keys.add(key)
            message = {
                'From': {'Email': body['from'].split('<')[-1].rstrip('>'), 'Name': 'Intus'},
                'To': [{'Email': address} for address in body['to']],
                'Subject': body['subject'],
                'Text': body['text'],
                'HTML': body['html'],
                'Headers': body.get('headers', {}),
            }
            request = urllib.request.Request(INBOX, data=json.dumps(message).encode(),
                                             headers={'content-type': 'application/json'}, method='POST')
            urllib.request.urlopen(request).read()
            print(f"delivered '{body['subject']}' to the local inbox")
        self.send_response(200)
        self.send_header('content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"id":"local"}')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    # 0.0.0.0 so the Edge Functions, which run in Docker, can reach it through host.docker.internal
    print(f'Standing in for Resend on port {PORT}. Mail goes to http://127.0.0.1:54324')
    HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
