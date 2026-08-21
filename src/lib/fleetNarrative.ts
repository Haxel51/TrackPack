/**
 * Simple, Easy-to-Understand Truck Journey & Live Status Explainer
 * Generates warm, real-world narrative status language for all 5 journey checkpoints.
 * Real values are filled in automatically without bracket placeholders.
 */

export interface FleetTripNarrativeInput {
  truck_number: string;
  supplier_name?: string | null;
  depot_name?: string | null;
  status:
    | 'pending_payment'
    | 'created'
    | 'initiated'
    | 'departed'
    | 'left_garage'
    | 'left_warehouse'
    | 'arrived_at_depot'
    | 'arrived_at_supplier'
    | 'cargo_loaded'
    | 'loaded_departed'
    | 'arrived_at_destination'
    | 'completed'
    | 'arrived_offloaded'
    | string;
  park_name?: string | null;
  origin_park?: string | null;
  origin_name?: string | null;
  created_at?: string | null;
  departed_at?: string | null;
  left_warehouse_at?: string | null;
  arrived_at_supplier_at?: string | null;
  cargo_loaded_at?: string | null;
  loaded_departed_at?: string | null;
  arrived_at_destination_at?: string | null;
  completed_at?: string | null;
  arrived_offloaded_at?: string | null;
  waybill_number?: string | null;
  expected_duration_minutes?: number | null;
  route_osrm?: {
    leg1_minutes?: number;
    leg2_minutes?: number;
    distance_km?: number;
    total_minutes?: number;
  };
  self_learned_eta?: {
    display?: string;
    sample_size?: number;
    is_learned?: boolean;
  };
}

export interface FleetNarrativeResult {
  headline: string;
  narrative: string;
  stageBadgeText: string;
  stageColor: 'slate' | 'blue' | 'amber' | 'emerald' | 'purple';
  isOverdue: boolean;
  overdueWarning?: string | null;
  checkpointNumber: 1 | 2 | 3 | 4 | 5;
  formattedTimes: {
    leftGarage?: string;
    arrivedDepot?: string;
    loadedDeparted?: string;
    arrivedDestination?: string;
    completed?: string;
    expectedEta?: string;
  };
}

export function formatTripTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return 'N/A';
  try {
    const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return 'N/A';
  }
}

export function getFleetTripNarrative(trip: FleetTripNarrativeInput): FleetNarrativeResult {
  const truckPlate = trip.truck_number?.trim() || 'Truck';
  const garageName = trip.origin_park?.trim() || trip.origin_name?.trim() || trip.park_name?.trim() || 'Main Garage';
  const depotName = trip.depot_name?.trim() || trip.supplier_name?.trim() || 'Supplier Depot';
  const destinationName = trip.supplier_name?.trim() || 'Destination Location';

  const defaultDurationMins = trip.expected_duration_minutes || trip.route_osrm?.total_minutes || 180;

  const leftGarageRaw = trip.departed_at || trip.left_warehouse_at || trip.created_at;
  const leftGarageFormatted = formatTripTime(leftGarageRaw);
  const arrivedDepotFormatted = formatTripTime(trip.arrived_at_supplier_at);
  const loadedDepartedFormatted = formatTripTime(trip.loaded_departed_at || trip.cargo_loaded_at);
  const arrivedDestFormatted = formatTripTime(trip.arrived_at_destination_at);
  const completedFormatted = formatTripTime(trip.completed_at || trip.arrived_offloaded_at);

  let expectedEtaFormatted = 'N/A';
  if (trip.loaded_departed_at) {
    const loadedMs = new Date(trip.loaded_departed_at).getTime();
    const leg2Mins = trip.route_osrm?.leg2_minutes || 90;
    if (!isNaN(loadedMs)) {
      expectedEtaFormatted = formatTripTime(new Date(loadedMs + leg2Mins * 60 * 1000));
    }
  } else if (leftGarageRaw) {
    const leftMs = new Date(leftGarageRaw).getTime();
    if (!isNaN(leftMs)) {
      expectedEtaFormatted = formatTripTime(new Date(leftMs + defaultDurationMins * 60 * 1000));
    }
  }

  const nowMs = Date.now();
  let isOverdue = false;
  let overdueWarning: string | null = null;

  const status = trip.status || 'created';

  // CHECKPOINT 5: Offloaded & Completed
  if (status === 'completed' || status === 'arrived_offloaded' || trip.arrived_offloaded_at || trip.completed_at) {
    return {
      headline: `Motor ${truckPlate} Offloaded & Completed! 🎉`,
      narrative: `Truck ${truckPlate} has been offloaded successfully. Trip completed at ${completedFormatted || 'completed time'}.`,
      stageBadgeText: '5. OFFLOADED & COMPLETED',
      stageColor: 'emerald',
      checkpointNumber: 5,
      isOverdue: false,
      formattedTimes: {
        leftGarage: leftGarageFormatted,
        arrivedDepot: arrivedDepotFormatted,
        loadedDeparted: loadedDepartedFormatted,
        arrivedDestination: arrivedDestFormatted,
        completed: completedFormatted
      }
    };
  }

  // CHECKPOINT 4: Arrived at Destination
  if (status === 'arrived_at_destination' || trip.arrived_at_destination_at) {
    return {
      headline: `Motor ${truckPlate} Don Reach ${destinationName}! 🏢`,
      narrative: `Truck ${truckPlate} has arrived at ${destinationName}. Arrived at ${arrivedDestFormatted || 'arrival time'}.`,
      stageBadgeText: `4. ARRIVED AT ${destinationName.toUpperCase()}`,
      stageColor: 'blue',
      checkpointNumber: 4,
      isOverdue: false,
      formattedTimes: {
        leftGarage: leftGarageFormatted,
        arrivedDepot: arrivedDepotFormatted,
        loadedDeparted: loadedDepartedFormatted,
        arrivedDestination: arrivedDestFormatted,
        expectedEta: expectedEtaFormatted
      }
    };
  }

  // CHECKPOINT 3: Loaded & Departed
  if (status === 'loaded_departed' || status === 'cargo_loaded' || trip.loaded_departed_at) {
    if (trip.loaded_departed_at) {
      const loadedMs = new Date(trip.loaded_departed_at).getTime();
      const elapsedMins = (nowMs - loadedMs) / (1000 * 60);
      if (elapsedMins > 240) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} has been moving on the road since ${loadedDepartedFormatted} (${Math.round(elapsedMins / 60)} hours ago). Please check road condition with driver.`;
      }
    }

    return {
      headline: `Motor ${truckPlate} Loaded & En Route with Goods! 🚚💨`,
      narrative: `Truck ${truckPlate} has been loaded at ${depotName} and is now heading to ${destinationName}. Expected arrival by ${expectedEtaFormatted}.`,
      stageBadgeText: '3. LOADED & DEPARTED',
      stageColor: 'blue',
      checkpointNumber: 3,
      isOverdue,
      overdueWarning,
      formattedTimes: {
        leftGarage: leftGarageFormatted,
        arrivedDepot: arrivedDepotFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedEta: expectedEtaFormatted
      }
    };
  }

  // CHECKPOINT 2: Arrived at Depot
  if (status === 'arrived_at_depot' || status === 'arrived_at_supplier' || trip.arrived_at_supplier_at) {
    return {
      headline: `Motor ${truckPlate} Arrived at ${depotName} 🏭`,
      narrative: `Truck ${truckPlate} has arrived at ${depotName} and is waiting to be loaded. Arrived at ${arrivedDepotFormatted || 'arrival time'}.`,
      stageBadgeText: '2. ARRIVED AT DEPOT',
      stageColor: 'purple',
      checkpointNumber: 2,
      isOverdue: false,
      formattedTimes: {
        leftGarage: leftGarageFormatted,
        arrivedDepot: arrivedDepotFormatted,
        expectedEta: expectedEtaFormatted
      }
    };
  }

  // CHECKPOINT 1: Left Garage (or standard active trip)
  if (status === 'left_garage' || status === 'departed' || status === 'left_warehouse' || status === 'initiated') {
    if (leftGarageRaw) {
      const leftMs = new Date(leftGarageRaw).getTime();
      const elapsedMins = (nowMs - leftMs) / (1000 * 60);
      if (elapsedMins > 180) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} left ${garageName} at ${leftGarageFormatted} (${Math.round(elapsedMins / 60)} hours ago). Please check on driver.`;
      }
    }

    return {
      headline: `Motor ${truckPlate} Don Leave Garage 🛣️`,
      narrative: `Truck ${truckPlate} has departed from ${garageName} and is heading to ${depotName}. Trip started at ${leftGarageFormatted}.`,
      stageBadgeText: '1. LEFT GARAGE',
      stageColor: 'amber',
      checkpointNumber: 1,
      isOverdue,
      overdueWarning,
      formattedTimes: {
        leftGarage: leftGarageFormatted,
        expectedEta: expectedEtaFormatted
      }
    };
  }

  // Scheduled / Pending Payment
  return {
    headline: `Motor ${truckPlate} Scheduled for Trip 📋`,
    narrative: `Truck ${truckPlate} is preparing at ${garageName} to depart for ${depotName}.`,
    stageBadgeText: 'TRIP SCHEDULED',
    stageColor: 'slate',
    checkpointNumber: 1,
    isOverdue: false,
    formattedTimes: {
      leftGarage: leftGarageFormatted,
      expectedEta: expectedEtaFormatted
    }
  };
}
