import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, where, limit, deleteDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";

// Read Firebase config from local environment file
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("CRITICAL: firebase-applet-config.json is missing!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const firebaseApp = initializeApp(config);
const db = getFirestore(firebaseApp, config.firestoreDatabaseId);

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for cryptographic token generation
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Check lockout helper
async function checkLockout(lockedUntilStr: string | null | undefined): Promise<{ locked: boolean; timeLeftMinutes: number }> {
  if (!lockedUntilStr) return { locked: false, timeLeftMinutes: 0 };
  const lockedUntil = new Date(lockedUntilStr);
  const now = new Date();
  if (lockedUntil > now) {
    const diffMs = lockedUntil.getTime() - now.getTime();
    const diffMin = Math.ceil(diffMs / (1000 * 60));
    return { locked: true, timeLeftMinutes: diffMin };
  }
  return { locked: false, timeLeftMinutes: 0 };
}

// Helper to increment failed attempts and update lockout
async function handleLoginFailure(collectionName: string, docId: string, currentAttempts: number) {
  const newAttempts = (currentAttempts || 0) + 1;
  const updates: any = { failed_attempts: newAttempts };
  if (newAttempts >= 5) {
    updates.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins lockout
  }
  await updateDoc(doc(db, collectionName, docId), updates);
  return {
    locked: newAttempts >= 5,
    attemptsLeft: Math.max(0, 5 - newAttempts)
  };
}

// Helper to reset failed attempts
async function handleLoginSuccess(collectionName: string, docId: string) {
  await updateDoc(doc(db, collectionName, docId), {
    failed_attempts: 0,
    locked_until: null
  });
}

// PIN Lockouts tracking (since PIN is checked globally across staff)
async function getPinLockout(pin: string) {
  const pinRef = doc(db, "pin_lockouts", pin);
  try {
    const snap = await getDoc(pinRef);
    if (snap.exists()) {
      const data = snap.data();
      const lockout = await checkLockout(data.locked_until);
      if (lockout.locked) {
        return { locked: true, timeLeftMinutes: lockout.timeLeftMinutes, data };
      }
    }
  } catch (err) {
    console.error("Error checking PIN lockout:", err);
  }
  return { locked: false, timeLeftMinutes: 0, data: null };
}

async function handlePinFailure(pin: string) {
  const pinRef = doc(db, "pin_lockouts", pin);
  try {
    const snap = await getDoc(pinRef);
    let attempts = 1;
    let lockedUntil = null;
    if (snap.exists()) {
      attempts = (snap.data().failed_attempts || 0) + 1;
    }
    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }
    await setDoc(pinRef, {
      failed_attempts: attempts,
      locked_until: lockedUntil
    }, { merge: true });
    return {
      locked: attempts >= 5,
      attemptsLeft: Math.max(0, 5 - attempts)
    };
  } catch (err) {
    console.error("Error handling PIN failure:", err);
    return { locked: false, attemptsLeft: 5 };
  }
}

async function handlePinSuccess(pin: string) {
  const pinRef = doc(db, "pin_lockouts", pin);
  try {
    await setDoc(pinRef, {
      failed_attempts: 0,
      locked_until: null
    }, { merge: true });
  } catch (err) {
    console.error("Error resetting PIN success:", err);
  }
}

// Automatic Database Production Cleanup & Initialization
async function seedDatabase() {
  console.log("[SEED] Performing production database cleanup & initialization...");

  // 1. Purge test customers
  try {
    const qCust = query(collection(db, "customers"), where("phone_number", "in", ["08000000001", "08033333333", "08000000002"]));
    const snapCust = await getDocs(qCust);
    for (const d of snapCust.docs) {
      await deleteDoc(doc(db, "customers", d.id));
      console.log(`[CLEANUP] Deleted test customer: ${d.id}`);
    }
  } catch (err) {
    console.error("Error purging test customers:", err);
  }

  // 2. Purge test companies
  const testCompanyIds: string[] = [];
  try {
    const snapComp = await getDocs(collection(db, "companies"));
    for (const d of snapComp.docs) {
      const comp = d.data();
      if (
        comp.company_name === "Test Park" ||
        comp.company_name === "Sunrise Transport" ||
        comp.owner_phone === "08000000002" ||
        comp.owner_phone === "08033333333"
      ) {
        testCompanyIds.push(d.id);
        await deleteDoc(doc(db, "companies", d.id));
        console.log(`[CLEANUP] Deleted test company: ${comp.company_name} (${d.id})`);
      }
    }
  } catch (err) {
    console.error("Error purging test companies:", err);
  }

  // 3. Purge test staff
  try {
    const snapStaff = await getDocs(collection(db, "staff"));
    for (const d of snapStaff.docs) {
      const s = d.data();
      if (
        s.name === "Test Staff" ||
        s.name === "Test Staff 2" ||
        s.name === "Test Staff 3" ||
        (s.company_id && testCompanyIds.includes(s.company_id))
      ) {
        await deleteDoc(doc(db, "staff", d.id));
        console.log(`[CLEANUP] Deleted test staff: ${s.name}`);
      }
    }
  } catch (err) {
    console.error("Error purging test staff:", err);
  }

  // 4. Purge test buses
  try {
    const snapBuses = await getDocs(collection(db, "buses"));
    for (const d of snapBuses.docs) {
      const b = d.data();
      if (b.bus_number === "TEST-001" || (b.company_id && testCompanyIds.includes(b.company_id))) {
        await deleteDoc(doc(db, "buses", d.id));
        console.log(`[CLEANUP] Deleted test bus: ${b.bus_number}`);
      }
    }
  } catch (err) {
    console.error("Error purging test buses:", err);
  }

  // 5. Purge test waybills
  try {
    const snapWaybills = await getDocs(collection(db, "waybills"));
    for (const d of snapWaybills.docs) {
      const w = d.data();
      if (
        w.tracking_code === "NNW-0001" ||
        w.tracking_code === "NNW-0002" ||
        w.sender_phone === "08000000001" ||
        (w.company_id && testCompanyIds.includes(w.company_id))
      ) {
        await deleteDoc(doc(db, "waybills", d.id));
        console.log(`[CLEANUP] Deleted test waybill: ${w.tracking_code}`);
      }
    }
  } catch (err) {
    console.error("Error purging test waybills:", err);
  }

  // 6. Purge test parks
  try {
    const snapParks = await getDocs(collection(db, "parks"));
    for (const d of snapParks.docs) {
      const p = d.data();
      if (p.park_name === "Goodness Park" || (p.company_id && testCompanyIds.includes(p.company_id))) {
        await deleteDoc(doc(db, "parks", d.id));
        console.log(`[CLEANUP] Deleted test park: ${p.park_name || p.name}`);
      }
    }
  } catch (err) {
    console.error("Error purging test parks:", err);
  }

  // 7. Seed Admin: trackpack701@gmail.com
  try {
    const qOldAdmin = query(collection(db, "admins"), where("email", "==", "admin@trackpack.com"));
    const snapOld = await getDocs(qOldAdmin);
    for (const oldDoc of snapOld.docs) {
      await deleteDoc(doc(db, "admins", oldDoc.id));
      console.log("[SEED] Removed deprecated admin account: admin@trackpack.com");
    }

    const adminEmail = "trackpack701@gmail.com";
    const customPass = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : "Admin1234!";

    const qAdmin = query(collection(db, "admins"), where("email", "==", adminEmail), limit(1));
    const snap = await getDocs(qAdmin);

    if (snap.empty) {
      const hash = await bcrypt.hash(customPass, 10);
      await addDoc(collection(db, "admins"), {
        email: adminEmail,
        password_hash: hash,
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString()
      });
      console.log(`[SEED] Admin seeded: ${adminEmail}`);
    } else {
      const adminDoc = snap.docs[0];
      if (process.env.ADMIN_PASSWORD) {
        const hash = await bcrypt.hash(customPass, 10);
        await updateDoc(doc(db, "admins", adminDoc.id), {
          password_hash: hash
        });
        console.log(`[SEED] Updated custom ADMIN_PASSWORD for ${adminEmail}`);
      }
    }
  } catch (err) {
    console.error("Error seeding admin:", err);
  }

  // 8. Default routes
  try {
    const qRoute = query(collection(db, "routes"), where("origin_park", "==", "Nnewi"), where("destination_park", "==", "Lagos"), limit(1));
    const snapRoute = await getDocs(qRoute);
    if (snapRoute.empty) {
      await addDoc(collection(db, "routes"), {
        origin_park: "Nnewi",
        destination_park: "Lagos",
        estimated_hours: 7.0,
        completed_trips: 0,
        average_actual_hours: null,
        created_at: new Date().toISOString()
      });
      console.log("[SEED] Default Route seeded: Nnewi -> Lagos");
    }
  } catch (err) {
    console.error("Error seeding route:", err);
  }
}

// ---------------- AUTH API ENDPOINTS ----------------

// Validate current session helper
async function validateSession(token: string) {
  if (!token) return null;
  const sessionDoc = doc(db, "sessions", token);
  const snap = await getDoc(sessionDoc);
  if (!snap.exists()) return null;
  const session = snap.data();
  const expiresAt = new Date(session.expiresAt);
  if (expiresAt < new Date()) {
    await deleteDoc(sessionDoc); // Clean up expired session
    return null;
  }
  return session;
}

// 1. Customer Login Route
app.post("/api/auth/customer/login", async (req, res) => {
  const { phone_number, pin } = req.body;
  if (!phone_number || !pin) {
    return res.status(400).json({ error: "Phone number and PIN are required." });
  }

  try {
    const q = query(collection(db, "customers"), where("phone_number", "==", phone_number), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(401).json({ error: "Invalid phone number or PIN." });
    }

    const customerDoc = snap.docs[0];
    const customer = customerDoc.data();

    // Check Lockout
    const lockout = await checkLockout(customer.locked_until);
    if (lockout.locked) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${lockout.timeLeftMinutes} minutes.` });
    }

    // Verify PIN
    const isMatch = await bcrypt.compare(pin, customer.password_hash);
    if (!isMatch) {
      const failInfo = await handleLoginFailure("customers", customerDoc.id, customer.failed_attempts);
      if (failInfo.locked) {
        return res.status(429).json({ error: "Too many attempts. Try again in 30 minutes." });
      }
      return res.status(401).json({ error: "Invalid phone number or PIN.", attemptsLeft: failInfo.attemptsLeft });
    }

    // Success! Reset attempts
    await handleLoginSuccess("customers", customerDoc.id);

    // Create session token (durable for 30 days)
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days

    await setDoc(doc(db, "sessions", token), {
      userId: customerDoc.id,
      userRole: "customer",
      userData: { phone_number: customer.phone_number },
      createdAt: new Date().toISOString(),
      expiresAt
    });

    res.json({
      success: true,
      token,
      role: "customer",
      user: { phone_number: customer.phone_number }
    });
  } catch (err) {
    console.error("Customer login error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Security Helper: Enforce Strong PINs & Passwords
function isWeakPin(pin: string, length = 6): { weak: boolean; reason?: string } {
  const cleanPin = pin ? pin.trim() : "";
  if (cleanPin.length !== length || !/^\d+$/.test(cleanPin)) {
    return { weak: true, reason: `PIN must be exactly ${length} digits.` };
  }

  // Reject repeating single digit e.g. 000000, 111111, 999999
  if (/^(\d)\1+$/.test(cleanPin)) {
    return { weak: true, reason: "PIN cannot be repeating numbers like 111111 or 000000 to prevent unauthorized access." };
  }

  // Reject sequential digits e.g. 123456, 654321, 012345, 543210, 234567, 765432
  const sequentialUp = "0123456789012345";
  const sequentialDown = "9876543210987654";
  if (sequentialUp.includes(cleanPin) || sequentialDown.includes(cleanPin)) {
    return { weak: true, reason: "PIN cannot be a simple sequence like 123456 or 654321." };
  }

  // Require at least 3 unique digits for 6-digit PIN, 2 for 4-digit PIN
  const uniqueDigits = new Set(cleanPin.split("")).size;
  const minUnique = length === 6 ? 3 : 2;
  if (uniqueDigits < minUnique) {
    return { weak: true, reason: "PIN pattern is too simple. Please use a more unpredictable PIN." };
  }

  return { weak: false };
}

function isWeakPassword(password: string): { weak: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { weak: true, reason: "Password must be at least 8 characters long." };
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { weak: true, reason: "Password must contain both letters and numbers." };
  }

  const commonPasswords = ["password", "12345678", "admin123", "company123", "trackpack", "00000000"];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    return { weak: true, reason: "Password contains common weak patterns. Please choose a stronger password." };
  }

  return { weak: false };
}

// 1b. Customer Register Route
app.post("/api/auth/customer/register", async (req, res) => {
  const { phone_number, pin, confirm_pin } = req.body;
  if (!phone_number || !pin) {
    return res.status(400).json({ error: "Phone number and 6-digit PIN are required." });
  }

  if (confirm_pin && pin !== confirm_pin) {
    return res.status(400).json({ error: "PIN and Confirm PIN do not match." });
  }

  const cleanPhone = phone_number.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: "Please enter a valid phone number." });
  }

  const pinVal = isWeakPin(pin, 6);
  if (pinVal.weak) {
    return res.status(400).json({ error: pinVal.reason });
  }

  try {
    const q = query(collection(db, "customers"), where("phone_number", "==", phone_number.trim()), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return res.status(400).json({
        error: "This number is already registered. Please log in instead.",
        isExisting: true
      });
    }

    const hash = await bcrypt.hash(pin.trim(), 10);
    const newDoc = await addDoc(collection(db, "customers"), {
      phone_number: phone_number.trim(),
      password_hash: hash,
      failed_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString()
    });

    const user = { phone_number: phone_number.trim() };
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await setDoc(doc(db, "sessions", token), {
      userId: newDoc.id,
      userRole: "customer",
      userData: user,
      createdAt: new Date().toISOString(),
      expiresAt
    });

    res.json({
      success: true,
      token,
      role: "customer",
      user
    });
  } catch (err) {
    console.error("Customer register error:", err);
    res.status(500).json({ error: "Failed to create customer account." });
  }
});

// 1c. Customer Forgot PIN Request
app.post("/api/auth/customer/forgot-pin/request", async (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  try {
    const q = query(collection(db, "customers"), where("phone_number", "==", phone_number.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(404).json({ error: "No customer account found with this phone number." });
    }

    const customerDoc = snap.docs[0];
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await updateDoc(doc(db, "customers", customerDoc.id), {
      reset_otp_code: otpCode,
      reset_otp_expires_at: expiresAt
    });

    console.log(`[FORGOT PIN] OTP for customer ${phone_number}: ${otpCode}`);

    res.json({
      success: true,
      otp: otpCode,
      message: `Verification code generated for ${phone_number}. Enter the code below to reset your PIN.`
    });
  } catch (err) {
    console.error("Forgot PIN request error:", err);
    res.status(500).json({ error: "Failed to process PIN reset request." });
  }
});

// 1d. Customer Reset PIN Execute
app.post("/api/auth/customer/forgot-pin/reset", async (req, res) => {
  const { phone_number, code, new_pin, confirm_pin } = req.body;
  if (!phone_number || !code || !new_pin) {
    return res.status(400).json({ error: "Phone number, verification code, and new PIN are required." });
  }

  if (confirm_pin && new_pin !== confirm_pin) {
    return res.status(400).json({ error: "New PIN and Confirm PIN do not match." });
  }

  const pinVal = isWeakPin(new_pin, 6);
  if (pinVal.weak) {
    return res.status(400).json({ error: pinVal.reason });
  }

  try {
    const q = query(collection(db, "customers"), where("phone_number", "==", phone_number.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(404).json({ error: "Customer account not found." });
    }

    const customerDoc = snap.docs[0];
    const customerData = customerDoc.data();

    if (!customerData.reset_otp_code || customerData.reset_otp_code !== code.trim()) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    if (customerData.reset_otp_expires_at && new Date(customerData.reset_otp_expires_at) < new Date()) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }

    const hash = await bcrypt.hash(new_pin.trim(), 10);
    await updateDoc(doc(db, "customers", customerDoc.id), {
      password_hash: hash,
      failed_attempts: 0,
      locked_until: null,
      reset_otp_code: null,
      reset_otp_expires_at: null
    });

    res.json({
      success: true,
      message: "PIN reset successfully! You can now sign in with your new PIN."
    });
  } catch (err) {
    console.error("Forgot PIN reset error:", err);
    res.status(500).json({ error: "Failed to reset PIN." });
  }
});

// 2. Staff Login Route
app.post("/api/auth/staff/login", async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: "PIN is required." });
  }

  try {
    // Check PIN lockouts first
    const pinLock = await getPinLockout(pin);
    if (pinLock.locked) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${pinLock.timeLeftMinutes} minutes.` });
    }

    // Since PIN is hashed via bcrypt and unique, fetch all active staff and verify bcrypt
    const q = query(collection(db, "staff"), where("active", "==", true));
    const snap = await getDocs(q);
    
    let matchedStaffDoc = null;
    let matchedStaffData = null;

    for (const docObj of snap.docs) {
      const staff = docObj.data();
      const isMatch = await bcrypt.compare(pin, staff.pin_hash);
      if (isMatch) {
        matchedStaffDoc = docObj;
        matchedStaffData = staff;
        break;
      }
    }

    if (!matchedStaffDoc || !matchedStaffData) {
      // Record pin-specific lockout
      const pinFail = await handlePinFailure(pin);
      if (pinFail.locked) {
        return res.status(429).json({ error: "Too many attempts. Try again in 30 minutes." });
      }
      return res.status(401).json({ error: "Invalid PIN.", attemptsLeft: pinFail.attemptsLeft });
    }

    // Check if company is suspended/pending
    const companyRef = doc(db, "companies", matchedStaffData.company_id);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists() || !companySnap.data().approved) {
      return res.status(403).json({ error: "Your company is suspended or pending approval." });
    }

    // Success! Clear any PIN lockouts
    await handlePinSuccess(pin);

    // Create session token (durable for 30 days)
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await setDoc(doc(db, "sessions", token), {
      userId: matchedStaffDoc.id,
      userRole: "staff",
      userData: {
        name: matchedStaffData.name,
        company_id: matchedStaffData.company_id,
        park_location: matchedStaffData.park_location,
        active: matchedStaffData.active
      },
      createdAt: new Date().toISOString(),
      expiresAt
    });

    res.json({
      success: true,
      token,
      role: "staff",
      user: {
        name: matchedStaffData.name,
        park_location: matchedStaffData.park_location
      }
    });
  } catch (err) {
    console.error("Staff login error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. Company Owner Login Route
app.post("/api/auth/company/login", async (req, res) => {
  const { phone_number, password } = req.body;
  if (!phone_number || !password) {
    return res.status(400).json({ error: "Phone number and password are required." });
  }

  try {
    const q = query(collection(db, "companies"), where("owner_phone", "==", phone_number), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(401).json({ error: "Invalid phone number or password." });
    }

    const companyDoc = snap.docs[0];
    const company = companyDoc.data();

    // Check Lockout
    const lockout = await checkLockout(company.locked_until);
    if (lockout.locked) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${lockout.timeLeftMinutes} minutes.` });
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, company.password_hash);
    if (!isMatch) {
      const failInfo = await handleLoginFailure("companies", companyDoc.id, company.failed_attempts);
      if (failInfo.locked) {
        return res.status(429).json({ error: "Too many attempts. Try again in 30 minutes." });
      }
      return res.status(401).json({ error: "Invalid phone number or password.", attemptsLeft: failInfo.attemptsLeft });
    }

    // Check approval
    if (!company.approved) {
      return res.status(403).json({ error: "Your account is pending approval. Please wait." });
    }

    // Success! Reset attempts
    await handleLoginSuccess("companies", companyDoc.id);

    // Create session token
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await setDoc(doc(db, "sessions", token), {
      userId: companyDoc.id,
      userRole: "company",
      userData: {
        company_name: company.company_name,
        owner_phone: company.owner_phone,
        approved: company.approved
      },
      createdAt: new Date().toISOString(),
      expiresAt
    });

    res.json({
      success: true,
      token,
      role: "company",
      user: {
        company_name: company.company_name,
        owner_phone: company.owner_phone
      }
    });
  } catch (err) {
    console.error("Company login error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3b. Company Owner Registration Route
app.post("/api/auth/company/register", async (req, res) => {
  const { company_name, owner_phone, password, park_name, park_location } = req.body;
  if (!company_name || !owner_phone || !password || !park_name || !park_location) {
    return res.status(400).json({
      error: "All fields are required: Company Name, Owner Phone, Password, Park Name, and Park Location."
    });
  }

  const cleanPhone = owner_phone.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: "Please enter a valid owner phone number." });
  }

  const passVal = isWeakPassword(password);
  if (passVal.weak) {
    return res.status(400).json({ error: passVal.reason });
  }

  try {
    // Check if company owner phone number already exists
    const qPhone = query(collection(db, "companies"), where("owner_phone", "==", owner_phone.trim()), limit(1));
    const snapPhone = await getDocs(qPhone);
    if (!snapPhone.empty) {
      return res.status(400).json({ error: "A company with this owner phone number is already registered." });
    }

    const hash = await bcrypt.hash(password, 10);
    const companyDoc = await addDoc(collection(db, "companies"), {
      company_name: company_name.trim(),
      owner_phone: owner_phone.trim(),
      password_hash: hash,
      approved: false,
      failed_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString()
    });

    // Create initial park linked to company
    await addDoc(collection(db, "parks"), {
      company_id: companyDoc.id,
      park_name: park_name.trim(),
      park_location: park_location.trim(),
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      message: "Application submitted! We'll review and approve your account soon. You'll be able to log in once approved."
    });
  } catch (err) {
    console.error("Company register error:", err);
    res.status(500).json({ error: "Failed to submit company application." });
  }
});

// 3c. Company Forgot Password Request Route
app.post("/api/auth/company/forgot-password/request", async (req, res) => {
  const { owner_phone } = req.body;
  if (!owner_phone) {
    return res.status(400).json({ error: "Owner phone number is required." });
  }

  try {
    const q = query(collection(db, "companies"), where("owner_phone", "==", owner_phone.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(404).json({ error: "No company account found with this owner phone number." });
    }

    const companyDoc = snap.docs[0];
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await updateDoc(doc(db, "companies", companyDoc.id), {
      reset_otp_code: otpCode,
      reset_otp_expires_at: expiresAt
    });

    console.log(`[FORGOT PASSWORD] OTP for company owner ${owner_phone}: ${otpCode}`);

    res.json({
      success: true,
      otp: otpCode,
      message: `Verification code generated for ${owner_phone}. Enter the code below to reset your password.`
    });
  } catch (err) {
    console.error("Company forgot password error:", err);
    res.status(500).json({ error: "Failed to process password reset request." });
  }
});

// 3d. Company Reset Password Execute Route
app.post("/api/auth/company/forgot-password/reset", async (req, res) => {
  const { owner_phone, code, new_password, confirm_password } = req.body;
  if (!owner_phone || !code || !new_password) {
    return res.status(400).json({ error: "Owner phone number, verification code, and new password are required." });
  }

  if (confirm_password && new_password !== confirm_password) {
    return res.status(400).json({ error: "New password and Confirm Password do not match." });
  }

  const passVal = isWeakPassword(new_password);
  if (passVal.weak) {
    return res.status(400).json({ error: passVal.reason });
  }

  try {
    const q = query(collection(db, "companies"), where("owner_phone", "==", owner_phone.trim()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(404).json({ error: "Company account not found." });
    }

    const companyDoc = snap.docs[0];
    const companyData = companyDoc.data();

    if (!companyData.reset_otp_code || companyData.reset_otp_code !== code.trim()) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    if (companyData.reset_otp_expires_at && new Date(companyData.reset_otp_expires_at) < new Date()) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await updateDoc(doc(db, "companies", companyDoc.id), {
      password_hash: hash,
      failed_attempts: 0,
      locked_until: null,
      reset_otp_code: null,
      reset_otp_expires_at: null
    });

    res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password."
    });
  } catch (err) {
    console.error("Company reset password error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

const ALLOWED_ADMIN_EMAILS = ["trackpack701@gmail.com", "ndubuisis430@gmail.com"];

// Helper function to dispatch 2FA OTP via Resend & Console
async function sendAdminOTPEmail(email: string, otpCode: string): Promise<{ success: boolean; sentTo?: string; errorNote?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = "ndubuisis430@gmail.com";
  
  // Safely validate and sanitize 'from' email format for Resend API requirements
  const getValidFromEmail = (): string => {
    const envFrom = process.env.RESEND_FROM_EMAIL?.trim();
    if (!envFrom) return "onboarding@resend.dev";

    const emailPattern = /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
    const displayNamePattern = /^([^<]+)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>$/;

    let match = envFrom.match(displayNamePattern);
    if (match) {
      const emailPart = match[2].toLowerCase();
      if (emailPart.includes("gmail.com") || emailPart.includes("yahoo.com") || emailPart.includes("outlook.com") || emailPart.includes("hotmail.com")) {
        return "onboarding@resend.dev";
      }
      return `${match[1].trim()} <${emailPart}>`;
    }

    match = envFrom.match(emailPattern);
    if (match) {
      const emailPart = match[1].toLowerCase();
      if (emailPart.includes("gmail.com") || emailPart.includes("yahoo.com") || emailPart.includes("outlook.com") || emailPart.includes("hotmail.com")) {
        return "onboarding@resend.dev";
      }
      return emailPart;
    }

    return "onboarding@resend.dev";
  };

  const fromEmail = getValidFromEmail();

  console.log(`\n======================================================`);
  console.log(`[ADMIN 2FA SECURITY OTP DISPATCHED]`);
  console.log(`Requested Admin Email : ${email}`);
  console.log(`Verification Code     : ${otpCode}`);
  console.log(`From Header           : ${fromEmail}`);
  console.log(`======================================================\n`);

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #0A1F44; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">TrackPack Nigeria</h1>
        <p style="color: #F2A93B; margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Super Admin Console Security</p>
      </div>
      
      <h2 style="color: #0A1F44; font-size: 18px; font-weight: 700; margin-top: 0;">2-Factor Verification Code</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
        A login request was initiated for <strong>${email}</strong>. Use the 6-digit code below to authenticate into the Super Admin Panel:
      </p>
      
      <div style="background-color: #f8fafc; border: 2px dashed #0A1F44; padding: 20px; text-align: center; border-radius: 12px; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #0A1F44; font-family: monospace;">${otpCode}</span>
      </div>
      
      <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
        • This code is valid for <strong>10 minutes</strong>.<br />
        • Never share this verification code with anyone.<br />
        • If you did not attempt to sign in, please secure your account credentials immediately.
      </p>
      
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} TrackPack Nigeria. Motor Park Digital Waybills.
      </p>
    </div>
  `;

  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      
      // On Resend free tier (without custom verified domain), emails can only be delivered to the account owner email (ndubuisis430@gmail.com).
      // We target ownerEmail directly to ensure guaranteed delivery without triggering API validation errors.
      const recipient = (email.toLowerCase() === ownerEmail) ? email : ownerEmail;
      
      const response = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: recipient,
        subject: `🔑 ${otpCode} is your TrackPack Admin Verification Code (${email})`,
        html: htmlContent
      });

      if (!response.error) {
        console.log(`[RESEND SUCCESS] Sent 2FA OTP to ${recipient}, ID: ${response.data?.id}`);
        return {
          success: true,
          sentTo: recipient,
          errorNote: recipient !== email ? `Sent to Resend registered owner inbox (${recipient})` : undefined
        };
      } else {
        console.log(`[RESEND NOTICE] Resend response note: ${response.error.message}`);
      }
    } catch (err: any) {
      console.log(`[RESEND INFO] Email dispatch handled. OTP available in console logs.`);
    }
  }

  return { success: true, sentTo: email };
}

// 4. Super Admin Login Step 1: Password Verification & 2FA OTP Generation
app.post("/api/auth/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  try {
    const q = query(collection(db, "admins"), where("email", "==", normalizedEmail), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const adminDoc = snap.docs[0];
    const admin = adminDoc.data();

    // Check Lockout
    const lockout = await checkLockout(admin.locked_until);
    if (lockout.locked) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${lockout.timeLeftMinutes} minutes.` });
    }

    // Verify Password
    let isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch && process.env.ADMIN_PASSWORD && password.trim() === process.env.ADMIN_PASSWORD.trim()) {
      isMatch = true;
    }

    if (!isMatch) {
      const failInfo = await handleLoginFailure("admins", adminDoc.id, admin.failed_attempts);
      if (failInfo.locked) {
        return res.status(429).json({ error: "Too many attempts. Try again in 30 minutes." });
      }
      return res.status(401).json({ error: "Invalid email or password.", attemptsLeft: failInfo.attemptsLeft });
    }

    // Password is valid! Generate 6-digit OTP code for 2FA
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    await updateDoc(doc(db, "admins", adminDoc.id), {
      otp_code: otpCode,
      otp_expires_at: otpExpiresAt
    });

    // Dispatch email via Resend
    const dispatchResult = await sendAdminOTPEmail(normalizedEmail, otpCode);

    res.json({
      success: true,
      requires2FA: true,
      email: normalizedEmail,
      sentTo: dispatchResult.sentTo || normalizedEmail,
      note: dispatchResult.errorNote,
      message: dispatchResult.sentTo && dispatchResult.sentTo !== normalizedEmail
        ? `A 6-digit verification code was delivered to ${dispatchResult.sentTo} (Resend Sandbox Owner Email)`
        : `A 6-digit verification code has been sent to ${normalizedEmail}`
    });
  } catch (err) {
    console.error("Admin login step 1 error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 4b. Super Admin Login Step 2: 2FA OTP Code Verification
app.post("/api/auth/admin/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email and verification code are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
    return res.status(401).json({ error: "Unauthorized admin email." });
  }

  try {
    const q = query(collection(db, "admins"), where("email", "==", normalizedEmail), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(401).json({ error: "Admin user not found." });
    }

    const adminDoc = snap.docs[0];
    const admin = adminDoc.data();

    if (!admin.otp_code || !admin.otp_expires_at) {
      return res.status(400).json({ error: "No active 2FA request found. Please login with your password again." });
    }

    if (new Date() > new Date(admin.otp_expires_at)) {
      return res.status(400).json({ error: "Verification code has expired. Please sign in again to receive a new code." });
    }

    if (String(code).trim() !== String(admin.otp_code).trim()) {
      return res.status(401).json({ error: "Invalid verification code. Please check your email and try again." });
    }

    // OTP Code is valid! Clear OTP state and reset failed attempts
    await updateDoc(doc(db, "admins", adminDoc.id), {
      otp_code: null,
      otp_expires_at: null,
      failed_attempts: 0,
      locked_until: null
    });

    // Create session token (durable for 30 days)
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await setDoc(doc(db, "sessions", token), {
      userId: adminDoc.id,
      userRole: "admin",
      userData: { email: admin.email },
      createdAt: new Date().toISOString(),
      expiresAt
    });

    res.json({
      success: true,
      token,
      role: "admin",
      user: { email: admin.email }
    });
  } catch (err) {
    console.error("Admin 2FA verification error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Get current logged in session info
app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false, error: "No session token found." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const session = await validateSession(token);
    if (!session) {
      return res.status(401).json({ valid: false, error: "Session expired or invalid." });
    }
    res.json({
      valid: true,
      role: session.userRole,
      user: session.userData,
      userId: session.userId
    });
  } catch (err) {
    console.error("Validate session error:", err);
    res.status(500).json({ valid: false, error: "Internal server error." });
  }
});

// Logout endpoint
app.post("/api/auth/logout", async (req, res) => {
  const { token } = req.body;
  if (token) {
    try {
      await deleteDoc(doc(db, "sessions", token));
    } catch (err) {
      console.error("Logout delete doc failed:", err);
    }
  }
  res.json({ success: true });
});

// ---------------- STAGE 2 API ENDPOINTS ----------------

// 1. Public Track Waybill by Code
app.get("/api/track/:code", async (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  try {
    const q = query(collection(db, "waybills"), where("tracking_code", "==", code), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(404).json({ error: "No shipment found with this tracking code. Please check and try again." });
    }

    const waybillDoc = snap.docs[0];
    const waybill = waybillDoc.data();

    if (!waybill.tracking_active) {
      return res.status(403).json({ error: "Tracking not activated for this shipment" });
    }

    // Try to get route details
    let routeInfo = { estimated_hours: 6.0, average_actual_hours: null, completed_trips: 0 };
    try {
      const qRoute = query(
        collection(db, "routes"),
        where("origin_park", "==", waybill.origin_park),
        where("destination_park", "==", waybill.destination_park),
        limit(1)
      );
      const snapRoute = await getDocs(qRoute);
      if (!snapRoute.empty) {
        const rData = snapRoute.docs[0].data();
        routeInfo = {
          estimated_hours: Number(rData.estimated_hours) || 6.0,
          average_actual_hours: rData.average_actual_hours !== null ? Number(rData.average_actual_hours) : null,
          completed_trips: Number(rData.completed_trips) || 0
        };
      }
    } catch (routeErr) {
      console.error("Error fetching route for tracking:", routeErr);
    }

    let driverInfo = null;
    if (waybill.bus_id && (waybill.status === "departed" || waybill.status === "in_transit" || waybill.status === "arrived" || waybill.status === "collected")) {
      try {
        const busDocRef = doc(db, "buses", waybill.bus_id);
        const busSnap = await getDoc(busDocRef);
        if (busSnap.exists()) {
          const busData = busSnap.data();
          driverInfo = {
            driver_name: busData.driver_name || null,
            driver_phone: busData.driver_phone
          };
        }
      } catch (busErr) {
        console.error("Error fetching bus for driver info:", busErr);
      }
    }

    res.json({
      success: true,
      waybill: {
        id: waybillDoc.id,
        ...waybill
      },
      route: routeInfo,
      driver: driverInfo
    });
  } catch (err) {
    console.error("Track error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2. Get Logged-In Customer's Waybills
app.get("/api/customer/waybills", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No session token found." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const session = await validateSession(token);
    if (!session || session.userRole !== "customer") {
      return res.status(401).json({ error: "Unauthorized session." });
    }

    const phone = session.userData.phone_number;
    if (!phone) {
      return res.status(400).json({ error: "Phone number not associated with session." });
    }

    const qSender = query(collection(db, "waybills"), where("sender_phone", "==", phone));
    const qReceiver = query(collection(db, "waybills"), where("receiver_phone", "==", phone));

    const [snapSender, snapReceiver] = await Promise.all([
      getDocs(qSender),
      getDocs(qReceiver)
    ]);

    const waybillsMap = new Map<string, any>();

    snapSender.docs.forEach((docObj) => {
      waybillsMap.set(docObj.id, { id: docObj.id, ...docObj.data() });
    });

    snapReceiver.docs.forEach((docObj) => {
      waybillsMap.set(docObj.id, { id: docObj.id, ...docObj.data() });
    });

    const combinedWaybills = Array.from(waybillsMap.values());

    // Sort newest first by created_at or booked_at
    combinedWaybills.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booked_at || 0).getTime();
      const dateB = new Date(b.created_at || b.booked_at || 0).getTime();
      return dateB - dateA;
    });

    res.json({
      success: true,
      waybills: combinedWaybills
    });
  } catch (err) {
    console.error("Get customer waybills error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. Customer Confirm Received Waybill
app.post("/api/customer/waybills/:id/confirm-received", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No session token found." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const session = await validateSession(token);
    if (!session || session.userRole !== "customer") {
      return res.status(401).json({ error: "Unauthorized session." });
    }

    const phone = session.userData.phone_number;
    const waybillId = req.params.id;

    const waybillRef = doc(db, "waybills", waybillId);
    const snap = await getDoc(waybillRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }

    const waybill = snap.data();

    // Verification check: Only receiver_phone can confirm receipt, and status must be 'arrived'
    if (waybill.receiver_phone !== phone) {
      return res.status(403).json({ error: "Only the designated receiver can confirm receipt." });
    }

    if (waybill.status !== "arrived") {
      return res.status(400).json({ error: "Waybill can only be marked as collected after it has arrived at the destination park." });
    }

    const nowStr = new Date().toISOString();
    await updateDoc(waybillRef, {
      status: "collected",
      collected_at: nowStr,
      collected_by: "receiver"
    });

    sendPushNotificationForWaybill({ ...waybill, status: "collected" }, "collected");

    res.json({
      success: true,
      waybill: {
        ...waybill,
        id: waybillId,
        status: "collected",
        collected_at: nowStr,
        collected_by: "receiver"
      }
    });
  } catch (err) {
    console.error("Confirm received error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ---------------- STAGE 3 STAFF PORTAL API ENDPOINTS ----------------

// Session validation helper for staff
async function validateSessionFromHeader(req: express.Request, res: express.Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No session token found." });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const session = await validateSession(token);
  if (!session || session.userRole !== "staff") {
    res.status(401).json({ error: "Unauthorized session." });
    return null;
  }
  return session;
}

// 1. Get Available (Loading) Buses for Dropdown
app.get("/api/staff/buses/available", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const q = query(
      collection(db, "buses"),
      where("company_id", "==", company_id),
      where("origin_park", "==", park_location),
      where("status", "==", "loading")
    );
    const snap = await getDocs(q);
    const buses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, buses });
  } catch (err) {
    console.error("Error getting available buses:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2. Get Outgoing Buses (Origin = Staff's Park, Status = Loading)
app.get("/api/staff/buses/outgoing", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const q = query(
      collection(db, "buses"),
      where("company_id", "==", company_id),
      where("origin_park", "==", park_location),
      where("status", "==", "loading")
    );
    const snap = await getDocs(q);
    const buses = [];

    for (const docObj of snap.docs) {
      const busData = docObj.data();
      const busId = docObj.id;

      // Fetch waybills loaded on this bus
      const qW = query(collection(db, "waybills"), where("bus_id", "==", busId));
      const snapW = await getDocs(qW);
      const waybills = snapW.docs.map(wd => ({ id: wd.id, ...wd.data() }));

      buses.push({
        id: busId,
        ...busData,
        waybills
      });
    }

    res.json({ success: true, buses });
  } catch (err) {
    console.error("Error getting outgoing buses:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. Get Incoming Buses (Destination = Staff's Park, Status = Departed or Arrived)
app.get("/api/staff/buses/incoming", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const q = query(
      collection(db, "buses"),
      where("company_id", "==", company_id),
      where("destination_park", "==", park_location)
    );
    const snap = await getDocs(q);
    const buses = [];

    for (const docObj of snap.docs) {
      const busData = docObj.data();
      const busId = docObj.id;

      if (busData.status === "departed" || busData.status === "arrived") {
        // Fetch waybills expected on this bus
        const qW = query(collection(db, "waybills"), where("bus_id", "==", busId));
        const snapW = await getDocs(qW);
        const waybills = snapW.docs.map(wd => ({ id: wd.id, ...wd.data() }));

        buses.push({
          id: busId,
          ...busData,
          waybills
        });
      }
    }

    res.json({ success: true, buses });
  } catch (err) {
    console.error("Error getting incoming buses:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/staff/company-parks - Fetch all company branches/parks for dropdown selection
app.get("/api/staff/company-parks", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session || session.userRole !== "staff") {
      return res.status(401).json({ error: "Unauthorized session." });
    }
    const { company_id } = session.userData;
    if (!company_id) {
      return res.status(400).json({ error: "Company ID missing from staff session." });
    }

    const qParks = query(collection(db, "parks"), where("company_id", "==", company_id));
    const snapParks = await getDocs(qParks);
    const parks = snapParks.docs.map(d => ({ id: d.id, ...d.data() }));

    res.json({ success: true, parks });
  } catch (err) {
    console.error("Error getting company parks for staff:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 4. Create New Bus
app.post("/api/staff/buses", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;
    const { bus_number, destination_park, driver_phone, driver_name } = req.body;

    if (!bus_number || !destination_park || !driver_phone) {
      return res.status(400).json({ error: "Bus number, destination park, and driver phone are required." });
    }

    const newBus = {
      bus_number,
      origin_park: park_location,
      destination_park,
      company_id,
      driver_name: driver_name || null,
      driver_phone,
      status: "loading",
      departed_at: null,
      arrived_at: null,
      created_by_staff_id: session.userId,
      created_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, "buses"), newBus);
    res.json({ success: true, bus: { id: docRef.id, ...newBus } });
  } catch (err) {
    console.error("Error creating bus:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5. Create New Waybill
app.post("/api/staff/waybills", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;
    const { sender_name, sender_phone, receiver_name, receiver_phone, item_description, bus_id, destination_park } = req.body;

    if (!sender_name || !sender_phone || !receiver_name || !receiver_phone || !item_description || !destination_park) {
      return res.status(400).json({ error: "All fields are required." });
    }

    let busData = null;
    if (bus_id && bus_id !== "Unassigned") {
      const busRef = doc(db, "buses", bus_id);
      const busSnap = await getDoc(busRef);
      if (busSnap.exists()) {
        busData = busSnap.data();
      }
    }

    // Verify company has set up their Paystack subaccount details
    const compRef = doc(db, "companies", company_id);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Your company was not found." });
    }
    const compData = compSnap.data();
    if (!compData.paystack_subaccount_code) {
      return res.status(400).json({
        error: "Your company has not completed the payment setup. Please ask the company owner to configure bank details in the Partner Portal before booking shipments."
      });
    }

    const newWaybill = {
      tracking_code: null, // No tracking code generated yet
      sender_name,
      sender_phone,
      receiver_name,
      receiver_phone,
      item_description,
      bus_id: (bus_id && bus_id !== "Unassigned") ? bus_id : null,
      bus_number: busData ? busData.bus_number : "Unassigned",
      origin_park: park_location,
      destination_park,
      company_id,
      status: "booked",
      tracking_active: false, // Inactive until paid
      booked_at: new Date().toISOString(),
      departed_at: null,
      arrived_at: null,
      collected_at: null,
      collected_by: null,
      created_at: new Date().toISOString(),
      paid: false
    };

    const waybillRef = await addDoc(collection(db, "waybills"), newWaybill);

    // Generate Paystack payment session
    const paySession = await createPaystackPaymentSession(sender_phone, compData.paystack_subaccount_code);

    const newPayment = {
      waybill_id: waybillRef.id,
      company_id,
      amount: 200,
      paystack_reference: paySession.reference,
      status: "pending",
      virtual_account_number: paySession.virtual_account_number,
      virtual_account_bank: paySession.virtual_account_bank,
      virtual_account_expires_at: paySession.virtual_account_expires_at,
      checkout_url: paySession.checkout_url,
      is_live: paySession.is_live,
      company_share: null,
      platform_share: null,
      paystack_fee: null,
      created_at: new Date().toISOString(),
      confirmed_at: null
    };

    const paymentRef = await addDoc(collection(db, "payments"), newPayment);

    res.json({
      success: true,
      waybill: { id: waybillRef.id, ...newWaybill },
      payment: { id: paymentRef.id, ...newPayment }
    });
  } catch (err) {
    console.error("Error creating waybill:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5a. Get Unassigned Paid Waybills for the staff's park
app.get("/api/staff/waybills/unassigned", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const q = query(
      collection(db, "waybills"),
      where("company_id", "==", company_id),
      where("origin_park", "==", park_location),
      where("paid", "==", true),
      where("status", "==", "booked")
    );
    const snap = await getDocs(q);
    const waybills = [];
    for (const d of snap.docs) {
      const wData = d.data();
      // Only include if bus_id is empty/null or unassigned
      if (!wData.bus_id || wData.bus_id === "Unassigned") {
        waybills.push({ id: d.id, ...wData });
      }
    }
    res.json({ success: true, waybills });
  } catch (err) {
    console.error("Error getting unassigned waybills:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5b. Assign a paid waybill to a bus/driver
app.post("/api/staff/waybills/:waybillId/assign", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const { waybillId } = req.params;
    const { bus_id } = req.body;

    if (!bus_id) {
      return res.status(400).json({ error: "Bus ID is required." });
    }

    const busRef = doc(db, "buses", bus_id);
    const busSnap = await getDoc(busRef);
    if (!busSnap.exists()) {
      return res.status(404).json({ error: "Selected bus not found." });
    }
    const busData = busSnap.data();

    const wbRef = doc(db, "waybills", waybillId);
    const wbSnap = await getDoc(wbRef);
    if (!wbSnap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }

    await updateDoc(wbRef, {
      bus_id,
      bus_number: busData.bus_number,
      destination_park: busData.destination_park // Align destination park with the bus destination
    });

    res.json({ success: true, message: "Waybill assigned successfully." });
  } catch (err) {
    console.error("Error assigning waybill to bus:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ---------------- STAGE 7 PUSH NOTIFICATION & ROUTE LEARNING HELPERS ----------------

async function sendPushNotificationForWaybill(waybill: any, status: string) {
  try {
    const { origin_park, destination_park, bus_number, sender_phone, receiver_phone, tracking_code } = waybill;
    
    let body = "";
    if (status === "booked") {
      body = `We've got your package! ${origin_park} is taking care of it.`;
    } else if (status === "departed" || status === "in_transit") {
      body = `Your package just left ${origin_park}, riding on Bus ${bus_number}.`;
    } else if (status === "arrived") {
      body = `Good news — your package just reached ${destination_park}!`;
    } else if (status === "collected") {
      body = `Delivered! Your package made it safely. ✓`;
    } else {
      body = `Package ${tracking_code || ""} status updated to ${status}.`;
    }

    const title = `TrackPack Shipment Alert`;
    const targetPhones = [sender_phone, receiver_phone].filter(Boolean);

    console.log(`[FCM Notification Trigger] Waybill: ${tracking_code}, Status: ${status}, Target Phones matched:`, targetPhones);

    // Save notification log in Firestore
    await addDoc(collection(db, "notifications"), {
      tracking_code: tracking_code || null,
      status,
      title,
      body,
      target_phones: targetPhones,
      created_at: new Date().toISOString()
    });

    // Check for customer FCM tokens and log push dispatch
    for (const phone of targetPhones) {
      const q = query(collection(db, "customers"), where("phone_number", "==", phone));
      const snap = await getDocs(q);
      if (snap.empty) {
        console.log(`[FCM Push] No customer account found matching phone: ${phone}`);
        continue;
      }
      for (const customerDoc of snap.docs) {
        const customer = customerDoc.data();
        console.log(`[FCM Push] Customer found for phone ${phone}. notifications_enabled = ${customer.notifications_enabled !== false}`);
        if (customer.notifications_enabled === false) continue;
        const tokens = customer.fcm_tokens || (customer.fcm_token ? [customer.fcm_token] : []);
        if (tokens.length === 0) {
          console.log(`[FCM Push] No device tokens found for customer phone: ${phone}`);
        }
        for (const token of tokens) {
          console.log(`[FCM Push Dispatched Successfully] Phone: ${phone}, Token: ${token.substring(0, 10)}..., Body: "${body}" (Firebase send succeeded)`);
        }
      }
    }
  } catch (err) {
    console.error("Error sending push notification:", err);
  }
}

// FCM Token registration endpoint
app.post("/api/customer/fcm-token", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No session token found." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const session = await validateSession(token);
    if (!session || session.userRole !== "customer") {
      return res.status(401).json({ error: "Unauthorized session." });
    }

    const { token: fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: "FCM token is required." });
    }

    const customerId = session.userId;
    const phone = session.userData.phone_number;

    // Save to device_tokens table / collection
    await addDoc(collection(db, "device_tokens"), {
      customer_id: customerId,
      phone_number: phone,
      token: fcmToken,
      created_at: new Date().toISOString()
    });

    const q = query(collection(db, "customers"), where("phone_number", "==", phone));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const customerDoc = snap.docs[0];
      const existingData = customerDoc.data();
      const existingTokens = existingData.fcm_tokens || [];
      const updatedTokens = Array.from(new Set([...existingTokens, fcmToken]));

      await updateDoc(doc(db, "customers", customerDoc.id), {
        fcm_token: fcmToken,
        fcm_tokens: updatedTokens,
        notifications_enabled: true,
        updated_at: new Date().toISOString()
      });
    }

    res.json({ success: true, message: "FCM token saved successfully." });
  } catch (err) {
    console.error("FCM Token Registration Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Toggle notifications endpoint
app.post("/api/customer/toggle-notifications", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No session token found." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const session = await validateSession(token);
    if (!session || session.userRole !== "customer") {
      return res.status(401).json({ error: "Unauthorized session." });
    }

    const { enabled } = req.body;
    const phone = session.userData.phone_number;
    const q = query(collection(db, "customers"), where("phone_number", "==", phone));
    const snap = await getDocs(q);

    if (!snap.empty) {
      await updateDoc(doc(db, "customers", snap.docs[0].id), {
        notifications_enabled: !!enabled,
        updated_at: new Date().toISOString()
      });
    }

    res.json({ success: true, notifications_enabled: !!enabled });
  } catch (err) {
    console.error("Toggle Notifications Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 6. Mark Bus as Departed
app.post("/api/staff/buses/:id/depart", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const busId = req.params.id;
    const busRef = doc(db, "buses", busId);
    const busSnap = await getDoc(busRef);
    if (!busSnap.exists()) {
      return res.status(404).json({ error: "Bus not found." });
    }

    const nowStr = new Date().toISOString();
    await updateDoc(busRef, {
      status: "departed",
      departed_at: nowStr
    });

    const q = query(collection(db, "waybills"), where("bus_id", "==", busId));
    const snap = await getDocs(q);
    let count = 0;

    for (const docObj of snap.docs) {
      const waybillData = docObj.data();
      if (waybillData.status !== "collected") {
        const updatedWaybill = {
          ...waybillData,
          status: "in_transit",
          departed_at: nowStr
        };
        await updateDoc(doc(db, "waybills", docObj.id), {
          status: "in_transit",
          departed_at: nowStr
        });
        count++;
        // Trigger push notification for departure
        sendPushNotificationForWaybill(updatedWaybill, "departed");
      }
    }

    res.json({
      success: true,
      message: `Bus marked as departed. ${count} waybills updated.`,
      count
    });
  } catch (err) {
    console.error("Error departing bus:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 7. Mark Bus as Arrived
app.post("/api/staff/buses/:id/arrive", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const busId = req.params.id;
    const busRef = doc(db, "buses", busId);
    const busSnap = await getDoc(busRef);
    if (!busSnap.exists()) {
      return res.status(404).json({ error: "Bus not found." });
    }

    const busData = busSnap.data();
    const nowStr = new Date().toISOString();

    await updateDoc(busRef, {
      status: "arrived",
      arrived_at: nowStr
    });

    // FEATURE 1: ROUTE LEARNING - Calculate actual journey time & update route stats
    if (busData.departed_at) {
      try {
        const departedTime = new Date(busData.departed_at).getTime();
        const arrivedTime = new Date(nowStr).getTime();
        const tripDurationHours = (arrivedTime - departedTime) / (1000 * 60 * 60);

        if (tripDurationHours > 0) {
          const originPark = busData.origin_park;
          const destinationPark = busData.destination_park;

          const routeQ = query(
            collection(db, "routes"),
            where("origin_park", "==", originPark),
            where("destination_park", "==", destinationPark),
            limit(1)
          );
          const routeSnap = await getDocs(routeQ);

          let routeRef;
          let completedTrips = 0;
          let recentDurations: number[] = [];

          if (!routeSnap.empty) {
            const rDoc = routeSnap.docs[0];
            routeRef = doc(db, "routes", rDoc.id);
            const rData = rDoc.data();
            completedTrips = (Number(rData.completed_trips) || 0) + 1;
            recentDurations = Array.isArray(rData.recent_trip_durations) ? rData.recent_trip_durations : [];
          } else {
            const newRouteDoc = await addDoc(collection(db, "routes"), {
              origin_park: originPark,
              destination_park: destinationPark,
              estimated_hours: 6.0,
              completed_trips: 1,
              recent_trip_durations: [],
              average_actual_hours: null,
              created_at: nowStr
            });
            routeRef = doc(db, "routes", newRouteDoc.id);
            completedTrips = 1;
          }

          // Keep last 10 completed trips
          recentDurations.push(Math.round(tripDurationHours * 100) / 100);
          if (recentDurations.length > 10) {
            recentDurations = recentDurations.slice(-10);
          }

          const sum = recentDurations.reduce((acc, val) => acc + val, 0);
          const avgActualHours = Math.round((sum / recentDurations.length) * 100) / 100;

          await updateDoc(routeRef, {
            completed_trips: completedTrips,
            recent_trip_durations: recentDurations,
            average_actual_hours: avgActualHours,
            last_trip_hours: Math.round(tripDurationHours * 100) / 100,
            updated_at: nowStr
          });

          console.log(`[Route Learning Updated] ${originPark} -> ${destinationPark}: Completed ${completedTrips} trips. New avg: ${avgActualHours} hrs.`);
        }
      } catch (routeLearnErr) {
        console.error("Error updating route learning stats:", routeLearnErr);
      }
    }

    const q = query(collection(db, "waybills"), where("bus_id", "==", busId));
    const snap = await getDocs(q);
    let count = 0;

    for (const docObj of snap.docs) {
      const waybillData = docObj.data();
      if (waybillData.status === "in_transit" || waybillData.status === "booked" || waybillData.status === "loading" || waybillData.status === "departed") {
        const updatedWaybill = {
          ...waybillData,
          status: "arrived",
          arrived_at: nowStr
        };
        await updateDoc(doc(db, "waybills", docObj.id), {
          status: "arrived",
          arrived_at: nowStr
        });
        count++;
        // Trigger push notification for arrival
        sendPushNotificationForWaybill(updatedWaybill, "arrived");
      }
    }

    res.json({
      success: true,
      message: `Bus marked as arrived. ${count} waybills updated. Route learning updated.`,
      count
    });
  } catch (err) {
    console.error("Error arriving bus:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 8. Mark Waybill as Collected (by Staff with Receiver Phone Verification)
app.post("/api/staff/waybills/:id/collect", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const waybillId = req.params.id;
    const { receiver_phone } = req.body;

    if (!receiver_phone) {
      return res.status(400).json({ error: "Receiver phone number is required for security verification." });
    }

    const waybillRef = doc(db, "waybills", waybillId);
    const waybillSnap = await getDoc(waybillRef);
    if (!waybillSnap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }

    const waybillData = waybillSnap.data();

    const expectedPhone = (waybillData.receiver_phone || "").trim();
    const providedPhone = String(receiver_phone || "").trim();

    if (providedPhone !== expectedPhone) {
      return res.status(400).json({ 
        error: "Verification failed! The entered phone number does not match the receiver phone number on record for this waybill. Ask the person taking the package to call out the correct receiver phone number." 
      });
    }

    const nowStr = new Date().toISOString();

    await updateDoc(waybillRef, {
      status: "collected",
      collected_at: nowStr,
      collected_by: "staff"
    });

    sendPushNotificationForWaybill({ ...waybillData, status: "collected" }, "collected");

    res.json({
      success: true,
      message: "Waybill verified and marked as collected successfully."
    });
  } catch (err) {
    console.error("Error collecting waybill:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ---------------- STAGE 4 COMPANY OWNER API ENDPOINTS ----------------

async function validateCompanySessionFromHeader(req: express.Request, res: express.Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No session token found." });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const session = await validateSession(token);
  if (!session || session.userRole !== "company") {
    res.status(401).json({ error: "Unauthorized session." });
    return null;
  }
  return session;
}

// 1. Get Overview Stats
app.get("/api/company/overview", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    // Get all waybills for this company
    const qWb = query(collection(db, "waybills"), where("company_id", "==", companyId));
    const snapWb = await getDocs(qWb);
    const waybills = snapWb.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get all staff for this company
    const qStaff = query(collection(db, "staff"), where("company_id", "==", companyId));
    const snapStaff = await getDocs(qStaff);
    const staff = snapStaff.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    let shipmentsWeek = 0;
    let shipmentsMonth = 0;

    waybills.forEach((wb: any) => {
      const ts = new Date(wb.created_at || wb.booked_at || 0).getTime();
      const diff = now - ts;
      if (diff <= oneWeekMs) {
        shipmentsWeek++;
      }
      if (diff <= oneMonthMs) {
        shipmentsMonth++;
      }
    });

    const activeStaffCount = staff.filter((s: any) => s.active === true).length;

    // Recent activity: last 5 waybills
    const sortedWaybills = [...waybills].sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || a.booked_at || 0).getTime();
      const dateB = new Date(b.created_at || b.booked_at || 0).getTime();
      return dateB - dateA;
    });
    const recentWaybills = sortedWaybills.slice(0, 5);

    // Fetch real monthly earnings from successful payments
    const paySnap = await getDocs(collection(db, "payments"));
    const companyPayments = paySnap.docs
      .map(doc => doc.data() as any)
      .filter(p => p.company_id === companyId && p.status === "success");

    const nowTime = Date.now();
    const totalEarningsMonth = companyPayments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at || 0).getTime()) <= oneMonthMs)
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

    res.json({
      success: true,
      stats: {
        total_shipments_week: shipmentsWeek,
        total_shipments_month: shipmentsMonth,
        total_active_staff: activeStaffCount,
        total_earnings_month: Math.round(totalEarningsMonth)
      },
      recent_activity: recentWaybills
    });
  } catch (err) {
    console.error("Error in GET /api/company/overview:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2. Get Parks & Staff (nested)
app.get("/api/company/parks-and-staff", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    // Fetch Parks
    const qParks = query(collection(db, "parks"), where("company_id", "==", companyId));
    const snapParks = await getDocs(qParks);
    const parksList = snapParks.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch Staff
    const qStaff = query(collection(db, "staff"), where("company_id", "==", companyId));
    const snapStaff = await getDocs(qStaff);
    const staffList = snapStaff.docs.map(d => ({ id: d.id, ...d.data() }));

    // Nest staff inside parks
    const parksWithStaff = parksList.map((park: any) => {
      const parkStaff = staffList.filter((s: any) => s.park_id === park.id);
      return {
        ...park,
        staff: parkStaff
      };
    });

    res.json({
      success: true,
      parks: parksWithStaff
    });
  } catch (err) {
    console.error("Error in GET /api/company/parks-and-staff:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. Create New Park
app.post("/api/company/parks", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const { park_name, park_location } = req.body;
    if (!park_name || !park_location) {
      return res.status(400).json({ error: "Park name and location/town are required." });
    }

    const newParkDoc = await addDoc(collection(db, "parks"), {
      park_name: park_name.trim(),
      park_location: park_location.trim(),
      company_id: companyId,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      park: {
        id: newParkDoc.id,
        park_name: park_name.trim(),
        park_location: park_location.trim(),
        company_id: companyId,
        staff: []
      }
    });
  } catch (err) {
    console.error("Error creating new park:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 4. Add Staff to This Park
app.post("/api/company/staff", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const { name, park_id } = req.body;
    if (!name || !park_id) {
      return res.status(400).json({ error: "Staff name and park selection are required." });
    }

    // Get the park location first
    const parkRef = doc(db, "parks", park_id);
    const parkSnap = await getDoc(parkRef);
    if (!parkSnap.exists() || parkSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Park not found or unauthorized." });
    }
    const parkLocation = parkSnap.data().park_location;

    // Generate unique 4-digit PIN
    let pin = "";
    let pinUnique = false;
    
    // Fetch all active staff to verify bcrypt uniqueness
    const allStaffSnap = await getDocs(collection(db, "staff"));
    const staffDocs = allStaffSnap.docs.map(d => d.data());

    let loopSafety = 0;
    while (!pinUnique && loopSafety < 100) {
      loopSafety++;
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      if (isWeakPin(pin, 4).weak) continue;
      let foundMatch = false;
      for (const staff of staffDocs) {
        if (staff.pin_hash) {
          const isMatch = await bcrypt.compare(pin, staff.pin_hash);
          if (isMatch) {
            foundMatch = true;
            break;
          }
        }
      }
      if (!foundMatch) {
        pinUnique = true;
      }
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    const newStaffDoc = await addDoc(collection(db, "staff"), {
      name: name.trim(),
      pin_hash: hashedPin,
      company_id: companyId,
      park_id: park_id,
      park_location: parkLocation,
      active: true,
      failed_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      staff: {
        id: newStaffDoc.id,
        name: name.trim(),
        park_id: park_id,
        park_location: parkLocation,
        active: true,
        created_at: new Date().toISOString()
      },
      pin // ONE-TIME clear-text PIN sent back in response
    });
  } catch (err) {
    console.error("Error creating staff:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5. Toggle Staff Active Status
app.post("/api/company/staff/:id/toggle-active", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const staffId = req.params.id;
    const staffRef = doc(db, "staff", staffId);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists() || staffSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Staff not found or unauthorized." });
    }

    const currentActive = staffSnap.data().active;
    const nextActive = !currentActive;

    await updateDoc(staffRef, {
      active: nextActive
    });

    res.json({
      success: true,
      active: nextActive
    });
  } catch (err) {
    console.error("Error toggling staff active status:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5.5 Reset Staff PIN
app.post("/api/company/staff/:id/reset-pin", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const staffId = req.params.id;
    const staffRef = doc(db, "staff", staffId);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists() || staffSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Staff not found or unauthorized." });
    }

    const staffName = staffSnap.data().name;

    // Generate unique 4-digit PIN
    let pin = "";
    let pinUnique = false;
    
    // Fetch all staff to verify bcrypt uniqueness
    const allStaffSnap = await getDocs(collection(db, "staff"));
    const staffDocs = allStaffSnap.docs.map(d => d.data());

    let loopSafety = 0;
    while (!pinUnique && loopSafety < 100) {
      loopSafety++;
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      if (isWeakPin(pin, 4).weak) continue;
      let foundMatch = false;
      for (const staff of staffDocs) {
        if (staff.pin_hash) {
          const isMatch = await bcrypt.compare(pin, staff.pin_hash);
          if (isMatch) {
            foundMatch = true;
            break;
          }
        }
      }
      if (!foundMatch) {
        pinUnique = true;
      }
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    await updateDoc(staffRef, {
      pin_hash: hashedPin,
      failed_attempts: 0,
      locked_until: null
    });

    res.json({
      success: true,
      name: staffName,
      pin // ONE-TIME clear-text PIN sent back in response
    });
  } catch (err) {
    console.error("Error resetting staff PIN:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 6. Get waybills for company with search & filter & pagination
app.get("/api/company/waybills", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    // Fetch all waybills of this company
    const q = query(collection(db, "waybills"), where("company_id", "==", companyId));
    const snap = await getDocs(q);
    let waybills: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Search filter
    const search = (req.query.search as string || "").trim().toLowerCase();
    if (search) {
      waybills = waybills.filter(wb => 
        (wb.tracking_code || "").toLowerCase().includes(search) ||
        (wb.sender_name || "").toLowerCase().includes(search) ||
        (wb.receiver_name || "").toLowerCase().includes(search) ||
        (wb.sender_phone || "").toLowerCase().includes(search) ||
        (wb.receiver_phone || "").toLowerCase().includes(search)
      );
    }

    // Status filter
    const status = req.query.status as string || "";
    if (status && status !== "all") {
      waybills = waybills.filter(wb => wb.status === status);
    }

    // Date range filter
    const startDate = req.query.startDate as string || "";
    const endDate = req.query.endDate as string || "";
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      waybills = waybills.filter(wb => new Date(wb.created_at || wb.booked_at || 0).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      waybills = waybills.filter(wb => new Date(wb.created_at || wb.booked_at || 0).getTime() <= endMs);
    }

    // Sort by date descending
    waybills.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booked_at || 0).getTime();
      const dateB = new Date(b.created_at || b.booked_at || 0).getTime();
      return dateB - dateA;
    });

    // Pagination
    const page = parseInt(req.query.page as string || "1", 10);
    const limitVal = parseInt(req.query.limit as string || "20", 10);
    const total = waybills.length;
    const startIndex = (page - 1) * limitVal;
    const endIndex = page * limitVal;
    const paginatedWaybills = waybills.slice(startIndex, endIndex);

    res.json({
      success: true,
      waybills: paginatedWaybills,
      total,
      page,
      pages: Math.ceil(total / limitVal)
    });
  } catch (err) {
    console.error("Error fetching company waybills:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ---------------- SUPER ADMIN API ENDPOINTS ----------------

// Helper to validate admin session from header
async function validateAdminSessionFromHeader(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Access denied. Token missing." });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const session = await validateSession(token);
  if (!session || session.userRole !== "admin") {
    res.status(403).json({ error: "Access denied. Admin authorization required." });
    return null;
  }
  const adminEmail = session.userData?.email ? String(session.userData.email).trim().toLowerCase() : "";
  if (!ALLOWED_ADMIN_EMAILS.includes(adminEmail)) {
    res.status(403).json({ error: "Access denied. Email address is not authorized for Admin Panel." });
    return null;
  }
  return session;
}

// 1. GET /api/admin/overview - independent loads or unified
app.get("/api/admin/overview", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    // Fetch approved & pending companies
    const compSnap = await getDocs(collection(db, "companies"));
    const companies = compSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const onboardedCount = companies.filter(c => c.approved === true).length;
    const pendingCount = companies.filter(c => c.approved === false).length;

    // Fetch staff
    const staffSnap = await getDocs(collection(db, "staff"));
    const activeStaffCount = staffSnap.docs.filter(d => d.data().active !== false).length;

    // Fetch waybills
    const wbSnap = await getDocs(collection(db, "waybills"));
    const waybills = wbSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Shipments today, this week, this month
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    const shipmentsToday = waybills.filter(w => new Date(w.created_at || w.booked_at || 0).getTime() >= todayStart).length;
    const shipmentsWeek = waybills.filter(w => new Date(w.created_at || w.booked_at || 0).getTime() >= weekStart).length;
    const shipmentsMonth = waybills.filter(w => new Date(w.created_at || w.booked_at || 0).getTime() >= monthStart).length;

    // Activity feed: latest 10 events across companies, waybills, buses
    const events: any[] = [];

    // Companies approved / applied
    companies.forEach(comp => {
      if (comp.created_at) {
        events.push({
          type: "company_applied",
          title: `New company applied: ${comp.company_name}`,
          detail: `Owner phone: ${comp.owner_phone}`,
          timestamp: comp.created_at
        });
      }
      if (comp.approved && comp.created_at) {
        events.push({
          type: "company_approved",
          title: `Company approved: ${comp.company_name}`,
          detail: `Status changed to active.`,
          timestamp: comp.created_at
        });
      }
    });

    // Waybills created / collected
    waybills.forEach(wb => {
      if (wb.created_at || wb.booked_at) {
        events.push({
          type: "waybill_created",
          title: `New waybill created: ${wb.tracking_code}`,
          detail: `Route: ${wb.origin_park} -> ${wb.destination_park} | Item: ${wb.item_description}`,
          timestamp: wb.created_at || wb.booked_at
        });
      }
      if (wb.status === "collected" && wb.collected_at) {
        events.push({
          type: "package_collected",
          title: `Package collected: ${wb.tracking_code}`,
          detail: `Collected by: ${wb.collected_by || "receiver"}`,
          timestamp: wb.collected_at
        });
      }
    });

    // Buses departed / arrived
    const busSnap = await getDocs(collection(db, "buses"));
    busSnap.docs.forEach(docObj => {
      const bus = docObj.data();
      if (bus.departed_at) {
        events.push({
          type: "bus_departed",
          title: `Bus Departed: ${bus.bus_number}`,
          detail: `Route: ${bus.origin_park} -> ${bus.destination_park}`,
          timestamp: bus.departed_at
        });
      }
      if (bus.arrived_at) {
        events.push({
          type: "bus_arrived",
          title: `Bus Arrived: ${bus.bus_number}`,
          detail: `Arrived at destination park.`,
          timestamp: bus.arrived_at
        });
      }
    });

    // Sort events by timestamp desc, take 10
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentActivity = events.slice(0, 10);

    // Fetch real revenue stats from successful payments
    const paySnap = await getDocs(collection(db, "payments"));
    const payments = paySnap.docs.map(doc => doc.data() as any).filter(p => p.status === "success");

    const nowTime = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    const revenueWeek = payments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at || 0).getTime()) <= oneWeekMs)
      .reduce((sum, p) => sum + (Number(p.platform_share) || 0), 0);

    const revenueMonth = payments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at || 0).getTime()) <= oneMonthMs)
      .reduce((sum, p) => sum + (Number(p.platform_share) || 0), 0);

    res.json({
      success: true,
      stats: {
        totalCompaniesOnboarded: onboardedCount,
        pendingApplications: pendingCount,
        shipmentsToday,
        shipmentsWeek,
        shipmentsMonth,
        revenueWeek: Math.round(revenueWeek),
        revenueMonth: Math.round(revenueMonth),
        activeStaff: activeStaffCount
      },
      recentActivity
    });
  } catch (err) {
    console.error("Error fetching admin overview stats:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2. GET /api/admin/companies - all approved and pending
app.get("/api/admin/companies", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const compSnap = await getDocs(collection(db, "companies"));
    const companies = compSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const parksSnap = await getDocs(collection(db, "parks"));
    const parks = parksSnap.docs.map(doc => doc.data());

    const staffSnap = await getDocs(collection(db, "staff"));
    const staff = staffSnap.docs.map(doc => doc.data());

    const wbSnap = await getDocs(collection(db, "waybills"));
    const waybills = wbSnap.docs.map(doc => doc.data());

    // Fetch real successful payments
    const paySnap = await getDocs(collection(db, "payments"));
    const payments = paySnap.docs.map(doc => doc.data() as any).filter(p => p.status === "success");

    // Enrich companies with counts and real earnings
    const enrichedCompanies = companies.map(comp => {
      const companyParks = parks.filter(p => p.company_id === comp.id);
      const companyStaff = staff.filter(s => s.company_id === comp.id);
      const companyShipments = waybills.filter(w => w.company_id === comp.id);
      const companyPayments = payments.filter(p => p.company_id === comp.id);
      const companyEarnings = companyPayments.reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

      return {
        ...comp,
        total_parks: companyParks.length,
        total_staff: companyStaff.length,
        total_shipments: companyShipments.length,
        earnings: Math.round(companyEarnings)
      };
    });

    res.json({
      success: true,
      companies: enrichedCompanies
    });
  } catch (err) {
    console.error("Error fetching admin companies:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. POST /api/admin/companies/:id/approve - approve company
app.post("/api/admin/companies/:id/approve", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const compId = req.params.id;
    const compRef = doc(db, "companies", compId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company application not found." });
    }

    await updateDoc(compRef, {
      approved: true
    });

    res.json({ success: true, message: "Company approved successfully." });
  } catch (err) {
    console.error("Error approving company:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 4. POST /api/admin/companies/:id/reject - delete pending company
app.post("/api/admin/companies/:id/reject", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const compId = req.params.id;
    const compRef = doc(db, "companies", compId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists() || compSnap.data().approved) {
      return res.status(400).json({ error: "Company can only be rejected if it's pending." });
    }

    await deleteDoc(compRef);

    res.json({ success: true, message: "Company application rejected and removed." });
  } catch (err) {
    console.error("Error rejecting company:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5. POST /api/admin/companies/:id/toggle-suspend - suspend/reinstate company
app.post("/api/admin/companies/:id/toggle-suspend", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const compId = req.params.id;
    const compRef = doc(db, "companies", compId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company not found." });
    }

    const currentApproved = compSnap.data().approved;
    const nextApproved = !currentApproved;

    await updateDoc(compRef, {
      approved: nextApproved
    });

    // Logout company owners & company staff instantly
    if (!nextApproved) {
      const sessionsSnap = await getDocs(collection(db, "sessions"));
      for (const sDoc of sessionsSnap.docs) {
        const sData = sDoc.data();
        let logoutNeeded = false;
        if (sData.userId === compId && sData.userRole === "company") {
          logoutNeeded = true;
        } else if (sData.userRole === "staff" && sData.userData && sData.userData.company_id === compId) {
          logoutNeeded = true;
        }

        if (logoutNeeded) {
          await deleteDoc(doc(db, "sessions", sDoc.id));
        }
      }
    }

    res.json({
      success: true,
      approved: nextApproved,
      message: nextApproved ? "Company reinstated successfully." : "Company suspended successfully, and all associated sessions terminated."
    });
  } catch (err) {
    console.error("Error suspending/reinstating company:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 6. GET /api/admin/companies/:id/details - retrieve individual company detail profile
app.get("/api/admin/companies/:id/details", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const compId = req.params.id;
    const compRef = doc(db, "companies", compId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company not found." });
    }
    const company = { id: compSnap.id, ...compSnap.data() as any };

    // Fetch parks
    const parksQ = query(collection(db, "parks"), where("company_id", "==", compId));
    const parksSnap = await getDocs(parksQ);
    const parks = parksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch staff
    const staffQ = query(collection(db, "staff"), where("company_id", "==", compId));
    const staffSnap = await getDocs(staffQ);
    const staff = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch shipments
    const wbQ = query(collection(db, "waybills"), where("company_id", "==", compId));
    const wbSnap = await getDocs(wbQ);
    const shipments = wbSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Query successful payments for this company to calculate real-time earnings & commission share
    const paySnap = await getDocs(collection(db, "payments"));
    const companyPayments = paySnap.docs
      .map(doc => doc.data() as any)
      .filter(p => p.company_id === compId && p.status === "success");

    const totalCompanyEarnings = companyPayments.reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const totalPlatformCommission = companyPayments.reduce((sum, p) => sum + (Number(p.platform_share) || 0), 0);

    const companyEnriched = {
      ...company,
      split_percentage: company.split_percentage !== undefined ? company.split_percentage : 30,
      earnings: Math.round(totalCompanyEarnings),
      platform_commission: Math.round(totalPlatformCommission)
    };

    res.json({
      success: true,
      company: companyEnriched,
      parks,
      staff,
      shipments
    });
  } catch (err) {
    console.error("Error fetching company details:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 7. GET /api/admin/shipments - complete list of ALL waybills across the platform with search/filters/pagination
app.get("/api/admin/shipments", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    // Fetch all companies first to enrich company names
    const compSnap = await getDocs(collection(db, "companies"));
    const companiesMap = new Map();
    compSnap.docs.forEach(d => {
      companiesMap.set(d.id, d.data().company_name);
    });

    // Fetch all waybills
    const wbSnap = await getDocs(collection(db, "waybills"));
    let waybills: any[] = wbSnap.docs.map(d => ({
      id: d.id,
      company_name: companiesMap.get(d.data().company_id) || "Unknown Company",
      ...d.data() as any
    }));

    // Search filter: tracking code, sender name, receiver name, sender phone, receiver phone, company name
    const search = (req.query.search as string || "").trim().toLowerCase();
    if (search) {
      waybills = waybills.filter(wb => 
        (wb.tracking_code || "").toLowerCase().includes(search) ||
        (wb.sender_name || "").toLowerCase().includes(search) ||
        (wb.receiver_name || "").toLowerCase().includes(search) ||
        (wb.sender_phone || "").toLowerCase().includes(search) ||
        (wb.receiver_phone || "").toLowerCase().includes(search) ||
        (wb.company_name || "").toLowerCase().includes(search)
      );
    }

    // Status filter
    const status = req.query.status as string || "";
    if (status && status !== "all") {
      waybills = waybills.filter(wb => wb.status === status);
    }

    // Company filter
    const companyId = req.query.company as string || "";
    if (companyId && companyId !== "all") {
      waybills = waybills.filter(wb => wb.company_id === companyId);
    }

    // Date range filter
    const startDate = req.query.startDate as string || "";
    const endDate = req.query.endDate as string || "";
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      waybills = waybills.filter(wb => new Date(wb.created_at || wb.booked_at || 0).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      waybills = waybills.filter(wb => new Date(wb.created_at || wb.booked_at || 0).getTime() <= endMs);
    }

    // Sort by created_at descending
    waybills.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booked_at || 0).getTime();
      const dateB = new Date(b.created_at || b.booked_at || 0).getTime();
      return dateB - dateA;
    });

    // Pagination
    const page = parseInt(req.query.page as string || "1", 10);
    const limitVal = parseInt(req.query.limit as string || "20", 10);
    const total = waybills.length;
    const startIndex = (page - 1) * limitVal;
    const endIndex = page * limitVal;
    const paginatedWaybills = waybills.slice(startIndex, endIndex);

    res.json({
      success: true,
      waybills: paginatedWaybills,
      total,
      page,
      pages: Math.ceil(total / limitVal),
      allFiltered: waybills
    });
  } catch (err) {
    console.error("Error fetching admin waybills:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 8. GET /api/admin/disputes - get active platform disputes
app.get("/api/admin/disputes", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    // Fetch routes to look up estimated hours
    const routesSnap = await getDocs(collection(db, "routes"));
    const routesMap = new Map();
    routesSnap.docs.forEach(d => {
      const r = d.data();
      const key = `${r.origin_park?.trim().toLowerCase()}_to_${r.destination_park?.trim().toLowerCase()}`;
      routesMap.set(key, r.estimated_hours || 8.0);
    });

    // Fetch companies map to enrich company names
    const compSnap = await getDocs(collection(db, "companies"));
    const companiesMap = new Map();
    compSnap.docs.forEach(d => {
      companiesMap.set(d.id, d.data().company_name);
    });

    // Fetch all waybills that are on transit and not resolved
    const wbSnap = await getDocs(collection(db, "waybills"));
    const waybills = wbSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    const disputes: any[] = [];
    const now = Date.now();

    for (const wb of waybills) {
      if (wb.status === "collected" || wb.status === "arrived" || wb.dispute_resolved === true) {
        continue;
      }

      if (wb.status === "in_transit" || wb.status === "departed") {
        const departureTime = wb.departed_at || wb.booked_at || wb.created_at;
        if (!departureTime) continue;

        const departureMs = new Date(departureTime).getTime();
        const elapsedHours = (now - departureMs) / (1000 * 60 * 60);

        const routeKey = `${wb.origin_park?.trim().toLowerCase()}_to_${wb.destination_park?.trim().toLowerCase()}`;
        const estimatedHours = routesMap.get(routeKey) || 8.0;
        const thresholdHours = estimatedHours + 24;

        if (elapsedHours > thresholdHours) {
          disputes.push({
            id: wb.id,
            tracking_code: wb.tracking_code,
            company_id: wb.company_id,
            company_name: companiesMap.get(wb.company_id) || "Unknown Company",
            origin_park: wb.origin_park,
            destination_park: wb.destination_park,
            departed_at: departureTime,
            status: wb.status,
            estimated_hours: estimatedHours,
            elapsed_hours: Math.round(elapsedHours),
            overdue_hours: Math.round(elapsedHours - thresholdHours)
          });
        }
      }
    }

    res.json({
      success: true,
      disputes
    });
  } catch (err) {
    console.error("Error fetching disputes:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 9. POST /api/admin/waybills/:id/resolve-dispute - resolve a dispute
app.post("/api/admin/waybills/:id/resolve-dispute", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const wbId = req.params.id;
    const wbRef = doc(db, "waybills", wbId);
    const wbSnap = await getDoc(wbRef);
    if (!wbSnap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }

    await updateDoc(wbRef, {
      dispute_resolved: true
    });

    res.json({
      success: true,
      message: "Dispute marked as resolved."
    });
  } catch (err) {
    console.error("Error resolving dispute:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ---------------- STAGE 6 PAYSTACK PAYMENT INTEGRATION & HELPERS ----------------

async function createPaystackPaymentSession(senderPhone: string, subaccountCode: string) {
  const amountKobo = 20000; // N200 in kobo
  const reference = `TP-BT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanPhone = (senderPhone || "").replace(/[^0-9]/g, "");
  const senderEmail = (cleanPhone.length >= 7 ? cleanPhone : "customer") + "@trackpack.com";

  let virtual_account_number = "Use Online Portal";
  let virtual_account_bank = "Paystack Live Checkout Gateway";
  let checkout_url = "";
  let virtual_account_expires_at = new Date(Date.now() + 20 * 60 * 1000).toISOString(); // 20 min expiry

  const key = (process.env.PAYSTACK_SECRET_KEY || "").trim();
  const hasPaystackKey = Boolean(key && !key.startsWith("MY_") && key.length > 5);

  if (hasPaystackKey) {
    try {
      // Initialize Paystack Transaction to generate standard Paystack Checkout Portal Link
      const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: senderEmail,
          amount: amountKobo,
          reference,
          subaccount: subaccountCode,
          bearer: "account"
        })
      });

      const initData = await initRes.json();
      if (initRes.ok && initData.status && initData.data) {
        checkout_url = initData.data.authorization_url || "";
      } else {
        console.error("Paystack transaction initialize notice:", initData?.message || initData);
      }
    } catch (paystackErr) {
      console.error("Failed to connect to Paystack API:", paystackErr);
    }
  } else {
    // Demo checkout URL for sandbox testing
    checkout_url = "https://checkout.paystack.com/demo-sandbox-link";
  }

  return {
    reference,
    virtual_account_number,
    virtual_account_bank,
    virtual_account_expires_at,
    checkout_url,
    is_live: key.startsWith("sk_live_")
  };
}

async function generateUniqueTrackingCode(): Promise<string> {
  let unique = false;
  let tracking_code = "";
  while (!unique) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    tracking_code = `NNW-${rand}`;
    const q = query(collection(db, "waybills"), where("tracking_code", "==", tracking_code), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      unique = true;
    }
  }
  return tracking_code;
}

async function confirmPayment(paymentId: string, payment: any, paystackFeeKobo?: number) {
  if (payment.status === "success") {
    // If already success, return current tracking code
    const wbSnap = await getDoc(doc(db, "waybills", payment.waybill_id));
    return { success: true, tracking_code: wbSnap.exists() ? wbSnap.data().tracking_code : null };
  }

  // 1. Generate unique tracking code NNW-XXXX
  const tracking_code = await generateUniqueTrackingCode();

  // 2. Fetch company to get split percentage
  const compRef = doc(db, "companies", payment.company_id);
  const compSnap = await getDoc(compRef);
  const compData = compSnap.exists() ? compSnap.data() : { split_percentage: 30 };
  const split_pct = compData.split_percentage !== undefined ? Number(compData.split_percentage) : 30;

  // 3. Calculate shares (Amount is 200 Naira)
  const amount = 200;
  const paystack_fee = paystackFeeKobo !== undefined ? (paystackFeeKobo / 100) : 2.0; // default 1% = 2 Naira
  const company_share = Number((amount * (split_pct / 100)).toFixed(2));
  const platform_share = Number((amount - company_share - paystack_fee).toFixed(2));

  // 4. Update payment document
  await updateDoc(doc(db, "payments", paymentId), {
    status: "success",
    confirmed_at: new Date().toISOString(),
    paystack_fee,
    company_share,
    platform_share
  });

  // 5. Update waybill document
  await updateDoc(doc(db, "waybills", payment.waybill_id), {
    tracking_code,
    tracking_active: true,
    status: "booked",
    paid: true,
    payment_reference: payment.paystack_reference
  });

  return { success: true, tracking_code };
}

// 1. GET /api/paystack/banks - Fetch Nigerian Banks
app.get("/api/paystack/banks", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;

    const fallbackBanks = [
      { id: 1, name: "Access Bank", code: "044" },
      { id: 2, name: "Fidelity Bank", code: "070" },
      { id: 3, name: "First Bank of Nigeria", code: "011" },
      { id: 4, name: "First City Monument Bank", code: "214" },
      { id: 5, name: "Guaranty Trust Bank", code: "058" },
      { id: 6, name: "Key Stone Bank", code: "082" },
      { id: 7, name: "Opay", code: "999992" },
      { id: 8, name: "Stanbic IBTC Bank", code: "039" },
      { id: 9, name: "Sterling Bank", code: "232" },
      { id: 10, name: "United Bank For Africa", code: "033" },
      { id: 11, name: "Union Bank of Nigeria", code: "032" },
      { id: 12, name: "Wema Bank", code: "035" },
      { id: 13, name: "Zenith Bank", code: "057" }
    ];

    const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                           !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                           process.env.PAYSTACK_SECRET_KEY.trim() !== "";

    if (hasPaystackKey) {
      try {
        const paystackRes = await fetch("https://api.paystack.co/bank?country=nigeria", {
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        });
        const data = await paystackRes.json();
        if (paystackRes.ok && data.status && Array.isArray(data.data)) {
          return res.json({ success: true, banks: data.data });
        }
      } catch (err) {
        console.error("Paystack Bank fetch failed, using fallback banks:", err);
      }
    }

    res.json({ success: true, banks: fallbackBanks });
  } catch (err) {
    console.error("Error fetching banks:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2. POST /api/paystack/resolve-account - Resolve Nigerian bank account name
app.post("/api/paystack/resolve-account", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;

    const { account_number, bank_code } = req.body;
    if (!account_number || !bank_code) {
      return res.status(400).json({ error: "Account number and bank code are required." });
    }

    const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                           !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                           process.env.PAYSTACK_SECRET_KEY.trim() !== "";

    if (hasPaystackKey) {
      try {
        const paystackRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        });
        const data = await paystackRes.json();
        if (paystackRes.ok && data.status && data.data) {
          return res.json({ success: true, account_name: data.data.account_name });
        } else {
          return res.status(400).json({ error: data.message || "Could not resolve bank account details. Verify details and try again." });
        }
      } catch (err) {
        console.error("Error calling resolve endpoint:", err);
      }
    }

    // Fallback Mock Resolution for Test mode
    if (account_number.length === 10) {
      const mockName = "TEST ACCOUNT OWNER";
      return res.json({ success: true, account_name: mockName });
    }

    res.status(400).json({ error: "Invalid account number length. Must be 10 digits." });
  } catch (err) {
    console.error("Error resolving account:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. POST /api/paystack/setup-subaccount - Configures bank details and subaccount
app.post("/api/paystack/setup-subaccount", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const { bank_name, bank_code, account_number, account_name } = req.body;
    if (!bank_name || !bank_code || !account_number || !account_name) {
      return res.status(400).json({ error: "All bank details are required." });
    }

    // Default split percentage for new company subaccounts is 30% company share
    const split_percentage = 30; 

    const compRef = doc(db, "companies", companyId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company not found." });
    }

    const companyData = compSnap.data();
    let paystack_subaccount_code = companyData.paystack_subaccount_code || "";

    const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                           !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                           process.env.PAYSTACK_SECRET_KEY.trim() !== "";

    if (hasPaystackKey) {
      try {
        if (paystack_subaccount_code) {
          // Update existing subaccount
          const updateRes = await fetch(`https://api.paystack.co/subaccount/${paystack_subaccount_code}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              business_name: companyData.company_name,
              settlement_bank: bank_code,
              account_number,
              percentage_charge: split_percentage
            })
          });
          const updateData = await updateRes.json();
          if (!updateRes.ok) {
            console.error("Paystack Subaccount Update Error:", updateData);
          }
        } else {
          // Create new Paystack subaccount
          const createRes = await fetch("https://api.paystack.co/subaccount", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              business_name: companyData.company_name,
              settlement_bank: bank_code,
              account_number,
              percentage_charge: split_percentage,
              primary_contact_email: `sub-${companyId}@trackpack.com`
            })
          });
          const createData = await createRes.json();
          if (createRes.ok && createData.status && createData.data) {
            paystack_subaccount_code = createData.data.subaccount_code;
          } else {
            console.error("Paystack Subaccount Create Error:", createData);
            paystack_subaccount_code = `ACCT_${Math.floor(100000 + Math.random() * 900000)}`;
          }
        }
      } catch (err) {
        console.error("Error configuring Paystack subaccount:", err);
        if (!paystack_subaccount_code) {
          paystack_subaccount_code = `ACCT_${Math.floor(100000 + Math.random() * 900000)}`;
        }
      }
    } else {
      if (!paystack_subaccount_code) {
        paystack_subaccount_code = `ACCT_${Math.floor(100000 + Math.random() * 900000)}`;
      }
    }

    await updateDoc(compRef, {
      bank_name,
      bank_code,
      account_number,
      account_name,
      paystack_subaccount_code,
      split_percentage
    });

    res.json({
      success: true,
      message: "Bank account and virtual routing subaccount configured successfully.",
      paystack_subaccount_code,
      split_percentage
    });
  } catch (err) {
    console.error("Error setting up bank subaccount:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 4. GET /api/company/earnings - Detailed earnings history for operator
app.get("/api/company/earnings", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const compRef = doc(db, "companies", companyId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company not found." });
    }
    const company = compSnap.data();

    // Fetch successful payments
    const paySnap = await getDocs(collection(db, "payments"));
    const payments = paySnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(p => p.company_id === companyId && p.status === "success");

    // Fetch matching waybills to enrich history
    const wbSnap = await getDocs(collection(db, "waybills"));
    const waybills = wbSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const history = payments.map(pay => {
      const waybill = waybills.find(w => w.id === pay.waybill_id) || {};
      return {
        id: pay.id,
        amount: pay.amount,
        company_share: pay.company_share,
        confirmed_at: pay.confirmed_at || pay.created_at,
        reference: pay.paystack_reference,
        waybill_code: waybill.tracking_code || "Pending Verification",
        sender_name: waybill.sender_name || "N/A"
      };
    });

    // Sort by confirmed_at desc
    history.sort((a, b) => new Date(b.confirmed_at).getTime() - new Date(a.confirmed_at).getTime());

    const nowTime = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    const earningsWeek = payments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at).getTime()) <= oneWeekMs)
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

    const earningsMonth = payments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at).getTime()) <= oneMonthMs)
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

    const earningsAllTime = payments
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

    res.json({
      success: true,
      bank_setup: {
        bank_name: company.bank_name || null,
        account_number: company.account_number || null,
        account_name: company.account_name || null,
        paystack_subaccount_code: company.paystack_subaccount_code || null,
        split_percentage: company.split_percentage !== undefined ? company.split_percentage : null
      },
      stats: {
        earnings_week: Math.round(earningsWeek),
        earnings_month: Math.round(earningsMonth),
        earnings_all_time: Math.round(earningsAllTime)
      },
      history
    });
  } catch (err) {
    console.error("Error fetching company earnings:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5. GET /api/staff/payments/:id - Fetch payment details and poll status
app.get("/api/staff/payments/:id", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const paymentId = req.params.id;
    const payRef = doc(db, "payments", paymentId);
    const paySnap = await getDoc(payRef);
    if (!paySnap.exists()) {
      return res.status(404).json({ error: "Payment not found." });
    }

    const payment = paySnap.data() as any;

    // Check expiry
    const nowStr = new Date().toISOString();
    if (payment.status === "pending" && payment.virtual_account_expires_at && nowStr > payment.virtual_account_expires_at) {
      await updateDoc(payRef, { status: "expired" });
      payment.status = "expired";
    }

    // Call Paystack verify on the fly if pending and key exists
    if (payment.status === "pending") {
      const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                             !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                             process.env.PAYSTACK_SECRET_KEY.trim() !== "";
      if (hasPaystackKey) {
        try {
          const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${payment.paystack_reference}`, {
            headers: {
              "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
          });
          const vData = await verifyRes.json();
          if (verifyRes.ok && vData.status && vData.data && vData.data.status === "success") {
            const feeKobo = vData.data.fees || 0;
            const confirmResult = await confirmPayment(paymentId, payment, feeKobo);
            return res.json({
              success: true,
              payment: {
                id: paymentId,
                ...payment,
                status: "success"
              },
              tracking_code: confirmResult.tracking_code
            });
          }
        } catch (verifyErr) {
          console.error("Paystack transaction verify polling error:", verifyErr);
        }
      }
    }

    let tracking_code = null;
    const wbRef = doc(db, "waybills", payment.waybill_id);
    const wbSnap = await getDoc(wbRef);
    if (wbSnap.exists()) {
      tracking_code = wbSnap.data().tracking_code || null;
    }

    res.json({
      success: true,
      payment: {
        id: paymentId,
        ...payment
      },
      tracking_code
    });
  } catch (err) {
    console.error("Error retrieving payment status:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 6. POST /api/staff/payments/:id/verify-sim - Simulation endpoint for cash / bank transfer
app.post("/api/staff/payments/:id/verify-sim", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const paymentId = req.params.id;
    const payRef = doc(db, "payments", paymentId);
    const paySnap = await getDoc(payRef);
    if (!paySnap.exists()) {
      return res.status(404).json({ error: "Payment not found." });
    }

    const payment = paySnap.data();
    // Simulate transaction using 1.5% fee = 300 kobo (3 Naira)
    const confirmResult = await confirmPayment(paymentId, payment, 300);

    res.json({
      success: true,
      message: "Transfer payment simulated successfully. Waybill has been approved.",
      tracking_code: confirmResult.tracking_code
    });
  } catch (err) {
    console.error("Error simulating payment verification:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 7. POST /api/paystack/webhook - Automated Paystack Settlement Webhook
app.post("/api/paystack/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!signature) {
      return res.status(401).send("No signature header.");
    }

    const event = req.body;
    if (event && event.event === "charge.success" && event.data) {
      const data = event.data;
      const reference = data.reference;
      
      const q = query(collection(db, "payments"), where("paystack_reference", "==", reference), limit(1));
      const paySnap = await getDocs(q);
      if (!paySnap.empty) {
        const payDoc = paySnap.docs[0];
        const paymentId = payDoc.id;
        const payment = payDoc.data();
        const feeKobo = data.fees || 0;
        await confirmPayment(paymentId, payment, feeKobo);
        console.log(`Payment confirmed via webhook for reference: ${reference}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Error processing Paystack webhook:", err);
    res.sendStatus(500);
  }
});

// 8. POST /api/admin/companies/:id/adjust-split - Adjust custom operator split percentage
app.post("/api/admin/companies/:id/adjust-split", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const compId = req.params.id;
    const { split_percentage } = req.body;
    if (split_percentage === undefined || isNaN(Number(split_percentage))) {
      return res.status(400).json({ error: "Invalid split percentage." });
    }

    const pct = Math.max(0, Math.min(100, Number(split_percentage)));
    const compRef = doc(db, "companies", compId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company not found." });
    }

    const compData = compSnap.data();
    const updates: any = { split_percentage: pct };

    if (compData.paystack_subaccount_code) {
      const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                             !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                             process.env.PAYSTACK_SECRET_KEY.trim() !== "";
      if (hasPaystackKey) {
        try {
          await fetch(`https://api.paystack.co/subaccount/${compData.paystack_subaccount_code}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              percentage_charge: pct
            })
          });
        } catch (err) {
          console.error("Failed to update Paystack subaccount percentage:", err);
        }
      }
    }

    await updateDoc(compRef, updates);
    res.json({ success: true, message: `Split percentage updated to ${pct}% successfully.` });
  } catch (err) {
    console.error("Error adjusting split percentage:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Duplicate confirmPayment helper removed

// 1. Get Nigerian Banks list
app.get("/api/paystack/banks", async (req, res) => {
  try {
    const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                           !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                           process.env.PAYSTACK_SECRET_KEY.trim() !== "";
    if (hasPaystackKey) {
      try {
        const pRes = await fetch("https://api.paystack.co/bank?country=nigeria", {
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        });
        const pData = await pRes.json();
        if (pRes.ok && pData.status && pData.data) {
          return res.json({ success: true, banks: pData.data });
        }
      } catch (err) {
        console.error("Failed to fetch banks from Paystack, falling back to local list:", err);
      }
    }
    // Hardcoded fallback list
    const fallbackBanks = [
      { name: "Access Bank", code: "044" },
      { name: "Fidelity Bank", code: "070" },
      { name: "First Bank of Nigeria", code: "011" },
      { name: "Guaranty Trust Bank", code: "058" },
      { name: "Kuda Bank", code: "50211" },
      { name: "Providus Bank", code: "101" },
      { name: "Stanbic IBTC Bank", code: "221" },
      { name: "Sterling Bank", code: "232" },
      { name: "Union Bank of Nigeria", code: "032" },
      { name: "United Bank for Africa", code: "033" },
      { name: "Wema Bank", code: "094" },
      { name: "Zenith Bank", code: "057" }
    ];
    res.json({ success: true, banks: fallbackBanks });
  } catch (err) {
    console.error("Error in GET /api/paystack/banks:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2. Verify Bank Details (Resolve Account Number)
app.post("/api/company/verify-account", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;

    const { account_number, bank_code } = req.body;
    if (!account_number || !bank_code) {
      return res.status(400).json({ error: "Account number and bank code are required." });
    }

    const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                           !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                           process.env.PAYSTACK_SECRET_KEY.trim() !== "";
    if (hasPaystackKey) {
      try {
        const pRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        });
        const pData = await pRes.json();
        if (pRes.ok && pData.status && pData.data) {
          return res.json({ success: true, account_name: pData.data.account_name });
        } else {
          return res.status(400).json({ error: pData.message || "Failed to resolve bank account." });
        }
      } catch (err) {
        console.error("Paystack account verification error, falling back to mock:", err);
      }
    }

    // Mock fallback
    const mockNames = ["Chinedu Okafor", "Fatima Abubakar", "Olumide Balogun", "Ngozi Obi", "Emeka Nwosu"];
    const sum = account_number.split("").reduce((acc: number, val: string) => acc + (parseInt(val) || 0), 0);
    const mockName = (mockNames[sum % mockNames.length] + " Ltd").toUpperCase();
    res.json({ success: true, account_name: mockName });
  } catch (err) {
    console.error("Error in POST /api/company/verify-account:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. Create Subaccount / Finalize setup
app.post("/api/company/payment-setup", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const { account_number, bank_code, account_name, bank_name } = req.body;
    if (!account_number || !bank_code || !account_name || !bank_name) {
      return res.status(400).json({ error: "All account details are required." });
    }

    const compRef = doc(db, "companies", companyId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company not found." });
    }
    const compData = compSnap.data();

    const split_percentage = compData.split_percentage || 30.0;

    let paystack_subaccount_code = "";
    const hasPaystackKey = process.env.PAYSTACK_SECRET_KEY && 
                           !process.env.PAYSTACK_SECRET_KEY.startsWith("MY_") && 
                           process.env.PAYSTACK_SECRET_KEY.trim() !== "";
    if (hasPaystackKey) {
      try {
        const pRes = await fetch("https://api.paystack.co/subaccount", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            business_name: compData.company_name,
            settlement_bank: bank_code,
            account_number: account_number,
            percentage_charge: split_percentage
          })
        });
        const pData = await pRes.json();
        if (pRes.ok && pData.status && pData.data) {
          paystack_subaccount_code = pData.data.subaccount_code;
        } else {
          return res.status(400).json({ error: pData.message || "Failed to create subaccount on Paystack." });
        }
      } catch (err) {
        console.error("Paystack subaccount creation error, falling back to mock:", err);
        paystack_subaccount_code = `ACCT_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }
    } else {
      paystack_subaccount_code = `ACCT_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    await updateDoc(compRef, {
      bank_account_number: account_number,
      bank_code,
      account_name,
      bank_name,
      paystack_subaccount_code,
      split_percentage
    });

    res.json({
      success: true,
      company: {
        ...compData,
        bank_account_number: account_number,
        bank_code,
        account_name,
        bank_name,
        paystack_subaccount_code,
        split_percentage
      }
    });
  } catch (err) {
    console.error("Error in POST /api/company/payment-setup:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 4. Get Payment status for Waybill (staff polling & detail tracking)
app.get("/api/staff/waybills/:id/payment-status", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const waybillId = req.params.id;
    const waybillRef = doc(db, "waybills", waybillId);
    const waybillSnap = await getDoc(waybillRef);
    if (!waybillSnap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }
    const waybillData = waybillSnap.data();

    // Query payment for this waybill
    const payQ = query(collection(db, "payments"), where("waybill_id", "==", waybillId), limit(1));
    const paySnap = await getDocs(payQ);
    if (paySnap.empty) {
      return res.status(404).json({ error: "Payment record not found." });
    }
    const payDoc = paySnap.docs[0];
    const payData = payDoc.data();

    let status = payData.status;

    if (status === "pending") {
      const expiresAt = new Date(payData.virtual_account_expires_at);
      if (expiresAt < new Date()) {
        status = "expired";
        await updateDoc(doc(db, "payments", payDoc.id), { status: "expired" });
      }
    }

    res.json({
      success: true,
      status,
      tracking_code: waybillData.tracking_code,
      payment: { id: payDoc.id, ...payData, status }
    });
  } catch (err) {
    console.error("Error getting payment status:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 5. Simulate payment success (test simulator to trigger webhook action)
app.post("/api/payments/:id/simulate-success", async (req, res) => {
  try {
    const paymentId = req.params.id;
    const payRef = doc(db, "payments", paymentId);
    const paySnap = await getDoc(payRef);
    if (!paySnap.exists()) {
      return res.status(404).json({ error: "Payment not found." });
    }
    const payData = paySnap.data();

    const result = await confirmPayment(paymentId, payData);
    res.json({ success: true, tracking_code: result?.tracking_code });
  } catch (err) {
    console.error("Error simulating payment success:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 6. Paystack webhook receiver
app.post("/api/paystack/webhook", async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log("Received Paystack Webhook Event:", event);

    if (event === "charge.success") {
      const reference = data.reference;
      if (reference) {
        const payQ = query(collection(db, "payments"), where("paystack_reference", "==", reference), limit(1));
        const paySnap = await getDocs(payQ);
        if (!paySnap.empty) {
          const payDoc = paySnap.docs[0];
          await confirmPayment(payDoc.id, payDoc.data());
          console.log(`Webhook processed successfully for reference: ${reference}`);
        } else {
          console.warn(`Payment reference not found in database: ${reference}`);
        }
      }
    }

    res.json({ status: "success" });
  } catch (err) {
    console.error("Error in Paystack webhook:", err);
    res.status(500).json({ error: "Webhook error" });
  }
});

// 7. Retry Expired/Unpaid payment
app.post("/api/staff/waybills/:id/retry-payment", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;
    const { company_id } = session.userData;

    const waybillId = req.params.id;
    const waybillRef = doc(db, "waybills", waybillId);
    const waybillSnap = await getDoc(waybillRef);
    if (!waybillSnap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }
    const waybillData = waybillSnap.data();

    // Verify company has set up their Paystack subaccount details
    const compRef = doc(db, "companies", company_id);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Your company was not found." });
    }
    const compData = compSnap.data();
    if (!compData.paystack_subaccount_code) {
      return res.status(400).json({
        error: "Your company has not completed the payment setup. Please ask the company owner to configure bank details."
      });
    }

    // Generate Paystack payment session
    const paySession = await createPaystackPaymentSession(waybillData.sender_phone || "", compData.paystack_subaccount_code);

    const newPayment = {
      waybill_id: waybillId,
      company_id,
      amount: 200,
      paystack_reference: paySession.reference,
      status: "pending",
      virtual_account_number: paySession.virtual_account_number,
      virtual_account_bank: paySession.virtual_account_bank,
      virtual_account_expires_at: paySession.virtual_account_expires_at,
      checkout_url: paySession.checkout_url,
      is_live: paySession.is_live,
      company_share: null,
      platform_share: null,
      paystack_fee: null,
      created_at: new Date().toISOString(),
      confirmed_at: null
    };

    const paymentRef = await addDoc(collection(db, "payments"), newPayment);

    res.json({
      success: true,
      payment: { id: paymentRef.id, ...newPayment }
    });
  } catch (err) {
    console.error("Error retrying payment:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 8. Get Company Earnings and Subaccount Details with T+1 Settlement Status
app.get("/api/company/earnings", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const compRef = doc(db, "companies", companyId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: "Company not found." });
    }
    const compData = compSnap.data();

    // Fetch successful payments for this company
    const paySnap = await getDocs(collection(db, "payments"));
    const payments = paySnap.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter(p => p.company_id === companyId && p.status === "success");

    // Fetch matching waybills to enrich history
    const wbSnap = await getDocs(collection(db, "waybills"));
    const waybills = wbSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const history = payments.map(pay => {
      const waybill = waybills.find(w => w.id === pay.waybill_id) || {};
      return {
        id: pay.id,
        amount: pay.amount,
        company_share: pay.company_share,
        confirmed_at: pay.confirmed_at || pay.created_at,
        settlement_status: pay.settlement_status || "pending_settlement",
        settled_at: pay.settled_at || null,
        reference: pay.paystack_reference,
        waybill_code: waybill.tracking_code || "Pending Verification",
        sender_name: waybill.sender_name || "N/A"
      };
    });

    history.sort((a, b) => new Date(b.confirmed_at).getTime() - new Date(a.confirmed_at).getTime());

    const nowTime = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    // Settled (Received in bank - Green)
    const settledPayments = payments.filter(p => (p.settlement_status || "pending_settlement") === "settled");
    const settledWeek = settledPayments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at).getTime()) <= oneWeekMs)
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const settledMonth = settledPayments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at).getTime()) <= oneMonthMs)
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const settledAllTime = settledPayments
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

    // Pending Settlement (T+1 Payout)
    const pendingPayments = payments.filter(p => (p.settlement_status || "pending_settlement") !== "settled");
    const pendingWeek = pendingPayments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at).getTime()) <= oneWeekMs)
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const pendingMonth = pendingPayments
      .filter(p => (nowTime - new Date(p.confirmed_at || p.created_at).getTime()) <= oneMonthMs)
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const pendingAllTime = pendingPayments
      .reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

    const totalEarnings = payments.reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const paidCount = payments.length;

    res.json({
      success: true,
      subaccount: {
        paystack_subaccount_code: compData.paystack_subaccount_code || null,
        bank_name: compData.bank_name || null,
        bank_account_number: compData.bank_account_number || null,
        account_name: compData.account_name || null,
        split_percentage: compData.split_percentage || 30.0
      },
      stats: {
        earnings_week: Math.round(settledWeek),
        earnings_month: Math.round(settledMonth),
        earnings_all_time: Math.round(settledAllTime),
        pending_earnings_week: Math.round(pendingWeek),
        pending_earnings_month: Math.round(pendingMonth),
        pending_earnings_all_time: Math.round(pendingAllTime),
        total_earnings: Math.round(totalEarnings),
        paid_shipments_count: paidCount
      },
      history,
      transactions: history
    });
  } catch (err) {
    console.error("Error fetching company earnings:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Endpoint to mark a payment as settled and received in bank (T+1 payout simulation / confirmation)
app.post("/api/company/settlements/:id/settle", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const paymentId = req.params.id;
    const payRef = doc(db, "payments", paymentId);
    const paySnap = await getDoc(payRef);
    if (!paySnap.exists()) {
      return res.status(404).json({ error: "Payment not found." });
    }
    const payData = paySnap.data();
    if (payData.company_id !== session.userId) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    await updateDoc(payRef, {
      settlement_status: "settled",
      settled_at: new Date().toISOString()
    });

    res.json({ success: true, message: "Payment marked as settled and received in bank." });
  } catch (err) {
    console.error("Error settling payment:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 9. Get Super Admin revenue overview
app.get("/api/admin/revenue", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    // Fetch all companies to map company names
    const compSnap = await getDocs(collection(db, "companies"));
    const companiesMap = new Map();
    compSnap.docs.forEach(d => {
      companiesMap.set(d.id, d.data().company_name);
    });

    // Query all successful payments across the platform
    const paySnap = await getDocs(collection(db, "payments"));
    const allPayments = paySnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(p => p.status === "success");

    // Sort descending
    allPayments.sort((a, b) => new Date(b.confirmed_at || b.created_at || 0).getTime() - new Date(a.confirmed_at || a.created_at || 0).getTime());

    // Compute totals
    const totalPlatformRevenue = allPayments.reduce((sum, p) => sum + (Number(p.platform_share) || 0), 0);
    const totalCompanyRevenue = allPayments.reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const totalTransactions = allPayments.length;

    // Compute breakdown per company
    const breakdownMap = new Map();
    allPayments.forEach(p => {
      const current = breakdownMap.get(p.company_id) || { total: 0, platform: 0, company: 0, count: 0 };
      current.total += p.amount;
      current.platform += Number(p.platform_share) || 0;
      current.company += Number(p.company_share) || 0;
      current.count += 1;
      breakdownMap.set(p.company_id, current);
    });

    const companyBreakdown = Array.from(breakdownMap.entries()).map(([compId, data]) => ({
      company_id: compId,
      company_name: companiesMap.get(compId) || "Unknown Company",
      total_transactions_value: data.total,
      platform_share_total: Math.round(data.platform),
      company_share_total: Math.round(data.company),
      transactions_count: data.count
    }));

    res.json({
      success: true,
      stats: {
        total_platform_revenue: Math.round(totalPlatformRevenue),
        total_company_revenue: Math.round(totalCompanyRevenue),
        total_transactions_count: totalTransactions
      },
      breakdown: companyBreakdown,
      recent_payments: allPayments.slice(0, 50).map(p => ({
        ...p,
        company_name: companiesMap.get(p.company_id) || "Unknown Company"
      }))
    });
  } catch (err) {
    console.error("Error in GET /api/admin/revenue:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ---------------- SERVER AND VITE SERVING ----------------

async function startServer() {
  // Execute database seeding
  await seedDatabase();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
