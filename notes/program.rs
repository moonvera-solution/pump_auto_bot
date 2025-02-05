use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;
use mpl_token_metadata::instruction::create_metadata_accounts_v2;

declare_id!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

#[program]
pub mod pump {
    use super::*;

    // Initialize the global state
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let global = &mut ctx.accounts.global;
        global.initialized = true;
        global.authority = *ctx.accounts.user.key;
        Ok(())
    }

    // Set global parameters
    pub fn set_params(
        ctx: Context<SetParams>,
        fee_recipient: Pubkey,
        initial_virtual_token_reserves: u64,
        initial_virtual_sol_reserves: u64,
        initial_real_token_reserves: u64,
        token_total_supply: u64,
        fee_basis_points: u64,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global;
        global.fee_recipient = fee_recipient;
        global.initial_virtual_token_reserves = initial_virtual_token_reserves;
        global.initial_virtual_sol_reserves = initial_virtual_sol_reserves;
        global.initial_real_token_reserves = initial_real_token_reserves;
        global.token_total_supply = token_total_supply;
        global.fee_basis_points = fee_basis_points;
        Ok(())
    }

    // Create a new coin and bonding curve
    pub fn create(
        ctx: Context<Create>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let mint = &mut ctx.accounts.mint;
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let metadata = &mut ctx.accounts.metadata;

        // Initialize bonding curve
        bonding_curve.virtual_token_reserves = 0;
        bonding_curve.virtual_sol_reserves = 0;
        bonding_curve.real_token_reserves = 0;
        bonding_curve.real_sol_reserves = 0;
        bonding_curve.token_total_supply = 0;
        bonding_curve.complete = false;

        // Create metadata for the token
        let cpi_ctx = CpiContext::new(
            ctx.accounts.mpl_token_metadata.to_account_info(),
            create_metadata_accounts_v2(
                ctx.accounts.mpl_token_metadata.key(),
                mint.key(),
                ctx.accounts.user.key(),
                ctx.accounts.user.key(),
                ctx.accounts.user.key(),
                name,
                symbol,
                uri,
                None,
                0,
                true,
                false,
                None,
                None,
            ),
        );
        mpl_token_metadata::instruction::create_metadata_accounts_v2(cpi_ctx)?;

        Ok(())
    }

    // Buy tokens from the bonding curve
    pub fn buy(ctx: Context<Buy>, amount: u64, max_sol_cost: u64) -> Result<()> {
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let user = &mut ctx.accounts.user;

        // Implement buy logic here
        // ...

        Ok(())
    }

    // Sell tokens into the bonding curve
    pub fn sell(ctx: Context<Sell>, amount: u64, min_sol_output: u64) -> Result<()> {
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let user = &mut ctx.accounts.user;

        // Implement sell logic here
        // ...

        Ok(())
    }

    // Withdraw liquidity
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let user = &mut ctx.accounts.user;

        // Implement withdraw logic here
        // ...

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + Global::LEN)]
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetParams<'info> {
    #[account(mut, has_one = authority)]
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub event_authority: AccountInfo<'info>,
    pub program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    pub mint_authority: AccountInfo<'info>,
    #[account(init, payer = user, space = 8 + BondingCurve::LEN)]
    pub bonding_curve: Account<'info, BondingCurve>,
    #[account(mut)]
    pub associated_bonding_curve: AccountInfo<'info>,
    pub global: Account<'info, Global>,
    pub mpl_token_metadata: AccountInfo<'info>,
    #[account(mut)]
    pub metadata: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    pub event_authority: AccountInfo<'info>,
    pub program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub fee_recipient: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    #[account(mut)]
    pub associated_bonding_curve: AccountInfo<'info>,
    #[account(mut)]
    pub associated_user: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub event_authority: AccountInfo<'info>,
    pub program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub fee_recipient: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    #[account(mut)]
    pub associated_bonding_curve: AccountInfo<'info>,
    #[account(mut)]
    pub associated_user: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub event_authority: AccountInfo<'info>,
    pub program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub global: Account<'info, Global>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    #[account(mut)]
    pub associated_bonding_curve: AccountInfo<'info>,
    #[account(mut)]
    pub associated_user: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub event_authority: AccountInfo<'info>,
    pub program: AccountInfo<'info>,
}

#[account]
pub struct Global {
    pub initialized: bool,
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub initial_virtual_token_reserves: u64,
    pub initial_virtual_sol_reserves: u64,
    pub initial_real_token_reserves: u64,
    pub token_total_supply: u64,
    pub fee_basis_points: u64,
}

impl Global {
    pub const LEN: usize = 1 + 32 + 32 + 8 + 8 + 8 + 8 + 8;
}

#[account]
pub struct BondingCurve {
    pub virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub token_total_supply: u64,
    pub complete: bool,
}

impl BondingCurve {
    pub const LEN: usize = 8 + 8 + 8 + 8 + 8 + 1;
}