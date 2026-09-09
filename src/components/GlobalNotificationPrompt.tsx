import React from 'react';
import { FleetNotificationPromptOverlay } from '../modules/fleetTracking/components/FleetNotificationPromptOverlay';
import { AndroidNotificationGuideModal } from './AndroidNotificationGuideModal';

export const GlobalNotificationPrompt: React.FC = () => {
  return (
    <>
      <FleetNotificationPromptOverlay />
      <AndroidNotificationGuideModal />
    </>
  );
};

