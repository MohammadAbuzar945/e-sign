import { describe, expect, it } from 'vitest';

import {
  isResellerFeatureAllowedEmail,
  RESELLER_MIN_CREDITS_USED,
  RESELLER_MIN_SUBSCRIPTION_MONTHS,
} from '@documenso/lib/constants/esign-credit-packages';
import {
  buildAffiliateUrl,
  getSuggestedAffiliateSlug,
  normalizeAffiliateSlugInput,
  validateAffiliateSlug,
} from '@documenso/lib/utils/affiliate-slug';
import { buildResellerApplicationTermsCompletionWhere } from '@documenso/lib/server-only/reseller/activate-reseller-from-terms-completion';
import { buildResellerTransactionsCsv } from '@documenso/lib/utils/build-reseller-transactions-csv';
import {
  calculateResellerNetAmountInCents,
  calculateResellerVatAmountInCents,
  resolveResellerVatAmountInCents,
} from '@documenso/lib/utils/reseller-vat';

describe('reseller credits helpers', () => {
  it('returns zero when balance is not negative', async () => {
    const { getNegativeCreditsUsed } = await import('@documenso/lib/utils/reseller-credits');

    expect(getNegativeCreditsUsed(100)).toBe(0);
    expect(getNegativeCreditsUsed(0)).toBe(0);
  });

  it('returns absolute deficit when balance is negative', async () => {
    const { getNegativeCreditsUsed } = await import('@documenso/lib/utils/reseller-credits');

    expect(getNegativeCreditsUsed(-150)).toBe(150);
  });
});

describe('reseller constants', () => {
  it('defines qualification thresholds', () => {
    expect(RESELLER_MIN_CREDITS_USED).toBe(50);
    expect(RESELLER_MIN_SUBSCRIPTION_MONTHS).toBe(2);
  });

  it('matches reseller feature allowed emails case-insensitively', () => {
    expect(isResellerFeatureAllowedEmail('nomiadeveloper@Gmail.com')).toBe(true);
    expect(isResellerFeatureAllowedEmail('awanabuzar945@gmail.com')).toBe(true);
    expect(isResellerFeatureAllowedEmail('other@example.com')).toBe(false);
  });

  it('allows seeded E2E test emails outside production', () => {
    expect(isResellerFeatureAllowedEmail('reseller-e2e@test.documenso.com')).toBe(true);
  });
});

describe('reseller VAT calculations', () => {
  it('returns zero VAT when no VAT number is configured', () => {
    expect(calculateResellerVatAmountInCents(45000, null)).toBe(0);
    expect(calculateResellerVatAmountInCents(45000, '   ')).toBe(0);
  });

  it('calculates inclusive VAT for registered resellers', () => {
    expect(calculateResellerVatAmountInCents(45000, '4123456789')).toBe(5870);
    expect(calculateResellerNetAmountInCents(45000, 5870)).toBe(39130);
  });

  it('prefers stored VAT values when already recorded', () => {
    expect(resolveResellerVatAmountInCents(45000, 5869, '4123456789')).toBe(5869);
    expect(resolveResellerVatAmountInCents(45000, 0, '4123456789')).toBe(5870);
  });
});

describe('reseller transaction CSV export', () => {
  it('includes reseller metadata and invoice columns', () => {
    const csv = buildResellerTransactionsCsv({
      resellerOrganisationName: 'Nomia Creator',
      resellerVatNumber: '4123456789',
      rows: [
        {
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          completedAt: new Date('2026-07-03T10:05:00.000Z'),
          purchaserName: 'Jane Buyer',
          purchaserEmail: 'jane@example.com',
          purchaserOrganisationName: 'Buyer Org',
          credits: 50,
          grossAmount: 45000,
          vatAmount: 5870,
          currency: 'ZAR',
          paystackReference: 'ref_123',
          status: 'COMPLETED',
        },
      ],
    });

    expect(csv).toContain('Reseller,"Nomia Creator"');
    expect(csv).toContain('Reseller VAT Number,"4123456789"');
    expect(csv).toContain('Jane Buyer');
    expect(csv).toContain('58.70');
    expect(csv).toContain('391.30');
    expect(csv).toContain('ref_123');
  });
});

describe('affiliate slug validation', () => {
  it('normalizes user input into a URL-safe slug', () => {
    expect(normalizeAffiliateSlugInput(' Acme Corp! ')).toBe('acme-corp');
    expect(normalizeAffiliateSlugInput('ACME__CORP')).toBe('acme-corp');
  });

  it('accepts valid affiliate slugs', () => {
    expect(validateAffiliateSlug('acme-corp')).toEqual({
      valid: true,
      slug: 'acme-corp',
    });
  });

  it('rejects reserved and invalid affiliate slugs', () => {
    expect(validateAffiliateSlug('admin').valid).toBe(false);
    expect(validateAffiliateSlug('ab').valid).toBe(false);
    expect(validateAffiliateSlug('@@').valid).toBe(false);
  });

  it('suggests organisation URLs as affiliate slugs', () => {
    expect(getSuggestedAffiliateSlug('acme-corp')).toBe('acme-corp');
    expect(getSuggestedAffiliateSlug('ab')).toBe('');
  });

  it('builds affiliate URLs from slugs', () => {
    expect(buildAffiliateUrl('acme-corp', 'https://example.com')).toBe(
      'https://example.com/r/acme-corp',
    );
  });
});

describe('reseller terms completion matching', () => {
  it('matches applications by signed envelope id', () => {
    const where = buildResellerApplicationTermsCompletionWhere({
      envelopeId: 'envelope_abc',
    });

    expect(where).toEqual({
      status: {
        in: ['TERMS_SENT', 'TERMS_COMPLETED'],
      },
      OR: [{ termsEnvelopeId: 'envelope_abc' }],
    });
  });

  it('matches applications by DocGen external id', () => {
    const where = buildResellerApplicationTermsCompletionWhere({
      envelopeId: 'envelope_abc',
      envelopeExternalId: 'application_123',
    });

    expect(where.OR).toEqual([
      { termsEnvelopeId: 'envelope_abc' },
      { id: 'application_123' },
      { externalDocGenRequestId: 'application_123' },
      { termsEnvelopeId: 'application_123' },
    ]);
  });

  it('matches applications by envelope secondary id', () => {
    const where = buildResellerApplicationTermsCompletionWhere({
      envelopeId: 'envelope_abc',
      envelopeSecondaryId: 'secondary_123',
    });

    expect(where.OR).toEqual([
      { termsEnvelopeId: 'envelope_abc' },
      { termsEnvelopeId: 'secondary_123' },
    ]);
  });
});

describe('reseller DocGen template variables', () => {
  it('builds payload rows from fetched template metadata', async () => {
    const { buildVariableValuesRows } = await import('@documenso/lib/server-only/nomia-docgen');

    const templateVariables = [
      {
        id: 1,
        variable_name: 'Preparedby',
        default_value: 'Jane Doe',
        field_type: 'NAME',
        fillable_field: false,
        content_format: '{}',
        document_template_id: 839,
      },
      {
        id: 2,
        variable_name: 'ClientSig',
        default_value: '',
        field_type: 'NAME',
        fillable_field: true,
        content_format:
          '{"type":"SIGNATURE","signatory":1,"sendForEsign":true,"role":"SIGNER"}',
        document_template_id: 839,
      },
    ];

    const rows = buildVariableValuesRows(
      templateVariables,
      {
        Preparedby: 'Applicant Name',
      },
      true,
    );

    expect(rows).toEqual([
      {
        variable_name: 'Preparedby',
        value: 'Applicant Name',
        type: 'TEXT',
        signatory: 1,
      },
      {
        variable_name: 'ClientSig',
        value: '',
        type: 'SIGNATURE',
        signatory: 1,
      },
    ]);
  });
});

describe('Paystack reseller webhook metadata', () => {
  it('coerces string metadata numbers from Paystack', async () => {
    const { coercePaystackMetadataNumber } = await import(
      '@documenso/lib/server-only/reseller/process-reseller-paystack-webhook'
    );

    expect(coercePaystackMetadataNumber('45000')).toBe(45000);
    expect(coercePaystackMetadataNumber(45000)).toBe(45000);
    expect(coercePaystackMetadataNumber('5')).toBe(5);
    expect(coercePaystackMetadataNumber(undefined)).toBeUndefined();
    expect(coercePaystackMetadataNumber('')).toBeUndefined();
  });
});

describe('transferOrganisationCredits validation', () => {
  it('rejects non-positive transfer amounts', async () => {
    const { transferOrganisationCredits } = await import(
      '@documenso/ee/server-only/limits/user-credits'
    );

    await expect(
      transferOrganisationCredits({
        fromOrganisationId: 'org_a',
        toOrganisationId: 'org_b',
        amount: 0,
      }),
    ).rejects.toThrow('Transfer amount must be positive');
  });

  it('rejects transfers to the same organisation', async () => {
    const { transferOrganisationCredits } = await import(
      '@documenso/ee/server-only/limits/user-credits'
    );

    await expect(
      transferOrganisationCredits({
        fromOrganisationId: 'org_a',
        toOrganisationId: 'org_a',
        amount: 10,
      }),
    ).rejects.toThrow('Cannot transfer credits to the same organisation');
  });
});
