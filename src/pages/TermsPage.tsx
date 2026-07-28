import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      
      {/* Back button */}
      <div className="mb-6">
        <Link to="/">
          <Button variant="secondary" className="text-xs font-bold gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Button>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy to-slate-900 text-white rounded-3xl p-8 md:p-12 mb-10 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4" />
            Official TrackPack Legal & Privacy Guidelines
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            TrackPack — Terms & Conditions
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            Complete transparency and trust standards for customers and transport park partners.
          </p>
        </div>
      </div>

      <div className="space-y-12 text-gray-700 bg-white p-8 sm:p-12 rounded-3xl border border-gray-200 shadow-sm">
        
        {/* PART 1 */}
        <div className="space-y-8">
          <div className="border-b border-gray-200 pb-4">
            <span className="text-xs font-bold tracking-widest text-emerald-700 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Part 1
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy mt-2">
              Terms & Conditions for Customers (Senders & Receivers)
            </h2>
          </div>

          <div className="space-y-6 text-sm sm:text-base text-gray-600 leading-relaxed">
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">1. What TrackPack Is</h3>
              <p>
                TrackPack is a package tracking service used at partner transport parks. When you send or receive a package through a transport company using TrackPack, you can track its status from booking to delivery.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-navy">2. What Information We Collect, and Why</h3>
              <p>
                We only collect what's needed to make tracking work — nothing more:
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-navy text-white">
                      <th className="p-3 font-semibold rounded-l-xl">What we collect</th>
                      <th className="p-3 font-semibold rounded-r-xl">Why we need it</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="p-3 font-medium text-navy">Your phone number</td>
                      <td className="p-3 text-gray-600">To create your account, identify you as a sender or receiver on a shipment, and let you log in securely with your own password</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="p-3 font-medium text-navy">Sender/receiver names</td>
                      <td className="p-3 text-gray-600">So park staff and the receiving party can confirm the right person is sending or collecting the package</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-navy">Item description</td>
                      <td className="p-3 text-gray-600">So staff and the receiver know what's being shipped, for manifest accuracy</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="p-3 font-medium text-navy">Shipment history (routes, dates, statuses)</td>
                      <td className="p-3 text-gray-600">So you can view your past and current shipments anytime, and so we can resolve disputes if something goes wrong</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-navy">Payment information (if you activate tracking)</td>
                      <td className="p-3 text-gray-600">Handled securely by Paystack, our licensed payment processor — TrackPack never stores your card or bank details directly</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="font-semibold text-navy bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                We do not sell your data to advertisers or third parties. Your information is used only to operate the tracking service itself — nothing else.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-navy">3. Why We Ask You to Trust Us With This Information</h3>
              <p>
                We understand handing over your phone number and shipment details requires trust, especially from a new platform. Here's what we do to earn that:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Your account is protected by a password only you know, plus a lockout after repeated failed login attempts to prevent unauthorized access.</li>
                <li>Payments are processed through Paystack, a licensed and regulated Nigerian payment provider — TrackPack never directly handles or stores your card details.</li>
                <li>Your shipment history is private to your account — senders cannot see receiver-only actions, and no other customer can see your data.</li>
                <li>We do not share your phone number with anyone outside the transport company handling your specific shipment.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">4. Your Responsibilities</h3>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Provide accurate sender/receiver information when booking, since incorrect details can cause delivery issues.</li>
                <li>Keep your account password confidential.</li>
                <li>Confirm collection honestly — falsely marking a shipment as collected when you have not received it may result in account restrictions.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">5. Tracking Fee</h3>
              <p>
                Activating live tracking on a shipment costs a fee (currently ₦200), charged at the time of booking. This fee covers the cost of running the tracking system. This fee is separate from whatever the transport company charges for the physical delivery service itself, which TrackPack has no part in and is not responsible for.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">6. What We're Not Responsible For</h3>
              <p>
                TrackPack provides tracking and record-keeping — we do not physically transport your package. The transport company is responsible for the safe and timely delivery of your goods. TrackPack is not liable for lost, damaged, or delayed packages, though our records may assist in resolving disputes with the transport company.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">7. Estimated Arrival Times</h3>
              <p>
                Arrival estimates are calculated using historical data and are not guarantees. Actual arrival may vary due to traffic, weather, road conditions, or other factors outside our or the transport company's control.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">8. Account Suspension</h3>
              <p>
                We may suspend or restrict accounts found to be providing false information, attempting to defraud senders/receivers, or misusing the collection-confirmation system.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">9. Changes to These Terms</h3>
              <p>
                We may update these terms from time to time. Continued use of TrackPack after changes are posted means you accept the updated terms.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">10. Contact</h3>
              <p>
                Questions about your data or these terms can be sent to: <strong className="text-navy">trackpack701@gmail.com / WhatsApp: 09031940521</strong>
              </p>
            </div>

          </div>
        </div>

        <hr className="border-gray-200 my-10" />

        {/* PART 2 */}
        <div className="space-y-8">
          <div className="border-b border-gray-200 pb-4">
            <span className="text-xs font-bold tracking-widest text-amber-700 uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Part 2
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy mt-2">
              Terms & Conditions for Company Owners (Transport Park Partners)
            </h2>
          </div>

          <div className="space-y-6 text-sm sm:text-base text-gray-600 leading-relaxed">
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">1. The Partnership</h3>
              <p>
                By registering your transport company/park on TrackPack, you agree to use the platform to create and manage digital waybills for shipments passing through your park(s), in place of or alongside paper waybills.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-navy">2. What Information We Collect From You, and Why</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-navy text-white">
                      <th className="p-3 font-semibold rounded-l-xl">What we collect</th>
                      <th className="p-3 font-semibold rounded-r-xl">Why we need it</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="p-3 font-medium text-navy">Company/business name</td>
                      <td className="p-3 text-gray-600">To verify you are a legitimate transport business and display accurate information to customers</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="p-3 font-medium text-navy">Park location(s)</td>
                      <td className="p-3 text-gray-600">To correctly assign staff, routes, and shipments to the right physical locations</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-navy">Owner/manager phone number</td>
                      <td className="p-3 text-gray-600">For account login, communication, and verification</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="p-3 font-medium text-navy">Bank account details</td>
                      <td className="p-3 text-gray-600">Required to route your earnings from the platform automatically and directly to your account via our payment processor, Paystack</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-navy">Staff details you add (names, assigned parks)</td>
                      <td className="p-3 text-gray-600">To issue staff login PINs and track accountability for actions taken on shipments</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-navy">3. Why We Require Verification Before Approval</h3>
              <p>
                Unlike customer accounts, company accounts go through a manual review before approval. This protects everyone in the system:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>It ensures only real, legitimate transport businesses can create waybills and collect customer payments through the platform.</li>
                <li>It protects customers, who are trusting that the company handling their shipment is genuine.</li>
                <li>It protects you, since it prevents unauthorized parties from falsely representing themselves as your business on the platform.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">4. Earnings</h3>
              <p>
                Your company earns directly from tracked shipments passing through your park, paid automatically to your registered bank account via Paystack the moment a customer activates tracking — no manual invoicing, delay, or reconciliation required on your part.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-navy">5. Your Responsibilities as a Partner</h3>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Ensure staff you add are properly trained to create waybills and update shipment statuses (departed/arrived) accurately and promptly.</li>
                <li>Keep your registered bank account details current and accurate.</li>
                <li>Notify TrackPack promptly if a staff member leaves your employment, so their PIN can be deactivated.</li>
                <li>Do not use the platform to misrepresent shipment statuses or defraud customers.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">6. Data Protection</h3>
              <p>
                TrackPack does not sell or share your business information, customer data passing through your parks, or financial details with third parties, except as required to process payments (via Paystack) or if legally compelled to do so.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">7. Termination</h3>
              <p>
                Either party may end this partnership at any time. Upon termination, your account and staff access will be deactivated, and any outstanding payments already processed through the split-payment system remain unaffected, as those settle automatically and immediately at the time of each transaction.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">8. Changes to These Terms</h3>
              <p>
                We may update partnership terms from time to time, and will communicate material changes directly to registered company owners.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-navy">9. Contact</h3>
              <p>
                Questions about data, payments, or this partnership can be sent to: <strong className="text-navy">trackpack701@gmail.com / WhatsApp: 09031940521</strong>
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Footer Return */}
      <div className="mt-10 text-center">
        <Link to="/">
          <Button size="lg" className="font-bold px-8">
            Return to Homepage
          </Button>
        </Link>
      </div>

    </div>
  );
}
