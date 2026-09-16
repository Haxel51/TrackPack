import * as htmlToImage from 'html-to-image';

/**
 * Renders an HTML element as a high-quality PNG image and triggers a browser download.
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

    const fileName = `waybilla_receipt_${(trackingCode || 'receipt').replace(/\s+/g, '_')}.png`;

    // 1. Mobile PWA / Standalone App / Native Share Detection
    // In installed PWA or WebView, <a download> often fails silently.
    // Try native share sheet with file so user can "Save image", "Save to Files", or send it directly.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Waybilla Receipt - ${trackingCode}`,
          text: `Receipt for Waybill #${trackingCode}`,
        });
        return blob;
      } catch (shareErr) {
        // If user cancelled, return blob without error
        if ((shareErr as Error)?.name === 'AbortError') {
          return blob;
        }
        console.log('Native share failed, proceeding with fallback download:', shareErr);
      }
    }

    // 2. Standard Browser Trigger using Blob URL & Anchor
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);

    // 3. If in standalone/PWA mode and standard link might not trigger download,
    // also provide data URL backup in case blob was ignored
    if (isStandalone && !navigator.canShare) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const backupLink = document.createElement('a');
        backupLink.href = base64data;
        backupLink.download = fileName;
        backupLink.target = '_blank';
        document.body.appendChild(backupLink);
        backupLink.click();
        setTimeout(() => document.body.removeChild(backupLink), 200);
      };
      reader.readAsDataURL(blob);
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

