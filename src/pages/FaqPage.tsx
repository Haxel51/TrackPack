import { useState } from 'react';
import { HelpCircle, ShieldCheck, ChevronDown, Phone, ArrowLeft, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export function FaqPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0); // First FAQ open by default

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "Is TrackPack a logistics business or courier company?",
      answer: "No, TrackPack is NOT a physical logistics or courier company. TrackPack does not own delivery trucks, nor does it physically carry or handle packages. Instead, TrackPack is a digital waybill software and tracking platform built specifically for Nigerian motor park transport companies (such as Peace Mass, GUO, God is Good, Young Shall Grow, Goodness & Mercy, Romchi, and local transport lines). Motor parks use TrackPack software to replace old paper waybills with digital tracking codes, real-time status updates, driver vehicle details, and instant WhatsApp receipts."
    },
    {
      question: "How does waybill live tracking work on TrackPack?",
      answer: "When a parcel is registered at a motor park desk (or booked online), TrackPack issues a unique tracking code (e.g. TRK-4821). Senders and receivers can enter this code anytime on TrackPack's website or click the tracking link sent to their phone to see the package's live journey—from 'Loaded at Park' and 'In Transit' to 'Arrived at Terminal' and 'Collected'."
    },
    {
      question: "What should I do if my waybill shipment is taking longer or delayed?",
      answer: "Interstate highway transit across Nigeria can sometimes experience delays due to park departure schedules, vehicle loading, highway checkpoints, or road traffic. If your shipment status is delayed, check the Live Operations Note on your tracking page or tap the 'Contact Support on WhatsApp' button to reach our dedicated customer helpline at 0814 377 8304."
    },
    {
      question: "How does the receiver claim their package at the destination park?",
      answer: "Once the bus or vehicle arrives at the destination motor park, the park clerk scans the waybill as 'Arrived'. The receiver receives a notification with the destination park address. The receiver simply goes to the park's parcel department, presents their tracking code and phone number, and collects their package safely."
    },
    {
      question: "Is payment made online or at the motor park?",
      answer: "Both options are supported! Senders can pay online securely via instant bank transfer / card, or pay cash directly to the motor park cashier at the park counter."
    },
    {
      question: "How can motor parks partner with TrackPack?",
      answer: "Motor park transport lines can join TrackPack as official partners. Partnering parks get access to automated waybill generation, digital manifest printing, driver phone assignment, and SMS/WhatsApp notifications for all their senders and receivers. Visit our 'Partner with us' page to get started."
    }
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="sm" className="rounded-xl border border-gray-200 text-gray-600 hover:text-navy">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
          </Button>
        </Link>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-200 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy flex items-center gap-2.5">
              <HelpCircle className="w-7 h-7 text-amber" /> Waybill & Tracking FAQs
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Common questions about TrackPack's digital waybill tracking platform for Nigerian motor parks.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Info
          </span>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                openFaq === idx ? 'border-navy/40 bg-slate-50/50 shadow-2xs' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full text-left p-4.5 flex items-center justify-between gap-3 focus:outline-none cursor-pointer"
              >
                <span className="font-bold text-sm sm:text-base text-navy flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-navy/10 text-navy text-xs font-extrabold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  {faq.question}
                </span>
                <ChevronDown className={`w-4.5 h-4.5 text-gray-500 transition-transform duration-200 shrink-0 ${openFaq === idx ? 'rotate-180 text-navy' : ''}`} />
              </button>

              {openFaq === idx && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-sm font-bold text-navy flex items-center justify-center sm:justify-start gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600" /> Still have questions?
            </h3>
            <p className="text-xs text-gray-600">
              Our support line is active 24/7 on WhatsApp to assist senders, receivers, and motor park agents.
            </p>
          </div>
          <a 
            href="https://wa.me/2348143778304?text=Hello%20TrackPack%20Support,%20I%20have%20a%20question%20about%20waybill%20tracking."
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> Contact Support on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
