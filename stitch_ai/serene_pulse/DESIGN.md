# Design System: Editorial Compassion

This design system is a high-end, bespoke framework engineered for a medical AI companion. It moves beyond the clinical coldness of traditional healthcare apps, opting instead for a "High-End Editorial" experience that feels like a premium wellness journal. 

## 1. Creative North Star: The Digital Sanctuary
The Creative North Star for this system is **"The Digital Sanctuary."** Unlike standard utility apps that prioritize rigid grids and high-contrast separation, this system uses organic layering and tonal depth to create a sense of calm. 

We break the "template" look by using **intentional asymmetry**—for instance, data visualization cards that don't always align to a hard center—and a **high-contrast typography scale** that treats medical information with the prestige of a luxury publication. The goal is to reduce cognitive load not just through simplicity, but through a "breathable" visual rhythm.

---

## 2. Colors & Tonal Depth
Our palette is rooted in nature: Sage Greens (`primary`) and Calming Blues (`secondary`). We avoid harsh blacks to prevent visual fatigue, utilizing deep charcoals (`on_surface`) for high-readability text.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through background color shifts.
*   *Implementation:* Use `surface_container_low` sections sitting on a `surface` background. The transition between these two tones is the only "divider" permitted.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers, like stacked sheets of fine, heavy-weight paper.
*   **Base:** `surface` (#f6fafe)
*   **Sectioning:** `surface_container` (#e7eff5)
*   **Interactive Cards:** `surface_container_lowest` (#ffffff) to provide a "lifted" feel.

### The "Glass & Gradient" Rule
To avoid a flat, "out-of-the-box" UI, use **Glassmorphism** for floating elements (e.g., navigation bars or quick-action overlays). Apply a semi-transparent `surface` color with a 12px–20px backdrop-blur. 
*   **Signature Texture:** Use a subtle linear gradient (from `primary` to `primary_container`) for main CTAs to give them a "living" quality that flat colors lack.

---

## 3. Typography: The Editorial Voice
We use a dual-font strategy to balance authority with accessibility.

*   **Display & Headlines (Manrope):** Chosen for its geometric clarity and modern warmth. Large scales (`display-lg` at 3.5rem) should be used for supportive greetings and key health milestones to create a "heroic" editorial feel.
*   **Body & Labels (Inter):** A workhorse for readability. For medical AI interactions, use `body-lg` (1rem) with an increased line-height (1.6x) to assist users with high cognitive load.
*   **Hierarchy as Empathy:** The massive scale difference between a `headline-lg` and `body-md` creates an immediate visual anchor, telling the user exactly where to look first without using aggressive colors.

---

## 4. Elevation & Depth
Hierarchy is achieved through **Tonal Layering**, not structural lines.

*   **The Layering Principle:** Place a `surface_container_lowest` card on top of a `surface_container_low` section. This creates a soft, natural "pop" that feels intuitive and calm.
*   **Ambient Shadows:** When a "floating" element is required, use extra-diffused shadows. 
    *   *Spec:* `offset-y: 8px`, `blur: 24px`, `color: rgba(41, 52, 58, 0.06)`. Note the use of `on_surface` (charcoal) for the shadow tint rather than pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at **20% opacity**. 100% opaque borders are strictly forbidden.

---

## 5. Components

### Friendly Chat Bubbles
*   **AI Response:** `primary_container` (#c6ebd5) with `on_primary_container` (#375948) text. Use `xl` (1.5rem) rounding on three corners and `sm` (0.25rem) on the bottom-left to create a "tail" effect.
*   **User Message:** `secondary_container` (#c8e7fb) with `on_secondary_container` (#385566).

### Prominent Action Buttons
*   **Primary:** Gradient of `primary` to `primary_dim`. Roundedness: `full`. No shadow, but a 2px "Ghost Border" of `primary_fixed` to add a premium sheen.
*   **Secondary:** `surface_container_highest` background with `on_surface` text.

### Data Visualization Cards
*   **Forbid Dividers:** Use vertical white space (Spacing `8` or `10`) to separate chart legends from the data itself.
*   **Background:** Use `surface_container_low` with a subtle `2.5` padding to "nest" the data within the screen.

### Healthcare-Specific Components
*   **The "Vitals" Chip:** Small, pill-shaped indicators using `tertiary_container` for non-urgent metrics.
*   **The "Calm Alert":** For clinical alerts, use `error_container` (#fa746f) but with a `secondary_fixed_dim` backdrop to "soften" the visual impact of a warning.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. For example, left-align a headline but right-align the supporting body copy to create a sophisticated, editorial rhythm.
*   **Do** use the Spacing Scale religiously. Consistent gaps of `6` (2rem) between sections create the "Sanctuary" feel.
*   **Do** prioritize high-contrast typography for medical instructions while keeping the UI containers low-contrast.

### Don't:
*   **Don't** use 1px solid lines. Ever. 
*   **Don't** use pure #000000 black. It is too "loud" for a compassionate companion. Use `on_surface` (#29343a).
*   **Don't** use aggressive, fast easing for animations. All transitions should follow a `cubic-bezier(0.4, 0, 0.2, 1)` "slow-in, slow-out" curve to mimic natural breathing.