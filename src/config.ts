import {Connection, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from 'bs58';

export const CNX = new Connection(`${process.env.TRITON_NODE_URL}${process.env.TRITON_NODE_KEY}`);
export const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const PUMP_FUN_FEE_PROGRAM_ID = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM';
export const PUMP_FUN_GLOBAL_ACCOUNT = '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
export const BOT_KEY_PAIR = Keypair.fromSecretKey(bs58.decode(process.env.TEST_PK!));
export const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
