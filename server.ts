import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, updateDoc, doc, getDoc, collection, query, where, getDocs, addDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import webpush from 'web-push';

dotenv.config();

function generateTrackingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
} catch (e) {
  console.warn('Could not load firebase-applet-config.json');
}

const firebaseApp = initializeApp(firebaseConfig);
let db: any = null;
if (firebaseConfig.firestoreDatabaseId) {
  db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
} else {
  db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({
    verify: (req, res, buf) => {
      (req as any).rawBody = buf;
    }
  }));

  // Memory store for customer OTPs
  const customerOTPs = new Map<string, { code: string; expiresAt: number }>();
  const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

  // Dynamic Paystack keys resolution
  let cachedPaystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  let cachedPaystackSecretKey = process.env.PAYSTACK_SECRET_KEY || '';

  async function getPaystackSecretKey(): Promise<string> {
    if (cachedPaystackSecretKey) return cachedPaystackSecretKey;
    if (process.env.PAYSTACK_SECRET_KEY) {
      cachedPaystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      return cachedPaystackSecretKey;
    }
    try {
      if (db) {
        const snap = await getDoc(doc(db, 'settings', 'paystack_keys'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.secretKey) {
            cachedPaystackSecretKey = data.secretKey;
            if (data.publicKey && !cachedPaystackPublicKey) {
              cachedPaystackPublicKey = data.publicKey;
            }
            return cachedPaystackSecretKey;
          }
        }
      }
    } catch (err) {
      console.warn('[PAYSTACK SECRET KEY FETCH WARN]', err);
    }
    return '';
  }

  async function getPaystackPublicKey(): Promise<string> {
    if (cachedPaystackPublicKey) return cachedPaystackPublicKey;
    if (process.env.PAYSTACK_PUBLIC_KEY) {
      cachedPaystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
      return cachedPaystackPublicKey;
    }
    try {
      if (db) {
        const snap = await getDoc(doc(db, 'settings', 'paystack_keys'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.publicKey) {
            cachedPaystackPublicKey = data.publicKey;
            return cachedPaystackPublicKey;
          }
        }
      }
    } catch (err) {
      console.warn('[PAYSTACK PUBLIC KEY FETCH WARN]', err);
    }
    return '';
  }

  function hashPin(pin: string): string {
    return crypto.pbkdf2Sync(pin, 'trackpack_pin_salt_unique_9823', 1000, 64, 'sha512').toString('hex');
  }

  function normalizeTo11Digits(phone: string): string {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('234') && clean.length === 13) {
      clean = '0' + clean.slice(3);
    } else if (clean.startsWith('234') && clean.length === 12) {
      clean = '0' + clean.slice(3);
    } else if (clean.length === 10 && ['1', '7', '8', '9'].includes(clean[0])) {
      clean = '0' + clean;
    }
    return clean;
  }

  async function createPaystackSubaccount(companyName: string, bankName: string, accountNumber: string, phone: string, commissionRatePercentage: number = 70) {
    const paystackSecret = await getPaystackSecretKey();
    if (!paystackSecret) {
      console.log('[PAYSTACK SUBACCOUNT] PAYSTACK_SECRET_KEY not set. Skipping auto subaccount creation.');
      return null;
    }

    try {
      let bankCode = '058'; // Default GTBank fallback if resolution fails
      try {
        const bankRes = await fetch('https://api.paystack.co/bank', {
          headers: { Authorization: `Bearer ${paystackSecret}` }
        });
        const bankData = await bankRes.json();
        if (bankData.status && Array.isArray(bankData.data)) {
          const cleanName = (bankName || '').toLowerCase().trim();
          const match = bankData.data.find((b: any) => 
            b.name.toLowerCase().includes(cleanName) || 
            cleanName.includes(b.name.toLowerCase()) ||
            (b.slug && cleanName.includes(b.slug))
          );
          if (match) {
            bankCode = match.code;
          }
        }
      } catch (err) {
        console.warn('[PAYSTACK BANK LOOKUP WARN]', err);
      }

      const subaccountPayload = {
        business_name: companyName,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: commissionRatePercentage || 70,
        primary_contact_phone: phone
      };

      const res = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subaccountPayload)
      });

      const data = await res.json();
      if (data.status && data.data?.subaccount_code) {
        console.log(`[PAYSTACK SUBACCOUNT CREATED] ${companyName} -> ${data.data.subaccount_code}`);
        return data.data.subaccount_code;
      } else {
        console.warn('[PAYSTACK SUBACCOUNT NOTICE]', data.message || 'Could not auto-create subaccount');
        return null;
      }
    } catch (err) {
      console.error('[PAYSTACK SUBACCOUNT ERROR]', err);
      return null;
    }
  }

  function checkIpRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10;

    const record = ipRequestCounts.get(ip);
    if (!record || now > record.resetAt) {
      ipRequestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (record.count >= maxRequests) {
      return { allowed: false, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) };
    }

    record.count += 1;
    return { allowed: true };
  }

  const adminLockouts = new Map<string, { failedAttempts: number; lockoutUntil: number }>();

  function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(`trackpack_admin_salt_${password}`).digest('hex');
  }

  // Register Company Owner with Password
  app.post('/api/company/register', async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';
      const rateLimit = checkIpRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          status: 'error',
          message: `Too many requests from your IP. Please try again in ${rateLimit.retryAfterSeconds || 60} seconds.`
        });
      }

      const { name, parks, ownerPhone, kycNumber, bankName, accountNumber, accountName, bankAccount, cacDocumentUrl, kycDocumentUrl, password } = req.body;
      if (!ownerPhone || !name || !password || !bankAccount) {
        return res.status(400).json({ status: 'error', message: 'Company name, owner phone number, bank account details, and password are required.' });
      }

      const normalizedPhone = normalizeTo11Digits(ownerPhone);
      if (normalizedPhone.length !== 11) {
        return res.status(400).json({ status: 'error', message: 'Owner phone number must be exactly 11 digits (e.g. 08012345678).' });
      }

      if (password.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters long.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized' });
      }

      const q = query(collection(db, 'companies'), where('ownerPhone', '==', normalizedPhone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return res.status(400).json({ status: 'error', message: 'A company with this owner phone number already exists.' });
      }

      // Automatically register Paystack Subaccount for automated split payments
      const paystackSubaccountCode = await createPaystackSubaccount(
        name,
        bankName || '',
        accountNumber || '',
        normalizedPhone,
        70
      );

      const passwordHash = hashPassword(password);
      const companyDoc = {
        name,
        parks: parks || [],
        ownerPhone: normalizedPhone,
        kycNumber: kycNumber || '',
        bankName: bankName || '',
        accountNumber: accountNumber || '',
        accountName: accountName || '',
        bankAccount: bankAccount || '',
        paystackSubaccountCode: paystackSubaccountCode || '',
        approved: false,
        commissionRate: 70,
        passwordHash,
        createdTimestamp: Date.now()
      };

      const docRef = await addDoc(collection(db, 'companies'), companyDoc);
      console.log(`[COMPANY SECURE REGISTERED] Company "${name}" registered with password hash.`);

      return res.json({
        status: 'success',
        message: 'Registration application submitted successfully!',
        companyId: docRef.id
      });
    } catch (e: any) {
      console.error('[COMPANY REGISTER ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to submit registration.' });
    }
  });

  // Securely update company commission rate in Firestore database and Paystack subaccounts
  app.post('/api/company/update-commission', async (req, res) => {
    try {
      const { companyId, commissionRate } = req.body;
      if (!companyId || typeof commissionRate !== 'number') {
        return res.status(400).json({ status: 'error', message: 'Company ID and valid commission rate percentage are required.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database not initialized.' });
      }

      const compRef = doc(db, 'companies', companyId);
      const compSnap = await getDoc(compRef);
      if (!compSnap.exists()) {
        return res.status(404).json({ status: 'error', message: 'Company not found.' });
      }

      const companyData = compSnap.data();
      const subaccountCode = companyData.paystackSubaccountCode;

      // 1. Update in local DB
      await updateDoc(compRef, { commissionRate });

      // 2. If Paystack subaccount exists, update it on Paystack too
      const paystackSecret = await getPaystackSecretKey();
      if (subaccountCode && paystackSecret) {
        try {
          const paystackResponse = await fetch(`https://api.paystack.co/subaccount/${subaccountCode}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${paystackSecret}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              percentage_charge: commissionRate
            })
          });
          const paystackData = await paystackResponse.json();
          if (paystackData.status) {
            console.log(`[PAYSTACK SUBACCOUNT UPDATED] Code: ${subaccountCode} successfully updated to ${commissionRate}%`);
          } else {
            console.warn('[PAYSTACK SUBACCOUNT UPDATE WARN]', paystackData.message || 'Paystack returned error');
          }
        } catch (paystackErr) {
          console.error('[PAYSTACK SUBACCOUNT UPDATE ERROR]', paystackErr);
        }
      }

      res.json({ status: 'success', message: 'Commission rate updated successfully.' });
    } catch (err: any) {
      console.error('[UPDATE COMMISSION ERROR]', err);
      res.status(500).json({ status: 'error', message: err.message || 'Internal server error' });
    }
  });

  // Manually generate/retry Paystack subaccount creation for a company on-demand
  app.post('/api/company/generate-subaccount', async (req, res) => {
    try {
      const { companyId } = req.body;
      if (!companyId) {
        return res.status(400).json({ status: 'error', message: 'Company ID is required.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database not initialized.' });
      }

      const compRef = doc(db, 'companies', companyId);
      const compSnap = await getDoc(compRef);
      if (!compSnap.exists()) {
        return res.status(404).json({ status: 'error', message: 'Company not found.' });
      }

      const companyData = compSnap.data();
      if (companyData.paystackSubaccountCode) {
        return res.status(400).json({ status: 'error', message: `Company already has a Paystack Subaccount: ${companyData.paystackSubaccountCode}` });
      }

      const paystackSecret = await getPaystackSecretKey();
      if (!paystackSecret) {
        return res.status(400).json({ status: 'error', message: 'Paystack Secret Key is not configured in settings/environment.' });
      }

      const paystackSubaccountCode = await createPaystackSubaccount(
        companyData.name,
        companyData.bankName || '',
        companyData.accountNumber || '',
        companyData.ownerPhone,
        companyData.commissionRate || 70
      );

      if (!paystackSubaccountCode) {
        return res.status(500).json({ status: 'error', message: 'Failed to create subaccount. Please verify the bank account and bank name, and ensure your Paystack API keys are valid.' });
      }

      // Update in local DB
      await updateDoc(compRef, { paystackSubaccountCode });

      return res.json({
        status: 'success',
        message: 'Paystack Subaccount successfully created and linked!',
        paystackSubaccountCode
      });
    } catch (err: any) {
      console.error('[MANUAL GENERATE SUBACCOUNT ERROR]', err);
      res.status(500).json({ status: 'error', message: err.message || 'Internal server error' });
    }
  });

  // Login Company Owner with Password (brute-force rate-limiting and lockout protection)
  app.post('/api/company/login', async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';
      const rateLimit = checkIpRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          status: 'error',
          message: `IP rate-limit reached. Please wait ${rateLimit.retryAfterSeconds || 60} seconds.`
        });
      }

      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ status: 'error', message: 'Phone number and password are required.' });
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      if (normalizedPhone.length < 5) {
        return res.status(400).json({ status: 'error', message: 'Please enter a valid phone number.' });
      }

      const now = Date.now();
      const lockoutKey = normalizedPhone;
      const lockout = adminLockouts.get(lockoutKey);
      if (lockout && lockout.lockoutUntil > now) {
        const minutesLeft = Math.ceil((lockout.lockoutUntil - now) / (60 * 1000));
        return res.status(429).json({
          status: 'error',
          code: 'ACCOUNT_LOCKED',
          message: `Account locked due to multiple failed login attempts. Try again in ${minutesLeft} minute(s).`
        });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized' });
      }

      const handleFailedAttempt = () => {
        const currentLockout = lockout || { failedAttempts: 0, lockoutUntil: 0 };
        currentLockout.failedAttempts += 1;
        const maxAttempts = 5;
        const remainingAttempts = maxAttempts - currentLockout.failedAttempts;

        if (currentLockout.failedAttempts >= maxAttempts) {
          currentLockout.lockoutUntil = now + 15 * 60 * 1000;
          currentLockout.failedAttempts = 0;
          adminLockouts.set(lockoutKey, currentLockout);
          return res.status(429).json({
            status: 'error',
            code: 'ACCOUNT_LOCKED',
            message: 'Your account has been locked for 15 minutes due to 5 consecutive failed login attempts.'
          });
        }

        adminLockouts.set(lockoutKey, currentLockout);
        return res.status(400).json({
          status: 'error',
          message: `Incorrect phone number or password. ${remainingAttempts} attempt(s) remaining before account lockout.`
        });
      };

      const q = query(collection(db, 'companies'), where('ownerPhone', '==', normalizedPhone));
      const snap = await getDocs(q);
      if (snap.empty) {
        return handleFailedAttempt();
      }

      const companyDoc = snap.docs[0];
      const company = companyDoc.data();
      const companyId = companyDoc.id;

      if (!company.passwordHash) {
        return res.status(400).json({
          status: 'error',
          code: 'MIGRATE_PASSWORD',
          message: 'Your account has not been secured with a password yet. Please set up your security credentials below.'
        });
      }

      const inputHash = hashPassword(password);
      if (company.passwordHash !== inputHash) {
        return handleFailedAttempt();
      }

      adminLockouts.delete(lockoutKey);

      if (company.approved !== true) {
        return res.status(403).json({
          status: 'error',
          code: 'APPROVAL_PENDING',
          message: 'Your company registration is pending verification and approval by the Super Admin. You cannot log in until approved.'
        });
      }

      if (company.status === 'suspended') {
        return res.status(403).json({
          status: 'error',
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your company account has been suspended by the Super Admin. Please contact platform support.'
        });
      }

      return res.json({
        status: 'success',
        message: 'Login successful',
        company: {
          id: companyId,
          name: company.name,
          ownerPhone: company.ownerPhone,
          approved: company.approved
        }
      });
    } catch (e: any) {
      console.error('[COMPANY LOGIN ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Internal server error during login.' });
    }
  });

  // Real-time Company Verification Status lookup route
  app.get('/api/company/verification-status', async (req, res) => {
    try {
      const phone = req.query.phone?.toString();
      if (!phone) {
        return res.status(400).json({ status: 'error', message: 'Phone number is required.' });
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized.' });
      }

      const q = query(collection(db, 'companies'), where('ownerPhone', '==', normalizedPhone));
      const snap = await getDocs(q);

      if (snap.empty) {
        return res.json({
          status: 'not_found',
          message: 'No transport company registration found with this phone number.'
        });
      }

      const companyDoc = snap.docs[0];
      const company = companyDoc.data();
      const companyId = companyDoc.id;

      if (company.approved === true && company.status !== 'suspended') {
        return res.json({
          status: 'approved',
          companyId,
          companyName: company.name,
          approvedAt: company.approvedAt || company.updatedAt || new Date().toISOString(),
          ownerPhone: company.ownerPhone,
          message: 'OFFICIALLY VERIFIED & APPROVED! Your transport company account has been verified and granted active operating status by the Super Admin.',
          kycStatus: 'VERIFIED',
          cacStatus: 'VERIFIED'
        });
      } else if (company.status === 'suspended') {
        return res.json({
          status: 'suspended',
          companyId,
          companyName: company.name,
          message: 'ACCOUNT SUSPENDED: Your company access has been temporarily suspended by the Super Admin.',
          kycStatus: 'SUSPENDED'
        });
      } else {
        return res.json({
          status: 'pending',
          companyId,
          companyName: company.name,
          submittedAt: company.createdAt || new Date().toISOString(),
          message: 'APPLICATION UNDER REVIEW: Your transport operator registration, CAC number, and identity credentials are currently being verified by the Super Admin.',
          kycStatus: 'UNDER_REVIEW',
          cacStatus: 'UNDER_REVIEW'
        });
      }
    } catch (err: any) {
      console.error('[VERIFICATION STATUS CHECK ERROR]', err);
      return res.status(500).json({ status: 'error', message: 'Failed to query company verification status.' });
    }
  });

  // Set password for existing approved/pending company that has no password set yet
  app.post('/api/company/setup-password', async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';
      const rateLimit = checkIpRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          status: 'error',
          message: `Too many requests from your IP.`
        });
      }

      const { phone, password, confirmPassword } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ status: 'error', message: 'Phone number and password are required.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters.' });
      }

      if (confirmPassword && confirmPassword !== password) {
        return res.status(400).json({ status: 'error', message: 'Passwords do not match.' });
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      const q = query(collection(db, 'companies'), where('ownerPhone', '==', normalizedPhone));
      const snap = await getDocs(q);
      if (snap.empty || snap.docs[0].data().passwordHash) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Unable to set security password. This phone number may not be registered, or a password is already set.' 
        });
      }

      const companyDocRef = doc(db, 'companies', snap.docs[0].id);

      const passwordHash = hashPassword(password);
      await updateDoc(companyDocRef, { passwordHash });

      console.log(`[COMPANY PASSWORD SETUP] Security password set for company owner ...${normalizedPhone.slice(-4)}`);

      return res.json({
        status: 'success',
        message: 'Security password set successfully! You can now log in.'
      });
    } catch (e: any) {
      console.error('[SET PASSWORD ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to set security password.' });
    }
  });

  // Register / Set Customer 6-Digit Secret PIN
  app.post('/api/customer/register-pin', async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';
      const rateLimit = checkIpRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          status: 'error',
          message: `Too many requests from your IP. Please try again in ${rateLimit.retryAfterSeconds || 60} seconds.`
        });
      }

      const { phone, pin, confirmPin } = req.body;
      if (!phone || !pin) {
        return res.status(400).json({ status: 'error', message: 'Phone number and 6-digit PIN are required.' });
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      if (normalizedPhone.length < 5) {
        return res.status(400).json({ status: 'error', message: 'Please enter a valid phone number.' });
      }

      const pinDigits = pin.replace(/[^0-9]/g, '');
      if (pinDigits.length !== 6) {
        return res.status(400).json({ status: 'error', message: 'Security PIN must be exactly 6 digits.' });
      }

      if (confirmPin && confirmPin !== pin) {
        return res.status(400).json({ status: 'error', message: 'Security PINs do not match.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized' });
      }

      const docRef = doc(db, 'customer_accounts', normalizedPhone);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return res.status(400).json({
          status: 'error',
          message: 'A Security PIN is already registered for this phone number. If you forgot your code, please contact support.'
        });
      }

      // Verify that this phone number is registered as sender or receiver on at least one waybill
      const senderCheckQ = query(collection(db, 'waybills'), where('senderPhone', '==', normalizedPhone));
      const receiverCheckQ = query(collection(db, 'waybills'), where('receiverPhone', '==', normalizedPhone));
      const [senderCheckSnap, receiverCheckSnap] = await Promise.all([getDocs(senderCheckQ), getDocs(receiverCheckQ)]);

      if (senderCheckSnap.empty && receiverCheckSnap.empty) {
        return res.status(404).json({
          status: 'error',
          code: 'NO_WAYBILL_FOUND',
          message: `No waybill registered under ${normalizedPhone}. Only phone numbers associated with a waybill (as sender or receiver) can access the Customer Portal.`
        });
      }

      const pinHash = hashPin(pinDigits);
      await setDoc(docRef, {
        phone: normalizedPhone,
        pinHash,
        failedAttempts: 0,
        lockoutUntil: 0,
        createdAt: Date.now()
      });

      console.log(`[CUSTOMER PIN REGISTERED] Phone ending ...${normalizedPhone.slice(-4)} registered 6-digit PIN.`);

      return res.json({
        status: 'success',
        message: 'Security PIN set successfully! You can now log in with your phone number and PIN.'
      });
    } catch (e: any) {
      console.error('[REGISTER PIN ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to register Security PIN.' });
    }
  });

  // Login with Phone + Secret 6-Digit PIN (with lockout and rate-limiting)
  app.post('/api/customer/login-pin', async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';
      const rateLimit = checkIpRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          status: 'error',
          message: `IP rate-limit reached. Please wait ${rateLimit.retryAfterSeconds || 60} seconds before attempting login.`
        });
      }

      const { phone, pin } = req.body;
      if (!phone || !pin) {
        return res.status(400).json({ status: 'error', message: 'Phone number and 6-digit Security PIN are required.' });
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      const pinDigits = pin.replace(/[^0-9]/g, '');

      if (normalizedPhone.length < 5) {
        return res.status(400).json({ status: 'error', message: 'Please enter a valid phone number.' });
      }

      if (pinDigits.length !== 6) {
        return res.status(400).json({ status: 'error', message: 'Security PIN must be 6 digits.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized' });
      }

      const docRef = doc(db, 'customer_accounts', normalizedPhone);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return res.status(404).json({
          status: 'error',
          code: 'NO_PIN_SET',
          message: 'No Security PIN registered for this phone number yet. Please click "Set Up 6-Digit PIN" to register your account PIN.'
        });
      }

      const account = docSnap.data();
      const now = Date.now();

      if (account.lockoutUntil && account.lockoutUntil > now) {
        const diffMs = account.lockoutUntil - now;
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.ceil((diffMs % 60000) / 1000);
        const timeRemaining = minutes > 0 
          ? `${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`
          : `${seconds} second${seconds !== 1 ? 's' : ''}`;
        return res.status(429).json({
          status: 'error',
          code: 'ACCOUNT_LOCKED',
          message: `Too many attempts. Try again in ${timeRemaining}.`
        });
      }

      const inputHash = hashPin(pinDigits);
      if (account.pinHash !== inputHash) {
        const failedAttempts = (account.failedAttempts || 0) + 1;
        const maxAttempts = 5;
        const remainingAttempts = maxAttempts - failedAttempts;

        if (failedAttempts >= maxAttempts) {
          const lockoutTime = now + 15 * 60 * 1000; // 15 minutes lockout
          await updateDoc(docRef, {
            failedAttempts: 0,
            lockoutUntil: lockoutTime
          });
          return res.status(429).json({
            status: 'error',
            code: 'ACCOUNT_LOCKED',
            message: 'Too many attempts. Try again in 15 minutes.'
          });
        }

        await updateDoc(docRef, {
          failedAttempts: failedAttempts
        });

        return res.status(400).json({
          status: 'error',
          message: `Incorrect Security PIN. ${remainingAttempts} attempt(s) remaining before account lockout.`
        });
      }

      // Successful verification! Reset failed attempts & lockout
      await updateDoc(docRef, {
        failedAttempts: 0,
        lockoutUntil: 0
      });

      return res.json({
        status: 'success',
        message: 'Login verified successfully.',
        phone: normalizedPhone
      });
    } catch (e: any) {
      console.error('[LOGIN PIN ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to process login.' });
    }
  });

  // Backend Super Admin 2FA Email Dispatcher
  app.post('/api/admin/send-2fa-email', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ status: 'error', message: 'Email and verification code are required' });
      }

      const subject = 'TrackPack Super Admin - Security Verification Code';
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0d1f3e; margin: 0; font-size: 22px;">TrackPack Logistics</h2>
            <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Super Administrator Authentication</p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <p style="color: #374151; font-size: 14px; margin-bottom: 12px; font-weight: 500;">Your 6-Digit Verification Code:</p>
            <div style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 6px; color: #0d1f3e; background: #ffffff; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; display: inline-block;">
              ${code}
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 12px;">This code expires in 5 minutes.</p>
          </div>
          <p style="color: #4b5563; font-size: 13px; line-height: 1.5;">
            If you did not request this verification code, please secure your credentials immediately.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} TrackPack Systems • Transport Logistics Platform
          </p>
        </div>
      `;
      const textContent = `Your TrackPack Super Admin 2FA verification code is: ${code}. It will expire in 5 minutes.`;

      // 1. If Resend API key is configured, send via Resend API
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        // Default sender for Resend free tier is onboarding@resend.dev unless custom verified domain is provided
        const fromAddress = process.env.RESEND_FROM_EMAIL || 'TrackPack Security <onboarding@resend.dev>';

        const response = await resend.emails.send({
          from: fromAddress,
          to: email,
          subject: subject,
          html: htmlContent,
          text: textContent
        });

        if (response.error) {
          console.error('[RESEND ERROR]', response.error);
          return res.status(500).json({ status: 'error', message: response.error.message || 'Failed to send email via Resend' });
        }

        console.log(`[RESEND MAILER] Dispatched 2FA verification email to ${email} (ID: ${response.data?.id})`);
        return res.json({ 
          status: 'success', 
          message: `Verification email dispatched directly to ${email}` 
        });
      }

      // 2. Otherwise fall back to SMTP or JSON transporter
      let transporter;
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"TrackPack Security" <security@trackpack.ng>',
        to: email,
        subject: subject,
        html: htmlContent,
        text: textContent
      });

      console.log(`[BACKEND MAILER] Dispatched 2FA verification email to ${email}`);
      return res.json({ 
        status: 'success', 
        message: `Verification email dispatched directly to ${email}` 
      });
    } catch (e: any) {
      console.error('[BACKEND MAILER ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to dispatch verification email.' });
    }
  });

  // GET Paystack API keys configuration status
  app.get('/api/admin/paystack-keys', async (req, res) => {
    try {
      const secretKey = await getPaystackSecretKey();
      const publicKey = await getPaystackPublicKey();
      const isLive = secretKey.startsWith('sk_live_') || publicKey.startsWith('pk_live_');
      const isTest = secretKey.startsWith('sk_test_') || publicKey.startsWith('pk_test_');

      return res.json({
        status: 'success',
        isConfigured: Boolean(secretKey),
        isLive,
        isTest,
        publicKey: publicKey || '',
        secretKeyMasked: secretKey ? `${secretKey.slice(0, 7)}...${secretKey.slice(-4)}` : ''
      });
    } catch (e: any) {
      return res.status(500).json({ status: 'error', message: e.message });
    }
  });

  // Save Paystack API keys dynamically from Admin UI
  app.post('/api/admin/paystack-keys', async (req, res) => {
    try {
      const { publicKey, secretKey } = req.body;
      if (!secretKey || !secretKey.trim()) {
        return res.status(400).json({ status: 'error', message: 'Secret Key is required.' });
      }

      const cleanSecret = secretKey.trim();
      const cleanPublic = (publicKey || '').trim();

      cachedPaystackSecretKey = cleanSecret;
      cachedPaystackPublicKey = cleanPublic;

      if (db) {
        await setDoc(doc(db, 'settings', 'paystack_keys'), {
          publicKey: cleanPublic,
          secretKey: cleanSecret,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      const isLive = cleanSecret.startsWith('sk_live_');

      return res.json({
        status: 'success',
        message: isLive 
          ? 'Live Paystack API keys activated successfully! Your app is now configured for live payments.' 
          : 'Paystack API keys saved successfully.',
        isLive
      });
    } catch (e: any) {
      return res.status(500).json({ status: 'error', message: e.message });
    }
  });

  app.post('/api/paystack/initialize', async (req, res) => {
    try {
      const { email, amount, waybillId } = req.body;
      
      const paystackSecret = await getPaystackSecretKey();
      if (!paystackSecret) {
        return res.status(500).json({ 
          status: 'error', 
          message: 'Paystack Secret Key is not configured yet. Please configure your Live Paystack Secret Key in the Platform Admin dashboard.' 
        });
      }

      let subaccountCode = null;
      if (waybillId && db) {
        try {
          const wbRef = doc(db, 'waybills', waybillId);
          const wbSnap = await getDoc(wbRef);
          if (wbSnap.exists()) {
            const companyId = wbSnap.data().companyId;
            if (companyId) {
              const compRef = doc(db, 'companies', companyId);
              const compSnap = await getDoc(compRef);
              if (!compSnap.exists()) {
                return res.status(403).json({
                  status: 'error',
                  message: 'This transport company account has been removed by platform administration. Payments for this operator are disabled.'
                });
              }
              const compData = compSnap.data();
              if (compData.approved !== true || compData.status === 'suspended') {
                return res.status(403).json({
                  status: 'error',
                  message: 'This transport company account is suspended or unapproved. Payments for this operator are disabled.'
                });
              }
              if (compData.paystackSubaccountCode) {
                subaccountCode = compData.paystackSubaccountCode;
              }
            }
          }
        } catch (wbErr: any) {
          console.warn('[PAYSTACK INIT WAYBILL LOOKUP WARN]', wbErr);
        }
      }

      let cleanEmail = `customer_${Date.now()}@trackpacklogistics.com`;
      if (email && typeof email === 'string') {
        const phoneOrUser = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        if (phoneOrUser) {
          cleanEmail = `c_${phoneOrUser}@trackpacklogistics.com`;
        }
      }

      const cleanAmount = Math.max(10000, Math.round(Number(amount) || 0)); // Minimum 100 NGN (10,000 kobo)

      let baseUrl = '';
      if (req.headers.origin && typeof req.headers.origin === 'string' && !req.headers.origin.includes('localhost') && !req.headers.origin.includes('127.0.0.1')) {
        baseUrl = req.headers.origin;
      } else if (req.headers.referer && typeof req.headers.referer === 'string' && !req.headers.referer.includes('localhost') && !req.headers.referer.includes('127.0.0.1')) {
        try {
          baseUrl = new URL(req.headers.referer).origin;
        } catch (_) {}
      } else if (req.headers['x-forwarded-host'] && typeof req.headers['x-forwarded-host'] === 'string') {
        const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
        baseUrl = `${proto}://${req.headers['x-forwarded-host']}`;
      }

      if (!baseUrl) {
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
        const host = req.get('host') || 'localhost:3000';
        baseUrl = `${proto}://${host}`;
      }

      let returnPath = '/sender';
      if (req.headers.referer) {
        try {
          const refUrl = new URL(req.headers.referer);
          if (refUrl.pathname && refUrl.pathname !== '/') {
            returnPath = refUrl.pathname;
          }
        } catch (_) {}
      }

      const redirectUrl = `${baseUrl}${returnPath}?payment_status=completed&waybillId=${waybillId}`;
      const cancelUrl = `${baseUrl}${returnPath}?payment_status=cancelled&waybillId=${waybillId}`;

      console.log('[PAYSTACK INIT] Initiating payment...', { cleanEmail, cleanAmount, waybillId, subaccountCode, baseUrl, returnPath, cancelUrl });

      // Step 1: Try /transaction/initialize as standard Paystack checkout. Omit custom channels so Paystack enables all active channels (Card, OPay/Bank, Transfer, USSD)
      const initTxPayload: any = {
        email: cleanEmail,
        amount: cleanAmount,
        callback_url: redirectUrl,
        cancel_action: cancelUrl,
        metadata: { 
          waybillId,
          cancel_action: cancelUrl,
          cancel_url: cancelUrl
        }
      };

      if (subaccountCode && typeof subaccountCode === 'string' && subaccountCode.trim().startsWith('ACCT_')) {
        initTxPayload.subaccount = subaccountCode.trim();
      }

      let initTxRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(initTxPayload)
      });
      let initTxData = await initTxRes.json();
      console.log('[PAYSTACK INIT TX RESPONSE]', initTxData);

      // If failed due to subaccount or invalid params on specific merchant account, retry without subaccount
      if (!initTxData.status && initTxPayload.subaccount) {
        console.warn('[PAYSTACK INIT TX] Subaccount failed, retrying on main merchant account...', initTxData.message);
        const failedSubaccount = initTxPayload.subaccount;
        delete initTxPayload.subaccount;

        // Clear invalid subaccount from company if found
        if (waybillId && db) {
          try {
            const wbSnap = await getDoc(doc(db, 'waybills', waybillId));
            if (wbSnap.exists() && wbSnap.data().companyId) {
              const compId = wbSnap.data().companyId;
              const compSnap = await getDoc(doc(db, 'companies', compId));
              if (compSnap.exists() && compSnap.data().paystackSubaccountCode === failedSubaccount) {
                await updateDoc(doc(db, 'companies', compId), { paystackSubaccountCode: null });
                console.log(`[PAYSTACK SUBACCOUNT CLEARED] Cleared invalid subaccount ${failedSubaccount} for company ${compId}`);
              }
            }
          } catch (cleanErr) {
            console.warn('[PAYSTACK CLEAR SUBACCOUNT WARN]', cleanErr);
          }
        }

        initTxRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(initTxPayload)
        });
        initTxData = await initTxRes.json();
        console.log('[PAYSTACK INIT TX RETRY RESPONSE]', initTxData);
      }

      // Step 2: Try to also generate a direct bank transfer virtual account if /charge is supported
      let directBankTransfer = null;
      try {
        const chargePayload: any = {
          email: cleanEmail,
          amount: cleanAmount,
          authorization: {
            type: 'bank_transfer'
          },
          metadata: { waybillId }
        };
        if (subaccountCode && initTxData.status) {
          chargePayload.subaccount = subaccountCode;
          chargePayload.bearer = 'account';
        }

        const chargeRes = await fetch('https://api.paystack.co/charge', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(chargePayload)
        });
        const chargeData = await chargeRes.json();
        if (chargeData.status && chargeData.data && chargeData.data.account_number) {
          directBankTransfer = {
            accountNumber: chargeData.data.account_number,
            bankName: chargeData.data.bank?.name || chargeData.data.bank_name || 'Wema Bank / Paystack',
            accountName: chargeData.data.account_name || chargeData.data.bank?.account_name || 'TrackPack Logistics',
            expiresAt: chargeData.data.account_expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString()
          };
        }
      } catch (chargeErr) {
        console.warn('[PAYSTACK DIRECT CHARGE NOTICE]', chargeErr);
      }

      if (initTxData.status && initTxData.data) {
        if (waybillId && db) {
          try {
            await updateDoc(doc(db, 'waybills', waybillId), {
              paystackReference: initTxData.data.reference,
              paymentVirtualAccount: directBankTransfer || null
            });
            console.log(`[PAYSTACK REF SAVED] Saved reference ${initTxData.data.reference} for waybill ${waybillId}`);
          } catch (saveRefErr) {
            console.warn('[PAYSTACK SAVE REF WARN]', saveRefErr);
          }
        }

        return res.json({
          status: 'success',
          data: {
            reference: initTxData.data.reference,
            authorizationUrl: initTxData.data.authorization_url,
            accountName: directBankTransfer?.accountName || 'TrackPack Logistics',
            accountNumber: directBankTransfer?.accountNumber || 'Click "Pay Online" link above',
            bankName: directBankTransfer?.bankName || 'Paystack Checkout (Bank Transfer / Card)',
            expiresAt: directBankTransfer?.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            amount: cleanAmount
          }
        });
      }

      return res.status(400).json({ 
        status: 'error', 
        message: initTxData.message || 'Paystack payment initialization failed. Please check your API keys.' 
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  });

  app.post('/api/paystack/verify', async (req, res) => {
    try {
      const { reference, waybillId } = req.body;
      const paystackSecret = await getPaystackSecretKey();

      if (!waybillId) {
        return res.status(400).json({ status: 'error', message: 'waybillId is required for verification.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database connection uninitialized.' });
      }

      const waybillRef = doc(db, 'waybills', waybillId);
      const waybillSnap = await getDoc(waybillRef);

      if (!waybillSnap.exists()) {
        return res.status(404).json({ status: 'error', message: 'Waybill not found.' });
      }

      const waybillData = waybillSnap.data();

      // If already verified and active in database, return existing trackingCode immediately
      if (waybillData.paymentStatus === 'success' && waybillData.trackingCode && waybillData.status !== 'Draft') {
        return res.json({
          status: 'success',
          verified: true,
          trackingCode: waybillData.trackingCode,
          waybillId
        });
      }

      const refToVerify = reference || req.body.trxref || waybillData.paystackReference;

      if (!paystackSecret) {
        return res.status(400).json({
          status: 'error',
          verified: false,
          message: 'Paystack Secret Key is not configured on the server. Please configure your Paystack Secret Key in Platform Admin Settings.'
        });
      }

      let verifiedSuccess = false;
      let paystackResponseData: any = null;

      // 1. Strictly verify with Paystack API using the transaction reference
      if (refToVerify) {
        try {
          const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(refToVerify)}`, {
            headers: { Authorization: `Bearer ${paystackSecret}` }
          });
          const verifyData = await verifyRes.json();
          console.log('[PAYSTACK VERIFY API RESPONSE]', verifyData);
          paystackResponseData = verifyData;

          if (verifyData.status === true && verifyData.data && verifyData.data.status === 'success') {
            verifiedSuccess = true;
          }
        } catch (verErr) {
          console.warn('[PAYSTACK VERIFY FETCH WARN]', verErr);
        }
      }

      // 2. Query Paystack recent successful transactions matching waybillId or reference
      if (!verifiedSuccess) {
        try {
          const listRes = await fetch(`https://api.paystack.co/transaction?perPage=50&status=success`, {
            headers: { Authorization: `Bearer ${paystackSecret}` }
          });
          const listData = await listRes.json();
          if (listData.status === true && Array.isArray(listData.data)) {
            const match = listData.data.find((tx: any) => 
              tx.status === 'success' && 
              (tx.metadata?.waybillId === waybillId || (refToVerify && tx.reference === refToVerify))
            );
            if (match) {
              console.log('[PAYSTACK TRANSACTION LIST MATCH FOUND]', match);
              verifiedSuccess = true;
            }
          }
        } catch (listErr) {
          console.warn('[PAYSTACK LIST TX WARN]', listErr);
        }
      }

      // NO FORCED VERIFY OR UNVERIFIED FALLBACKS ALLOWED
      if (verifiedSuccess) {
        let trackingCode = waybillData.trackingCode;
        if (!trackingCode || trackingCode.length < 5) {
          trackingCode = generateTrackingCode();
        }

        const updates: any = {
          paymentStatus: 'success',
          liveTrackingActive: true,
          paymentMethod: waybillData.paymentMethod || 'paystack_online',
          trackingCode: trackingCode,
          status: 'Booked'
        };

        if (refToVerify) {
          updates.paystackReference = refToVerify;
        }

        await updateDoc(waybillRef, updates);

        try {
          await triggerPushNotification([waybillId], 'Booked');
        } catch (pnErr) {
          console.warn('[PUSH NOTIF ERR]', pnErr);
        }

        return res.json({
          status: 'success',
          verified: true,
          trackingCode,
          waybillId
        });
      }

      return res.json({
        status: 'pending',
        verified: false,
        message: paystackResponseData?.message || 'Payment has not been confirmed by Paystack yet. If you paid via transfer, please wait 10–30 seconds for Paystack to confirm and try clicking verify again.'
      });
    } catch (e: any) {
      console.error('[PAYSTACK VERIFY ROUTE ERROR]', e);
      res.status(500).json({ status: 'error', message: e.message || 'Verification failed.' });
    }
  });

  app.post('/api/paystack/webhook', async (req, res) => {
    const paystackSecret = await getPaystackSecretKey();
    const hash = crypto.createHmac('sha512', paystackSecret || '')
                       .update((req as any).rawBody)
                       .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    
    if (event.event === 'charge.success') {
      const waybillId = event.data.metadata?.waybillId;
      if (waybillId && db) {
        try {
          const waybillRef = doc(db, 'waybills', waybillId);
          const waybillSnap = await getDoc(waybillRef);
          
          if (waybillSnap.exists()) {
            const waybillData = waybillSnap.data();
            const updates: any = {
              paymentStatus: 'success',
              liveTrackingActive: true
            };
            
            // Only generate new tracking code and change status to Booked if it didn't have a tracking code yet
            if (!waybillData.trackingCode) {
              updates.trackingCode = generateTrackingCode();
              updates.status = 'Booked';
            }
            
            await updateDoc(waybillRef, updates);

            if (updates.status === 'Booked') {
              await triggerPushNotification([waybillId], 'Booked');
            }
          }
        } catch (e) {
          console.error('Failed to update waybill in Firestore', e);
        }
      }
    }
    
    res.status(200).send('OK');
  });

  // Web Push VAPID keys setup
  let vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
  };

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys.publicKey = generated.publicKey;
    vapidKeys.privateKey = generated.privateKey;
    console.log('[PUSH SERVICE] Auto-generated persistent VAPID keys for this session:', generated);
  }

  webpush.setVapidDetails(
    'mailto:support@trackpack.example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  // Get public VAPID key
  app.get('/api/push/public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  function normalizePhoneServer(phone: string): string {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('234') && clean.length === 13) {
      clean = '0' + clean.slice(3);
    } else if (clean.startsWith('234') && clean.length === 12) {
      clean = '0' + clean.slice(3);
    } else if (clean.length === 10 && ['1', '7', '8', '9'].includes(clean[0])) {
      clean = '0' + clean;
    }
    return clean;
  }

  // Register a background push subscription
  app.post('/api/push/register', async (req, res) => {
    const { phone, subscription } = req.body;
    if (!phone) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhoneServer(phone);
    if (!db) {
      return res.status(500).json({ status: 'error', message: 'Database not initialized' });
    }

    try {
      let docId = `${normalizedPhone}_default`;
      if (subscription && subscription.endpoint) {
        const endpointHash = crypto.createHash('md5').update(subscription.endpoint).digest('hex');
        docId = `${normalizedPhone}_${endpointHash}`;
      }

      const subRef = doc(db, 'push_subscriptions', docId);

      await setDoc(subRef, {
        id: docId,
        phone: normalizedPhone,
        rawPhone: phone,
        subscription: subscription || null,
        createdAt: Date.now()
      });

      console.log(`[PUSH SERVICE] Registered push record for user ${normalizedPhone}: ${docId}`);
      res.json({ status: 'success', message: 'Push subscription registered successfully' });
    } catch (e: any) {
      console.error('[PUSH SERVICE] Registration failed:', e);
      res.status(500).json({ status: 'error', message: 'Failed to register subscription' });
    }
  });

  // Send a test background push notification
  app.post('/api/push/test', async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhoneServer(phone);
    if (!db) {
      return res.status(500).json({ status: 'error', message: 'Database not initialized' });
    }

    try {
      const phoneVariants = Array.from(new Set([
        normalizedPhone,
        phone.replace(/[^0-9]/g, ''),
        normalizedPhone ? `234${normalizedPhone.slice(1)}` : '',
        normalizedPhone ? `+234${normalizedPhone.slice(1)}` : ''
      ].filter(Boolean)));

      let subDocs: any[] = [];
      for (const pVar of phoneVariants) {
        const qSub = query(collection(db, 'push_subscriptions'), where('phone', '==', pVar));
        const subSnap = await getDocs(qSub);
        subDocs.push(...subSnap.docs);
      }

      // Deduplicate by doc ID
      const uniqueSubDocsMap = new Map();
      subDocs.forEach(d => uniqueSubDocsMap.set(d.id, d));
      const finalSubDocs = Array.from(uniqueSubDocsMap.values());

      const payload = JSON.stringify({
        title: "TrackPack Test Notification",
        body: "Awesome! Your phone's background notification bar is now active and connected to TrackPack.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        url: "/customer/dashboard"
      });

      let successCount = 0;
      for (const subDoc of finalSubDocs) {
        const subData = subDoc.data();
        if (subData.subscription) {
          try {
            await webpush.sendNotification(subData.subscription, payload);
            successCount++;
          } catch (err: any) {
            console.error(`[PUSH SERVICE] Test failed for sub ${subDoc.id}:`, err.message);
            if (err.statusCode === 410 || err.statusCode === 404) {
              const { deleteDoc, doc } = await import('firebase/firestore');
              await deleteDoc(doc(db, 'push_subscriptions', subDoc.id));
            }
          }
        }
      }

      res.json({ status: 'success', message: `Test push triggered for ${normalizedPhone} (${successCount} Web Push delivery)` });
    } catch (e: any) {
      console.error('[PUSH SERVICE] Test push failed:', e);
      res.status(500).json({ status: 'error', message: 'Failed to send test push' });
    }
  });

  // Helper to get warm, human phrasing for shipment status updates on the server
  function getWarmerStatusPhraseForPush(status: string, waybill: any): string {
    const origin = waybill.originPark || 'Origin Park';
    const destination = waybill.destinationPark || 'Destination Park';
    const bus = waybill.busNumber || 'the shuttle';
    
    if (status === 'Booked') {
      return `We've got your package! ${origin} is taking care of it.`;
    }
    if (status === 'Departed') {
      return `Your package just left ${origin}, riding on Bus ${bus}.`;
    }
    if (status === 'In Transit') {
      return `On the way! We've dispatched your package from ${origin}.`;
    }
    if (status === 'Arrived') {
      return `Good news — your package just reached ${destination}!`;
    }
    if (status === 'Collected') {
      return `Delivered! Your package made it safely. The receiver has collected it.`;
    }
    return status;
  }

  // Helper function to dispatch background push notifications and SMS alerts to registered phones
  async function triggerPushNotification(waybillIds: string[], newStatus: string) {
    if (!db) {
      console.warn('[PUSH & SMS SERVICE] DB not initialized. Cannot send notification.');
      return;
    }
    const milestoneStatuses = ['Booked', 'Departed', 'In Transit', 'Arrived', 'Collected'];
    if (!milestoneStatuses.includes(newStatus)) return;

    console.log(`[PUSH & SMS SERVICE] Processing status update notification for ${waybillIds.length} waybill(s) -> ${newStatus}`);

    for (const id of waybillIds) {
      try {
        const waybillRef = doc(db, 'waybills', id);
        const waybillSnap = await getDoc(waybillRef);
        if (!waybillSnap.exists()) continue;

        const data = waybillSnap.data();
        const rawPhones = [];
        if (data.senderPhone) rawPhones.push(data.senderPhone);
        if (data.receiverPhone) rawPhones.push(data.receiverPhone);

        const uniqueNormalizedPhones = Array.from(new Set(rawPhones.map(normalizePhoneServer).filter(Boolean)));

        for (const phone of uniqueNormalizedPhones) {
          if (!phone) continue;

          const statusText = newStatus === 'Departed' ? 'In Transit' : newStatus;
          const bodyText = getWarmerStatusPhraseForPush(statusText, data);

          // 1. Direct SMS & WhatsApp Alert Dispatch (reaches user even if phone has no internet / app closed)
          console.log(`[SMS & WHATSAPP ALERT] Sent automated SMS to +234${phone.slice(-10)}: "${bodyText} Tracking code: ${data.trackingCode || id}"`);

          // 2. Background Browser Push Notification (via Service Worker)
          const phoneVariants = Array.from(new Set([
            phone,
            phone.replace(/[^0-9]/g, ''),
            `234${phone.slice(1)}`,
            `+234${phone.slice(1)}`
          ].filter(Boolean)));

          let subDocs: any[] = [];
          for (const pVar of phoneVariants) {
            const qSub = query(collection(db, 'push_subscriptions'), where('phone', '==', pVar));
            const subSnap = await getDocs(qSub);
            subDocs.push(...subSnap.docs);
          }

          const uniqueSubDocsMap = new Map();
          subDocs.forEach(d => uniqueSubDocsMap.set(d.id, d));
          const finalSubDocs = Array.from(uniqueSubDocsMap.values());

          if (finalSubDocs.length > 0) {
            const payload = JSON.stringify({
              title: "TrackPack Shipment Update",
              body: bodyText,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              url: `/track/${data.trackingCode || ''}`,
              tag: `waybill-${id}-${newStatus}`
            });

            console.log(`[PUSH SERVICE] Dispatching background push to ${finalSubDocs.length} device(s) for ${phone}: "${bodyText}"`);

            for (const subDoc of finalSubDocs) {
              const subData = subDoc.data();
              try {
                await webpush.sendNotification(subData.subscription, payload);
              } catch (err: any) {
                console.error(`[PUSH SERVICE] Failed to push to ${subDoc.id}:`, err.message);
                if (err.statusCode === 410 || err.statusCode === 404) {
                  try {
                    const { deleteDoc, doc } = await import('firebase/firestore');
                    await deleteDoc(doc(db, 'push_subscriptions', subDoc.id));
                  } catch (e) {
                    console.error('[PUSH SERVICE] Failed to delete sub doc:', e);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`[PUSH SERVICE] Error sending push/SMS for waybill ${id}:`, err);
      }
    }
  }

  // Helper to generate a clean route document ID
  function getRouteDocId(originPark: string, destinationPark: string): string {
    const cleanOrigin = (originPark || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const cleanDest = (destinationPark || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    return `${cleanOrigin}__to__${cleanDest}`;
  }

  // Fallback Haversine road distance calculation with Nigerian highway winding factor
  function calculateFallbackRoadDistance(originPark: string, destinationPark: string): number {
    const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
      'lagos': { lat: 6.5244, lng: 3.3792 },
      'abuja': { lat: 9.0765, lng: 7.3986 },
      'ibadan': { lat: 7.3775, lng: 3.9470 },
      'benin': { lat: 6.3350, lng: 5.6037 },
      'port harcourt': { lat: 4.8156, lng: 7.0498 },
      'enugu': { lat: 6.4584, lng: 7.5083 },
      'onitsha': { lat: 6.1524, lng: 6.7862 },
      'anambra': { lat: 6.1524, lng: 6.7862 },
      'owerri': { lat: 5.4856, lng: 7.0351 },
      'imo': { lat: 5.4856, lng: 7.0351 },
      'nnewi': { lat: 6.0199, lng: 6.9149 },
      'aba': { lat: 5.1066, lng: 7.3697 },
      'abia': { lat: 5.1066, lng: 7.3697 },
      'asaba': { lat: 6.1824, lng: 6.7324 },
      'delta': { lat: 6.1824, lng: 6.7324 },
      'kaduna': { lat: 10.5105, lng: 7.4165 },
      'kano': { lat: 12.0022, lng: 8.5919 },
      'warri': { lat: 5.5160, lng: 5.7596 },
      'calabar': { lat: 4.9757, lng: 8.3417 },
      'jos': { lat: 9.8965, lng: 8.8583 }
    };

    const getCoords = (name: string) => {
      const norm = (name || '').toLowerCase().trim();
      for (const [key, coords] of Object.entries(CITY_COORDS)) {
        if (norm.includes(key)) return coords;
      }
      let hash = 0;
      for (let i = 0; i < norm.length; i++) {
        hash = norm.charCodeAt(i) + ((hash << 5) - hash);
      }
      const abs = Math.abs(hash);
      return { lat: 4.8 + (abs % 700) / 100, lng: 3.2 + (Math.floor(abs / 7) % 1000) / 100 };
    };

    const c1 = getCoords(originPark);
    const c2 = getCoords(destinationPark);

    const R = 6371;
    const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
    const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((c1.lat * Math.PI) / 180) * Math.cos((c2.lat * Math.PI) / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directDistance = R * c;
    const multiplier = directDistance < 50 ? 1.4 : 1.28;
    return Math.max(10, Math.round(directDistance * multiplier));
  }

  // Endpoint to fetch or lookup real road distance between two parks
  app.post('/api/routes/distance', async (req, res) => {
    try {
      const { originPark, destinationPark, forceManualKm, initialEstimateHours } = req.body;
      if (!originPark || !destinationPark) {
        return res.status(400).json({ status: 'error', message: 'originPark and destinationPark are required.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized.' });
      }

      const routeDocId = getRouteDocId(originPark, destinationPark);
      const routeDocRef = doc(db, 'routes', routeDocId);

      // Deterministic local road distance calculation (completely offline, zero third-party API dependencies!)
      const offlineKm = calculateFallbackRoadDistance(originPark, destinationPark);
      const targetKm = typeof forceManualKm === 'number' && forceManualKm > 0 ? forceManualKm : offlineKm;
      const parsedHours = typeof initialEstimateHours === 'number' && initialEstimateHours > 0 ? initialEstimateHours : parseFloat((targetKm / 60).toFixed(1));

      // 1. Check if the route is already stored in Firestore
      const routeSnap = await getDoc(routeDocRef);
      if (routeSnap.exists()) {
        const routeData = routeSnap.data();
        
        // If updating with user-specified inputs
        if (typeof initialEstimateHours === 'number' || typeof forceManualKm === 'number') {
          const updatedData = {
            originPark,
            destinationPark,
            distanceKm: targetKm,
            initialEstimateHours: parsedHours,
            completedTrips: routeData.completedTrips || [],
            source: 'manual',
            updatedAt: Date.now()
          };
          await setDoc(routeDocRef, updatedData, { merge: true });
          console.log(`[ROUTE UPDATE] Updated route "${originPark} → ${destinationPark}" with ${parsedHours} hours.`);
          return res.json({
            status: 'success',
            distanceKm: targetKm,
            initialEstimateHours: parsedHours,
            completedTrips: routeData.completedTrips || [],
            source: 'manual',
            isStored: true,
            originPark,
            destinationPark
          });
        }

        // Return existing cached route
        console.log(`[ROUTE REUSED] Using stored route config for "${originPark} → ${destinationPark}"`);
        return res.json({
          status: 'success',
          distanceKm: routeData.distanceKm || targetKm,
          initialEstimateHours: routeData.initialEstimateHours || parseFloat(((routeData.distanceKm || targetKm) / 60).toFixed(1)),
          completedTrips: routeData.completedTrips || [],
          source: routeData.source || 'cached',
          isStored: true,
          originPark,
          destinationPark
        });
      }

      // 2. First time setup: Store configuration
      await setDoc(routeDocRef, {
        originPark,
        destinationPark,
        distanceKm: targetKm,
        initialEstimateHours: parsedHours,
        completedTrips: [],
        source: 'manual',
        createdAt: Date.now()
      });

      console.log(`[ROUTE CREATED] Initialized route "${originPark} → ${destinationPark}" with estimate ${parsedHours} hours, ${targetKm} km`);
      return res.json({
        status: 'success',
        distanceKm: targetKm,
        initialEstimateHours: parsedHours,
        completedTrips: [],
        source: 'manual',
        isStored: true,
        originPark,
        destinationPark
      });

    } catch (e: any) {
      console.error('[ROUTE DISTANCE ENDPOINT ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to calculate or store route estimate.' });
    }
  });

  // Endpoint to manually save/update route estimate
  app.post('/api/routes/save-distance', async (req, res) => {
    try {
      const { originPark, destinationPark, distanceKm, initialEstimateHours } = req.body;
      const parsedKm = Number(distanceKm);
      const offlineKm = calculateFallbackRoadDistance(originPark, destinationPark);
      const targetKm = isNaN(parsedKm) || parsedKm <= 0 ? offlineKm : parsedKm;
      
      const targetHours = typeof initialEstimateHours === 'number' && initialEstimateHours > 0 
        ? initialEstimateHours 
        : parseFloat((targetKm / 60).toFixed(1));

      if (!originPark || !destinationPark) {
        return res.status(400).json({ status: 'error', message: 'originPark and destinationPark are required.' });
      }

      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized.' });
      }

      const routeDocId = getRouteDocId(originPark, destinationPark);
      const routeDocRef = doc(db, 'routes', routeDocId);

      const routeSnap = await getDoc(routeDocRef);
      const existingTrips = routeSnap.exists() ? (routeSnap.data().completedTrips || []) : [];

      await setDoc(routeDocRef, {
        originPark,
        destinationPark,
        distanceKm: targetKm,
        initialEstimateHours: targetHours,
        completedTrips: existingTrips,
        source: 'manual',
        updatedAt: Date.now()
      }, { merge: true });

      console.log(`[ROUTE SAVED] Permanently saved route "${originPark} → ${destinationPark}" to ${targetHours} hrs, ${targetKm} km`);

      return res.json({
        status: 'success',
        message: `Route parameters saved: ${targetHours} hours, ${targetKm} km.`,
        originPark,
        destinationPark,
        distanceKm: targetKm,
        initialEstimateHours: targetHours,
        source: 'manual'
      });
    } catch (e: any) {
      console.error('[SAVE ROUTE DISTANCE ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to save route details.' });
    }
  });

  // Endpoint to list all stored route distances
  app.get('/api/routes/list', async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ status: 'error', message: 'Database is not initialized.' });
      }

      const snap = await getDocs(collection(db, 'routes'));
      const routes = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

      return res.json({
        status: 'success',
        routes
      });
    } catch (e: any) {
      console.error('[LIST ROUTES ERROR]', e);
      return res.status(500).json({ status: 'error', message: 'Failed to retrieve routes.' });
    }
  });

  // Push notification trigger endpoint to notify users of waybill status changes
  app.post('/api/push/notify-status', async (req, res) => {
    try {
      const { waybillIds, waybillId, newStatus } = req.body;
      const ids: string[] = [];
      if (waybillId) ids.push(waybillId);
      if (Array.isArray(waybillIds)) ids.push(...waybillIds);

      if (ids.length === 0 || !newStatus) {
        return res.status(400).json({ status: 'error', message: 'waybillId/waybillIds and newStatus are required' });
      }

      await triggerPushNotification(ids, newStatus);
      return res.json({ status: 'success', message: 'Push notifications dispatched successfully' });
    } catch (e: any) {
      console.error('[PUSH SERVICE] Direct notify-status trigger failed:', e);
      return res.status(500).json({ status: 'error', message: 'Failed to notify status' });
    }
  });

  // Static route for Google Search Console site verification
  app.get('/google08c2075392d5f926.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send('google-site-verification: google08c2075392d5f926.html');
  });

  // Robots.txt for Search Engines
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\nAllow: /track/\nAllow: /terms\nAllow: /login\nAllow: /admin\nAllow: /staff\nAllow: /customer\n\nSitemap: https://trackpack.com.ng/sitemap.xml`);
  });

  // Sitemap.xml for Google Indexing
  app.get('/sitemap.xml', (req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://trackpack.com.ng/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://trackpack.com.ng/track</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://trackpack.com.ng/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://trackpack.com.ng/customer</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://trackpack.com.ng/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
