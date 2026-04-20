import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileUp, Plus, Square, X } from "lucide-react";

type AttachmentItem = { name: string; type: string; data: string };

interface LiquidWorkspaceInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  placeholder: string;
  canSend: boolean;
  hidePlus?: boolean;
  plusOpen?: boolean;
  onPlusToggle?: () => void;
  onPlusClose?: () => void;
  plusMenu?: ReactNode;
  attachments?: AttachmentItem[];
  onRemoveAttachment?: (index: number) => void;
  textareaRef?: RefObject<HTMLTextAreaElement>;
}

const spring = { type: "spring" as const, damping: 28, stiffness: 280 };

const LiquidWorkspaceInput = ({
  value, onChange, onSend, onStop, isLoading, placeholder, canSend,
  hidePlus = false, plusOpen = false, onPlusToggle, onPlusClose, plusMenu,
  attachments = [], onRemoveAttachment, textareaRef,
}: LiquidWorkspaceInputProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ta = textareaRef?.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [value, textareaRef]);

  // Click anywhere outside (sheet OR input shell) closes the plus sheet
  useEffect(() => {
    if (!plusOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideSheet = sheetRef.current?.contains(t);
      const insideShell = shellRef.current?.contains(t);
      if (!insideSheet && !insideShell) {
        (onPlusClose ?? onPlusToggle)?.();
      }
    };
    const id = setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", close); };
  }, [plusOpen, onPlusClose, onPlusToggle]);

  return (
    <>
      {/* Backdrop dim — also closes on tap */}
      <AnimatePresence>
        {plusOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-30 bg-black/15 backdrop-blur-[3px]"
            onClick={() => (onPlusClose ?? onPlusToggle)?.()}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2 px-4">
              {attachments.map((file, index) => (
                <div key={`${file.name}-${index}`} className="group relative overflow-hidden rounded-2xl border border-border bg-background px-2.5 py-2">
                  {file.type === "image" ? (
                    <img src={file.data} alt={file.name} className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 items-center gap-2 pr-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border">
                        <FileUp className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="max-w-[138px] truncate text-xs font-medium text-foreground/72">{file.name}</span>
                    </div>
                  )}
                  {onRemoveAttachment && (
                    <button
                      onClick={() => onRemoveAttachment(index)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Plus sheet — full width, slime drag, frosted glass */}
          <AnimatePresence>
            {plusOpen && plusMenu && (
              <motion.div
                ref={sheetRef}
                initial={{ y: "100%", opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={spring}
                drag="y"
                dragConstraints={{ top: -60, bottom: 0 }}
                dragElastic={{ top: 0.7, bottom: 0.25 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 600) {
                    (onPlusClose ?? onPlusToggle)?.();
                  }
                }}
                className="ios26-plus-sheet relative z-40 mx-auto w-full max-w-xl px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-1"
              >
                <div className="ios26-plus-handle" />
                {plusMenu}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input shell — large, rounded-top, top border only */}
          <motion.div ref={shellRef} layout transition={spring} className="ios26-input-shell">
            <div className="mx-auto flex max-w-3xl items-end gap-1 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)]">
              {!hidePlus && (
                <button
                  onClick={onPlusToggle}
                  aria-label="Add"
                  className={`ios26-circle-button flex h-12 w-12 shrink-0 items-center justify-center transition-transform duration-200 ${plusOpen ? "rotate-45" : "rotate-0"}`}
                >
                  <Plus className="h-6 w-6" strokeWidth={1.6} />
                </button>
              )}

              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isLoading && canSend) onSend();
                  }
                }}
                placeholder={placeholder}
                rows={1}
                dir="auto"
                className="max-h-[180px] min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-[16px] font-normal text-foreground outline-none placeholder:text-foreground/35"
              />

              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.button
                    key="stop"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: "spring", damping: 18, stiffness: 380 }}
                    onClick={onStop}
                    className="ios26-send-button flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </motion.button>
                ) : canSend ? (
                  <motion.button
                    key="send"
                    initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.4, opacity: 0, rotate: 45 }}
                    transition={{ type: "spring", damping: 16, stiffness: 420 }}
                    onClick={onSend}
                    className="ios26-send-button flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <ArrowUp className="h-5 w-5" strokeWidth={2.2} />
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default LiquidWorkspaceInput;
