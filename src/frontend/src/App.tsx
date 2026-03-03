import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertCircle,
  Camera,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { PhotoMetadata } from "./backend";
import { useActor } from "./hooks/useActor";
import {
  useDeletePhoto,
  useListAllPhotos,
  useUploadPhoto,
} from "./hooks/useQueries";

// ── Admin session (client-side session token) ──────────────────
const SESSION_KEY = "avk_admin_token";
function getStoredToken() {
  return sessionStorage.getItem(SESSION_KEY);
}
function storeToken(token: string) {
  sessionStorage.setItem(SESSION_KEY, token);
}
function clearToken() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Format date ────────────────────────────────────────────────
function formatDate(timestamp: bigint): string {
  // Motoko Time is nanoseconds since epoch
  const ms = Number(timestamp) / 1_000_000;
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function App() {
  const { actor, isFetching: actorFetching } = useActor();
  const { data: photos = [], isLoading: photosLoading } = useListAllPhotos();
  const uploadMutation = useUploadPhoto();
  const deleteMutation = useDeletePhoto();

  // ── Auth state ─────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(() => !!getStoredToken());
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Lightbox state ─────────────────────────────────────────
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ── Delete confirm state ───────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ── Upload state ───────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );
  const [pendingUploads, setPendingUploads] = useState<
    { file: File; title: string; id: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Login ──────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!actor) return;
    setLoginError("");
    setLoginLoading(true);
    try {
      const token = await actor.login(adminId, adminPassword);
      storeToken(token);
      setIsAdmin(true);
      setLoginOpen(false);
      setAdminId("");
      setAdminPassword("");
      toast.success("Welcome back, Admin!");
    } catch {
      setLoginError("Invalid Admin ID or Password. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setIsAdmin(false);
    toast.success("Logged out successfully");
  };

  // ── File handling ──────────────────────────────────────────
  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      toast.error("Please select image files only");
      return;
    }
    setPendingUploads((prev) => [
      ...prev,
      ...valid.map((file) => ({
        file,
        title: file.name.replace(/\.[^.]+$/, ""),
        id: crypto.randomUUID(),
      })),
    ]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleUploadAll = async () => {
    if (pendingUploads.length === 0) return;

    const uploads = [...pendingUploads];
    setPendingUploads([]);

    for (const item of uploads) {
      try {
        await uploadMutation.mutateAsync({
          id: item.id,
          title: item.title || null,
          file: item.file,
          onProgress: (pct) => {
            setUploadProgress((prev) => ({ ...prev, [item.id]: pct }));
          },
        });
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        toast.success(`"${item.title || item.file.name}" uploaded!`);
      } catch {
        toast.error(`Failed to upload "${item.file.name}"`);
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    }
  };

  const removePending = (id: string) => {
    setPendingUploads((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Delete ─────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteMutation.mutateAsync(deleteTargetId);
      toast.success("Photo deleted");
    } catch {
      toast.error("Failed to delete photo");
    } finally {
      setDeleteTargetId(null);
    }
  };

  // ── Lightbox navigation ────────────────────────────────────
  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;
  const prevPhoto = () =>
    setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPhoto = () =>
    setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));

  const isUploading = Object.keys(uploadProgress).length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster position="top-right" richColors />

      {/* ── Header ── */}
      <header className="relative overflow-hidden bg-gradient-to-b from-amber-50 to-background border-b border-border">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url('/assets/generated/school-memories-banner.dim_1400x300.jpg')`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />
        <div className="relative z-10 container mx-auto px-4 py-8 flex flex-col items-center text-center gap-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 justify-center mb-1">
              <Camera className="h-6 w-6 text-primary" />
              <span className="font-body text-sm font-semibold tracking-widest uppercase text-primary/80">
                A.V.K. School
              </span>
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <h1 className="school-title-script text-4xl md:text-6xl font-bold text-foreground leading-tight">
              School Memories
            </h1>
            <p className="font-display text-xl md:text-2xl font-semibold text-primary mt-1 tracking-wide">
              2025 – 2026
            </p>
            <p className="font-body text-sm text-muted-foreground mt-2">
              Cherished moments from our school family
            </p>
          </motion.div>

          {/* Admin button */}
          <motion.div
            className="absolute top-4 right-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-ocid="admin.logout_button"
                className="bg-white/80 backdrop-blur-sm border-border/60 hover:bg-white"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Logout
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLoginOpen(true)}
                data-ocid="admin.open_modal_button"
                className="bg-white/80 backdrop-blur-sm border-border/60 hover:bg-white"
              >
                <Lock className="h-4 w-4 mr-1.5" />
                Admin
              </Button>
            )}
          </motion.div>
        </div>

        {/* Decorative wave */}
        <div className="relative h-6 overflow-hidden">
          <svg
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
            className="absolute bottom-0 w-full h-8 text-background fill-current"
            aria-hidden="true"
            role="presentation"
          >
            <path d="M0,20 C300,40 900,0 1200,20 L1200,40 L0,40 Z" />
          </svg>
        </div>
      </header>

      {/* ── Admin Upload Zone ── */}
      <AnimatePresence>
        {isAdmin && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden"
          >
            <div className="container mx-auto px-4 py-6">
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ImagePlus className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg text-foreground">
                    Upload Photos
                  </h2>
                  <span className="text-xs text-muted-foreground ml-1">
                    (Admin Panel)
                  </span>
                </div>

                {/* Dropzone */}
                <button
                  type="button"
                  data-ocid="upload.dropzone"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-all duration-200
                    ${
                      isDragOver
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/60 hover:bg-secondary/40"
                    }
                  `}
                >
                  <Upload className="h-10 w-10 mx-auto mb-3 text-primary/60" />
                  <p className="font-body font-medium text-foreground">
                    Drop photos here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports JPG, PNG, WEBP, GIF
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                    data-ocid="upload.upload_button"
                  />
                </button>

                {/* Pending queue */}
                {pendingUploads.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Ready to upload ({pendingUploads.length} photo
                      {pendingUploads.length !== 1 ? "s" : ""})
                    </p>
                    {pendingUploads.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm flex-1 truncate font-medium">
                          {item.file.name}
                        </span>
                        <Input
                          value={item.title}
                          onChange={(e) =>
                            setPendingUploads((prev) =>
                              prev.map((p) =>
                                p.id === item.id
                                  ? { ...p, title: e.target.value }
                                  : p,
                              ),
                            )
                          }
                          placeholder="Add a title..."
                          className="max-w-[200px] h-7 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removePending(item.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button
                      onClick={handleUploadAll}
                      disabled={isUploading || actorFetching}
                      className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload All ({pendingUploads.length})
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Upload progress */}
                {isUploading && (
                  <div
                    className="mt-4 space-y-2"
                    data-ocid="upload.loading_state"
                  >
                    {Object.entries(uploadProgress).map(([id, pct]) => (
                      <div key={id} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Uploading...</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Main Gallery ── */}
      <main
        className="flex-1 container mx-auto px-4 py-6 pb-16"
        data-ocid="gallery.page"
      >
        {photosLoading || actorFetching ? (
          <div className="photo-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable IDs
              <div key={i} className="photo-grid-item">
                <div className="polaroid animate-pulse">
                  <div
                    className="bg-muted rounded-sm"
                    style={{ height: `${150 + (i % 3) * 60}px` }}
                  />
                  <div className="mt-3 h-3 bg-muted rounded w-2/3 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : photos.length === 0 ? (
          <motion.div
            data-ocid="gallery.empty_state"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
              <Camera className="h-12 w-12 text-primary/40" />
            </div>
            <h3 className="font-display text-2xl font-semibold text-foreground mb-2">
              No memories yet
            </h3>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              {isAdmin
                ? "Start capturing memories! Use the upload zone above to add your first school photos."
                : "The gallery is empty right now. Check back soon for wonderful school memories!"}
            </p>
          </motion.div>
        ) : (
          <>
            <motion.p
              className="text-sm text-muted-foreground mb-5 font-body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {photos.length} {photos.length === 1 ? "memory" : "memories"}{" "}
              captured
            </motion.p>
            <div className="photo-grid">
              {photos.map((photo, index) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  index={index}
                  isAdmin={isAdmin}
                  onView={() => setLightboxIndex(index)}
                  onDelete={() => setDeleteTargetId(photo.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card py-6 text-center">
        <p className="text-xs text-muted-foreground font-body">
          AVK School Memories 2025–2026 · With love for our school community
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1 font-body">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Built with ♥ using caffeine.ai
          </a>
        </p>
      </footer>

      {/* ── Login Modal ── */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-sm" data-ocid="admin.login_modal">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Admin Login
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="admin-id" className="font-body font-medium">
                Admin ID
              </Label>
              <Input
                id="admin-id"
                data-ocid="admin.id_input"
                type="text"
                placeholder="Enter your Admin ID"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="font-body font-medium">
                Password
              </Label>
              <Input
                id="admin-password"
                data-ocid="admin.password_input"
                type="password"
                placeholder="Enter your password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoComplete="current-password"
              />
            </div>
            <AnimatePresence>
              {loginError && (
                <motion.div
                  data-ocid="admin.error_state"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {loginError}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLoginOpen(false);
                setLoginError("");
                setAdminId("");
                setAdminPassword("");
              }}
              data-ocid="admin.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogin}
              disabled={loginLoading || !adminId || !adminPassword}
              data-ocid="admin.submit_button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Photo?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This photo will be permanently removed from the gallery. This action
            cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTargetId(null)}
              data-ocid="photo.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-ocid="photo.confirm_button"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxPhoto && lightboxIndex !== null && (
          <motion.div
            data-ocid="photo.lightbox_modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors bg-black/40 rounded-full p-2"
              aria-label="Close lightbox"
            >
              <X className="h-6 w-6" />
            </button>

            {lightboxIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevPhoto();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors bg-black/40 rounded-full p-3"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {lightboxIndex < photos.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextPhoto();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors bg-black/40 rounded-full p-3"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            <motion.div
              key={lightboxIndex}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="max-w-4xl w-full mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="polaroid max-w-2xl mx-auto">
                <img
                  src={lightboxPhoto.blob.getDirectURL()}
                  alt={lightboxPhoto.title ?? "School memory"}
                  className="w-full rounded-sm object-contain max-h-[70vh]"
                />
                {lightboxPhoto.title && (
                  <p className="text-center font-script text-lg font-semibold text-foreground mt-3 px-2">
                    {lightboxPhoto.title}
                  </p>
                )}
                <p className="text-center text-xs text-muted-foreground mt-1">
                  {formatDate(lightboxPhoto.uploadTimestamp)}
                </p>
              </div>
              <p className="text-center text-white/50 text-xs mt-4">
                {lightboxIndex + 1} / {photos.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Photo Card Component ───────────────────────────────────────
function PhotoCard({
  photo,
  index,
  isAdmin,
  onView,
  onDelete,
}: {
  photo: PhotoMetadata;
  index: number;
  isAdmin: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      className="photo-grid-item"
      data-ocid={`gallery.item.${index + 1}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.5) }}
    >
      <div className="polaroid group relative">
        <button
          type="button"
          className="w-full text-left cursor-pointer"
          onClick={onView}
          aria-label={`View photo${photo.title ? `: ${photo.title}` : ""}`}
        >
          <img
            src={photo.blob.getDirectURL()}
            alt={photo.title ?? "School memory"}
            className="w-full rounded-sm object-cover"
            loading="lazy"
          />
          <div className="mt-3 px-1">
            {photo.title && (
              <p className="font-script text-sm font-semibold text-center text-foreground leading-snug truncate">
                {photo.title}
              </p>
            )}
            <p className="text-xs text-center text-muted-foreground mt-0.5">
              {formatDate(photo.uploadTimestamp)}
            </p>
          </div>
        </button>

        {/* Admin delete button */}
        {isAdmin && (
          <button
            type="button"
            data-ocid={`photo.delete_button.${index + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg hover:scale-110"
            aria-label="Delete photo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
