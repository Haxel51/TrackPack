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

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waybilla_receipt_${trackingCode.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

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

    const fileName = `waybilla_receipt_${trackingCode.replace(/\s+/g, '_')}.png`;
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

