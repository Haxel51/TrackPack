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
 * Renders an HTML element into a crisp PNG Data URL.
 * Combines html-to-image with an automatic html2canvas fallback to ensure 100% reliability
 * across all mobile browsers, TWAs, and Android Custom Tabs.
 */
export async function generateReceiptDataUrl(element: HTMLElement): Promise<string | null> {
  // 1. Primary: html-to-image
  try {
    const dataUrl = await htmlToImage.toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2, // Retina resolution
      cacheBust: true,
      skipFonts: false,
    });
    if (dataUrl && dataUrl.length > 100) {
      return dataUrl;
    }
  } catch (err) {
    console.warn('html-to-image failed, falling back to html2canvas:', err);
  }

  // 2. Fallback: html2canvas
  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });
    const canvasDataUrl = canvas.toDataURL('image/png');
    if (canvasDataUrl && canvasDataUrl.length > 100) {
      return canvasDataUrl;
    }
  } catch (canvasErr) {
    console.error('html2canvas fallback failed as well:', canvasErr);
  }

  return null;
}

/**
 * NATIVE PRINT: Triggers window.print() targeting only the isolated receipt element.
 * Works natively in Chrome Custom Tabs (TWA) and Android, opening the system Print Spooler / Save as PDF dialog.
 */
export function printReceipt(elementId: string): boolean {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Receipt element with ID "${elementId}" not found for printing.`);
    return false;
  }

  try {
    // Get or create print container
    let printContainer = document.getElementById('waybilla-print-container');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'waybilla-print-container';
      document.body.appendChild(printContainer);
    }

    // Clone element into the isolated print container
    printContainer.innerHTML = '';
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = '100%';
    clone.style.maxWidth = '460px';
    clone.style.margin = '0 auto';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    printContainer.appendChild(clone);

    // Short timeout to allow layout to settle before opening native Android print sheet
    setTimeout(() => {
      window.print();
    }, 150);

    return true;
  } catch (err) {
    console.error('Print trigger failed:', err);
    window.print();
    return false;
  }
}

/**
 * Registers the rendered base64 image on the server to get a real HTTPS download URL.
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
 * PDF EXPORT: Generates an official vector/image PDF receipt using jsPDF.
 * Seamlessly saves to phone or desktop storage.
 */
export async function downloadReceiptPdf(elementId: string, trackingCode: string): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;

  try {
    const dataUrl = await generateReceiptDataUrl(element);
    if (!dataUrl) {
      throw new Error('Failed to render receipt image for PDF conversion');
    }

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgProps = pdf.getImageProperties(dataUrl);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    
    // Fit within margins
    const margin = 15;
    const contentWidth = pdfWidth - (margin * 2);
    const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

    pdf.addImage(dataUrl, 'PNG', margin, margin, contentWidth, contentHeight);
    const safeCode = (trackingCode || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `waybilla_receipt_${safeCode}.pdf`;
    
    pdf.save(fileName);
    return true;
  } catch (err) {
    console.error('PDF export error:', err);
    return false;
  }
}

/**
 * Displays a clean in-app modal allowing the user to download, print, share, or view the receipt.
 * Optimized specifically for TWA and mobile apps: NO popup blockers, NO window replacements!
 */
function showInAppReceiptDialog(
  imageDataUrl: string,
  downloadUrl: string,
  fileName: string,
  trackingCode: string,
  elementId: string
) {
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
    <div style="max-width: 440px; width: 100%; margin: auto; display: flex; flex-direction: column; align-items: center; gap: 12px;">
      <!-- Header bar with title and close button -->
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
        <span style="color: #F2A93B; font-weight: 900; font-size: 15px; letter-spacing: 0.5px;">
          RECEIPT #${trackingCode}
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
      <div style="width: 100%; display: flex; flex-direction: column; gap: 9px; margin-top: 4px;">
        <!-- Print / Save as PDF button -->
        <button id="btn-print-receipt-action" style="background: #0A1F44; color: #ffffff; border: 1.5px solid #F2A93B; border-radius: 14px; padding: 13px 18px; font-size: 14px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          🖨️ Print Receipt / Save as PDF
        </button>

        <!-- Save Image (PNG) directly to device -->
        <button id="btn-download-receipt-device" style="background: #F2A93B; color: #0A1F44; border: none; border-radius: 14px; padding: 13px 18px; font-size: 14px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(242,169,59,0.4);">
          ⬇️ Save Image (PNG) to Downloads
        </button>

        <!-- Share on WhatsApp -->
        <button id="btn-share-receipt-whatsapp" style="background: #25D366; color: #ffffff; border: none; border-radius: 14px; padding: 12px 18px; font-size: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          💬 Share via WhatsApp
        </button>

        <!-- Dismiss button -->
        <button id="btn-dismiss-overlay" style="background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.2); border-radius: 14px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer;">
          Back to Dashboard
        </button>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 4px 0 12px;">
        Tip: Press & hold the image to save directly to your phone's photo gallery.
      </p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const close = () => overlay.remove();
  overlay.querySelector('#btn-close-receipt-overlay')?.addEventListener('click', close);
  overlay.querySelector('#btn-dismiss-overlay')?.addEventListener('click', close);

  // Print handler
  overlay.querySelector('#btn-print-receipt-action')?.addEventListener('click', () => {
    printReceipt(elementId);
  });

  // Direct device download handler
  overlay.querySelector('#btn-download-receipt-device')?.addEventListener('click', () => {
    const btn = overlay.querySelector('#btn-download-receipt-device') as HTMLButtonElement;
    if (btn) {
      btn.innerHTML = '⏳ Downloading...';
    }

    // 1. Direct anchor download (without target="_blank" so Chrome Custom Tabs / TWA doesn't block it)
    try {
      const link = document.createElement('a');
      link.href = fullDownloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 400);
    } catch (e) {
      console.warn('Anchor click error:', e);
    }

    // 2. Direct location assign to trigger native attachment download in Chrome Custom Tabs / TWA
    try {
      window.location.assign(fullDownloadUrl);
    } catch (e) {
      console.warn('Location assign error:', e);
    }

    setTimeout(() => {
      if (btn) {
        btn.innerHTML = '✅ Saved! Check Downloads';
        setTimeout(() => {
          btn.innerHTML = '⬇️ Save Image (PNG) to Downloads';
        }, 3000);
      }
    }, 1200);
  });

  // WhatsApp share
  overlay.querySelector('#btn-share-receipt-whatsapp')?.addEventListener('click', () => {
    const text = encodeURIComponent(
      `🧾 Official Waybilla Digital Receipt\nWaybill Ref: ${trackingCode}\nVerify & Track at: ${window.location.origin}/?track=${encodeURIComponent(trackingCode)}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  });
}

/**
 * Main function to download the receipt as an image.
 * Works seamlessly across desktop browsers, mobile browsers, and installed TWA / WebViews.
 */
export async function downloadReceiptImage(elementId: string, trackingCode: string): Promise<Blob | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID "${elementId}" not found for receipt download.`);
    return null;
  }

  try {
    // 1. Generate image using resilient double-engine (html-to-image + html2canvas fallback)
    const dataUrl = await generateReceiptDataUrl(element);
    if (!dataUrl) {
      alert('Could not render receipt image. Please try the "Print Receipt" option.');
      return null;
    }

    // Convert data URL to Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const safeCode = (trackingCode || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `waybilla_receipt_${safeCode}.png`;
    const isApp = isMobileAppEnvironment();

    // 2. Register on server for real HTTPS download URL
    const serverDownloadUrl = await registerServerDownload(dataUrl, fileName, trackingCode);
    const fullDownloadUrl = serverDownloadUrl 
      ? (serverDownloadUrl.startsWith('http') ? serverDownloadUrl : `${window.location.origin}${serverDownloadUrl}`)
      : dataUrl;

    // 3. Native Capacitor APK check
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
            console.log('Native Capacitor Share skipped or cancelled:', shareErr);
          }
        }
      } catch (nativeErr) {
        console.warn('Native Capacitor filesystem plugin error:', nativeErr);
      }
    }

    // 4. Web Share API with File (Supported in Android Chrome & Safari mobile)
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Waybilla Receipt #${trackingCode}`,
          text: `Official Waybilla Digital Receipt #${trackingCode}`,
        });
        return blob;
      } catch (shareErr) {
        if ((shareErr as Error)?.name === 'AbortError') {
          return blob;
        }
        console.log('Web share aborted or unhandled, proceeding to download:', shareErr);
      }
    }

    // 5. Standard Download Trigger
    // Important: Do NOT use target="_blank" so Chrome Custom Tabs (TWA) does not trigger popup blocking!
    try {
      const link = document.createElement('a');
      link.href = fullDownloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 400);
    } catch (clickErr) {
      console.warn('Download link click error:', clickErr);
    }

    // 6. If in mobile / TWA app environment, also present the dialog
    if (isApp) {
      showInAppReceiptDialog(dataUrl, fullDownloadUrl, fileName, trackingCode, elementId);
    }

    return blob;
  } catch (error) {
    console.error('Error in downloadReceiptImage:', error);
    return null;
  }
}

/**
 * Shares the receipt image directly via Web Share API if supported, or downloads it and opens WhatsApp.
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
    const dataUrl = await generateReceiptDataUrl(element);
    if (!dataUrl) {
      return { success: false, method: 'failed' };
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const safeCode = (trackingCode || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `waybilla_receipt_${safeCode}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Try Web Share API
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

    // Register on server for download
    const serverDownloadUrl = await registerServerDownload(dataUrl, fileName, trackingCode);
    const fullDownloadUrl = serverDownloadUrl
      ? (serverDownloadUrl.startsWith('http') ? serverDownloadUrl : `${window.location.origin}${serverDownloadUrl}`)
      : dataUrl;

    // Trigger download
    const link = document.createElement('a');
    link.href = fullDownloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 400);

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
