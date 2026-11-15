import React from 'react';
import { PageHeader } from '../../components/ui';
import ParkingStationPanel from '../../components/ParkingStationPanel';
import StaffBarrierPanel from '../../components/StaffBarrierPanel';

export default function HardwareStation() {
  return <div className="max-w-5xl space-y-5 animate-fadein">
    <PageHeader title="Hardware & Station" subtitle="Check four parking sensors, OLED guidance and the miniature gate controller" />
    <ParkingStationPanel mode="setup" />
    <StaffBarrierPanel mode="full" />
  </div>;
}
