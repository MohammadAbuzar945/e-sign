import { vi } from 'vitest';

vi.mock('@documenso/email/mailer', () => ({
  mailer: {
    sendMail: vi.fn().mockResolvedValue(undefined),
  },
}));
