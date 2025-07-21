import anchor from '@project-serum/anchor';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import fs from 'fs';
import fetch from 'node-fetch'; // npm install node-fetch

// Pump.fun program address (from your IDL)
const PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Load the IDL
const idl = JSON.parse(fs.readFileSync('./pump_fun_idl.json', 'utf8'));

// Connect to Solana mainnet
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

// Anchor provider (no wallet needed for read-only)
const provider = new anchor.AnchorProvider(connection, {}, {});

// Program instance
const program = new anchor.Program(idl, PROGRAM_ID, provider);

console.log('Listening for new Pump.fun tokens (CreateEvent)...');

program.addEventListener('CreateEvent', async (event, slot) => {
  console.log('--- New Token Created! ---');
  console.log('Name:   ', event.name);
  console.log('Symbol: ', event.symbol);
  console.log('Mint:   ', event.mint.toBase58());
  console.log('Creator:', event.user.toBase58());
  console.log('URI:    ', event.uri);
  console.log('Bonding Curve:', event.bondingCurve.toBase58());
  console.log('Slot:   ', slot);

  // 1. Metadata JSON fetch karo
  try {
    const response = await fetch(event.uri);
    const metadata = await response.json();

    // 2. Image URL print karo
    console.log('Image URL:', metadata.image);
  } catch (err) {
    console.log('Metadata fetch error:', err.message);
  }

  console.log('--------------------------\n');
});
