import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SplWhitelistTransfer } from '../target/types/spl_whitelist_transfer';

describe('spl-whitelist-transfer', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.SplWhitelistTransfer as Program<SplWhitelistTransfer>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
