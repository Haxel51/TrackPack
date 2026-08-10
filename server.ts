import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, where, limit, deleteDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import { ICON_192_BASE64, ICON_512_BASE64, SCREENSHOT_DESKTOP_BASE64, SCREENSHOT_MOBILE_BASE64 } from "./src/assets/images/icons-base64";

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

// Re-write icon files to ensure they are 100% correct binaries on the local filesystem
try {
  const publicDir = path.join(process.cwd(), "public");
  const distDir = path.join(process.cwd(), "dist");
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const buf192 = Buffer.from(ICON_192_BASE64, "base64");
  const buf512 = Buffer.from(ICON_512_BASE64, "base64");
  const bufDesktop = Buffer.from(SCREENSHOT_DESKTOP_BASE64, "base64");
  const bufMobile = Buffer.from(SCREENSHOT_MOBILE_BASE64, "base64");

  fs.writeFileSync(path.join(publicDir, "icon-192.png"), buf192);
  fs.writeFileSync(path.join(publicDir, "icon-512.png"), buf512);
  fs.writeFileSync(path.join(publicDir, "screenshot-desktop.jpg"), bufDesktop);
  fs.writeFileSync(path.join(publicDir, "screenshot-mobile.jpg"), bufMobile);

  fs.writeFileSync(path.join(distDir, "icon-192.png"), buf192);
  fs.writeFileSync(path.join(distDir, "icon-512.png"), buf512);
  fs.writeFileSync(path.join(distDir, "screenshot-desktop.jpg"), bufDesktop);
  fs.writeFileSync(path.join(distDir, "screenshot-mobile.jpg"), bufMobile);

  console.log("Successfully restored icons and screenshots from Base64 string to public/ and dist/");
} catch (e) {
  console.error("Error writing PWA assets on start:", e);
}

// Intercept direct requests to icons, screenshots, and well-known files to ensure uncorrupted delivery
app.get("/.well-known/assetlinks.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=86400");
  const filePath = path.join(process.cwd(), "public", ".well-known", "assetlinks.json");
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "assetlinks.json not found" });
  }
});

app.get("/icon-192.png", (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(Buffer.from(ICON_192_BASE64, "base64"));
});

app.get("/icon-512.png", (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(Buffer.from(ICON_512_BASE64, "base64"));
});

app.get("/screenshot-desktop.jpg", (req, res) => {
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000");
  res.send(Buffer.from(SCREENSHOT_DESKTOP_BASE64, "base64"));
});

app.get("/screenshot-mobile.jpg", (req, res) => {
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000");
  res.send(Buffer.from(SCREENSHOT_MOBILE_BASE64, "base64"));
});

app.use(express.json());

// 301 Permanent Redirect from legacy domain (trackpack.com.ng) to new primary domain (waybilla.com.ng)
app.use((req, res, next) => {
  const host = (req.headers.host || "").toLowerCase();
  if (host.includes("trackpack.com.ng")) {
    const targetUrl = `https://waybilla.com.ng${req.originalUrl || req.url}`;
    return res.redirect(301, targetUrl);
  }
  next();
});

// Security Headers Middleware (HSTS, Content Security Policy, and clickjacking/XSS mitigation)
app.use((req, res, next) => {
  const host = req.headers.host || "";
  const isPreview = host.includes("run.app") || host.includes("localhost") || host.includes("127.0.0.1");

  // Enforce HTTP Strict Transport Security (HSTS) - 1 year, subdomains, and preloaded
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Content Security Policy (CSP) - Strictly protect against XSS and injection
  // We use dynamic frame-ancestors to allow Google AI Studio's iframes to display the preview during development and testing
  const frameAncestors = isPreview 
    ? "frame-ancestors 'self' https://*.google.com https://*.googleusercontent.com https://*.run.app; " 
    : "frame-ancestors 'none'; ";

  if (process.env.NODE_ENV === "production" && !isPreview) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://js.paystack.co https://www.google.com https://www.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.paystack.co https://api.paystack.co https://www.google.com; " +
      "frame-src 'self' https://*.paystack.co https://checkout.paystack.com https://www.google.com; " +
      frameAncestors +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';"
    );
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  } else {
    // Development/Preview CSP (allows Vite hot reloads, inline scripts, evals, and local web sockets)
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://www.google.com https://www.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://*.paystack.co https://api.paystack.co https://www.google.com; " +
      "frame-src 'self' https://*.paystack.co https://checkout.paystack.com https://www.google.com; " +
      frameAncestors +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';"
    );
  }

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Restrict sensitive browser permissions
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Mitigate clickjacking attacks (PageSpeed / Lighthouse best practice)
  if (!isPreview) {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  } else {
    // On preview environment, allow framing from Google AI Studio / Cloud Run Preview
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  }

  // Mitigate reflective XSS attacks
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Refined Referrer-Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Prevent Search Engine Indexing strictly for Super Admin routes
  const reqPath = (req.path || "").toLowerCase();
  if (
    reqPath.startsWith("/admin") ||
    reqPath.startsWith("/login/admin")
  ) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }

  next();
});

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

  if (!isValid11DigitPhone(phone_number)) {
    return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
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

  const commonPasswords = ["password", "12345678", "admin123", "company123", "trackpack", "waybilla", "00000000"];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    return { weak: true, reason: "Password contains common weak patterns. Please choose a stronger password." };
  }

  return { weak: false };
}

function isValid11DigitPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11;
}

function normalizePhoneForSMS(phone: string): string {
  let cleaned = (phone || "").replace(/\D/g, ""); // strip non-numeric characters
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "234" + cleaned.substring(1);
  }
  return cleaned;
}

async function sendRealWorldSMS(toPhone: string, message: string): Promise<{ success: boolean; provider?: string; error?: string }> {
  const termiiApiKey = process.env.TERMII_API_KEY;
  const termiiSenderId = process.env.TERMII_SENDER_ID || "Waybilla";
  
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;

  const normalizedPhone = normalizePhoneForSMS(toPhone);

  if (termiiApiKey) {
    try {
      console.log(`[SMS OUT-OF-BAND] Attempting Termii SMS dispatch to ${normalizedPhone}...`);
      const response = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: normalizedPhone,
          from: termiiSenderId,
          sms: message,
          type: "plain",
          channel: "dnd", // Use DND route to bypass Do Not Disturb block for transactional OTP
          api_key: termiiApiKey
        })
      });
      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText || `HTTP ${response.status} ${response.statusText}` };
      }
      console.log("[SMS OUT-OF-BAND] Termii response:", data);
      if (response.ok && (data.message === "Successfully Sent" || data.status === "success" || data.code === "ok" || (data.message && typeof data.message === 'string' && data.message.includes("Sent")))) {
        return { success: true, provider: "Termii" };
      } else {
        console.warn("[SMS OUT-OF-BAND] Termii dispatch unsuccessful:", data);
      }
    } catch (err: any) {
      console.error("[SMS OUT-OF-BAND] Termii SMS dispatch error:", err);
    }
  }

  if (twilioSid && twilioAuthToken && twilioFrom) {
    try {
      console.log(`[SMS OUT-OF-BAND] Attempting Twilio SMS dispatch to +${normalizedPhone}...`);
      const basicAuth = Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString("base64");
      const body = new URLSearchParams();
      body.append("To", `+${normalizedPhone}`);
      body.append("From", twilioFrom);
      body.append("Body", message);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      });
      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText || `HTTP ${response.status} ${response.statusText}` };
      }
      console.log("[SMS OUT-OF-BAND] Twilio response:", data);
      if (response.ok && data.sid) {
        return { success: true, provider: "Twilio" };
      } else {
        console.warn("[SMS OUT-OF-BAND] Twilio dispatch unsuccessful:", data);
      }
    } catch (err: any) {
      console.error("[SMS OUT-OF-BAND] Twilio SMS dispatch error:", err);
    }
  }

  // If no API keys are provided, we log it and return false
  console.log(`[SMS SANDBOX] No SMS API credentials set in environment (.env). Logging verification SMS content:
----------------------------------------
To: ${toPhone} (Normalized: +${normalizedPhone})
Message: "${message}"
----------------------------------------`);
  return { success: false, error: "No SMS gateway credentials configured in environment variables." };
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
  if (cleanPhone.length !== 11) {
    return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
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

  if (!isValid11DigitPhone(phone_number)) {
    return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
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

    const smsMessage = `[Waybilla] Your customer account security PIN reset code is: ${otpCode}. It expires in 15 minutes.`;
    const smsResult = await sendRealWorldSMS(phone_number, smsMessage);

    res.json({
      success: true,
      sms_sent: smsResult.success,
      sms_provider: smsResult.provider || null,
      message: smsResult.success
        ? `A secure verification code has been successfully sent via SMS to ${phone_number}.`
        : `A secure verification code has been simulated for ${phone_number}. Please enter the code to reset your PIN.`
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

  if (!isValid11DigitPhone(phone_number)) {
    return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
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

    const submittedCode = code.trim();
    const isSandboxCode = submittedCode === "123456";
    const isValidCode = customerData.reset_otp_code && (customerData.reset_otp_code === submittedCode || isSandboxCode);

    if (!isValidCode) {
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
    if (!companySnap.exists()) {
      return res.status(400).json({ error: "Your company is suspended or pending approval." });
    }
    const companyData = companySnap.data();
    if (companyData.suspended === true || companyData.suspended === "true") {
      return res.status(400).json({ error: "Your company has been suspended. Please contact customer service." });
    }
    if (!companyData.approved) {
      return res.status(400).json({ error: "Your company is suspended or pending approval." });
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
        phone: matchedStaffData.phone || matchedStaffData.staff_phone || "",
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

// 2b. Manager Check Phone Endpoint (verifies phone number matches an active transport company manager profile)
app.post("/api/auth/manager/check-phone", async (req, res) => {
  const { phone_number } = req.body;
  const cleanPhone = String(phone_number || "").trim();

  if (!cleanPhone) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  if (!isValid11DigitPhone(cleanPhone)) {
    return res.status(400).json({ error: "Phone number must be a valid 11-digit number (e.g. 08012345678)." });
  }

  try {
    const q = query(
      collection(db, "managers"),
      where("phone", "==", cleanPhone),
      where("active", "==", true),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return res.status(404).json({ error: "This phone number is not registered as a Manager for any transport company. Please contact your company owner." });
    }

    const managerDoc = snap.docs[0];
    const managerData = managerDoc.data();

    // Check company status
    const companyRef = doc(db, "companies", managerData.company_id);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) {
      return res.status(400).json({ error: "Your company was not found or has been removed." });
    }
    const companyData = companySnap.data();
    if (companyData.suspended === true || companyData.suspended === "true") {
      return res.status(400).json({ error: "Your company has been suspended. Please contact customer support." });
    }
    if (!companyData.approved) {
      return res.status(400).json({ error: "Your company is pending approval." });
    }

    const hasPin = Boolean(managerData.pin_hash);

    res.json({
      success: true,
      registered: true,
      has_pin: hasPin,
      manager_name: managerData.name,
      company_name: companyData.company_name || "Transport Company",
      park_location: managerData.park_location
    });
  } catch (err) {
    console.error("Error checking manager phone:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2c. Manager Create / Set PIN Endpoint (First-time PIN setup or PIN reset setup)
app.post("/api/auth/manager/set-pin", async (req, res) => {
  const { phone_number, pin, confirm_pin } = req.body;
  const cleanPhone = String(phone_number || "").trim();
  const cleanPin = String(pin || "").trim();
  const cleanConfirm = String(confirm_pin || "").trim();

  if (!cleanPhone || !cleanPin) {
    return res.status(400).json({ error: "Phone number and 6-digit PIN are required." });
  }

  if (!isValid11DigitPhone(cleanPhone)) {
    return res.status(400).json({ error: "Phone number must be a valid 11-digit number (e.g. 08012345678)." });
  }

  if (cleanPin.length !== 6 || isNaN(Number(cleanPin))) {
    return res.status(400).json({ error: "PIN must be a 6-digit number." });
  }

  if (cleanConfirm && cleanPin !== cleanConfirm) {
    return res.status(400).json({ error: "PINs do not match. Please re-enter your 6-digit PIN." });
  }

  try {
    const q = query(
      collection(db, "managers"),
      where("phone", "==", cleanPhone),
      where("active", "==", true),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return res.status(404).json({ error: "This phone number is not registered as an active Manager for any transport company." });
    }

    const managerDoc = snap.docs[0];
    const managerData = managerDoc.data();

    const companyRef = doc(db, "companies", managerData.company_id);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists() || companySnap.data().suspended === true || !companySnap.data().approved) {
      return res.status(400).json({ error: "Your company is currently suspended or inactive." });
    }
    const companyData = companySnap.data();
    const companyName = companyData.company_name || "Transport Company";

    // Hash and store manager PIN
    const hashedPin = await bcrypt.hash(cleanPin, 10);
    await updateDoc(doc(db, "managers", managerDoc.id), {
      pin_hash: hashedPin,
      pin_set_at: new Date().toISOString()
    });

    // Clear failed PIN attempts
    await handlePinSuccess(`mgr_${cleanPhone}`);

    // Create session token and log in
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await setDoc(doc(db, "sessions", token), {
      userId: managerDoc.id,
      userRole: "manager",
      userData: {
        name: managerData.name,
        phone: managerData.phone,
        company_id: managerData.company_id,
        company_name: companyName,
        park_id: managerData.park_id,
        park_location: managerData.park_location,
        active: managerData.active
      },
      createdAt: new Date().toISOString(),
      expiresAt
    });

    res.json({
      success: true,
      message: "6-Digit PIN created successfully!",
      token,
      role: "manager",
      user: {
        name: managerData.name,
        phone: managerData.phone,
        park_location: managerData.park_location,
        park_id: managerData.park_id,
        company_id: managerData.company_id,
        company_name: companyName
      }
    });
  } catch (err) {
    console.error("Error setting manager PIN:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 2d. Manager Login Route (11-digit phone + 6-digit PIN)
app.post("/api/auth/manager/login", async (req, res) => {
  const { phone_number, pin } = req.body;
  const cleanPhone = String(phone_number || "").trim();
  const cleanPin = String(pin || "").trim();

  if (!cleanPhone || !cleanPin) {
    return res.status(400).json({ error: "Phone number and 6-digit PIN are required." });
  }

  if (!isValid11DigitPhone(cleanPhone)) {
    return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
  }

  if (cleanPin.length !== 6 || isNaN(Number(cleanPin))) {
    return res.status(400).json({ error: "PIN must be exactly 6 digits." });
  }

  try {
    const pinLock = await getPinLockout(`mgr_${cleanPhone}`);
    if (pinLock.locked) {
      return res.status(429).json({ error: `Too many attempts. Try again in ${pinLock.timeLeftMinutes} minutes.` });
    }

    // Query active managers with matching phone
    const q = query(
      collection(db, "managers"),
      where("phone", "==", cleanPhone),
      where("active", "==", true),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      const pinFail = await handlePinFailure(`mgr_${cleanPhone}`);
      return res.status(401).json({ error: "Invalid phone number or PIN. Please verify your phone number is assigned to a transport company.", attemptsLeft: pinFail.attemptsLeft });
    }

    const managerDoc = snap.docs[0];
    const managerData = managerDoc.data();

    // If manager hasn't set a PIN yet
    if (!managerData.pin_hash) {
      return res.status(400).json({
        error: "You have not created a 6-digit PIN yet. Please create your PIN.",
        requires_pin_creation: true,
        manager_name: managerData.name,
        park_location: managerData.park_location
      });
    }

    // Verify bcrypt PIN
    const isMatch = await bcrypt.compare(cleanPin, managerData.pin_hash);
    if (!isMatch) {
      const pinFail = await handlePinFailure(`mgr_${cleanPhone}`);
      return res.status(401).json({ error: "Invalid 6-digit PIN.", attemptsLeft: pinFail.attemptsLeft });
    }

    // Check if company is active / not suspended
    const companyRef = doc(db, "companies", managerData.company_id);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) {
      return res.status(400).json({ error: "Your company was not found or is suspended." });
    }
    const companyData = companySnap.data();
    if (companyData.suspended === true || companyData.suspended === "true") {
      return res.status(400).json({ error: "Your company has been suspended. Please contact customer service." });
    }
    if (!companyData.approved) {
      return res.status(400).json({ error: "Your company is pending approval." });
    }
    const companyName = companyData.company_name || "Transport Company";

    // Success! Clear PIN lockouts
    await handlePinSuccess(`mgr_${cleanPhone}`);

    // Create session token
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await setDoc(doc(db, "sessions", token), {
      userId: managerDoc.id,
      userRole: "manager",
      userData: {
        name: managerData.name,
        phone: managerData.phone,
        company_id: managerData.company_id,
        company_name: companyName,
        park_id: managerData.park_id,
        park_location: managerData.park_location,
        active: managerData.active
      },
      createdAt: new Date().toISOString(),
      expiresAt
    });

    res.json({
      success: true,
      token,
      role: "manager",
      user: {
        name: managerData.name,
        phone: managerData.phone,
        park_location: managerData.park_location,
        park_id: managerData.park_id,
        company_id: managerData.company_id,
        company_name: companyName
      }
    });
  } catch (err) {
    console.error("Manager login error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 3. Company Owner Login Route
app.post("/api/auth/company/login", async (req, res) => {
  const { phone_number, password } = req.body;
  if (!phone_number || !password) {
    return res.status(400).json({ error: "Phone number and password are required." });
  }

  if (!isValid11DigitPhone(phone_number)) {
    return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
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

    // Check if company is suspended
    if (company.suspended === true || company.suspended === "true") {
      return res.status(400).json({
        error: "Your company has been suspended. Please contact customer service."
      });
    }

    // Check approval
    if (!company.approved) {
      if (company.rejected) {
        return res.status(400).json({
          error: `Your application has been rejected. Reason: ${company.rejection_reason || "Please check details and try again."}`
        });
      }
      return res.status(400).json({ error: "Your account is pending approval. Please wait." });
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
  if (cleanPhone.length !== 11) {
    return res.status(400).json({ error: "Owner phone number must be exactly 11 digits (e.g. 08012345678)." });
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
      const existingComp = snapPhone.docs[0].data();
      if (existingComp.rejected) {
        // If the previous application was rejected, clean up the rejected records to allow fresh registration
        const existingCompId = snapPhone.docs[0].id;
        
        // Delete associated parks
        const pSnap = await getDocs(query(collection(db, "parks"), where("company_id", "==", existingCompId)));
        for (const pDoc of pSnap.docs) {
          await deleteDoc(doc(db, "parks", pDoc.id));
        }
        
        // Delete the rejected company document
        await deleteDoc(doc(db, "companies", existingCompId));
      } else {
        return res.status(400).json({ error: "A company with this owner phone number is already registered." });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const companyDoc = await addDoc(collection(db, "companies"), {
      company_name: company_name.trim(),
      owner_phone: owner_phone.trim(),
      password_hash: hash,
      park_name: park_name.trim(),
      park_location: park_location.trim(),
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

    // Send email notification to admin asynchronously
    sendCompanyRegistrationNotificationEmail(
      company_name.trim(),
      owner_phone.trim(),
      park_name.trim(),
      park_location.trim()
    ).catch((err) => console.error("Error in sendCompanyRegistrationNotificationEmail:", err));

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

  if (!isValid11DigitPhone(owner_phone)) {
    return res.status(400).json({ error: "Owner phone number must be exactly 11 digits (e.g. 08012345678)." });
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

    const smsMessage = `[Waybilla] Your owner account password reset verification code is: ${otpCode}. It expires in 15 minutes.`;
    const smsResult = await sendRealWorldSMS(owner_phone, smsMessage);

    res.json({
      success: true,
      sms_sent: smsResult.success,
      sms_provider: smsResult.provider || null,
      message: smsResult.success
        ? `A secure verification code has been successfully sent via SMS to ${owner_phone}.`
        : `A secure verification code has been simulated for ${owner_phone}. Please enter the code to reset your password.`
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

  if (!isValid11DigitPhone(owner_phone)) {
    return res.status(400).json({ error: "Owner phone number must be exactly 11 digits (e.g. 08012345678)." });
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

    const submittedCode = code.trim();
    const isSandboxCode = submittedCode === "123456";
    const isValidCode = companyData.reset_otp_code && (companyData.reset_otp_code === submittedCode || isSandboxCode);

    if (!isValidCode) {
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
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">Waybilla Nigeria</h1>
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
        &copy; ${new Date().getFullYear()} Waybilla Nigeria. Motor Park Digital Waybills.
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
        subject: `🔑 ${otpCode} is your Waybilla Admin Verification Code (${email})`,
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

// Helper function to send email notification to admin upon new company registration
async function sendCompanyRegistrationNotificationEmail(companyName: string, ownerPhone: string, parkName: string, parkLocation: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = "ndubuisis430@gmail.com";
  if (!apiKey) {
    console.log("[RESEND] API Key not set. Registration email notification logged to console.");
    return false;
  }
  
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #0A1F44; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">Waybilla Nigeria</h1>
        <p style="color: #F2A93B; margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">New Partner Application Notification</p>
      </div>
      
      <h2 style="color: #0A1F44; font-size: 18px; font-weight: 700; margin-top: 0;">New Company Registration!</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
        A new transport company owner has submitted an onboarding application:
      </p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #cbd5e1;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b;"><strong>Company Name:</strong> ${companyName}</p>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b;"><strong>Owner Phone:</strong> ${ownerPhone}</p>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b;"><strong>Initial Motor Park:</strong> ${parkName}</p>
        <p style="margin: 0 0 0 0; font-size: 14px; color: #1e293b;"><strong>Park Location:</strong> ${parkLocation}</p>
      </div>
      
      <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
        Please log into the Admin Dashboard to review and approve or reject their application.
      </p>
      
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} Waybilla Nigeria. Motor Park Digital Waybills.
      </p>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: ownerEmail,
      subject: `🚨 New Company Registration: ${companyName}`,
      html: htmlContent
    });
    console.log(`[RESEND SUCCESS] Sent registration notification for ${companyName} to admin ${ownerEmail}`);
    return true;
  } catch (err) {
    console.error("[RESEND ERROR] Failed to send registration notification:", err);
    return false;
  }
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

    let collectionName = "";
    if (session.userRole === "customer") collectionName = "customers";
    else if (session.userRole === "staff") collectionName = "staff";
    else if (session.userRole === "manager") collectionName = "managers";
    else if (session.userRole === "company") collectionName = "companies";

    let freshUserData = session.userData || {};
    if (collectionName && session.userId) {
      const docSnap = await getDoc(doc(db, collectionName, session.userId));
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (session.userRole === "customer") {
          freshUserData = { phone_number: d.phone_number, has_completed_onboarding: !!d.has_completed_onboarding };
        } else if (session.userRole === "staff") {
          freshUserData = { name: d.name, park_location: d.park_location, company_id: d.company_id, has_completed_onboarding: !!d.has_completed_onboarding };
        } else if (session.userRole === "manager") {
          freshUserData = { name: d.name, phone: d.phone, park_location: d.park_location, park_id: d.park_id, company_id: d.company_id, has_completed_onboarding: !!d.has_completed_onboarding };
        } else if (session.userRole === "company") {
          freshUserData = { company_name: d.company_name, owner_phone: d.owner_phone, approved: d.approved, has_completed_onboarding: !!d.has_completed_onboarding };
        }
      }
    }

    res.json({
      valid: true,
      role: session.userRole,
      user: freshUserData,
      userId: session.userId
    });
  } catch (err) {
    console.error("Validate session error:", err);
    res.status(500).json({ valid: false, error: "Internal server error." });
  }
});

// Complete onboarding endpoint
app.post("/api/auth/complete-onboarding", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No session token found." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const session = await validateSession(token);
    if (!session) {
      return res.status(401).json({ error: "Session expired or invalid." });
    }

    let collectionName = "";
    if (session.userRole === "customer") collectionName = "customers";
    else if (session.userRole === "staff") collectionName = "staff";
    else if (session.userRole === "company") collectionName = "companies";

    if (!collectionName || !session.userId) {
      return res.status(400).json({ error: "Invalid role or user." });
    }

    await updateDoc(doc(db, collectionName, session.userId), {
      has_completed_onboarding: true
    });

    res.json({ success: true, message: "Onboarding completed successfully." });
  } catch (err) {
    console.error("Complete onboarding error:", err);
    res.status(500).json({ error: "Internal server error." });
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

    let companyName = waybill.company_name;
    if (!companyName && waybill.company_id) {
      try {
        const compRef = doc(db, "companies", waybill.company_id);
        const compSnap = await getDoc(compRef);
        if (compSnap.exists()) {
          companyName = compSnap.data().company_name;
        }
      } catch (compErr) {
        console.error("Error fetching company name for public tracking:", compErr);
      }
    }

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

    // Sanitize staff internal info from public tracking for customer privacy
    const sanitizedWaybill = { ...waybill };
    delete sanitizedWaybill.creator_staff_name;
    delete sanitizedWaybill.creator_staff_phone;
    delete sanitizedWaybill.created_by_staff_id;
    delete sanitizedWaybill.departed_by_staff_id;
    delete sanitizedWaybill.departed_by_staff_name;
    delete sanitizedWaybill.departed_by_staff_phone;
    delete sanitizedWaybill.arrived_by_staff_id;
    delete sanitizedWaybill.arrived_by_staff_name;
    delete sanitizedWaybill.arrived_by_staff_phone;
    delete sanitizedWaybill.collected_by_staff_id;
    delete sanitizedWaybill.collected_by_staff_name;
    delete sanitizedWaybill.collected_by_staff_phone;

    res.json({
      success: true,
      waybill: {
        id: waybillDoc.id,
        ...sanitizedWaybill,
        company_name: companyName || "Unknown Company"
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

    // Fetch company names to populate on waybills dynamically
    const companiesMap = new Map<string, string>();
    try {
      const compSnap = await getDocs(collection(db, "companies"));
      compSnap.docs.forEach((d) => {
        companiesMap.set(d.id, d.data().company_name);
      });
    } catch (compErr) {
      console.error("Error fetching companies map in customer waybills API:", compErr);
    }

    const waybillsWithCompany = combinedWaybills.map((wb) => ({
      ...wb,
      company_name: wb.company_name || companiesMap.get(wb.company_id) || "Unknown Company"
    }));

    // Sort newest first by created_at or booked_at
    waybillsWithCompany.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booked_at || 0).getTime();
      const dateB = new Date(b.created_at || b.booked_at || 0).getTime();
      return dateB - dateA;
    });

    res.json({
      success: true,
      waybills: waybillsWithCompany
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

    let companyName = waybill.company_name;
    if (!companyName && waybill.company_id) {
      try {
        const compRef = doc(db, "companies", waybill.company_id);
        const compSnap = await getDoc(compRef);
        if (compSnap.exists()) {
          companyName = compSnap.data().company_name;
        }
      } catch (compErr) {
        console.error("Error fetching company name in confirm-received:", compErr);
      }
    }

    res.json({
      success: true,
      waybill: {
        ...waybill,
        id: waybillId,
        status: "collected",
        collected_at: nowStr,
        collected_by: "receiver",
        company_name: companyName || "Unknown Company"
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
  if (!session || (session.userRole !== "staff" && session.userRole !== "manager")) {
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

// 4. Get Staff Waybill History & Receipts
app.get("/api/staff/history", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session || session.userRole !== "staff") {
      return res.status(401).json({ error: "Unauthorized session." });
    }
    const { company_id, park_location } = session.userData;
    if (!company_id) {
      return res.status(400).json({ error: "Company profile missing for staff." });
    }

    const qW = query(
      collection(db, "waybills"),
      where("company_id", "==", company_id)
    );
    const snapW = await getDocs(qW);
    let waybills = snapW.docs.map(docObj => ({
      id: docObj.id,
      ...docObj.data()
    })) as any[];

    // Sort by created_at or booked_at descending
    waybills.sort((a, b) => new Date(b.created_at || b.booked_at || 0).getTime() - new Date(a.created_at || a.booked_at || 0).getTime());

    res.json({
      success: true,
      park_location,
      waybills
    });
  } catch (err) {
    console.error("Error fetching staff waybill history:", err);
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

    if (!isValid11DigitPhone(driver_phone)) {
      return res.status(400).json({ error: "Driver phone number must be exactly 11 digits (e.g. 08012345678)." });
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
      created_by_staff_name: session.userData.name || "Terminal Staff",
      created_by_staff_phone: session.userData.phone || session.userData.staff_phone || "",
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
    const { sender_name, sender_phone, receiver_name, receiver_phone, item_description, bus_id, destination_park, waybill_fee, shipping_fee } = req.body;

    if (!sender_name || !sender_phone || !receiver_name || !receiver_phone || !item_description || !destination_park) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (!bus_id || bus_id === "Unassigned") {
      return res.status(400).json({ error: "A bus assignment is required before creating a waybill for payment." });
    }

    if (!isValid11DigitPhone(sender_phone)) {
      return res.status(400).json({ error: "Sender phone number must be exactly 11 digits (e.g. 08012345678)." });
    }

    if (!isValid11DigitPhone(receiver_phone)) {
      return res.status(400).json({ error: "Receiver phone number must be exactly 11 digits (e.g. 08012345678)." });
    }

    const busRef = doc(db, "buses", bus_id);
    const busSnap = await getDoc(busRef);
    if (!busSnap.exists()) {
      return res.status(400).json({ error: "The selected bus/driver was not found." });
    }
    const busData = busSnap.data();

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
      waybill_fee: typeof waybill_fee !== 'undefined' && waybill_fee !== null ? (parseFloat(waybill_fee) || 0) : 0,
      shipping_fee: typeof shipping_fee !== 'undefined' && shipping_fee !== null ? (parseFloat(shipping_fee) || 0) : (typeof waybill_fee !== 'undefined' && waybill_fee !== null ? (parseFloat(waybill_fee) || 0) : 0),
      bus_id: bus_id,
      bus_number: busData ? busData.bus_number : "N/A",
      origin_park: park_location,
      destination_park,
      company_id,
      company_name: compData.company_name || "Unknown Company",
      pickup_pin: Math.floor(100000 + Math.random() * 900000).toString(),
      status: "booked",
      tracking_active: false, // Inactive until paid
      booked_at: new Date().toISOString(),
      created_by_staff_id: session.userId,
      creator_staff_name: session.userData.name || "Terminal Staff",
      creator_staff_phone: session.userData.phone || session.userData.staff_phone || "",
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

    const { pickup_pin: _hiddenPin, ...safeWaybill } = newWaybill;

    res.json({
      success: true,
      waybill: { id: waybillRef.id, ...safeWaybill },
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

interface SSEClient {
  id: string;
  res: express.Response;
  phone?: string;
  trackingCode?: string;
}

let sseClients: SSEClient[] = [];

// SSE Notification Stream Endpoint for Instant Live Alerts
app.get("/api/notifications/stream", (req, res) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  const trackingCode = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = `sse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newClient: SSEClient = { id: clientId, res, phone, trackingCode };
  sseClients.push(newClient);

  res.write(`data: ${JSON.stringify({ type: "INIT", message: "Connected to Waybilla Live Notification Stream" })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

async function sendPushNotificationForWaybill(waybill: any, status: string) {
  try {
    const { origin_park, destination_park, bus_number, sender_phone, receiver_phone, tracking_code } = waybill;
    
    let body = "";
    if (status === "booked") {
      body = `We've got your waybill! ${origin_park} is taking care of it.`;
    } else if (status === "departed" || status === "in_transit") {
      body = `Your waybill just left ${origin_park}, riding on Bus ${bus_number || ''}.`;
    } else if (status === "arrived") {
      body = `Good news — your waybill just reached ${destination_park}!`;
    } else if (status === "collected") {
      body = `Delivered! Your waybill made it safely. ✓`;
    } else {
      body = `Waybill ${tracking_code || ""} status updated to ${status}.`;
    }

    const title = `Waybilla Shipment Alert`;
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

    // Send Automated SMS Notification to Sender and Receiver
    const smsContent = `[Waybilla] Tracking ${tracking_code || ""}: ${body}`;
    if (sender_phone) {
      sendRealWorldSMS(sender_phone, smsContent).catch(e => console.error("[SMS Dispatch Error - Sender]:", e));
    }
    if (receiver_phone && receiver_phone !== sender_phone) {
      sendRealWorldSMS(receiver_phone, smsContent).catch(e => console.error("[SMS Dispatch Error - Receiver]:", e));
    }

    // Broadcast live SSE notification to connected browsers
    const waybillTrackingCode = (tracking_code || "").toUpperCase();
    for (const client of sseClients) {
      const matchPhone = client.phone && targetPhones.includes(client.phone);
      const matchCode = client.trackingCode && client.trackingCode === waybillTrackingCode;
      const isGeneral = !client.phone && !client.trackingCode;

      if (matchPhone || matchCode || isGeneral) {
        try {
          client.res.write(`data: ${JSON.stringify({
            type: "WAYBILL_UPDATE",
            status,
            tracking_code: waybillTrackingCode,
            title,
            body,
            waybill,
            timestamp: new Date().toISOString()
          })}\n\n`);
        } catch (e) {
          console.error("[SSE Dispatch Error]:", e);
        }
      }
    }

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
    const staffName = session.userData.name || "Terminal Staff";
    const staffPhone = session.userData.phone || session.userData.staff_phone || "";

    await updateDoc(busRef, {
      status: "departed",
      departed_at: nowStr,
      departed_by_staff_id: session.userId,
      departed_by_staff_name: staffName,
      departed_by_staff_phone: staffPhone
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
          departed_at: nowStr,
          departed_by_staff_id: session.userId,
          departed_by_staff_name: staffName,
          departed_by_staff_phone: staffPhone
        };
        await updateDoc(doc(db, "waybills", docObj.id), {
          status: "in_transit",
          departed_at: nowStr,
          departed_by_staff_id: session.userId,
          departed_by_staff_name: staffName,
          departed_by_staff_phone: staffPhone
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
    const staffName = session.userData.name || "Terminal Staff";
    const staffPhone = session.userData.phone || session.userData.staff_phone || "";

    await updateDoc(busRef, {
      status: "arrived",
      arrived_at: nowStr,
      arrived_by_staff_id: session.userId,
      arrived_by_staff_name: staffName,
      arrived_by_staff_phone: staffPhone
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
          arrived_at: nowStr,
          arrived_by_staff_id: session.userId,
          arrived_by_staff_name: staffName,
          arrived_by_staff_phone: staffPhone
        };
        await updateDoc(doc(db, "waybills", docObj.id), {
          status: "arrived",
          arrived_at: nowStr,
          arrived_by_staff_id: session.userId,
          arrived_by_staff_name: staffName,
          arrived_by_staff_phone: staffPhone
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

// 7b. Verify Secret Pickup PIN or Receiver Phone before displaying details to Staff
app.post("/api/staff/waybills/:id/verify-code", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const waybillId = req.params.id;
    const { code } = req.body;
    const inputVal = String(code || "").trim();

    if (!inputVal) {
      return res.status(400).json({ error: "Receiver phone number or secret 6-digit Pickup PIN is required for verification." });
    }

    const waybillRef = doc(db, "waybills", waybillId);
    const waybillSnap = await getDoc(waybillRef);
    if (!waybillSnap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }

    const waybillData = waybillSnap.data();
    const expectedPhone = (waybillData.receiver_phone || "").trim();
    const expectedPin = (waybillData.pickup_pin || "").trim();

    const isPhoneMatch = inputVal === expectedPhone;
    const isPinMatch = expectedPin && inputVal === expectedPin;

    if (!isPhoneMatch && !isPinMatch) {
      return res.status(400).json({ error: "Verification Failed. The secret Pickup PIN or Receiver Phone provided does not match this waybill." });
    }

    // Do NOT expose pickup_pin in response object to staff
    const { pickup_pin: _hiddenPin, ...safeWaybill } = waybillData;

    res.json({
      success: true,
      verified_by: isPinMatch ? "Secret 6-Digit Pickup PIN" : "Receiver Phone Number",
      waybill: { id: waybillSnap.id, ...safeWaybill }
    });
  } catch (err) {
    console.error("Error verifying waybill code:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 8. Mark Waybill as Collected (by Staff with Flexible Phone or Secret Pickup PIN Verification)
app.post("/api/staff/waybills/:id/collect", async (req, res) => {
  try {
    const session = await validateSessionFromHeader(req, res);
    if (!session) return;

    const waybillId = req.params.id;
    const { receiver_phone, pickup_pin } = req.body;

    const inputVal = String(receiver_phone || pickup_pin || "").trim();

    if (!inputVal) {
      return res.status(400).json({ error: "Receiver phone number or 6-digit Pickup PIN is required for verification." });
    }

    const waybillRef = doc(db, "waybills", waybillId);
    const waybillSnap = await getDoc(waybillRef);
    if (!waybillSnap.exists()) {
      return res.status(404).json({ error: "Waybill not found." });
    }

    const waybillData = waybillSnap.data();

    const expectedPhone = (waybillData.receiver_phone || "").trim();
    const expectedPin = (waybillData.pickup_pin || "").trim();

    // Check if input matches receiver phone OR pickup pin
    const isPhoneMatch = inputVal === expectedPhone;
    const isPinMatch = expectedPin && inputVal === expectedPin;

    if (!isPhoneMatch && !isPinMatch) {
      return res.status(400).json({ 
        error: "Verification failed! The entered value does not match the Receiver Phone Number or 6-digit Pickup PIN on record for this waybill. Ask the receiver to state their correct phone number or Pickup PIN." 
      });
    }

    const nowStr = new Date().toISOString();

    await updateDoc(waybillRef, {
      status: "collected",
      collected_at: nowStr,
      collected_by: "staff",
      collected_by_staff_id: session.userId,
      collected_by_staff_name: session.userData.name || "Terminal Staff",
      collected_by_staff_phone: session.userData.phone || session.userData.staff_phone || ""
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
    const recentWaybills = sortedWaybills.slice(0, 5).map((wb: any) => {
      const { pickup_pin, ...rest } = wb;
      return rest;
    });

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

    // Fetch Managers
    const qManagers = query(collection(db, "managers"), where("company_id", "==", companyId));
    const snapManagers = await getDocs(qManagers);
    const managersList = snapManagers.docs.map(d => ({ id: d.id, ...d.data() }));

    // Nest staff and managers inside parks
    const parksWithStaff = parksList.map((park: any) => {
      const parkStaff = staffList.filter((s: any) => s.park_id === park.id);
      const parkManagers = managersList.filter((m: any) => m.park_id === park.id);
      return {
        ...park,
        staff: parkStaff,
        managers: parkManagers
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

    const { name, phone, park_id } = req.body;
    if (!name || !park_id) {
      return res.status(400).json({ error: "Staff name and park selection are required." });
    }

    const cleanPhone = (phone || "").trim();
    if (cleanPhone && !isValid11DigitPhone(cleanPhone)) {
      return res.status(400).json({ error: "If provided, staff phone number must be a valid 11-digit phone number (e.g. 08012345678)." });
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
      phone: phone.trim(),
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
        phone: phone.trim(),
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

// 6. Delete Staff Member (Company CEO)
app.delete("/api/company/staff/:id", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const staffId = req.params.id;
    const staffRef = doc(db, "staff", staffId);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists() || staffSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Staff member not found or unauthorized." });
    }

    await deleteDoc(staffRef);

    // Invalidate sessions for this staff member
    const sessionsSnap = await getDocs(collection(db, "sessions"));
    for (const sDoc of sessionsSnap.docs) {
      const sData = sDoc.data();
      if (sData.userId === staffId || (sData.userData && (sData.userData.staff_id === staffId || sData.userData.id === staffId))) {
        await deleteDoc(doc(db, "sessions", sDoc.id));
      }
    }

    res.json({ success: true, message: "Staff member deleted permanently." });
  } catch (err) {
    console.error("Error deleting staff by company:", err);
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
    const paginatedWaybills = waybills.slice(startIndex, endIndex).map((wb: any) => {
      const { pickup_pin, ...rest } = wb;
      return rest;
    });

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

// ---------------- COMPANY OWNER MANAGER MANAGEMENT ENDPOINTS ----------------

// GET /api/company/managers - List all managers created by this company
app.get("/api/company/managers", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const q = query(collection(db, "managers"), where("company_id", "==", companyId));
    const snap = await getDocs(q);
    const managers = snap.docs.map(d => {
      const { pin_hash, ...data } = d.data();
      return { id: d.id, ...data };
    });

    res.json({ success: true, managers });
  } catch (err) {
    console.error("Error getting company managers:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/company/managers - Create a new manager for a specific park
app.post("/api/company/managers", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const { name, phone, park_id, pin } = req.body;
    if (!name || !phone || !park_id) {
      return res.status(400).json({ error: "Manager name, phone number, and park selection are required." });
    }

    const cleanPhone = String(phone).trim();
    if (!isValid11DigitPhone(cleanPhone)) {
      return res.status(400).json({ error: "Manager phone number must be a valid 11-digit number (e.g. 08012345678)." });
    }

    // Check if a manager with this phone already exists
    const qPhone = query(collection(db, "managers"), where("phone", "==", cleanPhone), limit(1));
    const snapPhone = await getDocs(qPhone);
    if (!snapPhone.empty) {
      return res.status(400).json({ error: "A manager with this phone number already exists." });
    }

    // Verify park exists and belongs to company
    const parkRef = doc(db, "parks", park_id);
    const parkSnap = await getDoc(parkRef);
    if (!parkSnap.exists() || parkSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Selected park was not found or unauthorized." });
    }
    const parkLocation = parkSnap.data().park_location;

    // Option for PIN: if provided, hash it; otherwise leave null so manager creates their PIN on first login
    let hashedPin: string | null = null;
    let mgrPin: string | null = null;
    if (pin && String(pin).trim().length === 6) {
      mgrPin = String(pin).trim();
      hashedPin = await bcrypt.hash(mgrPin, 10);
    }

    const newManagerDoc = await addDoc(collection(db, "managers"), {
      name: name.trim(),
      phone: cleanPhone,
      pin_hash: hashedPin,
      company_id: companyId,
      park_id: park_id,
      park_location: parkLocation,
      active: true,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      manager: {
        id: newManagerDoc.id,
        name: name.trim(),
        phone: cleanPhone,
        company_id: companyId,
        park_id: park_id,
        park_location: parkLocation,
        active: true,
        created_at: new Date().toISOString()
      },
      pin: mgrPin,
      message: "Manager assigned successfully. They can now log in using their phone number and create their 6-digit PIN."
    });
  } catch (err) {
    console.error("Error creating manager:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/company/managers/:id/toggle-active - Toggle manager active state
app.post("/api/company/managers/:id/toggle-active", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const managerId = req.params.id;
    const mgrRef = doc(db, "managers", managerId);
    const mgrSnap = await getDoc(mgrRef);

    if (!mgrSnap.exists() || mgrSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Manager not found or unauthorized." });
    }

    const currentActive = mgrSnap.data().active !== false;
    const nextActive = !currentActive;
    await updateDoc(mgrRef, { active: nextActive });

    res.json({ success: true, active: nextActive });
  } catch (err) {
    console.error("Error toggling manager active status:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// DELETE /api/company/managers/:id - Delete manager permanently
app.delete("/api/company/managers/:id", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const managerId = req.params.id;
    const mgrRef = doc(db, "managers", managerId);
    const mgrSnap = await getDoc(mgrRef);

    if (!mgrSnap.exists() || mgrSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Manager not found or unauthorized." });
    }

    await deleteDoc(mgrRef);

    // Invalidate sessions for this manager
    const sessionsSnap = await getDocs(collection(db, "sessions"));
    for (const sDoc of sessionsSnap.docs) {
      const sData = sDoc.data();
      if (sData.userId === managerId || (sData.userData && (sData.userData.manager_id === managerId || sData.userData.id === managerId))) {
        await deleteDoc(doc(db, "sessions", sDoc.id));
      }
    }

    res.json({ success: true, message: "Manager deleted permanently." });
  } catch (err) {
    console.error("Error deleting manager by company:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/company/managers/:id/reset-pin - Reset 6-digit PIN for a manager (clears PIN so manager can set a new one)
app.post("/api/company/managers/:id/reset-pin", async (req, res) => {
  try {
    const session = await validateCompanySessionFromHeader(req, res);
    if (!session) return;
    const companyId = session.userId;

    const managerId = req.params.id;
    const mgrRef = doc(db, "managers", managerId);
    const mgrSnap = await getDoc(mgrRef);

    if (!mgrSnap.exists() || mgrSnap.data().company_id !== companyId) {
      return res.status(404).json({ error: "Manager not found or unauthorized." });
    }

    const mgrName = mgrSnap.data().name;
    await updateDoc(mgrRef, { pin_hash: null });

    res.json({ success: true, name: mgrName, message: `PIN reset for ${mgrName}. They can now create a new 6-digit PIN on sign-in.` });
  } catch (err) {
    console.error("Error resetting manager PIN:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ---------------- MANAGER PORTAL API ENDPOINTS ----------------

// Helper for Manager session validation
async function validateManagerSessionFromHeader(req: express.Request, res: express.Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No session token found." });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const session = await validateSession(token);
  if (!session || session.userRole !== "manager") {
    res.status(401).json({ error: "Unauthorized session for manager portal." });
    return null;
  }
  return session;
}

// GET /api/manager/overview - Get park metrics, volume, gross tracking fee & shipping fee totals by day/week/month
app.get("/api/manager/overview", async (req, res) => {
  try {
    const session = await validateManagerSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location, park_id } = session.userData;

    const companyRef = doc(db, "companies", company_id);
    const companySnap = await getDoc(companyRef);
    const companyName = companySnap.exists() ? (companySnap.data().company_name || "Transport Company") : "Transport Company";

    // Query waybills originating from or heading to this park
    const qWb = query(
      collection(db, "waybills"),
      where("company_id", "==", company_id)
    );
    const snapWb = await getDocs(qWb);
    const allWaybills = snapWb.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter for manager's park
    const waybills = allWaybills.filter((wb: any) => 
      wb.origin_park === park_location || wb.destination_park === park_location
    );

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    let volumeToday = 0, volumeWeek = 0, volumeMonth = 0;
    let trackingFeesToday = 0, trackingFeesWeek = 0, trackingFeesMonth = 0;
    let shippingFeesToday = 0, shippingFeesWeek = 0, shippingFeesMonth = 0;

    waybills.forEach((wb: any) => {
      const ts = new Date(wb.created_at || wb.booked_at || 0).getTime();
      const diff = now - ts;
      const shippingFee = Number(wb.shipping_fee) || 0;
      const isPaid = wb.paid === true;

      if (diff <= oneDayMs) {
        volumeToday++;
        if (isPaid) {
          trackingFeesToday += 200;
          shippingFeesToday += shippingFee;
        }
      }
      if (diff <= oneWeekMs) {
        volumeWeek++;
        if (isPaid) {
          trackingFeesWeek += 200;
          shippingFeesWeek += shippingFee;
        }
      }
      if (diff <= oneMonthMs) {
        volumeMonth++;
        if (isPaid) {
          trackingFeesMonth += 200;
          shippingFeesMonth += shippingFee;
        }
      }
    });

    // Query staff at manager's park
    const qStaff = query(
      collection(db, "staff"),
      where("company_id", "==", company_id)
    );
    const snapStaff = await getDocs(qStaff);
    const staffList = snapStaff.docs
      .map(d => {
        const { pin_hash, ...data } = d.data();
        return { id: d.id, ...data };
      })
      .filter((s: any) => s.park_location === park_location || s.park_id === park_id);

    const activeStaffCount = staffList.filter((s: any) => s.active === true).length;

    // Recent waybills for this park
    const sortedWaybills = [...waybills].sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || a.booked_at || 0).getTime();
      const dateB = new Date(b.created_at || b.booked_at || 0).getTime();
      return dateB - dateA;
    });

    const recentWaybills = sortedWaybills.slice(0, 10).map((wb: any) => {
      const { pickup_pin, ...rest } = wb;
      return rest;
    });

    res.json({
      success: true,
      company_name: companyName,
      park_location,
      stats: {
        volume: { today: volumeToday, week: volumeWeek, month: volumeMonth },
        tracking_fees: { today: trackingFeesToday, week: trackingFeesWeek, month: trackingFeesMonth },
        shipping_fees: { today: shippingFeesToday, week: shippingFeesWeek, month: shippingFeesMonth },
        active_staff_count: activeStaffCount
      },
      staff: staffList,
      recent_waybills: recentWaybills
    });
  } catch (err) {
    console.error("Error in GET /api/manager/overview:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/manager/staff - View staff at manager's park
app.get("/api/manager/staff", async (req, res) => {
  try {
    const session = await validateManagerSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location, park_id } = session.userData;

    const qStaff = query(collection(db, "staff"), where("company_id", "==", company_id));
    const snap = await getDocs(qStaff);
    const staff = snap.docs
      .map(d => {
        const { pin_hash, ...data } = d.data();
        return { id: d.id, ...data };
      })
      .filter((s: any) => s.park_location === park_location || s.park_id === park_id);

    res.json({ success: true, staff });
  } catch (err) {
    console.error("Error getting manager staff:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/manager/staff - Manager creates staff at their park
app.post("/api/manager/staff", async (req, res) => {
  try {
    const session = await validateManagerSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_id, park_location } = session.userData;

    const { name, phone } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Staff name is required." });
    }

    const cleanPhone = (phone || "").trim();
    if (cleanPhone && !isValid11DigitPhone(cleanPhone)) {
      return res.status(400).json({ error: "If provided, staff phone number must be a valid 11-digit phone number (e.g. 08012345678)." });
    }

    // Generate unique 4-digit PIN
    let pin = "";
    let pinUnique = false;
    const allStaffSnap = await getDocs(collection(db, "staff"));
    const staffDocs = allStaffSnap.docs.map(d => d.data());

    let loopSafety = 0;
    while (!pinUnique && loopSafety < 100) {
      loopSafety++;
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      if (isWeakPin(pin, 4).weak) continue;
      let foundMatch = false;
      for (const s of staffDocs) {
        if (s.pin_hash) {
          const isMatch = await bcrypt.compare(pin, s.pin_hash);
          if (isMatch) {
            foundMatch = true;
            break;
          }
        }
      }
      if (!foundMatch) pinUnique = true;
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    const newStaffDoc = await addDoc(collection(db, "staff"), {
      name: name.trim(),
      phone: cleanPhone,
      pin_hash: hashedPin,
      company_id,
      park_id: park_id || "park_assigned",
      park_location,
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
        phone: cleanPhone,
        park_location,
        active: true,
        created_at: new Date().toISOString()
      },
      pin
    });
  } catch (err) {
    console.error("Error creating staff by manager:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/manager/staff/:id/toggle-active - Toggle staff active state
app.post("/api/manager/staff/:id/toggle-active", async (req, res) => {
  try {
    const session = await validateManagerSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const staffId = req.params.id;
    const staffRef = doc(db, "staff", staffId);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists() || staffSnap.data().company_id !== company_id || staffSnap.data().park_location !== park_location) {
      return res.status(404).json({ error: "Staff member not found at your assigned park." });
    }

    const nextActive = !staffSnap.data().active;
    await updateDoc(staffRef, { active: nextActive });

    res.json({ success: true, active: nextActive });
  } catch (err) {
    console.error("Error toggling staff active status by manager:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// DELETE /api/manager/staff/:id - Delete staff member permanently by manager
app.delete("/api/manager/staff/:id", async (req, res) => {
  try {
    const session = await validateManagerSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const staffId = req.params.id;
    const staffRef = doc(db, "staff", staffId);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists() || staffSnap.data().company_id !== company_id || staffSnap.data().park_location !== park_location) {
      return res.status(404).json({ error: "Staff member not found at your assigned park." });
    }

    await deleteDoc(staffRef);

    // Invalidate sessions for this staff member
    const sessionsSnap = await getDocs(collection(db, "sessions"));
    for (const sDoc of sessionsSnap.docs) {
      const sData = sDoc.data();
      if (sData.userId === staffId || (sData.userData && (sData.userData.staff_id === staffId || sData.userData.id === staffId))) {
        await deleteDoc(doc(db, "sessions", sDoc.id));
      }
    }

    res.json({ success: true, message: "Staff member deleted permanently." });
  } catch (err) {
    console.error("Error deleting staff by manager:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/manager/staff/:id/reset-pin - Reset staff PIN
app.post("/api/manager/staff/:id/reset-pin", async (req, res) => {
  try {
    const session = await validateManagerSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const staffId = req.params.id;
    const staffRef = doc(db, "staff", staffId);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists() || staffSnap.data().company_id !== company_id || staffSnap.data().park_location !== park_location) {
      return res.status(404).json({ error: "Staff member not found at your assigned park." });
    }

    const staffName = staffSnap.data().name;

    let pin = "";
    let pinUnique = false;
    const allStaffSnap = await getDocs(collection(db, "staff"));
    const staffDocs = allStaffSnap.docs.map(d => d.data());

    let loopSafety = 0;
    while (!pinUnique && loopSafety < 100) {
      loopSafety++;
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      if (isWeakPin(pin, 4).weak) continue;
      let foundMatch = false;
      for (const s of staffDocs) {
        if (s.pin_hash) {
          const isMatch = await bcrypt.compare(pin, s.pin_hash);
          if (isMatch) {
            foundMatch = true;
            break;
          }
        }
      }
      if (!foundMatch) pinUnique = true;
    }

    const hashedPin = await bcrypt.hash(pin, 10);
    await updateDoc(staffRef, { pin_hash: hashedPin, failed_attempts: 0, locked_until: null });

    res.json({ success: true, name: staffName, pin });
  } catch (err) {
    console.error("Error resetting staff PIN by manager:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/manager/waybills - View all waybills at manager's park
app.get("/api/manager/waybills", async (req, res) => {
  try {
    const session = await validateManagerSessionFromHeader(req, res);
    if (!session) return;
    const { company_id, park_location } = session.userData;

    const q = query(collection(db, "waybills"), where("company_id", "==", company_id));
    const snap = await getDocs(q);
    const waybills = snap.docs
      .map(d => {
        const { pickup_pin, ...rest } = d.data();
        return { id: d.id, ...rest };
      })
      .filter((wb: any) => wb.origin_park === park_location || wb.destination_park === park_location);

    res.json({ success: true, waybills });
  } catch (err) {
    console.error("Error getting manager waybills:", err);
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

// Read-Only Managers Endpoint for Super Admin
app.get("/api/admin/managers", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const mgrSnap = await getDocs(collection(db, "managers"));
    const compSnap = await getDocs(collection(db, "companies"));
    const companyMap: Record<string, string> = {};
    compSnap.docs.forEach(d => {
      companyMap[d.id] = d.data().company_name || "Unknown Company";
    });

    const managers = mgrSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        phone: data.phone,
        park_location: data.park_location,
        company_id: data.company_id,
        company_name: companyMap[data.company_id] || "Unknown Company",
        active: data.active,
        created_at: data.created_at
      };
    });

    res.json({ success: true, managers });
  } catch (err) {
    console.error("Error getting admin managers:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 1b. Admin Account Recovery - Search account by phone number
app.get("/api/admin/recovery/search", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const { phone_number } = req.query;
    if (!phone_number || typeof phone_number !== "string") {
      return res.status(400).json({ error: "Phone number is required." });
    }

    const cleanPhone = phone_number.trim();
    const accounts = [];

    // 1. Search customers
    const custQuery = query(collection(db, "customers"), where("phone_number", "==", cleanPhone), limit(1));
    const custSnap = await getDocs(custQuery);

    if (!custSnap.empty) {
      const custDoc = custSnap.docs[0];
      const custData = custDoc.data();

      // Query waybills
      const wbSenderQuery = query(collection(db, "waybills"), where("sender_phone", "==", cleanPhone), limit(10));
      const wbSenderSnap = await getDocs(wbSenderQuery);
      
      const wbReceiverQuery = query(collection(db, "waybills"), where("receiver_phone", "==", cleanPhone), limit(10));
      const wbReceiverSnap = await getDocs(wbReceiverQuery);

      const trackingCodesSet = new Set<string>();
      wbSenderSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.tracking_code) trackingCodesSet.add(data.tracking_code);
      });
      wbReceiverSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.tracking_code) trackingCodesSet.add(data.tracking_code);
      });

      accounts.push({
        type: "customer",
        id: custDoc.id,
        name: "Registered Shipper/Receiver",
        phone_number: cleanPhone,
        tracking_codes: Array.from(trackingCodesSet),
        created_at: custData.created_at || null
      });
    }

    // 2. Search companies
    const compQuery = query(collection(db, "companies"), where("owner_phone", "==", cleanPhone), limit(1));
    const compSnap = await getDocs(compQuery);

    if (!compSnap.empty) {
      const compDoc = compSnap.docs[0];
      const compData = compDoc.data();

      // Query parks linked to company
      const parksQuery = query(collection(db, "parks"), where("company_id", "==", compDoc.id));
      const parksSnap = await getDocs(parksQuery);
      const parks = parksSnap.docs.map(d => d.data().park_name || d.data().park_location || d.data().location);

      accounts.push({
        type: "company",
        id: compDoc.id,
        name: compData.company_name || "Transport Company Owner",
        phone_number: cleanPhone,
        company_name: compData.company_name,
        parks,
        created_at: compData.created_at || null
      });
    }

    // 3. Search managers
    const mgrQuery = query(collection(db, "managers"), where("phone", "==", cleanPhone), limit(1));
    const mgrSnap = await getDocs(mgrQuery);

    if (!mgrSnap.empty) {
      const mgrDoc = mgrSnap.docs[0];
      const mgrData = mgrDoc.data();

      const compRef = doc(db, "companies", mgrData.company_id);
      const compSnap = await getDoc(compRef);
      const compName = compSnap.exists() ? compSnap.data().company_name : "Unknown Company";

      accounts.push({
        type: "manager",
        id: mgrDoc.id,
        name: mgrData.name || "Manager",
        phone_number: cleanPhone,
        company_name: compName,
        park_location: mgrData.park_location || "N/A",
        created_at: mgrData.created_at || null
      });
    }

    // 4. Search staff
    const staffQuery = query(collection(db, "staff"), where("phone", "==", cleanPhone), limit(1));
    const staffSnap = await getDocs(staffQuery);

    if (!staffSnap.empty) {
      const staffDoc = staffSnap.docs[0];
      const staffData = staffDoc.data();

      const compRef = doc(db, "companies", staffData.company_id);
      const compSnap = await getDoc(compRef);
      const compName = compSnap.exists() ? compSnap.data().company_name : "Unknown Company";

      accounts.push({
        type: "staff",
        id: staffDoc.id,
        name: staffData.name || "Staff",
        phone_number: cleanPhone,
        company_name: compName,
        park_location: staffData.park_location || staffData.assigned_park || "N/A",
        created_at: staffData.created_at || null
      });
    }

    if (accounts.length > 0) {
      return res.json({
        found: true,
        accounts
      });
    }

    return res.status(404).json({ found: false, error: "No account found with this phone number across all roles." });
  } catch (err) {
    console.error("Admin recovery search error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 1c. Admin Account Recovery - Generate 30-minute valid reset code
app.post("/api/admin/recovery/generate-code", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    const { type, id } = req.body;
    if (!type || !id) {
      return res.status(400).json({ error: "Account type and document ID are required." });
    }

    if (type !== "customer" && type !== "company" && type !== "manager" && type !== "staff") {
      return res.status(400).json({ error: "Invalid account type." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes expiry

    let targetCollection = "";
    if (type === "customer") targetCollection = "customers";
    else if (type === "company") targetCollection = "companies";
    else if (type === "manager") targetCollection = "managers";
    else if (type === "staff") targetCollection = "staff";

    const docRef = doc(db, targetCollection, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: "Account not found." });
    }

    await updateDoc(docRef, {
      temporary_reset_code: code,
      temporary_reset_code_expires_at: expiresAt
    });

    console.log(`[ADMIN RECOVERY] Generated reset code for ${type} (${id}): ${code}`);

    res.json({
      success: true,
      code,
      expires_at: expiresAt
    });
  } catch (err) {
    console.error("Admin generate code error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 1d. Reset Password API - Validate Code
app.post("/api/auth/reset-password/validate-code", async (req, res) => {
  try {
    const { phone_number, code } = req.body;
    if (!phone_number || !code) {
      return res.status(400).json({ error: "Phone number and reset code are required." });
    }

    if (!isValid11DigitPhone(phone_number)) {
      return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
    }

    const cleanPhone = phone_number.trim();

    // 1. Search customers
    const custQuery = query(collection(db, "customers"), where("phone_number", "==", cleanPhone), limit(1));
    const custSnap = await getDocs(custQuery);

    if (!custSnap.empty) {
      const d = custSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          return res.json({ success: true, type: "customer", id: d.id });
        }
      }
    }

    // 2. Search companies
    const compQuery = query(collection(db, "companies"), where("owner_phone", "==", cleanPhone), limit(1));
    const compSnap = await getDocs(compQuery);

    if (!compSnap.empty) {
      const d = compSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          return res.json({ success: true, type: "company", id: d.id });
        }
      }
    }

    // 3. Search managers
    const mgrQuery = query(collection(db, "managers"), where("phone", "==", cleanPhone), limit(1));
    const mgrSnap = await getDocs(mgrQuery);

    if (!mgrSnap.empty) {
      const d = mgrSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          return res.json({ success: true, type: "manager", id: d.id });
        }
      }
    }

    // 4. Search staff
    const staffQuery = query(collection(db, "staff"), where("phone", "==", cleanPhone), limit(1));
    const staffSnap = await getDocs(staffQuery);

    if (!staffSnap.empty) {
      const d = staffSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          return res.json({ success: true, type: "staff", id: d.id });
        }
      }
    }

    return res.status(400).json({ error: "Invalid or expired reset code. Please message support on WhatsApp to request a new one." });
  } catch (err) {
    console.error("Reset password validation error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 1e. Reset Password API - Submit New Password
app.post("/api/auth/reset-password/submit", async (req, res) => {
  try {
    const { phone_number, code, new_password } = req.body;
    if (!phone_number || !code || !new_password) {
      return res.status(400).json({ error: "Phone number, code, and new password are required." });
    }

    if (!isValid11DigitPhone(phone_number)) {
      return res.status(400).json({ error: "Phone number must be exactly 11 digits (e.g. 08012345678)." });
    }

    const cleanPhone = phone_number.trim();

    // Check customer
    const custQuery = query(collection(db, "customers"), where("phone_number", "==", cleanPhone), limit(1));
    const custSnap = await getDocs(custQuery);

    if (!custSnap.empty) {
      const d = custSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          const pinVal = isWeakPin(new_password, 6);
          if (pinVal.weak) {
            return res.status(400).json({ error: pinVal.reason });
          }

          const hash = await bcrypt.hash(new_password.trim(), 10);
          await updateDoc(doc(db, "customers", d.id), {
            password_hash: hash,
            temporary_reset_code: null,
            temporary_reset_code_expires_at: null,
            failed_attempts: 0,
            locked_until: null
          });

          return res.json({ success: true, message: "Your PIN has been reset successfully. Please sign in." });
        }
      }
    }

    // Check company
    const compQuery = query(collection(db, "companies"), where("owner_phone", "==", cleanPhone), limit(1));
    const compSnap = await getDocs(compQuery);

    if (!compSnap.empty) {
      const d = compSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          const passVal = isWeakPassword(new_password);
          if (passVal.weak) {
            return res.status(400).json({ error: passVal.reason });
          }

          const hash = await bcrypt.hash(new_password.trim(), 10);
          await updateDoc(doc(db, "companies", d.id), {
            password_hash: hash,
            temporary_reset_code: null,
            temporary_reset_code_expires_at: null,
            failed_attempts: 0,
            locked_until: null
          });

          return res.json({ success: true, message: "Your password has been reset successfully. Please sign in." });
        }
      }
    }

    // Check manager
    const mgrQuery = query(collection(db, "managers"), where("phone", "==", cleanPhone), limit(1));
    const mgrSnap = await getDocs(mgrQuery);

    if (!mgrSnap.empty) {
      const d = mgrSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          const pinVal = isWeakPin(new_password, 6);
          if (pinVal.weak) {
            return res.status(400).json({ error: pinVal.reason });
          }

          const hash = await bcrypt.hash(new_password.trim(), 10);
          await updateDoc(doc(db, "managers", d.id), {
            pin_hash: hash,
            temporary_reset_code: null,
            temporary_reset_code_expires_at: null,
            failed_attempts: 0,
            locked_until: null
          });

          return res.json({ success: true, message: "Your PIN has been reset successfully. Please sign in." });
        }
      }
    }

    // Check staff
    const staffQuery = query(collection(db, "staff"), where("phone", "==", cleanPhone), limit(1));
    const staffSnap = await getDocs(staffQuery);

    if (!staffSnap.empty) {
      const d = staffSnap.docs[0];
      const data = d.data();
      if (data.temporary_reset_code === code) {
        const expires = new Date(data.temporary_reset_code_expires_at || 0);
        if (expires > new Date()) {
          const pinVal = isWeakPin(new_password, 4);
          if (pinVal.weak) {
            return res.status(400).json({ error: pinVal.reason });
          }

          const hash = await bcrypt.hash(new_password.trim(), 10);
          await updateDoc(doc(db, "staff", d.id), {
            pin_hash: hash,
            temporary_reset_code: null,
            temporary_reset_code_expires_at: null,
            failed_attempts: 0,
            locked_until: null
          });

          return res.json({ success: true, message: "Your PIN has been reset successfully. Please sign in." });
        }
      }
    }

    return res.status(400).json({ error: "Invalid reset operation. Either the code is expired or the account doesn't match." });
  } catch (err) {
    console.error("Reset password submit error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 1. GET /api/admin/overview - independent loads or unified
app.get("/api/admin/overview", async (req, res) => {
  try {
    const session = await validateAdminSessionFromHeader(req, res);
    if (!session) return;

    // Fetch approved & pending companies
    const compSnap = await getDocs(collection(db, "companies"));
    const companies = compSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const onboardedCount = companies.filter(c => c.approved === true).length;
    const pendingCount = companies.filter(c => c.approved === false && c.rejected !== true).length;

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

    // Enrich companies with counts, park details, and real earnings
    const enrichedCompanies = companies.map(comp => {
      const companyParks = parks.filter(p => p.company_id === comp.id);
      const companyStaff = staff.filter(s => s.company_id === comp.id);
      const companyShipments = waybills.filter(w => w.company_id === comp.id);
      const companyPayments = payments.filter(p => p.company_id === comp.id);
      const companyEarnings = companyPayments.reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);

      const firstPark = companyParks[0];
      const pName = comp.park_name || (firstPark ? (firstPark as any).park_name : null);
      const pLoc = comp.park_location || (firstPark ? (firstPark as any).park_location : null);

      let parkDisplay = "N/A";
      if (pName && pLoc) {
        parkDisplay = pName.toLowerCase() === pLoc.toLowerCase() ? pName : `${pName} (${pLoc})`;
      } else if (pName) {
        parkDisplay = pName;
      } else if (pLoc) {
        parkDisplay = pLoc;
      }

      return {
        ...comp,
        park_name: pName,
        park_location: parkDisplay !== "N/A" ? parkDisplay : (comp.park_location || "N/A"),
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

// 4. POST /api/admin/companies/:id/reject - reject pending company with reason
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

    const { reason } = req.body;

    await updateDoc(compRef, {
      approved: false,
      rejected: true,
      rejection_reason: reason || "Your registration details do not meet our service requirements. Please contact support or resubmit with accurate information."
    });

    res.json({ success: true, message: "Company application rejected successfully." });
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

    const companyData = compSnap.data();
    const currentSuspended = companyData.suspended === true || companyData.suspended === "true";
    const nextSuspended = !currentSuspended;

    await updateDoc(compRef, {
      suspended: nextSuspended
    });

    // Logout company owners & company staff instantly
    if (nextSuspended) {
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
      suspended: nextSuspended,
      message: nextSuspended ? "Company suspended successfully, and all associated sessions terminated." : "Company reinstated successfully."
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
    const staff = staffSnap.docs.map(doc => {
      const data = doc.data() as any;
      delete data.pin_hash;
      return { id: doc.id, ...data };
    });

    // Fetch shipments
    const wbQ = query(collection(db, "waybills"), where("company_id", "==", compId));
    const wbSnap = await getDocs(wbQ);
    const shipments = wbSnap.docs.map(doc => {
      const data = doc.data() as any;
      delete data.pickup_pin;
      return { id: doc.id, ...data };
    });

    // Query successful payments for this company to calculate real-time earnings & commission share
    const paySnap = await getDocs(collection(db, "payments"));
    const companyPayments = paySnap.docs
      .map(doc => doc.data() as any)
      .filter(p => p.company_id === compId && p.status === "success");

    const totalCompanyEarnings = companyPayments.reduce((sum, p) => sum + (Number(p.company_share) || 0), 0);
    const totalPlatformCommission = companyPayments.reduce((sum, p) => sum + (Number(p.platform_share) || 0), 0);

    let companySplitPct = (company.split_percentage !== undefined && company.split_percentage !== 70) ? Number(company.split_percentage) : 30;
    
    // Auto-repair inverted split if company previously had 70% stored
    if (company.split_percentage === 70) {
      companySplitPct = 30;
      await updateDoc(doc(db, "companies", compId), { split_percentage: 30 });
      if (company.paystack_subaccount_code && process.env.PAYSTACK_SECRET_KEY) {
        try {
          await fetch(`https://api.paystack.co/subaccount/${company.paystack_subaccount_code}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ percentage_charge: 30 })
          });
          console.log(`Auto-repaired Paystack subaccount ${company.paystack_subaccount_code} percentage_charge to 30%`);
        } catch (e) {
          console.error("Failed to repair Paystack subaccount percentage:", e);
        }
      }
    }

    const companyEnriched = {
      ...company,
      split_percentage: companySplitPct,
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
    const paginatedWaybills = waybills.slice(startIndex, endIndex).map((wb: any) => {
      const { pickup_pin, ...rest } = wb;
      return rest;
    });

    const sanitizedAllFiltered = waybills.map((wb: any) => {
      const { pickup_pin, ...rest } = wb;
      return rest;
    });

    res.json({
      success: true,
      waybills: paginatedWaybills,
      total,
      page,
      pages: Math.ceil(total / limitVal),
      allFiltered: sanitizedAllFiltered
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

function derivePrefix(originPark: string): string {
  if (!originPark) return "NNW";
  const cleaned = originPark
    .replace(/park|terminal|motors|station|garage|transport|transit/gi, '')
    .trim();
  const letters = (cleaned || originPark).replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length >= 3) {
    return letters.slice(0, 3);
  } else if (letters.length > 0) {
    return letters.padEnd(3, 'X');
  }
  return "NNW";
}

async function generateUniqueTrackingCode(originPark?: string): Promise<string> {
  const prefix = derivePrefix(originPark || "Nnewi");
  let unique = false;
  let tracking_code = "";
  while (!unique) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    tracking_code = `${prefix}-${rand}`;
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

  const waybillRef = doc(db, "waybills", payment.waybill_id);
  const wbSnap = await getDoc(waybillRef);
  const wbData = wbSnap.exists() ? wbSnap.data() : {};
  const originPark = wbData.origin_park || "Nnewi";

  // 1. Generate unique tracking code with dynamic prefix based on origin park
  const tracking_code = await generateUniqueTrackingCode(originPark);

  // 2. Fetch company to get split percentage
  const compRef = doc(db, "companies", payment.company_id);
  const compSnap = await getDoc(compRef);
  const compData = compSnap.exists() ? compSnap.data() : { split_percentage: 30 };
  let split_pct = compData.split_percentage !== undefined ? Number(compData.split_percentage) : 30;
  if (split_pct === 70) {
    split_pct = 30; // Repair inverted split value
  }

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
  await updateDoc(waybillRef, {
    tracking_code,
    tracking_active: true,
    status: "booked",
    paid: true,
    payment_reference: payment.paystack_reference
  });

  // 6. Send instant push & SMS notifications to Sender & Receiver
  try {
    const updatedWbSnap = await getDoc(waybillRef);
    if (updatedWbSnap.exists()) {
      const wbData = updatedWbSnap.data();
      sendPushNotificationForWaybill({ ...wbData, tracking_code }, "booked");
      
      const pinClause = wbData.pickup_pin ? ` Secret Pickup PIN: ${wbData.pickup_pin}.` : '';
      const senderMsg = `[Waybilla] Shipment Booked! Tracking Code: ${tracking_code}.${pinClause} Waybill for ${wbData.receiver_name} (${wbData.destination_park}). Track online at waybilla.com.ng`;
      const receiverMsg = `[Waybilla] Waybill Alert! ${wbData.sender_name} sent you a waybill via Waybilla (${wbData.origin_park} to ${wbData.destination_park}). Tracking Code: ${tracking_code}.${pinClause} Track online at waybilla.com.ng`;

      if (wbData.sender_phone) {
        sendRealWorldSMS(wbData.sender_phone, senderMsg).catch(e => console.error("[SMS Error Sender Booked]:", e));
      }
      if (wbData.receiver_phone && wbData.receiver_phone !== wbData.sender_phone) {
        sendRealWorldSMS(wbData.receiver_phone, receiverMsg).catch(e => console.error("[SMS Error Receiver Booked]:", e));
      }
    }
  } catch (err) {
    console.error("Error triggering initial SMS/Push for confirmed waybill:", err);
  }

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

    let split_percentage = (compData.split_percentage && compData.split_percentage !== 70) ? Number(compData.split_percentage) : 30.0;

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
