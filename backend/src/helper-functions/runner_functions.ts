import WebSocket, { WebSocketServer } from 'ws';
import { Connection, PublicKey } from '@solana/web3.js';

export function calculateAmountOut(
    amountIn: bigint,
    tokenReserve: bigint,
    solReserve: bigint,
    feeNumerator = 997n,
    feeDenominator = 1000n
  ): bigint {
    const amountInWithFee = amountIn * feeNumerator;
    const numerator = amountInWithFee * solReserve;
    const denominator = tokenReserve * feeDenominator + amountInWithFee;
    return numerator / denominator;
  }


  export function broadcastUpdate(wss: WebSocketServer, data: any) {
    //console.log("📤 Broadcasting update:", data);
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
        //console.log("✅ Update sent to client");
      }
    });
  }

  export async function checkWalletBalance(
    connection: Connection,
    publicKey: PublicKey,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      // Try multiple times to get balance
      let retries = 3;
      let balance = null;
  
      while (retries > 0) {
        try {
          balance = await connection.getBalance(publicKey);
          break;
        } catch (error) {
          console.log(
            `Retry ${4 - retries} failed, attempts left: ${retries - 1}`
          );
          retries--;
          if (retries === 0) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between retries
        }
      }
  
      if (balance === null) {
        throw new Error("Failed to get wallet balance after multiple attempts");
      }
  
      console.log(`💰 Current wallet balance: ${balance / 1e9} SOL`);
      console.log(`💵 Required amount: ${requiredAmount / 1e9} SOL`);
  
      // Add buffer for transaction fees (0.01 SOL)
      const requiredWithBuffer = requiredAmount + 10_000_000;
  
      if (balance < requiredWithBuffer) {
        console.error(
          `❌ Insufficient balance. Need ${requiredWithBuffer / 1e9
          } SOL (including fees)`
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("❌ Error checking wallet balance:", error);
      throw new Error("Failed to verify wallet balance. Please try again.");
    }
  }