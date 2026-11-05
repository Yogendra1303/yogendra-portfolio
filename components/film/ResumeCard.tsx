"use client";
/**
 * The résumé, as a page of the film rather than a PDF. A dark wormhole opens
 * from the top left (where the button is) and swallows the frame; the résumé
 * settles out of it. × or Esc closes it and the film is exactly where it was.
 * Content comes from content/resume.ts.
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { GitBranch, Link2, Mail, X } from "lucide-react";
import { owner } from "@/content/story";
import { resume } from "@/content/resume";

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-mono text-[10px] uppercase tracking-[0.45em] text-[var(--signal)] [text-shadow:0_0_10px_color-mix(in_srgb,var(--signal)_45%,transparent)]">{children}</h3>
);
/** One section of the résumé in a neon-bordered box, in the film's signal colour. */
const Box = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`neon-box mt-4 rounded-[10px] p-[14px] sm:p-5 ${className}`}>{children}</section>
);

export function ResumeCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="resume" className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Résumé" data-lenis-prevent initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
          {/* The dark wormhole: a disc of night that opens from the button. */}
          <motion.div
            aria-hidden
            className="absolute left-0 top-0 h-[300vmax] w-[300vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#000_55%,rgba(0,0,0,0.92)_68%,rgba(124,255,196,0.18)_70%,transparent_72%)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }}
            onClick={onClose}
          />
          <div className="absolute inset-0 overflow-y-auto overscroll-contain px-4 py-[8vh]" onClick={onClose}>
            <motion.article
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: 0.35, duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
              className="relative mx-auto max-w-3xl border border-white/10 bg-black/70 px-6 py-10 sm:px-12"
            >
              <button
                ref={close}
                type="button"
                onClick={onClose}
                aria-label="Close the résumé"
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center text-white/60 transition hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              <h2 className="font-display text-[clamp(1.4rem,3.4vw,2.2rem)] uppercase tracking-[0.18em] text-[var(--signal)] [text-shadow:0_0_18px_color-mix(in_srgb,var(--signal)_55%,transparent)]">{resume.name}</h2>
              <p className="mt-2 font-serif text-lg italic text-white/80">{resume.headline}</p>
              <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/55">
                <span>{resume.location}</span>
                <a href={`mailto:${owner.email}`} className="inline-flex items-center gap-1.5 hover:text-white"><Mail className="h-3 w-3" aria-hidden />{owner.email}</a>
                <a href={owner.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white"><Link2 className="h-3 w-3" aria-hidden />LinkedIn</a>
                <a href={owner.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white"><GitBranch className="h-3 w-3" aria-hidden />GitHub</a>
              </p>
              <Box className="mt-7">
                <p className="text-[15px] leading-relaxed text-white/80">{resume.summary}</p>
              </Box>

              <Box>
                <H>Key achievements</H>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {resume.achievements.map((a) => (
                    <li key={a.title} className="neon-cell rounded-[8px] p-3">
                      <p className="font-display text-[11px] uppercase tracking-[0.2em] text-white">{a.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/65">{a.text}</p>
                    </li>
                  ))}
                </ul>
              </Box>

              <h3 className="mt-7 font-mono text-[10px] uppercase tracking-[0.45em] text-[var(--signal)] [text-shadow:0_0_10px_color-mix(in_srgb,var(--signal)_45%,transparent)]">Experience</h3>
              <ol>
                {resume.experience.map((x) => (
                  <li key={x.role + x.when} className="neon-box mt-4 rounded-[10px] p-[14px] sm:p-5">
                    <p className="font-display text-[12px] uppercase tracking-[0.18em] text-white">{x.role}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
                      {x.org} · {x.when} · {x.where}
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 ps-5 text-[13px] leading-relaxed text-white/70 marker:text-white/30">
                      {x.points.map((pt) => (
                        <li key={pt}>{pt}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>

              <Box className="mt-6">
                <H>Education</H>
                <p className="mt-3 text-[14px] text-white/80">
                  {resume.education.degree} · {resume.education.school} · {resume.education.when}
                </p>
              </Box>

              <Box>
                <H>Skills</H>
                <p className="mt-3 text-[13px] leading-relaxed text-white/70">{resume.skills.join(" · ")}</p>
              </Box>

              <Box>
                <H>Languages</H>
                <p className="mt-3 text-[13px] text-white/70">{resume.languages.join(" · ")}</p>
              </Box>

              <Box>
                <H>Beyond the roles</H>
                <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[13px] leading-relaxed text-white/70 marker:text-white/30">
                  {resume.extras.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Box>
            </motion.article>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
