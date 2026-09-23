import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Building2,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  MapPin,
  Globe,
  Truck,
  ArrowRight,
  RefreshCw,
  X,
  UserCheck,
  Lock,
  Sparkles,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { LiveCameraCaptureModal } from './LiveCameraCaptureModal';

export interface DeveloperSession {
  id: string;
  merchant_name: string;
  contact_email: string;
  contact_phone?: string;
  test_key: string;
  sandbox_balance: number;
  live_status: 'locked' | 'pending_verification' | 'approved' | 'rejected';
  token?: string;
}

export interface ComplianceData {
  id?: string;
  developer_id?: string;
  status: 'not_submitted' | 'under_review' | 'approved' | 'action_required';
  business_legal_name?: string;
  cac_rc_number?: string;
  cac_registration_type?: string;
  cac_document_name?: string;
  tin?: string;
  director_name?: string;
  director_role?: string;
  director_id_type?: string;
  director_id_number?: string;
  director_id_document_name?: string;
  street_address?: string;
  city?: string;
  state?: string;
  lga?: string;
  warehouse_location?: string;
  store_website_url?: string;
  monthly_parcel_volume?: string;
  rejection_reason?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  has_cac_doc?: boolean;
  has_id_doc?: boolean;
}

interface DeveloperComplianceTabProps {
  devUser: DeveloperSession | null;
  onSwitchTab: (tab: 'overview' | 'simulator' | 'keys' | 'compliance' | 'wallet' | 'docs') => void;
  onAccountUpdated: (user: DeveloperSession) => void;
}

const NIGERIAN_STATES = [
  'Abia', 'Abuja (FCT)', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export const DeveloperComplianceTab: React.FC<DeveloperComplianceTabProps> = ({
  devUser,
  onSwitchTab,
  onAccountUpdated
}) => {
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulatingReview, setIsSimulatingReview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [bizLegalName, setBizLegalName] = useState(devUser?.merchant_name || '');
  const [cacType, setCacType] = useState<'RC' | 'BN' | 'IT'>('RC');
  const [cacNumber, setCacNumber] = useState('');
  const [tin, setTin] = useState('');
  const [cacDocName, setCacDocName] = useState('');
  const [cacDocData, setCacDocData] = useState('');
  const [cacDragActive, setCacDragActive] = useState(false);

  const [directorName, setDirectorName] = useState('');
  const [directorRole, setDirectorRole] = useState('Managing Director');
  const [directorIdType, setDirectorIdType] = useState<'NIN' | 'DRIVERS_LICENSE' | 'INTERNATIONAL_PASSPORT' | 'VOTERS_CARD'>('NIN');
  const [directorIdNumber, setDirectorIdNumber] = useState('');
  const [directorIdDocName, setDirectorIdDocName] = useState('');
  const [directorIdDocData, setDirectorIdDocData] = useState('');
  const [cameraModalType, setCameraModalType] = useState<'director_id' | 'cac' | null>(null);
  const [idDragActive, setIdDragActive] = useState(false);

  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedState, setSelectedState] = useState('Lagos');
  const [lga, setLga] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [storeWebsiteUrl, setStoreWebsiteUrl] = useState('');
  const [monthlyVolume, setMonthlyVolume] = useState('51-200');
  const [certifyAgreed, setCertifyAgreed] = useState(false);

  // Fetch compliance status on load or session change
  const fetchStatus = async () => {
    if (!devUser?.token && !devUser?.id) return;
    setIsLoading(true);
    try {
      const token = devUser?.token || '';
      const devIdParam = devUser?.id ? `?developer_id=${encodeURIComponent(devUser.id)}` : '';
      const res = await fetch(`/api/v1/developer/compliance/status${devIdParam}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.status && json.data) {
        setComplianceData(json.data);
        if (json.data.status === 'approved' && devUser.live_status !== 'approved') {
          const updated: DeveloperSession = { ...devUser, live_status: 'approved' };
          onAccountUpdated(updated);
        }
      }
    } catch (err) {
      console.error('Error fetching compliance status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [devUser?.token, devUser?.id]);

  // Pre-fill form from existing compliance data if available
  useEffect(() => {
    if (complianceData && complianceData.status !== 'not_submitted') {
      if (complianceData.business_legal_name) setBizLegalName(complianceData.business_legal_name);
      if (complianceData.cac_rc_number) setCacNumber(complianceData.cac_rc_number);
      if (complianceData.cac_registration_type) setCacType(complianceData.cac_registration_type as any);
      if (complianceData.tin) setTin(complianceData.tin);
      if (complianceData.cac_document_name) setCacDocName(complianceData.cac_document_name);
      if (complianceData.director_name) setDirectorName(complianceData.director_name);
      if (complianceData.director_role) setDirectorRole(complianceData.director_role);
      if (complianceData.director_id_type) setDirectorIdType(complianceData.director_id_type as any);
      if (complianceData.director_id_number) setDirectorIdNumber(complianceData.director_id_number);
      if (complianceData.director_id_document_name) setDirectorIdDocName(complianceData.director_id_document_name);
      if (complianceData.street_address) setStreetAddress(complianceData.street_address);
      if (complianceData.city) setCity(complianceData.city);
      if (complianceData.state) setSelectedState(complianceData.state);
      if (complianceData.lga) setLga(complianceData.lga);
      if (complianceData.warehouse_location) setWarehouseLocation(complianceData.warehouse_location);
      if (complianceData.store_website_url) setStoreWebsiteUrl(complianceData.store_website_url);
      if (complianceData.monthly_parcel_volume) setMonthlyVolume(complianceData.monthly_parcel_volume);
    }
  }, [complianceData]);

  // Image Compression Helper (converts photos/screenshots to optimized JPEG Data URLs)
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(String(e.target?.result || ''));
          }
        };
        img.onerror = () => resolve(String(e.target?.result || ''));
        img.src = String(e.target?.result || '');
      };
      reader.readAsDataURL(file);
    });
  };

  // File Upload Helper (supports both drag-and-drop & click)
  const processUploadedFile = async (file: File, type: 'cac' | 'director_id') => {
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Document size exceeds 10MB limit. Please upload a smaller file.');
      return;
    }
    const isDoc = file.type === 'application/pdf' || file.type.startsWith('image/') || file.name.match(/\.(pdf|jpg|jpeg|png)$/i);
    if (!isDoc) {
      setErrorMsg('Invalid file format. Please upload a PDF, PNG, or JPG document.');
      return;
    }
    setErrorMsg(null);

    try {
      const dataUrl = await compressImageFile(file);
      if (type === 'cac') {
        setCacDocName(file.name);
        setCacDocData(dataUrl);
      } else {
        setDirectorIdDocName(file.name);
        setDirectorIdDocData(dataUrl);
      }
    } catch {
      setErrorMsg('Could not process image file. Please try another image.');
    }
  };

  const handleDrag = (e: React.DragEvent, type: 'cac' | 'director_id', isOver: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'cac') setCacDragActive(isOver);
    else setIdDragActive(isOver);
  };

  const handleDrop = (e: React.DragEvent, type: 'cac' | 'director_id') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'cac') setCacDragActive(false);
    else setIdDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0], type);
    }
  };

  // Submit Compliance Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devUser) {
      setErrorMsg('Please sign in to your developer sandbox account first.');
      return;
    }
    if (!certifyAgreed) {
      setErrorMsg('You must certify that your Corporate Affairs Commission details and Director identification are valid.');
      return;
    }
    if (!bizLegalName.trim()) {
      setErrorMsg('Official CAC Registered Business / Company Name is required.');
      return;
    }
    if (!cacNumber.trim() || cacNumber.trim().length < 4) {
      setErrorMsg('Valid CAC Registration Number (RC or BN) is required.');
      return;
    }
    if (!directorName.trim()) {
      setErrorMsg('Legal Director / Executive Name is required.');
      return;
    }
    if (!directorIdNumber.trim() || directorIdNumber.trim().length < 5) {
      setErrorMsg('Valid Director Government ID Number (e.g. 11-digit NIN) is required.');
      return;
    }
    if (!streetAddress.trim()) {
      setErrorMsg('Physical Nigerian warehouse or operational street address is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/developer/compliance/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: devUser.token ? `Bearer ${devUser.token}` : ''
        },
        body: JSON.stringify({
          developer_id: devUser.id,
          business_legal_name: bizLegalName.trim(),
          cac_rc_number: cacNumber.trim().toUpperCase(),
          cac_registration_type: cacType,
          cac_document_name: cacDocName || `${bizLegalName.trim()}_CAC_Certificate.pdf`,
          cac_document_data: cacDocData,
          tin: tin.trim(),
          director_name: directorName.trim(),
          director_role: directorRole,
          director_id_type: directorIdType,
          director_id_number: directorIdNumber.trim(),
          director_id_document_name: directorIdDocName || `${directorName.trim()}_ID.pdf`,
          director_id_document_data: directorIdDocData,
          street_address: streetAddress.trim(),
          city: city.trim(),
          state: selectedState,
          lga: lga.trim(),
          warehouse_location: warehouseLocation.trim() || streetAddress.trim(),
          store_website_url: storeWebsiteUrl.trim(),
          monthly_parcel_volume: monthlyVolume
        })
      });

      const json = await res.json();
      if (!json.status) {
        setErrorMsg(json.error || 'Failed to submit compliance documents.');
      } else {
        setSuccessMsg('Business KYC & CAC compliance documents submitted successfully! Status updated to Under Review.');
        await fetchStatus();
        const updatedUser: DeveloperSession = {
          ...devUser,
          live_status: 'pending_verification'
        };
        onAccountUpdated(updatedUser);
      }
    } catch (err) {
      setErrorMsg('Network error submitting compliance. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simulate Instant Admin Review (For rapid testing in AI Studio preview)
  const handleSimulateAdminReview = async (decision: 'approve' | 'reject') => {
    if (!devUser?.id) return;
    setIsSimulatingReview(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/developer/compliance/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developer_id: devUser.id,
          compliance_id: complianceData?.id,
          decision,
          rejection_reason: decision === 'reject' 
            ? 'CAC Certificate document resolution was illegible. Please re-upload a clear color scan of the registration certificate.'
            : ''
        })
      });
      const json = await res.json();
      if (json.status) {
        await fetchStatus();
        const updatedUser: DeveloperSession = {
          ...devUser,
          live_status: decision === 'approve' ? 'approved' : 'rejected'
        };
        onAccountUpdated(updatedUser);
        if (decision === 'approve') {
          setSuccessMsg('🎉 Business Verified! Step B passed. Your account is now eligible for Step C.');
        } else {
          setErrorMsg('Application marked as Action Required. Re-upload documents below.');
        }
      } else {
        setErrorMsg(json.error || 'Failed to process simulation review.');
      }
    } catch (err) {
      setErrorMsg('Network error running simulation.');
    } finally {
      setIsSimulatingReview(false);
    }
  };

  // Unauthenticated Prompt
  if (!devUser) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm text-center max-w-xl mx-auto space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto text-orange-600">
            <Shield className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">Sign In to Complete Step B</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Business KYC &amp; CAC verification documents must be linked to your verified developer sandbox account before review.
            </p>
          </div>
          <button
            onClick={() => onSwitchTab('keys')}
            className="bg-[#0A1F44] text-white text-xs font-black px-6 py-3 rounded-2xl hover:bg-blue-900 transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            Go to Developer Authentication <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const isApproved = complianceData?.status === 'approved' || devUser.live_status === 'approved';
  const isUnderReview = complianceData?.status === 'under_review' || devUser.live_status === 'pending_verification';
  const isActionRequired = complianceData?.status === 'action_required' || devUser.live_status === 'rejected';

  return (
    <div className="space-y-8 animate-fadeIn w-full max-w-full">
      {/* 4-Step Milestone Progress Bar */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
              Production Gateway &bull; Step B
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#0A1F44] mt-1.5">
              Business KYC &amp; Compliance Verification
            </h2>
          </div>
          {isApproved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Verified Enterprise
            </span>
          ) : isUnderReview ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-200">
              <Clock className="w-4 h-4 text-orange-600 animate-spin" />
              Under Review
            </span>
          ) : isActionRequired ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Action Required
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
              <Lock className="w-3.5 h-3.5" />
              Not Submitted
            </span>
          )}
        </div>

        {/* Milestone Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2">
          {/* Step A */}
          <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              ✓
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-emerald-950 truncate">Step A: Sandbox</p>
              <p className="text-[10px] text-emerald-700 truncate">Isolated Keys &bull; Passed</p>
            </div>
          </div>

          {/* Step B */}
          <div className={`p-3 rounded-2xl flex items-center gap-2.5 border ${
            isApproved 
              ? 'bg-emerald-50/90 border-emerald-200' 
              : isUnderReview
                ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-400/20'
                : 'bg-orange-50/70 border-orange-200'
          }`}>
            <div className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shrink-0 ${
              isApproved ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white'
            }`}>
              {isApproved ? '✓' : 'B'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-orange-950 truncate">Step B: Business KYC</p>
              <p className="text-[10px] text-orange-800 truncate">
                {isApproved ? 'Verified & Approved' : isUnderReview ? 'Review in Progress' : 'Active Step'}
              </p>
            </div>
          </div>

          {/* Step C */}
          <div
            onClick={() => onSwitchTab('wallet')}
            className={`p-3 rounded-2xl flex items-center gap-2.5 border cursor-pointer transition-all ${
              isApproved
                ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100/70'
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shrink-0 ${
              isApproved ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'
            }`}>
              C
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black truncate">Step C: Cargo Wallet</p>
              <p className="text-[10px] text-slate-500 truncate">{isApproved ? 'Click to configure' : 'Explore & Fund'}</p>
            </div>
          </div>

          {/* Step D */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5 text-slate-400">
            <div className="w-6 h-6 rounded-full bg-slate-300 text-slate-600 font-black text-xs flex items-center justify-center shrink-0">
              D
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black truncate">Step D: Live Key Reveal</p>
              <p className="text-[10px] text-slate-500 truncate">SHA-256 Gated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {(isActionRequired || complianceData?.status === 'action_required' || complianceData?.rejection_reason || devUser.rejection_reason) && (
        <div className="p-6 bg-rose-50 border-2 border-rose-300 rounded-3xl text-xs text-rose-950 space-y-3 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-200/80 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                Action Required &bull; Verification Rejected
              </span>
              <h3 className="text-base font-black text-rose-900 mt-0.5">
                Superadmin Requested Document Re-submission
              </h3>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 space-y-1">
            <span className="font-extrabold text-rose-800 text-[11px] uppercase block">
              Reason for Rejection from Superadmin:
            </span>
            <p className="text-sm font-bold text-slate-800 italic bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
              "{complianceData?.rejection_reason || devUser.rejection_reason || 'Document image unreadable or ID details did not match. Please re-upload a clear document photo.'}"
            </p>
          </div>

          <p className="text-xs text-rose-800 font-semibold">
            👇 Please correct your information or re-upload your document below and click <strong>"Submit Business Verification"</strong> to resubmit to Superadmin.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Verification Notice</p>
            <p className="text-rose-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Success</p>
            <p className="text-emerald-700">{successMsg}</p>
          </div>
        </div>
      )}

      {/* APPROVED STATE DISPLAY */}
      {isApproved && (
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 border border-emerald-700/50 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800/80 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/30">
                  CAC Corporate Verification Passed
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                  {complianceData?.business_legal_name || devUser.merchant_name}
                </h3>
                <p className="text-xs text-emerald-200/80">
                  Registration No: <strong>{complianceData?.cac_rc_number || 'RC-VERIFIED'}</strong> &bull; Status: Compliant
                </p>
              </div>
            </div>

            <div className="bg-emerald-950/60 border border-emerald-500/30 px-4 py-2.5 rounded-2xl text-right self-start sm:self-auto">
              <span className="text-[10px] text-emerald-300 uppercase tracking-wider block font-mono">Reviewed By</span>
              <span className="text-xs font-bold text-white">
                {complianceData?.reviewed_by || 'Waybilla Compliance Officer'}
              </span>
            </div>
          </div>

          {/* Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-emerald-900/50 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider block">Legal Director</span>
              <p className="font-bold text-white">{complianceData?.director_name || 'Verified Officer'}</p>
              <p className="text-[11px] text-emerald-300/90">{complianceData?.director_role || 'Managing Director'}</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-2xl border border-emerald-900/50 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider block">ID Verification</span>
              <p className="font-bold text-white">
                {complianceData?.director_id_type || 'NIN'}: •••••••{complianceData?.director_id_number?.slice(-4) || '4821'}
              </p>
              <p className="text-[11px] text-emerald-300/90">Identity Match Confirmed</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-2xl border border-emerald-900/50 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider block">Dispatch Operations</span>
              <p className="font-bold text-white truncate">{complianceData?.street_address || 'Registered Facility'}</p>
              <p className="text-[11px] text-emerald-300/90">{complianceData?.state || 'Nigeria'}</p>
            </div>
          </div>

          {/* Next Step Banner */}
          <div className="bg-emerald-500/10 border border-emerald-400/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-emerald-300">Ready for Step C: Pre-Funded API Cargo Billing Wallet</p>
              <p className="text-[11px] text-slate-300">
                With your business entity approved, connect your cargo wallet to fund automated manifest bookings (₦200 per waybill).
              </p>
            </div>
            <button
              onClick={() => onSwitchTab('wallet')}
              className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
            >
              Configure Cargo Wallet (Step C) <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* UNDER REVIEW NOTIFICATION & SIMULATION TOOL */}
      {isUnderReview && !isApproved && (
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 sm:p-7 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-orange-950">
                  Compliance Application Under Review
                </h3>
                <p className="text-xs text-orange-800 leading-relaxed">
                  Your CAC documents and Director ID have been received. Our compliance desk cross-matches documents with the Corporate Affairs Commission (CAC) registry. Standard SLA is 24 to 48 hours.
                </p>
                {complianceData?.submitted_at && (
                  <p className="text-[11px] text-orange-700 pt-1">
                    Submitted: <strong>{new Date(complianceData.submitted_at).toLocaleString()}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Submitted Summary Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-white/80 p-3 rounded-xl border border-orange-200/60">
                <span className="text-[10px] text-orange-800 block font-bold uppercase">Business Name</span>
                <span className="font-black text-slate-900 truncate block">{complianceData?.business_legal_name}</span>
                <span className="text-[10px] text-slate-500">CAC: {complianceData?.cac_rc_number}</span>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-orange-200/60">
                <span className="text-[10px] text-orange-800 block font-bold uppercase">Director Name</span>
                <span className="font-black text-slate-900 truncate block">{complianceData?.director_name}</span>
                <span className="text-[10px] text-slate-500">{complianceData?.director_role}</span>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-orange-200/60">
                <span className="text-[10px] text-orange-800 block font-bold uppercase">Dispatch Hub</span>
                <span className="font-black text-slate-900 truncate block">{complianceData?.city || complianceData?.state}</span>
                <span className="text-[10px] text-slate-500">{complianceData?.state}</span>
              </div>
            </div>

            {/* SANDBOX REVIEW SIMULATOR (Instant Testing Tool) */}
            <div className="bg-white border border-orange-300/80 rounded-2xl p-4 mt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-orange-900">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-black">AI Studio Preview Simulation: Test Review Workflows</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                As this applet runs in testing mode, you do not need to wait 24 hours. You can instantly simulate the Waybilla Compliance Officer review decision below:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => handleSimulateAdminReview('approve')}
                  disabled={isSimulatingReview}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ⚡ Simulate Instant CAC Approval (Proceed to Step C)
                </button>
                <button
                  onClick={() => handleSimulateAdminReview('reject')}
                  disabled={isSimulatingReview}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Simulate Action Required (Test Rejection &amp; Re-edit)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION REQUIRED BANNER */}
      {isActionRequired && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-rose-950">Action Required: Compliance Revisions</h3>
              <p className="text-xs text-rose-800 leading-relaxed">
                {complianceData?.rejection_reason || 'Please verify your CAC Certificate scan and Director ID information, then re-submit below.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* COMPLIANCE FORM (Shown when not submitted or editing/action required) */}
      {(!isApproved || isActionRequired) && (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: CAC Registration & Corporate Entity */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#0A1F44]">1. Corporate Affairs Commission (CAC) Registration</h3>
                <p className="text-xs text-slate-500">Official legal entity credentials registered with the Federal Republic of Nigeria</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business Name */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">
                  Registered Business or Company Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bizLegalName}
                  onChange={(e) => setBizLegalName(e.target.value)}
                  placeholder="e.g. Apex Interstate Logistics & Freight Ltd"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium"
                  required
                />
                <p className="text-[10px] text-slate-400">Must exactly match the name on your CAC Certificate of Incorporation.</p>
              </div>

              {/* CAC Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Registration Classification <span className="text-rose-500">*</span>
                </label>
                <select
                  value={cacType}
                  onChange={(e) => setCacType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium cursor-pointer"
                >
                  <option value="RC">RC — Limited Liability Company (Private / Public)</option>
                  <option value="BN">BN — Registered Business Name / Enterprise</option>
                  <option value="IT">IT — Incorporated Trustee / Cooperative</option>
                </select>
              </div>

              {/* CAC Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  CAC Number (RC or BN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={cacNumber}
                  onChange={(e) => setCacNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. RC-1849204 or BN-3948201"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-mono font-bold"
                  required
                />
              </div>

              {/* TIN */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tax Identification Number (TIN / FIRS)
                </label>
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder="e.g. 24891048-0001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-mono"
                />
              </div>

              {/* CAC Document Drag & Drop + Click Picker */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Certificate of Incorporation / Registration Upload (PDF / PNG / JPG / Screenshot)
                  </label>
                  <button
                    type="button"
                    onClick={() => setCameraModalType('cac')}
                    className="text-[11px] font-extrabold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Live with Camera</span>
                  </button>
                </div>
                <div
                  onDragOver={(e) => handleDrag(e, 'cac', true)}
                  onDragLeave={(e) => handleDrag(e, 'cac', false)}
                  onDrop={(e) => handleDrop(e, 'cac')}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer relative ${
                    cacDragActive 
                      ? 'border-blue-600 bg-blue-50/50' 
                      : cacDocName 
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processUploadedFile(e.target.files[0], 'cac');
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {cacDocName ? (
                    <div className="flex items-center justify-between max-w-md mx-auto bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
                      <div className="flex items-center gap-2.5 truncate">
                        <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 truncate">{cacDocName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCacDocName('');
                          setCacDocData('');
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 pointer-events-none">
                      <UploadCloud className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">
                        Drag &amp; drop CAC Certificate or <span className="text-blue-600 underline">browse screenshots/files</span>
                      </p>
                      <p className="text-[10px] text-slate-400">PDF, JPG, PNG, or Live Camera Snap</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Legal Director / Executive Identification */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#0A1F44]">2. Legal Director &amp; Executive Verification</h3>
                <p className="text-xs text-slate-500">Government identity verification of the executive officer signing for production dispatch</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Director Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Director Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={directorName}
                  onChange={(e) => setDirectorName(e.target.value)}
                  placeholder="e.g. Chukwuemeka O. Eze"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium"
                  required
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Executive Role / Designation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={directorRole}
                  onChange={(e) => setDirectorRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium cursor-pointer"
                >
                  <option value="Managing Director">Managing Director / CEO</option>
                  <option value="Operations Director">Operations Director / COO</option>
                  <option value="Logistics Manager">Head of Logistics &amp; Supply Chain</option>
                  <option value="Proprietor">Proprietor / Principal Partner</option>
                </select>
              </div>

              {/* ID Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Government ID Document Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={directorIdType}
                  onChange={(e) => setDirectorIdType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium cursor-pointer"
                >
                  <option value="NIN">NIN — National Identification Number (11 Digits)</option>
                  <option value="DRIVERS_LICENSE">FRSC Driver's License</option>
                  <option value="INTERNATIONAL_PASSPORT">Nigerian International Passport</option>
                  <option value="VOTERS_CARD">INEC Voter's Card (VIN)</option>
                </select>
              </div>

              {/* ID Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Government ID Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={directorIdNumber}
                  onChange={(e) => setDirectorIdNumber(e.target.value)}
                  placeholder="e.g. 74829104821"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-mono font-bold"
                  required
                />
              </div>

              {/* Director ID Upload */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Director ID Scan / Photo (PDF / JPG / PNG / Screenshot)
                  </label>
                  <button
                    type="button"
                    onClick={() => setCameraModalType('director_id')}
                    className="text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Live with Camera</span>
                  </button>
                </div>
                <div
                  onDragOver={(e) => handleDrag(e, 'director_id', true)}
                  onDragLeave={(e) => handleDrag(e, 'director_id', false)}
                  onDrop={(e) => handleDrop(e, 'director_id')}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer relative ${
                    idDragActive 
                      ? 'border-blue-600 bg-blue-50/50' 
                      : directorIdDocName 
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processUploadedFile(e.target.files[0], 'director_id');
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {directorIdDocName ? (
                    <div className="flex items-center justify-between max-w-md mx-auto bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
                      <div className="flex items-center gap-2.5 truncate">
                        <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 truncate">{directorIdDocName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDirectorIdDocName('');
                          setDirectorIdDocData('');
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 pointer-events-none">
                      <UploadCloud className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">
                        Drag &amp; drop Director ID or <span className="text-blue-600 underline">browse screenshots/files</span>
                      </p>
                      <p className="text-[10px] text-slate-400">Clear color photo of NIN slip, Driver's License or Passport data page</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Physical Operations & Logistics Footprint */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#0A1F44]">3. Operational Logistics &amp; Physical Address</h3>
                <p className="text-xs text-slate-500">Physical facility inspection address for interstate dispatch liability and insurance</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Street Address */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">
                  Physical Operational Street Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. 42 Commercial Avenue, Yaba or 18 Old Market Road, Onitsha"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium"
                  required
                />
              </div>

              {/* State */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Operational State <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium cursor-pointer"
                >
                  {NIGERIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* City / LGA */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  City / Local Government Area (LGA)
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Ikeja or Onitsha North"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Primary Warehouse */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Primary Dispatch Warehouse / Sorting Facility
                </label>
                <input
                  type="text"
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                  placeholder="e.g. Alaba Hub / Central Warehouse"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Business Website / Digital Storefront
                </label>
                <input
                  type="url"
                  value={storeWebsiteUrl}
                  onChange={(e) => setStoreWebsiteUrl(e.target.value)}
                  placeholder="https://yourstore.ng or @yourstore"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Volume Bracket */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700">
                  Estimated Monthly Interstate Parcel Volume
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {[
                    { id: '1-50', label: '1 - 50 Parcels', desc: 'Starting out' },
                    { id: '51-200', label: '51 - 200 Parcels', desc: 'Growing eCommerce' },
                    { id: '201-1000', label: '201 - 1,000 Parcels', desc: 'High Volume Brand' },
                    { id: '1000+', label: '1,000+ Parcels', desc: 'Enterprise Logistics' }
                  ].map((vol) => (
                    <button
                      key={vol.id}
                      type="button"
                      onClick={() => setMonthlyVolume(vol.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        monthlyVolume === vol.id
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <p className="text-xs font-black">{vol.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{vol.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Certification Statement */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={certifyAgreed}
                  onChange={(e) => setCertifyAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  required
                />
                <span className="text-xs text-slate-600 leading-relaxed font-medium">
                  I hereby certify under penalty of perjury that this enterprise is duly registered with the Corporate Affairs Commission (CAC) under Nigerian law, that all director credentials uploaded are genuine, and that this account will only be utilized for lawful freight dispatch via Waybilla motor park networks.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span>256-bit TLS encrypted transmission &bull; Stored securely in compliance vault</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-[#0A1F44] hover:bg-blue-900 text-white font-black text-xs px-8 py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Submitting Documents...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-orange-400" />
                    Submit Compliance Application (Step B)
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Live Camera Scanner & Snapper Modal */}
      <LiveCameraCaptureModal
        isOpen={cameraModalType !== null}
        onClose={() => setCameraModalType(null)}
        title={cameraModalType === 'director_id' ? 'Live Director ID Card Snapper' : 'Live CAC Certificate Snapper'}
        documentType={cameraModalType === 'director_id' ? 'id' : 'cac'}
        onCapture={(dataUrl, fileName) => {
          if (cameraModalType === 'director_id') {
            setDirectorIdDocName(fileName);
            setDirectorIdDocData(dataUrl);
          } else {
            setCacDocName(fileName);
            setCacDocData(dataUrl);
          }
          setCameraModalType(null);
        }}
      />
    </div>
  );
};
