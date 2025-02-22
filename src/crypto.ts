import {webcrypto} from "crypto";

// #############
// ### Utils ###
// #############

// Function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

// Generates a pair of private / public RSA keys
type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};
export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  //      implement this function using the crypto package to generate a public and private RSA key pair.
  //      the public key should be used for encryption and the private key for decryption. Make sure the
  //      keys are extractable.
  const {
    publicKey,
    privateKey,
  } = await webcrypto.subtle.generateKey({
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: {name: "SHA-256"},
  }, true, ['encrypt', 'decrypt']);

  //return { publicKey: {publicKey} as any, privateKey: {privateKey} as any };
  return { publicKey, privateKey };
  // remove this
  //return { publicKey: {} as any, privateKey: {} as any };
}

// Export a crypto public key to a base64 string format
export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  // implement this function to return a base64 string version of a public key
  const exportedKey = await webcrypto.subtle.exportKey('spki', key);
  return arrayBufferToBase64(exportedKey);
}

// Export a crypto private key to a base64 string format
export async function exportPrvKey(key: webcrypto.CryptoKey | null): Promise<string | null> {
  // implement this function to return a base64 string version of a private key
  if (!key) return null;
  const exportedKey = await webcrypto.subtle.exportKey('pkcs8', key);
  return arrayBufferToBase64(exportedKey);
}

// Import a base64 string public key to its native format
export async function importPubKey(strKey: string): Promise<webcrypto.CryptoKey> {
  // implement this function to go back from the result of the exportPubKey function to its native crypto key object
  const keyBuffer = base64ToArrayBuffer(strKey);

  // Import the public key in SPKI format
  return await webcrypto.subtle.importKey(
      "spki",
      keyBuffer,
      {
        name: "RSA-OAEP",
        hash: { name: "SHA-256" },
      },
      true,
      ["encrypt"]
  );
}

// Import a base64 string private key to its native format
export async function importPrvKey(strKey: string): Promise<webcrypto.CryptoKey> {
  // implement this function to go back from the result of the exportPrvKey function to its native crypto key object
  const keyBuffer = base64ToArrayBuffer(strKey);

  // Import the private key in PKCS format
  return await webcrypto.subtle.importKey(
      "pkcs8",
      keyBuffer,
      {
        name: "RSA-OAEP",
        hash: { name: "SHA-256" },
      },
      true,
      ["decrypt"]
  );
}

// Encrypt a message using an RSA public key
export async function rsaEncrypt(b64Data: string, strPublicKey: string): Promise<string> {
  // implement this function to encrypt a base64 encoded message with a public key
  // tip: use the provided base64ToArrayBuffer function
  const messageBuffer = base64ToArrayBuffer(b64Data);
  const publicKey = await importPubKey(strPublicKey);

  const encryptedBuffer = await webcrypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      messageBuffer
  );

  return arrayBufferToBase64(encryptedBuffer);
}

// Decrypts a message using an RSA private key
export async function rsaDecrypt(data: string, privateKey: webcrypto.CryptoKey): Promise<string> {
  // implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function
  const messageBuffer = base64ToArrayBuffer(data);

  const decryptedBuffer = await webcrypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      messageBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

// ######################
// ### Symmetric keys ###
// ######################

// Generates a random symmetric key
export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  //      implement this function using the crypto package to generate a symmetric key.
  //      the key should be used for both encryption and decryption. Make sure the
  //      keys are extractable.
  return await webcrypto.subtle.generateKey(
      {
        name: "AES-CBC",
        length: 256,
      },
      true, // extractable
      ["encrypt", "decrypt"]
  );
}

// Export a crypto symmetric key to a base64 string format
export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  // implement this function to return a base64 string version of a symmetric key
  const exportedKey = await webcrypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exportedKey);
}

// Import a base64 string format to its crypto native format
export async function importSymKey(strKey: string): Promise<webcrypto.CryptoKey> {
  // implement this function to go back from the result of the exportSymKey function to its native crypto key object
  const keyBuffer = base64ToArrayBuffer(strKey);

  // Import the key in raw format
  return await webcrypto.subtle.importKey(
      "raw",
      keyBuffer,
      {
        name: "AES-CBC",
        length: 256,
      },
      true,
      ["encrypt","decrypt"]
  );
}

// Encrypt a message using a symmetric key
export async function symEncrypt(key: webcrypto.CryptoKey, data: string): Promise<string> {
  // implement this function to encrypt a base64 encoded message with a public key
  // tip: encode the data to a uin8array with TextEncoder
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await webcrypto.subtle.encrypt(
      { name: "AES-CBC", iv: iv },
      key,
      messageBytes
  );

  const ivAndEncryptedBuffer = new Uint8Array(iv.byteLength + encryptedBuffer.byteLength);
  ivAndEncryptedBuffer.set(iv, 0);
  ivAndEncryptedBuffer.set(new Uint8Array(encryptedBuffer), iv.byteLength);

  return arrayBufferToBase64(ivAndEncryptedBuffer);
}

// Decrypt a message using a symmetric key
export async function symDecrypt(strKey: string, encryptedData: string): Promise<string> {
  // implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function and use TextDecode to go back to a string format
  const encryptedBuffer = base64ToArrayBuffer(encryptedData);
  const iv = encryptedBuffer.slice(0, 12);
  const ciphertext = encryptedBuffer.slice(12);
  const key = await importSymKey(strKey);

  const decryptedBuffer = await webcrypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv },
      key,
      ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}
