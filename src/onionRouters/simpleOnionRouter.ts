import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_URL, BASE_USER_PORT } from "../config";
import {
  generateRsaKeyPair,
  exportPubKey,
  exportPrvKey,
  importPrvKey,
  rsaDecrypt,
  importSymKey,
  symDecrypt,
  exportSymKey
} from "../crypto";
import { log, error } from "console";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let lastReceivedEncryptedMessage: any = null;
  let lastReceivedDecryptedMessage: any = null;
  let lastMessageDestination: any = null;

  // Generate RSA key pair
  const { publicKey, privateKey } = await generateRsaKeyPair();

  // Export public key
  const publicKeyBase64 = await exportPubKey(publicKey);

  // Register the node
  try {
    const response = await fetch(`${REGISTRY_URL}/registerNode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, pubKey: publicKeyBase64 }),
    });
    if (!response.ok) {
      throw new Error(`Failed to register. Status: ${response.status}`);
    }

  } catch (err) {
    process.exit(1); // Stop execution if registration fails
  }

  // Implement the status route
  onionRouter.get("/status", (req, res) => {
    res.send('live');
  });

  // Route to get the last received encrypted message
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  // Route to get the last received decrypted message
  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  // Route to get the destination of the last message
  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  // Route to get the node's private key
  onionRouter.get("/getPrivateKey", async (req, res) => {
    const privateKeyBase64 = await exportPrvKey(privateKey);
    res.json({ result: privateKeyBase64 });
  });

  // Route to receive a message
  onionRouter.post("/message", async (req, res) => {
    const {message}: { message: string } = req.body;
    lastReceivedEncryptedMessage = message;

    // Extract the encrypted symmetric key (first part of message)
    const encryptedSymmetricKey = message.slice(0, 344);
    const encryptedData = message.slice(344);

    // Decrypt the symmetric key using our private key
    const privateKeyBase64 = await exportPrvKey(privateKey);
    if (!privateKeyBase64) {
      throw new Error("Private key is null");
    }
    const privateKeyCryptoKey = await importPrvKey(privateKeyBase64);
    const symmetricKeyBase64 = await rsaDecrypt(encryptedSymmetricKey, privateKeyCryptoKey);
    const symmetricKey = await importSymKey(symmetricKeyBase64);
    const strSymmetricKey = await exportSymKey(symmetricKey);

    // Decrypt the payload with the symmetric key
    const decryptedData = await symDecrypt(strSymmetricKey, encryptedData);

    // Extract the next destination (first 10 chars of decrypted data)
    const nextDestination = parseInt(decryptedData.slice(0, 10));
    const actualMessage = decryptedData.slice(10);

    lastReceivedDecryptedMessage = actualMessage;
    lastMessageDestination = nextDestination;

    if (nextDestination < 4000) {
      // Final destination is a user, send the message there
      log(`[USER] Forwarding to http://localhost:${BASE_USER_PORT + nextDestination}/message`)
      await fetch(`http://localhost:${BASE_USER_PORT + nextDestination}/message`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: actualMessage}),
      });
    } else {
      // forward to the next onion router
      log(`Forwarding to http://localhost:${BASE_ONION_ROUTER_PORT + nextDestination}/message`)
      await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + nextDestination}/message`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: actualMessage}),
      });
    }
    res.send("success");
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${
        BASE_ONION_ROUTER_PORT + nodeId
      }`
    );
  });

  return server;
}
