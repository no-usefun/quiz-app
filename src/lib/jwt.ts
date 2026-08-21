const JWT_SECRET = "quizly-super-secret-key-change-in-prod";


function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJWT(payload: any, secret: string = JWT_SECRET): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  
  const key = await getCryptoKey(secret);
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
    
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string = JWT_SECRET): Promise<any | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  try {
    const key = await getCryptoKey(secret);
    const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    
    // Decode signature
    const signatureBin = new Uint8Array(
      atob(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    
    const isValid = await crypto.subtle.verify("HMAC", key, signatureBin, data);
    if (!isValid) return null;
    
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}
