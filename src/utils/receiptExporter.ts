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
    (window as any).AndroidBridge !== undefined
  );
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
    // Render the element using html-to-image with retina scaling (pixelRatio: 2)
    const blob = await htmlToImage.toBlob(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2, // High resolution
      cacheBust: true,
    });

    if (!blob) {
      console.error('Failed to generate image Blob.');
      return null;
    }

    const safeCode = (trackingCode || 'receipt').replace(/\s+/g, '_');
    const fileName = `waybilla_receipt_${safeCode}.png`;
    const isApp = isMobileAppEnvironment();

    // Check if an Android Bridge exists for direct native storage save
    if ((window as any).AndroidBridge) {
      const bridge = (window as any).AndroidBridge;
      if (typeof bridge.saveBase64Image === 'function' || typeof bridge.downloadFile === 'function') {
        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64 = reader.result as string;
            if (typeof bridge.saveBase64Image === 'function') {
              bridge.saveBase64Image(fileName, base64);
            } else if (typeof bridge.downloadFile === 'function') {
              bridge.downloadFile(fileName, base64);
            }
          };
          return blob;
        } catch (bridgeErr) {
          console.warn('AndroidBridge save failed, trying web standard share/download:', bridgeErr);
        }
      }
    }

    // 1. In Mobile TWA / WebView / Standalone:
    // Standard <a download> is suppressed by Android WebViews unless custom download listeners are wired.
    // Web Share API with File object is the most reliable native mechanism in modern Android/TWA
    // allowing users to directly tap "Save to device / Downloads", "WhatsApp", or "Gallery".
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
        // If user cancelled, return blob without throwing error
        if ((shareErr as Error)?.name === 'AbortError') {
          return blob;
        }
        console.log('Native share failed or unhandled, proceeding with fallback download:', shareErr);
      }
    }

    // 2. Standard Blob Download Trigger via <a> download
    let downloadSucceeded = false;
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      downloadSucceeded = true;

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (clickErr) {
      console.warn('Anchor blob click failed:', clickErr);
    }

    // 3. Robust TWA / Android WebView Fallback:
    // If running in TWA/WebView where blob URL downloads are blocked by Chromium WebView security,
    // open the generated receipt image in a new tab/window so the user can easily long-press or tap "Download image"
    if (isApp) {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Open formatted popup or direct data view
          const newWindow = window.open();
          if (newWindow) {
            newWindow.document.write(
              `<!DOCTYPE html><html><head><title>Receipt #${trackingCode}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;display:flex;flex-direction:column;align-items:center;background:#0A1F44;color:#fff;font-family:sans-serif;padding:20px;box-sizing:border-box;}img{max-width:100%;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.5);margin-bottom:16px;}p{font-size:14px;color:#F2A93B;font-weight:bold;margin:0 0 12px;text-align:center;}.btn{background:#F2A93B;color:#0A1F44;font-weight:bold;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block;font-size:14px;}</style></head><body><p>Long press receipt image below to Save or Share 🧾</p><img src="${base64data}" alt="Waybill Receipt" /><br/><a href="${base64data}" download="${fileName}" class="btn">Save Receipt Image</a></body></html>`
            );
            newWindow.document.close();
          } else {
            // If popup blocked, create data-url download link
            const backupLink = document.createElement('a');
            backupLink.href = base64data;
            backupLink.download = fileName;
            backupLink.target = '_blank';
            document.body.appendChild(backupLink);
            backupLink.click();
            setTimeout(() => document.body.removeChild(backupLink), 300);
          }
        };
        reader.readAsDataURL(blob);
      } catch (dataUrlErr) {
        console.warn('DataURL fallback error:', dataUrlErr);
      }
    }

    return blob;
  } catch (error) {
    console.error('Error rendering receipt image:', error);
    return null;
  }
}

/**
 * Shares the receipt image directly via Web Share API if supported, or downloads it and provides guidance for WhatsApp.
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
    // Generate the blob using html-to-image
    const blob = await htmlToImage.toBlob(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
    });

    if (!blob) {
      return { success: false, method: 'failed' };
    }

    const fileName = `waybilla_receipt_${(trackingCode || 'receipt').replace(/\s+/g, '_')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Check if Web Share API with files is supported (e.g. mobile Safari/Chrome)
    const canShareNative = navigator.canShare && navigator.canShare({ files: [file] });

    if (canShareNative) {
      try {
        await navigator.share({
          files: [file],
          title: `Waybilla Waybill Receipt - ${trackingCode}`,
          text: whatsappMessage || `Official Waybilla Transaction Receipt for Waybill Ref: ${trackingCode}`,
        });
        return { success: true, method: 'native' };
      } catch (shareError) {
        // User cancelled or other share failure, fallback to download
        console.log('Native share failed or cancelled, falling back to download:', shareError);
      }
    }

    // Fallback: Download the receipt image and open WhatsApp
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Open WhatsApp link so they can easily attach the downloaded image
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

