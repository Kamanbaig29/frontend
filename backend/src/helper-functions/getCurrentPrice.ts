import { Connection, Keypair } from '@solana/web3.js';
import { getSwapAccounts } from '../action/getSwapAccounts';
import { MEMEHOME_PROGRAM_ID, USER_SECRET_KEY } from '../config/test-config';
import { Program, AnchorProvider, BN, Idl } from '@project-serum/anchor';
import idl from '../idl/meme_home_idl.json';

const secret = 
  typeof process.env.USER_SECRET_KEY === 'string' && process.env.USER_SECRET_KEY.length > 0
    ? process.env.USER_SECRET_KEY
    : (typeof USER_SECRET_KEY === 'string'
        ? USER_SECRET_KEY
        : JSON.stringify(USER_SECRET_KEY));
const userKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret || '[]')));

function initProgram(connection: Connection): Program {
  const provider = new AnchorProvider(
    connection,
    { publicKey: userKeypair.publicKey, signTransaction: () => Promise.resolve(null) } as any,
    { commitment: 'confirmed' }
  );
  return new Program(idl as Idl, MEMEHOME_PROGRAM_ID, provider);
}

export async function getCurrentPrice(connection: Connection, mintAddress: string): Promise<number> {
  try {
    const swapAccounts = await getSwapAccounts({
      mintAddress,
      buyer: userKeypair.publicKey,
      connection,
      programId: MEMEHOME_PROGRAM_ID
    });
    if (!swapAccounts) return 0;
    const program = initProgram(connection);
    const bondingCurveAcc: any = await program.account.bondingCurve.fetch(swapAccounts.bondingCurve);
    const virtualSolReserves = bondingCurveAcc['virtualSolReserves'] as BN;
    const virtualTokenReserves = bondingCurveAcc['virtualTokenReserves'] as BN;
    if (!virtualSolReserves || !virtualTokenReserves) return 0;
    const virtualSol = virtualSolReserves.toNumber() / 1_000_000;
    const virtualToken = virtualTokenReserves.toNumber() / 1_000_000;
    if (virtualToken === 0) return 0;
    return virtualSol / virtualToken;
  } catch (error) {
    console.error(`[${mintAddress}] Error getting current price:`, error);
    return 0;
  }
}
