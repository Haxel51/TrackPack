import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

export function WhatsAppButton() {
  const [showTooltip, setShowTooltip] = useState(false);
  const phoneNumber = "2349031940521";
  const message = encodeURIComponent("Hello Waybilla Customer Support, I need assistance with my waybill.");
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 group">
      {/* Expanded Label on Hover / Tap */}
      <div className="hidden sm:flex items-center gap-2 bg-[#0A1F44] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-blue-900/60/50 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
        <span>Need help? Chat on WhatsApp</span>
      </div>

      {/* Floating Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact Customer Support on WhatsApp"
        id="whatsapp-customer-service-btn"
        className="flex items-center justify-center w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 relative group/btn"
      >
        {/* Subtle Ring Ripple Effect */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 animate-ping group-hover/btn:animate-none"></span>

        {/* Crisp WhatsApp Icon */}
        <svg
          className="w-7 h-7 fill-current relative z-10"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.993L2 22l5.233-1.237a9.96 9.96 0 004.779 1.221h.005c5.505 0 9.988-4.478 9.989-9.985A9.982 9.982 0 0012.012 2zm.005 18.281a8.27 8.27 0 01-4.223-1.157l-.303-.18-3.138.742.833-3.057-.197-.314a8.27 8.27 0 01-1.272-4.331c0-4.562 3.712-8.274 8.276-8.274 2.21 0 4.288.861 5.852 2.427a8.22 8.22 0 012.422 5.857c0 4.563-3.712 8.276-8.275 8.276zm4.536-6.196c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062a6.8 6.8 0 01-1.998-1.232 7.502 7.502 0 01-1.383-1.724c-.145-.249-.015-.384.109-.508.112-.112.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.767-1.847-.202-.486-.407-.42-.56-.428l-.477-.008c-.166 0-.435.062-.663.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.406 1.016 2.573.125.166 1.756 2.682 4.255 3.761.594.257 1.058.41 1.42.525.597.19 1.14.163 1.57.099.48-.072 1.472-.602 1.679-1.183.207-.581.207-1.079.145-1.183-.062-.104-.228-.187-.477-.312z" />
        </svg>
      </a>
    </div>
  );
}
