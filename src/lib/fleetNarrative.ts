/**
 * Simple, Easy-to-Understand Truck Journey & Live Status Explainer
 * Made in simple everyday words so drivers, park managers, and truck owners understand instantly!
 */

export interface FleetTripNarrativeInput {
  truck_number: string;
  supplier_name: string;
  status: 'pending_payment' | 'created' | 'trip_created' | 'left_warehouse' | 'arrived_at_supplier' | 'cargo_loaded' | 'loaded_departed' | 'arrived_at_destination' | 'completed' | string;
  park_name?: string | null;
  origin_name?: string | null;
  created_at?: string | null;
  left_warehouse_at?: string | null;
  arrived_at_supplier_at?: string | null;
  cargo_loaded_at?: string | null;
  loaded_departed_at?: string | null;
  arrived_at_destination_at?: string | null;
  arrived_offloaded_at?: string | null;
  waybill_number?: string | null;
  expected_duration_minutes?: number | null;
}

export interface FleetNarrativeResult {
  headline: string;
  narrative: string;
  stageBadgeText: string;
  stageColor: 'slate' | 'blue' | 'amber' | 'emerald' | 'purple';
  isOverdue: boolean;
  overdueWarning?: string | null;
  formattedTimes: {
    tripStarted?: string;
    leftWarehouse?: string;
    arrivedSupplier?: string;
    cargoLoaded?: string;
    loadedDeparted?: string;
    arrivedDestination?: string;
    expectedReturn?: string;
    expectedNextCheckpointTime?: string;
    tripCompleted?: string;
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
  const truckPlate = trip.truck_number?.trim() || 'Assigned Truck';
  const warehouseName = trip.origin_name?.trim() || trip.park_name?.trim() || 'Loading Park';
  const supplierName = trip.supplier_name?.trim() || 'Delivery Location';

  const defaultDurationMins = trip.expected_duration_minutes || 180;

  const startTimeRaw = trip.left_warehouse_at || trip.created_at;
  const tripStartedFormatted = formatTripTime(startTimeRaw);
  const leftWarehouseFormatted = formatTripTime(trip.left_warehouse_at);
  const arrivedSupplierFormatted = formatTripTime(trip.arrived_at_supplier_at);
  const cargoLoadedFormatted = formatTripTime(trip.cargo_loaded_at);
  const loadedDepartedFormatted = formatTripTime(trip.loaded_departed_at);
  const arrivedDestinationFormatted = formatTripTime(trip.arrived_at_destination_at);
  const tripCompletedFormatted = formatTripTime(trip.arrived_offloaded_at);

  let expectedReturnFormatted = 'N/A';
  if (trip.left_warehouse_at) {
    const leftTimeMs = new Date(trip.left_warehouse_at).getTime();
    if (!isNaN(leftTimeMs)) {
      const returnTime = new Date(leftTimeMs + defaultDurationMins * 60 * 1000);
      expectedReturnFormatted = formatTripTime(returnTime);
    }
  } else if (trip.created_at) {
    const createdMs = new Date(trip.created_at).getTime();
    if (!isNaN(createdMs)) {
      const returnTime = new Date(createdMs + defaultDurationMins * 60 * 1000);
      expectedReturnFormatted = formatTripTime(returnTime);
    }
  }

  const nowMs = Date.now();
  let isOverdue = false;
  let overdueWarning: string | null = null;
  let expectedNextTime = 'N/A';

  const status = trip.status || 'created';

  // Easy-to-understand messages for all 7 journey steps
  if (status === 'completed' || trip.arrived_offloaded_at) {
    return {
      headline: `Motor ${truckPlate} Don Deliver Complete! 🎉`,
      narrative: `Truck ${truckPlate} has safely dropped all goods at ${supplierName} and completed the journey by ${tripCompletedFormatted}. Work done well! 👏`,
      stageBadgeText: 'DELIVERED & DONE',
      stageColor: 'emerald',
      isOverdue: false,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        loadedDeparted: loadedDepartedFormatted,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (status === 'arrived_at_destination') {
    return {
      headline: `Motor ${truckPlate} Don Reach Destination Gate 🏢`,
      narrative: `Truck ${truckPlate} has arrived at ${supplierName} around ${arrivedDestinationFormatted}. Driver is waiting for the gate to open or offloading to start!`,
      stageBadgeText: 'AT FACTORY GATE',
      stageColor: 'blue',
      isOverdue: false,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        loadedDeparted: loadedDepartedFormatted,
        arrivedDestination: arrivedDestinationFormatted
      }
    };
  }

  if (status === 'loaded_departed') {
    // Check if on road too long (> 4 hours without update)
    if (trip.loaded_departed_at) {
      const loadedMs = new Date(trip.loaded_departed_at).getTime();
      const elapsedMins = (nowMs - loadedMs) / (1000 * 60);
      if (elapsedMins > 240) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} has been moving on the road since ${loadedDepartedFormatted} (${Math.round(elapsedMins / 60)} hours ago). Oga, please ring the driver to confirm road condition! 📞`;
      }
    }

    return {
      headline: `Motor ${truckPlate} Dey Fly for Highway with Goods! 🚚💨`,
      narrative: `Truck ${truckPlate} has finished loading goods at ${supplierName} and is now moving on the highway towards destination. Expected arrival by ${expectedReturnFormatted}.`,
      stageBadgeText: 'ON HIGHWAY (LOADED)',
      stageColor: 'blue',
      isOverdue,
      overdueWarning,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedReturn: expectedReturnFormatted
      }
    };
  }

  if (status === 'cargo_loaded') {
    return {
      headline: `Goods Loaded Inside Motor ${truckPlate} 📦`,
      narrative: `All goods have been safely packed and sealed inside Truck ${truckPlate} at ${cargoLoadedFormatted}. Driver is starting engine to hit the road!`,
      stageBadgeText: 'GOODS PACKED',
      stageColor: 'purple',
      isOverdue: false,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        cargoLoaded: cargoLoadedFormatted
      }
    };
  }

  if (status === 'arrived_at_supplier') {
    return {
      headline: `Motor ${truckPlate} Don Land at Supplier / Factory 🏭`,
      narrative: `Truck ${truckPlate} arrived at ${supplierName} at ${arrivedSupplierFormatted}. Awaiting forklift / workers to pack goods inside the truck.`,
      stageBadgeText: 'AT LOADING POINT',
      stageColor: 'purple',
      isOverdue: false,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        arrivedSupplier: arrivedSupplierFormatted
      }
    };
  }

  if (status === 'left_warehouse') {
    if (trip.left_warehouse_at) {
      const leftMs = new Date(trip.left_warehouse_at).getTime();
      const elapsedMins = (nowMs - leftMs) / (1000 * 60);
      if (elapsedMins > 180) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} left ${warehouseName} since ${leftWarehouseFormatted} (${Math.round(elapsedMins / 60)} hours ago). Please check on driver! 📞`;
      }
    }

    return {
      headline: `Motor ${truckPlate} Don Move from Park 🛣️`,
      narrative: `Truck ${truckPlate} left ${warehouseName} at ${leftWarehouseFormatted} and is traveling to ${supplierName}. Journey in progress!`,
      stageBadgeText: 'LEFT PARK / MOVING',
      stageColor: 'amber',
      isOverdue,
      overdueWarning,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        expectedReturn: expectedReturnFormatted
      }
    };
  }

  // Pending / Created
  return {
    headline: `Motor ${truckPlate} Scheduled for Trip 📋`,
    narrative: `Truck ${truckPlate} is ready at ${warehouseName} to carry goods to ${supplierName}. Driver is warming engine to take off!`,
    stageBadgeText: 'READY TO MOVE',
    stageColor: 'slate',
    isOverdue: false,
    formattedTimes: {
      tripStarted: tripStartedFormatted,
      expectedReturn: expectedReturnFormatted
    }
  };
}
