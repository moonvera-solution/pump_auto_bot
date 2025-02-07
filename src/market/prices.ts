import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SOL_MINT_ADDRESS, PUMP_FUN_PROGRAM_ID, PUMP_FUN_FEE_PROGRAM_ID, PUMP_FUN_GLOBAL_ACCOUNT } from "../config";
import { indexOf } from "lodash";


async function reservesStream(client: Client, tokenPriceCurve: PublicKey) {
    const stream = await client.subscribe();
    const streamClosed = new Promise<void>((resolve, reject) => {
        stream.on("error", (error) => {
            console.log("ERROR", error);
            reject(error);
            stream.end();
        });
        stream.on("end", () => { resolve(); });
        stream.on("close", () => { resolve(); });
    });

    // Handle updates
    stream.on("data", (data) => {
        if (data.filters.includes('pumpfun_swap')) {
            console.log(parsePumpFunSwaps(tokenPriceCurve.toBase58(), data));
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
                    accountRequired: [tokenPriceCurve.toBase58()],
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

export function decodeTransact(data) {
    const output = bs58.encode(Buffer.from(data, 'base64'))
    return output;
}

export function parsePumpFunSwaps(tokenPriceCurve: string, data: any) {
    const dataTx = data.transaction.transaction
    const signature = decodeTransact(dataTx.signature);

    const message = dataTx.transaction?.message
    const header = message.header;
    const accountKeys = message.accountKeys.map((t) => { return decodeTransact(t) });

    const traderSolPreBalance = dataTx.meta.preBalances[0];
    const traderSolPostBalance = dataTx.meta.postBalances[0];


    const traderPreTokenRecord = dataTx?.meta?.preTokenBalances.filter((t) => t.owner !== tokenPriceCurve && accountKeys.includes(t.owner))
    const traderTokenPreBalance = traderPreTokenRecord[0].uiTokenAmount.amount
    const traderAddress = traderPreTokenRecord[0].owner

    const traderPostTokenRecord = dataTx?.meta?.postTokenBalances.filter((t) => t.owner !== tokenPriceCurve && accountKeys.includes(t.owner))
    const traderTokenPostBalance = traderPostTokenRecord?.uiTokenAmount?.amount;

    const curveIndex = accountKeys.indexOf(tokenPriceCurve);
    const curveAddressSolPreBalance = dataTx.meta.preBalances[curveIndex];
    const curveAddressSolPostBalance = dataTx.meta.postBalances[curveIndex];
    
    const curvePreBalanceRecord = (dataTx?.meta?.preTokenBalances.filter((t) => t.owner === tokenPriceCurve))[0]
    const curveTokenPreBalance = curvePreBalanceRecord?.uiTokenAmount?.amount;

    const curvePostBalanceRecord = (dataTx?.meta?.postTokenBalances.filter((t) => t.owner === tokenPriceCurve))[0]
    const curveTokenPostBalance = curvePostBalanceRecord?.uiTokenAmount?.amount;

    return {
        signature,
        traderAddress,
        traderSolPreBalance,
        traderSolPostBalance,
        traderTokenPreBalance,
        traderTokenPostBalance,
        tokenPriceCurve,
        curveAddressSolPreBalance,
        curveAddressSolPostBalance,
        curveTokenPreBalance,
        curveTokenPostBalance,
    }
}

export async function priceWs(token: string) {
    const client = new Client(process.env.TRITON_NODE_URL, process.env.TRITON_NODE_KEY, { "grpc.max_receive_message_length": 64 * 1024 * 1024 }); // 64MiB
    const [tokenPriceCurve, _b0] = await PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), bs58.decode(token)], new PublicKey(PUMP_FUN_PROGRAM_ID)
    );
    reservesStream(client, tokenPriceCurve);

}

priceWs('4xk8LPXFk7TMEQ1nfT4AnEs8MmEB4BfHfcVAeULGpump');
// BONDING_CURVE_ADDRESS kBbXJwUyqqzL8SFD43jXmvkFcjV22JXPiQExieCFg91
// BONDING_CURVE_ATA 9xG96zLhQcDXRAtq53zom4MLps3kbxBnkv3t4xkKJLva
// BONDING_CURVE_ATA_SOL 3hobuXvisZEGbTJKtQ9jgGvULNkZdJuTo2yd8M9VtyNm

