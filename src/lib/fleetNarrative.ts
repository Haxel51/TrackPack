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
  status: 'pending_payment' | 'left_warehouse' | 'loaded_departed' | 'completed' | string;
  park_name?: string | null;
  origin_name?: string | null;
  created_at?: string | null;
  left_warehouse_at?: string | null;
  loaded_departed_at?: string | null;
  arrived_offloaded_at?: string | null;
  expected_duration_minutes?: number | null;
}

export interface FleetNarrativeResult {
  headline: string;
  narrative: string;
  stageBadgeText: string;
  stageColor: 'slate' | 'blue' | 'amber' | 'emerald';
  isOverdue: boolean;
  overdueWarning?: string | null;
  formattedTimes: {
    tripStarted?: string;
    leftWarehouse?: string;
    loadedDeparted?: string;
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
 * Calculates human readable narrative and overdue warnings for a fleet trip.
 */
export function getFleetTripNarrative(trip: FleetTripNarrativeInput): FleetNarrativeResult {
  const truckPlate = trip.truck_number?.trim() || 'Assigned Truck';
  const warehouseName = trip.origin_name?.trim() || trip.park_name?.trim() || 'Origin Depot';
  const supplierName = trip.supplier_name?.trim() || 'Supplier Depot';

  const defaultDurationMins = trip.expected_duration_minutes || 180; // 3 hours default round-trip duration

  // Format times
  const startTimeRaw = trip.left_warehouse_at || trip.created_at;
  const tripStartedFormatted = formatTripTime(startTimeRaw);
  const leftWarehouseFormatted = formatTripTime(trip.left_warehouse_at);
  const loadedDepartedFormatted = formatTripTime(trip.loaded_departed_at);
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
  // Triggered when 1+ hour (3600000 ms) past the expected checkpoint timestamp
  let isOverdue = false;
  let overdueWarning: string | null = null;
  let expectedNextCheckpointTime = 'N/A';
  const nowMs = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  if (trip.status === 'left_warehouse' && trip.left_warehouse_at) {
    const leftMs = new Date(trip.left_warehouse_at).getTime();
    if (!isNaN(leftMs)) {
      // Expected arrival at supplier is roughly half of trip duration (e.g. 90 mins)
      const legDurationMs = (defaultDurationMins / 2) * 60 * 1000;
      const expectedSupplierArrivalMs = leftMs + legDurationMs;
      expectedNextCheckpointTime = formatTripTime(new Date(expectedSupplierArrivalMs));

      if (nowMs > expectedSupplierArrivalMs + ONE_HOUR_MS) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} was expected at ${supplierName} by ${expectedNextCheckpointTime} but has not been confirmed yet. Please check in with your driver.`;
      }
    }
  } else if (trip.status === 'loaded_departed' && trip.loaded_departed_at) {
    const loadedMs = new Date(trip.loaded_departed_at).getTime();
    if (!isNaN(loadedMs)) {
      // Expected return to warehouse
      const legDurationMs = (defaultDurationMins / 2) * 60 * 1000;
      const expectedWarehouseArrivalMs = loadedMs + legDurationMs;
      expectedNextCheckpointTime = formatTripTime(new Date(expectedWarehouseArrivalMs));

      if (nowMs > expectedWarehouseArrivalMs + ONE_HOUR_MS) {
        isOverdue = true;
        overdueWarning = `Truck ${truckPlate} was expected at ${warehouseName} by ${expectedNextCheckpointTime} but has not been confirmed yet. Please check in with your driver.`;
      }
    }
  }

  // BUILD EXACT STATUS NARRATIVE COPY:
  if (trip.status === 'completed' || trip.status === 'arrived_offloaded') {
    return {
      headline: 'Trip Completed & Offloaded',
      narrative: `Truck ${truckPlate} is back and has been offloaded successfully. Trip completed at ${tripCompletedFormatted}.`,
      stageBadgeText: 'Completed',
      stageColor: 'emerald',
      isOverdue: false,
      overdueWarning: null,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedReturn: expectedReturnFormatted,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (trip.status === 'loaded_departed') {
    return {
      headline: 'Loaded & Returning',
      narrative: `Truck ${truckPlate} has been loaded at ${supplierName} and is now heading back. Expected return by ${expectedReturnFormatted}.`,
      stageBadgeText: 'Loaded @ Factory',
      stageColor: 'amber',
      isOverdue,
      overdueWarning,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedReturn: expectedReturnFormatted,
        expectedNextCheckpointTime,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  if (trip.status === 'left_warehouse') {
    return {
      headline: 'En Route to Factory',
      narrative: `Truck ${truckPlate} has departed from ${warehouseName} and is on its way to ${supplierName}. Trip started at ${tripStartedFormatted}.`,
      stageBadgeText: 'Left Warehouse',
      stageColor: 'blue',
      isOverdue,
      overdueWarning,
      formattedTimes: {
        tripStarted: tripStartedFormatted,
        leftWarehouse: leftWarehouseFormatted,
        loadedDeparted: loadedDepartedFormatted,
        expectedReturn: expectedReturnFormatted,
        expectedNextCheckpointTime,
        tripCompleted: tripCompletedFormatted
      }
    };
  }

  // Fallback for pending_payment / initiated
  return {
    headline: 'Trip Initiated',
    narrative: `Truck ${truckPlate} is scheduled for haulage to ${supplierName} from ${warehouseName}. Awaiting departure confirmation.`,
    stageBadgeText: 'Initiated',
    stageColor: 'slate',
    isOverdue: false,
    overdueWarning: null,
    formattedTimes: {
      tripStarted: tripStartedFormatted,
      leftWarehouse: leftWarehouseFormatted,
      loadedDeparted: loadedDepartedFormatted,
      expectedReturn: expectedReturnFormatted,
      tripCompleted: tripCompletedFormatted
    }
  };
}
