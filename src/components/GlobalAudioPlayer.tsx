import React, { useState, useEffect, useRef } from "react";
import { useAudioPlayer } from "../App";

import { useNavigate } from "react-router-dom";

export const GlobalAudioPlayer = ({ setLightboxImage }: { setLightboxImage?: (image: { url: string, title?: string } | null) => void }) => {
  const { currentTrack, isPlaying, togglePlayPause, playNext, playPrevious } = useAudioPlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      audio.volume = volume;
      setIsLoading(false);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: any) => {
      console.error("Audio playback error:", e);
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', playNext);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', playNext);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [currentTrack, playNext, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Playback failed:", error);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  const formatTime = (time: number) => {
    if (time && !isNaN(time)) {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      const formatSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
      return `${minutes}:${formatSeconds}`;
    }
    return '0:00';
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = Number(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !isMuted;
    audio.muted = newMuted;
    setIsMuted(newMuted);
    if (newMuted) {
      setVolume(0);
    } else {
      setVolume(audio.volume || 1);
    }
  };

  const [isExpanded, setIsExpanded] = useState(false);

  if (!currentTrack) return null;

  const getTrackAudioUrl = () => {
    if (currentTrack.audioUrl) return currentTrack.audioUrl;
    if (currentTrack.soundcloudUrl) return `/api/soundcloud/stream?url=${encodeURIComponent(currentTrack.soundcloudUrl)}`;
    return "";
  };

  return (
    <div 
      className={`fixed bottom-4 left-4 right-4 bg-[#181818] rounded-2xl border border-[#282828] z-50 px-4 py-3 shadow-2xl transition-all duration-300 ${isExpanded ? 'h-auto' : 'h-16 md:h-24'}`}
      onClick={() => window.innerWidth < 768 && setIsExpanded(!isExpanded)}
    >
      <audio ref={audioRef} src={getTrackAudioUrl()} preload="metadata" />
      
      {/* Compact View (Always visible) */}
      <div className="flex items-center justify-between gap-4 h-full">
        <div className="flex items-center gap-3 min-w-0 flex-grow md:w-1/3">
          <div 
            className={`w-10 h-10 md:w-14 md:h-14 bg-[#282828] rounded overflow-hidden flex-shrink-0 shadow-md ${currentTrack.coverUrl && setLightboxImage ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (currentTrack.coverUrl && setLightboxImage) {
                setLightboxImage({ url: currentTrack.coverUrl, title: currentTrack.title });
              }
            }}
          >
            {currentTrack.coverUrl ? (
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h4 
              className="text-sm font-medium text-white truncate cursor-pointer hover:underline"
              onClick={() => navigate(`/tracks/${currentTrack.id}`)}
            >
              {currentTrack.title}
            </h4>
            <p 
              className="text-xs text-[#b3b3b3] truncate cursor-pointer hover:underline"
              onClick={() => navigate(`/artists/${currentTrack.artist}`)}
            >
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* Desktop Controls (Always visible) */}
        <div className="hidden md:flex flex-col items-center justify-center flex-grow max-w-3xl gap-2 px-4">
          <div className="flex items-center gap-5">
            <button onClick={(e) => { e.stopPropagation(); playPrevious(); }} className="text-[#b3b3b3] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <button onClick={(e) => { e.stopPropagation(); playNext(); }} className="text-[#b3b3b3] hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 w-full text-xs text-[#b3b3b3]">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-grow group relative flex items-center h-6 cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full h-2 bg-[#4d4d4d] rounded-full overflow-hidden group-hover:bg-[#5a5a5a] transition-colors">
                <div 
                  className="h-full bg-white group-hover:bg-[#3b82f6] rounded-full transition-colors relative" 
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} 
                />
              </div>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume Slider (Desktop) */}
        <div className="hidden md:flex items-center gap-2 w-1/3 justify-end">
          <button onClick={toggleMute} className="text-[#b3b3b3] hover:text-white flex-shrink-0">
            {isMuted || volume === 0 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19 9l-4 4m0-4l4 4"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>
          <div className="group relative flex items-center h-6 cursor-pointer w-32">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-2 bg-[#4d4d4d] rounded-full overflow-hidden group-hover:bg-[#5a5a5a] transition-colors">
              <div 
                className="h-full bg-white group-hover:bg-[#3b82f6] rounded-full transition-colors relative" 
                style={{ width: `${volume * 100}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Mobile Play/Pause (Only visible when NOT expanded) */}
        <button 
          onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
          className={`md:hidden w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform flex-shrink-0 ${isExpanded ? 'hidden' : 'flex'}`}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
      </div>

      {/* Expanded View (Mobile Only) */}
      <div className={`md:hidden mt-4 space-y-4 ${isExpanded ? 'block' : 'hidden'}`}>
        <div className="flex items-center justify-center gap-5">
          <button onClick={(e) => { e.stopPropagation(); playPrevious(); }} className="text-[#b3b3b3] hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
            className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full"
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
          </button>
          <button onClick={(e) => { e.stopPropagation(); playNext(); }} className="text-[#b3b3b3] hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="flex items-center gap-2 w-full text-xs text-[#b3b3b3]">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-grow group relative flex items-center h-10 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-3 bg-[#4d4d4d] rounded-full overflow-visible relative">
              <div 
                className="h-full bg-white rounded-full" 
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} 
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#3b82f6] rounded-full shadow-md -ml-2"
                style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
          </div>
          <span>{formatTime(duration)}</span>
        </div>
        
        {/* Volume Slider (Mobile) */}
        <div className="flex items-center gap-2 w-full text-xs text-[#b3b3b3] pt-2">
          <button onClick={toggleMute} className="text-[#b3b3b3] hover:text-white flex-shrink-0">
            {isMuted || volume === 0 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19 9l-4 4m0-4l4 4"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>
          <div className="flex-grow group relative flex items-center h-10 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-3 bg-[#4d4d4d] rounded-full overflow-visible relative">
              <div 
                className="h-full bg-white rounded-full" 
                style={{ width: `${volume * 100}%` }} 
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#3b82f6] rounded-full shadow-md -ml-2"
                style={{ left: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Album Info Button (Mobile) */}
        {currentTrack.album && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                navigate(`/albums/${currentTrack.album}`); 
              }}
              className="flex items-center gap-2 text-[#b3b3b3] hover:text-white text-xs uppercase tracking-widest"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              View Album
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
