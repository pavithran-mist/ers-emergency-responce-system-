import React from 'react';
import { Camera, Incident } from '../types';
import { X, MapPin, Navigation, Compass, ExternalLink, ShieldCheck } from 'lucide-react';

interface LocationMapModalProps {
  camera?: Camera | null;
  incident?: Incident | null;
  onClose: () => void;
}

export const LocationMapModal: React.FC<LocationMapModalProps> = ({
  camera,
  incident,
  onClose,
}) => {
  if (!camera && !incident) return null;

  const title = incident ? `Incident Location: ${incident.incident_id}` : `Camera Location: ${camera?.camera_id}`;
  const cameraName = incident?.camera_name || camera?.name || 'Registered Camera';
  const locationAddress = incident?.location || camera?.location || 'Address not registered';
  const latitude = incident?.latitude ?? camera?.latitude;
  const longitude = incident?.longitude ?? camera?.longitude;
  const landmark = incident?.landmark || camera?.landmark;
  const zone = incident?.zone || camera?.zone;

  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  // OpenStreetMap embed URL or Google Maps link
  const osmEmbedUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.008}%2C${longitude + 0.01}%2C${latitude + 0.008}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : null;

  const externalMapUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationAddress)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{title}</h2>
              <p className="text-xs text-slate-400">{cameraName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Registered Address</div>
              <div className="text-slate-200 font-sans font-medium">{locationAddress}</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">GPS Coordinates</div>
              <div className="text-cyan-300 font-bold">
                {hasCoords ? `${latitude.toFixed(6)}° N, ${longitude.toFixed(6)}° E` : 'Coordinates not specified'}
              </div>
            </div>

            {landmark && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Landmark / Vicinity</div>
                <div className="text-slate-300 font-sans">{landmark}</div>
              </div>
            )}

            {zone && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Jurisdiction / Zone</div>
                <div className="text-slate-300 font-sans">{zone}</div>
              </div>
            )}
          </div>

          {/* Interactive Map Embed */}
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
            {osmEmbedUrl ? (
              <iframe
                title="Location Map"
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
            ) : (
              <div className="text-center p-6 text-slate-500">
                <Compass className="w-10 h-10 mx-auto mb-2 opacity-50 text-cyan-400" />
                <p className="text-sm font-semibold text-slate-300">Displaying Configured Address</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">{locationAddress}</p>
              </div>
            )}
          </div>

          {/* Privacy Note & Open in External Map */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400 gap-3">
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Location belongs to fixed camera coordinates. No individual tracking enabled.</span>
            </div>

            <a
              href={externalMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 mr-1" />
              <span>Open in External Map</span>
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
