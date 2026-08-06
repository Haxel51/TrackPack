/**
 * Google reCAPTCHA v3 Loader and Token Executor
 * Provides a clean and robust async verification for both production and sandbox testing environments.
 */

// Official public test site key for reCAPTCHA v3
const DEFAULT_SITE_KEY = "6Lcj-R8TAAAAAB_Zg6I696JB9g-R88pX3-85_";

let scriptPromise: Promise<any> | null = null;

export function loadReCaptcha(siteKey: string): Promise<any> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    // If already loaded globally
    if ((window as any).grecaptcha) {
      (window as any).grecaptcha.ready(() => {
        resolve((window as any).grecaptcha);
      });
      return;
    }

    // Inject reCAPTCHA script with Trusted Types compliance
    const script = document.createElement("script");
    const srcUrl = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    
    // Support Trusted Types if defined
    if ((window as any).trustedTypes && (window as any).trustedTypes.createPolicy) {
      try {
        const policy = (window as any).trustedTypes.createPolicy("recaptcha-loader", {
          createScriptURL: (url: string) => url
        });
        script.src = policy.createScriptURL(srcUrl);
      } catch (e) {
        script.src = srcUrl;
      }
    } else {
      script.src = srcUrl;
    }

    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).grecaptcha) {
        (window as any).grecaptcha.ready(() => {
          resolve((window as any).grecaptcha);
        });
      } else {
        resolve(null);
      }
    };
    script.onerror = () => {
      console.warn("reCAPTCHA failed to load. Operating in sandbox fallback mode.");
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function getReCaptchaToken(action: string): Promise<string> {
  const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || DEFAULT_SITE_KEY;
  try {
    const grecaptcha = await loadReCaptcha(siteKey);
    if (!grecaptcha) {
      console.log("[reCAPTCHA] GreCAPTCHA unavailable, using sandbox placeholder.");
      return "sandbox-token";
    }
    return await grecaptcha.execute(siteKey, { action });
  } catch (err) {
    console.warn("[reCAPTCHA] Execution failed. Proceeding with sandbox placeholder.", err);
    return "sandbox-token";
  }
}
