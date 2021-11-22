use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod spl_whitelist_transfer {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, _bump: u8) -> ProgramResult {
        ctx.accounts.state.initializer = *ctx.accounts.initializer.key;
        Ok(())
    }

    pub fn add_mint(ctx: Context<AddMint>, _mint_bump: u8) -> ProgramResult {
        ctx.accounts.mint_pda.transferable = true;
        Ok(())
    }

    pub fn transfer(ctx: Context<Send>, _mint_bump: u8, amount: u64) -> ProgramResult {

        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .sender_token_account
                .to_account_info()
                .clone(),
            to: ctx.accounts.receiver_token_account.to_account_info().clone(),
            authority: ctx.accounts.sender.clone(),
        };

        token::transfer(
            CpiContext::new(ctx.accounts.token_program.clone(), cpi_accounts),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(_bump: u8)]
pub struct Initialize<'info> {
    #[account(mut, signer)]
    initializer: AccountInfo<'info>,
    #[account(
        init, 
        seeds = [b"state".as_ref()],
        bump = _bump,
        payer = initializer
    )]
    state: ProgramAccount<'info, State>,
    system_program: AccountInfo<'info>
}

#[derive(Accounts)]
#[instruction(_mint_bump: u8)]
pub struct AddMint<'info> {
    #[account(mut, signer)]
    initializer: AccountInfo<'info>,
    #[account(
        constraint = state.initializer == *initializer.key
    )]
    state: ProgramAccount<'info, State>,
    mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [mint.to_account_info().key.as_ref(), b"mint".as_ref()],
        bump = _mint_bump,
        payer = initializer
    )]
    mint_pda: ProgramAccount<'info, MintState>,
    rent: Sysvar<'info, Rent>,
    system_program: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(_mint_bump: u8, amount: u64)]
pub struct Send<'info> {
    #[account(mut, signer)]
    sender: AccountInfo<'info>,
    mint: Account<'info, Mint>,
    #[account(
        constraint = mint_pda.transferable == true,
        seeds = [mint.to_account_info().key.as_ref(), b"mint".as_ref()],
        bump = _mint_bump,
    )]
    mint_pda: ProgramAccount<'info, MintState>,
    #[account(
        mut,
        constraint = sender_token_account.amount >= amount
    )]
    sender_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    receiver_token_account: Account<'info, TokenAccount>,
    token_program: AccountInfo<'info>,
}

#[account]
#[derive(Default)]
pub struct State {
    pub initializer: Pubkey
}

#[account]
#[derive(Default)]
pub struct MintState {
    pub transferable: bool
}
