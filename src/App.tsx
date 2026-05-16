import { useEffect, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import CookieConsent from "./components/CookieConsent";
import TranslationWrapper from "./components/TranslationWrapper";

// Critical pages — eagerly loaded
import AuthPage from "./pages/AuthPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import ChatPage from "./pages/ChatPage";
import LandingPage from "./pages/LandingPage";
import ComingSoonPage from "./pages/ComingSoonPage";

// Lazy-loaded pages
const ImagesPage = lazy(() => import("./pages/ImagesPage"));
const VideosPage = lazy(() => import("./pages/VideosPage"));
const FilesPage = lazy(() => import("./pages/FilesPage"));
const ProgrammingPage = lazy(() => import("./pages/ProgrammingPage"));
const CodeWorkspace = lazy(() => import("./pages/CodeWorkspace"));
const PreviewPage = lazy(() => import("./pages/PreviewPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CustomizationPage = lazy(() => import("./pages/CustomizationPage"));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const BillingSuccessPage = lazy(() => import("./pages/BillingSuccessPage"));
const ReferralsPage = lazy(() => import("./pages/ReferralsPage"));
const LanguagePage = lazy(() => import("./pages/LanguagePage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChangeEmailPage = lazy(() => import("./pages/ChangeEmailPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const DeleteAccountPage = lazy(() => import("./pages/DeleteAccountPage"));
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage"));
const OAuthAuthorizePage = lazy(() => import("./pages/OAuthAuthorizePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SharedChatPage = lazy(() => import("./pages/SharedChatPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ServiceImagesPage = lazy(() => import("./pages/services/ServiceImagesPage"));
const ServiceVideosPage = lazy(() => import("./pages/services/ServiceVideosPage"));
const ServiceChatPage = lazy(() => import("./pages/services/ServiceChatPage"));
const ServiceFilesPage = lazy(() => import("./pages/services/ServiceFilesPage"));
const ServiceCodePage = lazy(() => import("./pages/services/ServiceCodePage"));
const ImageStudioPage = lazy(() => import("./pages/ImageStudioPage"));
const VideoStudioPage = lazy(() => import("./pages/VideoStudioPage"));
const ImageAgentPage = lazy(() => import("./pages/ImageAgentPage"));
const VideoAgentPage = lazy(() => import("./pages/VideoAgentPage"));
const EgyptPage = lazy(() => import("./pages/EgyptPage"));
const ModelsPage = lazy(() => import("./pages/ModelsPage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const ChangelogPage = lazy(() => import("./pages/ChangelogPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const EnterprisePage = lazy(() => import("./pages/EnterprisePage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const AuthDocsPage = lazy(() => import("./pages/AuthDocsPage"));
const VoicePage = lazy(() => import("./pages/VoicePage"));
const VoiceChangerPage = lazy(() => import("./pages/voice/VoiceChangerPage"));
const CloneVoicePage = lazy(() => import("./pages/voice/CloneVoicePage"));
const TTSPage = lazy(() => import("./pages/voice/TTSPage"));
const VoiceCallPage = lazy(() => import("./pages/voice/VoiceCallPage"));
const MusicGeneratorPage = lazy(() => import("./pages/voice/MusicGeneratorPage"));
const MusicPlayerPage = lazy(() => import("./pages/voice/MusicPlayerPage"));
const NoiseRemoverPage = lazy(() => import("./pages/voice/NoiseRemoverPage"));
const VoiceTranslatePage = lazy(() => import("./pages/voice/VoiceTranslatePage"));
const VoiceStudioPage = lazy(() => import("./pages/voice/VoiceStudioPage"));
const VideoToTextPage = lazy(() => import("./pages/tools/VideoToTextPage"));
const AIPersonalizationPage = lazy(() => import("./pages/AIPersonalizationPage"));
const MemoryPage = lazy(() => import("./pages/MemoryPage"));
const LearningModePage = lazy(() => import("./pages/LearningModePage"));
const ShoppingModePage = lazy(() => import("./pages/ShoppingModePage"));
const DeepResearchPage = lazy(() => import("./pages/DeepResearchPage"));
const ResearchPreviewPage = lazy(() => import("./pages/ResearchPreviewPage"));
const InpaintPage = lazy(() => import("./pages/tools/InpaintPage"));
const ClothesChangerPage = lazy(() => import("./pages/tools/ClothesChangerPage"));
const HeadshotPage = lazy(() => import("./pages/tools/HeadshotPage"));
const BgRemoverPage = lazy(() => import("./pages/tools/BgRemoverPage"));
const FaceSwapPage = lazy(() => import("./pages/tools/FaceSwapPage"));
const RelightPage = lazy(() => import("./pages/tools/RelightPage"));
const ColorizerPage = lazy(() => import("./pages/tools/ColorizerPage"));
const CharacterSwapPage = lazy(() => import("./pages/tools/CharacterSwapPage"));
const StoryboardPage = lazy(() => import("./pages/tools/StoryboardPage"));
const SketchToImagePage = lazy(() => import("./pages/tools/SketchToImagePage"));
const RetouchingPage = lazy(() => import("./pages/tools/RetouchingPage"));
const RemoverPage = lazy(() => import("./pages/tools/RemoverPage"));
const HairChangerPage = lazy(() => import("./pages/tools/HairChangerPage"));
const CartoonPage = lazy(() => import("./pages/tools/CartoonPage"));
const AvatarGeneratorPage = lazy(() => import("./pages/tools/AvatarGeneratorPage"));
const ProductPhotoPage = lazy(() => import("./pages/tools/ProductPhotoPage"));
const LogoGeneratorPage = lazy(() => import("./pages/tools/LogoGeneratorPage"));
const PerspectiveCorrectionPage = lazy(() => import("./pages/tools/PerspectiveCorrectionPage"));
const VideoSwapPage = lazy(() => import("./pages/tools/VideoSwapPage"));
const VideoUpscalePage = lazy(() => import("./pages/tools/VideoUpscalePage"));
const TalkingPhotoPage = lazy(() => import("./pages/tools/TalkingPhotoPage"));
const VideoExtenderPage = lazy(() => import("./pages/tools/VideoExtenderPage"));
const AutoCaptionPage = lazy(() => import("./pages/tools/AutoCaptionPage"));
const LipSyncPage = lazy(() => import("./pages/tools/LipSyncPage"));
const GreenScreenPage = lazy(() => import("./pages/tools/GreenScreenPage"));
const VideoColorizerPage = lazy(() => import("./pages/tools/VideoColorizerPage"));
const VideoWatermarkPage = lazy(() => import("./pages/tools/VideoWatermarkPage"));
const VideoBgReplacerPage = lazy(() => import("./pages/tools/VideoBgReplacerPage"));
const VideoIntroPage = lazy(() => import("./pages/tools/VideoIntroPage"));
const VideoDenoisePage = lazy(() => import("./pages/tools/VideoDenoisePage"));
const ThumbnailGeneratorPage = lazy(() => import("./pages/tools/ThumbnailGeneratorPage"));
const KaraokeSeparatorPage = lazy(() => import("./pages/voice/KaraokeSeparatorPage"));
const PodcastEditorPage = lazy(() => import("./pages/voice/PodcastEditorPage"));
const AudioRestorationPage = lazy(() => import("./pages/voice/AudioRestorationPage"));
const AudioTranscriptionPage = lazy(() => import("./pages/voice/AudioTranscriptionPage"));
const SmartNotesPage = lazy(() => import("./pages/tools/SmartNotesPage"));
const ExamSimulatorPage = lazy(() => import("./pages/tools/ExamSimulatorPage"));
const StudyPlannerPage = lazy(() => import("./pages/tools/StudyPlannerPage"));
const FocusRoomPage = lazy(() => import("./pages/tools/FocusRoomPage"));

const queryClient = new QueryClient();

const LazyFallback = () => <div className="h-screen bg-background" />;

// Scroll to top on every route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setAuthenticated(!!session);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setAuthenticated(!!session);
        setLoading(false);
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  if (loading) return <div className="h-screen bg-background" />;
  if (!authenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
    else document.documentElement.setAttribute("data-theme", "light");
    const savedAccent = localStorage.getItem("accent");
    if (savedAccent) document.documentElement.style.setProperty("--primary", savedAccent);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id || null;
      const lastUserId = localStorage.getItem("megsy_last_user_id");

      if (userId && lastUserId && userId !== lastUserId) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("megsy_cache_")) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        queryClient.clear();
      }

      if (userId) localStorage.setItem("megsy_last_user_id", userId);

      if (event === "SIGNED_OUT") {
        localStorage.removeItem("megsy_last_user_id");
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("megsy_cache_")) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        queryClient.clear();
      }

      setCurrentUserId(userId);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <TranslationWrapper>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <OfflineBanner />
              <CookieConsent />
              <Suspense fallback={<LazyFallback />}>
                <Routes>
                  <Route path="*" element={<ComingSoonPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </TranslationWrapper>
  );
};

export default App;
