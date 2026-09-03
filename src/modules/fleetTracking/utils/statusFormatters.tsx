import React from 'react';

/**
 * Human-Friendly Display Text & Color Mappings for Fleet Tracking
 * Note: Database internal codes remain intact (e.g. "in_progress", "departed", etc.)
 */

export interface StatusBadgeConfig {
  label: string;
  bg: string;
  dot?: string;
  textColor?: string;
  icon?: string;
}

// 1. TRIP STATUS FORMATTER
export function getHumanTripStatus(status?: string, isRedirected?: boolean, stoppedDurationMinutes?: number): string {
  if (isRedirected || status === 'redirected') {
    return 'Redirected to New Destination';
  }
  switch (status) {
    case 'created':
      return 'Trip Scheduled';
    case 'payment_pending':
      return 'Awaiting Payment';
    case 'payment_confirmed':
      return 'Payment Confirmed — Ready to Go';
    case 'departed':
      return 'Truck Has Left the Garage';
    case 'in_progress':
      return 'Currently on the Road';
    case 'arrived_at_supplier':
      return 'Arrived at Supplier';
    case 'loaded':
      return 'Goods Loaded — Heading to Destination';
    case 'stopped':
    case 'stopped_warning':
    case 'stopped_alert':
      return 'Truck Has Stopped';
    case 'arrived_at_destination':
    case 'arrived':
      return 'Delivered to Destination';
    case 'returning':
      return 'Heading Back to Garage';
    case 'completed':
      return 'Trip Completed Successfully';
    case 'cancelled':
      return 'Trip Cancelled';
    default:
      return status ? status.replace(/_/g, ' ') : 'Trip Scheduled';
  }
}

export function getHumanTripStatusBadge(status?: string, isRedirected?: boolean, stoppedDurationMinutes: number = 0): StatusBadgeConfig {
  if (isRedirected || status === 'redirected') {
    return {
      label: 'Redirected to New Destination',
      bg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      dot: 'bg-purple-400',
      textColor: 'text-purple-300',
      icon: '↪️',
    };
  }

  switch (status) {
    case 'created':
      return {
        label: 'Trip Scheduled',
        bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
        dot: 'bg-blue-400',
        textColor: 'text-blue-300',
        icon: '🔵',
      };
    case 'payment_pending':
      return {
        label: 'Awaiting Payment',
        bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        dot: 'bg-yellow-400',
        textColor: 'text-yellow-300',
        icon: '🟡',
      };
    case 'payment_confirmed':
      return {
        label: 'Payment Confirmed — Ready to Go',
        bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
        dot: 'bg-blue-400',
        textColor: 'text-blue-300',
        icon: '🔵',
      };
    case 'departed':
      return {
        label: 'Truck Has Left the Garage',
        bg: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
        dot: 'bg-orange-400',
        textColor: 'text-orange-300',
        icon: '🟠',
      };
    case 'in_progress':
      return {
        label: 'Currently on the Road',
        bg: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
        dot: 'bg-orange-400',
        textColor: 'text-orange-300',
        icon: '🟠',
      };
    case 'arrived_at_supplier':
      return {
        label: 'Arrived at Supplier',
        bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-300',
        icon: '🟢',
      };
    case 'loaded':
      return {
        label: 'Goods Loaded — Heading to Destination',
        bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-300',
        icon: '🟢',
      };
    case 'stopped_alert':
    case 'stopped':
      if (stoppedDurationMinutes >= 90) {
        return {
          label: 'Truck Has Stopped',
          bg: 'bg-red-500/10 text-red-300 border-red-500/30',
          dot: 'bg-red-400',
          textColor: 'text-red-300',
          icon: '🔴',
        };
      }
      return {
        label: 'Truck Has Stopped',
        bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        dot: 'bg-yellow-400',
        textColor: 'text-yellow-300',
        icon: '🟡',
      };
    case 'stopped_warning':
      return {
        label: 'Truck Has Stopped',
        bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        dot: 'bg-yellow-400',
        textColor: 'text-yellow-300',
        icon: '🟡',
      };
    case 'arrived_at_destination':
    case 'arrived':
      return {
        label: 'Delivered to Destination',
        bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-300',
        icon: '🟢',
      };
    case 'returning':
      return {
        label: 'Heading Back to Garage',
        bg: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
        dot: 'bg-orange-400',
        textColor: 'text-orange-300',
        icon: '🟠',
      };
    case 'completed':
      return {
        label: 'Trip Completed Successfully',
        bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-300',
        icon: '✅',
      };
    case 'cancelled':
      return {
        label: 'Trip Cancelled',
        bg: 'bg-slate-700/40 text-slate-400 border-slate-600',
        dot: 'bg-slate-400',
        textColor: 'text-slate-400',
        icon: '⚪',
      };
    default:
      return {
        label: 'Trip Scheduled',
        bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
        dot: 'bg-blue-400',
        textColor: 'text-blue-300',
        icon: '🔵',
      };
  }
}

// 2. GPS / TRACKING STATUS FORMATTER
export function getHumanGpsStatus(status?: string): string {
  switch (status) {
    case 'gps_lost':
    case 'lost_30min':
    case 'lost_60min':
      return 'Location Signal Lost';
    case 'gps_restored':
    case 'normal':
      return 'Location Signal Restored';
    case 'off_route':
      return 'Truck Took a Different Route';
    default:
      return 'Location Signal Active';
  }
}

export function getHumanGpsStatusBadge(status?: string): StatusBadgeConfig {
  switch (status) {
    case 'gps_lost':
    case 'lost_30min':
    case 'lost_60min':
      return {
        label: 'Location Signal Lost',
        bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        dot: 'bg-yellow-400',
        textColor: 'text-yellow-300',
        icon: '🟡',
      };
    case 'off_route':
      return {
        label: 'Truck Took a Different Route',
        bg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
        dot: 'bg-purple-400',
        textColor: 'text-purple-300',
        icon: '↪️',
      };
    case 'gps_restored':
    case 'normal':
    default:
      return {
        label: 'Location Signal Restored',
        bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-300',
        icon: '🟢',
      };
  }
}

// 3. PAYMENT STATUS FORMATTER
export function getHumanPaymentStatus(status?: string): string {
  switch (status) {
    case 'pending':
    case 'unpaid':
      return 'Payment Required';
    case 'confirmed':
    case 'paid':
    case 'success':
      return 'Payment Confirmed';
    case 'failed':
      return 'Payment Failed';
    default:
      return 'Payment Required';
  }
}

export function getHumanPaymentStatusBadge(status?: string): StatusBadgeConfig {
  switch (status) {
    case 'pending':
    case 'unpaid':
      return {
        label: 'Payment Required',
        bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        dot: 'bg-yellow-400',
        textColor: 'text-yellow-300',
        icon: '🟡',
      };
    case 'confirmed':
    case 'paid':
    case 'success':
      return {
        label: 'Payment Confirmed',
        bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-300',
        icon: '🟢',
      };
    case 'failed':
      return {
        label: 'Payment Failed',
        bg: 'bg-red-500/10 text-red-300 border-red-500/30',
        dot: 'bg-red-400',
        textColor: 'text-red-300',
        icon: '🔴',
      };
    default:
      return {
        label: 'Payment Required',
        bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        dot: 'bg-yellow-400',
        textColor: 'text-yellow-300',
        icon: '🟡',
      };
  }
}

// 4. SUBSCRIPTION STATUS FORMATTER
export function getHumanSubscriptionStatus(plan?: string, activeUntil?: string | null): {
  code: string;
  label: string;
  badge: StatusBadgeConfig;
  subtitle: string;
} {
  if (plan === 'per_trip') {
    return {
      code: 'per_trip',
      label: 'Pay Per Trip',
      badge: {
        label: 'Pay Per Trip',
        bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        dot: 'bg-blue-400',
        textColor: 'text-blue-400',
      },
      subtitle: '₦1,000 per activated trip',
    };
  }

  if (!activeUntil) {
    return {
      code: 'monthly_pending',
      label: 'Pending First Payment',
      badge: {
        label: 'Pending First Payment',
        bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        dot: 'bg-yellow-400',
        textColor: 'text-yellow-300',
        icon: '🟡',
      },
      subtitle: 'Plan set • Pending trip activation',
    };
  }

  const expTime = new Date(activeUntil).getTime();
  const isActive = expTime > Date.now();
  const expFormatted = new Date(activeUntil).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (isActive) {
    return {
      code: 'monthly_active',
      label: 'Monthly Plan Active',
      badge: {
        label: 'Monthly Plan Active',
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-400',
        icon: '🟢',
      },
      subtitle: `Active until ${expFormatted}`,
    };
  }

  return {
    code: 'monthly_expired',
    label: 'Monthly Plan Expired',
    badge: {
      label: 'Monthly Plan Expired',
      bg: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
      dot: 'bg-yellow-400',
      textColor: 'text-yellow-300',
      icon: '🟡',
    },
    subtitle: `Expired on ${expFormatted}`,
  };
}

// 5. DRIVER STATUS FORMATTER
export function getHumanDriverStatus(status?: string): string {
  switch (status) {
    case 'online':
    case 'active':
      return 'Driver is Active';
    case 'offline':
      return 'Driver is Offline';
    case 'on_trip':
      return 'Currently on a Trip';
    case 'no_trip':
    case 'idle':
      return 'No Active Trip Assigned';
    default:
      return 'Driver is Active';
  }
}

export function getHumanDriverStatusBadge(status?: string): StatusBadgeConfig {
  switch (status) {
    case 'online':
    case 'active':
      return {
        label: 'Driver is Active',
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
        textColor: 'text-emerald-400',
        icon: '🟢',
      };
    case 'on_trip':
      return {
        label: 'Currently on a Trip',
        bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        dot: 'bg-orange-400',
        textColor: 'text-orange-400',
        icon: '🟠',
      };
    case 'no_trip':
      return {
        label: 'No Active Trip Assigned',
        bg: 'bg-slate-700/40 text-slate-300 border-slate-600',
        dot: 'bg-slate-400',
        textColor: 'text-slate-300',
        icon: '⚪',
      };
    case 'offline':
    default:
      return {
        label: 'Driver is Offline',
        bg: 'bg-slate-700/40 text-slate-400 border-slate-600',
        dot: 'bg-slate-500',
        textColor: 'text-slate-400',
        icon: '⚪',
      };
  }
}

// 6. TRUCK STATUS FORMATTER
export function getHumanTruckStatus(status?: string): string {
  switch (status) {
    case 'active':
    case 'on_trip':
      return 'Currently on a Trip';
    case 'idle':
    case 'available':
      return 'Available — No Active Trip';
    case 'inactive':
      return 'Not in Service';
    default:
      return 'Available — No Active Trip';
  }
}

export function getHumanTruckStatusBadge(status?: string): StatusBadgeConfig {
  switch (status) {
    case 'active':
    case 'on_trip':
      return {
        label: 'Currently on a Trip',
        bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        dot: 'bg-orange-400',
        textColor: 'text-orange-400',
        icon: '🟠',
      };
    case 'inactive':
      return {
        label: 'Not in Service',
        bg: 'bg-slate-700/40 text-slate-400 border-slate-600',
        dot: 'bg-slate-500',
        textColor: 'text-slate-400',
        icon: '⚪',
      };
    case 'idle':
    case 'available':
    default:
      return {
        label: 'Available — No Active Trip',
        bg: 'bg-slate-700/40 text-slate-300 border-slate-600',
        dot: 'bg-slate-400',
        textColor: 'text-slate-300',
        icon: '⚪',
      };
  }
}

// 7. AUDIT LOG FORMATTER
export interface HumanAuditLogEntry {
  statusName: string;
  description: string;
  triggeredBy: string;
  badge: StatusBadgeConfig;
}

export function formatHumanAuditLogEntry(
  rawStatus: string,
  rawTriggeredBy?: string,
  rawNote?: string,
  context?: {
    destinationName?: string;
    supplierName?: string;
    driverName?: string;
    stoppedMinutes?: number;
  }
): HumanAuditLogEntry {
  const destName = context?.destinationName || 'destination';
  const suppName = context?.supplierName || 'supplier';
  const stoppedMins = context?.stoppedMinutes || 30;

  let triggeredBy = 'Updated automatically by the system';
  if (rawTriggeredBy && rawTriggeredBy.toLowerCase() !== 'system') {
    triggeredBy = `Confirmed by ${rawTriggeredBy}`;
  }

  let statusName = getHumanTripStatus(rawStatus);
  let badge = getHumanTripStatusBadge(rawStatus);
  let description = rawNote || '';

  switch (rawStatus) {
    case 'created':
      statusName = 'Trip Scheduled';
      description = description || 'Trip has been scheduled and created in the system.';
      break;
    case 'payment_confirmed':
      statusName = 'Payment Confirmed — Ready to Go';
      description = description || 'Payment has been confirmed and live tracking is activated.';
      break;
    case 'departed':
      statusName = 'Truck Has Left the Garage';
      description = `The truck left the garage and is now on its way to ${destName}.`;
      break;
    case 'in_progress':
      statusName = 'Currently on the Road';
      description = 'The truck is actively moving toward its destination.';
      break;
    case 'arrived_at_supplier':
      statusName = 'Arrived at Supplier';
      description = `The truck has arrived at ${suppName} and is awaiting loading.`;
      break;
    case 'loaded':
      statusName = 'Goods Loaded — Heading to Destination';
      description = `Goods loaded onto the truck. Now heading toward ${destName}.`;
      break;
    case 'stopped':
    case 'stopped_warning':
    case 'stopped_alert':
      statusName = 'Truck Has Stopped';
      description = `The truck has not moved for ${stoppedMins} minutes. Please check on the driver.`;
      break;
    case 'arrived_at_destination':
    case 'arrived':
      statusName = 'Delivered to Destination';
      description = `The truck has successfully arrived at ${destName}.`;
      break;
    case 'returning':
      statusName = 'Heading Back to Garage';
      description = 'The truck has left the destination and is heading back to the garage base.';
      break;
    case 'completed':
      statusName = 'Trip Completed Successfully';
      description = 'The truck has returned to the garage. This trip is now closed.';
      break;
    case 'redirected':
      statusName = 'Redirected to New Destination';
      description = `Trip destination updated to ${destName}.`;
      break;
    default:
      if (!description) {
        description = `Status updated to ${statusName}.`;
      }
      break;
  }

  return {
    statusName,
    description,
    triggeredBy,
    badge,
  };
}

// 8. NOTIFICATION MESSAGE FORMATTERS
export function formatHumanNotification(eventType: string, payload: {
  driverName?: string;
  plateNumber?: string;
  destinationName?: string;
  supplierName?: string;
  stoppedMinutes?: number;
}): { title: string; body: string } {
  const driver = payload.driverName || 'The driver';
  const dest = payload.destinationName || 'destination';
  const supplier = payload.supplierName || 'supplier';
  const mins = payload.stoppedMinutes || 30;

  switch (eventType) {
    case 'in_progress':
    case 'departed':
      return {
        title: '🚛 Truck On The Road',
        body: `🚛 ${driver}'s truck is now on the road heading to ${dest}`,
      };
    case 'arrived_at_supplier':
      return {
        title: '📍 Arrived at Supplier',
        body: `📍 ${driver} has arrived at ${supplier} and is awaiting loading`,
      };
    case 'loaded':
      return {
        title: '📦 Goods Loaded',
        body: `📦 ${driver}'s truck is loaded and heading to ${dest}`,
      };
    case 'stopped_30min':
    case 'stopped_warning':
    case 'stopped':
      return {
        title: '⚠️ Truck Stopped Alert',
        body: `⚠️ ${driver}'s truck hasn't moved for ${mins} minutes. You may want to check in.`,
      };
    case 'stopped_alert':
    case 'stopped_90min':
      return {
        title: '🔴 Critical: Truck Stopped > 90 Min',
        body: `🔴 ${driver}'s truck has been stopped for over 90 minutes. Urgent check-in required.`,
      };
    case 'arrived_at_destination':
    case 'arrived':
      return {
        title: '🎯 Delivered to Destination',
        body: `🎯 ${driver} has successfully arrived at ${dest}`,
      };
    case 'completed':
      return {
        title: '✅ Trip Completed',
        body: `✅ Great news! ${driver} has completed the trip and returned safely to the garage.`,
      };
    case 'redirected':
      return {
        title: '↪️ Redirected to New Destination',
        body: `↪️ ${driver}'s truck has been redirected to ${dest}`,
      };
    case 'gps_lost_30min':
    case 'gps_lost':
      return {
        title: '⚠️ Location Signal Lost',
        body: `⚠️ Location signal for ${driver}'s truck has been lost for 30 minutes.`,
      };
    case 'gps_restored':
      return {
        title: '🟢 Location Signal Restored',
        body: `🟢 Location signal for ${driver}'s truck has been restored.`,
      };
    default:
      return {
        title: 'Fleet Tracking Update',
        body: `Update for ${driver}'s truck on trip to ${dest}.`,
      };
  }
}
