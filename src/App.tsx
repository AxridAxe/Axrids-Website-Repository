/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
  useParams,
  Navigate
} from "react-router-dom";
// ---- Local user type (replaces Firebase Auth User) ----
export interface LocalUser {
  id: string;
  uid: string; // alias for id — keeps existing user.uid references working
  email: string;
  displayName: string;
  alias: string | null;
  role: "admin" | "user";
  photoURL: string | null;
}
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import TrackPage from "./components/TrackPage";
import ArtistPage from "./components/ArtistPage";
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  MoreHorizontal, 
  X, 
  Menu, 
  Mail, 
  Instagram, 
  Youtube, 
  Music as MusicIcon, 
  ExternalLink, 
  ChevronRight, 
  ChevronLeft, 
  ChevronUp,
  ChevronDown,
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  Settings as SettingsIcon, 
  ArrowRight, 
  Download, 
  Lock, 
  Unlock, 
  Calendar, 
  Info, 
  User as UserIcon, 
  LogOut, 
  Search, 
  Send, 
  MessageCircle, 
  Shield, 
  ShieldCheck,
  Globe,
  BarChart3, 
  FileText, 
  Users,
  Sun,
  Moon,
  AlertTriangle,
  Zap,
  Cloud,
  Edit,
  Maximize2,
  GripVertical
} from "lucide-react";

const getDisplayName = (userOrEmail: any, profileOrName?: any) => {
  let email = '';
  let name = '';

  if (typeof userOrEmail === 'string') {
    email = userOrEmail;
    name = profileOrName || '';
  } else {
    email = userOrEmail?.email || profileOrName?.email;
    name = profileOrName?.alias || profileOrName?.displayName || userOrEmail?.displayName || 'Axrid';
  }

  if (email === OWNER_EMAIL) return 'Axrid';
  if (email === TEST_USER_EMAIL) return 'Kurt';
  return name;
};

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface Post {
  id: string;
  title?: string;
  subtitle?: string;
  content: string;
  isVisible: boolean;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: any;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: any;
}

interface UserProfile {
  email: string;
  displayName: string;
  alias?: string;
  role: string;
  photoURL: string;
  createdAt?: any;
  theme?: 'light' | 'dark';
}

import { GlobalAudioPlayer } from "./components/GlobalAudioPlayer";

export interface Album {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  releaseDate?: string;
  description?: string;
  trackIds: string[];
  isVisible: boolean;
  authorId: string;
  createdAt: any;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  audioUrl?: string;
  coverUrl?: string;
  createdAt: any;
  isVisible: boolean;
  authorId: string;
  // New fields from screenshots
  trackLink?: string;
  album?: string;
  genre?: string;
  description?: string;
  privacy?: 'public' | 'private' | 'scheduled';
  // Advanced details
  buyLink?: string;
  recordLabel?: string;
  releaseDate?: string;
  publisher?: string;
  soundcloudUrl?: string;
  isExplicit?: boolean;
  bpm?: number;
  // Permissions
  enableDirectDownloads?: boolean;
  offlineListening?: boolean;
  displayEmbedCode?: boolean;
  allowComments?: boolean;
  showCommentsToPublic?: boolean;
  // Licensing
  licenseType?: 'all-rights-reserved' | 'creative-commons';
}

interface SiteSettings {
  aboutText: string;
  instagramUrl: string;
  youtubeUrl: string;
  soundcloudUrl: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  aboutText: "Axrid is an exploration of the darker, more experimental side of electronic music. Blending high-energy elements of dubstep and drum & bass with atmospheric soundscapes, Axrid has built a distinct sonic identity through tracks like \"zero,\" \"echo,\" and \"2029.\" Known for a production style that balances raw intensity with melodic depth, his work reflects the vibrant and evolving underground electronic scene. Whether crafting heavy bass hitters or immersive digital textures, Axrid continues to push the boundaries of modern electronic sound.",
  instagramUrl: "https://www.instagram.com/axrid2026/",
  youtubeUrl: "https://www.youtube.com/channel/UC5H2YnxYihZhbEjXDViD3kg",
  soundcloudUrl: "https://soundcloud.com/axridaxe/tracks"
};

interface AudioPlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
  currentTrack: null,
  isPlaying: false,
  playTrack: () => {},
  togglePlayPause: () => {},
  playNext: () => {},
  playPrevious: () => {}
});

export const useAudioPlayer = () => useContext(AudioPlayerContext);

// --- Helpers ---
const handleApiError = (error: unknown, operationType: OperationType, path: string | null) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`API Error [${operationType}] ${path}: ${msg}`);
  throw new Error(msg);
};
// Keep old name as alias so existing call-sites don't break
const handleFirestoreError = handleApiError;

const getSoundCloudEmbed = (content: string) => {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Only embed if the line is exactly a SoundCloud URL and nothing else
    if (trimmed.startsWith("https://soundcloud.com/") && !trimmed.includes(" ") && !trimmed.includes("[")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&color=%23000000&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=false`;
    }
  }
  return null;
};

const formatDate = (date: any) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// --- Components ---

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="w-full"
  >
    {children}
  </motion.div>
);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-ink text-paper flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-line p-10 rounded-3xl text-center">
            <h2 className="text-2xl font-bold uppercase tracking-tighter mb-4">Error</h2>
            <p className="text-white/50 mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white text-black font-bold uppercase text-[10px] tracking-widest rounded-xl"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Lightbox = ({ isOpen, onClose, imageUrl, title }: { isOpen: boolean, onClose: () => void, imageUrl: string | null, title?: string }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-modal backdrop-blur-xl flex items-center justify-center p-4 md:p-12"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="fixed top-8 right-8 text-white/40 hover:text-white transition-colors z-[210] p-4 cursor-pointer"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative max-w-full max-h-full flex flex-col items-center select-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img 
          src={imageUrl} 
          alt={title || "Full size"} 
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl pointer-events-none" 
          referrerPolicy="no-referrer"
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
        />
        {title && (
          <p className="mt-6 text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">{title}</p>
        )}
      </motion.div>
    </motion.div>
  );
};

const ThemeTogglePrompt = ({ isOpen, onClose, onConfirm, currentTheme }: any) => {
  return (
    <Prompt
      isOpen={isOpen}
      onClose={onClose}
      onPrimaryClick={onConfirm}
      title="Switch Theme?"
      message={`You are about to switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode. Please note that the light theme is currently in a basic state and may contain visual glitches or bugs. Would you like to proceed?`}
      primaryLabel={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'}`}
      icon={currentTheme === 'dark' ? <Sun className="w-6 h-6 text-yellow-500" /> : <Moon className="w-6 h-6 text-indigo-400" />}
    />
  );
};

const RedirectModal = ({ isOpen, onClose, url }: any) => {
  const handleContinue = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <Prompt 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Redirect Notice" 
      message={
        <div className="space-y-2 sm:space-y-4">
          <p>The page you were on is trying to send you to <span className="text-blue-500 break-all underline">{url}</span>.</p>
          <p>If you do not want to visit that page, you can return to the previous page.</p>
        </div>
      }
      primaryLabel="Continue" 
      onPrimaryClick={handleContinue}
      icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
    />
  );
};

const OWNER_EMAIL = "kurtdolan2@gmail.com";
const TEST_USER_EMAIL = "kurtdolan2005@gmail.com";

const Navigation = ({ user, profile, isAdmin, setIsMenuOpen, isMenuOpen, onReleasesClick, onLogoutClick, onDonateClick, soundcloudUrl, theme, onThemeToggle }: any) => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = (id: string) => {
    if (location.pathname === '/') {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setIsMenuOpen(false);
  };

  const handleReleasesClick = () => {
    onReleasesClick(soundcloudUrl || DEFAULT_SETTINGS.soundcloudUrl);
  };

  return (
    <nav className={`fixed top-0 w-full z-[100] transition-all duration-300 ${isMenuOpen ? 'bg-transparent border-transparent' : 'border-b border-line bg-ink/90 backdrop-blur-sm'}`}>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link 
          to="/" 
          onClick={() => handleNavClick('hero')}
          className="font-bold text-lg uppercase tracking-tighter cursor-pointer relative z-[100] flex-shrink-0"
        >
          Axrid
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link 
            to="/#about" 
            onClick={() => handleNavClick('about')}
            className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all cursor-pointer ${isActive('/about') ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
          >
            About
          </Link>
          <Link 
            to="/#features" 
            onClick={() => handleNavClick('features')}
            className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all cursor-pointer ${isActive('/about') ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
          >
            Features
          </Link>
          <Link 
            to="/#music" 
            onClick={() => handleNavClick('music')}
            className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all cursor-pointer ${isActive('/music') ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
          >
            Music
          </Link>
          <button 
            onClick={handleReleasesClick}
            className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 hover:opacity-80 transition-all cursor-pointer"
          >
            Soundcloud
          </button>
          <Link 
            to="/#updates" 
            onClick={() => handleNavClick('updates')}
            className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all cursor-pointer ${isActive('/updates') ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
          >
            Updates
          </Link>
          {user && (
            <Link 
              to="/messages" 
              className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all cursor-pointer ${isActive('/messages') ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
            >
              Messages
            </Link>
          )}
          
          {isAdmin && (
            <Link 
              to="/admin" 
              className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all cursor-pointer ${isActive('/admin') ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
            >
              Admin Panel
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <button 
                onClick={onThemeToggle}
                className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-2"
              >
                {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>

              <div className="relative group">
                <button className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1">
                  Settings <ChevronDown size={10} />
                </button>
                <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="bg-ink border border-line rounded-xl p-2 min-w-[140px] shadow-2xl backdrop-blur-xl">
                    <div className="px-4 py-2 mb-1 border-b border-line/50">
                      <p className="text-[8px] uppercase tracking-widest opacity-30 font-bold">Account</p>
                      <p className="text-[10px] font-bold truncate">{getDisplayName(user, profile)}</p>
                    </div>
                    <Link 
                      to="/settings" 
                      className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-paper hover:text-ink rounded-lg transition-colors"
                    >
                      <SettingsIcon size={12} /> View Settings
                    </Link>
                    <button 
                      onClick={onLogoutClick}
                      className="w-full flex items-center gap-2 text-left px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white rounded-lg transition-colors text-red-500/80"
                    >
                      <LogOut size={12} /> Logout
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Link 
              to="/login"
              className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all cursor-pointer ${isActive('/login') ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
            >
              Login
            </Link>
          )}
        </div>

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden text-[10px] uppercase tracking-widest font-bold cursor-pointer relative z-[100] p-6 -mr-6 flex items-center justify-center min-w-[64px] min-h-[64px]"
          aria-label={isMenuOpen ? "Close Menu" : "Open Menu"}
        >
          {isMenuOpen ? "Close" : "Menu"}
        </button>
      </div>
    </nav>
  );
};

const MobileMenu = ({ user, profile, isAdmin, setIsMenuOpen, isMenuOpen, onReleasesClick, onLogoutClick, onDonateClick, soundcloudUrl }: any) => {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (id: string, to: string) => {
    if (location.pathname === '/') {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setIsMenuOpen(false);
  };

  const menuItems = [
    { to: '/#about', id: 'about', label: 'About' },
    { to: '/#music', id: 'music', label: 'Music' },
    { to: '/#updates', id: 'updates', label: 'Updates' },
  ];

  if (user) {
    menuItems.splice(2, 0, { to: '/messages', id: 'messages', label: 'Messages' });
    menuItems.push({ to: '/settings', id: 'settings', label: 'Settings' });
    if (isAdmin) {
      menuItems.push({ to: '/admin', id: 'admin', label: 'Admin Panel' });
    }
  }

  return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-ink pt-24 px-6 md:hidden flex flex-col"
      >
      <div className="flex flex-col gap-4">
        {user && (
          <div className="mb-2 border-b border-white/10 pb-4">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mb-1">Logged in as</p>
            <p className="text-xl font-bold tracking-tighter uppercase">{profile?.alias || user.displayName}</p>
          </div>
        )}
        
        {user ? (
          <button 
            onClick={() => { onLogoutClick(); setIsMenuOpen(false); }} 
            className="text-lg font-bold tracking-tighter uppercase text-left text-white/40 hover:text-white transition-all mb-4"
          >
            Logout
          </button>
        ) : (
          <Link 
            to="/login" 
            onClick={() => setIsMenuOpen(false)} 
            className={`text-lg font-bold tracking-tighter uppercase text-left transition-all mb-4 ${isActive('/login') ? 'text-white' : 'text-white/40'}`}
          >
            Login
          </Link>
        )}

        {menuItems.map((link) => (
          <Link 
            key={link.to}
            to={link.to} 
            onClick={() => handleNavClick(link.id, link.to)} 
            className={`text-3xl font-bold tracking-tighter uppercase text-left transition-all ${isActive(link.to) ? 'text-white' : 'text-white/40'}`}
          >
            {link.label}
          </Link>
        ))}
        
        <button 
          onClick={() => { onReleasesClick(soundcloudUrl || DEFAULT_SETTINGS.soundcloudUrl); setIsMenuOpen(false); }} 
          className="text-3xl font-bold tracking-tighter uppercase text-left text-white/40 hover:text-white transition-all"
        >
          Soundcloud
        </button>

        <div className="h-px bg-white/10 my-2" />
      </div>
    </motion.div>
  );
};

const Prompt = ({ isOpen, onClose, title, message, icon, primaryLabel, onPrimaryClick, primaryHoverColor, secondaryHoverColor, disabled }: any) => {
  const pColor = primaryHoverColor || "#10b981"; // Default to emerald-500 (green)
  const sColor = secondaryHoverColor || "#ef4444"; // Default to red-500 (red)

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/80 backdrop-blur-xl" 
            onClick={disabled ? undefined : onClose}
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative bg-modal border border-line p-5 sm:p-8 md:p-14 max-w-[95%] sm:max-w-md w-full rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl overflow-y-auto max-h-[90vh] group"
          >
            {/* Subtle blue glow inspired by the third image */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-blue-500/20 transition-all duration-1000" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-400/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 text-center">
              <div className="mb-4 sm:mb-10 flex justify-center">
                <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-card border border-line flex items-center justify-center shadow-inner">
                  {icon}
                </div>
              </div>

              <h3 className="text-lg sm:text-3xl font-bold tracking-tight uppercase mb-1 sm:mb-4 text-paper">{title}</h3>
              <div className="text-paper/40 font-medium tracking-tight leading-relaxed mb-6 sm:mb-12 text-[10px] sm:text-base">
                {message}
              </div>

              <div className="flex flex-col gap-2 sm:gap-3">
                <motion.button 
                  whileHover={disabled ? {} : { scale: 1.02, backgroundColor: pColor }}
                  whileTap={disabled ? {} : { scale: 0.98 }}
                  onClick={disabled ? undefined : (onPrimaryClick || onClose)}
                  disabled={disabled}
                  className={`w-full py-3 sm:py-5 bg-accent/90 text-ink font-bold uppercase tracking-widest text-[9px] rounded-xl transition-colors shadow-lg ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {primaryLabel}
                </motion.button>
                {onPrimaryClick && (
                  <motion.button 
                    whileHover={disabled ? {} : { backgroundColor: sColor, color: "white" }}
                    whileTap={disabled ? {} : { scale: 0.98 }}
                    onClick={disabled ? undefined : onClose}
                    disabled={disabled}
                    className={`w-full py-3 sm:py-5 text-paper/40 font-bold uppercase tracking-widest text-[9px] rounded-xl transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Cancel
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Delete", confirmVariant = "danger" }: any) => (
  <Prompt 
    isOpen={isOpen} 
    onClose={onClose} 
    title={title} 
    message={message} 
    primaryLabel={confirmLabel} 
    onPrimaryClick={onConfirm}
    icon={<AlertTriangle className={`w-8 h-8 ${confirmVariant === 'danger' ? 'text-red-500' : 'text-yellow-500'}`} />}
  />
);

const LogoutModal = ({ isOpen, onClose, onConfirm }: any) => (
  <ConfirmModal 
    isOpen={isOpen} 
    onClose={onClose} 
    title="Sign Out" 
    message="Are you sure you want to sign out?" 
    confirmLabel="Confirm Logout" 
    onConfirm={onConfirm}
  />
);

const DonateModal = ({ isOpen, onClose }: any) => (
  <Prompt 
    isOpen={isOpen} 
    onClose={onClose} 
    title="Currently unable to donate" 
    message="Donations are coming soon. Thank you for the support ❤️" 
    primaryLabel="Got it"
    icon={
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/40">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
    }
  />
);

const PublicPromptModal = ({ isOpen, onClose, onMessageAxrid }: any) => (
  <Prompt 
    isOpen={isOpen} 
    onClose={onClose} 
    title="Make Public" 
    message="To make your music public on the platform, please contact Axrid." 
    primaryLabel="Message Axrid" 
    onPrimaryClick={() => {
      onClose();
      if (onMessageAxrid) onMessageAxrid();
    }}
    icon={
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/40">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    }
  />
);

const ContactModal = ({ isOpen, onClose, onRedirect }: any) => (
  <Prompt 
    isOpen={isOpen} 
    onClose={onClose} 
    title="Contact" 
    message="For bookings and inquiries, please send a direct message via Instagram." 
    primaryLabel="Instagram" 
    onPrimaryClick={() => onRedirect("https://www.instagram.com/axrid2026/")}
    icon={
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/40">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    }
  />
);

const Footer = ({ onContactClick, onDonateClick, noTransition }: any) => (
  <footer className="py-24 px-6 max-w-5xl mx-auto border-t border-line">
    <div className="flex flex-col md:flex-row justify-between items-center gap-12">
      <motion.span 
        initial={noTransition ? { opacity: 0.3 } : { opacity: 0 }}
        whileInView={noTransition ? undefined : { opacity: 0.3 }}
        transition={noTransition ? { duration: 0 } : undefined}
        className="font-bold text-xl uppercase tracking-tighter"
      >
        Axrid
      </motion.span>
      <div className="flex gap-12 items-center">
        <button 
          onClick={onContactClick}
          className="text-[10px] uppercase tracking-[0.2em] font-medium hover:opacity-50 transition-opacity cursor-pointer"
        >
          Contact
        </button>
        <button 
          onClick={onDonateClick}
          className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer"
        >
          Donate
        </button>
      </div>
      <motion.p 
        initial={noTransition ? { opacity: 0.2 } : { opacity: 0 }}
        whileInView={noTransition ? undefined : { opacity: 0.2 }}
        transition={noTransition ? { duration: 0 } : undefined}
        className="text-[10px] uppercase tracking-[0.3em] font-bold"
      >
        © 2026 AXRID
      </motion.p>
    </div>
  </footer>
);

const Home = ({ 
  settings, 
  onRedirect, 
  user, 
  profile, 
  isAdmin, 
  tracks, 
  albums, 
  handleUploadTrack, 
  handleUpdateTrack, 
  handleDeleteTrack, 
  handleToggleTrackVisibility, 
  setLightboxImage, 
  handleSyncTrack, 
  uploadStatus, 
  setUploadStatus, 
  showNotification, 
  confirmAction, 
  handleCreateAlbum, 
  handleUpdateAlbum, 
  onDeleteAlbum, 
  isAlbumModalOpen, 
  setIsAlbumModalOpen, 
  editingAlbum, 
  setEditingAlbum,
  posts,
  handleCreatePost,
  handleDeletePost,
  handleToggleVisibility,
  newPostContent,
  setNewPostContent,
  newPostTitle,
  setNewPostTitle,
  newPostSubtitle,
  setNewPostSubtitle,
  isPosting,
  noTransition
}: any) => {
  const content = (
    <div className="flex flex-col">
      <section id="hero" className="pt-24 md:pt-32 pb-12 px-6 max-w-5xl mx-auto flex flex-col justify-center min-h-[60vh]">
        <motion.h1 
          initial={noTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={noTransition ? { duration: 0 } : undefined}
          className="text-5xl sm:text-7xl md:text-9xl font-bold tracking-tight md:tracking-tighter uppercase mb-8"
        >
          Axrid
        </motion.h1>
        <motion.div 
          initial={noTransition ? { opacity: 0.6, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 0.6, y: 0 }}
          transition={noTransition ? { duration: 0 } : { delay: 0.1 }}
          className="text-base md:text-xl text-paper/50 max-w-2xl leading-relaxed space-y-4 md:space-y-6"
        >
          <p>Axrid is an experimental electronic producer from Dublin, Ireland.</p>
          <p>Known for a high-volume, "raw" output of genre-bending tracks.</p>
          <p>Their work is characterized by a futuristic, often glitchy aesthetic that frequently blends elements of breakbeat, dubstep, and metal.</p>
        </motion.div>
      </section>
      
      <div id="about">
        <About settings={settings} onRedirect={onRedirect} noTransition={noTransition} />
      </div>
      <div id="music">
        <Music 
          user={user}
          profile={profile}
          isAdmin={isAdmin}
          tracks={tracks}
          albums={albums}
          handleUploadTrack={handleUploadTrack}
          handleUpdateTrack={handleUpdateTrack}
          handleDeleteTrack={handleDeleteTrack}
          handleToggleTrackVisibility={handleToggleTrackVisibility}
          setLightboxImage={setLightboxImage}
          handleSyncTrack={handleSyncTrack}
          uploadStatus={uploadStatus}
          setUploadStatus={setUploadStatus}
          showNotification={showNotification}
          confirmAction={confirmAction}
          handleCreateAlbum={handleCreateAlbum}
          handleUpdateAlbum={handleUpdateAlbum}
          onDeleteAlbum={onDeleteAlbum}
          isAlbumModalOpen={isAlbumModalOpen}
          setIsAlbumModalOpen={setIsAlbumModalOpen}
          editingAlbum={editingAlbum}
          setEditingAlbum={setEditingAlbum}
          noTransition={noTransition}
        />
      </div>
      <div id="updates">
        <Updates 
          user={user}
          isAdmin={isAdmin} 
          posts={posts} 
          handleCreatePost={handleCreatePost} 
          handleDeletePost={handleDeletePost}
          handleToggleVisibility={handleToggleVisibility}
          newPostContent={newPostContent}
          setNewPostContent={setNewPostContent}
          newPostTitle={newPostTitle}
          setNewPostTitle={setNewPostTitle}
          newPostSubtitle={newPostSubtitle}
          setNewPostSubtitle={setNewPostSubtitle}
          isPosting={isPosting}
          setLightboxImage={setLightboxImage}
          noTransition={noTransition}
        />
      </div>
    </div>
  );

  if (noTransition) return content;

  return (
    <PageTransition>
      {content}
    </PageTransition>
  );
};

const FeaturesSection = ({ noTransition }: { noTransition?: boolean }) => {
  const features = [
    {
      title: "Music Releases",
      description: "Professional-grade music player with SoundCloud integration and visibility controls.",
      icon: <MusicIcon className="w-6 h-6" />,
      tag: "Audio"
    },
    {
      title: "Direct Messaging",
      description: "Secure, real-time private chat system with message history and edit capabilities.",
      icon: <MessageSquare className="w-6 h-6" />,
      tag: "Social"
    },
    {
      title: "Admin Panel",
      description: "Comprehensive dashboard for managing users, content, and site-wide settings.",
      icon: <ShieldCheck className="w-6 h-6" />,
      tag: "Control"
    },
    {
      title: "User Profiles",
      description: "Customizable user identities with social integration and activity tracking.",
      icon: <UserIcon className="w-6 h-6" />,
      tag: "Identity"
    },
    {
      title: "Community Feed",
      description: "Interactive global feed for posts, updates, and community engagement.",
      icon: <Globe className="w-6 h-6" />,
      tag: "Network"
    },
    {
      title: "Moderation",
      description: "Advanced tools for maintaining community standards and content safety.",
      icon: <Lock className="w-6 h-6" />,
      tag: "Safety"
    },
    {
      title: "Global CDN",
      description: "Lightning-fast content delivery across the globe for all your media.",
      icon: <Zap className="w-6 h-6" />,
      tag: "Speed"
    },
    {
      title: "Cloud Hosting",
      description: "Secure and scalable storage for your community's growing assets.",
      icon: <Cloud className="w-6 h-6" />,
      tag: "Storage"
    },
    {
      title: "Secure",
      description: "Secure authentication with encrypted passwords and session management.",
      icon: <ShieldCheck className="w-6 h-6" />,
      tag: "Security"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="pt-24 pb-24 px-6 max-w-5xl mx-auto">
      <div className="mb-24 text-center">
        <motion.div
          initial={noTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={noTransition ? { duration: 0 } : undefined}
          className="space-y-4"
        >
          <span className="text-[8px] uppercase tracking-[0.6em] font-bold opacity-30">Platform Overview</span>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight md:tracking-tighter uppercase">
            Features
          </h2>
          <p className="text-paper/40 text-sm max-w-xl mx-auto uppercase tracking-widest leading-relaxed">
            A professional suite of tools built for creators and communities.
          </p>
        </motion.div>
      </div>

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial={noTransition ? "visible" : "hidden"}
        whileInView={noTransition ? undefined : "visible"}
        animate={noTransition ? "visible" : undefined}
        viewport={noTransition ? undefined : { once: true, margin: "-50px" }}
        transition={noTransition ? { duration: 0 } : undefined}
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            variants={itemVariants}
            className="group bg-card p-8 rounded-3xl border border-line/50 hover:border-paper/20 transition-all duration-500"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="p-3 bg-paper/5 rounded-2xl text-paper/60 group-hover:text-paper group-hover:bg-paper/10 transition-all duration-500">
                {feature.icon}
              </div>
              <span className="text-[7px] uppercase tracking-widest font-bold opacity-20 group-hover:opacity-40 transition-opacity">
                {feature.tag}
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight uppercase mb-3">{feature.title}</h3>
            <p className="text-[11px] text-paper/40 leading-relaxed group-hover:text-paper/60 transition-colors duration-500">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

const About = ({ settings, onRedirect, noTransition }: { settings: SiteSettings | null, onRedirect: (url: string) => void, noTransition?: boolean }) => {
  const s = settings || DEFAULT_SETTINGS;
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const content = (
    <section className="pt-20 md:pt-48 pb-12 md:pb-24 px-4 md:px-6 max-w-5xl mx-auto min-h-[70vh]">
        <motion.h2 
          initial={noTransition ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={noTransition ? { duration: 0 } : undefined}
          className="text-3xl sm:text-4xl font-bold tracking-tight uppercase mb-8 md:mb-12"
        >
          About
        </motion.h2>
        <div className="max-w-2xl">
          <motion.p 
            initial={noTransition ? { opacity: 0.6, y: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 0.6, y: 0 }}
            transition={noTransition ? { duration: 0 } : undefined}
            className="text-base md:text-lg leading-relaxed mb-12 whitespace-pre-wrap"
          >
            {s.aboutText}
          </motion.p>
        
        <div className="flex flex-wrap items-center gap-4 sm:gap-8 mb-12">
          {s.instagramUrl && <button onClick={() => setRedirectUrl(s.instagramUrl!)} className="text-[10px] uppercase tracking-widest font-bold hover:opacity-50 transition-opacity cursor-pointer">Instagram</button>}
          {s.youtubeUrl && <button onClick={() => setRedirectUrl(s.youtubeUrl!)} className="text-[10px] uppercase tracking-widest font-bold hover:opacity-50 transition-opacity cursor-pointer">YouTube</button>}
          {s.soundcloudUrl && <button onClick={() => setRedirectUrl(s.soundcloudUrl!)} className="text-[10px] uppercase tracking-widest font-bold hover:opacity-50 transition-opacity cursor-pointer">SoundCloud</button>}
        </div>
      </div>
      <Prompt
        isOpen={!!redirectUrl}
        onClose={() => setRedirectUrl(null)}
        title="Redirect to External Site"
        message="You are about to leave this site. Do you want to continue?"
        icon={<AlertTriangle size={32} className="text-accent" />}
        primaryLabel="Continue"
        onPrimaryClick={() => {
          if (redirectUrl) onRedirect(redirectUrl);
          setRedirectUrl(null);
        }}
      />
      <FeaturesSection noTransition={noTransition} />
    </section>
  );

  if (noTransition) return content;

  return (
    <PageTransition>
      {content}
    </PageTransition>
  );
};

const Comments = ({ path, user, isAdmin }: { path: string, user: LocalUser | null, isAdmin: boolean }) => {
  // path is "posts/{postId}/comments" — extract postId
  const postId = path.split('/')[1];
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchComments = () => {
    fetch(`/api/posts/${postId}/comments`)
      .then(r => r.json()).then(setComments).catch(console.error);
  };

  useEffect(() => { fetchComments(); }, [postId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setShowLoginPrompt(true); return; }
    if (!newComment.trim()) return;
    setShowPreview(true);
  };

  const handleConfirmPost = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setShowPreview(false);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNewComment("");
      fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchComments();
    } catch (error: any) {
      setDeleteError("Failed to delete comment. Please try again.");
    }
  };

  return (
    <div className="mt-12 pt-12 border-t border-line/50">
      <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mb-8">Comments ({comments.length})</h4>
      
      {deleteError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold">{deleteError}</p>
        </div>
      )}

      <div className="space-y-8 mb-12">
        {comments.map((comment) => (
          <div key={comment.id} className="group">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest">{comment.authorName}</span>
              <span className="text-[10px] opacity-20 uppercase tracking-widest">
                {comment.createdAt ? new Date(comment.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'GMT' }) : "Just now"}
              </span>
              {(isAdmin || (user && (user.id === comment.authorId || user.uid === comment.authorId))) && (
                <button 
                  onClick={() => handleDeleteComment(comment.id)}
                  className={`text-[8px] uppercase tracking-widest font-bold text-red-500/40 hover:text-red-500 transition-opacity cursor-pointer ${isAdmin ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  Delete
                </button>
              )}
            </div>
            <p className="text-paper/60 leading-relaxed">{comment.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={user ? "Add a comment..." : "Login to join the conversation"}
          className="w-full bg-input border border-line/50 rounded-xl p-4 text-sm focus:outline-none focus:border-paper/30 transition-colors resize-none h-24"
        />
        <div className="mt-4 flex justify-end items-center gap-4">
          {user ? (
            <button 
              type="submit"
              disabled={isSubmitting}
              className="text-[10px] uppercase tracking-[0.2em] font-bold border border-line/50 px-6 py-2 hover:bg-paper hover:text-ink transition-all disabled:opacity-30 cursor-pointer rounded-lg"
            >
              {isSubmitting ? "Sending" : "Post Comment"}
            </button>
          ) : (
            <Link 
              to="/login"
              className="text-[10px] uppercase tracking-[0.2em] font-bold border border-line/50 px-6 py-2 hover:bg-paper hover:text-ink transition-all cursor-pointer rounded-lg inline-block"
            >
              Login to Comment
            </Link>
          )}
        </div>
      </form>

      <Prompt 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        title="Comment Preview" 
        message={
          <div className="text-left bg-card p-6 rounded-2xl border border-line/50">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest">{isAdmin ? "Axrid" : (user ? getDisplayName(user) : "Anonymous")}</span>
              <span className="text-[10px] opacity-20 uppercase tracking-widest">
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'GMT' })}
              </span>
            </div>
            <p className="text-paper/60 leading-relaxed text-sm">{newComment}</p>
          </div>
        } 
        primaryLabel="Confirm Post" 
        onPrimaryClick={handleConfirmPost}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/40">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
      />

      <Prompt 
        isOpen={showLoginPrompt} 
        onClose={() => setShowLoginPrompt(false)} 
        title="Sign In Required" 
        message="You must be signed in to participate in the conversation." 
        primaryLabel="Go to Login" 
        onPrimaryClick={() => { setShowLoginPrompt(false); navigate("/login"); }}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/40">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        }
      />
    </div>
  );
};

const BulkAddModal = ({ isOpen, onClose, onImport, showNotification }: { isOpen: boolean, onClose: () => void, onImport: (urls: string[]) => void, showNotification: any }) => {
  const [urls, setUrls] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = async () => {
    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urlList.length === 0) {
      showNotification("Please enter at least one valid URL.", 'error');
      return;
    }
    setIsProcessing(true);
    await onImport(urlList);
    setIsProcessing(false);
    setUrls("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-card border border-line rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tighter text-paper">Bulk Import</h2>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-30">Paste SoundCloud URLs (one per line)</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors opacity-30 hover:opacity-100">
              <X size={20} />
            </button>
          </div>

          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://soundcloud.com/axrid/track-1&#10;https://soundcloud.com/axrid/track-2"
            className="w-full h-64 bg-input border border-line rounded-2xl p-4 text-[11px] font-mono focus:outline-none focus:border-paper/20 transition-colors resize-none"
          />

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-white/5 text-paper font-bold uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isProcessing}
              className="flex-[2] px-6 py-4 bg-paper text-ink font-bold uppercase text-[10px] tracking-widest rounded-2xl hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : `Import ${urls.split('\n').filter(u => u.trim().startsWith('http')).length} Tracks`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AlbumModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  album, 
  allTracks 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (data: any) => void, 
  album: Album | null,
  allTracks: Track[]
}) => {
  const [title, setTitle] = useState(album?.title || "");
  const [artist, setArtist] = useState(album?.artist || "");
  const [coverUrl, setCoverUrl] = useState(album?.coverUrl || "");
  const [releaseDate, setReleaseDate] = useState(album?.releaseDate || "");
  const [description, setDescription] = useState(album?.description || "");
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>(album?.trackIds || []);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (album) {
      setTitle(album.title);
      setArtist(album.artist || "");
      setCoverUrl(album.coverUrl || "");
      setReleaseDate(album.releaseDate || "");
      setDescription(album.description || "");
      setSelectedTrackIds(album.trackIds);
    } else {
      setTitle("");
      setArtist("");
      setCoverUrl("");
      setReleaseDate("");
      setDescription("");
      setSelectedTrackIds([]);
    }
  }, [album, isOpen]);

  const filteredTracks = allTracks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTrack = (id: string) => {
    setSelectedTrackIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    const newIds = [...selectedTrackIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    setSelectedTrackIds(newIds);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      artist,
      coverUrl,
      releaseDate,
      description,
      trackIds: selectedTrackIds
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-line w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-line flex items-center justify-between">
          <h3 className="text-xl font-bold uppercase tracking-widest">{album ? "Edit Album" : "Create Album"}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Album Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Artist</label>
                <input 
                  type="text" 
                  value={artist} 
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Cover URL</label>
                <input 
                  type="text" 
                  value={coverUrl} 
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Upload Cover Art</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={async (e) => {
                    if (!e.target.files || e.target.files.length === 0) return;
                    const formData = new FormData();
                    formData.append("file", e.target.files[0]);
                    const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
                    const data = await res.json();
                    if (data.url) setCoverUrl(data.url);
                  }}
                  className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Release Date</label>
                <input 
                  type="date" 
                  value={releaseDate} 
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors"
                />
              </div>
            </div>
            
            <div className="flex flex-col h-full">
              <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Select & Order Tracks</label>
              <div className="flex-grow border border-line rounded-xl bg-ink/30 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-line">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                    <input 
                      type="text" 
                      placeholder="Search tracks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white/5 border-none rounded-lg pl-9 pr-4 py-2 text-xs outline-none"
                    />
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-1 max-h-[300px]">
                  {selectedTrackIds.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[8px] uppercase tracking-widest opacity-30 mb-2 px-2">Selected (Drag to reorder)</p>
                      {selectedTrackIds.map((id, index) => {
                        const track = allTracks.find(t => t.id === id);
                        if (!track) return null;
                        return (
                          <div key={id} className="flex items-center gap-2 bg-accent/10 p-2 rounded-lg group">
                            <div className="flex flex-col gap-1">
                              <button type="button" onClick={() => moveTrack(index, 'up')} className="opacity-30 hover:opacity-100 disabled:hidden" disabled={index === 0}>
                                <ChevronUp size={12} />
                              </button>
                              <button type="button" onClick={() => moveTrack(index, 'down')} className="opacity-30 hover:opacity-100 disabled:hidden" disabled={index === selectedTrackIds.length - 1}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            <span className="text-xs flex-grow truncate">{track.title}</span>
                            <button type="button" onClick={() => toggleTrack(id)} className="text-accent hover:text-white transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[8px] uppercase tracking-widest opacity-30 mb-2 px-2">All Tracks</p>
                  {filteredTracks.filter(t => !selectedTrackIds.includes(t.id)).map(track => (
                    <button 
                      key={track.id}
                      type="button"
                      onClick={() => toggleTrack(track.id)}
                      className="w-full text-left p-2 rounded-lg hover:bg-white/5 text-xs transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{track.title}</span>
                      <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Description</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors h-24 resize-none"
            />
          </div>
        </form>
        
        <div className="p-6 border-t border-line flex gap-4">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-line rounded-xl text-[10px] uppercase tracking-widest font-bold hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-paper text-ink rounded-xl text-[10px] uppercase tracking-widest font-bold hover:opacity-90 transition-all"
          >
            {album ? "Save Changes" : "Create Album"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const TrackItem = ({ track, isAdmin, user, handleDeleteTrack, handleToggleTrackVisibility, onImageClick, onEdit, onSync, showNotification, confirmAction }: { track: Track, isAdmin: boolean, user: any, handleDeleteTrack: (id: string) => void, handleToggleTrackVisibility: (id: string, visible: boolean) => Promise<boolean>, onImageClick: (url: string, title: string) => void, onEdit: (track: Track) => void, onSync?: (track: Track) => void, showNotification: any, confirmAction: any }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isPublicPromptOpen, setIsPublicPromptOpen] = useState(false);
  const [isDownloadPromptOpen, setIsDownloadPromptOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const navigate = useNavigate();
  const isOwner = user && (track.authorId === user.id || track.authorId === user.uid);
  const canManage = isAdmin || isOwner;

  const [isUploadPromptOpen, setIsUploadPromptOpen] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const { currentTrack, isPlaying, playTrack } = useAudioPlayer();
  const isCurrentTrack = currentTrack?.id === track.id;

  const onToggleVisibility = async () => {
    const success = await handleToggleTrackVisibility(track.id, !track.isVisible);
    if (success === false && !isAdmin && !track.isVisible) {
      setIsUploadPromptOpen(true);
    }
  };

  const getTrackAudioUrl = () => {
    if (track.audioUrl) return track.audioUrl;
    if (track.soundcloudUrl) return `/api/soundcloud/stream?url=${encodeURIComponent(track.soundcloudUrl)}`;
    return "";
  };

  const handleDownloadConfirm = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    const audioUrl = getTrackAudioUrl();
    if (!audioUrl) {
      setIsDownloading(false);
      showNotification("No audio available for download.", "error");
      return;
    }
    
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const contentLength = +(response.headers.get('Content-Length') || 0);
      const reader = response.body?.getReader();
      
      if (!reader) {
        // Fallback if reader not available
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${track.title} - ${track.artist}.mp3`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      }

      let receivedLength = 0;
      const chunks = [];
      
      while(true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (contentLength) {
          setDownloadProgress(Math.round((receivedLength / contentLength) * 100));
        }
      }

      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title} - ${track.artist}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed via fetch, falling back to direct link", error);
      window.open(audioUrl, '_blank');
    } finally {
      setIsDownloadPromptOpen(false);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handlePlay = () => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'Axrid Music',
        artwork: track.coverUrl ? [
          { src: track.coverUrl, sizes: '96x96', type: 'image/png' },
          { src: track.coverUrl, sizes: '128x128', type: 'image/png' },
          { src: track.coverUrl, sizes: '192x192', type: 'image/png' },
          { src: track.coverUrl, sizes: '256x256', type: 'image/png' },
          { src: track.coverUrl, sizes: '384x384', type: 'image/png' },
          { src: track.coverUrl, sizes: '512x512', type: 'image/png' },
        ] : []
      });
    }
  };

  return (
    <motion.div 
      id={`track-${track.id}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-card/10 border-b border-line/20 hover:bg-white/5 transition-all duration-300"
    >
      <div className="px-3 py-3 flex items-center gap-2 sm:px-6 sm:py-4 sm:gap-6">
        {/* Artwork (Small) */}
        <div 
          className="relative w-10 h-10 sm:w-12 sm:h-12 bg-ink/50 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border border-line/20 group/art"
          onClick={() => track.coverUrl && onImageClick(track.coverUrl, track.title)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {track.coverUrl ? (
            <img 
              src={track.coverUrl} 
              alt={track.title} 
              className="w-full h-full object-cover pointer-events-none transition-transform duration-700 group-hover/art:scale-110" 
              referrerPolicy="no-referrer" 
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div 
          className="flex-grow min-w-[80px] py-1 cursor-pointer group/title"
          onClick={() => navigate(`/tracks/${track.id}`)}
        >
          <div className="flex items-start gap-1.5 min-w-0">
            <h3 className="text-[11px] sm:text-[13px] font-bold tracking-tight text-paper leading-tight break-words line-clamp-2 whitespace-normal group-hover/title:underline">{track.title}</h3>
            {track.isExplicit && (
              <span className="px-1 py-0.5 bg-paper/10 text-[6px] sm:text-[7px] font-black rounded-sm text-paper/40 uppercase flex-shrink-0 border border-line/10 mt-0.5">E</span>
            )}
          </div>
          <p className="text-[8px] sm:text-[9px] uppercase tracking-widest font-bold opacity-30 text-paper mt-1 break-words line-clamp-1 group-hover/title:opacity-60">{track.artist}</p>
        </div>

        {/* Audio Player (Compact) */}
        <div className="w-10 flex-shrink-0 flex justify-center">
          <button 
            onClick={() => {
              handlePlay();
              playTrack(track);
            }} 
            className="w-10 h-10 flex items-center justify-center bg-paper text-ink rounded-full hover:scale-105 transition-transform shadow-lg"
          >
            {isCurrentTrack && isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-1" />
            )}
          </button>
        </div>

        {/* Date (Right) */}
        <div className="hidden md:block w-24 text-right flex-shrink-0">
          <span className="text-[10px] font-bold opacity-30 tracking-widest uppercase">
            {formatDate(track.releaseDate || track.createdAt)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-3 flex-shrink-0 justify-center sm:min-w-[120px]">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 transition-colors opacity-40 hover:opacity-100"
            title="Details"
          >
            <Info size={14} />
          </button>
          
          {track.enableDirectDownloads && (
            <button 
              onClick={() => setIsDownloadPromptOpen(true)}
              disabled={isDownloading}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 transition-colors opacity-40 hover:opacity-100 disabled:opacity-10"
              title="Download"
            >
              <Download size={14} />
            </button>
          )}

          {canManage && (
            <div className="flex flex-wrap items-center gap-1 border-l border-line/20 pl-2 sm:pl-3 ml-1">
              {isAdmin && track.soundcloudUrl && onSync && (
                <button 
                  onClick={() => onSync(track)}
                  className="p-1.5 sm:p-2 rounded-lg text-accent/40 hover:text-accent transition-all"
                  title="Sync from SoundCloud"
                >
                  <Zap size={14} />
                </button>
              )}
              <button 
                onClick={() => onEdit(track)}
                className="p-1.5 sm:p-2 rounded-lg text-paper/40 hover:text-paper transition-all"
                title="Edit Track"
              >
                <Edit size={14} />
              </button>
              <button 
                onClick={onToggleVisibility}
                className={`p-1.5 sm:p-2 rounded-lg transition-all ${track.isVisible ? 'text-emerald-500/40 hover:text-emerald-500' : 'text-amber-500/40 hover:text-amber-500'}`}
                title={track.isVisible ? 'Make Hidden' : 'Make Visible'}
              >
                {track.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button 
                onClick={() => handleDeleteTrack(track.id)}
                className="p-1.5 sm:p-2 rounded-lg text-red-500/40 hover:text-red-500 transition-all"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <PublicPromptModal 
        isOpen={isPublicPromptOpen} 
        onClose={() => setIsPublicPromptOpen(false)} 
        onMessageAxrid={() => navigate('/messages')}
      />

      <Prompt
        isOpen={isUploadPromptOpen}
        onClose={() => setIsUploadPromptOpen(false)}
        title="Upload Restricted"
        message="Please contact Axrid to upload to the platform."
        primaryLabel="Contact"
        onPrimaryClick={() => {
          setIsUploadPromptOpen(false);
          navigate('/messages');
        }}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/40">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        }
      />
      
      <AnimatePresence>
        {showDetails && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line/20 bg-ink/20"
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div>
                  <h4 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-3 text-paper">Description</h4>
                  <p className="text-xs text-paper/60 leading-relaxed whitespace-pre-wrap">{track.description || "No description provided."}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-3 text-paper">Release Info</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Label', value: track.recordLabel },
                    { label: 'BPM', value: track.bpm },
                    { label: 'Released', value: track.releaseDate ? new Date(track.releaseDate).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined },
                    { label: 'Publisher', value: track.publisher },
                    { label: 'Genre', value: track.genre },
                  ].map((info, i) => info.value && (
                    <div key={i} className="flex flex-col gap-0.5 border-b border-line/10 pb-2">
                      <span className="text-[7px] uppercase tracking-[0.2em] font-bold opacity-30 text-paper">{info.label}</span>
                      <span className="text-[10px] font-medium opacity-80 text-paper leading-relaxed">{info.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-3 text-paper">Links</h4>
                <div className="flex flex-col gap-2">
                  {track.trackLink && (
                    <a href={track.trackLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-card rounded-xl hover:bg-white/5 transition-colors group/link border border-line/20">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-50 text-paper">Stream Link</span>
                      <ExternalLink size={10} className="opacity-20 group-hover/link:opacity-100 transition-opacity text-paper" />
                    </a>
                  )}
                  {track.buyLink && (
                    <a href={track.buyLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-card rounded-xl hover:bg-white/5 transition-colors group/link border border-line/20">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-50 text-paper">Buy Track</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20 group-hover/link:opacity-100 transition-opacity text-paper"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                    </a>
                  )}
                  {track.soundcloudUrl && (
                    <button 
                      onClick={() => setRedirectUrl(track.soundcloudUrl!)}
                      className="flex items-center justify-between p-3 bg-card rounded-xl hover:bg-white/5 transition-colors group/link border border-line/20 w-full"
                    >
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-50 text-paper">View SoundCloud</span>
                      <ExternalLink size={10} className="opacity-20 group-hover/link:opacity-100 transition-opacity text-paper" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <Prompt 
        isOpen={!!redirectUrl} 
        onClose={() => setRedirectUrl(null)} 
        title="Redirect to SoundCloud" 
        message="You are about to leave this site to view the user's SoundCloud profile. Do you want to continue?" 
        primaryLabel="Continue" 
        onPrimaryClick={() => {
          if (redirectUrl) window.open(redirectUrl, '_blank');
          setRedirectUrl(null);
        }}
      />
      <Prompt 
        isOpen={isDownloadPromptOpen} 
        onClose={() => !isDownloading && setIsDownloadPromptOpen(false)} 
        title={isDownloading ? "Downloading..." : "Download Track"} 
        message={isDownloading 
          ? `Please wait while we prepare your download. ${downloadProgress}% complete.` 
          : `Would you like to download "${track.title}" by ${track.artist}?`} 
        primaryLabel={isDownloading ? "Downloading..." : "Download Now"} 
        onPrimaryClick={handleDownloadConfirm}
        icon={isDownloading ? (
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
            <div 
              className="absolute inset-0 border-4 border-emerald-500 rounded-full transition-all duration-300" 
              style={{ clipPath: `inset(${100 - downloadProgress}% 0 0 0)` }}
            />
            <Download className="w-6 h-6 text-emerald-500 animate-bounce" />
          </div>
        ) : (
          <Download className="w-8 h-8 text-emerald-500" />
        )}
        primaryHoverColor="#10b981"
        disabled={isDownloading}
      />
    </motion.div>
  );
};

const EditTrackModal = ({ track, isOpen, onClose, onUpdate }: any) => {
  const [title, setTitle] = useState(track?.title || '');
  const [artist, setArtist] = useState(track?.artist || '');
  const [album, setAlbum] = useState(track?.album || '');
  const [genre, setGenre] = useState(track?.genre || '');
  const [bpm, setBpm] = useState(track?.bpm || '');
  const [releaseDate, setReleaseDate] = useState(track?.releaseDate || '');
  const [description, setDescription] = useState(track?.description || '');
  const [recordLabel, setRecordLabel] = useState(track?.recordLabel || '');
  const [publisher, setPublisher] = useState(track?.publisher || '');
  const [soundcloudUrl, setSoundcloudUrl] = useState(track?.soundcloudUrl || '');
  const [coverUrl, setCoverUrl] = useState(track?.coverUrl || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setArtist(track.artist);
      setAlbum(track.album || '');
      setGenre(track.genre || '');
      setBpm(track.bpm || '');
      setReleaseDate(track.releaseDate || '');
      setDescription(track.description || '');
      setRecordLabel(track.recordLabel || '');
      setPublisher(track.publisher || '');
      setSoundcloudUrl(track.soundcloudUrl || '');
      setCoverUrl(track.coverUrl || '');
    }
  }, [track]);

  if (!isOpen) return null;

  const handleFetchMetadata = async () => {
    if (!soundcloudUrl) return;
    setIsFetchingMetadata(true);
    setSyncStatus(null);
    try {
      const response = await fetch(`/api/soundcloud/metadata?url=${encodeURIComponent(soundcloudUrl)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch metadata");
      
      if (data.title) setTitle(data.title);
      if (data.artist) setArtist(data.artist);
      if (data.genre) setGenre(data.genre);
      if (data.releaseDate) setReleaseDate(data.releaseDate);
      if (data.artworkUrl && !coverUrl) {
        // Automatically sync artwork if no cover exists
        handleSyncArtwork();
      }
      setSyncStatus({ type: 'success', message: 'Metadata fetched!' });
    } catch (error: any) {
      setSyncStatus({ type: 'error', message: error.message });
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleSyncArtwork = async () => {
    if (!soundcloudUrl) return;
    setIsSyncing(true);
    setSyncStatus(null);
    console.log("[EditTrackModal] Starting artwork sync for:", soundcloudUrl);
    try {
      const response = await fetch(`/api/soundcloud/artwork?url=${encodeURIComponent(soundcloudUrl)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch artwork");
      }

      if (data.base64) {
        // Convert base64 to blob and upload to local storage
        const blobRes = await fetch(data.base64);
        const blob = await blobRes.blob();
        const formData = new FormData();
        formData.append("file", blob, "cover.jpg");
        const uploadRes = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
        const uploadData = await uploadRes.json();
        setCoverUrl(uploadData.url);
        setSyncStatus({ type: 'success', message: 'Artwork synced! Remember to save changes.' });
      } else if (data.artworkUrl) {
        console.log("[EditTrackModal] Received artwork URL only:", data.artworkUrl);
        setCoverUrl(data.artworkUrl);
        setSyncStatus({ type: 'success', message: 'Artwork URL updated! Remember to save changes.' });
      } else {
        throw new Error("No artwork found in response");
      }
    } catch (error: any) {
      console.error("[EditTrackModal] Error syncing artwork:", error);
      setSyncStatus({ type: 'error', message: error.message || 'Failed to sync artwork' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    const success = await onUpdate(track.id, {
      title,
      artist,
      album,
      genre,
      bpm: bpm ? Number(bpm) : undefined,
      releaseDate,
      description,
      recordLabel,
      publisher,
      soundcloudUrl,
      coverUrl
    });
    setIsUpdating(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-line w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-line flex justify-between items-center">
          <h3 className="text-sm font-bold tracking-tight text-paper">Edit Track</h3>
          <button onClick={onClose} className="text-paper/40 hover:text-paper transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Title</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Artist</label>
              <input 
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Genre</label>
              <input 
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Album</label>
              <input 
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">BPM</label>
              <input 
                type="number"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Release Date</label>
              <input 
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Record Label</label>
            <input 
              value={recordLabel}
              onChange={(e) => setRecordLabel(e.target.value)}
              className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Publisher</label>
            <input 
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">SoundCloud URL</label>
            <div className="flex gap-2 items-center">
              <input 
                value={soundcloudUrl}
                onChange={(e) => setSoundcloudUrl(e.target.value)}
                placeholder="https://soundcloud.com/..."
                className="flex-grow bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors"
              />
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={handleFetchMetadata}
                  disabled={isFetchingMetadata || !soundcloudUrl}
                  className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-[8px] uppercase tracking-widest font-bold hover:bg-accent/20 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                >
                  <Search size={12} />
                  {isFetchingMetadata ? "Fetching..." : "Fetch Metadata"}
                </button>
                <button
                  type="button"
                  onClick={handleSyncArtwork}
                  disabled={isSyncing || !soundcloudUrl}
                  className="px-3 py-2 bg-orange-500/10 text-orange-500 rounded-lg text-[8px] uppercase tracking-widest font-bold hover:bg-orange-500/20 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                >
                  <Cloud size={12} />
                  {isSyncing ? "Syncing..." : "Sync Cover"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {syncStatus && (
                <div className={`text-[10px] font-medium px-1 ${syncStatus.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {syncStatus.message}
                </div>
              )}
              <p className="text-[9px] text-paper/40 italic px-1">
                Tip: For private tracks, use the "Private Share" link from SoundCloud.
              </p>
            </div>
          </div>
          {coverUrl && (
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Current Cover</label>
              <div className="relative aspect-square w-24 rounded-lg overflow-hidden border border-line">
                <img src={coverUrl} alt="Cover Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Description</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-black/20 border border-line/30 rounded-lg px-3 py-2 text-xs text-paper focus:border-emerald-500/50 outline-none transition-colors resize-none"
            />
          </div>
          <button 
            type="submit"
            disabled={isUpdating}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-xs uppercase tracking-widest"
          >
            {isUpdating ? 'Updating...' : 'Save Changes'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const TrackCard = ({ track, onImageClick }: { track: Track, onImageClick: (url: string, title: string) => void }) => {
  const { currentTrack, isPlaying, togglePlayPause, playTrack } = useAudioPlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const navigate = useNavigate();

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentTrack) {
      togglePlayPause();
    } else {
      playTrack(track);
    }
  };

  return (
    <div 
      id={`track-${track.id}`}
      className="group relative flex-shrink-0 w-40 sm:w-48 flex flex-col gap-3 snap-start"
    >
      <div 
        className="relative w-full aspect-square bg-ink/50 rounded-lg overflow-hidden cursor-pointer border border-line/20"
        onClick={() => track.coverUrl && onImageClick(track.coverUrl, track.title)}
      >
        {track.coverUrl ? (
          <img 
            src={track.coverUrl} 
            alt={track.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            referrerPolicy="no-referrer" 
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5">
            <MusicIcon size={32} className="opacity-20" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button 
            onClick={handlePlayClick}
            className="w-12 h-12 rounded-full bg-accent text-black flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isCurrentTrack && isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        <h4 
          className="text-sm font-bold truncate hover:underline cursor-pointer"
          onClick={() => navigate(`/music#track-${track.id}`)}
        >
          {track.title}
        </h4>
        <p 
          className="text-xs text-white/50 truncate hover:underline cursor-pointer hover:text-white transition-colors"
          onClick={() => navigate(`/user/${track.authorId}`)}
        >
          {track.artist}
        </p>
      </div>
    </div>
  );
};



const Music = ({ 
  user, 
  profile, 
  isAdmin, 
  tracks, 
  albums,
  handleUploadTrack, 
  handleUpdateTrack, 
  handleDeleteTrack, 
  handleToggleTrackVisibility, 
  setLightboxImage, 
  handleSyncTrack, 
  uploadStatus, 
  setUploadStatus, 
  showNotification, 
  confirmAction,
  handleCreateAlbum,
  handleUpdateAlbum,
  onDeleteAlbum,
  isAlbumModalOpen,
  setIsAlbumModalOpen,
  editingAlbum,
  setEditingAlbum,
  noTransition
}: any) => {
  const { playTrack } = useAudioPlayer();
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadExpanded, setIsUploadExpanded] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackArtist, setNewTrackArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [trackLink, setTrackLink] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'scheduled'>(isAdmin ? 'public' : 'private');
  const [isPublicPromptOpen, setIsPublicPromptOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<any>(null);
  const navigate = useNavigate();
  
  // Advanced details
  const [buyLink, setBuyLink] = useState("");
  const [recordLabel, setRecordLabel] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [publisher, setPublisher] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");
  const [isExplicit, setIsExplicit] = useState(false);
  
  // Permissions
  const [enableDirectDownloads, setEnableDirectDownloads] = useState(false);
  const [displayEmbedCode, setDisplayEmbedCode] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [showCommentsToPublic, setShowCommentsToPublic] = useState(true);
  
  // Licensing
  const [licenseType, setLicenseType] = useState<'all-rights-reserved' | 'creative-commons'>('all-rights-reserved');
  const [uploadStep, setUploadStep] = useState<'basic' | 'metadata' | 'permissions' | 'licensing'>('basic');

  const [showUploadError, setShowUploadError] = useState(false);
  const [showMissingInfoPrompt, setShowMissingInfoPrompt] = useState(false);
  const [missingInfoMessage, setMissingInfoMessage] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'tracks' | 'messages'>('tracks');
  const [trackFilter, setTrackFilter] = useState<'all' | 'albums' | 'my'>('albums');
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-white/10');
          setTimeout(() => element.classList.remove('bg-white/10'), 2000);
        }, 100);
      }
    }
  }, [location.hash, tracks]);

  const handleFetchMetadata = async () => {
    if (!soundcloudUrl) return;
    setIsFetchingMetadata(true);
    setUploadStatus("Fetching metadata...");
    try {
      const response = await fetch(`/api/soundcloud/metadata?url=${encodeURIComponent(soundcloudUrl)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch metadata");
      
      if (data.title) setNewTrackTitle(data.title);
      if (data.artist) setNewTrackArtist(data.artist);
      if (data.genre) setGenre(data.genre);
      if (data.releaseDate) setReleaseDate(data.releaseDate);
      
      setUploadStatus("Metadata fetched successfully!");
      setTimeout(() => setUploadStatus(""), 3000);
    } catch (error: any) {
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const standardizeRecordLabels = async () => {
    if (!user || user.email !== OWNER_EMAIL) return;
    
    try {
      // Find the "vibes" track
      const vibesTrack = tracks.find(t => 
        t.title.toLowerCase() === 'vibes' || 
        t.title.toLowerCase() === 'vibe' ||
        t.title.toLowerCase().includes('vibe')
      );
      
      if (!vibesTrack || !vibesTrack.recordLabel) {
        showNotification("Could not find 'vibes' track or it has no record label set.", 'error');
        return;
      }
      
      const standardLabel = vibesTrack.recordLabel;
      confirmAction(`Standardize all tracks to record label: "${standardLabel}"?`, async () => {
        setUploadStatus("Standardizing record labels...");
        
        // Update all tracks that don't have this label
        const batch = tracks.filter(t => t.recordLabel !== standardLabel);
        
        for (const track of batch) {
          await fetch(`/api/tracks/${track.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ ...track, recordLabel: standardLabel }),
          });
        }
        
        setUploadStatus("All tracks updated successfully!");
        showNotification(`Standardized ${batch.length} tracks to "${standardLabel}"`, 'success');
        setTimeout(() => setUploadStatus(""), 3000);
      });
    } catch (error: any) {
      console.error("Error standardizing labels:", error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };

  const filteredTracks = (trackFilter === 'albums' || trackFilter === 'all' 
    ? tracks.filter((t: Track) => t.isVisible) 
    : tracks.filter((t: Track) => t.authorId === user?.id))
    .sort((a: any, b: any) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.createdAt?.toDate?.()?.getTime() || 0);
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.createdAt?.toDate?.()?.getTime() || 0);
      return dateB - dateA;
    });

  const albumsMap = useMemo(() => {
    const map: Record<string, any> = {};
    albums.forEach(album => {
      map[album.id] = {
        ...album,
        name: album.title,
        tracks: album.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean)
      };
    });
    return map;
  }, [albums, tracks]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!newTrackTitle) {
      setMissingInfoMessage("You must enter a Track title.");
      setShowMissingInfoPrompt(true);
      return;
    }
    if (!newTrackArtist) {
      setMissingInfoMessage("You must enter an Artist name.");
      setShowMissingInfoPrompt(true);
      return;
    }
    if (!releaseDate) {
      setMissingInfoMessage("You must enter a Release date.");
      setShowMissingInfoPrompt(true);
      return;
    }
    if (!audioFile) {
      setMissingInfoMessage("You must select an Audio file.");
      setShowMissingInfoPrompt(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Starting upload...");

    try {
      setUploadStatus("Uploading audio...");
      setUploadProgress(10);
      const audioFormData = new FormData();
      audioFormData.append("file", audioFile);
      const audioRes = await fetch("/api/upload", { method: "POST", credentials: "include", body: audioFormData });
      const audioData = await audioRes.json();
      if (!audioRes.ok) throw new Error(audioData.error || "Audio upload failed");
      const audioUrl = audioData.url;
      setUploadProgress(50);

      let coverUrl = "";
      if (coverFile) {
        setUploadStatus("Uploading cover art...");
        const coverFormData = new FormData();
        coverFormData.append("file", coverFile);
        const coverRes = await fetch("/api/upload", { method: "POST", credentials: "include", body: coverFormData });
        const coverData = await coverRes.json();
        if (coverRes.ok) coverUrl = coverData.url;
        setUploadProgress(90);
      } else {
        setUploadProgress(90);
      }

      setUploadStatus("Saving track details...");
      await handleUploadTrack({
        title: newTrackTitle,
        artist: newTrackArtist,
        album,
        audioUrl,
        coverUrl,
        trackLink,
        genre,
        description,
        privacy,
        buyLink,
        recordLabel,
        releaseDate,
        publisher,
        soundcloudUrl,
        isExplicit,
        enableDirectDownloads,
        displayEmbedCode,
        allowComments,
        showCommentsToPublic,
        licenseType
      });

      setUploadProgress(100);
      setUploadStatus(isAdmin ? "Upload complete!" : "Upload complete! Your track is currently private.");
      console.log("Track successfully saved to Firestore.");
      
      setTimeout(() => {
        setNewTrackTitle("");
        setNewTrackArtist("Axrid");
        setTrackLink("");
        setGenre("");
        setAlbum("");
        setDescription("");
        setPrivacy('public');
        setBuyLink("");
        setRecordLabel("");
        setReleaseDate("");
        setPublisher("");
        setSoundcloudUrl("");
        setIsExplicit(false);
        setEnableDirectDownloads(false);
        setDisplayEmbedCode(true);
        setAllowComments(true);
        setShowCommentsToPublic(true);
        setLicenseType('all-rights-reserved');
        setAudioFile(null);
        setCoverFile(null);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus("");
        setUploadStep('basic');
      }, 3000);

    } catch (error: any) {
      console.error("Full upload error object:", error);
      let errorMessage = "Upload failed. ";
      if (error.code === 'storage/unauthorized') {
        errorMessage += "Permission denied to Storage. Please check security rules.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please try again.";
      }
      setUploadStatus(errorMessage);
      setIsUploading(false);
    }
  };

  const content = (
    <>
      <section className="pt-32 md:pt-48 pb-24 px-6 max-w-5xl mx-auto min-h-[70vh]">
      <div className="flex items-baseline justify-between mb-16">
        <motion.h1 
          initial={noTransition ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={noTransition ? { duration: 0 } : undefined}
          className="text-3xl font-bold tracking-tighter uppercase"
        >
          Music
        </motion.h1>
        <div className="flex gap-8">
          <button 
            onClick={() => setActiveSubTab('tracks')}
            className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-all cursor-pointer ${activeSubTab === 'tracks' ? 'text-paper border-b border-paper pb-1' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Tracks
          </button>
        </div>
      </div>

      {activeSubTab === 'tracks' ? (
        <div className="space-y-16">
          <div>
            <div className="flex flex-wrap items-center gap-6 mb-12">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => { setTrackFilter('albums'); setSelectedAlbum(null); }}
                  className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-all cursor-pointer ${trackFilter === 'albums' ? 'text-paper border-b border-paper pb-1' : 'text-paper/20 hover:text-paper/40'}`}
                >
                  Albums
                </button>
                <button 
                  onClick={() => { setTrackFilter('all'); setSelectedAlbum(null); }}
                  className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-all cursor-pointer ${trackFilter === 'all' ? 'text-paper border-b border-paper pb-1' : 'text-paper/20 hover:text-paper/40'}`}
                >
                  All Tracks
                </button>
                <button 
                  onClick={() => { setTrackFilter('my'); setSelectedAlbum(null); }}
                  className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-all cursor-pointer ${trackFilter === 'my' ? 'text-paper border-b border-paper pb-1' : 'text-paper/20 hover:text-paper/40'}`}
                >
                  My Tracks
                </button>
              </div>
              {isAdmin && trackFilter === 'albums' && !selectedAlbum && (
                <button 
                  onClick={() => setIsAlbumModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-line rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all"
                >
                  <Plus size={14} /> Create Album
                </button>
              )}
            </div>
          </div>
              {filteredTracks.length === 0 ? (
                <p className="text-white/20 text-center py-24 uppercase tracking-widest text-[10px]">No tracks available.</p>
              ) : trackFilter === 'albums' && albumsMap ? (
                selectedAlbum && albumsMap[selectedAlbum] ? (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setSelectedAlbum(null)}
                      className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-xs uppercase tracking-widest"
                    >
                      <ChevronLeft size={16} /> Back to Albums
                    </button>
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-8">
                      <div className="w-32 h-32 sm:w-48 sm:h-48 bg-ink/50 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl border border-line/20">
                        {albumsMap[selectedAlbum].coverUrl ? (
                          <img src={albumsMap[selectedAlbum].coverUrl} alt={selectedAlbum} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-20">
                            <MusicIcon size={64} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mb-2">Album</span>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-2 leading-none">{albumsMap[selectedAlbum].name}</h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <p className="text-sm text-white/50 font-medium">
                            {albumsMap[selectedAlbum].artist || 'Various Artists'} • {albumsMap[selectedAlbum].tracks.length} tracks
                            {albumsMap[selectedAlbum].releaseDate && ` • Released ${new Date(albumsMap[selectedAlbum].releaseDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </p>
                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  setEditingAlbum(albumsMap[selectedAlbum]);
                                  setIsAlbumModalOpen(true);
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
                                title="Edit Album"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button 
                                  onClick={async () => {
                                    await onDeleteAlbum(selectedAlbum);
                                    setSelectedAlbum(null);
                                  }}
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white/50 hover:text-red-500"
                                title="Delete Album"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-card/30 backdrop-blur-xl rounded-3xl border border-line/50 overflow-hidden">
                      {/* List Header */}
                      <div className="px-3 py-3 sm:px-6 sm:py-4 border-b border-line/20 bg-white/5 flex items-center gap-2 sm:gap-6">
                        <div className="w-10 sm:w-12 flex-shrink-0 flex justify-center">
                          <span className="text-[7px] sm:text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper text-center leading-tight">Album Cover</span>
                        </div>
                        <div className="flex-grow min-w-[80px]">
                          <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Title / Artist</span>
                        </div>
                        <div className="w-10 flex-shrink-0 flex justify-center">
                          <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Play</span>
                        </div>
                        <div className="hidden md:block w-24 text-right flex-shrink-0">
                          <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Date</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 justify-center sm:min-w-[120px]">
                          <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Actions</span>
                        </div>
                      </div>
                      {albumsMap[selectedAlbum].tracks.map((track: Track) => (
                        <TrackItem 
                          key={track.id} 
                          track={track} 
                          isAdmin={isAdmin} 
                          user={user}
                          handleDeleteTrack={handleDeleteTrack} 
                          handleToggleTrackVisibility={handleToggleTrackVisibility} 
                          onImageClick={(url, title) => setLightboxImage({ url, title })}
                          onEdit={setEditingTrack}
                          onSync={handleSyncTrack}
                          showNotification={showNotification}
                          confirmAction={confirmAction}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                    {Object.values(albumsMap).map((album: any) => (
                      <div 
                        key={album.id} 
                        className="group relative flex flex-col gap-2 sm:gap-3 cursor-pointer"
                        onClick={() => setSelectedAlbum(album.id)}
                      >
                        <div className="relative w-full aspect-square bg-ink/50 rounded-lg overflow-hidden border border-line/20 shadow-lg">
                          {album.coverUrl ? (
                            <img 
                              src={album.coverUrl} 
                              alt={album.name} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <MusicIcon size={32} className="opacity-20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div 
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent text-black flex items-center justify-center hover:scale-105 transition-transform"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (album.tracks.length > 0) {
                                  playTrack(album.tracks[0]);
                                }
                              }}
                            >
                              <Play size={20} className="ml-1 sm:w-6 sm:h-6" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col px-1 pt-3">
                          <h4 className="text-[11px] sm:text-[13px] font-bold text-white group-hover:underline leading-tight break-words line-clamp-2">{album.name}</h4>
                          <p className="text-[9px] sm:text-[11px] text-white/50 break-words line-clamp-1 mt-1.5">{album.artist || 'Various Artists'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="bg-card/30 backdrop-blur-xl rounded-3xl border border-line/50 overflow-hidden">
                  {/* List Header */}
                  <div className="px-3 py-3 sm:px-6 sm:py-4 border-b border-line/20 bg-white/5 flex items-center gap-2 sm:gap-6">
                    <div className="w-10 sm:w-12 flex-shrink-0 flex justify-center">
                      <span className="text-[7px] sm:text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper text-center leading-tight">Album Cover</span>
                    </div>
                    <div className="flex-grow min-w-[80px]">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Title / Artist</span>
                    </div>
                    <div className="w-10 flex-shrink-0 flex justify-center">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Play</span>
                    </div>
                    <div className="hidden md:block w-24 text-right flex-shrink-0">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Date</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 justify-center sm:min-w-[120px]">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 text-paper">Actions</span>
                    </div>
                  </div>
                  {filteredTracks.map((track: Track) => (
                      <TrackItem 
                        key={track.id} 
                        track={track} 
                        isAdmin={isAdmin} 
                        user={user}
                        handleDeleteTrack={handleDeleteTrack} 
                        handleToggleTrackVisibility={handleToggleTrackVisibility} 
                        onImageClick={(url, title) => setLightboxImage({ url, title })}
                        onEdit={setEditingTrack}
                        onSync={handleSyncTrack}
                        showNotification={showNotification}
                        confirmAction={confirmAction}
                      />
                  ))}
                </div>
              )}

              <motion.div 
            initial={noTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={noTransition ? { duration: 0 } : undefined}
            className="bg-card p-8 rounded-3xl border border-line overflow-hidden"
          >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
                  <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 cursor-pointer flex items-center gap-2" onClick={() => setIsUploadExpanded(!isUploadExpanded)}>
                    {isUploadExpanded ? 'Hide Upload' : 'Upload New Track'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isUploadExpanded ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>
                  </h3>
                  {isUploadExpanded && (
                    <div className="flex flex-wrap gap-2">
                      {['basic', 'metadata', 'permissions', 'licensing'].map((step) => (
                      <button
                        key={step}
                        onClick={() => setUploadStep(step as any)}
                        className={`text-[8px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full transition-all ${uploadStep === step ? 'bg-accent text-ink' : 'bg-card border border-line text-paper/40 hover:text-paper'}`}
                      >
                        {step}
                      </button>
                    ))}
                  </div>
                  )}
                </div>

                {isUploadExpanded && (
                <form onSubmit={onUpload} className="space-y-12">
                  <AnimatePresence mode="wait">
                    {uploadStep === 'basic' && (
                      <motion.div 
                        key="basic"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-12"
                      >
                        <div className="space-y-8">
                          <div className="space-y-6">
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Title & Artist</label>
                              <input
                                type="text"
                                value={user ? newTrackTitle : ""}
                                onChange={(e) => setNewTrackTitle(e.target.value)}
                                placeholder="Track Title"
                                className="w-full bg-card border border-line rounded-xl px-4 py-3 text-lg placeholder:text-paper/10 focus:outline-none focus:border-accent transition-colors"
                                disabled={!user}
                              />
                              <input
                                type="text"
                                value={user ? newTrackArtist : ""}
                                onChange={(e) => setNewTrackArtist(e.target.value)}
                                placeholder="Artist Name"
                                className="w-full bg-card border border-line rounded-xl px-4 py-3 text-lg placeholder:text-paper/10 focus:outline-none focus:border-accent transition-colors"
                                disabled={!user}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Release Date</label>
                              <div className="relative group">
                                <input
                                  type={releaseDate ? "datetime-local" : "text"}
                                  onFocus={(e) => e.target.type = "datetime-local"}
                                  onBlur={(e) => { if (!releaseDate) e.target.type = "text" }}
                                  value={releaseDate}
                                  onChange={(e) => setReleaseDate(e.target.value)}
                                  placeholder="Select Release Date"
                                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-sm placeholder:text-paper/10 focus:outline-none focus:border-accent transition-colors text-paper/60 appearance-none cursor-pointer hover:border-paper/20"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                                  <Calendar size={16} />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Explicit Content</label>
                              <div className="flex gap-2">
                                {[
                                  { label: 'Yes', value: true },
                                  { label: 'No', value: false }
                                ].map((opt) => (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => setIsExplicit(opt.value)}
                                    className={`flex-1 py-3 rounded-xl border text-[10px] uppercase tracking-widest font-bold transition-all ${isExplicit === opt.value ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Genre</label>
                              <input
                                type="text"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                placeholder="Genre"
                                className="w-full bg-card border border-line rounded-xl px-4 py-3 text-sm placeholder:text-paper/10 focus:outline-none focus:border-accent transition-colors"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Album</label>
                              <input
                                type="text"
                                value={album}
                                onChange={(e) => setAlbum(e.target.value)}
                                placeholder="Album Name"
                                className="w-full bg-card border border-line rounded-xl px-4 py-3 text-sm placeholder:text-paper/10 focus:outline-none focus:border-accent transition-colors"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Description</label>
                              <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Tell us about this track..."
                                rows={4}
                                className="w-full bg-card border border-line rounded-xl px-4 py-3 text-sm placeholder:text-paper/10 focus:outline-none focus:border-accent transition-colors resize-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="space-y-4">
                            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Files</label>
                            <div className="grid grid-cols-1 gap-4">
                              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-line rounded-2xl hover:border-accent transition-colors cursor-pointer group bg-card">
                                <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className="hidden" />
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`mb-3 ${audioFile ? 'text-emerald-500' : 'opacity-20 group-hover:opacity-100'}`}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                <span className="text-[10px] uppercase tracking-widest font-bold">{audioFile ? audioFile.name : 'Select Audio File'}</span>
                              </label>

                              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-line rounded-2xl hover:border-accent transition-colors cursor-pointer group bg-card">
                                <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="hidden" />
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`mb-3 ${coverFile ? 'text-emerald-500' : 'opacity-20 group-hover:opacity-100'}`}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                <span className="text-[10px] uppercase tracking-widest font-bold">{coverFile ? coverFile.name : 'Select Cover Art'}</span>
                              </label>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Privacy</label>
                            <div className="flex gap-4">
                              {['public', 'private'].map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => {
                                    if (!isAdmin && p === 'public') {
                                      setIsPublicPromptOpen(true);
                                    } else {
                                      setPrivacy(p as any);
                                    }
                                  }}
                                  className={`flex-1 py-3 rounded-xl border text-[10px] uppercase tracking-widest font-bold transition-all ${privacy === p ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'}`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {uploadStep === 'metadata' && (
                      <motion.div 
                        key="metadata"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-12"
                      >
                        <div className="space-y-6">
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Buy Link</label>
                            <input
                              type="url"
                              value={buyLink}
                              onChange={(e) => setBuyLink(e.target.value)}
                              placeholder="https://..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Record Label</label>
                            <input
                              type="text"
                              value={recordLabel}
                              onChange={(e) => setRecordLabel(e.target.value)}
                              placeholder="Label Name"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-colors"
                            />
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">Publisher</label>
                            <input
                              type="text"
                              value={publisher}
                              onChange={(e) => setPublisher(e.target.value)}
                              placeholder="Publisher Name"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30 ml-1">SoundCloud URL</label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={soundcloudUrl}
                                onChange={(e) => setSoundcloudUrl(e.target.value)}
                                placeholder="https://soundcloud.com/..."
                                className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-colors"
                              />
                              <button
                                type="button"
                                onClick={handleFetchMetadata}
                                disabled={isFetchingMetadata || !soundcloudUrl}
                                className="px-4 py-3 bg-accent/10 text-accent rounded-xl text-[8px] uppercase tracking-widest font-bold hover:bg-accent/20 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                              >
                                <Search size={14} />
                                {isFetchingMetadata ? "Fetching..." : "Fetch Info"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {uploadStep === 'permissions' && (
                      <motion.div 
                        key="permissions"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8"
                      >
                        {[
                          { label: 'Direct Downloads', state: enableDirectDownloads, setter: setEnableDirectDownloads },
                          { label: 'Allow Comments', state: allowComments, setter: setAllowComments },
                        ].map((perm, i) => (
                          <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">{perm.label}</span>
                            <button
                              type="button"
                              onClick={() => perm.setter(!perm.state)}
                              className={`w-10 h-5 rounded-full transition-all relative ${perm.state ? 'bg-emerald-500' : 'bg-white/10'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${perm.state ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {uploadStep === 'licensing' && (
                      <motion.div 
                        key="licensing"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            { id: 'all-rights-reserved', label: 'All Rights Reserved' },
                            { id: 'creative-commons', label: 'Creative Commons' },
                          ].map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => setLicenseType(l.id as any)}
                              className={`p-6 rounded-2xl border text-left transition-all ${licenseType === l.id ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'}`}
                            >
                              <h4 className="text-sm font-bold uppercase tracking-widest mb-1">{l.label}</h4>
                              <p className="text-[10px] opacity-60 leading-relaxed">
                                {l.id === 'all-rights-reserved' 
                                  ? 'You retain all legal rights to this work. Others must ask permission to use it.' 
                                  : 'Allow others to share and use your work under specific conditions.'}
                              </p>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                    <div className="flex-grow max-w-md">
                      {isUploading && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[8px] uppercase tracking-widest font-bold opacity-40">
                            <span>{uploadStatus}</span>
                            <span>{Math.round(uploadProgress)}%</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-white"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {!isUploading && uploadStatus && (
                        <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-500">{uploadStatus}</p>
                      )}
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={isUploading}
                      className="bg-white text-black text-[10px] uppercase tracking-[0.3em] font-bold px-12 py-4 rounded-full hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-white/5"
                    >
                      {isUploading ? 'Uploading...' : 'Publish Track'}
                    </button>
                  </div>
                </form>
                )}
              </motion.div>
            </div>
          ) : (
          <Messages user={user} profile={profile} />
        )}
      </section>

      {editingTrack && (
        <EditTrackModal 
          track={editingTrack} 
          isOpen={!!editingTrack}
          onClose={() => setEditingTrack(null)} 
          onUpdate={handleUpdateTrack} 
        />
      )}

      <Prompt
        isOpen={showUploadError}
        onClose={() => setShowUploadError(false)}
        title="Upload Restricted"
        message="You must contact Axrid to release music onto the platform."
        icon={<AlertTriangle size={32} className="text-red-500" />}
        primaryLabel="Understood"
        onPrimaryClick={() => setShowUploadError(false)}
        primaryHoverColor="hover:bg-red-500"
      />

      <Prompt
        isOpen={showMissingInfoPrompt}
        onClose={() => setShowMissingInfoPrompt(false)}
        title="Incomplete Info"
        message={missingInfoMessage || "You must fill in the info to upload."}
        icon={<AlertTriangle size={32} className="text-red-500" />}
        primaryLabel="Got it"
        onPrimaryClick={() => setShowMissingInfoPrompt(false)}
        primaryHoverColor="hover:bg-red-500"
      />
    </>
  );

  if (noTransition) return content;

  return (
    <PageTransition>
      {content}
    </PageTransition>
  );
};

const Updates = ({ 
  user, 
  isAdmin, 
  posts, 
  handleCreatePost, 
  handleDeletePost, 
  handleToggleVisibility, 
  newPostContent, 
  setNewPostContent, 
  newPostTitle, 
  setNewPostTitle, 
  newPostSubtitle, 
  setNewPostSubtitle, 
  isPosting, 
  setLightboxImage,
  noTransition
}: any) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !user || !isAdmin) return;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    handleCreatePost(fakeEvent);
    setShowConfirm(false);
  };

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newPostContent;
    
    const before = text.substring(0, start);
    const after = text.substring(end);
    const selection = text.substring(start, end);
    
    const newText = before + prefix + (selection || "") + suffix + after;
    setNewPostContent(newText);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = start + prefix.length + (selection ? selection.length + suffix.length : 0);
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const content = (
    <section className="pt-32 md:pt-48 pb-24 px-6 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-16">
        <motion.h1 
          initial={noTransition ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight md:tracking-tighter uppercase"
        >
          Recent Updates
        </motion.h1>
      </div>

      {isAdmin && (
        <motion.div 
          initial={noTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-24 bg-zinc-900/50 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border border-white/5 shadow-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 ml-1">Title</label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="Enter update title..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-xl placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 ml-1">Subtitle</label>
                <input
                  type="text"
                  value={newPostSubtitle}
                  onChange={(e) => setNewPostSubtitle(e.target.value)}
                  placeholder="Optional subtitle..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-xl placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-all"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 ml-1">Formatting</label>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => insertMarkdown("**", "**")} className="px-4 py-2 text-[10px] font-bold uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black rounded-lg transition-all cursor-pointer">Bold</button>
                <button type="button" onClick={() => insertMarkdown("*", "*")} className="px-4 py-2 text-[10px] font-bold uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black rounded-lg transition-all cursor-pointer">Italic</button>
                <button type="button" onClick={() => insertMarkdown("[Button Text](", ")")} className="px-4 py-2 text-[10px] font-bold uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black rounded-lg transition-all cursor-pointer">Button Link</button>
                <button type="button" onClick={() => insertMarkdown("> ")} className="px-4 py-2 text-[10px] font-bold uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black rounded-lg transition-all cursor-pointer">Quote</button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 ml-1">Content</label>
              <textarea
                ref={textareaRef}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's new?"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 text-lg placeholder:text-white/10 focus:outline-none focus:border-white/30 transition-all resize-none h-48"
              />
            </div>

            <div className="flex justify-end">
              <button 
                disabled={isPosting || !newPostContent.trim()}
                className="group relative overflow-hidden px-12 py-4 bg-white text-black font-bold uppercase text-[10px] tracking-[0.3em] rounded-xl hover:scale-105 transition-all disabled:opacity-30 cursor-pointer"
              >
                <span className="relative z-10">{isPosting ? "Sending..." : "Broadcast Update"}</span>
              </button>
            </div>
          </form>

          <Prompt 
            isOpen={showConfirm} 
            onClose={() => setShowConfirm(false)} 
            title="Broadcast Update" 
            message="Are you sure you want to broadcast this update to all users?" 
            primaryLabel="Confirm Broadcast" 
            onPrimaryClick={handleConfirm}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            }
          />
        </motion.div>
      )}

      <div className="max-w-2xl mx-auto space-y-12">
        {posts.length > 0 ? (
          posts.map((post: any, index: number) => {
            const soundCloudEmbed = getSoundCloudEmbed(post.content);
            return (
              <motion.div 
                key={post.id} 
                initial={noTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                whileInView={noTransition ? undefined : { opacity: 1, y: 0 }}
                animate={noTransition ? { opacity: 1, y: 0 } : undefined}
                viewport={noTransition ? undefined : { once: true }}
                transition={noTransition ? { duration: 0 } : { duration: 0.5, ease: "easeOut", delay: Math.min(index * 0.1, 0.3) }}
                className="group relative bg-card border border-line rounded-2xl p-6 md:p-8 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div>
                    <h4 className="font-bold text-lg tracking-tight">{post.authorName === 'Kurt Dolan' ? 'Axrid' : post.authorName}</h4>
                    <div className="text-xs text-white/40 font-medium">
                      {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }) : "Recent"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {post.title && (
                    <h3 className="text-2xl font-bold tracking-tight uppercase leading-tight">
                      {post.title}
                    </h3>
                  )}
                  {post.subtitle && (
                    <p className="text-lg text-white/50 font-medium tracking-tight italic">
                      {post.subtitle}
                    </p>
                  )}
                  
                  <div className="prose prose-invert max-w-none">
                    <div className="text-base leading-relaxed text-white/80">
                      <Markdown 
                        components={{
                          a: ({node, ...props}) => (
                            <a 
                              {...props} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-white underline hover:text-white/70 transition-colors" 
                            />
                          ),
                          img: ({node, ...props}) => (
                            <div className="select-none my-6" onContextMenu={(e) => e.preventDefault()}>
                              <img 
                                {...props} 
                                className="w-full h-auto rounded-xl border border-white/5 cursor-pointer hover:scale-[1.01] transition-transform duration-500 shadow-xl" 
                                referrerPolicy="no-referrer"
                                onClick={() => setLightboxImage({ url: props.src || "", title: props.alt || "" })}
                                onContextMenu={(e) => e.preventDefault()}
                                draggable={false}
                              />
                            </div>
                          ),
                          blockquote: ({node, ...props}) => (
                            <blockquote {...props} className="border-l-2 border-white/20 pl-4 italic text-white/60" />
                          )
                        }}
                      >
                        {post.content}
                      </Markdown>
                    </div>
                  </div>
                </div>

                {soundCloudEmbed && (
                  <div className="mt-8">
                    <iframe 
                      width="100%" 
                      height="166" 
                      scrolling="no" 
                      frameBorder="no" 
                      allow="autoplay" 
                      src={soundCloudEmbed}
                      className="rounded-xl"
                    />
                  </div>
                )}

                {isAdmin && (
                  <div className="flex items-center gap-6 pt-8 border-t border-white/5">
                    <button 
                      onClick={() => handleToggleVisibility(post.id, post.isVisible)}
                      className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer ${post.isVisible ? 'text-white/20 hover:text-white' : 'text-emerald-500 hover:text-emerald-400'}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${post.isVisible ? 'bg-white/20' : 'bg-emerald-500 animate-pulse'}`} />
                      {post.isVisible ? 'Visible' : 'Hidden'}
                    </button>
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="text-[10px] uppercase tracking-widest font-bold text-red-500/40 hover:text-red-500 transition-all cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                )}
                
                <Comments path={`posts/${post.id}/comments`} user={user} isAdmin={isAdmin} />
              </motion.div>
            );
          })
        ) : (
          <div className="py-32 text-center">
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold opacity-20">No updates found</p>
          </div>
        )}
      </div>
    </section>
  );

  if (noTransition) return content;

  return (
    <PageTransition>
      {content}
    </PageTransition>
  );
};

const LoginPage = ({ user, onAuthChange }: any) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body: any = { email, password };
      if (mode === 'register') body.displayName = displayName || email.split('@')[0];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.'); return; }

      const u = data.user;
      onAuthChange({ ...u, uid: u.id });
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <section className="pt-32 md:pt-48 pb-24 px-6 max-w-4xl mx-auto min-h-[80vh] flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-card border border-line p-12 rounded-[2.5rem] backdrop-blur-xl"
        >
          <div className="mb-10">
            <h2 className="text-4xl font-bold tracking-tighter uppercase mb-4">
              {mode === 'login' ? 'Welcome Back' : 'Join the Community'}
            </h2>
            <p className="text-white/40 font-medium tracking-tight leading-relaxed">
              {mode === 'login'
                ? 'Sign in to comment on updates and access exclusive content.'
                : 'Create an account to participate in the community.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-left">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-white outline-none transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-white outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={8}
                className="w-full bg-ink/50 border border-line rounded-xl px-4 py-3 text-sm focus:border-white outline-none transition-colors"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-2xl transition-colors disabled:opacity-50 mt-2"
            >
              {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </motion.button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrorMsg(""); }}
            className="w-full py-3 text-white/40 hover:text-white font-bold uppercase tracking-widest text-[10px] rounded-2xl transition-colors mt-4"
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>

          <p className="text-[10px] uppercase tracking-widest font-bold opacity-20 mt-4">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </motion.div>
      </section>
    </PageTransition>
  );
};

const LoginPrompt = ({ message, onLogin }: { message: string, onLogin: () => void }) => (
  <div className="flex-1 flex items-center justify-center p-6">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="w-full max-w-md bg-card border border-line p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
      
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter uppercase mb-2">Join the Community</h2>
          <div className="h-1 w-12 bg-white/10" />
        </div>
        <Lock size={24} className="text-white/20" />
      </div>
      
      <p className="text-white/40 text-lg leading-relaxed mb-10 font-medium tracking-tight">
        {message}
      </p>
      
      <div className="space-y-4">
        <button
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-white text-black font-bold uppercase text-[10px] tracking-[0.3em] rounded-2xl hover:bg-zinc-200 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
        >
          <UserIcon className="w-4 h-4" />
          Sign In / Register
        </button>
        
        <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-white/20 text-center">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </motion.div>
  </div>
);

const Messages = ({ user, profile }: { user: LocalUser | null, profile: UserProfile | null }) => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string, content: string } | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [viewingHistory, setViewingHistory] = useState<{ id: string, history: any[] } | null>(null);
  const [viewingDeletedMessageId, setViewingDeletedMessageId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch users (for search + owner lookup)
  useEffect(() => {
    fetch("/api/users")
      .then(r => r.json())
      .then(data => {
        const owner = data.find((u: any) => u.email === OWNER_EMAIL);
        if (owner) setOwnerUid(owner.id);
        setUsers(data.filter((u: any) => u.id !== user?.id));
      })
      .catch(console.error);
  }, [user?.id]);

  // Fetch conversations — poll every 5s
  useEffect(() => {
    if (!user) return;
    const load = () => fetch("/api/conversations", { credentials: "include" })
      .then(r => r.json()).then(setConversations).catch(console.error);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [user?.id]);

  // Fetch messages for selected conversation — poll every 3s
  useEffect(() => {
    if (!selectedConversation) { setMessages([]); return; }
    const load = () => fetch(`/api/conversations/${selectedConversation.id}/messages`, { credentials: "include" })
      .then(r => r.json())
      .then(msgs => { setMessages(msgs); setTimeout(scrollToBottom, 100); })
      .catch(console.error);
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [selectedConversation?.id]);

  const handleEditMessage = async (msgId: string, newContent: string) => {
    if (!selectedConversation || !newContent.trim()) return;
    await fetch(`/api/conversations/${selectedConversation.id}/messages/${msgId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent.trim() }),
    });
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!selectedConversation) return;
    await fetch(`/api/conversations/${selectedConversation.id}/messages/${msgId}`, {
      method: "DELETE", credentials: "include",
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedConversation || !newMessage.trim()) return;
    setIsSending(true);
    const content = newMessage.trim();
    setNewMessage("");
    try {
      await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const startConversation = async (otherUser: any) => {
    if (!user) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: otherUser.id }),
      });
      const conv = await res.json();
      setSelectedConversation(conv);
      setShowUserSearch(false);
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  const handleMessageOwner = () => {
    if (ownerUid && user && user.id !== ownerUid) {
      const owner = users.find(u => u.id === ownerUid);
      startConversation(owner || { id: ownerUid, displayName: "Axrid", photoURL: null });
    }
  };

  const getDisplayConversations = () => {
    if (!user || !ownerUid || user.id === ownerUid) return conversations;

    const hasOwnerConv = conversations.some(c => c.participants.includes(ownerUid));
    
    let list = [...conversations];
    
    if (!hasOwnerConv) {
      // Add virtual Axrid conversation
      list = [{
        id: 'virtual_axrid',
        participants: [user.id, ownerUid],
        isVirtual: true,
        participantData: {
          [ownerUid]: {
            displayName: "Axrid",
            photoURL: null
          }
        },
        lastMessage: "Send a message to Axrid"
      }, ...list];
    } else {
      // Move owner conversation to top
      const ownerConvIndex = list.findIndex(c => c.participants.includes(ownerUid));
      if (ownerConvIndex > -1) {
        const [ownerConv] = list.splice(ownerConvIndex, 1);
        list = [ownerConv, ...list];
      }
    }
    
    return list;
  };

  useEffect(() => {
    const targetUserId = searchParams.get('to');
    if (targetUserId && user && users.length > 0) {
      const targetUser = users.find(u => u.id === targetUserId);
      if (targetUser) {
        startConversation(targetUser);
      }
    }
  }, [searchParams, user, users]);

  if (!user) {
    return (
      <PageTransition>
        <section className="pt-32 md:pt-48 pb-24 px-6 max-w-6xl mx-auto h-[90vh] flex flex-col">
          <div className="flex items-baseline justify-between mb-8 flex-shrink-0">
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl md:text-6xl font-bold tracking-tighter uppercase"
            >
              Messages
            </motion.h1>
          </div>
          <LoginPrompt 
            message="Sign in to start messaging other users and join the community." 
            onLogin={() => navigate('/login')} 
          />
        </section>
      </PageTransition>
    );
  }

  const filteredUsers = users.filter(u => 
    (u.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.alias || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition>
      <section className="pt-20 md:pt-48 pb-12 md:pb-24 px-4 md:px-6 max-w-7xl mx-auto h-[90vh] md:h-[95vh] flex flex-col">
        <div className="mb-8 flex-shrink-0">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mb-4"
          >
            Messages
          </motion.h1>
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              onClick={() => setShowUserSearch(true)}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold opacity-50 hover:opacity-100 transition-opacity"
            >
              <Plus size={14} /> New Message
            </button>
          </div>
        </div>

        <div className="flex-1 bg-card border border-line rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row backdrop-blur-xl">
          {/* Sidebar */}
          <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-line flex-col overflow-hidden`}>
            <div className="p-6 border-b border-line space-y-4">
              {user.id !== ownerUid && (
                <button 
                  onClick={handleMessageOwner}
                  className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold border border-line px-4 py-3 rounded-lg hover:bg-paper hover:text-ink transition-all"
                >
                  <MessageSquare size={14} /> Message Axrid
                </button>
              )}
              <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30">Direct Messages</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {getDisplayConversations().map(conv => {
                const otherUserId = conv.participants.find((id: string) => id !== user.id);
                const otherUser = conv.participantData?.[otherUserId];
                const isSelected = selectedConversation?.id === conv.id || (conv.isVirtual && selectedConversation?.participants?.includes(ownerUid));

                return (
                  <button
                    key={conv.id}
                    onClick={() => conv.isVirtual ? handleMessageOwner() : setSelectedConversation(conv)}
                    className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all text-left group ${isSelected ? 'bg-paper text-ink shadow-lg' : 'hover:bg-card border-transparent'} border border-line/5`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold tracking-tight truncate ${isSelected ? 'text-ink' : 'text-paper'}`}>
                        {getDisplayName(otherUser?.email, otherUser?.displayName || "Anonymous")}
                      </p>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-ink/60' : 'opacity-30'}`}>{conv.lastMessage}</p>
                    </div>
                  </button>
                );
              })}
              {getDisplayConversations().length === 0 && (
                <div className="py-12 text-center opacity-20 text-[10px] uppercase tracking-widest">No messages yet</div>
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`${selectedConversation ? 'flex' : 'hidden'} flex-1 flex-col overflow-hidden`}>
            {selectedConversation ? (
              <>
                <div className="p-6 border-b border-line flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedConversation(null)} className="md:hidden">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <span className="text-sm font-bold tracking-tight">
                      {getDisplayName(
                        selectedConversation.participantData?.[selectedConversation.participants.find((id: string) => id !== user.id)]?.email,
                        selectedConversation.participantData?.[selectedConversation.participants.find((id: string) => id !== user.id)]?.displayName
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6">
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === user.id;
                    const isDeletedAndNotViewed = msg.isDeleted && viewingDeletedMessageId !== msg.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`max-w-[90%] md:max-w-[80%] p-3 md:p-5 rounded-2xl ${isMe ? 'bg-paper text-ink rounded-tr-none' : 'bg-card text-paper rounded-tl-none border border-line'}`}>
                          <p className="text-xs md:text-sm leading-relaxed">
                            {isDeletedAndNotViewed ? (
                              <span className="italic opacity-50">
                                This message was deleted. <button onClick={() => setViewingDeletedMessageId(msg.id)} className="underline">View original</button>
                              </span>
                            ) : (
                              <>
                                {msg.isDeleted && <span className="italic opacity-50 block mb-1 text-[10px]">Deleted message:</span>}
                                {msg.content}
                              </>
                            )}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <p className={`text-[8px] font-bold uppercase tracking-widest ${isMe ? 'opacity-40' : 'opacity-20'}`}>
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sending..."}
                              {msg.editedAt && " (edited)"}
                            </p>
                            {isMe && !msg.isDeleted && (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {msg.history && <button onClick={() => setViewingHistory({ id: msg.id, history: msg.history })} className="text-[8px] uppercase font-bold opacity-50 hover:opacity-100">History</button>}
                                <button onClick={() => setEditingMessage({ id: msg.id, content: msg.content })} className="text-[8px] uppercase font-bold opacity-50 hover:opacity-100">Edit</button>
                                <button onClick={() => setDeletingMessageId(msg.id)} className="text-[8px] uppercase font-bold opacity-50 hover:opacity-100 text-red-500">Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-6 border-t border-line flex gap-4 flex-shrink-0">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-input border border-line rounded-xl px-6 py-3 text-sm focus:outline-none focus:border-paper transition-colors"
                  />
                  <button
                    disabled={isSending || !newMessage.trim()}
                    className="bg-paper text-ink p-3 rounded-xl hover:scale-105 transition-transform disabled:opacity-30 disabled:scale-100"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-20">
                <MessageSquare size={48} className="mb-6" />
                <p className="text-[10px] uppercase tracking-[0.5em] font-bold">Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>

        {/* History Modal */}
        {viewingHistory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-card border border-line p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Message History</h3>
              <div className="space-y-4 mb-6">
                {viewingHistory.history.map((h: any, i: number) => (
                  <div key={i} className="bg-input p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-xs">{h.content}</p>
                      <p className="text-[8px] opacity-50 mt-1">{h.timestamp ? new Date(h.timestamp).toLocaleString() : "Unknown"}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 justify-end">
                <button onClick={() => setViewingHistory(null)} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingMessage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <div className="bg-card border border-line p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Edit Message</h3>
              <p className="text-[10px] opacity-50 mb-2">Original: {editingMessage.content}</p>
              <textarea
                value={editingMessage.content}
                onChange={(e) => setEditingMessage({ ...editingMessage, content: e.target.value })}
                className="w-full bg-input border border-line rounded-xl p-4 text-sm mb-6 focus:outline-none focus:border-paper transition-colors"
                rows={3}
              />
              <div className="flex gap-4 justify-end">
                <button onClick={() => setEditingMessage(null)} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100">Cancel</button>
                <button onClick={() => {
                  handleEditMessage(editingMessage.id, editingMessage.content);
                  setEditingMessage(null);
                }} className="text-[10px] uppercase font-bold text-paper">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        <ConfirmModal
          isOpen={!!deletingMessageId}
          onClose={() => setDeletingMessageId(null)}
          onConfirm={() => {
            if (deletingMessageId) handleDeleteMessage(deletingMessageId);
            setDeletingMessageId(null);
          }}
          title="Delete Message"
          message="Are you sure you want to delete this message?"
        />

        {/* User Search Modal */}
        <AnimatePresence>
          {showUserSearch && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowUserSearch(false)}
                className="absolute inset-0 bg-modal backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-ink border border-line rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-line">
                  <h3 className="text-xl font-bold tracking-tighter uppercase mb-6">New Message</h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="w-full bg-input border border-line rounded-2xl pl-12 pr-6 py-4 text-sm focus:outline-none focus:border-paper transition-colors"
                    />
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
                  {filteredUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => startConversation(u)}
                      className="w-full p-4 rounded-2xl flex items-center gap-4 hover:bg-card transition-colors text-left group"
                    >
                      <div>
                        <p className="text-sm font-bold tracking-tight">{getDisplayName(u, u)}</p>
                      </div>
                    </button>
                  ))}
                  {filteredUsers.length === 0 && searchQuery && (
                    <div className="py-12 text-center opacity-20 text-[10px] uppercase tracking-widest">No users found</div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </section>
    </PageTransition>
  );
};

const PublicProfile = ({ users, tracks, isAdmin, user, handleDeleteTrack, handleToggleTrackVisibility, setLightboxImage, showNotification, confirmAction }: any) => {
  const { userId } = useParams();
  const profileUser = users.find((u: any) => u.id === userId);
  const userTracks = tracks.filter((t: any) => t.authorId === userId && (t.isVisible || isAdmin || t.authorId === user?.uid));

  if (!profileUser) {
    return (
      <PageTransition>
        <section className="pt-32 md:pt-48 pb-24 px-6 max-w-5xl mx-auto min-h-[70vh]">
          <h1 className="text-2xl font-bold">User not found</h1>
        </section>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <section className="pt-32 md:pt-48 pb-24 px-6 max-w-5xl mx-auto min-h-[70vh]">
        <div className="flex items-baseline justify-between mb-16">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl md:text-6xl font-bold tracking-tighter uppercase"
          >
            {profileUser.alias || profileUser.name || "User Profile"}
          </motion.h1>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-20">Public Profile</p>
        </div>

        <div className="space-y-12">
          <div className="bg-card border border-line rounded-2xl p-8">
            <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">Tracks</h2>
            {userTracks.length === 0 ? (
              <p className="text-[10px] opacity-40 italic">No tracks found.</p>
            ) : (
              <div className="flex flex-col">
                {userTracks.map((track: any) => (
                  <TrackItem 
                    key={track.id} 
                    track={track} 
                    isAdmin={isAdmin} 
                    user={user}
                    handleDeleteTrack={handleDeleteTrack} 
                    handleToggleTrackVisibility={handleToggleTrackVisibility}
                    onImageClick={(url, title) => setLightboxImage({ url, title })}
                    onEdit={() => {}}
                    showNotification={showNotification}
                    confirmAction={confirmAction}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageTransition>
  );
};

const UserSettings = ({ user, profile, setProfile, onThemeToggle, theme }: any) => {
  if (!user) return <Navigate to="/login" />;

  const [alias, setAlias] = useState(profile?.alias || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !alias.trim()) return;
    setIsSaving(true);
    setSaveStatus("");
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: alias.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setProfile({ ...profile, alias: alias.trim() });
      setSaveStatus("Settings saved successfully!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (error) {
      console.error("Error updating settings:", error);
      setSaveStatus("Error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageTransition>
      <section className="pt-32 md:pt-48 pb-24 px-6 max-w-5xl mx-auto min-h-[70vh]">
        <div className="flex items-baseline justify-between mb-16">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl md:text-6xl font-bold tracking-tighter uppercase"
          >
            Settings
          </motion.h1>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-20">User Profile</p>
        </div>

        <div className="max-w-2xl">
          <div className="bg-card p-8 rounded-3xl border border-line space-y-12">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mb-8">Account Information</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-line bg-zinc-800">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold opacity-30">?</div>
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-bold tracking-tight">{user?.displayName}</p>
                    <p className="text-sm opacity-40">{user?.email}</p>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-12">
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-30">Display Name</label>
                <input 
                  type="text" 
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="w-full bg-transparent border-b border-line py-4 text-2xl placeholder:text-paper/10 focus:outline-none focus:border-paper transition-colors"
                  placeholder="Enter your forum name..."
                  maxLength={30}
                />
                <p className="text-[10px] opacity-20 uppercase tracking-widest">This name will be shown on anything posted.</p>
              </div>

              <div className="space-y-6 mt-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-30 block mb-1">Appearance</label>
                    <p className="text-xs opacity-40">Switch between light and dark mode.</p>
                  </div>
                  <div className="flex bg-card p-1 rounded-xl border border-line">
                    <button
                      type="button"
                      onClick={() => onThemeToggle('dark')}
                      className={`px-4 py-2 rounded-lg text-[8px] uppercase tracking-widest font-bold transition-all ${theme === 'dark' ? 'bg-accent text-ink' : 'text-paper/40 hover:text-paper'}`}
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => onThemeToggle('light')}
                      className={`px-4 py-2 rounded-lg text-[8px] uppercase tracking-widest font-bold transition-all ${theme === 'light' ? 'bg-accent text-ink' : 'text-paper/40 hover:text-paper'}`}
                    >
                      Light
                    </button>
                  </div>
                </div>
                {theme === 'light' && (
                  <p className="text-[8px] text-red-500/60 uppercase tracking-widest font-bold italic">"I can't believe your using light theme, what kind of strange person are you?" — Axrid</p>
                )}
              </div>

              <div className="flex flex-col items-center gap-4 pt-4">
                <span className={`text-[10px] uppercase tracking-widest font-bold ${saveStatus.includes("Error") ? "text-red-500" : "text-emerald-500"}`}>
                  {saveStatus}
                </span>
                <button 
                  disabled={isSaving || !alias.trim() || alias === profile?.alias}
                  className="text-[10px] uppercase tracking-[0.2em] font-bold border border-line px-8 py-3 hover:bg-accent hover:text-ink transition-all disabled:opacity-30 cursor-pointer rounded-xl"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </PageTransition>
  );
};


const FeaturesOld = () => {
  const techStack = [
    { name: "React", icon: <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">⚛️</div>, description: "Modern UI library" },
    { name: "TypeScript", icon: <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">TS</div>, description: "Type-safe code" },
    { name: "SQLite", icon: <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">🗄</div>, description: "Local database" },
    { name: "Tailwind", icon: <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">🌊</div>, description: "Utility-first CSS" },
    { name: "Motion", icon: <div className="w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">✨</div>, description: "Smooth animations" }
  ];

  const features = [
    {
      title: "Music Releases",
      description: "Professional-grade music player with SoundCloud integration and visibility controls.",
      icon: <MusicIcon className="w-6 h-6" />,
      tag: "Audio"
    },
    {
      title: "Direct Messaging",
      description: "Secure, real-time private chat system with message history and edit capabilities.",
      icon: <MessageSquare className="w-6 h-6" />,
      tag: "Social"
    },
    {
      title: "Admin Panel",
      description: "Comprehensive dashboard for managing users, content, and site-wide settings.",
      icon: <ShieldCheck className="w-6 h-6" />,
      tag: "Control"
    },
    {
      title: "User Profiles",
      description: "Customizable user identities with social integration and activity tracking.",
      icon: <UserIcon className="w-6 h-6" />,
      tag: "Identity"
    },
    {
      title: "Community Feed",
      description: "Interactive global feed for posts, updates, and community engagement.",
      icon: <Globe className="w-6 h-6" />,
      tag: "Network"
    },
    {
      title: "Moderation",
      description: "Advanced tools for maintaining community standards and content safety.",
      icon: <Lock className="w-6 h-6" />,
      tag: "Safety"
    },
    {
      title: "Global CDN",
      description: "Lightning-fast content delivery across the globe for all your media.",
      icon: <Zap className="w-6 h-6" />,
      tag: "Speed"
    },
    {
      title: "Cloud Hosting",
      description: "Secure and scalable storage for your community's growing assets.",
      icon: <Cloud className="w-6 h-6" />,
      tag: "Storage"
    },
    {
      title: "Secure",
      description: "Secure authentication with encrypted passwords and session management.",
      icon: <ShieldCheck className="w-6 h-6" />,
      tag: "Security"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageTransition>
      <section className="pt-32 md:pt-48 pb-24 px-6 max-w-5xl mx-auto min-h-screen">
        <div className="mb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <span className="text-[8px] uppercase tracking-[0.6em] font-bold opacity-30">Platform Overview</span>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase">
              Features
            </h2>
            <p className="text-paper/40 text-sm max-w-xl mx-auto uppercase tracking-widest leading-relaxed">
              A professional suite of tools built for creators and communities.
            </p>
          </motion.div>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className="group bg-card p-8 rounded-3xl border border-line/50 hover:border-paper/20 transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="p-3 bg-paper/5 rounded-2xl text-paper/60 group-hover:text-paper group-hover:bg-paper/10 transition-all duration-500">
                  {feature.icon}
                </div>
                <span className="text-[7px] uppercase tracking-widest font-bold opacity-20 group-hover:opacity-40 transition-opacity">
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-xl font-bold tracking-tight uppercase mb-3">{feature.title}</h3>
              <p className="text-[11px] text-paper/40 leading-relaxed group-hover:text-paper/60 transition-colors duration-500">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-32 pt-32 border-t border-line/30">
          <div className="flex flex-col items-center text-center gap-12">
            <div className="max-w-md">
              <h3 className="text-[10px] uppercase tracking-[0.4em] font-bold opacity-30 mb-4">The Stack</h3>
              <p className="text-[10px] text-paper/40 leading-relaxed uppercase tracking-widest">
                Built with industry-standard technologies for maximum performance and security.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {techStack.map((tech) => (
                <div key={tech.name} className="flex items-center gap-3 px-4 py-2 bg-card rounded-full border border-line/50">
                  {tech.icon}
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{tech.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false); })
      .catch(console.error);
  }, []);

  const owner = users.find(u => u.email === OWNER_EMAIL);
  const admins = users.filter(u => u.role === 'admin' && u.email !== OWNER_EMAIL);
  const regularUsers = users.filter(u => u.role !== 'admin' && u.email !== OWNER_EMAIL);

  if (loading) return <div className="text-[10px] uppercase tracking-widest opacity-30">Accessing user database...</div>;

  const UserCard = ({ user, label }: { user: any, label?: string }) => (
    <div className="admin-highlight-fade p-4 rounded-2xl border border-line/50 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full overflow-hidden border border-line bg-card">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold opacity-30">?</div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">{getDisplayName(null, user)}</span>
          <span className="text-[6px] px-1.5 py-0.5 bg-card rounded-full border border-line/50 opacity-40 font-mono">
            LVL {user.role === 'admin' ? '99' : '01'}
          </span>
          {label && (
            <span className="px-2 py-0.5 bg-card text-[8px] font-bold uppercase tracking-widest rounded border border-line/50">{label}</span>
          )}
        </div>
        <p className="text-[10px] opacity-30 uppercase tracking-widest">{user.email}</p>
        <div className="flex items-center gap-3 mt-1.5">
          {user.createdAt && (
            <p className="text-[7px] opacity-20 uppercase tracking-[0.2em]">
              Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { timeZone: 'GMT' }) : "Recently"}
            </p>
          )}
          <span className="w-1 h-1 rounded-full bg-line" />
          <p className="text-[7px] opacity-20 uppercase tracking-[0.2em]">
            ID: {user.id.substring(0, 8)}...
          </p>
        </div>
      </div>
      <div className="text-right flex flex-col items-end gap-1">
        <span className="px-2 py-0.5 bg-card text-[6px] font-bold uppercase tracking-widest rounded border border-line/50 opacity-40">
          {user.role === 'admin' ? 'Verified' : (user.photoURL ? 'Identified' : 'Unverified')}
        </span>
        <span className={`text-[10px] uppercase tracking-widest font-bold ${user.role === 'admin' ? 'text-emerald-500' : 'text-paper/40'}`}>
          {user.role}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-12">
      {owner && (
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30">Owner</h3>
          <UserCard user={owner} label="Owner" />
        </div>
      )}

      {admins.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30">Administrators</h3>
          <div className="grid grid-cols-1 gap-4">
            {admins.map(u => <UserCard key={u.id} user={u} />)}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30">General Users</h3>
        <div className="grid grid-cols-1 gap-4">
          {regularUsers.map(u => <UserCard key={u.id} user={u} />)}
          {regularUsers.length === 0 && (
            <div className="py-8 text-center bg-card rounded-2xl border border-line/50 border-dashed">
              <p className="text-[10px] uppercase tracking-widest opacity-20 font-bold">No regular users registered</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SITE_CHANGES = [
  {
    title: "Music Releases Tab",
    description: "Added a dedicated section for music tracks with SoundCloud integration and visibility controls.",
    date: "March 22, 2026",
    time: "12:00 AM",
    type: "major"
  },
  {
    title: "Direct Messaging",
    description: "Replaced the community forum with a direct messaging system for private user interaction.",
    date: "March 21, 2026",
    time: "08:30 PM",
    type: "major"
  },
  {
    title: "Admin Control Panel",
    description: "Developed a comprehensive dashboard for site settings, content management, and user oversight.",
    date: "March 20, 2026",
    time: "04:15 PM",
    type: "major"
  },
  {
    title: "Dedicated Login Page",
    description: "Created a professional /login route to improve authentication stability and user experience.",
    date: "March 19, 2026",
    time: "11:20 AM",
    type: "minor"
  },
  {
    title: "Apple-Style UI Prompts",
    description: "Integrated a custom glass-morphism modal system for all site interactions and notifications.",
    date: "March 18, 2026",
    time: "09:45 AM",
    type: "minor"
  },
  {
    title: "Mobile Optimization",
    description: "Implemented smart authentication methods to ensure compatibility across all mobile browsers.",
    date: "March 17, 2026",
    time: "02:10 PM",
    type: "minor"
  }
];

const ChangeLog = ({ isAdmin, user, changelog }: { isAdmin: boolean, user: any, changelog: any[] }) => {
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;


  return (
    <PageTransition>
      <section className="pt-32 md:pt-48 pb-24 px-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-16">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold tracking-tighter uppercase"
          >
            Site Change Log
          </motion.h1>
          <Link to="/admin" className="text-[10px] uppercase tracking-widest font-bold opacity-30 hover:opacity-100 transition-opacity">
            Back to Admin
          </Link>
        </div>

        <div className="space-y-24">
          <section>
            <div className="grid grid-cols-1 gap-6">
              {changelog.map((change, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card p-8 rounded-3xl border border-line/50"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold tracking-tight uppercase">{change.title}</h3>
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest font-bold opacity-20 block">{change.date}</span>
                      <span className="text-[7px] uppercase tracking-widest font-bold opacity-10 block mt-0.5">{change.time}</span>
                    </div>
                  </div>
                  <p className="text-paper/40 text-sm font-medium tracking-tight leading-relaxed">
                    {change.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </PageTransition>
  );
};

const AdminMessagesModeration = ({ isAdmin }: { isAdmin: boolean }) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [deleteConvId, setDeleteConvId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/conversations", { credentials: "include" })
      .then(r => r.json())
      .then(data => { setConversations(data); setLoading(false); })
      .catch(console.error);
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedConvId) { setMessages([]); return; }
    fetch(`/api/conversations/${selectedConvId}/messages`, { credentials: "include" })
      .then(r => r.json()).then(setMessages).catch(console.error);
  }, [selectedConvId]);

  const handleDeleteMessage = (msgId: string) => setDeleteMessageId(msgId);

  const confirmDeleteMessage = async () => {
    if (!selectedConvId || !deleteMessageId) return;
    await fetch(`/api/conversations/${selectedConvId}/messages/${deleteMessageId}`, {
      method: "DELETE", credentials: "include",
    });
    setDeleteMessageId(null);
    // Re-fetch messages
    fetch(`/api/conversations/${selectedConvId}/messages`, { credentials: "include" })
      .then(r => r.json()).then(setMessages).catch(console.error);
  };

  const handleDeleteConversation = (convId: string) => setDeleteConvId(convId);

  const confirmDeleteConversation = async () => {
    if (!deleteConvId) return;
    await fetch(`/api/conversations/${deleteConvId}`, { method: "DELETE", credentials: "include" });
    if (selectedConvId === deleteConvId) setSelectedConvId(null);
    setDeleteConvId(null);
    fetch("/api/admin/conversations", { credentials: "include" })
      .then(r => r.json()).then(setConversations).catch(console.error);
  };

  if (loading) return <div className="text-[10px] uppercase tracking-widest opacity-30">Scanning communications...</div>;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30">Active Conversations</h3>
        <div className="space-y-2">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              className={`bg-card p-4 rounded-2xl border ${selectedConvId === conv.id ? 'border-line bg-card/80' : 'border-line/50'} flex justify-between items-center group`}
            >
              <button 
                onClick={() => setSelectedConvId(conv.id)}
                className="flex-1 text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {Object.values(conv.participantData || {}).map((p: any) => p.displayName).join(" & ")}
                  </span>
                </div>
                <p className="text-[10px] opacity-30 truncate">{conv.lastMessage}</p>
              </button>
              <button 
                onClick={() => handleDeleteConversation(conv.id)}
                className="text-[8px] uppercase tracking-widest font-bold text-red-500/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30">Message History</h3>
        {selectedConvId ? (
          <div className="bg-card rounded-2xl border border-line/50 overflow-hidden flex flex-col h-[400px] lg:h-[500px]">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`group border-b border-line/50 pb-4 last:border-0 ${msg.isDeleted ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">
                      ID: {msg.senderId.slice(0, 8)}
                    </span>
                    {!msg.isDeleted && (
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="text-[8px] uppercase tracking-widest font-bold text-red-500/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className={`text-sm ${msg.isDeleted ? 'text-red-500/60 line-through' : 'text-paper/80'}`}>{msg.content}</p>
                  <div className="text-[8px] opacity-20 uppercase tracking-widest mt-1 space-y-0.5">
                    <p>Posted: {msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-GB', { timeZone: 'GMT' }) : "Just now"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[400px] lg:h-[500px] flex items-center justify-center border border-line/50 border-dashed rounded-2xl opacity-20">
            <p className="text-[10px] uppercase tracking-widest font-bold">Select a conversation to moderate</p>
          </div>
        )}
      </div>
      <Prompt
        isOpen={!!deleteMessageId}
        onClose={() => setDeleteMessageId(null)}
        title="Delete Message"
        message="Are you sure you want to delete this message?"
        primaryLabel="Delete"
        onPrimaryClick={confirmDeleteMessage}
      />
      <Prompt
        isOpen={!!deleteConvId}
        onClose={() => setDeleteConvId(null)}
        title="Delete Conversation"
        message="Delete entire conversation? This is irreversible."
        primaryLabel="Delete"
        onPrimaryClick={confirmDeleteConversation}
      />
    </div>
  );
};

const MassUpload = ({ handleUploadTrack, showNotification }: any) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [commonArtist, setCommonArtist] = useState("");
  const [commonLabel, setCommonLabel] = useState("");

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleMassUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      setProgress(prev => ({ ...prev, [file.name]: 0 }));

      try {
        // 1. Upload audio to local storage
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
        const audioUrl = uploadData.url;
        setProgress(prev => ({ ...prev, [file.name]: 100 }));

        // 2. Save track
        await handleUploadTrack({
          title: fileName,
          artist: commonArtist || "Unknown Artist",
          recordLabel: commonLabel || "",
          audioUrl,
          coverUrl: "",
          description: "Mass uploaded track.",
          publisher: "",
          trackLink: "",
          buyLink: "",
          enableDirectDownloads: true
        });
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }

    setUploading(false);
    setFiles([]);
    showNotification("Mass upload complete!", 'success');
  };

  return (
    <div className="space-y-6 admin-highlight-fade p-6 rounded-2xl border border-line/50">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">Common Artist</label>
            <input 
              type="text"
              value={commonArtist}
              onChange={(e) => setCommonArtist(e.target.value)}
              placeholder="e.g. Axrid"
              className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">Common Label</label>
            <input 
              type="text"
              value={commonLabel}
              onChange={(e) => setCommonLabel(e.target.value)}
              placeholder="e.g. Axrid Records"
              className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">Select Audio Files</label>
          <input 
            type="file"
            multiple
            accept="audio/*"
            onChange={onFileChange}
            className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[8px] uppercase tracking-widest font-bold opacity-30">Files to upload ({files.length})</h3>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] bg-paper/5 p-2 rounded-lg">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  {progress[file.name] !== undefined && (
                    <span className="font-mono text-[8px]">{Math.round(progress[file.name])}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleMassUpload}
          disabled={uploading || files.length === 0}
          className="w-full py-4 bg-paper text-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-paper/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : `Upload ${files.length} Tracks`}
        </button>
      </div>
    </div>
  );
};

// ── Server Stats Page ──────────────────────────────────────────────────────
const ServerStats = ({ user, isAdmin }: { user: LocalUser | null; isAdmin: boolean }) => {
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllDeploys, setShowAllDeploys] = useState(false);
  const navigate = useNavigate();

  const fetchStats = () => {
    fetch("/api/stats", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { setError("Failed to load stats."); setLoading(false); });
  };

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 30_000);
    return () => clearInterval(iv);
  }, []);

  const Bar = ({ pct, color = "bg-paper" }: { pct: number; color?: string }) => (
    <div className="w-full h-0.5 bg-line/30 rounded-full mt-1">
      <div className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );

  const Row = ({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) => (
    <div className="flex justify-between items-center py-2 border-b border-line/20 last:border-0">
      <span className="text-[10px] font-bold opacity-40 uppercase tracking-wider">{label}</span>
      <span className={`text-[11px] font-bold ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );

  const deploys = stats?.deploys ?? [];
  const visibleDeploys = showAllDeploys ? deploys : deploys.slice(0, 5);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <button onClick={() => navigate("/admin")} className="text-[9px] uppercase tracking-widest font-bold opacity-30 hover:opacity-60 transition-opacity mb-2 block">← Admin</button>
          <h1 className="text-3xl font-bold tracking-tighter">Server Stats</h1>
          <p className="text-[11px] opacity-40 mt-1">Live infrastructure overview · refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stats?.server?.online ? "bg-emerald-400" : "bg-red-500"}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
            {stats?.server?.online ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {loading && <div className="text-[11px] opacity-40 text-center py-20">Loading…</div>}
      {error && <div className="text-[11px] text-red-400 text-center py-20">{error}</div>}

      {stats && (
        <div className="space-y-6">
          {/* Top row: traffic counts */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Requests today", value: stats.traffic.requestsToday },
              { label: "Unique visitors", value: stats.traffic.uniqueVisitors },
              { label: "Track plays", value: stats.traffic.mp3Plays },
              { label: "Errors 4xx/5xx", value: stats.traffic.errors4xx5xx },
              { label: "Bandwidth", value: stats.traffic.bandwidth },
            ].map(({ label, value }) => (
              <div key={label} className="admin-highlight-fade p-4 rounded-2xl border border-line/50">
                <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 block mb-1">{label}</span>
                <span className="text-xl font-bold tracking-tighter">{value}</span>
              </div>
            ))}
          </div>

          {/* Middle: system + content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* System */}
            <div className="admin-highlight-fade p-5 rounded-2xl border border-line/50 space-y-3">
              <h3 className="text-[9px] uppercase tracking-widest font-bold opacity-30 mb-2">System</h3>
              <div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold opacity-40">CPU</span>
                  <span className="text-[11px] font-mono font-bold">{stats.system.cpu}%</span>
                </div>
                <Bar pct={stats.system.cpu} />
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold opacity-40">Memory</span>
                  <span className="text-[11px] font-mono font-bold">{stats.system.memory.used} / {stats.system.memory.total}</span>
                </div>
                <Bar pct={stats.system.memory.pct} />
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold opacity-40">Disk</span>
                  <span className="text-[11px] font-mono font-bold">{stats.system.disk.used} / {stats.system.disk.total}</span>
                </div>
                <Bar pct={stats.system.disk.pct} />
              </div>
              <Row label="Temperature" value={stats.system.temp ?? "N/A"} />
              <Row label="System uptime" value={stats.system.uptime} />
              {stats.server.pm2Uptime && <Row label="Process uptime" value={stats.server.pm2Uptime} />}
            </div>

            {/* Content counts */}
            <div className="admin-highlight-fade p-5 rounded-2xl border border-line/50">
              <h3 className="text-[9px] uppercase tracking-widest font-bold opacity-30 mb-4">Content</h3>
              <Row label="Tracks" value={stats.counts.tracks} />
              <Row label="Albums" value={stats.counts.albums} />
              <Row label="Posts" value={stats.counts.posts} />
              <Row label="Users" value={stats.counts.users} />
            </div>

            {/* Infra */}
            <div className="admin-highlight-fade p-5 rounded-2xl border border-line/50">
              <h3 className="text-[9px] uppercase tracking-widest font-bold opacity-30 mb-4">Infrastructure</h3>
              <Row label="Node env" value={import.meta.env.MODE} />
              <Row label="Stack" value="Express + SQLite" mono={false} />
              <Row label="Proxy" value="Cloudflare + nginx" mono={false} />
              <Row label="Host" value="Raspberry Pi 5" mono={false} />
            </div>
          </div>

          {/* Deployments */}
          <div className="admin-highlight-fade rounded-2xl border border-line/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-line/20 flex items-center justify-between">
              <h3 className="text-[9px] uppercase tracking-widest font-bold opacity-30">Recent Deployments</h3>
              <span className="text-[8px] font-mono opacity-20">{deploys.length} total</span>
            </div>
            {visibleDeploys.map((d: any, i: number) => (
              <div key={d.hash ?? i} className="px-5 py-3 border-b border-line/20 last:border-0 flex items-start gap-4">
                <span className="font-mono text-[9px] opacity-30 mt-0.5 shrink-0">{d.hash}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold tracking-tight truncate">{d.subject}</p>
                  <p className="text-[9px] opacity-30 mt-0.5">{d.author} · {d.date}</p>
                </div>
                <span className="text-[9px] opacity-30 shrink-0 whitespace-nowrap">{d.relTime}</span>
              </div>
            ))}
            {deploys.length > 5 && (
              <button
                onClick={() => setShowAllDeploys(v => !v)}
                className="w-full py-3 text-[9px] uppercase tracking-widest font-bold opacity-30 hover:opacity-60 transition-opacity"
              >
                {showAllDeploys ? "Show less ↑" : `View all ${deploys.length} deploys ↓`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Admin live page — force hard navigation so Express serves the HTML ──────
const AdminLive = () => {
  useEffect(() => { window.location.replace("/admin"); }, []);
  return null;
};

// ── Web Admin Dashboard (mirrors Pi dashboard) ────────────────────────────
const WebDashboard = ({ user, isAdmin }: { user: LocalUser | null; isAdmin: boolean }) => {
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;

  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'moderation' | 'server'>('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const sparkData = useRef<number[]>(Array(60).fill(0));
  const navigate = useNavigate();

  const fetchStats = () =>
    fetch("/api/stats", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d));

  useEffect(() => { fetchStats(); const iv = setInterval(fetchStats, 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    if (!stats) return;
    const rpm = stats.traffic?.requestsToday ?? 0;
    sparkData.current = [...sparkData.current.slice(1), rpm % 60];
    const canvas = sparkRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const data = sparkData.current;
    const mx = Math.max(...data) || 1;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * w / (data.length - 1);
      const y = h - (v / mx) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#00e676"; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = "rgba(0,230,118,0.1)"; ctx.fill();
  }, [stats]);

  useEffect(() => {
    if (tab !== 'moderation') return;
    fetch("/api/users", { credentials: "include" }).then(r => r.json()).then(setUsers).catch(() => {});
    fetch("/api/posts", { credentials: "include" }).then(r => r.json()).then(async posts => {
      const all: any[] = [];
      for (const p of (posts || []).slice(0, 5)) {
        const c = await fetch(`/api/posts/${p.id}/comments`, { credentials: "include" }).then(r => r.json()).catch(() => []);
        all.push(...(c || []));
      }
      setComments(all.slice(0, 10));
    });
  }, [tab]);

  const Bar = ({ pct }: { pct: number }) => (
    <div className="w-full h-0.5 bg-white/10 rounded-full mt-1">
      <div className={`h-full rounded-full ${pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-white/60"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );

  const Card = ({ title, accent, children }: { title?: string; accent?: string; children: React.ReactNode }) => (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      {title && <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
        {accent && <div className="w-0.5 h-4 rounded-full" style={{ background: accent }} />}
        <span className="text-[9px] uppercase tracking-widest font-bold opacity-30">{title}</span>
      </div>}
      <div className="p-4">{children}</div>
    </div>
  );

  const Stat = ({ label, value, color = "text-paper" }: { label: string; value: any; color?: string }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-white/10 last:border-0">
      <span className="text-[9px] uppercase tracking-wider font-bold opacity-30">{label}</span>
      <span className={`text-[11px] font-bold font-mono ${color}`}>{value ?? "—"}</span>
    </div>
  );

  const BigNum = ({ label, value, color }: { label: string; value: any; color: string }) => (
    <div>
      <div className="text-[8px] uppercase tracking-widest font-bold opacity-30 mb-1">{label}</div>
      <div className={`text-2xl font-bold tracking-tighter ${color}`}>{value ?? "—"}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col pt-16">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white/5 border-b border-white/10">
        <div className="w-1 h-6 rounded-full bg-blue-500" />
        <span className="text-lg font-bold tracking-tighter">AXRID</span>
        <span className="text-[10px] font-bold opacity-20 uppercase tracking-widest">Server Dashboard</span>
        <div className="flex items-center gap-2 ml-4">
          <span className={`text-xs ${stats?.server?.online ? "text-emerald-400" : "text-red-500"}`}>●</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${stats?.server?.online ? "text-emerald-400" : "text-red-500"}`}>
            {stats?.server?.online ? "Online" : "Offline"}
          </span>
          {stats?.server?.pm2Uptime && <span className="text-[9px] opacity-30">uptime: {stats.server.pm2Uptime}</span>}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-[10px] font-mono opacity-40">{new Date().toLocaleTimeString()}</span>
          <button onClick={() => navigate("/")} className="text-[9px] uppercase tracking-widest font-bold opacity-30 hover:opacity-70 transition-opacity">⌂ Home</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10 bg-white/5 px-5">
        {(['overview', 'moderation', 'server'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 px-4 text-[9px] uppercase tracking-widest font-bold transition-all ${tab === t ? "text-paper border-b border-paper" : "opacity-20 hover:opacity-50"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 p-5 overflow-auto">
        {!stats && <div className="text-[11px] opacity-30 text-center py-20">Loading…</div>}

        {/* ── Overview tab */}
        {stats && tab === 'overview' && (
          <div className="space-y-4">
            {/* Traffic numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><BigNum label="Req / Min" value={stats.traffic?.requestsToday} color="text-emerald-400" /></Card>
              <Card><BigNum label="Visitors Today" value={stats.traffic?.uniqueVisitors} color="text-blue-400" /></Card>
              <Card><BigNum label="Requests Today" value={stats.traffic?.requestsToday} color="text-paper" /></Card>
              <Card><BigNum label="Bandwidth" value={stats.traffic?.bandwidth} color="text-orange-400" /></Card>
            </div>

            {/* Sparkline */}
            <Card title="Requests Per Minute" accent="#00e676">
              <canvas ref={sparkRef} width={800} height={60} className="w-full" />
            </Card>

            {/* 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* System */}
              <Card title="System" accent="#d500f9">
                <div className="mb-3">
                  <div className="flex justify-between text-[10px]"><span className="opacity-30 font-bold uppercase tracking-wider">CPU</span><span className="font-mono font-bold">{stats.system.cpu}%</span></div>
                  <Bar pct={stats.system.cpu} />
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-[10px]"><span className="opacity-30 font-bold uppercase tracking-wider">Memory</span><span className="font-mono font-bold">{stats.system.memory.used}/{stats.system.memory.total}</span></div>
                  <Bar pct={stats.system.memory.pct} />
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-[10px]"><span className="opacity-30 font-bold uppercase tracking-wider">Disk</span><span className="font-mono font-bold">{stats.system.disk.used}/{stats.system.disk.total}</span></div>
                  <Bar pct={stats.system.disk.pct} />
                </div>
                <Stat label="Temperature" value={stats.system.temp} />
                <Stat label="Uptime" value={stats.system.uptime} />
              </Card>

              {/* Site content */}
              <Card title="Site Content" accent="#2979ff">
                <Stat label="Tracks" value={stats.counts.tracks} />
                <Stat label="Albums" value={stats.counts.albums} />
                <Stat label="Posts" value={stats.counts.posts} />
                <Stat label="Users" value={stats.counts.users} />
                <div className="mt-3 pt-3 border-t border-white/10">
                  <Stat label="Track Plays" value={stats.traffic.mp3Plays} color="text-blue-400" />
                  <Stat label="Errors 4xx/5xx" value={stats.traffic.errors4xx5xx} color="text-red-400" />
                </div>
              </Card>

              {/* Recent deploys */}
              <Card title="Recent Deploys" accent="#333333">
                {(stats.deploys || []).slice(0, 5).map((d: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/10 last:border-0">
                    <span className="font-mono text-[8px] opacity-30 shrink-0 mt-0.5">{d.hash}</span>
                    <span className="text-[10px] flex-1 truncate">{d.subject}</span>
                    <span className="text-[8px] opacity-20 shrink-0">{d.relTime}</span>
                  </div>
                ))}
              </Card>
            </div>

            {/* Activity log */}
            <Card title="Live Activity Log" accent="#333333">
              {(stats.recentRequests || []).map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-1 border-b border-white/5 last:border-0">
                  <span className={`text-[9px] font-bold ${r.status?.startsWith("2") ? "text-emerald-400" : r.status?.startsWith("3") ? "text-yellow-400" : "text-red-400"}`}>●</span>
                  <span className="font-mono text-[9px] opacity-30 shrink-0">{r.ts}</span>
                  <span className="font-mono text-[9px] opacity-60 truncate">{r.req}</span>
                  <span className={`font-mono text-[9px] ml-auto shrink-0 ${r.status?.startsWith("2") ? "text-emerald-400" : r.status?.startsWith("3") ? "text-yellow-400" : "text-red-400"}`}>{r.status}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── Moderation tab */}
        {tab === 'moderation' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Users">
              {users.slice(0, 15).map((u: any) => (
                <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-white/10 last:border-0">
                  <div>
                    <div className="text-[11px] font-bold">{u.displayName}</div>
                    <div className="text-[9px] opacity-30">{u.email}</div>
                  </div>
                  <span className={`text-[8px] uppercase tracking-widest font-bold ${u.role === "admin" ? "text-yellow-400" : "opacity-30"}`}>{u.role}</span>
                </div>
              ))}
            </Card>
            <Card title="Recent Comments">
              {comments.length === 0 && <div className="text-[10px] opacity-30">No comments.</div>}
              {comments.map((c: any, i: number) => (
                <div key={i} className="py-1.5 border-b border-white/10 last:border-0">
                  <div className="text-[9px] font-bold opacity-50">{c.authorName}</div>
                  <div className="text-[10px] opacity-70 truncate">{c.content}</div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── Server tab */}
        {tab === 'server' && (
          <div className="max-w-md space-y-3">
            <Card title="Server Controls">
              {[
                { label: "⟳  Restart Website Server", color: "text-yellow-400", action: () => fetch("/api/stats", { credentials: "include" }) },
              ].map(({ label, color }) => (
                <button key={label} className={`w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition font-bold text-[11px] ${color} mb-2`}>{label}</button>
              ))}
              <Link to="/admin/stats" className="block px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition font-bold text-[11px] opacity-50">
                ⇗ Open Full Stats Page
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({ user, isAdmin, posts, handleToggleVisibility, handleDeletePost, handleUpdatePost, settings, handleUpdateSettings, users, messages, changelog, comments, tracks, handleUploadTrack, handleUpdateTrack, handleDeleteTrack, handleDeleteAllTracks, handleToggleTrackVisibility, setLightboxImage, handleSyncTrack, bulkSyncAllTracks, autoFindMissingLinks, isAutoFinding, importFromSoundCloudProfile, isImporting, standardizeRecordLabels, migrateToFirebase, setUploadStatus, showNotification, confirmAction }: any) => {
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;

  const [aboutText, setAboutText] = useState(settings?.aboutText || DEFAULT_SETTINGS.aboutText);
  const [instagramUrl, setInstagramUrl] = useState(settings?.instagramUrl || DEFAULT_SETTINGS.instagramUrl);
  const [youtubeUrl, setYoutubeUrl] = useState(settings?.youtubeUrl || DEFAULT_SETTINGS.youtubeUrl);
  const [soundcloudUrl, setSoundcloudUrl] = useState(settings?.soundcloudUrl || "https://soundcloud.com/axridaxe");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingTrack, setEditingTrack] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [viewingCommentsPostId, setViewingCommentsPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'content' | 'users' | 'messages' | 'moderation' | 'deleted-tracks' | 'mass-upload' | 'tracks'>('stats');
  const [clickCount, setClickCount] = useState(0);
  const [showSecretTab, setShowSecretTab] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);

  const handleTitleClick = () => {
    setClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setShowSecretTab(true);
      }
      return newCount;
    });
  };

  useEffect(() => {
    if (settings) {
      setAboutText(settings.aboutText);
      setInstagramUrl(settings.instagramUrl);
      setYoutubeUrl(settings.youtubeUrl);
      setSoundcloudUrl(settings.soundcloudUrl);
    }
  }, [settings]);

  const onSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await handleUpdateSettings({
        aboutText,
        instagramUrl,
        youtubeUrl,
        soundcloudUrl
      });
    } finally {
      setIsSaving(false);
    }
  };

  const syncSoundCloud = async () => {
    if (!soundcloudUrl) return;
    setIsSyncing(true);
    try {
      // Simulation of SoundCloud sync
      console.log("Syncing from SoundCloud:", soundcloudUrl);
      await new Promise(resolve => setTimeout(resolve, 2000));
      showNotification("SoundCloud sync complete! (Simulation)", 'success');
    } catch (error) {
      console.error("SoundCloud sync failed:", error);
      showNotification("SoundCloud sync failed.", 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const startEditing = (post: any) => {
    setEditingPostId(post.id);
    setEditTitle(post.title || "");
    setEditSubtitle(post.subtitle || "");
    setEditContent(post.content || "");
  };

  const onSavePostEdit = async () => {
    if (!editingPostId) return;
    try {
      await handleUpdatePost(editingPostId, {
        title: editTitle,
        subtitle: editSubtitle,
        content: editContent
      });
      setEditingPostId(null);
    } catch (error) {
      console.error("Error updating post:", error);
    }
  };

  const majorChanges = SITE_CHANGES.filter(c => c.type === 'major');
  const minorChanges = SITE_CHANGES.filter(c => c.type === 'minor');

  return (
    <PageTransition>
      <section className="pt-32 md:pt-48 pb-24 px-6 max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleTitleClick}
              className="text-xl font-bold tracking-tighter uppercase mb-1 cursor-pointer select-none"
            >
              Admin Panel
            </motion.h1>
            <p className="text-[8px] uppercase tracking-widest font-bold opacity-20">Secure Management Interface</p>
          </div>
          <div className="flex gap-2">
            <Link 
              to="/admin/changelog"
              className="px-4 py-2 bg-card border border-line rounded-lg text-[8px] uppercase tracking-widest font-bold hover:bg-card/80 transition-all flex items-center gap-2 w-fit"
            >
              Full Change Log
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-6 border-b border-line mb-10">
          <button 
            onClick={() => setActiveTab('stats')}
            className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Site Statistics
          </button>
          <button 
            onClick={() => setActiveTab('content')}
            className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'content' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Content
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Users
          </button>
          <button 
            onClick={() => setActiveTab('deleted-tracks')}
            className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'deleted-tracks' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Deleted Tracks
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'messages' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Messages
          </button>
          <button 
            onClick={() => setActiveTab('moderation')}
            className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'moderation' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Moderation
          </button>
          <button 
            onClick={() => setActiveTab('tracks')}
            className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'tracks' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
          >
            Tracks
          </button>
          {showSecretTab && (
            <button 
              onClick={() => setActiveTab('mass-upload')}
              className={`pb-3 text-[8px] uppercase tracking-[0.3em] font-bold transition-all whitespace-nowrap ${activeTab === 'mass-upload' ? 'text-paper border-b border-paper' : 'text-paper/20 hover:text-paper/40'}`}
            >
              Mass Upload
            </button>
          )}
        </div>

        <div className="space-y-10">
          {editingTrack && (
            <EditTrackModal 
              track={editingTrack} 
              isOpen={!!editingTrack}
              onClose={() => setEditingTrack(null)} 
              onUpdate={handleUpdateTrack} 
            />
          )}

          {activeTab === 'stats' && (
            <div className="space-y-10">
              <Link to="/admin/stats" className="inline-flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold opacity-40 hover:opacity-80 transition-opacity border border-line/50 rounded-xl px-4 py-2">
                <BarChart3 size={12} /> Open Live Server Dashboard →
              </Link>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="admin-highlight-fade p-5 rounded-2xl border border-line/50">
                  <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 block mb-1">Total Users</span>
                  <span className="text-xl font-bold tracking-tighter">{users.length}</span>
                </div>
                <div className="admin-highlight-fade p-5 rounded-2xl border border-line/50">
                  <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 block mb-1">Total Messages</span>
                  <span className="text-xl font-bold tracking-tighter">{messages.length}</span>
                </div>
                <div className="admin-highlight-fade p-5 rounded-2xl border border-line/50">
                  <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 block mb-1">Total Comments</span>
                  <span className="text-xl font-bold tracking-tighter">{comments.length}</span>
                </div>
                <div className="admin-highlight-fade p-5 rounded-2xl border border-line/50">
                  <span className="text-[8px] uppercase tracking-widest font-bold opacity-30 block mb-1">Total Tracks</span>
                  <span className="text-xl font-bold tracking-tighter">{tracks.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="admin-highlight-fade p-6 rounded-2xl border border-line/50">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30 mb-4">API & Infrastructure Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold">API Requests (24h)</span>
                      <span className="text-[10px] font-mono opacity-60">1,248</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold">Database Operations</span>
                      <span className="text-[10px] font-mono opacity-60">8,932</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold">Storage Usage</span>
                      <span className="text-[10px] font-mono opacity-60">4.2 GB / 10 GB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold">API Status</span>
                      <span className="text-[10px] font-mono text-emerald-500">Operational</span>
                    </div>
                  </div>
                </div>
                <div className="admin-highlight-fade p-6 rounded-2xl border border-line/50">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30 mb-4">Site Performance</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold">Avg. Response Time</span>
                      <span className="text-[10px] font-mono opacity-60">124ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold">Active Sessions</span>
                      <span className="text-[10px] font-mono opacity-60">34</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold">Error Rate (24h)</span>
                      <span className="text-[10px] font-mono opacity-60">0.02%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-30 mb-4">Recent Changes</h3>
                <div className="admin-highlight-fade rounded-2xl border border-line/50 overflow-hidden">
                  {changelog.slice(0, 5).map((change, index) => (
                    <div key={index} className="p-4 border-b border-line/50 last:border-0 flex items-start gap-4">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${change.type === 'major' ? 'bg-accent' : 'bg-paper/40'}`} />
                      <div className="flex-grow">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-[11px] font-bold tracking-tight">{change.title}</h4>
                          <span className="text-[8px] font-mono opacity-40">{change.date}</span>
                        </div>
                        <p className="text-[10px] opacity-60 leading-relaxed">{change.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-10">
              <section>
                <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">Global Settings</h2>
                <form onSubmit={onSaveSettings} className="space-y-4 admin-highlight-fade p-6 rounded-2xl border border-line/50">
                  <div className="space-y-1">
                    <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">About Description</label>
                    <textarea 
                      value={aboutText}
                      onChange={(e) => setAboutText(e.target.value)}
                      className="w-full bg-input border border-line rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors h-24 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">Instagram</label>
                      <input 
                        type="text"
                        value={instagramUrl}
                        onChange={(e) => setInstagramUrl(e.target.value)}
                        className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">YouTube</label>
                      <input 
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">SoundCloud</label>
                      <input 
                        type="text"
                        value={soundcloudUrl}
                        onChange={(e) => setSoundcloudUrl(e.target.value)}
                        className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button 
                      disabled={isSaving}
                      className="px-5 py-2.5 bg-paper text-ink font-bold uppercase text-[8px] tracking-widest rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Update Settings"}
                    </button>
                  </div>
                </form>
              </section>

              <section>
                <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">Manage Updates</h2>
                <div className="space-y-3">
                  {posts.map((post: any) => (
                    <div key={post.id} className="admin-highlight-fade p-5 rounded-2xl border border-line/50">
                      {editingPostId === post.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">Title</label>
                              <input 
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">Subtitle</label>
                              <input 
                                type="text"
                                value={editSubtitle}
                                onChange={(e) => setEditSubtitle(e.target.value)}
                                className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-widest font-bold opacity-30">Content</label>
                            <textarea 
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-input border border-line/50 rounded-xl p-3 text-[11px] focus:outline-none focus:border-paper/20 transition-colors h-32 resize-none"
                            />
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <button 
                              onClick={() => setEditingPostId(null)}
                              className="px-4 py-2 border border-line/50 text-paper/40 font-bold uppercase text-[8px] tracking-widest rounded-lg hover:bg-card transition-colors"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={onSavePostEdit}
                              className="px-4 py-2 bg-paper text-ink font-bold uppercase text-[8px] tracking-widest rounded-lg hover:opacity-80 transition-opacity"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-tight">{post.title || "Untitled"}</h3>
                              <p className="text-[7px] opacity-20 uppercase tracking-widest mt-0.5">
                                {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-GB', { timeZone: 'GMT' }) : "No date"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleToggleVisibility(post.id, post.isVisible)}
                                className={`text-[7px] uppercase tracking-widest font-bold px-2.5 py-1.5 rounded transition-all ${post.isVisible ? 'bg-emerald-500/10 text-emerald-500' : 'bg-card text-paper/30'}`}
                              >
                                {post.isVisible ? "Live" : "Draft"}
                              </button>
                              <button 
                                onClick={() => startEditing(post)}
                                className="text-[7px] uppercase tracking-widest font-bold px-2.5 py-1.5 bg-card text-paper/50 rounded hover:bg-card/80 transition-all"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => {
                                  confirmAction("Delete this update?", () => handleDeletePost(post.id));
                                }}
                                className="text-[7px] uppercase tracking-widest font-bold px-2.5 py-1.5 bg-red-500/5 text-red-500/50 rounded hover:bg-red-500/10 transition-all"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-line/50">
                            <button 
                              onClick={() => setViewingCommentsPostId(viewingCommentsPostId === post.id ? null : post.id)}
                              className="text-[7px] uppercase tracking-widest font-bold opacity-20 hover:opacity-100 transition-opacity flex items-center gap-2"
                            >
                              {viewingCommentsPostId === post.id ? "Hide Comments" : `Manage Comments`}
                            </button>
                            
                            {viewingCommentsPostId === post.id && (
                              <div className="mt-4">
                                <Comments path={`posts/${post.id}/comments`} user={user} isAdmin={true} />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'tracks' && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20">Manage Tracks</h2>
                {user?.email === OWNER_EMAIL && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => importFromSoundCloudProfile()}
                      disabled={isImporting}
                      className="px-4 py-2 bg-accent text-ink rounded-xl text-[8px] uppercase tracking-widest font-bold hover:bg-white transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Cloud size={12} />
                      {isImporting ? 'Importing...' : 'Import from SoundCloud'}
                    </button>
                    <button
                      onClick={autoFindMissingLinks}
                      disabled={isAutoFinding}
                      className="px-4 py-2 bg-card border border-line rounded-xl text-[8px] uppercase tracking-widest font-bold hover:bg-card/80 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Search size={12} />
                      {isAutoFinding ? 'Finding Links...' : 'Auto-Find Links'}
                    </button>
                    <button
                      onClick={handleDeleteAllTracks}
                      className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[8px] uppercase tracking-widest font-bold hover:bg-red-500/20 transition-all flex items-center gap-2"
                    >
                      <Trash2 size={12} />
                      Delete All Tracks
                    </button>
                    <button
                      onClick={() => {
                        confirmAction("This will delete all current tracks and import the new list. Continue?", async () => {
                          // We need to manually delete all tracks first because handleDeleteAllTracks has its own confirmation
                          setUploadStatus("Deleting all tracks...");
                          try {
                            const allTracks: any[] = await fetch("/api/tracks", { credentials: "include" }).then(r => r.json());
                            for (const t of allTracks) {
                              await fetch(`/api/tracks/${t.id}`, { method: "DELETE", credentials: "include" });
                            }
                            
                            const axridLinks = [
                              "https://soundcloud.com/axridaxe/vibe",
                              "https://soundcloud.com/axridaxe/hitit",
                              "https://soundcloud.com/axridaxe/2x-2",
                              "https://soundcloud.com/axridaxe/fourtea4",
                              "https://soundcloud.com/axridaxe/project2027-1",
                              "https://soundcloud.com/axridaxe/project2027-4",
                              "https://soundcloud.com/axridaxe/project2027-6",
                              "https://soundcloud.com/axridaxe/project2027-7",
                              "https://soundcloud.com/axridaxe/project2027-11",
                              "https://soundcloud.com/axridaxe/2027_extended_1-bonus",
                              "https://soundcloud.com/axridaxe/2027_extended_2-bonus",
                              "https://soundcloud.com/axridaxe/go-up-three-2027_extended_edition",
                              "https://soundcloud.com/axridaxe/2029_4a",
                              "https://soundcloud.com/axridaxe/amplifying-5",
                              "https://soundcloud.com/axridaxe/new-new-intro-1",
                              "https://soundcloud.com/axridaxe/kinda-2",
                              "https://soundcloud.com/axridaxe/thank-you-6",
                              "https://soundcloud.com/axridaxe/new-new-outro-7",
                              "https://soundcloud.com/axridaxe/waves-check-it-3",
                              "https://soundcloud.com/axridaxe/method-4",
                              "https://soundcloud.com/axridaxe/echo-one",
                              "https://soundcloud.com/axridaxe/echofive",
                              "https://soundcloud.com/axridaxe/echo3",
                              "https://soundcloud.com/axridaxe/echo4",
                              "https://soundcloud.com/axridaxe/echotwo",
                              "https://soundcloud.com/axridaxe/echo6",
                              "https://soundcloud.com/axridaxe/zero6",
                              "https://soundcloud.com/axridaxe/zero4",
                              "https://soundcloud.com/axridaxe/zero7",
                              "https://soundcloud.com/axridaxe/zero3",
                              "https://soundcloud.com/axridaxe/zero2",
                              "https://soundcloud.com/axridaxe/zero1",
                              "https://soundcloud.com/axridaxe/zero5-1",
                              "https://soundcloud.com/axridaxe/zero8",
                              "https://soundcloud.com/axridaxe/22-2-2026a",
                              "https://soundcloud.com/axridaxe/2-3-26a",
                              "https://soundcloud.com/axridaxe/3-3-26a",
                              "https://soundcloud.com/axridaxe/3-5-26-axrid-156a",
                              "https://soundcloud.com/axridaxe/finale-the-end",
                              "https://soundcloud.com/axridaxe/9-2-26a",
                              "https://soundcloud.com/axridaxe/3-10-26a",
                              "https://soundcloud.com/axridaxe/music-1-intro",
                              "https://soundcloud.com/axridaxe/bass2-final",
                              "https://soundcloud.com/axridaxe/hardcoretechno",
                              "https://soundcloud.com/axridaxe/bass3",
                              "https://soundcloud.com/axridaxe/11-12-17-3-26-axrid-140",
                              "https://soundcloud.com/axridaxe/backatit",
                              "https://soundcloud.com/axridaxe/electro",
                              "https://soundcloud.com/axridaxe/20-3",
                              "https://soundcloud.com/axridaxe/21-3",
                              "https://soundcloud.com/axridaxe/jazz"
                            ];
                            
                            setUploadStatus(`Starting bulk import of ${axridLinks.length} tracks...`);
                            let importedCount = 0;
                            let failedCount = 0;
                            
                            for (const url of axridLinks) {
                              try {
                                setUploadStatus(`Importing (${importedCount + 1}/${axridLinks.length}): ${url}...`);
                                const metaResponse = await fetch(`/api/soundcloud/metadata?url=${encodeURIComponent(url)}`);
                                if (!metaResponse.ok) {
                                  failedCount++;
                                  continue;
                                }
                                const meta = await metaResponse.json();
                                await handleUploadTrack({
                                  title: meta.title || "Untitled Track",
                                  artist: meta.artist || "Axrid",
                                  genre: meta.genre || "Electronic",
                                  description: meta.description || "",
                                  privacy: "public",
                                  soundcloudUrl: url,
                                  coverUrl: meta.artworkUrl || "",
                                  releaseDate: meta.releaseDate || new Date().toISOString().split('T')[0]
                                });
                                importedCount++;
                              } catch (err) {
                                console.error(`Failed to import ${url}:`, err);
                                failedCount++;
                              }
                            }
                            setUploadStatus(`Bulk import complete! Imported: ${importedCount}, Failed: ${failedCount}`);
                            showNotification(`Import complete! ${importedCount} tracks imported.`, 'success');
                            setTimeout(() => setUploadStatus(""), 5000);
                          } catch (error: any) {
                            console.error("Bulk import failed:", error);
                            showNotification(`Error: ${error.message}`, 'error');
                          }
                        });
                      }}
                      className="px-4 py-2 bg-paper text-ink rounded-xl text-[8px] uppercase tracking-widest font-bold hover:opacity-90 transition-all flex items-center gap-2"
                    >
                      <Cloud size={12} />
                      Wipe & Import Axrid's List
                    </button>
                    <button
                      onClick={() => setIsBulkAddOpen(true)}
                      className="px-4 py-2 bg-card border border-line rounded-xl text-[8px] uppercase tracking-widest font-bold hover:bg-card/80 transition-all flex items-center gap-2"
                    >
                      <Plus size={12} />
                      Bulk Import URLs
                    </button>
                    <button
                      onClick={bulkSyncAllTracks}
                      className="px-4 py-2 bg-card border border-line rounded-xl text-[8px] uppercase tracking-widest font-bold hover:bg-card/80 transition-all flex items-center gap-2"
                    >
                      <Zap size={12} />
                      Bulk Sync All
                    </button>
                    <button
                      onClick={standardizeRecordLabels}
                      className="px-4 py-2 bg-card border border-line rounded-xl text-[8px] uppercase tracking-widest font-bold hover:bg-card/80 transition-all flex items-center gap-2"
                    >
                      <Zap size={12} className="text-accent" />
                      Standardize Labels
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-card border border-line rounded-2xl overflow-hidden">
                {tracks
                  .sort((a: any, b: any) => {
                    const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.createdAt?.toDate?.()?.getTime() || 0);
                    const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.createdAt?.toDate?.()?.getTime() || 0);
                    return dateB - dateA;
                  })
                  .map((track: any) => (
                    <TrackItem 
                      key={track.id} 
                      track={track} 
                      isAdmin={isAdmin} 
                      user={user}
                      handleDeleteTrack={handleDeleteTrack} 
                      handleToggleTrackVisibility={handleToggleTrackVisibility} 
                      onImageClick={(url, title) => setLightboxImage({ url, title })}
                      onEdit={setEditingTrack}
                      onSync={handleSyncTrack}
                      showNotification={showNotification}
                      confirmAction={confirmAction}
                    />
                  ))}
              </div>
            </section>
          )}

          {activeTab === 'users' && (
            <section>
              <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">User Permissions</h2>
              <UserManagement />
            </section>
          )}

          {activeTab === 'deleted-tracks' && (
            <section className="space-y-6">
              <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">Deleted Tracks History</h2>
              <div className="bg-card border border-line rounded-2xl p-8">
                <div className="space-y-4">
                  {tracks.filter((t: any) => t.deletedAt).length === 0 ? (
                    <p className="text-[10px] opacity-40 italic">No deleted tracks found.</p>
                  ) : (
                    tracks.filter((t: any) => t.deletedAt).map((track: any) => (
                      <div key={track.id} className="flex items-center justify-between p-4 bg-ink/5 rounded-xl border border-line/20">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-paper/10 rounded-lg overflow-hidden flex-shrink-0">
                            {track.coverUrl ? (
                              <img src={track.coverUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] font-bold opacity-20">NO ART</div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold tracking-tight">{track.title}</h4>
                            <p className="text-[8px] opacity-40 uppercase tracking-widest">{track.artist}</p>
                            <p className="text-[7px] opacity-20 uppercase tracking-widest mt-1">
                              Deleted: {track.deletedAt ? new Date(track.deletedAt).toLocaleString() : 'Recently'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={track.audioUrl || (track.soundcloudUrl ? `/api/soundcloud/stream?url=${encodeURIComponent(track.soundcloudUrl)}` : '#')} 
                            download={`${track.title}.mp3`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-paper/5 hover:bg-paper/10 rounded-lg transition-colors group"
                            title="Download"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40 group-hover:opacity-100 transition-opacity"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'messages' && (
            <section>
              <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">Message Moderation</h2>
              <AdminMessagesModeration isAdmin={isAdmin} />
            </section>
          )}

          {activeTab === 'moderation' && (
            <section>
              <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">Global Moderation</h2>
              <p className="text-[10px] opacity-30">Moderation section is currently unavailable.</p>
            </section>
          )}

          {activeTab === 'mass-upload' && (
            <section>
              <h2 className="text-[8px] uppercase tracking-[0.3em] font-bold opacity-20 mb-4">Mass Upload Tracks</h2>
              <MassUpload handleUploadTrack={handleUploadTrack} showNotification={showNotification} />
            </section>
          )}
        </div>

        <BulkAddModal 
          isOpen={isBulkAddOpen} 
          onClose={() => setIsBulkAddOpen(false)} 
          showNotification={showNotification}
          onImport={async (urls) => {
            setUploadStatus(`Starting bulk import of ${urls.length} tracks...`);
            let importedCount = 0;
            let failedCount = 0;
            
            for (const url of urls) {
              try {
                setUploadStatus(`Importing (${importedCount + 1}/${urls.length}): ${url}...`);
                const metaResponse = await fetch(`/api/soundcloud/metadata?url=${encodeURIComponent(url)}`);
                if (!metaResponse.ok) {
                  failedCount++;
                  continue;
                }
                const meta = await metaResponse.json();
                await handleUploadTrack({
                  title: meta.title || "Untitled Track",
                  artist: meta.artist || "Axrid",
                  genre: meta.genre || "Electronic",
                  description: meta.description || "",
                  privacy: "public",
                  soundcloudUrl: url,
                  coverUrl: meta.artworkUrl || "",
                  releaseDate: meta.releaseDate || new Date().toISOString().split('T')[0]
                });
                importedCount++;
              } catch (err) {
                console.error(`Failed to import ${url}:`, err);
                failedCount++;
              }
            }
            setUploadStatus(`Bulk import complete! Imported: ${importedCount}, Failed: ${failedCount}`);
            setTimeout(() => setUploadStatus(""), 5000);
          }}
        />
      </section>
    </PageTransition>
  );
};

const ThemeToggle = ({ currentTheme, onToggle }: any) => {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]">
      <button 
        onClick={onToggle}
        className="w-12 h-12 rounded-full bg-card border border-line flex items-center justify-center shadow-lg hover:scale-110 transition-all group backdrop-blur-sm"
        aria-label="Toggle Theme"
      >
        {currentTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-yellow-500 group-hover:rotate-45 transition-transform" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-400 group-hover:-rotate-12 transition-transform" />
        )}
      </button>
    </div>
  );
};

function AppContent({ user, setUser, profile, setProfile, isAdmin, posts, tracks, comments, users, messages, changelog, handleCreatePost, handleDeletePost, handleToggleVisibility, handleUpdatePost, handleUploadTrack, handleUpdateTrack, handleDeleteTrack, handleToggleTrackVisibility, handleSyncTrack, newPostContent, setNewPostContent, newPostTitle, setNewPostTitle, newPostSubtitle, setNewPostSubtitle, isPosting, isMenuOpen, setIsMenuOpen, isContactModalOpen, setIsContactModalOpen, isRedirectModalOpen, setIsRedirectModalOpen, isLogoutModalOpen, setIsLogoutModalOpen, isDonateModalOpen, setIsDonateModalOpen, lightboxImage, setLightboxImage, settings, handleUpdateSettings, theme, handleThemeToggle, showNotification, confirmAction, notification, confirmation, setConfirmation, albums, handleCreateAlbum, handleUpdateAlbum, handleDeleteAlbum, isAlbumModalOpen, setIsAlbumModalOpen, editingAlbum, setEditingAlbum }: any) {
  const location = useLocation();
  const navigate = useNavigate();
  const [uploadStatus, setUploadStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoFinding, setIsAutoFinding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const importFromSoundCloudProfile = async (profileUrl: string = "https://soundcloud.com/axridaxe/tracks") => {
    if (!user || user.email !== OWNER_EMAIL) return;
    
    setIsImporting(true);
    setUploadStatus("Fetching tracks from SoundCloud profile...");

    try {
      const response = await fetch(`/api/soundcloud/profile?profileUrl=${encodeURIComponent(profileUrl)}`);
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response received:", text);
        throw new Error("Server returned an invalid response. Please try again later.");
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch profile");

      const profileTracks = data.tracks;
      if (!profileTracks || profileTracks.length === 0) {
        console.warn("No tracks found in profile response:", data);
        showNotification("No tracks found on this profile. Make sure the profile is public and has tracks.", 'info');
        return;
      }

      setUploadStatus(`Found ${profileTracks.length} tracks. Checking for new ones...`);
      console.log(`[SoundCloud Import] Found ${profileTracks.length} tracks on profile.`);
      
      const existingUrls = new Set(tracks.map((t: any) => t.soundcloudUrl).filter(Boolean));
      const newTrackUrls = profileTracks.filter((url: string) => !existingUrls.has(url));

      if (newTrackUrls.length === 0) {
        console.log("[SoundCloud Import] All tracks are already in the database.");
        setUploadStatus("All tracks from this profile are already in the database.");
        showNotification("All tracks from this profile are already in the database.", 'info');
        setTimeout(() => setUploadStatus(""), 3000);
        return;
      }

      confirmAction(`Found ${newTrackUrls.length} new tracks. Import them?`, async () => {
        let importedCount = 0;
        let failedCount = 0;
        
        for (const url of newTrackUrls) {
          try {
            setUploadStatus(`Importing (${importedCount + 1}/${newTrackUrls.length}): ${url}...`);
            console.log(`[SoundCloud Import] Fetching metadata for: ${url}`);
            
            // 1. Fetch metadata for the new track
            const metaResponse = await fetch(`/api/soundcloud/metadata?url=${encodeURIComponent(url)}`);
            if (!metaResponse.ok) {
              console.error(`[SoundCloud Import] Metadata fetch failed for ${url}:`, metaResponse.status);
              failedCount++;
              continue;
            }
            
            const meta = await metaResponse.json();
            
            if (metaResponse.ok) {
              console.log(`[SoundCloud Import] Creating track: ${meta.title}`);
              // 2. Create the track in Firestore
              await handleUploadTrack({
                title: meta.title || "Untitled Track",
                artist: meta.artist || "Axrid",
                genre: meta.genre || "Electronic",
                description: meta.description || "",
                privacy: "public",
                soundcloudUrl: url,
                coverUrl: meta.artworkUrl || "",
                releaseDate: meta.releaseDate || new Date().toISOString().split('T')[0]
              });
              importedCount++;
            }
          } catch (err) {
            console.error(`[SoundCloud Import] Failed to import track ${url}:`, err);
            failedCount++;
          }
        }

        setUploadStatus(`Import complete! Successfully imported ${importedCount} tracks. ${failedCount > 0 ? `Failed: ${failedCount}` : ""}`);
        showNotification(`Import complete! Successfully imported ${importedCount} tracks.`, 'success');
        setTimeout(() => setUploadStatus(""), 5000);
      });
    } catch (error: any) {
      console.error("Error importing from profile:", error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const autoFindMissingLinks = async () => {
    if (!user || user.email !== OWNER_EMAIL) return;
    
    const missingTracks = tracks.filter((t: any) => !t.soundcloudUrl);
    if (missingTracks.length === 0) {
      showNotification("No tracks missing SoundCloud links.", 'info');
      return;
    }

    showNotification("Auto-find is no longer available.", 'info');
  };

  // migrateToFirebase removed — no longer using Firebase Storage

  const bulkSyncAllTracks = async () => {
    if (!user || user.email !== OWNER_EMAIL) return;
    
    try {
      // Find the "vibes" track to use as a template for non-SoundCloud fields
      const vibeTrack = tracks.find((t: any) => 
        t.title.toLowerCase() === 'vibes' || 
        t.title.toLowerCase() === 'vibe' ||
        t.title.toLowerCase().includes('vibe')
      );
      
      if (!vibeTrack) {
        showNotification("Could not find 'vibes' track to use as a template.", 'error');
        return;
      }

      const template = {
        recordLabel: vibeTrack.recordLabel || "",
        publisher: vibeTrack.publisher || "",
        isExplicit: vibeTrack.isExplicit ?? false,
        enableDirectDownloads: vibeTrack.enableDirectDownloads ?? true,
        allowComments: vibeTrack.allowComments ?? true,
        privacy: vibeTrack.privacy || "public"
      };

      const tracksToSync = tracks.filter((t: any) => t.soundcloudUrl);
      if (tracksToSync.length === 0) {
        showNotification("No tracks with SoundCloud URLs found.", 'info');
        return;
      }

      confirmAction(`This will update ${tracksToSync.length} tracks using SoundCloud metadata and the "${vibeTrack.title}" template. Continue?`, async () => {
        setUploadStatus("Starting bulk sync...");
        let updatedCount = 0;
        let skippedCount = 0;

        for (const track of tracksToSync) {
          try {
            setUploadStatus(`Syncing (${updatedCount + 1}/${tracksToSync.length}): ${track.title}...`);
            const response = await fetch(`/api/soundcloud/metadata?url=${encodeURIComponent(track.soundcloudUrl)}`);
            if (response.ok) {
              const scData = await response.json();
              const updates: any = { ...template };
              if (scData.title) updates.title = scData.title;
              if (scData.artist) updates.artist = scData.artist;
              if (scData.genre) updates.genre = scData.genre;
              if (scData.releaseDate) updates.releaseDate = scData.releaseDate;
              
              await handleUpdateTrack(track.id, updates);
              updatedCount++;
            } else {
              skippedCount++;
            }
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`Failed to sync track ${track.id}:`, err);
            skippedCount++;
          }
        }

        setUploadStatus(`Bulk sync complete! Updated ${updatedCount} tracks. ${skippedCount > 0 ? `Skipped ${skippedCount}.` : ''}`);
        showNotification(`Bulk sync complete! Updated ${updatedCount} tracks.`, 'success');
        setTimeout(() => setUploadStatus(""), 5000);
      });
    } catch (error: any) {
      console.error("Error in bulk sync:", error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };

  const standardizeRecordLabels = async () => {
    if (!user || user.email !== OWNER_EMAIL) return;
    try {
      const vibesTrack = tracks.find((t: any) =>
        t.title.toLowerCase() === 'vibes' || t.title.toLowerCase() === 'vibe' || t.title.toLowerCase().includes('vibe')
      );
      if (!vibesTrack || !vibesTrack.recordLabel) {
        showNotification("Could not find 'vibes' track or it has no record label set.", 'error');
        return;
      }
      const standardLabel = vibesTrack.recordLabel;
      confirmAction(`Standardize all tracks to record label: "${standardLabel}"?`, async () => {
        setUploadStatus("Standardizing record labels...");
        const batch = tracks.filter((t: any) => t.recordLabel !== standardLabel);
        for (const track of batch) {
          await fetch(`/api/tracks/${track.id}`, {
            method: "PUT", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordLabel: standardLabel }),
          });
        }
        await refreshTracks();
        setUploadStatus("All tracks updated successfully!");
        showNotification(`Standardized ${batch.length} tracks to "${standardLabel}"`, 'success');
        setTimeout(() => setUploadStatus(""), 3000);
      });
    } catch (error: any) {
      showNotification(`Error: ${error.message}`, 'error');
    }
  };

  const handleDeleteAllTracks = async () => {
    if (!isAdmin) return;
    confirmAction("Are you sure you want to delete ALL tracks? This cannot be undone.", async () => {
      setUploadStatus("Deleting all tracks...");
      try {
        const currentTracks: any[] = await fetch("/api/tracks", { credentials: "include" }).then(r => r.json());
        for (const t of currentTracks) {
          await fetch(`/api/tracks/${t.id}`, { method: "DELETE", credentials: "include" });
        }
        await refreshTracks();
        showNotification(`Successfully deleted ${currentTracks.length} tracks.`, 'success');
        setUploadStatus(`All ${currentTracks.length} tracks deleted successfully.`);
        setTimeout(() => setUploadStatus(""), 3000);
      } catch (error: any) {
        showNotification(`Error: ${error.message}`, 'error');
        setUploadStatus(`Error: ${error.message}`);
      }
    });
  };

  const handleOpenRedirect = (url?: any) => {
    const finalUrl = typeof url === 'string' ? url : DEFAULT_SETTINGS.soundcloudUrl;
    setIsRedirectModalOpen(finalUrl);
  };

  const handleLogoutConfirm = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setIsLogoutModalOpen(false);
    setIsMenuOpen(false);
    navigate('/login');
    window.location.reload(); // clear all state
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  return (
    <div className="min-h-screen bg-ink text-paper font-sans selection:bg-paper selection:text-ink overflow-x-hidden">
      <ScrollToTop />
      <Navigation 
        user={user} 
        profile={profile}
        isAdmin={isAdmin} 
        setIsMenuOpen={setIsMenuOpen} 
        isMenuOpen={isMenuOpen} 
        onReleasesClick={handleOpenRedirect}
        onLogoutClick={() => setIsLogoutModalOpen(true)}
        onDonateClick={() => setIsDonateModalOpen(true)}
        soundcloudUrl={settings?.soundcloudUrl}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />
      
      <AnimatePresence>
        {isMenuOpen && (
          <MobileMenu 
            user={user} 
            profile={profile}
            isAdmin={isAdmin}
            setIsMenuOpen={setIsMenuOpen} 
            isMenuOpen={isMenuOpen} 
            onReleasesClick={handleOpenRedirect}
            onLogoutClick={() => setIsLogoutModalOpen(true)}
            onDonateClick={() => setIsDonateModalOpen(true)}
            soundcloudUrl={settings?.soundcloudUrl}
          />
        )}
      </AnimatePresence>
 
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <Home 
              noTransition
              settings={settings}
              onRedirect={handleOpenRedirect}
              user={user}
              profile={profile}
              isAdmin={isAdmin}
              tracks={tracks}
              albums={albums}
              handleUploadTrack={handleUploadTrack}
              handleUpdateTrack={handleUpdateTrack}
              handleDeleteTrack={handleDeleteTrack}
              handleToggleTrackVisibility={handleToggleTrackVisibility}
              setLightboxImage={setLightboxImage}
              handleSyncTrack={handleSyncTrack}
              uploadStatus={uploadStatus}
              setUploadStatus={setUploadStatus}
              showNotification={showNotification}
              confirmAction={confirmAction}
              handleCreateAlbum={handleCreateAlbum}
              handleUpdateAlbum={handleUpdateAlbum}
              onDeleteAlbum={handleDeleteAlbum}
              isAlbumModalOpen={isAlbumModalOpen}
              setIsAlbumModalOpen={setIsAlbumModalOpen}
              editingAlbum={editingAlbum}
              setEditingAlbum={setEditingAlbum}
              posts={posts}
              handleCreatePost={handleCreatePost}
              handleDeletePost={handleDeletePost}
              handleToggleVisibility={handleToggleVisibility}
              newPostContent={newPostContent}
              setNewPostContent={setNewPostContent}
              newPostTitle={newPostTitle}
              setNewPostTitle={setNewPostTitle}
              newPostSubtitle={newPostSubtitle}
              setNewPostSubtitle={setNewPostSubtitle}
              isPosting={isPosting}
            />
          } />
          <Route path="/tracks/:trackId" element={<TrackPage tracks={tracks} />} />
          <Route path="/artists/:artistName" element={<ArtistPage />} />
          <Route path="/login" element={<LoginPage user={user} onAuthChange={(u: LocalUser) => { setUser({ ...u, uid: u.id }); setProfile({ email: u.email, displayName: u.displayName, alias: u.alias, role: u.role, photoURL: u.photoURL || "" }); }} />} />
          <Route path="/about" element={<About settings={settings} onRedirect={handleOpenRedirect} />} />
          <Route path="/music" element={
            <Music 
              user={user}
              profile={profile}
              isAdmin={isAdmin}
              tracks={tracks}
              albums={albums}
              handleUploadTrack={handleUploadTrack}
              handleUpdateTrack={handleUpdateTrack}
              handleDeleteTrack={handleDeleteTrack}
              handleToggleTrackVisibility={handleToggleTrackVisibility}
              setLightboxImage={setLightboxImage}
              handleSyncTrack={handleSyncTrack}
              uploadStatus={uploadStatus}
              setUploadStatus={setUploadStatus}
              showNotification={showNotification}
              confirmAction={confirmAction}
              handleCreateAlbum={handleCreateAlbum}
              handleUpdateAlbum={handleUpdateAlbum}
              onDeleteAlbum={handleDeleteAlbum}
              isAlbumModalOpen={isAlbumModalOpen}
              setIsAlbumModalOpen={setIsAlbumModalOpen}
              editingAlbum={editingAlbum}
              setEditingAlbum={setEditingAlbum}
            />
          } />
          <Route path="/messages" element={
            <Messages 
              user={user}
              profile={profile}
            />
          } />
          <Route path="/settings" element={
            <UserSettings 
              user={user}
              profile={profile}
              setProfile={setProfile}
              onThemeToggle={handleThemeToggle}
              theme={theme}
            />
          } />
          <Route path="/user/:userId" element={
            <PublicProfile 
              users={users}
              tracks={tracks}
              isAdmin={isAdmin}
              user={user}
              handleDeleteTrack={handleDeleteTrack}
              handleToggleTrackVisibility={handleToggleTrackVisibility}
              setLightboxImage={setLightboxImage}
              showNotification={showNotification}
              confirmAction={confirmAction}
            />
          } />
          <Route path="/updates" element={
            <Updates 
              user={user}
              isAdmin={isAdmin} 
              posts={posts} 
              handleCreatePost={handleCreatePost} 
              handleDeletePost={handleDeletePost}
              handleToggleVisibility={handleToggleVisibility}
              newPostContent={newPostContent}
              setNewPostContent={setNewPostContent}
              newPostTitle={newPostTitle}
              setNewPostTitle={setNewPostTitle}
              newPostSubtitle={newPostSubtitle}
              setNewPostSubtitle={setNewPostSubtitle}
              isPosting={isPosting}
              setLightboxImage={setLightboxImage}
            />
          } />
          <Route path="/admin" element={<AdminLive />} />
          <Route path="/admin/panel" element={
            <AdminPanel
              user={user}
              isAdmin={isAdmin}
              posts={posts}
              handleToggleVisibility={handleToggleVisibility}
              handleDeletePost={handleDeletePost}
              handleUpdatePost={handleUpdatePost}
              settings={settings}
              handleUpdateSettings={handleUpdateSettings}
              users={users}
              messages={messages}
              changelog={changelog}
              comments={comments}
              tracks={tracks}
              handleUploadTrack={handleUploadTrack}
              handleUpdateTrack={handleUpdateTrack}
              handleDeleteTrack={handleDeleteTrack}
              handleDeleteAllTracks={handleDeleteAllTracks}
              handleToggleTrackVisibility={handleToggleTrackVisibility}
              setLightboxImage={setLightboxImage}
              handleSyncTrack={handleSyncTrack}
              bulkSyncAllTracks={bulkSyncAllTracks}
              autoFindMissingLinks={autoFindMissingLinks}
              isAutoFinding={isAutoFinding}
              importFromSoundCloudProfile={importFromSoundCloudProfile}
              isImporting={isImporting}
              standardizeRecordLabels={standardizeRecordLabels}
              setUploadStatus={setUploadStatus}
              showNotification={showNotification}
              confirmAction={confirmAction}
            />
          } />
          <Route path="/admin/changelog" element={<ChangeLog isAdmin={isAdmin} user={user} changelog={changelog} />} />
          <Route path="/admin/stats" element={<ServerStats user={user} isAdmin={isAdmin} />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </AnimatePresence>

      <Footer 
        onContactClick={() => setIsContactModalOpen(true)} 
        onDonateClick={() => setIsDonateModalOpen(true)}
        noTransition={location.pathname === '/'}
      />
      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} onRedirect={handleOpenRedirect} />
      <LogoutModal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)} 
        onConfirm={handleLogoutConfirm} 
      />
      <DonateModal 
        isOpen={isDonateModalOpen} 
        onClose={() => setIsDonateModalOpen(false)} 
      />

      {/* Custom Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border ${
              notification.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' :
              notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
              'bg-paper/90 border-line text-ink'
            }`}
          >
            {notification.type === 'error' ? <AlertCircle size={18} /> : 
             notification.type === 'success' ? <Check size={18} /> : 
             <Info size={18} />}
            <span className="text-xs font-bold uppercase tracking-widest">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmation(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-card border border-line p-8 rounded-3xl max-w-md w-full shadow-2xl"
            >
              <h3 className="text-xl font-serif italic mb-4">Confirm Action</h3>
              <p className="text-ink/60 text-sm mb-8 leading-relaxed">{confirmation.message}</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmation(null)}
                  className="flex-1 px-6 py-3 border border-line rounded-xl text-[10px] uppercase tracking-widest font-bold hover:bg-card/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmation.onConfirm();
                    setConfirmation(null);
                  }}
                  className="flex-1 px-6 py-3 bg-paper text-ink rounded-xl text-[10px] uppercase tracking-widest font-bold hover:opacity-90 transition-all"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <RedirectModal 
        isOpen={!!isRedirectModalOpen} 
        onClose={() => setIsRedirectModalOpen(false)} 
        url={typeof isRedirectModalOpen === 'string' ? isRedirectModalOpen : DEFAULT_SETTINGS.soundcloudUrl} 
      />
      <AnimatePresence>
        {lightboxImage && (
          <Lightbox 
            isOpen={!!lightboxImage} 
            onClose={() => setLightboxImage(null)} 
            imageUrl={lightboxImage.url} 
            title={lightboxImage.title}
          />
        )}
      </AnimatePresence>
      <AlbumModal 
        isOpen={isAlbumModalOpen}
        onClose={() => {
          setIsAlbumModalOpen(false);
          setEditingAlbum(null);
        }}
        onSave={(data) => {
          if (editingAlbum) {
            handleUpdateAlbum(editingAlbum.id, data);
          } else {
            handleCreateAlbum(data);
          }
        }}
        album={editingAlbum}
        allTracks={tracks}
      />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [changelog, setChangelog] = useState<any[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostSubtitle, setNewPostSubtitle] = useState("");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmation, setConfirmation] = useState<{message: string, onConfirm: () => void} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const confirmAction = (message: string, onConfirm: () => void) => {
    setConfirmation({ message, onConfirm });
  };

  const handleSyncTrack = async (track: any) => {
    showNotification("SoundCloud syncing is disabled.", 'info');
  };
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState<string | boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string, title?: string } | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showThemePrompt, setShowThemePrompt] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<'light' | 'dark' | null>(null);

  // Audio Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const getPlayableTracks = () => {
    return tracks.filter((t: any) => t.isVisible || isAdmin).sort((a: any, b: any) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.createdAt?.toDate?.()?.getTime() || 0);
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.createdAt?.toDate?.()?.getTime() || 0);
      return dateB - dateA;
    });
  };

  const playTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleCreateAlbum = async (albumData: any) => {
    if (!user) return;
    try {
      const res = await fetch("/api/albums", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(albumData),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showNotification("Album created successfully", "success");
      setIsAlbumModalOpen(false);
      await refreshAlbums();
    } catch (error) {
      console.error("Error creating album:", error);
      showNotification("Error creating album", "error");
    }
  };

  const handleUpdateAlbum = async (albumId: string, albumData: any) => {
    try {
      const res = await fetch(`/api/albums/${albumId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(albumData),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showNotification("Album updated successfully", "success");
      setIsAlbumModalOpen(false);
      setEditingAlbum(null);
      await refreshAlbums();
    } catch (error) {
      console.error("Error updating album:", error);
      showNotification("Error updating album", "error");
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    confirmAction("Are you sure you want to delete this album?", async () => {
      try {
        await fetch(`/api/albums/${albumId}`, { method: "DELETE", credentials: "include" });
        showNotification("Album deleted successfully", "success");
        await refreshAlbums();
      } catch (error) {
        console.error("Error deleting album:", error);
        showNotification("Error deleting album", "error");
      }
    });
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const playNext = () => {
    if (!currentTrack) return;
    const playable = getPlayableTracks();
    const currentIndex = playable.findIndex((t: any) => t.id === currentTrack.id);
    if (currentIndex !== -1 && playable.length > 0) {
      const nextIndex = (currentIndex + 1) % playable.length;
      setCurrentTrack(playable[nextIndex]);
      setIsPlaying(true);
    }
  };

  const playPrevious = () => {
    if (!currentTrack) return;
    const playable = getPlayableTracks();
    const currentIndex = playable.findIndex((t: any) => t.id === currentTrack.id);
    if (currentIndex !== -1 && playable.length > 0) {
      const prevIndex = (currentIndex - 1 + playable.length) % playable.length;
      setCurrentTrack(playable[prevIndex]);
      setIsPlaying(true);
    }
  };

  const handleThemeToggle = (newTheme?: any) => {
    const nextTheme = (typeof newTheme === 'string' && (newTheme === 'light' || newTheme === 'dark')) 
      ? newTheme 
      : (theme === 'dark' ? 'light' : 'dark');
    if (nextTheme !== theme) {
      setPendingTheme(nextTheme);
      setShowThemePrompt(true);
    }
  };

  const confirmThemeToggle = async () => {
    if (pendingTheme) {
      setTheme(pendingTheme);
      if (profile) setProfile({ ...profile, theme: pendingTheme });
      if (user) {
        fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ theme: pendingTheme }),
        }).catch(console.error);
      }
    }
    setShowThemePrompt(false);
  };

  const isAdmin = user?.email === "kurtdolan2@gmail.com" || profile?.role === "admin";

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Update theme from profile
  useEffect(() => {
    if (profile?.theme) {
      setTheme(profile.theme);
    }
  }, [profile]);

  // Poll /api/auth/me every 5s to pick up server-side theme changes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetch("/api/auth/me", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.user?.theme) setTheme(data.user.theme);
        })
        .catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/users", { credentials: "include" })
      .then(r => r.json()).then(setUsers).catch(console.error);
  }, [user?.id]);
  console.log("Admin Status Check:", { 
    email: user?.email, 
    role: profile?.role, 
    isAdmin,
    isAuthReady,
    userId: user?.uid 
  });

  // HTTPS Redirect
  useEffect(() => {
    if (window.location.protocol === 'http:' && window.location.hostname === 'axrid.com') {
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  }, []);

  // Settings
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => setSettings(Object.keys(data).length ? data : DEFAULT_SETTINGS))
      .catch(console.error);
  }, []);

  // Albums
  useEffect(() => {
    fetch("/api/albums")
      .then(r => r.json()).then(setAlbums).catch(console.error);
  }, []);

  // Changelog
  useEffect(() => {
    fetch("/api/changelog")
      .then(r => r.json()).then(setChangelog).catch(console.error);
  }, []);

  // Tracks
  useEffect(() => {
    fetch("/api/tracks", { credentials: "include" })
      .then(r => r.json()).then(setTracks).catch(console.error);
  }, [isAdmin, user?.id]);

  // Auth check on mount — calls /api/auth/me to restore session
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setUser({ ...u, uid: u.id });
          setProfile({
            email: u.email,
            displayName: u.displayName,
            alias: u.alias,
            role: u.role,
            photoURL: u.photoURL || "",
          });
        } else {
          setUser(null);
          setProfile(null);
        }
      })
      .catch(() => {
        setUser(null);
        setProfile(null);
      })
      .finally(() => setIsAuthReady(true));
  }, []);

  // Posts
  useEffect(() => {
    fetch("/api/posts", { credentials: "include" })
      .then(r => r.json()).then(setPosts).catch(console.error);
  }, [isAdmin]);

  // Helper: re-fetch data after mutations
  const refreshPosts = () => fetch("/api/posts", { credentials: "include" }).then(r => r.json()).then(setPosts).catch(console.error);
  const refreshTracks = () => fetch("/api/tracks", { credentials: "include" }).then(r => r.json()).then(setTracks).catch(console.error);
  const refreshAlbums = () => fetch("/api/albums", { credentials: "include" }).then(r => r.json()).then(setAlbums).catch(console.error);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !user || !isAdmin) return;
    setIsPosting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newPostTitle, subtitle: newPostSubtitle, content: newPostContent, isVisible: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNewPostContent(""); setNewPostTitle(""); setNewPostSubtitle("");
      await refreshPosts();
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, "posts"); }
    finally { setIsPosting(false); }
  };

  const handleToggleVisibility = async (postId: string, currentVisibility: boolean) => {
    if (!isAdmin) return;
    await fetch(`/api/posts/${postId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !currentVisibility }),
    });
    await refreshPosts();
  };

  const handleUpdatePost = async (postId: string, updates: Partial<Post>) => {
    if (!isAdmin) return;
    await fetch(`/api/posts/${postId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await refreshPosts();
  };

  const handleUpdateTrack = async (trackId: string, updates: Partial<Track>) => {
    if (!isAdmin) return false;
    try {
      const res = await fetch(`/api/tracks/${trackId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshTracks();
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tracks/${trackId}`);
      return false;
    }
  };

  const handleUploadTrack = async (trackData: Omit<Track, 'id' | 'createdAt' | 'isVisible' | 'authorId'>) => {
    if (!user) return;
    try {
      const payload = { ...trackData, audioUrl: trackData.audioUrl || "", coverUrl: trackData.coverUrl || "", releaseDate: trackData.releaseDate || new Date().toISOString().split('T')[0] };
      const res = await fetch("/api/tracks", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshTracks();
    } catch (error) {
      console.error("Error saving track:", error);
      handleFirestoreError(error, OperationType.WRITE, "tracks");
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    const isOwner = user && (track.authorId === user.id || track.authorId === user.uid);
    if (!isAdmin && !isOwner) return;
    confirmAction(`Are you sure you want to delete "${track.title}"?`, async () => {
      await fetch(`/api/tracks/${trackId}`, { method: "DELETE", credentials: "include" });
      showNotification(`Deleted "${track.title}"`, 'success');
      await refreshTracks();
    });
  };

  const handleToggleTrackVisibility = async (trackId: string, isVisible: boolean) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return false;
    const isOwner = user && (track.authorId === user.id || track.authorId === user.uid);
    if (!isAdmin && !isOwner) return false;
    if (!isAdmin && isVisible) return false;
    await fetch(`/api/tracks/${trackId}/visibility`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible }),
    });
    await refreshTracks();
    return true;
  };

  const handleDeletePost = async (postId: string) => {
    if (!isAdmin) return;
    await fetch(`/api/posts/${postId}`, { method: "DELETE", credentials: "include" });
    await refreshPosts();
  };

  const handleUpdateSettings = async (newSettings: SiteSettings) => {
    if (!isAdmin) return;
    await fetch("/api/settings", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    });
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-paper text-sm uppercase tracking-widest">Loading</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AudioPlayerContext.Provider value={{ currentTrack, isPlaying, playTrack, togglePlayPause, playNext, playPrevious }}>
        <Router>
          <AppContent
            user={user}
            setUser={setUser}
            profile={profile}
            setProfile={setProfile}
            isAdmin={isAdmin}
            posts={posts}
            tracks={tracks}
            comments={comments}
            users={users}
            messages={messages}
            changelog={changelog}
            handleCreatePost={handleCreatePost}
            handleDeletePost={handleDeletePost}
            handleToggleVisibility={handleToggleVisibility}
            handleUpdatePost={handleUpdatePost}
            handleUploadTrack={handleUploadTrack}
            handleUpdateTrack={handleUpdateTrack}
            handleDeleteTrack={handleDeleteTrack}
            handleToggleTrackVisibility={handleToggleTrackVisibility}
            handleSyncTrack={handleSyncTrack}
            newPostContent={newPostContent}
            setNewPostContent={setNewPostContent}
            newPostTitle={newPostTitle}
            setNewPostTitle={setNewPostTitle}
            newPostSubtitle={newPostSubtitle}
            setNewPostSubtitle={setNewPostSubtitle}
            isPosting={isPosting}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            isContactModalOpen={isContactModalOpen}
            setIsContactModalOpen={setIsContactModalOpen}
            isLogoutModalOpen={isLogoutModalOpen}
            setIsLogoutModalOpen={setIsLogoutModalOpen}
            isDonateModalOpen={isDonateModalOpen}
            setIsDonateModalOpen={setIsDonateModalOpen}
            isRedirectModalOpen={isRedirectModalOpen}
            setIsRedirectModalOpen={setIsRedirectModalOpen}
            lightboxImage={lightboxImage}
            setLightboxImage={setLightboxImage}
            settings={settings}
            handleUpdateSettings={handleUpdateSettings}
            theme={theme}
            handleThemeToggle={handleThemeToggle}
            showNotification={showNotification}
            confirmAction={confirmAction}
            notification={notification}
            confirmation={confirmation}
            setConfirmation={setConfirmation}
            albums={albums}
            handleCreateAlbum={handleCreateAlbum}
            handleUpdateAlbum={handleUpdateAlbum}
            handleDeleteAlbum={handleDeleteAlbum}
            isAlbumModalOpen={isAlbumModalOpen}
            setIsAlbumModalOpen={setIsAlbumModalOpen}
            editingAlbum={editingAlbum}
            setEditingAlbum={setEditingAlbum}
          />
          <ThemeTogglePrompt 
            isOpen={showThemePrompt} 
            onClose={() => setShowThemePrompt(false)} 
            onConfirm={confirmThemeToggle} 
            currentTheme={theme} 
          />
          <GlobalAudioPlayer setLightboxImage={setLightboxImage} />
        </Router>
      </AudioPlayerContext.Provider>
    </ErrorBoundary>
  );
}



