import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Mic, 
  MonitorPlay, 
  ShieldCheck, 
  Truck, 
  Users, 
  FileText, 
  Building2, 
  CheckCircle2,
  KeyRound,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  LayoutTemplate,
  Presentation
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PptxGenJS from 'pptxgenjs';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  bullets: string[];
  speech: string;
  icon: React.ReactNode;
  accentColor: string;
  badge: string;
}

export const PresentationPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedSlide, setCopiedSlide] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [isGeneratingPptx, setIsGeneratingPptx] = useState<boolean>(false);

  const slides: Slide[] = [
    {
      id: 1,
      title: "Waybilla: Digital Waybill & Park Logistics",
      subtitle: "Transforming Nigerian Motor Parks from Paper Counter Books to Real-Time Digital Tracking",
      badge: "Official Pitch & PowerPoint Deck",
      accentColor: "from-amber-500 to-orange-600",
      icon: <Truck className="w-8 h-8 text-amber-400" />,
      bullets: [
        "Respectful greetings to the Executive Governor, our event host, distinguished judges, ladies and gentlemen.",
        "Founder: Ndubisi Stanley Tassie",
        "Waybilla is officially launched and live at waybilla.com.ng",
        "Tailored specifically for Nigerian motor parks (Nnewi, Onitsha, Lagos, Abuja)."
      ],
      speech: "Good afternoon, Your Excellency the Executive Governor of our dear state, distinguished judges, ladies and gentlemen, and my fellow innovators. My name is Ndubisi Stanley Tassie, and I am the founder of Waybilla. Before we begin, we respectfully accord highest respect to our host, the Governor. Today, I am proud to announce that Waybilla is officially launched and available for download at waybilla.com.ng!"
    },
    {
      id: 2,
      title: "The Motor Park Reality & Economy",
      subtitle: "₦157 Trillion Road Cargo Economy Still Run on 95% Paper Counter Books",
      badge: "The Problem",
      accentColor: "from-blue-600 to-indigo-700",
      icon: <Building2 className="w-8 h-8 text-blue-400" />,
      bullets: [
        "Over 9 out of 10 goods and travelers in Nigeria move by road through local motor parks.",
        "A staggering ₦157 trillion moves across Nigerian roads every year.",
        "Yet, over 95% of waybill records are handwritten in torn paper counter books.",
        "Traders in Nnewi, Onitsha, and Ladipo Lagos send expensive spare parts with zero digital assurance."
      ],
      speech: "Please raise your hand if you have ever sent goods or spare parts through a motor park. Keep your hand up if you ever worried about whether those goods would arrive safely. (Pause) You are not alone. About nine out of ten goods in Nigeria move by road. The Vice-President's transport adviser noted that goods worth about ₦157 trillion move across Nigerian roads annually. Yet, over 95% of these waybill records are still handwritten in paper counter books!"
    },
    {
      id: 3,
      title: "Built for Locals — Not DHL or FedEx",
      subtitle: "Why Corporate Couriers Cannot Survive Inside Nigerian Motor Parks",
      badge: "Market Positioning",
      accentColor: "from-emerald-600 to-teal-700",
      icon: <Users className="w-8 h-8 text-emerald-400" />,
      bullets: [
        "DHL and FedEx charge ₦15,000 to ₦30,000 for small packages and do not operate inside local motor parks.",
        "Waybilla is built for local commercial transport companies, Sienna parks, luxury bus lines, and motor park traders.",
        "We understand local motor park culture—fast loading, cash & digital payments, and high-volume cargo.",
        "Even our transport uncles in the parks joke that DHL offices look too corporate for spare parts from Nnewi!"
      ],
      speech: "Now, let's clarify something important: Waybilla is NOT competing with DHL or FedEx. Corporate couriers charge ₦15,000 to ₦30,000 for a small package, and they don't have offices inside local motor parks. Waybilla is built specifically for local commercial transport companies, Sienna parks, and motor park traders across Nigeria. Even our transport uncles in the parks joke that DHL looks too corporate for heavy Nnewi motor engine blocks!"
    },
    {
      id: 4,
      title: "The 4 Critical Flaws in Paper Waybills",
      subtitle: "Why Importers and Transport Owners Lose Millions Daily",
      badge: "Pain Points",
      accentColor: "from-rose-600 to-red-700",
      icon: <AlertTriangle className="w-8 h-8 text-rose-400" />,
      bullets: [
        "1. No Digital Proof: Senders only get a paper slip that easily tears or gets lost.",
        "2. Unsecure Collections & Cargo Theft: Anyone who gets the receiver's phone number can collect the parcel. (Receivers call the park upon arrival, but it's vulnerable without secret verification).",
        "3. Unclaimed Goods & Clutter: Packages sit for weeks because receivers are not automatically notified.",
        "4. Owner Cash Leakage: Transport bosses waiting for handwritten counter books suffer unrecorded waybills and clerk cash leakage."
      ],
      speech: "Through our field research, we identified four critical problems: First, the sender has no digital proof—just a paper slip. Second, unsecure collections: when goods arrive, receivers call the park, but if a stranger intercepts or gets the phone number, expensive goods can be stolen. Third, unclaimed goods piling up. Fourth, transport company owners suffer cash leakage because paper counter books cannot be audited in real time."
    },
    {
      id: 5,
      title: "Meet Waybilla: Bulletproof Digital Logistics",
      subtitle: "Stage-by-Stage Tracking & Secret 6-Digit Pickup PIN",
      badge: "Our Solution",
      accentColor: "from-amber-600 to-yellow-600",
      icon: <ShieldCheck className="w-8 h-8 text-amber-400" />,
      bullets: [
        "Instant Digital Receipt: Senders get a unique tracking code (e.g., WB-890123) on their phone instantly.",
        "₦200 Live Activation Fee: Affordable micro-payment to instantly publish and activate live cargo listings on the park driver network.",
        "Secret 6-Digit Pickup PIN: Sent directly to the receiver. Phone numbers alone cannot collect goods!",
        "Real-Time Push Notifications: Automated live updates sent instantly to both senders and receivers at every stage (Booked, En Route, Arrived, Collected).",
        "Owner Master Dashboard: Real-time multi-branch revenue and manifest oversight on your phone."
      ],
      speech: "To solve these problems, we built Waybilla. First, senders get an instant digital waybill receipt with a unique code like WB-890123. Second, with a simple ₦200 live activation fee, the waybill is instantly published and activated live on the park network. Third, we introduced a strict secret 6-digit Pickup PIN sent to the receiver, backed by automated real-time push notifications that keep both senders and receivers updated at every stage—from booking to arrival and final collection!"
    },
    {
      id: 6,
      title: "Live Demonstration Walkthrough",
      subtitle: "How Waybilla Operates in Real-Time on Laptop & Mobile",
      badge: "Live Demo",
      accentColor: "from-blue-600 to-cyan-700",
      icon: <MonitorPlay className="w-8 h-8 text-cyan-400" />,
      bullets: [
        "Step 1: Park clerk books cargo on laptop ➔ Pays ₦200 live activation fee ➔ Instant digital tracking code & secret 6-digit PIN generated.",
        "Step 2: Real-Time Push Notifications instantly fire to sender and receiver mobile phones.",
        "Step 3: Customer checks live tracking on phone at waybilla.com.ng.",
        "Step 4: Security Pickup Verification ➔ Clerk enters wrong PIN (Access Denied) vs Correct 6-Digit PIN (Waybill Released Successfully)."
      ],
      speech: "Now for our live demonstration. Step 1: The park clerk creates a booking on the laptop, pays the ₦200 live activation fee, and a tracking code and secret PIN are generated instantly. Step 2: Automated real-time push notifications instantly fire to both sender and receiver phones. Step 3: The customer checks status at waybilla.com.ng. Step 4: At destination, trying a wrong PIN shows 'Access Denied', while the correct 6-digit PIN successfully releases the cargo."
    },
    {
      id: 7,
      title: "Business Model & Our Ask",
      subtitle: "Zero Upfront Hardware Cost — Transaction Revenue Share",
      badge: "Partnership & Ask",
      accentColor: "from-purple-600 to-indigo-700",
      icon: <CheckCircle2 className="w-8 h-8 text-purple-400" />,
      bullets: [
        "Revenue Model: Transaction revenue-share model on each waybill booked with transport companies.",
        "Flexible Partnership: Income from each waybill is shared through a simple agreement written together before the pilot starts.",
        "Benefits: Transport companies save millions on paper receipts, eliminate cargo theft, and prevent cash leakage.",
        "Our Ask: Onboarding 2 transport companies for a 30-day free pilot program. Waybilla is live at waybilla.com.ng"
      ],
      speech: "Waybilla is a business partnership. We bring the technology, transport companies bring their motor parks and cargo volume, and we share the income from each waybill, in a simple agreement we write down together before the pilot starts. Transport companies eliminate paper costs and cash leakage. Our ask today: We are onboarding 2 transport companies for a 30-day pilot program with zero setup fees. Waybilla is officially launched and ready at waybilla.com.ng. Thank you!"
    }
  ];

  const currentSlide = slides[currentSlideIndex];

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleCopyCurrentSpeech = () => {
    navigator.clipboard.writeText(currentSlide.speech);
    setCopiedSlide(true);
    setTimeout(() => setCopiedSlide(false), 2000);
  };

  const handleCopyAll = () => {
    const allText = slides.map(s => `--- SLIDE ${s.id}: ${s.title} ---\n${s.speech}\n\nKey Bullets:\n${s.bullets.map(b => `- ${b}`).join('\n')}\n`).join('\n========================================\n\n');
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadPowerPoint = () => {
    setIsGeneratingPptx(true);
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      slides.forEach((slide) => {
        const pptxSlide = pptx.addSlide();
        
        // Background color
        pptxSlide.background = { color: "0F172A" }; // slate-900

        // Title
        pptxSlide.addText(slide.title, {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: "F59E0B", // amber-500
          fontFace: "Arial"
        });

        // Subtitle / Badge
        pptxSlide.addText(`${slide.badge} — ${slide.subtitle}`, {
          x: 0.8,
          y: 1.6,
          w: 11.5,
          h: 0.5,
          fontSize: 14,
          color: "94A3B8", // slate-400
          fontFace: "Arial"
        });

        // Bullets
        const bulletObjects = slide.bullets.map(b => ({ text: b, options: { fontSize: 16, color: "F1F5F9", bullet: true, spaceAfter: 10 } }));
        pptxSlide.addText(bulletObjects, {
          x: 0.8,
          y: 2.3,
          w: 11.5,
          h: 3.2,
          fontFace: "Arial"
        });

        // Speaker notes
        pptxSlide.addNotes(slide.speech);
      });

      pptx.writeFile({ fileName: 'Waybilla_Pitch_Presentation.pptx' });
    } catch (err) {
      console.error("Failed to generate PPTX:", err);
      alert("Failed to generate PowerPoint file. Please try copying text or using slide show mode.");
    } finally {
      setIsGeneratingPptx(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-6 select-text ${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950' : ''}`}>
      
      {/* Top Header Navigation */}
      <div className="w-full max-w-6xl flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 mb-6 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to App</span>
        </button>

        <div className="flex items-center gap-2">
          <Logo size="sm" showText={true} />
          <span className="hidden sm:inline-block px-2.5 py-1 bg-amber-500/20 text-amber-400 text-xs font-black rounded-lg border border-amber-500/30">
            PowerPoint Deck Builder 📊
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPowerPoint}
            disabled={isGeneratingPptx}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-amber-500/20"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPptx ? 'Generating .pptx...' : 'Download PowerPoint (.pptx)'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Toggle Fullscreen Slide Show"
          >
            <Maximize2 className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Slide Show</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
          >
            {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
            <span>{copiedAll ? 'Copied Deck!' : 'Copy All Text'}</span>
          </button>
        </div>
      </div>

      {/* Main PowerPoint Deck Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar: Slide Thumbnails */}
        <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex flex-col gap-3 shadow-xl h-fit">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <LayoutTemplate className="w-4 h-4 text-amber-400" />
              <span>Slides ({slides.length})</span>
            </span>
            <span className="text-xs font-bold text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-md">
              {currentSlideIndex + 1} / {slides.length}
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentSlideIndex(idx)}
                className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  currentSlideIndex === idx
                    ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10 text-white'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                  currentSlideIndex === idx ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}>
                  {s.id}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.badge}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={handleDownloadPowerPoint}
              className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .pptx File</span>
            </button>
          </div>
        </div>

        {/* Center/Right Main Slide & Notes View */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* PowerPoint Slide Canvas (16:9 widescreen style) */}
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-slate-700/80 rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden min-h-[420px] flex flex-col justify-between">
            
            {/* Background Decorative Gradient Orb */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Slide Header */}
            <div className="relative z-10 flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${currentSlide.accentColor} shadow-xl text-white`}>
                  {currentSlide.icon}
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <span>{currentSlide.badge}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                    {currentSlide.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                    {currentSlide.subtitle}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-800 text-slate-300 rounded-xl border border-slate-700">
                  Slide {currentSlide.id} of {slides.length}
                </span>
              </div>
            </div>

            {/* Slide Body / Split Layout for Slide 1 */}
            <div className="relative z-10 my-6">
              {currentSlide.id === 1 ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-7 space-y-3">
                    {currentSlide.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-3 p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl shadow-inner">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
                          {bIdx + 1}
                        </span>
                        <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
                          {bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Right Column: Slide 1 Visual Launch Graphic Card Preview */}
                  <div className="md:col-span-5 bg-gradient-to-br from-amber-500/20 via-orange-600/20 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden flex flex-col items-center justify-center gap-4">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
                    
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl text-slate-950 font-black text-2xl mb-1">
                      WB
                    </div>

                    <div className="space-y-1">
                      <span className="inline-block px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded-full uppercase tracking-wider">
                        Official Launch Live
                      </span>
                      <h3 className="text-lg font-black text-white">waybilla.com.ng</h3>
                      <p className="text-xs text-slate-300">Nigeria's Digital Waybill & Motor Park Logistics</p>
                    </div>

                    <div className="w-full pt-3 border-t border-amber-500/30 flex items-center justify-between text-xs text-amber-400 font-bold px-2">
                      <span>Founder: Ndubisi Stanley Tassie</span>
                      <span>16:9 Deck</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentSlide.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-3 p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl shadow-inner">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
                        {bIdx + 1}
                      </span>
                      <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
                        {bullet}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Slide Footer Navigation Controls inside Canvas */}
            <div className="relative z-10 flex items-center justify-between pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentSlideIndex === 0}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  currentSlideIndex === 0
                    ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Slide</span>
              </button>

              <div className="text-xs text-slate-400 font-medium hidden sm:block">
                Waybilla Official Pitch Deck • waybilla.com.ng
              </div>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentSlideIndex === slides.length - 1}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  currentSlideIndex === slides.length - 1
                    ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                }`}
              >
                <span>Next Slide</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* Speaker Notes & Speech Box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">Speaker Notes for Slide {currentSlide.id}</h3>
                  <p className="text-[11px] text-slate-400">What to say when presenting this specific PowerPoint slide</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyCurrentSpeech}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
              >
                {copiedSlide ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSlide ? 'Copied Note!' : 'Copy Slide Note'}</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-slate-200 text-sm leading-relaxed font-normal">
              <p>"{currentSlide.speech}"</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
