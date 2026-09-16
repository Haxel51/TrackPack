import * as htmlToImage from 'html-to-image';

/**
 * Checks if the user is running in a mobile app / TWA / WebView / standalone PWA environment.
 */
export function isMobileAppEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://') ||
    /wv/.test(navigator.userAgent) ||
    /Android.*Version\/[0-9.]+/i.test(navigator.userAgent) ||
    /Waybilla-Android-Native/i.test(navigator.userAgent) ||
    (window as any).AndroidBridge !== undefined ||
    (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.())
  );
}

/**
 * Registers the generated base64 image on the server to get a real HTTPS download URL.
 * Real HTTPS URLs bypass Chromium/Android WebView restrictions that block data: and blob: downloads.
 */
async function registerServerDownload(
  base64Data: string,
  fileName: string,
  trackingCode: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/receipts/prepare-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data,
        fileName,
        trackingCode
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.downloadUrl || null;
  } catch (err) {
    console.warn('Failed to register receipt on server:', err);
    return null;
  }
}

/**
 * Displays a clean in-app modal allowing the user to download, share, or view the receipt.
 * Never traps the user or replaces the window!
 */
function showInAppReceiptDialog(
  imageDataUrl: string,
  downloadUrl: string,
  fileName: string,
  trackingCode: string
) {
  // Remove existing dialog if any
  const existing = document.getElementById('waybilla-receipt-inapp-dialog');
  if (existing) existing.remove();

  const fullDownloadUrl = downloadUrl.startsWith('http')
    ? downloadUrl
    : `${window.location.origin}${downloadUrl}`;

  const overlay = document.createElement('div');
  overlay.id = 'waybilla-receipt-inapp-dialog';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(10, 31, 68, 0.95);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    overflow-y: auto;
    padding: 16px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="max-width: 440px; width: 100%; margin: auto; display: flex; flex-direction: column; align-items: center; gap: 14px;">
      <!-- Header bar with title and close button -->
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
        <span style="color: #F2A93B; font-weight: 900; font-size: 15px; letter-spacing: 0.5px;">
          WAYBILLA RECEIPT #${trackingCode}
        </span>
        <button id="btn-close-receipt-overlay" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 34px; height: 34px; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ✕
        </button>
      </div>

      <!-- Receipt image preview -->
      <div style="width: 100%; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.5);">
        <img id="waybilla-receipt-img" src="${imageDataUrl}" alt="Waybill Receipt" style="width: 100%; display: block; height: auto; -webkit-touch-callout: default !important; -webkit-user-select: auto !important; user-select: auto !important;" />
      </div>

      <!-- Action Buttons -->
      <div style="width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
        <button id="btn-download-receipt-device" style="background: #F2A93B; color: #0A1F44; border: none; border-radius: 14px; padding: 15px 20px; font-size: 15px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(242,169,59,0.4); text-transform: uppercase; letter-spacing: 0.5px;">
          ⬇️ Save Image to Phone / Downloads
        </button>

        <button id="btn-share-receipt-whatsapp" style="background: #25D366; color: #ffffff; border: none; border-radius: 14px; padding: 13px 20px; font-size: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          💬 Share on WhatsApp
        </button>

        <button id="btn-dismiss-overlay" style="background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.2); border-radius: 14px; padding: 11px 20px; font-size: 13px; font-weight: 700; cursor: pointer;">
          Back to Dashboard
        </button>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 4px 0 16px;">
        Tip: You can also press and hold the image to save directly to your gallery.
      </p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const close = () => overlay.remove();
  overlay.querySelector('#btn-close-receipt-overlay')?.addEventListener('click', close);
  overlay.querySelector('#btn-dismiss-overlay')?.addEventListener('click', close);

  // Direct device save handler using the real server HTTPS download URL
  overlay.querySelector('#btn-download-receipt-device')?.addEventListener('click', () => {
    const btn = overlay.querySelector('#btn-download-receipt-device') as HTMLButtonElement;
    if (btn) {
      btn.innerHTML = '⏳ Downloading Receipt...';
      btn.style.opacity = '0.8';
    }

    // 1. Trigger system browser / Android DownloadManager
    try {
      window.open(fullDownloadUrl, '_system');
    } catch (e) {
      console.warn('System browser open error:', e);
    }

    // 2. Also trigger standard anchor download
    try {
      const link = document.createElement('a');
      link.href = fullDownloadUrl;
      link.setAttribute('download', fileName);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 500);
    } catch (e) {
      console.warn('Anchor download error:', e);
    }

    setTimeout(() => {
      if (btn) {
        btn.innerHTML = '✅ Saved! Check Downloads';
        setTimeout(() => {
          btn.innerHTML = '⬇️ Save Image to Phone / Downloads';
          btn.style.opacity = '1';
        }, 3000);
      }
    }, 1200);
  });

  // WhatsApp share handler
  overlay.querySelector('#btn-share-receipt-whatsapp')?.addEventListener('click', () => {
    const text = encodeURIComponent(
      `🧾 Official Waybilla Digital Receipt\nWaybill Ref: ${trackingCode}\nVerify & Track at: ${window.location.origin}/?track=${encodeURIComponent(trackingCode)}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  });
}

/**
 * Renders an HTML element as a high-quality PNG image and triggers a reliable download/share.
 * Works seamlessly across desktop browsers, mobile browsers, and installed TWA / WebViews.
 * @param elementId - The ID of the HTML element to render.
 * @param trackingCode - The waybill tracking code (used for the filename).
 * @returns A promise that resolves to the image Blob, or null if it fails.
 */
export async function downloadReceiptImage(elementId: string, trackingCode: string): Promise<Blob | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID "${elementId}" not found for receipt download.`);
    return null;
  }

  try {
    // 1. Generate high-resolution PNG data URL using html-to-image
    const dataUrl = await htmlToImage.toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2, // Crisp retina quality
      cacheBust: true,
    });

    if (!dataUrl) {
      console.error('Failed to generate image data URL.');
      return null;
    }

    // Convert data URL to Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const safeCode = (trackingCode || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `waybilla_receipt_${safeCode}.png`;
    const isApp = isMobileAppEnvironment();

    // 2. Register with backend to get a real HTTPS download URL
    // Real HTTPS URLs trigger the device's native DownloadManager and bypass data: URL blocks in WebViews
    const serverDownloadUrl = await registerServerDownload(dataUrl, fileName, trackingCode);
    const fullDownloadUrl = serverDownloadUrl 
      ? (serverDownloadUrl.startsWith('http') ? serverDownloadUrl : `${window.location.origin}${serverDownloadUrl}`)
      : dataUrl;

    // 3. If in Capacitor native app, attempt native file write and share
    if (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const cleanBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: cleanBase64,
          directory: Directory.Cache
        });

        if (fileResult?.uri) {
          try {
            const { Share } = await import('@capacitor/share');
            await Share.share({
              title: `Waybilla Receipt #${trackingCode}`,
              text: `Waybill Receipt #${trackingCode}`,
              url: fileResult.uri,
              dialogTitle: 'Save or Share Receipt'
            });
            return blob;
          } catch (shareErr) {
            console.log('Native Capacitor Share skipped or cancelled, showing receipt viewer:', shareErr);
          }
        }
      } catch (nativeErr) {
        console.warn('Native Capacitor filesystem plugin error:', nativeErr);
      }
    }

    // 4. Try native Web Share API with file (works on Android Chrome and Safari mobile)
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Waybilla Receipt #${trackingCode}`,
          text: `Waybill Receipt #${trackingCode}`,
        });
        return blob;
      } catch (shareErr) {
        if ((shareErr as Error)?.name === 'AbortError') {
          return blob;
        }
        console.log('Web share aborted or unhandled, proceeding to download:', shareErr);
      }
    }

    // 5. Standard desktop/browser download trigger via real download link
    try {
      const link = document.createElement('a');
      link.href = fullDownloadUrl;
      link.setAttribute('download', fileName);
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 500);
    } catch (clickErr) {
      console.warn('Download link click error:', clickErr);
    }

    // 6. In mobile / app environments, also present the in-app receipt dialog
    // This guarantees the user has immediate access to "Save Image", "Share on WhatsApp", and "Close"
    if (isApp) {
      showInAppReceiptDialog(dataUrl, serverDownloadUrl || fullDownloadUrl, fileName, trackingCode);
    }

    return blob;
  } catch (error) {
    console.error('Error rendering receipt image:', error);
    return null;
  }
}

/**
 * Shares the receipt image directly via Web Share API if supported, or downloads it and opens WhatsApp.
 * @param elementId - The ID of the HTML element to share.
 * @param trackingCode - The waybill tracking code.
 * @param recipientPhone - Optional phone number to pre-fill on WhatsApp.
 * @returns A promise resolving to the status of the action.
 */
export async function shareReceiptImage(
  elementId: string,
  trackingCode: string,
  recipientPhone?: string,
  whatsappMessage?: string
): Promise<{ success: boolean; method: 'native' | 'download_fallback' | 'failed' }> {
  const element = document.getElementById(elementId);
  if (!element) {
    return { success: false, method: 'failed' };
  }

  try {
    const dataUrl = await htmlToImage.toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
    });

    if (!dataUrl) {
      return { success: false, method: 'failed' };
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const safeCode = (trackingCode || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `waybilla_receipt_${safeCode}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Check if Web Share API with files is supported
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Waybilla Waybill Receipt - ${trackingCode}`,
          text: whatsappMessage || `Official Waybilla Transaction Receipt for Waybill Ref: ${trackingCode}`,
        });
        return { success: true, method: 'native' };
      } catch (shareError) {
        console.log('Native share failed or cancelled, falling back to download:', shareError);
      }
    }

    // Register on server for real download
    const serverDownloadUrl = await registerServerDownload(dataUrl, fileName, trackingCode);
    const fullDownloadUrl = serverDownloadUrl
      ? (serverDownloadUrl.startsWith('http') ? serverDownloadUrl : `${window.location.origin}${serverDownloadUrl}`)
      : dataUrl;

    // Trigger download
    const link = document.createElement('a');
    link.href = fullDownloadUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 500);

    // Open WhatsApp link
    const cleanPhone = recipientPhone ? recipientPhone.replace(/\D/g, '') : '';
    const textParam = whatsappMessage ? `?text=${encodeURIComponent(whatsappMessage)}` : '';
    const whatsappUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}${textParam}`
      : `https://wa.me/${textParam}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    return { success: true, method: 'download_fallback' };
  } catch (error) {
    console.error('Error sharing receipt image:', error);
    return { success: false, method: 'failed' };
  }
}
