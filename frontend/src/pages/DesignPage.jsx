import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useThemeStore } from "../store/useThemeStore";
import DesignChat from "../components/DesignChat";

const defaultWokwiUrl = "";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getInitialProject = (locationState) => {
  return locationState?.projectSnapshot || null;
};

const getDraftStorageKey = (projectId) => `hardcode:design:draft:${projectId}`;
const getWokwiUrlStorageKey = (projectId) => `hardcode:design:wokwi-url:${projectId}`;

export default function DesignPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const draggingRef = useRef(false);

  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  const [project, setProject] = useState(() => getInitialProject(location.state));
  const [messages, setMessages] = useState(() => getInitialProject(location.state)?.designMessages || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(58);
  const [wokwiContext, setWokwiContext] = useState({ connected: false, reason: "No live circuit context" });
  const [draftRestored, setDraftRestored] = useState(false);
  const [wokwiUrlFallback, setWokwiUrlFallback] = useState("");

  const designState = project?.designState || {};
  const ideaState = project?.ideaState || {};
  const componentsState = project?.componentsState || {};
  const wokwiUrl = project?.wokwiUrl || project?.designState?.wokwiUrl || wokwiUrlFallback || defaultWokwiUrl;

  useEffect(() => {
    if (!id) return;

    try {
      const cachedUrl = localStorage.getItem(getWokwiUrlStorageKey(id));
      if (cachedUrl && cachedUrl.trim()) {
        setWokwiUrlFallback(cachedUrl.trim());
      }
    } catch {
      // Ignore localStorage errors.
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const nextUrl = (project?.wokwiUrl || project?.designState?.wokwiUrl || "").trim();
    if (!nextUrl) return;

    try {
      localStorage.setItem(getWokwiUrlStorageKey(id), nextUrl);
      setWokwiUrlFallback(nextUrl);
    } catch {
      // Ignore localStorage errors.
    }
  }, [id, project?.wokwiUrl, project?.designState?.wokwiUrl]);

  useEffect(() => {
    if (!id) return;

    try {
      const rawDraft = localStorage.getItem(getDraftStorageKey(id));
      if (!rawDraft) return;

      const parsed = JSON.parse(rawDraft);

      if (typeof parsed?.input === "string") {
        setInput(parsed.input);
      }

      if (typeof parsed?.leftPanelWidth === "number") {
        setLeftPanelWidth(clamp(parsed.leftPanelWidth, 30, 70));
      }

      setDraftRestored(true);
    } catch {
      // Ignore malformed draft state and continue with defaults.
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    try {
      const payload = {
        input,
        leftPanelWidth,
        updatedAt: Date.now()
      };
      localStorage.setItem(getDraftStorageKey(id), JSON.stringify(payload));
    } catch {
      // localStorage can fail in strict browser modes.
    }
  }, [id, input, leftPanelWidth]);

  useEffect(() => {
    if (!id) return;

    const handleBeforeUnload = () => {
      try {
        const payload = {
          input,
          leftPanelWidth,
          updatedAt: Date.now()
        };
        localStorage.setItem(getDraftStorageKey(id), JSON.stringify(payload));
      } catch {
        // Best effort save on close/refresh.
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [id, input, leftPanelWidth]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!draggingRef.current || !containerRef.current) return;

      const bounds = containerRef.current.getBoundingClientRect();
      const nextLeftWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
      setLeftPanelWidth(clamp(nextLeftWidth, 30, 70));
    };

    const handlePointerUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const loadProject = async () => {
      try {
        // Use route state only for immediate paint, then always refresh from backend.
        if (location.state?.projectSnapshot) {
          setProject(location.state.projectSnapshot);
          setMessages(location.state.projectSnapshot?.designMessages || []);
        }

        const res = await axios.get(
          `http://localhost:5000/api/project/${id}`,
          { withCredentials: true }
        );

        setProject(res.data);
        setMessages(res.data?.designMessages || []);
      } catch (err) {
        console.error("Load Design Project Error:", err);
        toast.error(err?.response?.data?.error || "Unable to load design project");
      } finally {
        setBooting(false);
      }
    };

    if (id) {
      loadProject();
    }
  }, [id, location.state]);

  useEffect(() => {
    const bootDesign = async () => {
      if (!id || booting || messages.length > 0) return;

      try {
        setLoading(true);
        const res = await axios.post(
          "http://localhost:5000/api/design/init",
          { projectId: id },
          { withCredentials: true }
        );

        setMessages([{ role: "ai", content: res.data.reply }]);
        setProject(prev => prev ? { ...prev, designState: res.data.designState } : prev);
        if (res.data?.wokwiContext) {
          setWokwiContext(res.data.wokwiContext);
        }
      } catch (err) {
        const errorMessage = err?.response?.data?.error || "Unable to start Design AI";
        toast.error(errorMessage);
        setMessages([{ role: "ai", content: errorMessage }]);
      } finally {
        setLoading(false);
      }
    };

    bootDesign();
  }, [id, booting, messages.length]);

  useEffect(() => {
    const loadLiveContext = async () => {
      if (!id) return;

      try {
        const res = await axios.get(
          `http://localhost:5000/api/design/context/${id}`,
          { withCredentials: true }
        );

        if (res.data?.wokwiContext) {
          setWokwiContext(res.data.wokwiContext);
        }
      } catch (err) {
        console.error("Load Wokwi Context Error:", err);
      }
    };

    loadLiveContext();
  }, [id]);

  const pushAssistantMessage = async (messageText) => {
    const nextMessage = messageText.trim();
    if (!nextMessage || loading) return;

    setMessages(prev => [...prev, { role: "user", content: nextMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/design/chat",
        { projectId: id, message: nextMessage },
        { withCredentials: true }
      );

      setMessages(prev => [...prev, { role: "ai", content: res.data.reply }]);
      setProject(prev => prev ? { ...prev, designState: res.data.designState } : prev);
      if (res.data?.wokwiContext) {
        setWokwiContext(res.data.wokwiContext);
      }
    } catch (err) {
      const errorMessage = err?.response?.data?.error || "Design chat failed";
      toast.error(errorMessage);
      setMessages(prev => [...prev, { role: "ai", content: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    pushAssistantMessage(input);
  };

  const handleDebug = () => {
    pushAssistantMessage(
      "Debug the current design context. Summarize the active Wokwi layout, list missing parts, and give the next manual step only. Keep it concise."
    );
  };

  const handleDividerPointerDown = () => {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleSetWokwiUrl = async () => {
    const currentUrl = project?.wokwiUrl || "https://wokwi.com/projects/328451800839488084";
    const inputValue = window.prompt("Paste Wokwi project URL", currentUrl);

    if (inputValue === null) return;

    const nextUrl = inputValue.trim();

    try {
      const res = await axios.put(
        `http://localhost:5000/api/project/${id}`,
        { wokwiUrl: nextUrl },
        { withCredentials: true }
      );

      setProject(res.data);
      setWokwiUrlFallback(nextUrl);

      try {
        if (nextUrl) {
          localStorage.setItem(getWokwiUrlStorageKey(id), nextUrl);
        } else {
          localStorage.removeItem(getWokwiUrlStorageKey(id));
        }
      } catch {
        // Ignore localStorage errors.
      }

      const contextRes = await axios.get(
        `http://localhost:5000/api/design/context/${id}`,
        { withCredentials: true }
      );

      if (contextRes.data?.wokwiContext) {
        setWokwiContext(contextRes.data.wokwiContext);
      }

      toast.success(nextUrl ? "Wokwi URL saved" : "Wokwi URL cleared");
    } catch (err) {
      console.error("Save Wokwi URL Error:", err);
      toast.error(err?.response?.data?.error || "Failed to save Wokwi URL");
    }
  };

  return (
    <div className={`h-screen overflow-hidden ${isDark ? "bg-[#212121] text-[#e5e5e5]" : "bg-[#f5f5f5] text-[#111]"}`}>
      <div className="mx-auto flex h-full w-full max-w-screen-2xl flex-col gap-3 px-4 py-4 lg:px-5">
        <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 ${isDark ? "border-white/10" : "border-black/10"}`}>
          <div>
            <button
              onClick={() => navigate(`/project/${id}`)}
              className={`border px-3 py-1 text-xs font-semibold transition ${isDark ? "border-white/10 hover:bg-white/10" : "border-black/10 hover:bg-black/5"}`}
            >
              ← Back to Project
            </button>
            <h1 className="mt-2 text-2xl font-semibold">Design AI</h1>
            <p className={`mt-1 text-sm ${isDark ? "text-[#a3a3a3]" : "text-[#555]"}`}>
              Design-only workspace with Wokwi on the right and AI guidance on the left.
            </p>
            {draftRestored && (
              <p className={`mt-1 text-xs font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}>
                Draft restored after refresh/close.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSetWokwiUrl}
              className={`border px-4 py-2 text-xs font-semibold transition ${isDark ? "border-white/10 hover:bg-white/10" : "border-black/10 hover:bg-black/5"}`}
            >
              Set Wokwi URL
            </button>

            <button
              onClick={handleDebug}
              disabled={loading}
              className={`px-4 py-2 text-xs font-semibold transition ${isDark ? "bg-[#3a3a3a] hover:bg-[#4a4a4a]" : "bg-black text-white hover:bg-[#222]"} ${loading ? "cursor-not-allowed opacity-60" : ""}`}
            >
              Debug Design
            </button>
            <button
              onClick={toggleTheme}
              className={`border px-4 py-2 text-xs font-semibold transition ${isDark ? "border-white/10 hover:bg-white/10" : "border-black/10 hover:bg-black/5"}`}
            >
              {isDark ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        <div ref={containerRef} className={`flex min-h-0 flex-1 items-stretch gap-0 overflow-hidden border ${isDark ? "border-white/10" : "border-black/10"}`}>
          <section
            className="min-w-0 overflow-hidden rounded-l-2xl border-r-0"
            style={{ width: `${leftPanelWidth}%` }}
          >
            <div className={`flex h-full min-h-0 flex-col overflow-hidden ${isDark ? "bg-[#2a2a2a]" : "bg-white"}`}>
              <div className={`border-b px-4 py-3 ${isDark ? "border-white/10" : "border-black/10"}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${isDark ? "text-[#a3a3a3]" : "text-[#666]"}`}>
                  Wokwi
                </p>
                <h2 className="mt-1 text-base font-semibold">Simulator / layout view</h2>
              </div>

              <div className="flex min-h-0 flex-1 flex-col bg-[#1e1e1e] p-2">
                {wokwiUrl ? (
                  <iframe
                    title="Wokwi simulator"
                    src={wokwiUrl}
                    className="h-full min-h-0 w-full flex-1 border border-white/10 bg-black"
                    allow="clipboard-read; clipboard-write; fullscreen"
                  />
                ) : (
                  <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center border border-white/10 bg-black px-6 text-center">
                    <p className="text-sm text-white/70">
                      No Wokwi project link is connected yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <button
            type="button"
            onPointerDown={handleDividerPointerDown}
            aria-label="Resize design panels"
            className={`group relative z-10 flex w-3 cursor-col-resize items-stretch justify-center border-x ${isDark ? "border-white/10 bg-[#1f1f1f]" : "border-black/10 bg-[#eaeaea]"}`}
          >
            <span className={`my-4 w-1 rounded-full ${isDark ? "bg-white/20 group-hover:bg-white/40" : "bg-black/20 group-hover:bg-black/40"}`} />
          </button>

          <section
            className="min-w-0 overflow-hidden rounded-r-2xl border-l-0"
            style={{ width: `${100 - leftPanelWidth}%` }}
          >
            <div className={`flex h-full min-h-0 overflow-hidden ${isDark ? "bg-[#2a2a2a]" : "bg-white"}`}>
              <DesignChat
                project={project}
                wokwiContext={wokwiContext}
                messages={messages}
                input={input}
                setInput={setInput}
                loading={loading}
                onSend={handleSend}
                onDebug={handleDebug}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}