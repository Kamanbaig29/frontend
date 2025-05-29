import { Connection, PublicKey } from "@solana/web3.js";

async function checkAccountExists(accountStr: string, rpcUrl: string) {
  const connection = new Connection(rpcUrl, "confirmed");
  const publicKey = new PublicKey(accountStr);

  const accountInfo = await connection.getAccountInfo(publicKey);
  if (accountInfo === null) {
    console.log(`Account ${accountStr} does NOT exist or is uninitialized.`);
  } else {
    console.log(`Account ${accountStr} exists with data length: ${accountInfo.data.length}`);
  }
}

// Example usage:
const rpcUrl = "https://devnet.helius-rpc.com/?api-key=d70232c8-cb8c-4fb0-9d3f-985fc6f90880";  // ya aapka RPC endpoint
const accountToCheck = "2CQ14BwDjd3Ji5paQ89regGN61QoF4FtsfwBip4zGPpy";

checkAccountExists(accountToCheck, rpcUrl).catch(console.error);
