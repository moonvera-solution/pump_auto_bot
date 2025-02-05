import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PUMP_FUN_PROGRAM_ID, PUMP_FUN_FEE_PROGRAM_ID, PUMP_FUN_GLOBAL_ACCOUNT } from "../config";


async function reservesStream(client: Client, token: string) {
    const stream = await client.subscribe();

    const [BONDING_CURVE_ADDRESS, _b0] = await PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), bs58.decode(token)],
        new PublicKey(PUMP_FUN_PROGRAM_ID)
    );


    const BONDING_CURVE_ATA = getAssociatedTokenAddressSync(
        new PublicKey(token),
        BONDING_CURVE_ADDRESS, true
    );

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
        if (data.filters.includes('pumpfun_swap')) {
            parsePumpfunTx(data.transaction)
        }
    });

    // Send subscribe request
    await new Promise<void>((resolve, reject) => {
        stream.write({
            transactions: {
                pumpfun_swap: {
                    vote: false,
                    failed: false,
                    signature: undefined,
                    accountInclude: [PUMP_FUN_GLOBAL_ACCOUNT, PUMP_FUN_FEE_PROGRAM_ID],
                    accountExclude: [], // Exclude any accounts if necessary
                    accountRequired: [BONDING_CURVE_ATA.toBase58()],
                }
            },
            accounts: {},
            slots: {},
            transactionsStatus: {},
            blocks: {},
            blocksMeta: {},
            entry: {},
            accountsDataSlice: [],
            // ping: undefined,
            commitment: CommitmentLevel.PROCESSED,
        }, (err: any) => {
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



// TODO extract price from reserves or from curve_ata balanceOf token/sol  ?
async function parsePumpfunTx(txn: any) {
    const sig = bs58.encode(txn.transaction.signature);
    console.log('txn.transaction.', txn.transaction)
}

const client = new Client(process.env.TRITON_NODE_URL, process.env.TRITON_NODE_KEY, { "grpc.max_receive_message_length": 64 * 1024 * 1024 }); // 64MiB
const PUMP_FUN_TOKEN = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'

reservesStream(client, PUMP_FUN_TOKEN);

