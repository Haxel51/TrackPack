import React from 'react';
import { SuppliersManagement } from '../components/SuppliersManagement';
import { Building2, Navigation, MapPin } from 'lucide-react';

interface FleetLocationsViewProps {
  token: string;
  userName?: string;
}

export const FleetLocationsView: React.FC<FleetLocationsViewProps> = ({ token, userName }) => {
  return (
    <div className="space-y-6">
      {/* Intro / Section Header */}
      <div className="bg-white text-slate-900 border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">Saved Customer Destinations & Terminals</h2>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-orange-200">
                Verified Hubs
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Manage frequent customer offloading points, refineries, maritime ports, and regional depots for 1-click dispatch selection.
            </p>
          </div>
        </div>
      </div>

      {/* Main Destination Hubs Directory */}
      <SuppliersManagement token={token} userName={userName} />
    </div>
  );
};
export default FleetLocationsView;
