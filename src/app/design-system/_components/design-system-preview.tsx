import { ArrowUpRight, Asterisk, Layers3, MoveUpRight, Sparkles } from "lucide-react";
import { FadeUp } from "@/components/animation/fade-up";
import { GradientText } from "@/components/animation/gradient-text";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { motionTokens } from "@/config/motion";
import styles from "../design-system.module.css";

const palette = [
  { name: "Violet", value: "#7138ED", token: "var(--brand-purple)" },
  { name: "Electric", value: "#2459ED", token: "var(--electric-blue)" },
  { name: "Cyan", value: "#20C7D8", token: "var(--cyan)" },
  { name: "Pink", value: "#E764AD", token: "var(--pink)" },
  { name: "Coral", value: "#F47779", token: "var(--coral)" },
  { name: "Warmth", value: "#F5AD56", token: "var(--warm-accent)" },
] as const;

/** Temporary internal UI; these controls demonstrate appearance only. */
export function DesignSystemPreview() {
  return (
    <Section id="design-system" aria-labelledby="design-preview-title" className={styles.preview} data-design-system-preview>
      <Container>
        <FadeUp>
          <header className={styles.previewHeader}>
            <div><p className={styles.previewEyebrow}><span /> Internal · Design System</p><h2 id="design-preview-title" className="heading-1">A little energy.<br /><GradientText>A whole new world.</GradientText></h2></div>
            <p className={styles.previewIntro}>The building blocks of what’s next.<br />Expressive color, purposeful motion, and space for human connection.</p>
          </header>
        </FadeUp>
        <div className={styles.previewGrid}>
          <div className={styles.typeTile}>
            <span className={styles.tileLabel}>01 / EXPRESSION</span>
            <Asterisk className={styles.typeStar} aria-hidden="true" />
            <p className={styles.typeDisplay}>Stay curious.<br /><GradientText>Go somewhere.</GradientText></p>
            <p className="body-sm text-muted-foreground">Bold by nature. Fluid by design.</p>
            <div className={styles.typeSample}><span>Aa</span><div><strong>Modern sans</strong><p>System native / tightly tracked / confidently clear</p></div></div>
          </div>
          <div className={styles.paletteTile}>
            <span className={styles.tileLabel}>02 / COLOR IN CONNECTION</span>
            <h3 className="heading-3">An optimistic spectrum.</h3>
            <div className={styles.swatches}>{palette.map((color) => <div key={color.name}><span style={{ background: color.token }} /><strong>{color.name}</strong><small>{color.value}</small></div>)}</div>
            <div className={styles.gradientSamples}><span>Aurora</span><span>Afterglow</span><span>Daybreak</span></div>
          </div>
          <div className={styles.controlsTile}>
            <span className={styles.tileLabel}>03 / A LITTLE PUSH FORWARD</span>
            <h3 className="heading-3">Every interaction, intentional.</h3>
            <p id="preview-actions-note" className="body-sm text-muted-foreground">Appearance previews only. Try hover and keyboard focus.</p>
            <div className={styles.buttonSamples} aria-describedby="preview-actions-note"><Button>Primary <ArrowUpRight aria-hidden="true" /></Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline <ArrowUpRight aria-hidden="true" /></Button><Button variant="ghost">Ghost <ArrowUpRight aria-hidden="true" /></Button><Button variant="destructive">Destructive</Button><Button disabled>Disabled</Button></div>
            <div className={styles.buttonSizes} aria-describedby="preview-actions-note"><Button size="sm" variant="secondary">Small</Button><Button size="md" variant="secondary">Medium</Button><Button size="lg" variant="secondary">Large</Button></div>
          </div>
          <div className={styles.surfacesTile}>
            <span className={styles.tileLabel}>04 / SPACE WITH DIMENSION</span>
            <h3 className="heading-3">More than a flat surface.</h3>
            <div className={styles.surfaceSamples}>
              <div className="surface-clean"><Layers3 aria-hidden="true" /><strong>Clean</strong><small>Clarity comes first.</small></div>
              <div className="surface-tinted"><Asterisk aria-hidden="true" /><strong>Tinted</strong><small>A hint of possibility.</small></div>
              <div className="surface-glow"><Sparkles aria-hidden="true" /><strong>Soft glow</strong><small>Quietly magnetic.</small></div>
              <div className="surface-floating"><MoveUpRight aria-hidden="true" /><strong>Elevated</strong><small>A little perspective.</small></div>
            </div>
          </div>
        </div>
        <FadeUp>
          <div className={styles.motionStrip}>
            <div className={styles.motionHeading}><span className={styles.tileLabel}>05 / BUILT TO MOVE</span><h3 className="heading-3">Energy with intention.</h3><p>Reduced motion? Same clarity. Less movement.</p></div>
            <div className={styles.motionSample}><span className={styles.motionTrack}><i /></span><strong>Quick response</strong><small>{motionTokens.duration.fast * 1000}ms / interactions</small></div>
            <div className={styles.motionSample}><span className={styles.motionTrack}><i /></span><strong>Smooth entrance</strong><small>{motionTokens.duration.slow * 1000}ms / premium ease</small></div>
            <div className={styles.motionSample}><span className={styles.motionTrack}><i /></span><strong>Slow exploration</strong><small>{motionTokens.duration.float}s / floating elements</small></div>
          </div>
        </FadeUp>
        <footer className={styles.previewFooter}><span className={styles.footerBrand}>nexora.</span><p>Colorful by design. Connected by possibility.</p><span>VISUAL FOUNDATION / 02</span></footer>
      </Container>
    </Section>
  );
}

