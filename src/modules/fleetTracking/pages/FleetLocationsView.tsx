import React, { useState } from 'react';
import { GarageSettings } from '../components/GarageSettings';
import { SuppliersManagement } from '../components/SuppliersManagement';
import { Warehouse, Building, MapPin, Navigation, Info } from 'lucide-react';

interface FleetLocationsViewProps {
  token: string;
  userName?: string;
}

export const FleetLocationsView: React.FC<FleetLocationsViewProps> = ({ token, userName }) => {
  const [activeTab, setActiveTab] = useState<'garage' | 'suppliers'>('garage');

  return (
    <div className="space-y-6">
      {/* Intro / Section Header */}
      <div className="bg-[#0A1F44] text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
            <Navigation className="w-6 h-6 text-[#F2A93B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">Fleet Locations & Geofences</h2>
              <span className="bg-[#F2A93B] text-[#0A1F44] text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                Step 1: Locations
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Configure your single company Garage origin and multiple Supplier / Customer destination points with verified coordinates.
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('garage')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'garage'
                ? 'bg-white text-[#0A1F44] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Warehouse className="w-4 h-4 text-[#F2A93B]" />
            <span>1. Garage Origin</span>
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-white text-[#0A1F44] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building className="w-4 h-4 text-[#F2A93B]" />
            <span>2. Supplier Locations</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div>
        {activeTab === 'garage' ? (
          <GarageSettings token={token} userName={userName} />
        ) : (
          <SuppliersManagement token={token} userName={userName} />
        )}
      </div>
    </div>
  );
};
