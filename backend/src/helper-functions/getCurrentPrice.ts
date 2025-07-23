import { Connection, PublicKey } from '@solana/web3.js';
import { getSwapAccounts } from '../action/getSwapAccounts';
import { MEMEHOME_PROGRAM_ID } from '../config/test-config';
import { Program, AnchorProvider, BN, Idl } from '@project-serum/anchor';
import idl from '../idl/meme_home_idl.json';

function initProgram(connection: Connection, userPublicKey: PublicKey): Program {
  const provider = new AnchorProvider(
    connection,
    { publicKey: userPublicKey, signTransaction: () => Promise.resolve(null) } as any,
    { commitment: 'confirmed' }
  );
  return new Program(idl as Idl, MEMEHOME_PROGRAM_ID, provider);
}

export async function getCurrentPrice(
  connection: Connection,
  mintAddress: string,
  userPublicKey: PublicKey
): Promise<number> {
  try {
    const swapAccounts = await getSwapAccounts({
      mintAddress,
      buyer: userPublicKey,
      connection,
      programId: MEMEHOME_PROGRAM_ID
    });
    if (!swapAccounts) return 0;
    const program = initProgram(connection, userPublicKey);
    const bondingCurveAcc: any = await program.account.bondingCurve.fetch(swapAccounts.bondingCurve);
    const virtualSolReserves = bondingCurveAcc['virtualSolReserves'] as BN;
    const virtualTokenReserves = bondingCurveAcc['virtualTokenReserves'] as BN;
    if (!virtualSolReserves || !virtualTokenReserves) return 0;
    // amazonq-ignore-next-line
    const virtualSol = virtualSolReserves.toNumber() / 1_000_000;
    const virtualToken = virtualTokenReserves.toNumber() / 1_000_000;
    // amazonq-ignore-next-line
    if (virtualToken === 0) return 0;
    return virtualSol / virtualToken;
  } catch (error) {
    console.error(`[${mintAddress}] Error getting current price:`, error);
    return 0;
  }
}
