import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, Flashlight, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface LiveCameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, fileName: string) => void;
  title?: string;
  documentType?: 'id' | 'cac' | 'general';
}

export const LiveCameraCaptureModal: React.FC<LiveCameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Live Document Camera',
  documentType = 'id'
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setCameraError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (facing: 'environment' | 'user') => {
    setIsLoading(true);
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera streaming is not supported on this browser. You can use direct file/photo capture.');
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }

      // Check for torch capability
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? (videoTrack.getCapabilities() as any) : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }

      setIsLoading(false);
    } catch (err: any) {
      console.warn('Direct camera stream failed, falling back:', err);
      setIsLoading(false);
      setCameraError(err.message || 'Could not access device camera. You can snap using the system camera picker below.');
    }
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !torchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Torch error:', e);
      }
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = String(event.target?.result || '');
        setCapturedImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmAndSave = () => {
    if (!capturedImage) return;
    const timestamp = Date.now();
    const docName = documentType === 'id' ? `Live_ID_Snap_${timestamp}.jpg` : `Live_CAC_Snap_${timestamp}.jpg`;
    onCapture(capturedImage, docName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">{title}</h3>
              <p className="text-[10px] text-slate-400 font-medium">Position document clearly inside the frame</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="relative flex-1 bg-black min-h-[360px] flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            /* Review Captured Photo */
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <img
                src={capturedImage}
                alt="Captured Document"
                className="max-h-[380px] w-auto max-w-full rounded-2xl border-2 border-emerald-500 shadow-2xl object-contain"
              />
              <div className="mt-3 flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700">
                <Check className="w-3.5 h-3.5" />
                <span>Photo Captured Clear & Ready</span>
              </div>
            </div>
          ) : cameraError ? (
            /* Camera Fallback / Error State */
            <div className="p-6 text-center space-y-4 max-w-xs text-slate-300">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Browser Camera Permission Required</p>
                <p className="text-[11px] text-slate-400 mt-1">{cameraError}</p>
              </div>

              <div className="pt-2">
                <label className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-colors">
                  <Camera className="w-4 h-4" />
                  <span>Open System Camera / Gallery</span>
                  <input
                    ref={fileFallbackRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFallbackFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            /* Live Camera Viewfinder */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover min-h-[360px]"
              />

              {/* ID Card Target Frame Overlay */}
              <div className="absolute inset-4 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-full max-w-[340px] aspect-[1.58/1] border-2 border-dashed border-emerald-400/90 rounded-2xl bg-emerald-500/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col items-center justify-between p-3 relative">
                  <div className="w-full flex justify-between text-[9px] font-black text-emerald-300 tracking-wider uppercase">
                    <span>{documentType === 'id' ? 'NIN / National ID' : 'CAC Certificate'}</span>
                    <span>Align Edges</span>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] font-bold text-white/90 bg-slate-900/80 px-2.5 py-1 rounded-full backdrop-blur-xs">
                      Hold phone steady & avoid glare
                    </p>
                  </div>

                  <div className="w-full flex justify-center">
                    <div className="h-0.5 w-16 bg-emerald-400/60 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Camera Overlays / Controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                      torchOn ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-900/70 text-white hover:bg-slate-800'
                    }`}
                    title="Toggle Flashlight"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="w-10 h-10 rounded-full bg-slate-900/70 text-white hover:bg-slate-800 backdrop-blur-md flex items-center justify-center transition-colors"
                  title="Switch Front/Back Camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 bg-slate-850 border-t border-slate-800">
          {capturedImage ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  startCamera(facingMode);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retake Photo</span>
              </button>
              <button
                type="button"
                onClick={confirmAndSave}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Use This Photo</span>
              </button>
            </div>
          ) : !cameraError ? (
            <div className="flex items-center justify-between gap-4">
              <label className="text-[11px] font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer p-2">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span>Choose Gallery/File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFallbackFile}
                  className="hidden"
                />
              </label>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isLoading}
                className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 p-1.5 shadow-2xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                title="Take Photo"
              >
                <div className="w-full h-full rounded-full border-2 border-slate-900 bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-200 p-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
