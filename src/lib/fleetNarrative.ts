/**
 * Fleet Trip Status & Overdue Notification Helpers
 *
 * Provides warm, professional, human-readable narrative copy for fleet round-trips:
 *
 * Checkpoint 1 — Left Warehouse (left_warehouse):
 *   "Truck [plate number] has departed from [warehouse name] and is on its way to [supplier name]. Trip started at [time]."
 *
 * Checkpoint 2 — Loaded & Departed (loaded_departed):
 *   "Truck [plate number] has been loaded at [supplier name] and is now heading back. Expected return by [time]."
 *
 * Checkpoint 3 — Arrived & Offloaded (arrived_offloaded / completed):
 *   "Truck [plate number] is back and has been offloaded successfully. Trip completed at [time]."
 *
 * Overdue warning (1+ hour past expected time):
 *   "Truck [plate number] was expected at [next checkpoint name] by [time] but has not been confirmed yet. Please check in with your driver."
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

/**
 * Format a Date or timestamp string into human readable 12-hour AM/PM format (e.g. "9:04 AM")
 */
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

/**
 * Calculates human readable narrative and overdue warnings for a fleet trip across all 7 stages.
 */
export function getFleetTripNarrative(trip: FleetTripNarrativeInput): FleetNarrativeResult {
  const truckPlate = trip.truck_number?.trim() || 'Assigned Truck';
  const warehouseName = trip.origin_name?.trim() || trip.park_name?.trim() || 'Origin Depot';
  const supplierName = trip.supplier_name?.trim() || 'Supplier Plant';

  const defaultDurationMins = trip.expected_duration_minutes || 180; // 3 hours default round-trip duration

  // Format times
  const startTimeRaw = trip.left_warehouse_at || trip.created_at;
  const tripStartedFormatted = formatTripTime(startTimeRaw);
  const leftWarehouseFormatted = formatTripTime(trip.left_warehouse_at);
  const arrivedSupplierFormatted = formatTripTime(trip.arrived_at_supplier_at);
  const cargoLoadedFormatted = formatTripTime(trip.cargo_loaded_at);
  const loadedDepartedFormatted = formatTripTime(trip.loaded_departed_at);
  const arrivedDestinationFormatted = formatTripTime(trip.arrived_at_destination_at);
  const tripCompletedFormatted = formatTripTime(trip.arrived_offloaded_at);

  // Compute expected return time (or next checkpoint ETA)
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

  // OVERDUE CALCULATION:
  let isOverdue = false;
  let overdueWarning: string | null = null;
  let expectedNextCheckpointTime = 'N/A';
  const nowMs = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  if (trip.status === 'left_warehouse' && trip.left_warehouse_at) {
    const leftMs = new Date(trip.left_warehouse_at).getTime();
    if (!isNaN(leftMs)) {
      const legDurationMs = (defaultDurationMins / 2) * 60 * 1000;
      const expectedSupplierArrivalMs = leftMs + legDurationMs;
      expectedNextCheckpointTime = formatTripTime(new Date(expectedSupplierArrivalMs));

      if (nowMs > expectedSupplierArrivalMs + ONE_HOUR_MS) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} was expected at ${supplierName} by ${expectedNextCheckpointTime} but has not checked in yet. Please check in with your driver.`;
      }
    }
  } else if (trip.status === 'loaded_departed' && trip.loaded_departed_at) {
    const loadedMs = new Date(trip.loaded_departed_at).getTime();
    if (!isNaN(loadedMs)) {
      const legDurationMs = (defaultDurationMins / 2) * 60 * 1000;
      const expectedWarehouseArrivalMs = loadedMs + legDurationMs;
      expectedNextCheckpointTime = formatTripTime(new Date(expectedWarehouseArrivalMs));

      if (nowMs > expectedWarehouseArrivalMs + ONE_HOUR_MS) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} was expected at ${warehouseName} by ${expectedNextCheckpointTime} but has not checked in yet. Please check in with your driver.`;
      }
    }
  }

  // 7-STAGE STATUS NARRATIVE COPY:
  if (trip.status === 'completed' || trip.status === 'arrived_offloaded') {
    return {
      headline: 'Trip Completed & Offloaded',
      narrative: `Truck ${truckPlate} is back at ${warehouseName} and has been offloaded successfully. Trip completed at ${tripCompletedFormatted}.`,
      stageBadgeText: '7. Completed',
      stageColor: 'emerald',
      isOverdue: false,
      overdueWarning: null,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        arrivedSupplier: arrivedSupplierFormatted,
        cargoLoaded: cargoLoadedFormatted,
        loadedDeparted: loadedDepartedFormatted,
        arrivedDestination: arrivedDestinationFormatted,
        expectedReturn: expectedReturnFormatted,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (trip.status === 'arrived_at_destination') {
    return {
      headline: 'Arrived at Destination Depot',
      narrative: `Truck ${truckPlate} arrived at ${warehouseName} gate at ${arrivedDestinationFormatted}. Awaiting final offloading and closure.`,
      stageBadgeText: '6. At Depot Gate',
      stageColor: 'emerald',
      isOverdue: false,
      overdueWarning: null,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        arrivedSupplier: arrivedSupplierFormatted,
        cargoLoaded: cargoLoadedFormatted,
        loadedDeparted: loadedDepartedFormatted,
        arrivedDestination: arrivedDestinationFormatted,
        expectedReturn: expectedReturnFormatted,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (trip.status === 'loaded_departed') {
    return {
      headline: 'Loaded & In-Transit Return',
      narrative: `Truck ${truckPlate} has been dispatched from ${supplierName} and is returning to ${warehouseName}. Expected return by ${expectedReturnFormatted}.`,
      stageBadgeText: '5. Dispatched from Plant',
      stageColor: 'amber',
      isOverdue,
      overdueWarning,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        arrivedSupplier: arrivedSupplierFormatted,
        cargoLoaded: cargoLoadedFormatted,
        loadedDeparted: loadedDepartedFormatted,
        arrivedDestination: arrivedDestinationFormatted,
        expectedReturn: expectedReturnFormatted,
        expectedNextCheckpointTime,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (trip.status === 'cargo_loaded') {
    return {
      headline: 'Cargo Loaded & Sealed',
      narrative: `Truck ${truckPlate} has been loaded at ${supplierName}${trip.waybill_number ? ` (Waybill: ${trip.waybill_number})` : ''}. Awaiting plant exit clearance.`,
      stageBadgeText: '4. Cargo Loaded',
      stageColor: 'purple',
      isOverdue: false,
      overdueWarning: null,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        arrivedSupplier: arrivedSupplierFormatted,
        cargoLoaded: cargoLoadedFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedReturn: expectedReturnFormatted,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (trip.status === 'arrived_at_supplier') {
    return {
      headline: 'Arrived at Supplier Plant',
      narrative: `Truck ${truckPlate} checked in at ${supplierName} at ${arrivedSupplierFormatted}. Queued for loading bay.`,
      stageBadgeText: '3. At Plant Gate',
      stageColor: 'blue',
      isOverdue: false,
      overdueWarning: null,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        arrivedSupplier: arrivedSupplierFormatted,
        cargoLoaded: cargoLoadedFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedReturn: expectedReturnFormatted,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (trip.status === 'left_warehouse') {
    return {
      headline: 'En Route to Supplier Plant',
      narrative: `Truck ${truckPlate} departed from ${warehouseName} at ${leftWarehouseFormatted} and is on highway transit to ${supplierName}.`,
      stageBadgeText: '2. En Route to Plant',
      stageColor: 'blue',
      isOverdue,
      overdueWarning,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        arrivedSupplier: arrivedSupplierFormatted,
        cargoLoaded: cargoLoadedFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedReturn: expectedReturnFormatted,
        expectedNextCheckpointTime,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  // Fallback for pending_payment / created / trip_created (Stage 1)
  return {
    headline: '1. Trip Booked & Assigned',
    narrative: `Truck ${truckPlate} has been booked by management for haulage to ${supplierName}. Awaiting origin gate dispatch.`,
    stageBadgeText: '1. Trip Booked',
    stageColor: 'slate',
    isOverdue: false,
    overdueWarning: null,
    formattedTimes: {
      tripStarted: tripStartedFormatted,
      leftWarehouse: leftWarehouseFormatted,
      expectedReturn: expectedReturnFormatted,
      tripCompleted: tripCompletedFormatted
    }
  };
}
