use anchor_lang::prelude::*;

declare_id!("88x1hxWW6mMDpQQwuR3sCDgnmbHwHmQBdWYZQhcedNaJ"); // TODO: replace after `anchor deploy --provider.cluster devnet`

/// Test Vault Program
/// ──────────────────
/// Minimal vault used only for demo / testing.
/// The Gate Program CPIs into this program after attestation passes.
/// In production you would wrap a real DeFi vault (e.g. Kamino, MarginFi).

#[program]
pub mod test_vault {
    use super::*;

    /// Initialize the vault state account. Called once by the operator.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_state;
        vault.operator       = ctx.accounts.operator.key();
        vault.interaction_count = 0;
        vault.bump           = ctx.bumps.vault_state;
        msg!("TestVault initialized by {}", vault.operator);
        Ok(())
    }

    /// Vault interaction — this is what the Gate Program CPIs into.
    /// Increments a counter so we can verify the CPI actually executed.
    pub fn interact(ctx: Context<Interact>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_state;
        vault.interaction_count += 1;
        msg!(
            "TestVault interaction #{} by {}",
            vault.interaction_count,
            ctx.accounts.user.key()
        );
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────
// ACCOUNT STRUCTS
// ─────────────────────────────────────────────────────────────────────────

#[account]
pub struct VaultState {
    pub operator:          Pubkey,
    pub interaction_count: u64,
    pub bump:              u8,
}

impl VaultState {
    pub const SPACE: usize = 8 + 32 + 8 + 1; // discriminator + fields
}

// ─────────────────────────────────────────────────────────────────────────
// INSTRUCTION CONTEXTS
// ─────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = operator,
        space = VaultState::SPACE,
        seeds = [b"vault_state"],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub operator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Interact<'info> {
    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    /// The user wallet — must be a signer.
    /// In the Gate flow this is the wallet that called gate().
    pub user: Signer<'info>,
}
