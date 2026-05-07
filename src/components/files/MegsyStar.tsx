import { motion } from "framer-motion";

/**
 * Megsy brand star — same visual language as the chat/voice loader.
 * Sized via the `size` prop (px). Renders a glowing rotating orb.
 */
const MegsyStar = ({ size = 28 }: { size?: number }) => {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-tr from-violet-500 via-blue-500 to-pink-500 blur-md opacity-70" />
      </motion.div>
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-[15%] rounded-full bg-gradient-to-br from-violet-400 via-blue-400 to-pink-400"
        style={{ filter: "blur(0.5px)" }}
      />
      <div
        className="absolute inset-[35%] rounded-full bg-white/90"
        style={{ filter: "blur(0.5px)" }}
      />
    </div>
  );
};

export default MegsyStar;
