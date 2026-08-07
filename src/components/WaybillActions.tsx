import React, { useState } from 'react';
import { Copy, Check, Share2, Send } from 'lucide-react';

interface WaybillActionsProps {
  trackingCode: string;
  itemDescription?: string;
  originPark?: string;
  destinationPark?: string;
  status?: string;
}

export const WaybillActions: React.FC<WaybillActionsProps> = ({
  trackingCode,
  itemDescription = 'Waybill Parcel',
  originPark = '',
  destinationPark = '',
  status = 'booked'
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `📦 Waybill Tracking Code: *${trackingCode}*\nItem: ${itemDescription}\nRoute: ${originPark} ➔ ${destinationPark}\nStatus: ${status.toUpperCase()}\nTrack instantly on Waybilla: ${window.location.origin}/?track=${trackingCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Waybill ${trackingCode}`,
          text: shareText,
          url: `${window.location.origin}/?track=${trackingCode}`
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    navigator.clipboard.writeText(shareText);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleWhatsAppSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    const message = encodeURIComponent(
      `Hello! Please track my interstate waybill on Waybilla.\n\n📦 Code: *${trackingCode}*\n📝 Item: ${itemDescription}\n🚌 Route: ${originPark} to ${destinationPark}\n📍 Status: ${status.toUpperCase()}\n\nTrack here: ${window.location.origin}/?track=${trackingCode}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border-0 shadow-xs"
        title="Copy Tracking Code"
        aria-label="Copy Tracking Code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
        <span>{copied ? 'Copied!' : trackingCode}</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border-0 shadow-xs"
        title="Share Waybill"
        aria-label="Share Waybill"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>{shared ? 'Shared!' : 'Share'}</span>
      </button>

      <button
        type="button"
        onClick={handleWhatsAppSend}
        className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border-0 shadow-xs"
        title="Send via WhatsApp"
        aria-label="Send via WhatsApp"
      >
        <Send className="w-3.5 h-3.5" />
        <span>WhatsApp</span>
      </button>
    </div>
  );
};
