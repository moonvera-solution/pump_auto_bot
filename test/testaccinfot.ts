import "dotenv/config";
import { PublicKey, Connection } from "@solana/web3.js";
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { triggerSwapPump } from "../src/swap/api/swapPump";
import { swapPumpFun } from "../src/swap/pgrm/pump.fun";
import { CNX, BOT_KEY_PAIR, TOKEN_PROGRAM_ID } from "../src/config";
import { pumpFunPriceWs } from "src/market/prices";

let hasTriggered = false; // Global flag to track if we triggered once
const PUMPFUN_TOKEN_SUPPLY = 1_000_000_000;
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


  stream.on("close", () => {
    console.log("Stream closed");
  });
  stream.on("data", (data) => {

    if (data.filters.includes('pumpfun_blind_snipe')) {
      if (!hasTriggered && data.transaction && data.transaction.transaction) {
        parsePumpfunTx(data.transaction.transaction, stream);
      }
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


const solIn = 0.15 * 1e9;

async function parsePumpfunTx(txn: any, stream: any) {
  const sig = bs58.encode(txn.transaction.signatures[0]);
  const token = bs58.encode(txn.transaction.message.accountKeys[1])
  // console.log('sig', sig)
  // console.log('token', token)

  if (!hasTriggered) {
    hasTriggered = true;

    const buyTxSig = await swapPumpFun('buy', BOT_KEY_PAIR, token, 200_000 * 1e6, 0.15 * 1e9);

    // TODO: parse tx payload to get tokenOut and real spent = solIn
    let tokenAccountInfo = await CNX.getTransaction(buyTxSig,
      { 
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }
    );

    const tokenOut = tokenAccountInfo.value[0] && tokenAccountInfo.value[0].account.data.parsed.info.tokenAmount.uiAmount;

    if (tokenOut > 0) {
      pumpFunPriceWs(token,solIn,tokenOut)
      return;
    }



  }

}
// console.log('client', client)
blindSnipe(client, req);

