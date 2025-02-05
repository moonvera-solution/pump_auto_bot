import "dotenv/config";
import { PublicKey, Connection } from "@solana/web3.js";
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { triggerSwapPump } from "../src/swap/api/swapPump";
import { swapPumpFun } from "../src/swap/pgrm/pump.fun";
import { CNX, BOT_KEY_PAIR } from "../src/config";


const PUMPFUN_FEE_PROGRAM_ID = 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM';

const client = new Client(
  process.env.TRITON_NODE_URL,
  process.env.TRITON_NODE_KEY,
  { "grpc.max_receive_message_length": 64 * 1024 * 1024 } // 64MiB
);

async function blindSnipe(client: Client, args: SubscribeRequest) {
  const stream = await client.subscribe();

  const streamClosed = new Promise<void>((resolve, reject) => {
    stream.on("error", (error) => { console.log("ERROR", error); reject(error); stream.end(); });
    stream.on("end", () => { resolve(); });
    stream.on("close", () => { resolve(); });
  });

  stream.on("data", (data) => {
    if (data.filters.includes('pumpfun_blind_snipe')) {
      parsePumpfunTx(data.transaction.transaction)
    }
  });

  // Send subscribe request
  await new Promise<void>((resolve, reject) => {
    stream.write(args, (err: any) => {
      if (err === null || err === undefined) {
        resolve();
      } else {
        reject(err);
      }
    });
  }).catch((reason) => {
    console.error(reason);
    throw reason;
  });

  await streamClosed;
}

const req: SubscribeRequest = {
  transactions: {
    pumpfun_blind_snipe: {
      vote: false,
      failed: false,
      signature: undefined,
      accountInclude: [PUMPFUN_FEE_PROGRAM_ID],
      accountExclude: [], // Exclude any accounts if necessary
      accountRequired: [PUMPFUN_FEE_PROGRAM_ID],
    }
  },
  accounts: {
    pumpfun_blind_snipe: {
      account: [PUMPFUN_FEE_PROGRAM_ID],
      owner: [],
      filters: [],
    }
  },
  slots: {},
  transactionsStatus: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  accountsDataSlice: [],
  // ping: undefined,
  commitment: CommitmentLevel.PROCESSED,
}

let hasTriggered = false; // Global flag to track if we triggered once

async function parsePumpfunTx(txn: any) {

  const sig = bs58.encode(txn.transaction.signatures[0]);
  const token = bs58.encode(txn.transaction.message.accountKeys[1])
  console.log('PumpFunToken', token)
  console.log('Token Creator', bs58.encode(txn.transaction.message.accountKeys[0]))


  await CNX.getParsedTransaction(txn, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
    .catch((e) => console.error("Error on getSwapAmountOutPump", e.message, txn));

  // if (txn && txn.meta && txn.meta.innerInstructions) {
  //   txn.meta.innerInstructions.forEach((instruction: any) => {
  //     instruction.instructions.forEach((inst: any) => {
  //       console.log('inst', inst)
  //     })
  //   })
  // }

  if (!hasTriggered) {
    //  catch minting inx to get supply and buy a % of it not token amount
    // 1st param on token terms, buy as much as possible -1 = int.max but cannot be more than total supply 
    // 2nd param on sol terms, max sol to spend, is snipe no price to calculate slippage
    await swapPumpFun('buy', BOT_KEY_PAIR, token, 500_000_000_000, 500_000_000)
    hasTriggered = true;
  }

}
// console.log('client', client)
blindSnipe(client, req);

