import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SOL_MINT_ADDRESS, PUMP_FUN_PROGRAM_ID, PUMP_FUN_FEE_PROGRAM_ID, PUMP_FUN_GLOBAL_ACCOUNT, BOT_KEY_PAIR } from "../config";
import { indexOf } from "lodash";
import { swapPumpFun } from "../swap/pgrm/pump.fun";
import BigNumber from "bignumber.js";


function isProfit(price: number, solIn: number, tokenOut: number) {
    return new BigNumber(tokenOut * price).gt(solIn)
}

async function reservesStream(
    client: Client,
    token: string,
    tokenPriceCurve: PublicKey,
    solIn: number,
    tokenOut: number) {

    const stream = await client.subscribe();

    stream.on("data", (data) => {
        if (data.filters.includes('pumpfun_swap')) {
            const { price } = (parsePumpFunSwaps(token, tokenPriceCurve.toBase58(), data));
            console.log(
                'current price:: ', new BigNumber(tokenOut * price).toString(), "\n",
                'initial price:: ', new BigNumber(solIn).toString()
            );
            if (isProfit(price, solIn, tokenOut)) {
                swapPumpFun('sell', BOT_KEY_PAIR, token, 200_000 * 1e6, 0.15 * 1e9).then(() => {
                    stream.end()
                })
            }
        }
    });
    const streamClosed = new Promise<void>((resolve, reject) => {
        stream.on("error", (error) => {
            console.log("ERROR", error);
            reject(error);
            stream.end();
        });
        stream.on("end", () => { resolve(); });
        stream.on("close", () => { resolve(); });
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

export function parsePumpFunSwaps(token: string, tokenPriceCurve: string, data: any) {
    const { transaction: dataTx } = data.transaction;
    const signature = decodeTransact(dataTx.signature);
    const { message } = dataTx.transaction;
    const accountKeys = message.accountKeys.map(decodeTransact);

    const curveIndex = accountKeys.indexOf(tokenPriceCurve);
    const [curveAddressSolPreBalance, curveAddressSolPostBalance] = [
        dataTx.meta.preBalances[curveIndex],
        dataTx.meta.postBalances[curveIndex]
    ];
    const curvePreBalanceRecord = dataTx?.meta?.preTokenBalances.find(t => t.owner === tokenPriceCurve);
    const curveTokenPreBalance = curvePreBalanceRecord?.uiTokenAmount?.amount;
    const curvePostBalanceRecord = dataTx?.meta?.postTokenBalances.find(t => t.owner === tokenPriceCurve);
    const curveTokenPostBalance = curvePostBalanceRecord?.uiTokenAmount?.amount;
    if (curveTokenPostBalance === curveTokenPreBalance) return;

    let price = ((new BigNumber(Math.max(curveAddressSolPostBalance, curveAddressSolPreBalance))
        .minus(new BigNumber(Math.min(curveAddressSolPostBalance, curveAddressSolPreBalance)))).div(1e9))
        .div((new BigNumber(Math.max(curveTokenPostBalance, curveTokenPreBalance))
            .minus(new BigNumber(Math.min(curveTokenPostBalance, curveTokenPreBalance)))).dividedBy(1e6))

    return {
        token,
        signature,
        price: Number(price)
    };
}

export async function pumpFunPriceWs(token: string, solIn: number, tokenOut: number) {
    const client = new Client(process.env.TRITON_NODE_URL, process.env.TRITON_NODE_KEY, { "grpc.max_receive_message_length": 64 * 1024 * 1024 }); // 64MiB
    const [tokenPriceCurve, _b0] = await PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), bs58.decode(token)], new PublicKey(PUMP_FUN_PROGRAM_ID)
    );
    reservesStream(client, token, tokenPriceCurve, solIn, tokenOut);
}



/**
 *     // const traderSolPreBalance = dataTx.meta.preBalances[0];
    // const traderSolPostBalance = dataTx.meta.postBalances[0];

    // const traderPreTokenRecord = dataTx?.meta?.preTokenBalances.filter((t) => t.owner !== tokenPriceCurve && accountKeys.includes(t.owner))
    
    // const traderTokenPreBalance = traderPreTokenRecord[0]?.uiTokenAmount?.amount

    // const traderPostTokenRecord = dataTx?.meta?.postTokenBalances.filter((t) => t.owner !== tokenPriceCurve && accountKeys.includes(t.owner))
    
    // console.log('traderPostTokenRecord:: ',JSON.parse(JSON.stringify(dataTx?.meta?.postTokenBalances)));
    // const traderTokenPostBalance = traderPostTokenRecord[0]?.uiTokenAmount?.amount;

            // traderSolPreBalance,
        // traderSolPostBalance,
        // traderTokenPreBalance,
        // traderTokenPostBalance,
        // tokenPriceCurve,
        // curveAddressSolPreBalance,
        // curveAddressSolPostBalance,
        // curveTokenPreBalance,
        // curveTokenPostBalance,
    
 */