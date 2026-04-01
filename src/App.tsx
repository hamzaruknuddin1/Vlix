import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { 
  Search, 
  Upload, 
  Play, 
  Clock, 
  Tag, 
  Loader2, 
  Video as VideoIcon,
  LogOut,
  User,
  AlertCircle,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { processVideo } from "./services/geminiService";

interface TranscriptItem {
  timestamp: number;
  text: string;
}

interface VisualTextItem {
  timestamp: number;
  text: string;
}

interface VisualObject {
  timestamp: number;
  name: string;
}

interface VideoMetadata {
  id: string;
  title: string;
  url: string;
  status: "processing" | "ready" | "error";
  transcript: TranscriptItem[];
  visualText: VisualTextItem[];
  visualObjects: VisualObject[];
  createdAt: number;
  userId: string;
  errorDetails?: string;
}

interface SearchResult {
  timestamp: number;
  content: string;
}

export default function App() {
  const [user, setUser] = useState<{ uid: string; displayName: string; photoURL: string } | null>(null);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null);
  
  const [transcriptResults, setTranscriptResults] = useState<SearchResult[]>([]);
  const [visualTextResults, setVisualTextResults] = useState<SearchResult[]>([]);
  const [visualObjectResults, setVisualObjectResults] = useState<SearchResult[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mock login for MVP
  const handleLogin = () => {
    setUser({
      uid: "mock-user-123",
      displayName: "Demo User",
      photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=demo"
    });
  };

  const handleLogout = () => {
    setUser(null);
    setVideos([]);
    setSelectedVideo(null);
  };

  useEffect(() => {
    if (selectedVideo) {
      const current = videos.find(v => v.id === selectedVideo.id);
      if (current && (current.status !== selectedVideo.status || current.transcript.length !== selectedVideo.transcript.length)) {
        setSelectedVideo(current);
      }
    }
  }, [videos, selectedVideo?.id]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 200 * 1024 * 1024) {
      alert("File is too large (Max 200MB). Please try a smaller or lower resolution video.");
      return;
    }

    setIsUploading(true);
    try {
      // Use local URL for instant playback
      const localUrl = URL.createObjectURL(file);
      const videoId = Math.random().toString(36).substring(7);

      const newVideo: VideoMetadata = {
        id: videoId,
        title: file.name,
        url: localUrl,
        status: "processing",
        userId: user.uid,
        createdAt: Date.now(),
        transcript: [],
        visualText: [],
        visualObjects: []
      };

      setVideos(prev => [newVideo, ...prev]);
      setSelectedVideo(newVideo);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          console.log("Starting AI processing for video:", videoId);
          const result = await processVideo(base64, file.type);
          console.log("AI processing complete for video:", videoId);
          
          setVideos(prev => prev.map(v => v.id === videoId ? {
            ...v,
            status: "ready",
            transcript: result.transcript || [],
            visualText: result.visualText || [],
            visualObjects: result.visualObjects || []
          } : v));
        } catch (err: any) {
          console.error("Processing error:", err);
          setVideos(prev => prev.map(v => v.id === videoId ? {
            ...v,
            status: "error",
            errorDetails: err.message || "AI processing failed"
          } : v));
        }
      };
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to process video locally.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = () => {
    if (!selectedVideo || !searchQuery) {
      setTranscriptResults([]);
      setVisualTextResults([]);
      setVisualObjectResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    
    // Find the latest version of the selected video from the list
    const currentVideo = videos.find(v => v.id === selectedVideo.id) || selectedVideo;

    const tResults: SearchResult[] = [];
    const vtResults: SearchResult[] = [];
    const voResults: SearchResult[] = [];

    currentVideo.transcript.forEach((item) => {
      if (item.text.toLowerCase().includes(query)) {
        tResults.push({ timestamp: item.timestamp, content: item.text });
      }
    });

    currentVideo.visualText.forEach((item) => {
      if (item.text.toLowerCase().includes(query)) {
        vtResults.push({ timestamp: item.timestamp, content: item.text });
      }
    });

    currentVideo.visualObjects.forEach((item) => {
      if (item.name.toLowerCase().includes(query)) {
        voResults.push({ timestamp: item.timestamp, content: item.name });
      }
    });

    setTranscriptResults(tResults.sort((a, b) => a.timestamp - b.timestamp));
    setVisualTextResults(vtResults.sort((a, b) => a.timestamp - b.timestamp));
    setVisualObjectResults(voResults.sort((a, b) => a.timestamp - b.timestamp));
  };

  useEffect(() => {
    handleSearch();
  }, [searchQuery, selectedVideo, videos]);

  const jumpToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-100">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
              <VideoIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">VideoSearch AI</h1>
            <p className="text-zinc-400">Search inside your videos like you search the web.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3"
          >
            <User className="w-5 h-5" />
            Sign in to Demo
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <VideoIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">VideoSearch</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full text-sm">
              <img src={user.photoURL || ""} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
              <span className="font-medium">{user.displayName}</span>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Error Banner */}
        {error && (
          <div className="lg:col-span-12 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between text-red-500 mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Left Sidebar: Video List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Your Videos</h2>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-zinc-500 group-hover:text-orange-500 transition-colors" />
                    <p className="mt-2 text-xs text-zinc-500">Upload MP4, MOV</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {videos.map((vid) => (
              <button
                key={vid.id}
                onClick={() => setSelectedVideo(vid)}
                className={`w-full p-3 rounded-xl text-left transition-all ${
                  selectedVideo?.id === vid.id 
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedVideo?.id === vid.id ? "bg-white/20" : "bg-zinc-800"}`}>
                    <VideoIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{vid.title}</p>
                    <p className={`text-[10px] uppercase tracking-widest ${selectedVideo?.id === vid.id ? "text-white/70" : "text-zinc-500"}`}>
                      {vid.status}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content: Player & Search */}
        <div className="lg:col-span-9 space-y-6">
          {selectedVideo ? (
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search for words, objects, or scenes..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-6">
                {/* Player */}
                <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative">
                  <video 
                    ref={videoRef}
                    src={selectedVideo.url} 
                    controls 
                    className="w-full h-full"
                  />
                  {selectedVideo.status === "processing" && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 p-6 text-center">
                      <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                      <p className="text-lg font-medium">AI is watching your video...</p>
                      <p className="text-zinc-500 text-sm">This usually takes a minute for a 15min video.</p>
                    </div>
                  )}
                  {selectedVideo.status === "error" && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 p-6 text-center">
                      <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                        <VideoIcon className="w-6 h-6 text-red-500" />
                      </div>
                      <p className="text-lg font-medium text-red-500">AI Processing Failed</p>
                      <p className="text-zinc-400 text-sm">{selectedVideo.errorDetails || "The video might be too large or in an unsupported format."}</p>
                      <button 
                        onClick={() => setSelectedVideo(null)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                      >
                        Try another video
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold">{selectedVideo.title}</h1>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-medium text-zinc-400">
                      {selectedVideo.transcript.length} Spoken
                    </span>
                    <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-medium text-zinc-400">
                      {selectedVideo.visualText.length} Written
                    </span>
                    <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-medium text-zinc-400">
                      {selectedVideo.visualObjects.length} Objects
                    </span>
                  </div>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left: Written Text */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Tag className="w-4 h-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider">Written on Screen</h3>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      <AnimatePresence mode="popLayout">
                        {visualTextResults.length > 0 ? (
                          visualTextResults.map((res: SearchResult, i: number) => (
                            <ResultCard key={`vt-${i}`} res={res} i={i} onClick={() => jumpToTime(res.timestamp)} />
                          ))
                        ) : searchQuery ? (
                          <EmptyState message="No text found on screen" />
                        ) : (
                          <EmptyState message="Search to see written text" />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Middle: Appeared Objects */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <VideoIcon className="w-4 h-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider">Appeared in Video</h3>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      <AnimatePresence mode="popLayout">
                        {visualObjectResults.length > 0 ? (
                          visualObjectResults.map((res: SearchResult, i: number) => (
                            <ResultCard key={`vo-${i}`} res={res} i={i} onClick={() => jumpToTime(res.timestamp)} />
                          ))
                        ) : searchQuery ? (
                          <EmptyState message="No objects identified" />
                        ) : (
                          <EmptyState message="Search to see objects" />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Right: Spoken Transcript */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Clock className="w-4 h-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider">Spoken Words</h3>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      <AnimatePresence mode="popLayout">
                        {transcriptResults.length > 0 ? (
                          transcriptResults.map((res: SearchResult, i: number) => (
                            <ResultCard key={`tr-${i}`} res={res} i={i} onClick={() => jumpToTime(res.timestamp)} />
                          ))
                        ) : searchQuery ? (
                          <EmptyState message="No spoken matches" />
                        ) : (
                          <EmptyState message="Search to see transcript" />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[70vh] flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-900 rounded-3xl">
              <VideoIcon className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg">Select a video to start searching</p>
            </div>
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}

const ResultCard: React.FC<{ res: SearchResult; i: number; onClick: () => void }> = ({ res, i, onClick }) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: i * 0.03 }}
      onClick={onClick}
      className="w-full p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-[10px] font-mono text-orange-500 mb-1">
            {Math.floor(res.timestamp / 60)}:{(res.timestamp % 60).toString().padStart(2, '0')}
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
            {res.content}
          </p>
        </div>
        <div className="mt-1 p-1 bg-zinc-800 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-3 h-3 text-orange-500" />
        </div>
      </div>
    </motion.button>
  );
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-zinc-600">
      <p className="text-xs">{message}</p>
    </div>
  );
}
