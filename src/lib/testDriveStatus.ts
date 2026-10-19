interface DriveStage {
  status?: string | null;
  key_handed_at?: string | null;
  security_checked_in_at?: string | null;
}

export function getTestDriveStatus(drive: DriveStage): string {
  const status = drive.status || 'scheduled';
  if (drive.key_handed_at && !drive.security_checked_in_at &&
      ['scheduled', 'confirmed', 'rescheduled', 'show'].includes(status)) {
    return 'key_assigned';
  }
  return status;
}

export function getTestDriveStatusLabel(drive: DriveStage): string {
  return getTestDriveStatus(drive).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
