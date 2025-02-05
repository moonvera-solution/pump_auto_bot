import { PublicKey, Connection, Signer, ComputeBudgetProgram, Transaction, TransactionInstruction, Keypair, AddressLookupTableAccount, Commitment, ConfirmOptions, VersionedTransaction } from "@solana/web3.js";
import { Account, TOKEN_PROGRAM_ID, TokenInvalidMintError, TokenInvalidOwnerError, ASSOCIATED_TOKEN_PROGRAM_ID, TokenInvalidAccountOwnerError, TokenAccountNotFoundError, getAssociatedTokenAddressSync, getAccount, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { optimizedSendAndConfirmTransaction, wrapLegacyTx } from "../sendTx";
import dotenv from 'dotenv'; dotenv.config();
import bs58 from 'bs58';
// token GosqNDHhsSNFLbmvsqyJQxMnssZVShMwYzx3RDT4pump



async function swapPumpFun(
    side: 'buy' | 'sell',
    signerKeyPair: Keypair,
    tokenOut: string,
    amount: bigint,
    maxSol: bigint
) {
    const isBuy = side === 'buy';
    const MINT_TOKEN_ADDRESS = tokenOut;
    const PUMP_FUN_PROGRAM_ID = ('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    const PUMP_FUN_FEE_PROGRAM_ID = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM';
    const USER_ADDRESS = signerKeyPair.publicKey;
    const PUMP_FUN_PROGRAM_BUY_DESCRIMINATOR = '66063d1201daebea';
    const PUMP_FUN_PROGRAM_SELL_DESCRIMINATOR = '33e685a4017f83ad';

    const dataBuffer = Buffer.alloc(24);
    dataBuffer.write(isBuy ? PUMP_FUN_PROGRAM_BUY_DESCRIMINATOR : PUMP_FUN_PROGRAM_SELL_DESCRIMINATOR, 'hex'); // anchor descriminator, is constant
    dataBuffer.writeBigInt64LE(amount, 8); // amount
    dataBuffer.writeBigInt64LE(maxSol, 16); // max sol to spend, calc slippage b4hand

    const USER_MINT_ATA = getAssociatedTokenAddressSync(
        new PublicKey(MINT_TOKEN_ADDRESS),
        new PublicKey(USER_ADDRESS), true
    );

    // ger program derived address
    const [BONDING_CURVE_ADDRESS, _b0] = await PublicKey.findProgramAddressSync(
        ["bonding-curve", bs58.decode(MINT_TOKEN_ADDRESS)],
        new PublicKey(PUMP_FUN_PROGRAM_ID)
    );

    const BONDING_CURVE_ATA = getAssociatedTokenAddressSync(
        new PublicKey(MINT_TOKEN_ADDRESS),
        BONDING_CURVE_ADDRESS, true
    );
    console.log('BONDING_CURVE_ATA', BONDING_CURVE_ATA.toBase58());

    const [PUMPFUN_GLOBAL_ACCOUNT, _b2] = await PublicKey.findProgramAddressSync(
        [Buffer.from('global')],
        new PublicKey(PUMP_FUN_PROGRAM_ID)
    );


    const swap_inx: TransactionInstruction = {
        programId: new PublicKey(PUMP_FUN_PROGRAM_ID),
        keys: [
            { pubkey: new PublicKey(PUMPFUN_GLOBAL_ACCOUNT), isSigner: false, isWritable: false },
            { pubkey: new PublicKey(PUMP_FUN_FEE_PROGRAM_ID), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(MINT_TOKEN_ADDRESS), isSigner: false, isWritable: false }, //shitcoin
            { pubkey: BONDING_CURVE_ADDRESS, isSigner: false, isWritable: true },
            { pubkey: BONDING_CURVE_ATA, isSigner: false, isWritable: true },
            { pubkey: new PublicKey(USER_MINT_ATA), isSigner: false, isWritable: true }, // ATA
            { pubkey: new PublicKey(USER_ADDRESS), isSigner: true, isWritable: true }, // user wallet
            { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
            { pubkey: new PublicKey(isBuy ? 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' : 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), isSigner: false, isWritable: false },
            { pubkey: new PublicKey(isBuy ? 'SysvarRent111111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false },
            { pubkey: new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'), isSigner: false, isWritable: false }, // constant unknown pumpfun program address
            { pubkey: new PublicKey(PUMP_FUN_PROGRAM_ID), isSigner: false, isWritable: false },
        ],
        data: dataBuffer
    }


    const connection = new Connection(process.env.TRITON_NODE!);
    const blockhash = (await connection.getLatestBlockhash());
    const lookupTable = null//new AddressLookupTableAccount(new PublicKey(''));


    let ata_or_inx = await getOrCreateAssociatedTokenAccountInxOrAccount(
        isBuy ? true : false, // is blind snipe
        connection, signerKeyPair,
        new PublicKey(MINT_TOKEN_ADDRESS),
        new PublicKey(USER_ADDRESS),
        USER_MINT_ATA,
        'processed'
    );


    // instructions
    let swap_inxs: TransactionInstruction[] = [];
    if (ata_or_inx instanceof TransactionInstruction) swap_inxs.push(ata_or_inx);
    swap_inxs.push(swap_inx);

    let maxPriorityFee = Math.ceil(Number.parseFloat(String('0.00001')) * 1e9);

    swap_inxs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: maxPriorityFee * 10 }));
    swap_inxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }));

    const vtx = new VersionedTransaction(wrapLegacyTx(swap_inxs, signerKeyPair, blockhash, lookupTable));
    vtx.sign([signerKeyPair]);
    await connection.simulateTransaction(vtx, { commitment: "processed" })
        .then((res) => { console.log('res', res); })
        .catch((e) => { console.error("Sim error", e) });

    // optimizedSendAndConfirmTransaction(vtx,connection, blockhash, 300);
}



export async function getOrCreateAssociatedTokenAccountInxOrAccount(
    blindSnipe: boolean,
    connection: Connection,
    payer: Signer,
    mint: PublicKey,
    owner: PublicKey,
    associatedToken: PublicKey,
    commitment?: Commitment,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): Promise<TransactionInstruction | Account> {
    let account: Account;
    // if blind snipe we know b4hand the ATA does not exist, we return the instruction to create it 
    if (blindSnipe) {
        return createAssociatedTokenAccountInstruction(
            payer.publicKey,
            associatedToken,
            owner,
            mint,
            programId,
            associatedTokenProgramId,
        );
    } else { // if not blind snipe we try to get the ATA, fails we return the instruction to create it 
        try {
            account = await getAccount(connection, associatedToken, commitment, programId);
        } catch (error: unknown) {
            return createAssociatedTokenAccountInstruction(
                payer.publicKey,
                associatedToken,
                owner,
                mint,
                programId,
                associatedTokenProgramId,
            );
        }
    }

    if (!account.mint.equals(mint)) throw new TokenInvalidMintError();
    if (!account.owner.equals(owner)) throw new TokenInvalidOwnerError();

    return account;
}


const PUMPFUN_TOKEN = '7q8x3RpruvuK9M7Xi3Z1XdSjwESSvwqMdEQuHh6Gpump';
swapPumpFun(
    'sell',
    Keypair.fromSecretKey(bs58.decode(process.env.TEST_PK!)),
    PUMPFUN_TOKEN,
    BigInt(1),
    BigInt(0)
).then((res) => { console.log(res) });



