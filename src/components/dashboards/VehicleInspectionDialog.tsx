import { useEffect, useRef, useState } from 'react';
import { apiDbQuery } from '@/lib/apiClient';
import { uploadToStorage } from '@/lib/storageClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Camera, ClipboardCheck, Car, Upload, Video, StopCircle, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { logStaffActivity } from '@/lib/activityLogger';
import { APP_ROLE } from '@/constants/roles';

interface VehicleInspectionDialogProps {
  open: boolean;
  onClose: () => void;
  testDrive: any;
  type: 'pre' | 'post';
  onComplete: () => void;
}

const FUEL_LEVELS = ['Full', '3/4', '1/2', '1/4', 'Empty'];

const VehicleInspectionDialog = ({ open, onClose, testDrive, type, onComplete }: VehicleInspectionDialogProps) => {
  const { toast } = useToast();
  const { user, profile, role } = useAuth();
  const [km, setKm] = useState('');
  const [scratches, setScratches] = useState('');
  const [notes, setNotes] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const isPre = type === 'pre';
  const title = isPre ? 'Pre-Drive Vehicle Inspection' : 'Post-Drive Vehicle Inspection';
  const description = isPre
    ? 'Record the vehicle condition before the test drive begins'
    : 'Record the vehicle condition after the test drive is completed';

  const stopCamera = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setRecording(false);
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async (mode: 'photo' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: mode === 'video',
      });
      streamRef.current = stream;
      setCaptureMode(mode);
      setCameraOpen(true);
      setRecording(false);
      mediaChunksRef.current = [];

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error: any) {
      toast({
        title: 'Camera access failed',
        description: error?.message || 'Allow camera permission to capture media',
        variant: 'destructive',
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `inspection-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setMediaFiles((prev) => [...prev, file]);
      toast({ title: 'Photo captured' });
    }, 'image/jpeg', 0.92);
  };

  const toggleVideoRecording = () => {
    if (!streamRef.current) return;

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: 'video/webm' });
        if (blob.size > 0) {
          const file = new File([blob], `inspection-video-${Date.now()}.webm`, { type: 'video/webm' });
          setMediaFiles((prev) => [...prev, file]);
          toast({ title: 'Video captured' });
        }
        mediaChunksRef.current = [];
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
    } catch (error: any) {
      toast({
        title: 'Video recording failed',
        description: error?.message || 'Could not start video recording',
        variant: 'destructive',
      });
    }
  };

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = Array.from(event.target.files || []);
    if (!pickedFiles.length) return;

    const validFiles: File[] = [];
    for (const file of pickedFiles) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        toast({ title: 'Invalid file type', description: `${file.name} is not an image or video`, variant: 'destructive' });
        continue;
      }

      const maxSize = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds ${isVideo ? '100MB' : '15MB'} limit`,
          variant: 'destructive',
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length) {
      setMediaFiles((prev) => [...prev, ...validFiles]);
    }

    event.target.value = '';
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!km) {
      toast({ title: 'Odometer reading is required', variant: 'destructive' });
      return;
    }

    if (!isPre && testDrive.pre_drive_km != null && parseFloat(km) < parseFloat(testDrive.pre_drive_km)) {
      toast({ title: 'Invalid odometer reading', description: `Post-drive km cannot be less than pre-drive km (${testDrive.pre_drive_km} km).`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const inspectedBy = profile?.full_name || 'Security';
      const inspectedByPhone = profile?.phone || null;
      const inspectorNote = inspectedByPhone ? `Inspected by: ${inspectedBy} (${inspectedByPhone})` : `Inspected by: ${inspectedBy}`;
      const combinedNotes = [notes?.trim(), inspectorNote].filter(Boolean).join('\n');

      if (mediaFiles.length > 0) {
        const uploads = mediaFiles.map(async (file, index) => {
          const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
          const safeExt = ext?.toLowerCase() || 'bin';
          const path = `test-drives/${testDrive.id}/inspection-${type}-${Date.now()}-${index}.${safeExt}`;

          await uploadToStorage('documents', path, file);
          return path;
        });

        await Promise.all(uploads);
      }

      const updateData: Record<string, any> = isPre
        ? {
            pre_drive_km: parseFloat(km),
            pre_drive_scratches: scratches || null,
            pre_drive_notes: combinedNotes || null,
            pre_drive_fuel_level: fuelLevel || null,
          }
        : {
            post_drive_km: parseFloat(km),
            post_drive_scratches: scratches || null,
            post_drive_notes: combinedNotes || null,
            post_drive_fuel_level: fuelLevel || null,
            inspection_submitted_at: new Date().toISOString(),
          };

      await apiDbQuery({
        table: 'test_drives',
        action: 'update',
        payload: updateData as any,
        filters: [{ field: 'id', op: 'eq', value: testDrive.id }],
      });
      if (user?.id) {
        await logStaffActivity({
          userId: user.id,
          profileId: profile?.id,
          locationId: profile?.location_id,
          role,
          eventType: isPre ? 'vehicle_inspection_pre' : 'vehicle_inspection_post',
          label: isPre ? 'Recorded pre-drive inspection' : 'Recorded post-drive inspection',
          metadata: {
            testDriveId: testDrive.id,
            odometerKm: parseFloat(km),
            fuelLevel: fuelLevel || null,
            mediaCount: mediaFiles.length,
            inspectedByProfileId: profile?.id,
            inspectedBy,
            inspectedByPhone,
          },
        });
      }
      toast({ title: `${isPre ? 'Pre' : 'Post'}-drive inspection saved` });
      setKm('');
      setScratches('');
      setNotes('');
      setFuelLevel('');
      setMediaFiles([]);
      onComplete();
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to save inspection', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!testDrive) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) { stopCamera(); onClose(); } }}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-3 flex items-center gap-3">
          <Car className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm text-foreground">
              {testDrive.vehicles?.brand} {testDrive.vehicles?.model}
            </p>
            <p className="text-xs text-muted-foreground">
              {testDrive.vehicles?.registration_number} • {testDrive.vehicles?.color}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Odometer Reading (km) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              placeholder="e.g. 12500"
              value={km}
              min={!isPre && testDrive.pre_drive_km != null ? testDrive.pre_drive_km : undefined}
              onChange={e => setKm(e.target.value)}
              className={!isPre && testDrive.pre_drive_km != null && km && parseFloat(km) < parseFloat(testDrive.pre_drive_km) ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {!isPre && testDrive.pre_drive_km != null && (
              <p className="text-xs text-muted-foreground">Pre-drive reading: <span className="font-medium text-foreground">{testDrive.pre_drive_km} km</span> — post-drive must be ≥ this value.</p>
            )}
            {!isPre && testDrive.pre_drive_km != null && km && parseFloat(km) < parseFloat(testDrive.pre_drive_km) && (
              <p className="text-xs text-destructive font-medium">⚠ Post-drive km cannot be less than pre-drive km ({testDrive.pre_drive_km} km).</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fuel / Battery Level</Label>
            <Select value={fuelLevel} onValueChange={setFuelLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {FUEL_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scratches / Damage</Label>
            <Textarea
              placeholder="Describe any existing scratches, dents, or damage..."
              value={scratches}
              onChange={e => setScratches(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              placeholder="Any other observations..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Inspection Media (Photos / Videos)</Label>
            <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => void startCamera('photo')}>
                  <Camera className="h-4 w-4 mr-1" /> Camera Photo
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => void startCamera('video')}>
                  <Video className="h-4 w-4 mr-1" /> Camera Video
                </Button>
                <Label htmlFor={`inspection-media-${type}`} className="cursor-pointer">
                  <Button type="button" variant="outline" asChild className="w-full">
                    <span><Upload className="h-4 w-4 mr-1" /> Upload Media</span>
                  </Button>
                </Label>
              </div>
              <input
                id={`inspection-media-${type}`}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handleMediaSelect}
              />
              <p className="text-xs text-muted-foreground">Allowed: Images (max 15MB each), Videos (max 100MB each)</p>

              {cameraOpen && (
                <div className="rounded-lg border border-border p-2 space-y-2">
                  <video ref={videoRef} className="w-full rounded-md bg-black max-h-[300px] object-contain" playsInline muted autoPlay />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex flex-wrap gap-2">
                    {captureMode === 'photo' ? (
                      <Button type="button" onClick={capturePhoto} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Camera className="h-4 w-4 mr-1" /> Capture Photo
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={toggleVideoRecording}
                        className={recording ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}
                      >
                        {recording ? <StopCircle className="h-4 w-4 mr-1" /> : <Video className="h-4 w-4 mr-1" />}
                        {recording ? 'Stop Recording' : 'Start Recording'}
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={stopCamera}>Close Camera</Button>
                  </div>
                </div>
              )}

              {mediaFiles.length > 0 && (
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {mediaFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-xs">
                      <span className="truncate text-foreground">{file.name}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => removeMediaFile(index)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <ClipboardCheck className="h-4 w-4 mr-1" />
            {submitting ? 'Saving...' : 'Submit Inspection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleInspectionDialog;
