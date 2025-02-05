import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { triggerSwapPump } from "./swap/api/swapPump";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";

const client = new Client(
  process.env.TRITON_NODE_URL,
  process.env.TRITON_NODE_KEY,
  {"grpc.max_receive_message_length": 64 * 1024 * 1024} // 64MiB
  );
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
    //   console.log('txn', bs58.encode(txn.transaction.signatures[0]))
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
      accountInclude: ['CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'],
      accountExclude: [], // Exclude any accounts if necessary
      accountRequired: ['suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK'],
    }
  },
  accounts: {
    wallet: {
      account: ['suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK'],
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

async function parsePumpfunTx(txn: any) {


  const sig = bs58.encode(txn.transaction.signatures[0]);
  console.log('sig', sig)
    console.log('txn', txn.transaction)
    
  console.log('acc keys',bs58.encode(txn.transaction.transaction))
}
// console.log('client', client)
handleStream(client, req);

