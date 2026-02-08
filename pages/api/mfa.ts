import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';

// ==================================================================================
// MFA FAILURE TRACKING - Requirements: 9.4
// ==================================================================================

// MFA failure tracking (in-memory, production should use Redis)
const mfaFailureTracker = new Map<string, { count: number; lastAttempt: number }>();
const MFA_FAILURE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MFA_MAX_FAILURES = 5;

/**
 * Log MFA-related events for security monitoring (SIEM)
 * Requirements: 9.4 - Log MFA verification failures
 */
function logMfaEvent(
  eventType:
    | 'MFA_SETUP_INITIATED'
    | 'MFA_SETUP_COMPLETED'
    | 'MFA_VERIFY_SUCCESS'
    | 'MFA_VERIFY_FAILURE'
    | 'MFA_LOCKOUT',
  userId: string,
  details: Record<string, unknown> = {}
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType: `auth.mfa.${eventType.toLowerCase()}`,
    userId,
    ...details,
  };

  // Use structured logging for SIEM integration
  this.logger.log(`SIEM LOG: ${JSON.stringify(logEntry)}`);
}

/**
 * Track MFA verification failures
 * Requirements: 9.4 - Increment failure counter
 * Returns true if the user should be locked out
 */
function trackMfaFailure(
  userId: string,
  reason: string
): { isLocked: boolean; failureCount: number; remainingAttempts: number } {
  const now = Date.now();
  const existing = mfaFailureTracker.get(userId);

  if (existing && now - existing.lastAttempt < MFA_FAILURE_WINDOW_MS) {
    // Within window, increment counter
    existing.count += 1;
    existing.lastAttempt = now;

    const remainingAttempts = Math.max(0, MFA_MAX_FAILURES - existing.count);

    if (existing.count >= MFA_MAX_FAILURES) {
      logMfaEvent('MFA_LOCKOUT', userId, {
        failureCount: existing.count,
        reason,
        windowMs: MFA_FAILURE_WINDOW_MS,
        lockoutExpiresAt: new Date(now + MFA_FAILURE_WINDOW_MS).toISOString(),
      });
      return { isLocked: true, failureCount: existing.count, remainingAttempts: 0 };
    }

    logMfaEvent('MFA_VERIFY_FAILURE', userId, {
      failureCount: existing.count,
      reason,
      remainingAttempts,
    });
    return { isLocked: false, failureCount: existing.count, remainingAttempts };
  }

  // Reset or create new tracker
  mfaFailureTracker.set(userId, { count: 1, lastAttempt: now });
  logMfaEvent('MFA_VERIFY_FAILURE', userId, {
    failureCount: 1,
    reason,
    remainingAttempts: MFA_MAX_FAILURES - 1,
  });
  return { isLocked: false, failureCount: 1, remainingAttempts: MFA_MAX_FAILURES - 1 };
}

/**
 * Clear MFA failure tracking for a user (called after successful verification)
 */
function clearMfaFailures(userId: string): void {
  mfaFailureTracker.delete(userId);
}

/**
 * Check if user is locked out due to MFA failures
 */
function isMfaLockedOut(userId: string): { isLocked: boolean; remainingLockoutMs: number } {
  const existing = mfaFailureTracker.get(userId);
  if (!existing) return { isLocked: false, remainingLockoutMs: 0 };

  const now = Date.now();
  const timeSinceLastAttempt = now - existing.lastAttempt;

  if (timeSinceLastAttempt >= MFA_FAILURE_WINDOW_MS) {
    // Window expired, clear tracker
    mfaFailureTracker.delete(userId);
    return { isLocked: false, remainingLockoutMs: 0 };
  }

  if (existing.count >= MFA_MAX_FAILURES) {
    return {
      isLocked: true,
      remainingLockoutMs: MFA_FAILURE_WINDOW_MS - timeSinceLastAttempt,
    };
  }

  return { isLocked: false, remainingLockoutMs: 0 };
}

// ==================================================================================
// MOCK VAULT & DATABASE - In a real app, these would be external services.
// ==================================================================================

const vault = {
  secrets: new Map<string, string>(),
  write: async (path: string, data: { secret: string }) => {
    this.logger.log(`VAULT WRITE: Storing secret at ${path}`);
    vault.secrets.set(path, data.secret);
    return { success: true };
  },
  read: async (path: string) => {
    this.logger.log(`VAULT READ: Reading secret from ${path}`);
    return vault.secrets.has(path) ? { data: { secret: vault.secrets.get(path) } } : null;
  },
};

const db = {
  users: new Map<string, any>([
    [
      'user-123-superadmin',
      {
        id: 'user-123-superadmin',
        email: 'superadmin@example.com',
        role: 'SUPER_ADMIN',
        isMfaEnabled: false,
        mfaVaultSecretId: null,
      },
    ],
  ]),
  mfaRecoveryCodes: new Map<string, any[]>(),

  updateUserMfa: async (userId: string, mfaVaultSecretId: string, isMfaEnabled: boolean) => {
    const user = db.users.get(userId);
    if (user) {
      user.isMfaEnabled = isMfaEnabled;
      user.mfaVaultSecretId = mfaVaultSecretId;
      this.logger.log(`DB UPDATE: User ${userId} MFA status updated to ${isMfaEnabled}`);
    }
  },

  saveRecoveryCodes: async (userId: string, codes: { codeHash: string }[]) => {
    db.mfaRecoveryCodes.set(userId, codes);
    this.logger.log(`DB UPDATE: Saved ${codes.length} recovery codes for user ${userId}`);
  },
};

// ==================================================================================
// API HANDLERS
// ==================================================================================

async function handleGenerate(req: NextApiRequest, res: NextApiResponse) {
  const { userId, email } = req.body; // Assume userId and email are sent from the frontend session

  if (!userId || !email) {
    return res.status(400).json({ error: 'User ID and email are required.' });
  }

  try {
    // 1. Generate a new TOTP secret
    const secret = authenticator.generateSecret();
    const serviceName = 'NextGen-Marketplace';
    const otpauth = authenticator.keyuri(email, serviceName, secret);
    const mfaVaultSecretId = `mfa/users/${userId}`;

    // 2. Store the secret in Vault (NEVER in the database)
    await vault.write(mfaVaultSecretId, { secret });

    // 3. Generate a QR code data URL
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    logMfaEvent('MFA_SETUP_INITIATED', userId, { email });

    // 4. Send the otpauth URL and the Vault path ID back to the client
    res.status(200).json({ otpAuthUrl: otpauth, qrCodeDataUrl, mfaVaultSecretId });
  } catch (error) {
    console.error('Error generating MFA secret:', error);
    res.status(500).json({ error: 'Could not generate MFA secret.' });
  }
}

async function handleVerify(req: NextApiRequest, res: NextApiResponse) {
  const { userId, mfaVaultSecretId, token } = req.body;

  if (!userId || !mfaVaultSecretId || !token) {
    return res.status(400).json({ error: 'User ID, Vault secret ID, and token are required.' });
  }

  // Check if user is locked out due to too many failures
  const lockoutStatus = isMfaLockedOut(userId);
  if (lockoutStatus.isLocked) {
    const remainingMinutes = Math.ceil(lockoutStatus.remainingLockoutMs / 1000 / 60);
    logMfaEvent('MFA_LOCKOUT', userId, {
      reason: 'Account locked due to too many failed MFA attempts',
      remainingMinutes,
    });
    return res.status(429).json({
      error: `Account is temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`,
      isLocked: true,
      remainingMinutes,
    });
  }

  try {
    // 1. Retrieve the secret from Vault
    const vaultResponse = await vault.read(mfaVaultSecretId);
    if (!vaultResponse?.data?.secret) {
      const failureResult = trackMfaFailure(userId, 'Secret not found in Vault');
      return res.status(400).json({
        error: 'MFA secret not found or expired. Please restart setup.',
        remainingAttempts: failureResult.remainingAttempts,
        isLocked: failureResult.isLocked,
      });
    }
    const secret = vaultResponse.data.secret;

    // 2. Verify the token using otplib
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      const failureResult = trackMfaFailure(userId, 'Invalid token');
      return res.status(400).json({
        error: 'Invalid authentication code.',
        remainingAttempts: failureResult.remainingAttempts,
        isLocked: failureResult.isLocked,
      });
    }

    // Clear failure tracking on successful verification
    clearMfaFailures(userId);

    // 3. Generate and hash recovery codes
    const recoveryCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    const hashedRecoveryCodes = recoveryCodes.map((code) => ({
      codeHash: crypto.createHash('sha256').update(code).digest('hex'),
    }));

    // 4. Update the user record to enable MFA and store recovery codes
    await db.updateUserMfa(userId, mfaVaultSecretId, true);
    await db.saveRecoveryCodes(userId, hashedRecoveryCodes);

    logMfaEvent('MFA_SETUP_COMPLETED', userId, {
      recoveryCodesGenerated: recoveryCodes.length,
    });

    // 5. Return the plaintext recovery codes to the user *only this one time*
    res.status(200).json({ success: true, recoveryCodes });
  } catch (error) {
    console.error('Error verifying MFA token:', error);
    res.status(500).json({ error: 'An error occurred during verification.' });
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST' && req.body.action === 'generate') {
    return handleGenerate(req, res);
  }
  if (req.method === 'POST' && req.body.action === 'verify') {
    return handleVerify(req, res);
  }

  res.setHeader('Allow', ['POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
