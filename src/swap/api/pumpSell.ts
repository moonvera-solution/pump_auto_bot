import {
    AddressLookupTableAccount,
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
  } from "@solana/web3.js";
  import BigNumber from "bignumber.js";
  import { optimizedSendAndConfirmTransaction } from "../../utils";
  import bs58 from 'bs58';
  import dotenv from 'dotenv';

 export async function SellPumpswap(
    tokenOut: any,
    amount: any
  ){
    let strTx: string | null = '';

    const connection = new Connection('https://moonvera-ams.rpcpool.com/6eb499c8-2570-43ab-bad8-fdf1c63b2b41');

    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "publicKey": "",  // Your wallet public key
            "action": "sell",                 // "buy" or "sell"
            "mint": tokenOut,       // contract address of the token you want to trade
            "denominatedInSol": "false",     // "true" if amount is amount of SOL, "false" if amount is number of tokens
            "amount": amount,                // amount of SOL or tokens
            "slippage": 10,                  // percent slippage allowed
            "priorityFee": 0.001,          // priority fee
            "pool": "pump"                   // exchange to trade on. "pump", "raydium" or "auto"
        })
    });
   // successfully generated transaction
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        const signerKeyPair = Keypair.fromSecretKey(bs58.decode(''));
        tx.sign([signerKeyPair]);
         const TX_RETRY_INTERVAL = 50;
         const blockhash = (await connection.getLatestBlockhash());
         strTx = await optimizedSendAndConfirmTransaction(tx, connection, blockhash, TX_RETRY_INTERVAL);
         console.log('strTx', strTx);
  }


    // await swap(rpcUrl, wallet, tokenIn, tokenOut, amountIn, slippage, priorityFeeLevel);

 