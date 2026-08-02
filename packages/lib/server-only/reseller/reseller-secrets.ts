import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { symmetricDecrypt, symmetricEncrypt } from '@documenso/lib/universal/crypto';

const encryptValue = (value: string) => {
  if (!DOCUMENSO_ENCRYPTION_KEY) {
    return value;
  }

  return symmetricEncrypt({
    key: DOCUMENSO_ENCRYPTION_KEY,
    data: value,
  });
};

const decryptValue = (value: string) => {
  if (!DOCUMENSO_ENCRYPTION_KEY) {
    return value;
  }

  try {
    const decrypted = symmetricDecrypt({
      key: DOCUMENSO_ENCRYPTION_KEY,
      data: value,
    });

    return Buffer.from(decrypted).toString('utf-8');
  } catch {
    // Existing plaintext values remain usable until re-saved.
    return value;
  }
};

export const encryptResellerSecret = (value: string) => encryptValue(value);

export const decryptResellerSecret = (value: string) => decryptValue(value);
