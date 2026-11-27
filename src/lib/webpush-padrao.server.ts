/* Web Push no padrão atual (RFC 8291 aes128gcm + RFC 8292 VAPID), só com WebCrypto.
   Funciona com o push da Apple (iPhone/Mac), do Google (Android/Chrome), Mozilla e Microsoft. */

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}
function deB64url(s: string): Bytes {
  return new Uint8Array(Buffer.from(s, "base64url"));
}
function juntar(...partes: Uint8Array[]): Bytes {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

type Bytes = Uint8Array<ArrayBuffer>;

async function hkdf(sal: Bytes, ikm: Bytes, info: Bytes, bytes: number) {
  const chave = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: sal, info },
      chave,
      bytes * 8,
    ),
  );
}

/** Par de chaves VAPID novo: pública crua (65 bytes) e privada PKCS#8, em base64url. */
export async function gerarChavesVapid() {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const publica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const privada = new Uint8Array(await crypto.subtle.exportKey("pkcs8", par.privateKey));
  return { publica: b64url(publica), privada: b64url(privada) };
}

/** Criptografa a mensagem para o aparelho (RFC 8291, um registro aes128gcm). */
export async function criptografar(mensagem: string, p256dh: string, auth: string) {
  const uaPublica = deB64url(p256dh);
  const segredoAuth = deB64url(auth);
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const chaveUa = await crypto.subtle.importKey(
    "raw",
    uaPublica,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const segredoEcdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: chaveUa }, par.privateKey, 256),
  );
  const infoChave = juntar(enc.encode("WebPush: info\0"), uaPublica, asPublica);
  const ikm = await hkdf(segredoAuth, segredoEcdh, infoChave, 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const chave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // Último (e único) registro: mensagem + delimitador 0x02, sem preenchimento.
  const claro = juntar(enc.encode(mensagem), new Uint8Array([2]));
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, chave, claro),
  );
  const cabecalho = new Uint8Array(16 + 4 + 1 + asPublica.length);
  cabecalho.set(sal, 0);
  new DataView(cabecalho.buffer).setUint32(16, 4096);
  cabecalho[20] = asPublica.length;
  cabecalho.set(asPublica, 21);
  return juntar(cabecalho, cifrado);
}

/** Cabeçalho de autorização VAPID (RFC 8292): JWT ES256 assinado com a chave privada. */
export async function autorizacaoVapid(
  endpoint: string,
  chaves: { publica: string; privada: string },
  contato: string,
) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const cab = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64url(
    enc.encode(
      JSON.stringify({
        aud,
        exp,
        sub: contato.startsWith("mailto:") ? contato : `mailto:${contato}`,
      }),
    ),
  );
  const privada = await crypto.subtle.importKey(
    "pkcs8",
    deB64url(chaves.privada),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privada,
      enc.encode(`${cab}.${corpo}`),
    ),
  );
  return `vapid t=${cab}.${corpo}.${b64url(assinatura)}, k=${chaves.publica}`;
}

/** Monta o POST para o serviço de push do aparelho. */
export async function montarPush(opcoes: {
  endpoint: string;
  p256dh: string;
  auth: string;
  mensagem: string;
  chaves: { publica: string; privada: string };
  contato: string;
  ttl: number;
  urgencia: "very-low" | "low" | "normal" | "high";
}) {
  const corpo = await criptografar(opcoes.mensagem, opcoes.p256dh, opcoes.auth);
  return {
    endpoint: opcoes.endpoint,
    init: {
      method: "POST",
      headers: {
        Authorization: await autorizacaoVapid(opcoes.endpoint, opcoes.chaves, opcoes.contato),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opcoes.ttl),
        Urgency: opcoes.urgencia,
      },
      body: corpo,
    } satisfies RequestInit,
  };
}
