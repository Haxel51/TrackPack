import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { ArrowLeft, Building, ArrowRight, Phone, MessageCircle, CheckCircle2 } from 'lucide-react';
import { createLead } from '../lib/api';
import { normalizeTo11Digits } from '../lib/helpers';

export function PartnersPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [parkLocation, setParkLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tcAccepted, setTcAccepted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !companyName || !parkLocation) return;

    const normalizedPhone = normalizeTo11Digits(phone);
    if (normalizedPhone.length !== 11) {
      alert("Phone number must be exactly 11 digits (e.g., 08012345678).");
      return;
    }
    
    setLoading(true);
    try {
      await createLead({
        name,
        phone: normalizedPhone,
        companyName,
        parkLocation,
        timestamp: Date.now()
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Error creating lead", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 md:py-16 px-4">
      <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-navy mb-8">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
      </Link>
      
      <div className="text-center space-y-6 bg-white p-8 md:p-12 rounded-3xl border border-gray-200 shadow-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-amber mb-2">
          <Building className="w-8 h-8" />
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy">
          Earn with TrackPack
        </h1>
        
        <p className="text-gray-700 text-lg max-w-xl mx-auto leading-relaxed">
          Run a transport park? Partner with TrackPack to drastically reduce paper and record-keeping costs, streamline your daily park operations, and <strong>start earning from every waybill you track through the app.</strong> Zero setup fee, no cost to join.
        </p>

        {/* Value Pillars for Transport Parks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2 max-w-xl mx-auto">
          <div className="bg-bg-light p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-1">Cut Paper Costs</h3>
            <p className="text-xs text-gray-600">Eliminate expensive waybill books and manual paper logs.</p>
          </div>
          <div className="bg-bg-light p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-1">Earn Revenue</h3>
            <p className="text-xs text-gray-600">Earn from every waybill processed through your terminal.</p>
          </div>
          <div className="bg-bg-light p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-1">Free to Join</h3>
            <p className="text-xs text-gray-600">100% free digital onboarding with zero setup or hidden fees.</p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100 text-left">
          <h2 className="text-xl font-bold text-navy mb-4 text-center">Interested? Let's talk first.</h2>
          
          {submitted ? (
            <div className="bg-green-50 text-green-800 p-6 rounded-2xl text-center border border-green-200">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">Request Received!</h3>
              <p>Thanks for your interest, {name}. We will reach out to you shortly at {phone} to discuss partnering.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <Input required placeholder="e.g. John Doe" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <Input required type="tel" placeholder="e.g. 08012345678" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company / Park Name</label>
                <Input required placeholder="e.g. Fast Transit Ltd" value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Park Location</label>
                <Input required placeholder="e.g. Jibowu Terminal, Lagos" value={parkLocation} onChange={e => setParkLocation(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Submitting...' : 'Request a callback'}
              </Button>
            </form>
          )}
        </div>
        
        <div className="pt-8 mt-8 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Or Contact Us Directly</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="https://wa.me/2348143778304" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors w-full sm:w-auto">
              <MessageCircle className="w-5 h-5 mr-2" />
              Chat on WhatsApp
            </a>
            <a href="tel:08143778304" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gray-100 text-navy font-medium hover:bg-gray-200 transition-colors w-full sm:w-auto">
              <Phone className="w-5 h-5 mr-2" />
              Call 0814 377 8304
            </a>
          </div>
        </div>
        
        <div className="pt-8 mt-8 border-t border-gray-100">
          <h2 className="text-xl font-bold text-navy mb-2">Ready to Register Online?</h2>
          <p className="text-sm text-gray-700 max-w-md mx-auto mb-6 leading-relaxed">
            You can register your transport company or park terminal online from anywhere without requiring an in-person physical visit. Read the partner overview above, accept the terms, and click proceed.
          </p>
          
          <div className="max-w-md mx-auto bg-bg-light p-4 rounded-xl border border-gray-200 mb-6 text-left">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 min-w-4 w-4 h-4 text-amber rounded border-gray-300 focus:ring-blue-500" 
                checked={tcAccepted}
                onChange={(e) => setTcAccepted(e.target.checked)}
              />
              <span className="text-sm text-gray-700 leading-snug">
                I confirm that I represent a transport park or company, have read the partner information, and agree to TrackPack's <Link to="/terms" className="text-navy font-bold underline hover:text-emerald-700">Terms & Conditions</Link> to register online.
              </span>
            </label>
          </div>

          <Button 
            size="lg" 
            variant="secondary" 
            className="w-full sm:w-auto px-8 font-semibold"
            disabled={!tcAccepted}
            onClick={() => {
              if (tcAccepted) navigate('/login/admin?mode=register', { state: { mode: 'register' } });
            }}
          >
            Proceed to Register Owner Account
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
