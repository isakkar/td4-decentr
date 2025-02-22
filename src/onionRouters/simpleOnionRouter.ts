import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_URL } from "../config";
import { generateRsaKeyPair, exportPubKey } from "../crypto";

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
  onionRouter.get("/getPrivateKey", (req, res) => {
    res.json({ result: privateKey });
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
