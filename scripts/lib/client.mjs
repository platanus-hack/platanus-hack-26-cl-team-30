// Cliente HTTP y SSE mínimo, compartido por scripts/e2e.mjs y scripts/load-test.mjs.
// Solo usa lo que trae Node 20: fetch y streams. No hay navegador ni dependencias.

/** Separa argumentos posicionales de banderas "--clave valor" o "--clave". */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else flags[key] = argv[++i];
    } else positional.push(argv[i]);
  }
  return { flags, positional };
}

/** true si el host es esta máquina o una red privada. */
export function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname);
}

/**
 * Petición HTTP que nunca lanza por un status de error: devuelve
 * { status, ok, data, text } para que quien llama pueda comprobar 401, 403, 409...
 * headers se agrega a la petición (por ejemplo, x-host-token).
 */
export async function request(baseUrl, method, path, body, headers = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Respuesta que no es JSON (por ejemplo, el acta en markdown).
  }
  return { status: res.status, ok: res.ok, data, text, contentType: res.headers.get("content-type") ?? "" };
}

/**
 * Abre una conexión SSE. Llama a onMessage(objeto, instante, textoCrudo) por cada
 * mensaje "data:". La promesa se resuelve con el primer mensaje y se rechaza si
 * la conexión falla antes de recibirlo. Se cierra con abort.abort().
 */
export function openStream(url, onMessage, abort) {
  return new Promise((resolve, reject) => {
    let first = true;
    fetch(url, { signal: abort.signal, headers: { Accept: "text/event-stream" } })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`SSE respondió ${res.status}`);
        const decoder = new TextDecoder();
        let buffer = "";
        for await (const chunk of res.body) {
          buffer += decoder.decode(chunk, { stream: true }).replaceAll("\r\n", "\n");
          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const data = raw
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).replace(/^ /, ""))
              .join("\n");
            if (!data) continue; // comentario de latido (": ping")
            const at = performance.now();
            const message = JSON.parse(data);
            onMessage(message, at, data);
            if (first) {
              first = false;
              resolve(message);
            }
          }
        }
        if (first) throw new Error("La conexión SSE se cerró sin enviar ningún mensaje");
      })
      .catch((error) => {
        if (first) reject(error);
      });
  });
}

export function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export const fmtMs = (ms) => (Number.isFinite(ms) ? `${ms.toFixed(1)} ms` : "-");

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
