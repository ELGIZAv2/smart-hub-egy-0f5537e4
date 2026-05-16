import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

const ComingSoonPage = () => {
  return (
    <div data-theme="dark" className="relative min-h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <Helmet>
        <title>Megsy — Coming Soon</title>
        <meta name="description" content="We haven't started yet. We will soon change AI forever." />
      </Helmet>

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-muted-foreground backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Megsy
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="font-display text-[12vw] uppercase leading-[0.95] tracking-tight md:text-[7vw]"
        >
          We haven't <br className="hidden md:block" />
          started <span className="text-primary">yet.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          We will begin soon. We are going to change AI — forever.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-14 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground/70"
        >
          <span className="h-px w-10 bg-border" />
          Stay tuned
          <span className="h-px w-10 bg-border" />
        </motion.div>
      </main>
    </div>
  );
};

export default ComingSoonPage;
