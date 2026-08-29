export type FleetRole = 'ceo' | 'manager' | 'trip_monitor' | 'driver' | 'unknown';

/**
 * Resolves the normalized fleet role from user object and auth role state.
 */
export function getFleetRole(user: any, authRole?: string | null): FleetRole {
  const roleStr = String(authRole || user?.role || user?.userRole || '').toLowerCase().trim();
  const managerType = String(user?.manager_type || '').toLowerCase().trim();

  // CEO / Company Owner / Admin
  if (
    roleStr === 'company' ||
    roleStr === 'admin' ||
    managerType === 'ceo' ||
    managerType === 'owner' ||
    managerType === 'company'
  ) {
    return 'ceo';
  }

  // Driver
  if (roleStr === 'driver' || managerType === 'driver') {
    return 'driver';
  }

  // Trip Monitor
  if (
    roleStr === 'trip_monitor' ||
    roleStr === 'trip monitor' ||
    managerType === 'trip monitor' ||
    managerType === 'trip_monitor' ||
    managerType === 'monitor'
  ) {
    return 'trip_monitor';
  }

  // Manager (General / Operations / Park Manager)
  if (roleStr === 'manager' || managerType === 'manager') {
    return 'manager';
  }

  return 'unknown';
}

export const FleetPermissions = {
  // Trips
  canCreateTrip: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canConfirmDeparture: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canRedirectTrip: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager' || fleetRole === 'trip_monitor',
  canRedirect: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager' || fleetRole === 'trip_monitor',
  canMarkTripLoaded: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager' || fleetRole === 'trip_monitor',
  canMarkLoaded: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager' || fleetRole === 'trip_monitor',
  canViewTrips: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager' || fleetRole === 'trip_monitor',
  canViewLiveMap: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager' || fleetRole === 'trip_monitor',

  // Team
  canAccessTeam: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canAddManager: (fleetRole: FleetRole) => fleetRole === 'ceo',
  canAddTripMonitor: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canAddDriver: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canManageTeamStatus: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canDeactivateManager: (fleetRole: FleetRole) => fleetRole === 'ceo',
  canDeleteTeamMember: (fleetRole: FleetRole) => fleetRole === 'ceo',

  // Trucks
  canAccessTrucks: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canManageTrucks: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canCreateTruck: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canEditTruck: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canDeleteTruck: (fleetRole: FleetRole) => fleetRole === 'ceo',

  // Suppliers / Locations
  canAccessSuppliers: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canManageSuppliers: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canCreateSupplier: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canEditSupplier: (fleetRole: FleetRole) => fleetRole === 'ceo' || fleetRole === 'manager',
  canDeleteSupplier: (fleetRole: FleetRole) => fleetRole === 'ceo',

  // Billing & Payment Plan Settings
  canAccessBilling: (fleetRole: FleetRole) => fleetRole === 'ceo',
};
