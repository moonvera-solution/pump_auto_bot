import Client, {
  CommitmentLevel,
  SubscribeRequestAccountsDataSlice,
  SubscribeRequestFilterAccounts,
  SubscribeRequestFilterBlocks,
  SubscribeRequestFilterBlocksMeta,
  SubscribeRequestFilterEntry,
  SubscribeRequestFilterSlots,
  SubscribeRequestFilterTransactions,
} from "@triton-one/yellowstone-grpc";
import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
import { Connection, PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { publicKey } from "@solana/buffer-layout-utils";
import { getTokenInfo } from "./utils/tokenInfo";
import { getTokenBalance } from "./utils/token";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
const pumpfun = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

const api = 'api';

export function decodeTransact(data) {
  const output = bs58.encode(Buffer.from(data, 'base64'))
  return output;
}

export function tOutPut(data) {
  const dataTx = data.transaction.transaction
  const signature = decodeTransact(dataTx.signature);
  const message = dataTx.transaction?.message
  const header = message.header;
  const accountKeys = message.accountKeys.map((t) => {
    return decodeTransact(t)
  })
  const recentBlockhash = decodeTransact(message.recentBlockhash);
  const instructions = message.instructions
  const meta = dataTx?.meta
  return {
    signature,
    message: {
      header,
      accountKeys,
      recentBlockhash,
      instructions
    },
    meta
  }

}

const connection = new Client(process.env.TRITON_NODE_URL, process.env.TRITON_NODE_KEY, { "grpc.max_receive_message_length": 64 * 1024 * 1024 }); // 64MiB
async function handleStream(client: Client, args: any) {
  // Subscribe for events
  const stream = await client.subscribe();

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
  stream.on("data", async (data) => {
    try {

      const result = await tOutPut(data);
      //    console.log(result)
      const bondingDetails = await getBondingCurveAddress(result.meta.postTokenBalances);
      const Ca = result.meta.postTokenBalances[0].mint
      const tokenInfo = await getTokenInfo(Ca);
      const bondingCurve = bondingDetails.bondingCurve ? bondingDetails.bondingCurve?.toString() : "";
      const tokenBalances = await getTokenBalance(bondingCurve);
      const PoolValue = bondingDetails.solBalance / 1000000000
      const marketInfo = calculateInfo(PoolValue, tokenBalances, tokenInfo);
      if (tokenInfo === undefined) {
      } else {
        console.log(`
        Latest Pool
        Ca : ${Ca}
        Bonding Curve Address : ${bondingCurve}
        Pool Value SOL : ${Number(PoolValue).toFixed(2)} SOL
        Pool Value : ${tokenBalances}
        Price : $${marketInfo.price}
        MarketCap : ${marketInfo.marketPrice}
        current Supply : ${tokenInfo}
     `)

      }
    } catch (error) {
      if (error) {
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

async function subscribeCommand(client: Client, args: any) {
  while (true) {
    try {
      await handleStream(client, args);
    } catch (error) {
      console.error("Stream error, restarting in 1 second...", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

const client = new Client(
  'gRPC REGION URL',
  'gRPC TOKEN',
  undefined,
);
const req = {
  accounts: {},
  slots: {},
  transactions: {
    pumpfun: {
      vote: false,
      failed: false,
      signature: undefined,
      accountInclude: [pumpfun], //Address 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
      accountExclude: [],
      accountRequired: [],
    },
  },
  transactionsStatus: {},
  entry: {},
  blocks: {},
  blocksMeta: {},
  accountsDataSlice: [],
  ping: undefined,
  commitment: CommitmentLevel.CONFIRMED, //for receiving confirmed txn updates
};

subscribeCommand(client, req);
async function getBondingCurveAddress(transaction: any[]) {
  let bondingCurve;
  let solBalance;
  const eachOwners = transaction?.flatMap(inner => inner.owner);
  for (const owner in eachOwners) {
    const address = new PublicKey(eachOwners[owner]);
    const systemOwner = await connection.getAccountInfo(address);
    if (systemOwner.owner.toString() === pumpfun)
      bondingCurve = address;
    solBalance = systemOwner.lamports;
    return { bondingCurve, solBalance }
  }
  return { bondingCurve, solBalance }
}

function calculateInfo(solBal: number, tokenBal: number, currentSupply: number) {
  const $sol: number = solBal //solBal *  sol value in $$ use any api to fetch sol price;
  const tokenBought: number = currentSupply - tokenBal;
  const tokenBoughtPrice: number = $sol / tokenBought;
  const tokenValue = tokenBoughtPrice * currentSupply;
  const price = tokenValue / tokenBal;
  const marketPrice = price * currentSupply;
  return {
    price,
    marketPrice
  }
}