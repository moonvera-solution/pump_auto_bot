import "dotenv/config";
import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeRequestAccountsDataSlice,
  SubscribeRequestFilterAccounts,
  SubscribeRequestFilterBlocks,
  SubscribeRequestFilterBlocksMeta,
  SubscribeRequestFilterEntry,
  SubscribeRequestFilterSlots,
  SubscribeRequestFilterTransactions,
} from "@triton-one/yellowstone-grpc";
// import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
import { VersionedTransactionResponse } from "@solana/web3.js";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { TransactionFormatter } from "./utils/transaction-formatter";
import { RaydiumAmmParser } from "./parsers/raydium-amm-parser";
import { LogsParser } from "./parsers/logs-parser";
import { bnLayoutFormatter } from "./utils/bn-layout-formatter";
const NeonEVM = 'NeonVMyRX5GbCrsAHnUwx1nYYoJAtskU1bWUo6JGNyG'
const createPoolFeeAccountAMM = "7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5"; // only mainnet, dev pls use 3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR
const createPoolFeeAccountCpmm = "DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8";
const jupOrder = "j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X";
const tulipVaultProtocol = 'TLPv2tuSVvn3fSk8RgW3yPddkp5oFivzZV3rA9hQxtX'
const dcaAccount = "DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M";
const unknownAccount = "LibLZGWthc9u1TxePmuRo87DNdiAwgV8yMXXhGbyu44";
// interface SubscribeRequest {
//   accounts: { [key: string]: SubscribeRequestFilterAccounts };
//   slots: { [key: string]: SubscribeRequestFilterSlots };
//   transactions: { [key: string]: SubscribeRequestFilterTransactions };
//   transactionsStatus: { [key: string]: SubscribeRequestFilterTransactions };
//   blocks: { [key: string]: SubscribeRequestFilterBlocks };
//   blocksMeta: { [key: string]: SubscribeRequestFilterBlocksMeta };
//   entry: { [key: string]: SubscribeRequestFilterEntry };
//   commitment?: CommitmentLevel | undefined;
//   accountsDataSlice: SubscribeRequestAccountsDataSlice[];
//   ping?: SubscribeRequestPing | undefined;
// }

const RAYDIUM_PUBLIC_KEY = RaydiumAmmParser.PROGRAM_ID;
const TXN_FORMATTER = new TransactionFormatter();
const raydiumAmmParser = new RaydiumAmmParser();
const IX_PARSER = new SolanaParser([]);
IX_PARSER.addParser(
  RaydiumAmmParser.PROGRAM_ID,
  raydiumAmmParser.parseInstruction.bind(raydiumAmmParser),
);
const LOGS_PARSER = new LogsParser();

async function handleStream(client: Client, args: SubscribeRequest) {
  // Subscribe for events
  const stream = await client.subscribe(); 
  // console.log('stream', stream)
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
    console.log('streaming data', data)
    if (data.transaction) {
      console.log('data.transaction', data.transaction)
      const txn = TXN_FORMATTER.formTransactionFromJson(
        data.transaction,
        Date.now(),
      );
     
      
     // decode the txn
      const parsedTxn = decodeRaydiumTxn(txn);
      console.log('parseTxn',parsedTxn)
      if (!parsedTxn) return;
      // just get one txn
     

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

async function subscribeCommand(client: Client, args: SubscribeRequest) {
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
process.env.ENDPOINT,
process.env.X_TOKEN,
{"grpc.max_receive_message_length": 64 * 1024 * 1024} // 64MiB
);

const req: SubscribeRequest = {
  accounts: {
    raydiumAccount: {
      account: ['5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'],
      owner: ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'],
      filters: []
    }
  },
  slots: {},
  transactions: {
    // raydiumLiquidityPoolV4: {
    //   vote: false,
    //   // failed: false,
    //   // signature: undefined,
    //   accountInclude: [
    // '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'
    //   ],
    //   accountExclude: [], // Exclude any accounts if necessary
    //   accountRequired: [],
    // },
  },
  transactionsStatus: {
  },
  entry: {},
  blocks: {},
  blocksMeta: {},
  accountsDataSlice: [],
  ping: undefined,
  commitment: CommitmentLevel.PROCESSED,
};

subscribeCommand(client, req);
const tokenAddress = '2Q3mARhGZ9Phiai1txGTXXJbN2eSxtcNXnXbfoexpump'
function decodeRaydiumTxn(tx: VersionedTransactionResponse) {
  
  
  if (tx.meta?.err) return;
  console.log('tx', tx.meta);

  const parsedIxs = IX_PARSER.parseTransactionWithInnerInstructions(tx);
  // console.log('parsedIxs', parsedIxs);
  const programIxs = parsedIxs.filter((ix) =>
    ix.programId.equals(RAYDIUM_PUBLIC_KEY),
  );

  if (programIxs.length === 0) return;
  const LogsEvent = LOGS_PARSER.parse(parsedIxs, tx.meta.logMessages);
  const result = { instructions: parsedIxs, events: LogsEvent };
  tx.meta.postTokenBalances?.forEach((item) => {

    if (item.mint === tokenAddress) {
      console.log("txn:::", tx.transaction.signatures[0]);
      result.instructions.forEach((item) => {
        if ( item.name === 'swapBaseIn' || item.name === 'swapBaseOut') {
        
          console.log(`Found item with name: ${item.name}`);
          console.log('item', item); // Output the entire item if you need to see all its properties
          console.log('result', result.instructions)
          console.log('result.events', result.events)
          }
        });

    }
  })


  bnLayoutFormatter(result);
  return result;
}
