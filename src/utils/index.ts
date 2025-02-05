import {
    Connection,
    Keypair,
    MessageV0,
    PublicKey,
    Signer,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
  } from "@solana/web3.js";
  
  import BigNumber from 'bignumber.js';
  import bs58 from 'bs58';
  
  export async function optimizedSendAndConfirmTransaction(
    tx: VersionedTransaction,
    connection: Connection,
    blockhash: any,
    txRetryInterval: number
  ): Promise<string | null> {
    txRetryInterval = 30;
    console.log(`optimizedSendAndConfirmTransaction...`);
  
    let txSignature;
    let confirmTransactionPromise = null;
    let confirmedTx: any = null;
  
    try {
      // Simulating the transaction
      const simulationResult = await connection.simulateTransaction(tx, { commitment: "processed" })
        .catch((e) => {
          console.error("Error of optimizedSendAndConfirmTransaction", e)
          console.error("Error on optimizedSendAndConfirmTransaction", e.message)
        });
      await catchSimulationErrors(simulationResult);
  
      const signatureRaw: any = tx.signatures[0];
      txSignature = bs58.encode(signatureRaw);
  
      let txSendAttempts = 1;
  
      console.log(`${new Date().toISOString()} Subscribing to transaction confirmation`);
  
      // confirmTransaction throws error, handle it
      confirmTransactionPromise = connection.confirmTransaction({
        signature: txSignature,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
      }, "confirmed");
  
      console.log(`${new Date().toISOString()} Sending Transaction ${txSignature}`);
  
      // send before starting retry while loop
      await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 0, preflightCommitment: "confirmed" });
      confirmedTx = null;
      const txId = txSignature.substring(0, 6);
  
      // retry while loop
      while (!confirmedTx) {
  
        confirmedTx = await Promise.race([
          confirmTransactionPromise,
          new Promise((resolve) =>
            setTimeout(() => {
              resolve(null);
            }, txRetryInterval)
          ),
        ]);
  
        // console.log("confirmedTx:", confirmedTx);
  
        // confirmed => break loop
        if (confirmedTx) { console.log(`Tx ${txId} confirmed ,${txRetryInterval * txSendAttempts}`, confirmedTx); break; }
  
        console.log(`Resending tx id ${txId} ${txRetryInterval * txSendAttempts++}ms`);
  
        await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 0, preflightCommitment: "confirmed" });
  
      } // end loop
  
  
      // loop ends, no error, transaction confirmed return link
      console.log(`${new Date().toISOString()} Transaction successful`);
      console.log(`${new Date().toISOString()} Explorer URL: https://solscan.io/tx/${txSignature}`);
  
      return txSignature;
    } catch (error: any) {
      console.error(`${new Date().toISOString()} optimized Error:`, error);
  
      throw new Error(`Transaction failed! ${error.message}`)
    }
  }
  
  export function wrapLegacyTx(txInxs: TransactionInstruction[], payerKeypair: Keypair, blockhash: any, lookupTable?: any): MessageV0 {
    return new TransactionMessage({
      payerKey: payerKeypair.publicKey,
      recentBlockhash: blockhash.blockhash,
      instructions: txInxs
    }).compileToV0Message(lookupTable);
  }
  
  export async function catchSimulationErrors(simulationResult: any) {
    const SLIPPAGE_ERROR = /Error: exceeds desired slippage limit/;
    const SLIPPAGE_ERROR2 = /Program Error: "Instruction #3 Failed - custom program error: exceeds desired slippage limit"/
    const SLIPPAGE_ERROR3 = /Program Error: "Instruction #1 Failed - custom program error: slippage: Too little SOL received to sell the given amount of tokens"/;
    const SLIPPAGE_ERROR4 = /Program Error: "Instruction #4 Failed - custom program error: exceeds desired slippage limit"/;
    const SLIPPAGE_ERROR5 = /Program Error: "Instruction #7 Failed - custom program error: Slippage tolerance exceeded"/;
    const SLIPPAGE_ERROR_ANCHOR = /Program Error: "Instruction #5 Failed - custom program error: Slippage tolerance exceeded"/;
    const SLIPPAGE_TOLERANCE = /Program Error: "Instruction #2 Failed - custom program error: slippage: Too much SOL required to buy the given amount of tokens"/;
    const SLIPPAGE_REQUIRED = /Error: slippage: Too much SOL required to buy the given amount of tokens/;
    console.log("simulationResult is it catching!!! ")
    console.log("simulationResult", JSON.parse(JSON.stringify(simulationResult)))
  
    if (simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_ERROR.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_ERROR_ANCHOR.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_TOLERANCE.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_REQUIRED.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_ERROR2.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_ERROR3.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_ERROR4.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => SLIPPAGE_ERROR5.test(logMsg))) {
  
      throw new Error(`Slippage error, try increasing your slippage %.`);
    }
  
    const BALANCE_ERROR = /Transfer: insufficient lamports/;
    const BALANCE_ERROR2 = /Program Error: "Instruction #5 Failed - custom program error: insufficient funds"/;
    const BALANCE_ERROR3 = /Program Error: "Instruction #3 Failed - custom program error: insufficient funds"/;
    if (simulationResult.value.logs.find((logMsg: any) => BALANCE_ERROR.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => BALANCE_ERROR2.test(logMsg)) ||
      simulationResult.value.logs.find((logMsg: any) => BALANCE_ERROR3.test(logMsg))) {
  
      throw new Error(`Insufficient balance for transaction.`);
    }
  
    const FEES_ERROR = 'InsufficientFundsForFee';
    if (simulationResult.value.err === FEES_ERROR) {
      throw new Error(`Swap failed! Please try again.`);
    }
    if (simulationResult.value.err) {
      console.log(simulationResult.value.err);
      throw new Error(`Transaction failed`);
    }
  }
  