export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export function notFound(): Response {
  return jsonResponse({ code: 404, msg: 'not found' }, 404);
}
