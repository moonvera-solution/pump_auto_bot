import "dotenv/config";
import { PublicKey , Connection } from "@solana/web3.js";
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { triggerSwapPump } from "../src/swapPump";


const PUMPFUN_FEE_PROGRAM_ID = 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM';

const client = new Client(
 'https://moonvera-ams.rpcpool.com/whirligig/',
 '6eb499c8-2570-43ab-bad8-fdf1c63b2b41',
  {"grpc.max_receive_message_length": 64 * 1024 * 1024} // 64MiB
  );
  const connection = new Connection('https://moonvera-ams.rpcpool.com/6eb499c8-2570-43ab-bad8-fdf1c63b2b41', 'processed');
async function handleStream(client: Client, args: SubscribeRequest) {
  // Subscribe for events
  // console.log('subscribing')
  const stream = await client.subscribe();
  console.log('stream', stream)
  // Create `error` / `end` handler
  const streamClosed = new Promise<void>((resolve, reject) => {
    stream.on("error", (error) => {
      console.log("ERROR", error);
      reject(error);
      stream.end();
    });
    stream.on("end", () => {
      resolve();
    });
    stream.on("close", () => {
      resolve();
    });
  });

  // Handle updates
  stream.on("data", (data) => {
    // console.log("streaming data", data);
    if (data.transaction) {
      const txn = data.transaction.transaction;
      // console.log('txn', bs58.encode(txn.transaction.signatures[0]))
      parsePumpfunTx(txn)
    //   const sig = (txn.signatures[0]);
    //  console.log('sig', sig)
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
    pumpfun: {
      vote: false,
      failed: false,
      signature: undefined,
      accountInclude: [PUMPFUN_FEE_PROGRAM_ID],
      accountExclude: [], // Exclude any accounts if necessary
      accountRequired: [PUMPFUN_FEE_PROGRAM_ID],
    }
  },
  accounts: {
    pumpfun: {
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
  console.log('sig', sig)
  console.log('PumpFunToken', bs58.encode(txn.transaction.message.accountKeys[1]))
  console.log('Token Creator', bs58.encode(txn.transaction.message.accountKeys[0]))
  const txxs = await connection.getParsedTransaction(txn, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
                     .catch((e) => console.error("Error on getSwapAmountOutPump", e.message, txn));
  console.log('txxs', txxs)

  if (txn && txn.meta && txn.meta.innerInstructions) {
    txn.meta.innerInstructions.forEach((instruction: any) => {
      instruction.instructions.forEach((inst: any) => {
        console.log('inst', inst)
      })
    })
  }
  if (!hasTriggered) {
    triggerSwapPump(bs58.encode(txn.transaction.message.accountKeys[1]));
    hasTriggered = true;
  }

}
// console.log('client', client)
handleStream(client, req);

