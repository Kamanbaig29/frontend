import {
  Connection,
  PublicKey,
  SystemProgram
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from "@solana/spl-token";

const FEE_RECIPIENT_PUBLIC_KEY = new PublicKey("5J7LSXEvM9vm5PftLPWDctw86DjXZE27GghmxeRUawY");

export async function getSwapAccounts({
  mintAddress,
  buyer,
  connection,
  programId,
}: {
  mintAddress: string;
  buyer: PublicKey;
  connection: Connection;
  programId: PublicKey;
}) {
  const mint = new PublicKey(mintAddress);

  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("global-config")],
    programId
  );

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    programId
  );

  // ---- CHANGE STARTS HERE ----
  // Derive curveTokenAccount as ATA for bondingCurve PDA
  const curveTokenAccount = await getAssociatedTokenAddress(
    mint,
    bondingCurve,
    true // owner is PDA
  );
  // ---- CHANGE ENDS HERE ----

  const userTokenAccount = await getAssociatedTokenAddress(
    mint,
    buyer
  );

  return {
    user: buyer,
    globalConfig,
    feeRecipient: FEE_RECIPIENT_PUBLIC_KEY,
    bondingCurve,
    tokenMint: mint,
    curveTokenAccount,
    userTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
}


