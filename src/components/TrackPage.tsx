import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ExternalLink, Play, Info } from 'lucide-react';
import { useAudioPlayer } from '../App';

const TrackPage = ({ tracks }: { tracks: any[] }) => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const track = tracks.find(t => t.id === trackId);
  const { playTrack } = useAudioPlayer();

  if (!track) {
    return (
      <div className="fixed inset-0 bg-ink text-paper flex items-center justify-center z-50">
        Track not found
      </div>
    );
  }

  const handleViewAlbum = () => {
    if (track.albumId) {
      navigate(`/albums/${track.albumId}`);
    } else {
      alert("This track is not in an album.");
    }
  };

  const handleTrackInfo = () => {
    // Navigate to the music page and pass the track ID to open the info
    navigate('/music', { state: { openTrackInfo: track.id } });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-ink text-paper flex flex-col z-50 overflow-hidden"
    >
      {/* Content */}
      <div className="flex-grow px-4 pb-4 md:px-8 flex flex-col justify-center overflow-hidden">
        <div className="max-w-3xl mx-auto w-full flex flex-col md:flex-row gap-6 items-center">
          {/* Cover Art */}
          <div className="w-48 md:w-64 flex-shrink-0">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="aspect-square bg-card rounded-xl overflow-hidden border border-line/50 shadow-2xl"
            >
              <img 
                src={track.coverUrl || 'https://picsum.photos/seed/music/600/600'} 
                alt={track.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
          
          {/* Details */}
          <div className="flex flex-col text-center md:text-left">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tighter uppercase mb-1">{track.title}</h1>
            <p className="text-md md:text-lg text-paper/60 mb-4">{track.artist}</p>
            
            <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
              <button 
                onClick={() => playTrack(track)}
                className="bg-paper text-ink px-5 py-1.5 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-paper/90 transition-colors flex items-center gap-2"
              >
                <Play className="w-3 h-3" />
                Play
              </button>
              {track.soundcloudUrl && (
                <a 
                  href={track.soundcloudUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center text-paper/60 hover:text-paper transition-colors text-[10px] uppercase tracking-widest"
                >
                  SoundCloud <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>

            <div className="space-y-1 text-paper/80 text-xs max-h-32 overflow-y-auto">
              <p><span className="text-paper/40">Genre:</span> {track.genre}</p>
              <p><span className="text-paper/40">Release Date:</span> {track.releaseDate}</p>
              <p><span className="text-paper/40">Record Label:</span> {track.recordLabel}</p>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => navigate('/music')}
                  className="flex items-center text-paper/60 hover:text-paper transition-colors bg-white/5 px-3 py-1 rounded-full text-[10px]"
                >
                  <ChevronLeft className="w-3 h-3 mr-1" />
                  Back
                </button>
                <button 
                  onClick={handleViewAlbum}
                  className="flex items-center text-paper/60 hover:text-paper transition-colors bg-white/5 px-3 py-1 rounded-full text-[10px]"
                >
                  View in Album
                </button>
                <button 
                  onClick={handleTrackInfo}
                  className="flex items-center text-paper/60 hover:text-paper transition-colors bg-white/5 px-3 py-1 rounded-full text-[10px]"
                >
                  <Info className="w-3 h-3 mr-1" />
                  Info
                </button>
              </div>
              <p className="leading-relaxed pt-1">{track.description}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TrackPage;
