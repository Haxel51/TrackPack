import React, { useState } from 'react';
import { Logo } from './Logo';
import { 
  Sparkles, 
  X, 
  Camera, 
  Handshake, 
  ShieldCheck, 
  TrendingUp, 
  Smartphone, 
  CheckCircle2, 
  Phone, 
  Copy, 
  Check, 
  Truck, 
  Bus, 
  Wrench,
  ChevronRight
} from 'lucide-react';
import partnerFleetImage from '../assets/images/waybilla_partnership_hub_1790230104120.jpg';

interface TransporterPartnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransporterPartnershipModal: React.FC<TransporterPartnershipModalProps> = ({ isOpen, onClose }) => {
  const [cleanMode, setCleanMode] = useState<boolean>(false);
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyPitch = () => {
    const pitchText = `🚛 PARTNER WITH WAYBILLA (NIGERIA'S #1 DIGITAL WAYBILL NETWORK) 🇳🇬\n\nAre you a Transport Company, Motor Park, Spare Parts Truck Hub, or Fleet Owner?\n\nJoin Goodness & Mercy, Winners Transport, Orizu Motors, Auto Spare Parts Truck parks (like Nwanyi Imo, Ladipo, Nnewi, Onitsha) and nationwide transporters on Waybilla!\n\n⭐ WHY PARTNER WITH US:\n✅ 100% Free Digital Manifest on your phone (No more paper books)\n✅ Zero lost spare parts or cargo disputes with QR & OTP security\n✅ Real-time park cashier & trip revenue accounting\n✅ Receive pre-booked parcels directly from merchants nationwide\n\n📲 Call / WhatsApp: 08143778304\n🌐 Register online: https://waybilla.com.ng\n\nStart in 3 minutes with zero setup fees!`;
    navigator.clipboard.writeText(pitchText);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-md overflow-y-auto flex flex-col items-center justify-center p-2 sm:p-4 select-text animate-fadeIn">
      
      {/* Outer Action Toolbar (Hidden in Screenshot Mode) */}
      {!cleanMode && (
        <div className="w-full max-w-[440px] bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2.5 mb-2 shadow-2xl flex items-center justify-between text-white text-xs font-bold">
          <div className="flex items-center gap-1.5 pl-1">
            <Handshake className="w-4 h-4 text-[#F7941D]" />
            <span className="text-[#F7941D] font-black tracking-tight">Fleet Partnership Flyer</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyPitch}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-slate-600"
              title="Copy WhatsApp invitation text"
            >
              {copiedPitch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span>{copiedPitch ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCleanMode(true)}
              className="px-3 py-1.5 bg-[#F7941D] hover:bg-amber-500 text-slate-950 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-slate-950" />
              <span>Screenshot</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-400 rounded-xl flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Exit Button in Screenshot Mode */}
      {cleanMode && (
        <div className="fixed top-3 right-3 z-50 animate-bounce">
          <button
            type="button"
            onClick={() => setCleanMode(false)}
            className="bg-[#F7941D] text-slate-950 font-black px-4 py-2 rounded-full text-xs shadow-2xl flex items-center gap-1.5 cursor-pointer border-2 border-white/40"
          >
            <X className="w-4 h-4" />
            <span>Exit Screenshot Mode</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PREMIUM HIGH-IMPACT PARTNERSHIP FLYER                                      */}
      {/* ========================================================================= */}
      <div 
        id="waybilla-partnership-poster"
        className="w-full max-w-[440px] bg-white text-slate-900 rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95)] border-2 border-[#F7941D] flex flex-col justify-between"
      >
        
        {/* 1. TOP BRAND HEADER */}
        <div className="bg-[#0A1F44] px-4 py-3 border-b-2 border-[#F7941D] flex items-center justify-between text-white">
          <Logo size="md" textColor="text-white" />
          <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/80 px-2.5 py-1 rounded-full text-[10.5px] font-black text-emerald-300 uppercase tracking-wider shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>OFFICIAL FLEET PARTNERSHIP 🇳🇬</span>
          </div>
        </div>

        {/* 2. CALL-TO-PARTNER MAIN HEADLINE */}
        <div className="bg-gradient-to-r from-[#0A1F44] via-[#0E2856] to-[#0A1F44] text-white px-4 py-3 text-center border-b border-slate-700">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-[#F7941D] drop-shadow-sm leading-tight">
            GROW YOUR WAYBILL REVENUE &amp; STOP CARGO LOSS DISPUTES!
          </h2>
          <p className="text-[11px] font-bold text-slate-200 mt-1">
            Free Digital Platform for Motor Parks, Truck Fleets &amp; Transport Companies
          </p>
        </div>

        {/* 3. HERO VEHICLE & LOGISTICS VISUAL */}
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-950 border-b-2 border-slate-200">
          <img 
            src={partnerFleetImage} 
            alt="Waybilla Logistics Fleet Partnership" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
          
          {/* Target Hubs Pill Ribbon */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
            <span className="bg-[#0A1F44]/95 backdrop-blur-md text-[#F7941D] text-[9.5px] font-black px-2.5 py-1 rounded-lg border border-[#F7941D]/50 uppercase flex items-center gap-1 shadow-lg">
              <Wrench className="w-3.5 h-3.5 text-[#F7941D]" />
              <span>Spare Parts Hubs &bull; Trucks &bull; Buses</span>
            </span>
            <span className="bg-emerald-600/95 backdrop-blur-md text-white text-[9.5px] font-black px-2.5 py-1 rounded-lg uppercase flex items-center gap-1 shadow-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span>100% Free Setup</span>
            </span>
          </div>
        </div>

        {/* 4. TARGET PARTNER SHOWCASE (MENTIONING HIGH-PROFILE NAMES & HUBS) */}
        <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-black uppercase text-[#0A1F44] tracking-wide">
            <Truck className="w-3.5 h-3.5 text-[#F7941D]" />
            <span>WHO ARE WE INVITING TO PARTNER?</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10.5px]">
            <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-xs">
              <span className="font-extrabold text-[#0A1F44] block">⚙️ Spare Parts Parks &amp; Trucks:</span>
              <span className="text-slate-600 font-semibold text-[9.5px] leading-tight block mt-0.5">
                Nwanyi Imo, Ladipo, Nnewi, Onitsha/Nkpor, Coal Camp &amp; heavy loading trucks.
              </span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-xs">
              <span className="font-extrabold text-[#0A1F44] block">🚌 Transport Bus Fleets:</span>
              <span className="text-slate-600 font-semibold text-[9.5px] leading-tight block mt-0.5">
                Goodness &amp; Mercy, Winners, Orizu, Young Shall Grow, GUO &amp; Interstate Lines.
              </span>
            </div>
          </div>
        </div>

        {/* 5. 4 CORE PARTNER BENEFITS */}
        <div className="p-3 bg-slate-100/90 grid grid-cols-2 gap-2">
          
          {/* Benefit 1 */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-full bg-[#F7941D] text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                1
              </div>
              <h4 className="font-black text-[10.5px] text-[#0A1F44] uppercase leading-tight">
                ZERO LOST CARGO
              </h4>
            </div>
            <p className="text-[9.5px] font-semibold text-slate-600 leading-snug">
              Secure QR scan + OTP release stops missing spare parts &amp; driver debt disputes.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                2
              </div>
              <h4 className="font-black text-[10.5px] text-[#0A1F44] uppercase leading-tight">
                15-SEC DIGITAL MANIFEST
              </h4>
            </div>
            <p className="text-[9.5px] font-semibold text-slate-600 leading-snug">
              Replace messy paper booklets with fast smartphone manifest generation.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                3
              </div>
              <h4 className="font-black text-[10.5px] text-[#0A1F44] uppercase leading-tight">
                PLUG CASH LEAKAGES
              </h4>
            </div>
            <p className="text-[9.5px] font-semibold text-slate-600 leading-snug">
              Fleet owners &amp; park managers see 100% of collected waybill cash in real-time.
            </p>
          </div>

          {/* Benefit 4 */}
          <div className="bg-gradient-to-br from-[#0A1F44] to-[#0E2856] text-white p-2.5 rounded-2xl border border-[#F7941D] shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-full bg-[#F7941D] text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                4
              </div>
              <h4 className="font-black text-[10.5px] text-[#F7941D] uppercase leading-tight">
                MORE CARGO VOLUME
              </h4>
            </div>
            <p className="text-[9.5px] font-bold text-slate-200 leading-snug">
              Get direct pre-booked parcel orders from merchants sending goods to other states.
            </p>
          </div>

        </div>

        {/* 6. CALL TO ACTION & ONBOARDING FOOTER */}
        <div className="bg-[#0A1F44] text-white px-4 py-3 border-t-2 border-[#F7941D] text-center">
          <div className="text-[11px] font-black text-amber-300 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Join Hundreds of Transporters Today &bull; 100% Free</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs font-black">
            <span className="flex items-center gap-1 text-white">
              <span className="text-[#F7941D]">Website:</span>
              <span className="text-white underline decoration-[#F7941D]">waybilla.com.ng</span>
            </span>
            <span className="text-slate-500">&bull;</span>
            <span className="flex items-center gap-1 text-white">
              <span className="text-[#F7941D]">Call/WhatsApp:</span>
              <span className="text-emerald-400 font-black">08143778304</span>
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default TransporterPartnershipModal;
