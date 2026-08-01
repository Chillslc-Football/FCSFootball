// DISABLED: public token review is replaced by authenticated Media Admin.
// Deploy remains safe (returns 410) so old email links fail closed.
// Active admin: https://admin.fcspulse.com/suggestions/{id}
// Outcome emails: admin-media-notify (authenticated)

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

Deno.serve(() =>
  new Response(
    JSON.stringify({
      ok: false,
      error: 'gone',
      message:
        'Token review links are no longer active. Sign in at https://admin.fcspulse.com to manage media suggestions.',
    }),
    { status: 410, headers: HEADERS },
  ),
);
