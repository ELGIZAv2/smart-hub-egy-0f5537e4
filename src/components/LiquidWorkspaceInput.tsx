import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileUp, Plus, Square, X } from "lucide-react";

type AttachmentItem = {
  name: string;
  type: string;
  data: string;
};

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

const spring = { type: "spring" as const, damping: 26, stiffness: 320 };

const LiquidWorkspaceInput = ({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  placeholder,
  canSend,
  hidePlus = false,
  plusOpen = false,
  onPlusToggle,
  onPlusClose,
  plusMenu,
  attachments = [],
  onRemoveAttachment,
  textareaRef,
}: LiquidWorkspaceInputProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const textarea = textareaRef?.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value, textareaRef]);

  // Click anywhere outside plus sheet closes it
  useEffect(() => {
    if (!plusOpen) return;
    const close = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onPlusClose?.() ?? onPlusToggle?.();
      }
    };
    // defer to next tick so the toggle click doesn't immediately close
    const t = setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", close);
    };
  }, [plusOpen, onPlusClose, onPlusToggle]);

  return (
    <>
      {/* Backdrop dim when plus open */}
      <AnimatePresence>
        {plusOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[2px]"
            onClick={() => (onPlusClose?.() ?? onPlusToggle?.())}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
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

          {/* Plus menu sheet — slime drag with handle */}
          <AnimatePresence>
            {plusOpen && plusMenu && (
              <motion.div
                ref={sheetRef}
                initial={{ y: 40, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 40, opacity: 0, scale: 0.96 }}
                transition={spring}
                drag="y"
                dragConstraints={{ top: -40, bottom: 0 }}
                dragElastic={{ top: 0.6, bottom: 0.2 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80 || info.velocity.y > 500) {
                    onPlusClose?.() ?? onPlusToggle?.();
                  }
                }}
                className="relative z-40 mx-auto mb-3 max-w-md px-4"
              >
                <div className="mx-auto w-full">
                  <div className="ios26-plus-handle" />
                  {plusMenu}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div layout transition={spring} className="ios26-input-shell">
            <div className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              {!hidePlus && (
                <button
                  onClick={onPlusToggle}
                  className={`ios26-circle-button flex h-11 w-11 shrink-0 items-center justify-center text-foreground/75 transition duration-200 ${plusOpen ? "rotate-45" : "rotate-0"}`}
                >
                  <Plus className="h-5 w-5" strokeWidth={1.75} />
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
                className="max-h-[160px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] font-normal text-foreground outline-none placeholder:text-foreground/35"
              />

              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.button
                    key="stop"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onStop}
                    className="ios26-send-button flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </motion.button>
                ) : canSend ? (
                  <motion.button
                    key="send"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", damping: 18, stiffness: 380 }}
                    onClick={onSend}
                    className="ios26-send-button flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <ArrowUp className="h-5 w-5" />
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
