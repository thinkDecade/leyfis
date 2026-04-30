use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_program;

declare_id!("Cskp4zg7aDHvY4u2M7FyceqqcbvGThgo8WahvQCkQZVP");

// ═══════════════════════════════════════════════════════════════════════════
// SEEDS
// ═══════════════════════════════════════════════════════════════════════════

pub const VAULT_CONFIG_SEED:    &[u8] = b"vault_config";
pub const AUDIT_ENTRY_SEED:     &[u8] = b"audit_entry";
pub const ISSUER_REGISTRY_SEED: &[u8] = b"issuer_registry";
pub const ATTESTATION_SEED:     &[u8] = b"attestation";
pub const TREASURY_SEED:        &[u8] = b"treasury";
pub const TREASURY_CONFIG_SEED: &[u8] = b"treasury_config";

pub const DEFAULT_PROTOCOL_FEE_LAMPORTS: u64 = 5_000;

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT STRUCTS
// ═══════════════════════════════════════════════════════════════════════════

#[derive(InitSpace)]
#[account]
pub struct VaultConfig {
    pub authority:             Pubkey,
    pub vault_program:         Pubkey,
    pub min_tier:              u8,
    #[max_len(20)]
    pub trusted_issuers:       Vec<Pubkey>,
    #[max_len(20)]
    pub allowed_jurisdictions: Vec<[u8; 3]>,
    pub paused:                bool,
    pub registered_at:         i64,
    pub audit_nonce:           u64,
    pub bump:                  u8,
}

impl VaultConfig {
    pub fn space(num_issuers: usize, num_jurisdictions: usize) -> usize {
        8 + 32 + 32 + 1
        + 4 + num_issuers * 32
        + 4 + num_jurisdictions * 3
        + 1 + 8 + 8 + 1
    }
}

#[derive(InitSpace)]
#[account]
pub struct AuditEntry {
    pub wallet:         Pubkey,
    pub vault:          Pubkey,
    pub timestamp:      i64,
    pub slot:           u64,
    pub outcome:        GateOutcome,
    pub reason_code:    u8,
    pub attestation_id: Pubkey,
    pub tier:           u8,
    pub bump:           u8,
}

impl AuditEntry {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1 + 32 + 1 + 1;
}

#[derive(InitSpace)]
#[account]
pub struct TreasuryConfig {
    pub authority:       Pubkey,   // Leyfis deployer — only this wallet can withdraw or update
    pub fee_lamports:    u64,      // fee charged per approved gate() call
    pub total_collected: u64,      // running total (informational)
    pub last_updated:    i64,
    pub bump:            u8,
}

impl TreasuryConfig {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 1; // 65 bytes
}

#[derive(InitSpace)]
#[account]
pub struct IssuerRegistry {
    pub authority: Pubkey,
    #[max_len(50)]
    pub issuers:   Vec<IssuerEntry>,
    pub bump:      u8,
}

impl IssuerRegistry {
    pub fn space(num_issuers: usize) -> usize {
        8 + 32 + 4 + num_issuers * IssuerEntry::SIZE + 1
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct IssuerEntry {
    pub pubkey:     Pubkey,
    pub vault:      Pubkey,
    pub registered: i64,
    pub active:     bool,
}

impl IssuerEntry {
    pub const SIZE: usize = 32 + 32 + 8 + 1;
}

#[derive(InitSpace)]
#[account]
pub struct LeyfisAttestation {
    pub wallet:       Pubkey,
    pub issuer:       Pubkey,
    pub tier:         u8,
    pub issued_at:    i64,
    pub expires_at:   i64,
    pub kyc_ref:      [u8; 32],
    pub jurisdiction: [u8; 3],
    pub revoked:      bool,
    pub bump:         u8,
}

impl LeyfisAttestation {
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 8 + 32 + 3 + 1 + 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug, InitSpace)]
pub enum GateOutcome {
    Approved,
    Denied,
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════

#[event]
pub struct GateEvent {
    pub wallet:      Pubkey,
    pub vault:       Pubkey,
    pub outcome:     GateOutcome,
    pub reason_code: u8,
    pub tier:        u8,
    pub timestamp:   i64,
    pub slot:        u64,
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════

#[error_code]
pub enum LeyfisError {
    #[msg("Gate is paused by vault operator")]
    GatePaused,
    #[msg("No attestation found for this wallet")]
    NoAttestation,
    #[msg("Attestation has expired")]
    AttestationExpired,
    #[msg("Attestation has been revoked")]
    AttestationRevoked,
    #[msg("Issuer not in trusted issuers list")]
    UntrustedIssuer,
    #[msg("Clearance tier insufficient for this vault")]
    TierInsufficient,
    #[msg("Wallet jurisdiction not permitted for this vault")]
    JurisdictionBlocked,
    #[msg("Unauthorized: caller is not the vault authority")]
    Unauthorized,
    #[msg("Unauthorized: caller is not the super admin")]
    NotSuperAdmin,
    #[msg("Issuer not found in registry")]
    IssuerNotFound,
    #[msg("Invalid audit nonce: must equal vault_config.audit_nonce")]
    InvalidNonce,
    #[msg("Unauthorized: caller is not the treasury authority")]
    NotTreasuryAuthority,
    #[msg("Insufficient treasury balance for withdrawal")]
    InsufficientTreasuryBalance,
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRAM
// ═══════════════════════════════════════════════════════════════════════════

#[program]
pub mod leyfis_gate {
    use super::*;

    pub fn initialize_vault_config(
        ctx: Context<InitializeVaultConfig>,
        min_tier: u8,
        trusted_issuers: Vec<Pubkey>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let vc = &mut ctx.accounts.vault_config;
        vc.authority             = ctx.accounts.authority.key();
        vc.vault_program         = ctx.accounts.vault_program.key();
        vc.min_tier              = min_tier;
        vc.trusted_issuers       = trusted_issuers;
        vc.allowed_jurisdictions = vec![];
        vc.paused                = false;
        vc.registered_at         = clock.unix_timestamp;
        vc.audit_nonce           = 0;
        vc.bump                  = ctx.bumps.vault_config;
        msg!("VaultConfig initialized: vault={} min_tier={}", vc.vault_program, vc.min_tier);
        Ok(())
    }

    pub fn initialize_issuer_registry(ctx: Context<InitializeIssuerRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.issuer_registry;
        registry.authority = ctx.accounts.authority.key();
        registry.issuers   = vec![];
        registry.bump      = ctx.bumps.issuer_registry;
        msg!("IssuerRegistry initialized: authority={}", registry.authority);
        Ok(())
    }

    pub fn gate(
        ctx: Context<Gate>,
        vault_instruction_data: Vec<u8>,
        audit_nonce: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        let vault_program_key     = ctx.accounts.vault_config.vault_program;
        let paused                = ctx.accounts.vault_config.paused;
        let min_tier              = ctx.accounts.vault_config.min_tier;
        let trusted_issuers       = ctx.accounts.vault_config.trusted_issuers.clone();
        let allowed_jurisdictions = ctx.accounts.vault_config.allowed_jurisdictions.clone();
        let expected_nonce        = ctx.accounts.vault_config.audit_nonce;
        let wallet                = ctx.accounts.wallet.key();

        require_eq!(audit_nonce, expected_nonce, LeyfisError::InvalidNonce);

        // ── 1. Check paused ──────────────────────────────────────────────
        if paused {
            set_audit_entry(&mut ctx.accounts.audit_entry, wallet, vault_program_key,
                &clock, GateOutcome::Denied, 7, Pubkey::default(), 0, ctx.bumps.audit_entry);
            emit!(GateEvent { wallet, vault: vault_program_key, outcome: GateOutcome::Denied,
                reason_code: 7, tier: 0, timestamp: clock.unix_timestamp, slot: clock.slot });
            ctx.accounts.vault_config.audit_nonce += 1;
            return err!(LeyfisError::GatePaused);
        }

        // ── 2–8. Validate attestation ────────────────────────────────────
        let (attestation_id, tier, maybe_error_code) = validate_attestation(
            &ctx.accounts.attestation, wallet, min_tier,
            &trusted_issuers, &allowed_jurisdictions, &clock,
        );

        // ── 9. Write AuditEntry on failure ───────────────────────────────
        if let Some(code) = maybe_error_code {
            set_audit_entry(&mut ctx.accounts.audit_entry, wallet, vault_program_key,
                &clock, GateOutcome::Denied, code, attestation_id, tier, ctx.bumps.audit_entry);
            emit!(GateEvent { wallet, vault: vault_program_key, outcome: GateOutcome::Denied,
                reason_code: code, tier, timestamp: clock.unix_timestamp, slot: clock.slot });
            ctx.accounts.vault_config.audit_nonce += 1;
            return Err(reason_code_to_error(code));
        }

        // ── 10. CPI to vault program ──────────────────────────────────────
        let remaining = ctx.remaining_accounts.to_vec();
        let ix = Instruction {
            program_id: vault_program_key,
            accounts: remaining.iter().map(|a| anchor_lang::solana_program::instruction::AccountMeta {
                pubkey: a.key(), is_signer: a.is_signer, is_writable: a.is_writable,
            }).collect(),
            data: vault_instruction_data,
        };
        invoke(&ix, &remaining.iter().map(|a| a.to_account_info()).collect::<Vec<_>>())?;

        // ── 11. Collect protocol fee from caller ──────────────────────────
        let fee = ctx.accounts.treasury_config.fee_lamports;
        if fee > 0 {
            let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.wallet.key(),
                &ctx.accounts.treasury.key(),
                fee,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_ix,
                &[
                    ctx.accounts.wallet.to_account_info(),
                    ctx.accounts.treasury.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
            ctx.accounts.treasury_config.total_collected =
                ctx.accounts.treasury_config.total_collected.saturating_add(fee);
        }

        // ── 12. Write AuditEntry on approval ─────────────────────────────
        set_audit_entry(&mut ctx.accounts.audit_entry, wallet, vault_program_key,
            &clock, GateOutcome::Approved, 0, attestation_id, tier, ctx.bumps.audit_entry);
        emit!(GateEvent { wallet, vault: vault_program_key, outcome: GateOutcome::Approved,
            reason_code: 0, tier, timestamp: clock.unix_timestamp, slot: clock.slot });
        ctx.accounts.vault_config.audit_nonce += 1;

        msg!("Gate APPROVED: wallet={} tier={} fee_lamports={}", wallet, tier, fee);
        Ok(())
    }

    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        fee_lamports: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let tc = &mut ctx.accounts.treasury_config;
        tc.authority       = ctx.accounts.authority.key();
        tc.fee_lamports    = fee_lamports;
        tc.total_collected = 0;
        tc.last_updated    = clock.unix_timestamp;
        tc.bump            = ctx.bumps.treasury_config;
        msg!("Treasury initialized: fee_lamports={}", fee_lamports);
        Ok(())
    }

    pub fn update_treasury_config(
        ctx: Context<UpdateTreasury>,
        fee_lamports: Option<u64>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let tc = &mut ctx.accounts.treasury_config;
        require!(ctx.accounts.authority.key() == tc.authority, LeyfisError::NotTreasuryAuthority);
        if let Some(f) = fee_lamports { tc.fee_lamports = f; }
        tc.last_updated = clock.unix_timestamp;
        msg!("TreasuryConfig updated: fee_lamports={}", tc.fee_lamports);
        Ok(())
    }

    pub fn withdraw_treasury(
        ctx: Context<WithdrawTreasury>,
        amount_lamports: u64,
    ) -> Result<()> {
        let treasury_lamports = ctx.accounts.treasury.lamports();
        let rent = Rent::get()?.minimum_balance(0);
        require!(treasury_lamports.saturating_sub(rent) >= amount_lamports,
            LeyfisError::InsufficientTreasuryBalance);
        **ctx.accounts.treasury.try_borrow_mut_lamports()? -= amount_lamports;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount_lamports;
        msg!("Treasury withdrawal: {} lamports to {}", amount_lamports, ctx.accounts.authority.key());
        Ok(())
    }

    pub fn update_vault_config(
        ctx: Context<UpdateVaultConfig>,
        min_tier: Option<u8>,
        trusted_issuers: Option<Vec<Pubkey>>,
    ) -> Result<()> {
        let vc = &mut ctx.accounts.vault_config;
        if let Some(t) = min_tier       { vc.min_tier = t; }
        if let Some(i) = trusted_issuers { vc.trusted_issuers = i; }
        Ok(())
    }

    pub fn pause_gate(ctx: Context<ToggleGate>) -> Result<()> {
        ctx.accounts.vault_config.paused = true;
        msg!("Gate PAUSED by {}", ctx.accounts.authority.key());
        Ok(())
    }

    pub fn unpause_gate(ctx: Context<ToggleGate>) -> Result<()> {
        ctx.accounts.vault_config.paused = false;
        msg!("Gate UNPAUSED by {}", ctx.accounts.authority.key());
        Ok(())
    }

    pub fn register_issuer(
        ctx: Context<ManageIssuer>,
        issuer_pubkey: Pubkey,
        vault_pubkey: Pubkey,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.issuer_registry;
        registry.issuers.retain(|e| e.pubkey != issuer_pubkey);
        registry.issuers.push(IssuerEntry { pubkey: issuer_pubkey, vault: vault_pubkey,
            registered: clock.unix_timestamp, active: true });
        msg!("Issuer registered: {} for vault {}", issuer_pubkey, vault_pubkey);
        Ok(())
    }

    pub fn revoke_issuer(
        ctx: Context<ManageIssuer>,
        issuer_pubkey: Pubkey,
        _vault_pubkey: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.issuer_registry;
        let entry = registry.issuers.iter_mut()
            .find(|e| e.pubkey == issuer_pubkey)
            .ok_or(LeyfisError::IssuerNotFound)?;
        entry.active = false;
        msg!("Issuer revoked: {}", issuer_pubkey);
        Ok(())
    }

    pub fn issue_test_attestation(
        ctx: Context<IssueTestAttestation>,
        tier: u8,
        expires_at: i64,
        kyc_ref: [u8; 32],
        jurisdiction: [u8; 3],
    ) -> Result<()> {
        let clock = Clock::get()?;
        let att = &mut ctx.accounts.attestation;
        att.wallet       = ctx.accounts.wallet.key();
        att.issuer       = ctx.accounts.issuer.key();
        att.tier         = tier;
        att.issued_at    = clock.unix_timestamp;
        att.expires_at   = expires_at;
        att.kyc_ref      = kyc_ref;
        att.jurisdiction = jurisdiction;
        att.revoked      = false;
        att.bump         = ctx.bumps.attestation;
        msg!("Attestation issued: wallet={} tier={}", att.wallet, tier);
        Ok(())
    }

    pub fn revoke_attestation(ctx: Context<RevokeAttestation>) -> Result<()> {
        ctx.accounts.attestation.revoked = true;
        msg!("Attestation revoked: wallet={}", ctx.accounts.attestation.wallet);
        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

fn validate_attestation(
    attestation_info: &AccountInfo,
    wallet: Pubkey,
    min_tier: u8,
    trusted_issuers: &[Pubkey],
    allowed_jurisdictions: &[[u8; 3]],
    clock: &Clock,
) -> (Pubkey, u8, Option<u8>) {
    if attestation_info.data_is_empty() || *attestation_info.owner == system_program::ID {
        return (Pubkey::default(), 0, Some(1));
    }
    // Manually deserialize — avoids lifetime issues with Account::try_from and
    // also mirrors real SAS usage where the account is owned by a different program.
    // LeyfisAttestation derives AnchorDeserialize (borsh), skip the 8-byte discriminator.
    let data = match attestation_info.try_borrow_data() {
        Ok(d)  => d,
        Err(_) => return (Pubkey::default(), 0, Some(1)),
    };
    if data.len() < 8 { return (Pubkey::default(), 0, Some(1)); }
    let att: LeyfisAttestation = match AnchorDeserialize::deserialize(&mut &data[8..]) {
        Ok(a)  => a,
        Err(_) => return (Pubkey::default(), 0, Some(1)),
    };
    if att.wallet != wallet { return (Pubkey::default(), 0, Some(1)); }
    let attestation_id = attestation_info.key();
    let tier           = att.tier;
    if att.revoked                                                              { return (attestation_id, tier, Some(3)); }
    if att.expires_at != 0 && clock.unix_timestamp > att.expires_at            { return (attestation_id, tier, Some(2)); }
    if !trusted_issuers.contains(&att.issuer)                                  { return (attestation_id, tier, Some(4)); }
    if tier < min_tier                                                          { return (attestation_id, tier, Some(5)); }
    if !allowed_jurisdictions.is_empty() && !allowed_jurisdictions.contains(&att.jurisdiction) {
        return (attestation_id, tier, Some(6));
    }
    (attestation_id, tier, None)
}

fn set_audit_entry(
    entry: &mut Account<AuditEntry>,
    wallet: Pubkey, vault: Pubkey, clock: &Clock,
    outcome: GateOutcome, reason_code: u8,
    attestation_id: Pubkey, tier: u8, bump: u8,
) {
    entry.wallet         = wallet;
    entry.vault          = vault;
    entry.timestamp      = clock.unix_timestamp;
    entry.slot           = clock.slot;
    entry.outcome        = outcome;
    entry.reason_code    = reason_code;
    entry.attestation_id = attestation_id;
    entry.tier           = tier;
    entry.bump           = bump;
}

fn reason_code_to_error(code: u8) -> Error {
    match code {
        1 => error!(LeyfisError::NoAttestation),
        2 => error!(LeyfisError::AttestationExpired),
        3 => error!(LeyfisError::AttestationRevoked),
        4 => error!(LeyfisError::UntrustedIssuer),
        5 => error!(LeyfisError::TierInsufficient),
        6 => error!(LeyfisError::JurisdictionBlocked),
        7 => error!(LeyfisError::GatePaused),
        _ => error!(LeyfisError::NoAttestation),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(min_tier: u8, trusted_issuers: Vec<Pubkey>)]
pub struct InitializeVaultConfig<'info> {
    #[account(init, payer = authority,
        space = VaultConfig::space(trusted_issuers.len(), 0),
        seeds = [VAULT_CONFIG_SEED, vault_program.key().as_ref()], bump)]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: target vault program — we only store its pubkey
    pub vault_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeIssuerRegistry<'info> {
    #[account(init, payer = authority,
        space = IssuerRegistry::space(20),
        seeds = [ISSUER_REGISTRY_SEED], bump)]
    pub issuer_registry: Account<'info, IssuerRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(vault_instruction_data: Vec<u8>, audit_nonce: u64)]
pub struct Gate<'info> {
    #[account(mut, seeds = [VAULT_CONFIG_SEED, vault_config.vault_program.as_ref()],
        bump = vault_config.bump)]
    pub vault_config: Account<'info, VaultConfig>,
    /// CHECK: attestation PDA — deserialized manually in validate_attestation
    pub attestation: UncheckedAccount<'info>,
    #[account(init, payer = wallet, space = AuditEntry::SPACE,
        seeds = [AUDIT_ENTRY_SEED, vault_config.key().as_ref(), &audit_nonce.to_le_bytes()], bump)]
    pub audit_entry: Account<'info, AuditEntry>,
    #[account(mut)]
    pub wallet: Signer<'info>,
    /// CHECK: target vault program — CPI destination
    pub vault_program: UncheckedAccount<'info>,
    /// CHECK: treasury PDA — receives protocol fee lamports on approved calls
    #[account(mut, seeds = [TREASURY_SEED], bump)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, seeds = [TREASURY_CONFIG_SEED], bump = treasury_config.bump)]
    pub treasury_config: Account<'info, TreasuryConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(init, payer = authority, space = TreasuryConfig::SPACE,
        seeds = [TREASURY_CONFIG_SEED], bump)]
    pub treasury_config: Account<'info, TreasuryConfig>,
    /// CHECK: treasury PDA — will hold SOL, owned by system program after creation
    #[account(mut, seeds = [TREASURY_SEED], bump)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(mut, seeds = [TREASURY_CONFIG_SEED], bump = treasury_config.bump,
        has_one = authority @ LeyfisError::NotTreasuryAuthority)]
    pub treasury_config: Account<'info, TreasuryConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(seeds = [TREASURY_CONFIG_SEED], bump = treasury_config.bump,
        has_one = authority @ LeyfisError::NotTreasuryAuthority)]
    pub treasury_config: Account<'info, TreasuryConfig>,
    /// CHECK: treasury PDA — lamports withdrawn from here
    #[account(mut, seeds = [TREASURY_SEED], bump)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    #[account(mut, seeds = [VAULT_CONFIG_SEED, vault_config.vault_program.as_ref()],
        bump = vault_config.bump, has_one = authority @ LeyfisError::Unauthorized)]
    pub vault_config: Account<'info, VaultConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ToggleGate<'info> {
    #[account(mut, seeds = [VAULT_CONFIG_SEED, vault_config.vault_program.as_ref()],
        bump = vault_config.bump, has_one = authority @ LeyfisError::Unauthorized)]
    pub vault_config: Account<'info, VaultConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ManageIssuer<'info> {
    #[account(mut, seeds = [ISSUER_REGISTRY_SEED], bump = issuer_registry.bump,
        has_one = authority @ LeyfisError::NotSuperAdmin)]
    pub issuer_registry: Account<'info, IssuerRegistry>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct IssueTestAttestation<'info> {
    #[account(init, payer = issuer, space = LeyfisAttestation::SPACE,
        seeds = [ATTESTATION_SEED, wallet.key().as_ref(), issuer.key().as_ref()], bump)]
    pub attestation: Account<'info, LeyfisAttestation>,
    /// CHECK: wallet receiving the attestation
    pub wallet: UncheckedAccount<'info>,
    #[account(mut)]
    pub issuer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAttestation<'info> {
    #[account(mut, seeds = [ATTESTATION_SEED, attestation.wallet.as_ref(), issuer.key().as_ref()],
        bump = attestation.bump,
        constraint = attestation.issuer == issuer.key() @ LeyfisError::Unauthorized)]
    pub attestation: Account<'info, LeyfisAttestation>,
    pub issuer: Signer<'info>,
}
