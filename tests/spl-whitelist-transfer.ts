import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SplWhitelistTransfer } from "../target/types/spl_whitelist_transfer";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import assert from "assert";

describe("spl-whitelist-transfer", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace
    .SplWhitelistTransfer as Program<SplWhitelistTransfer>;
  const provider = program.provider;
  const rent = anchor.web3.SYSVAR_RENT_PUBKEY;
  const tokenProgram = TOKEN_PROGRAM_ID;
  const systemProgram = anchor.web3.SystemProgram.programId;

  let state_pda: PublicKey;
  let state_pda_bump: number;
  let mint_pda: PublicKey;
  let mint_pda_bump: number;
  let mint: Token;
  let senderTokenAccount: PublicKey;
  let receiverTokenAccount: PublicKey;

  const initializer = anchor.web3.Keypair.generate();
  const sender = anchor.web3.Keypair.generate();
  const receiver = anchor.web3.Keypair.generate();

  before(async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        initializer.publicKey,
        10000000000
      ),
      "confirmed"
    );
    await provider.send(
      (() => {
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: initializer.publicKey,
            toPubkey: sender.publicKey,
            lamports: 1000000000,
          }),
          SystemProgram.transfer({
            fromPubkey: initializer.publicKey,
            toPubkey: receiver.publicKey,
            lamports: 1000000000,
          })
        );
        return tx;
      })(),
      [initializer]
    );

    mint = await Token.createMint(
      provider.connection,
      initializer,
      initializer.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    senderTokenAccount = await mint.createAccount(sender.publicKey);
    receiverTokenAccount = await mint.createAccount(receiver.publicKey);

    await mint.mintTo(senderTokenAccount, initializer, [initializer], 10000);

    [state_pda, state_pda_bump] = await PublicKey.findProgramAddress(
      [Buffer.from("state")],
      program.programId
    );

    [mint_pda, mint_pda_bump] = await PublicKey.findProgramAddress(
      [mint.publicKey.toBuffer(), Buffer.from("mint")],
      program.programId
    );
  });

  it("Initialize", async () => {
    await program.rpc.initialize(state_pda_bump, {
      accounts: {
        initializer: initializer.publicKey,
        state: state_pda,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [initializer],
    });

    const state = await program.account.state.fetch(state_pda);
    assert.ok(state.initializer.equals(initializer.publicKey));
  });

  it("Transfer before Add Mint", async () => {
    await assert.rejects(
      async () => {
        await program.rpc.transfer(mint_pda_bump, new anchor.BN(100), {
          accounts: {
            sender: sender.publicKey,
            mint: mint.publicKey,
            mintPda: mint_pda,
            senderTokenAccount,
            receiverTokenAccount,
            tokenProgram,
          },
          signers: [sender],
        });
      },
      {
        code: 167,
        msg: "The given account is not owned by the executing program",
      }
    );
  });

  it("Add Mint", async () => {
    await program.rpc.addMint(state_pda_bump, mint_pda_bump, {
      accounts: {
        initializer: initializer.publicKey,
        state: state_pda,
        mint: mint.publicKey,
        mintPda: mint_pda,
        rent,
        systemProgram,
        tokenProgram,
      },
      signers: [initializer],
    });
  });

  it("Send", async () => {
    await program.rpc.transfer(mint_pda_bump, new anchor.BN(100), {
      accounts: {
        sender: sender.publicKey,
        mint: mint.publicKey,
        mintPda: mint_pda,
        senderTokenAccount,
        receiverTokenAccount,
        tokenProgram,
      },
      signers: [sender],
    });
    const senderTokenAccountInfo = await mint.getAccountInfo(
      senderTokenAccount
    );
    const receiverTokenAccountInfo = await mint.getAccountInfo(
      receiverTokenAccount
    );

    assert.ok(senderTokenAccountInfo.amount.toNumber() == 9900);
    assert.ok(receiverTokenAccountInfo.amount.toNumber() == 100);
  });
});
