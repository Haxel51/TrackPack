import React, { useState } from 'react';
import { Waybill } from '../types';
import { formatTimestamp } from '../lib/helpers';
import { Badge, Button } from './ui';
import { Package, ArrowLeft, ArrowRight, Share2, Printer, Phone, ShieldCheck, CheckCircle2, Clock, Truck, Copy, Check, MapPin, FileText, X } from 'lucide-react';

interface DigitalWaybillReceiptProps {
  waybill: Waybill;
  onClose?: () => void;
}

export function DigitalWaybillReceipt({ waybill, onClose }: DigitalWaybillReceiptProps) {
  const [copied, setCopied] = useState(false);

  const trackingUrl = `${window.location.origin}/track/${waybill.trackingCode}`;

  const shareText = `*TrackPack Digital Waybill*\nTracking Code: *${waybill.trackingCode}*\nReceiver Phone: *${waybill.receiverPhone}*\nItem: ${waybill.itemDescription}\nRoute: ${waybill.originPark} ➔ ${waybill.destinationPark}\nStatus: ${waybill.status}\n\nTrack real-time here: ${trackingUrl}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden max-w-xl mx-auto print:shadow-none print:border-none">
      {/* Official Top Bar with Close/Back Button */}
      <div className="bg-navy text-white px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1 text-xs font-bold mr-1 print:hidden"
              title="Close receipt and return"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-amber flex items-center justify-center text-navy font-black text-lg">
            T
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight text-white">TrackPack Official Receipt</h3>
            <p className="text-[11px] text-gray-300">Digital Paperless Waybill System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge status={waybill.status}>{waybill.status === 'Departed' ? 'In Transit' : waybill.status}</Badge>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition print:hidden"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Tracking Code & Pickup Code Spotlight */}
        <div className="bg-bg-light p-4 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          <div className="bg-white p-3.5 rounded-lg border border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Waybill Tracking ID</p>
            <p className="text-2xl font-mono font-extrabold text-navy tracking-wider">{waybill.trackingCode}</p>
          </div>

          <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">Receiver Phone (Pickup ID)</p>
            <p className="text-xl font-mono font-extrabold text-emerald-700 tracking-wider">{waybill.receiverPhone}</p>
          </div>
        </div>

        {/* Visual Barcode & QR Code Seal for Terminal Scanning */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-white p-1.5 rounded-lg border border-gray-200 flex flex-col items-center justify-center">
              {/* Simulated QR Code matrix for clean aesthetics */}
              <div className="w-full h-full bg-navy/90 rounded-sm p-1 grid grid-cols-4 gap-0.5">
                <div className="bg-white rounded-xs"></div>
                <div className="bg-amber rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
                <div className="bg-amber rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
                <div className="bg-amber rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
                <div className="bg-white rounded-xs"></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-navy flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Receiver Pickup Pass
              </p>
              <p className="text-[11px] text-gray-600">Provide receiver phone number to park officers to collect item.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-gray-400 bg-white px-2.5 py-1 rounded border border-gray-200">
            VERIFIED PHONE: {waybill.receiverPhone}
          </span>
        </div>

        {/* Sender & Receiver Parties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600" /> SENDER (ORIGIN)
            </p>
            <p className="font-bold text-navy text-base">{waybill.senderName}</p>
            <p className="text-gray-700 font-mono text-xs">{waybill.senderPhone}</p>
            <p className="text-xs font-semibold text-gray-600 bg-bg-light px-2 py-1 rounded inline-block mt-1">
              Park: {waybill.originPark}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber" /> RECEIVER (DESTINATION)
            </p>
            <p className="font-bold text-navy text-base">{waybill.receiverName}</p>
            <p className="text-gray-700 font-mono text-xs">{waybill.receiverPhone}</p>
            <p className="text-xs font-semibold text-gray-600 bg-bg-light px-2 py-1 rounded inline-block mt-1">
              Park: {waybill.destinationPark}
            </p>
          </div>
        </div>

        {/* Manifest & Fee Breakdown Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-bg-light px-4 py-2 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Package Manifest</span>
            <span>Fee Details</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-navy text-sm">{waybill.itemDescription}</p>
                <p className="text-xs text-gray-500">1 Parcel/Package • Bus: {waybill.busNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-navy text-sm">₦200.00</p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Paid Digital Receipt
                </span>
              </div>
            </div>

            {waybill.companyName && (
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                Transport Line: <strong className="text-navy">{waybill.companyName}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Assigned Vehicle & Driver Info */}
        {waybill.driverPhone && (
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Vehicle Driver Information</p>
              <p className="font-bold text-navy text-sm mt-0.5">{waybill.driverName || 'Assigned Driver'}</p>
              <p className="text-xs text-blue-800 font-mono">{waybill.driverPhone}</p>
            </div>
            <a
              href={`tel:${waybill.driverPhone}`}
              className="bg-navy hover:bg-navy-hover text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Phone className="w-3.5 h-3.5" /> Call Driver
            </a>
          </div>
        )}

        {/* Lifecycle Audit Timestamps */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
          <p className="font-bold text-navy uppercase text-[10px] tracking-wider mb-2">Audit Timestamps</p>
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            <div>Booked: <strong className="text-navy">{formatTimestamp(waybill.createdTimestamp)}</strong></div>
            <div>Departed: <strong className="text-navy">{waybill.departedTimestamp ? formatTimestamp(waybill.departedTimestamp) : 'Pending'}</strong></div>
            <div>Arrived Park: <strong className="text-navy">{waybill.arrivedTimestamp ? formatTimestamp(waybill.arrivedTimestamp) : 'In Transit'}</strong></div>
            <div>Collected: <strong className="text-navy">{waybill.collectedTimestamp ? formatTimestamp(waybill.collectedTimestamp) : 'Awaiting Collection'}</strong></div>
          </div>
        </div>

        {/* Print / Share Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 print:hidden">
          {onClose && (
            <Button
              variant="secondary"
              onClick={onClose}
              className="py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" /> Close
            </Button>
          )}

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Share2 className="w-4 h-4" /> Share Receipt on WhatsApp
          </a>

          <Button
            variant="secondary"
            onClick={handleCopyLink}
            className="flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Link Copied!' : 'Copy Receipt Link'}
          </Button>

          <Button
            variant="secondary"
            onClick={handlePrint}
            className="py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
