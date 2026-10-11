# Skills yang harus dipakai
design-taste-frontend, design-taste-frontend-v1, gpt-taste, high-end-visual-design,
stitch-design-taste, imagegen-frontend-web, impeccable, animate, ask-sonner, break-ui,
emil-design-eng, find-animation-opportunities, improve-animations, pick-ui-library,
apply-aesthetic, data-dashboard, design-code, performance, ux-writing, ui-craft,
ui-craft-dense-dashboard, ui-ux-pro-max

Muat semua skill di atas dengan Skill tool sebelum mulai.

# Prompt
# AVONERA48
# MASTER PROJECT IMPLEMENTATION PROMPT
# FULL-STACK DEVELOPER PLATFORM
# JKT48CONNECT-INSPIRED PRODUCT
# ORIGINAL 3D CYBER FUTURISM
# DUMMY DATA FIRST
# CLOUDFLARE WORKERS
# MAIN BRANCH ONLY

============================================================
01. ROLE AND MISSION
============================================================

You are the Principal Software Engineer, Senior Full-Stack Developer,
Software Architect, Creative Developer, UI/UX Designer, 3D Web Engineer,
Motion Designer, Security Engineer, and Cloudflare Workers Specialist
responsible for the AVONERA48 project.

Your task is to inspect, understand, redesign, and implement AVONERA48 as a
complete, visually distinctive, functional developer platform.

This is not a simple landing page redesign.

Do not merely change colors, add rounded cards, apply gradients, or introduce
generic animations.

You must develop the website as a coherent digital product with:

- A distinctive product identity.
- A complete and consistent UI/UX system.
- A sophisticated 3D cyber-futuristic visual direction.
- A meaningful public website.
- A developer portal.
- A functional-looking dashboard powered by structured dummy data.
- Complete navigation and user interaction.
- Responsive layouts.
- Carefully designed animation.
- Strong accessibility.
- Maintainable frontend architecture.
- Cloudflare Workers compatibility.
- A clear path toward future API and backend integration.

IMPORTANT PROJECT PHASE:

The current priority is UI/UX development.

Use realistic, structured dummy data for the interface and dashboard.

API usage documentation will be developed later.

Do not spend this phase writing comprehensive API usage documentation.

Do not build unnecessary production integrations just to make the current
dashboard look populated.

However, do not create a careless collection of static screenshots or
non-interactive mockups.

The UI must work as a real interactive frontend, with coherent navigation,
functional controls, realistic states, and a data architecture that can later
be connected to actual APIs and services.

Keep the existing Cloudflare Workers deployment architecture.

All Git work must remain on the existing main branch.

Do not create additional branches.

============================================================
02. PRODUCT IDENTITY
============================================================

Product name:
AVONERA48

Product category:
JKT48 data platform and developer ecosystem.

Product direction:
A developer-oriented platform that offers a product experience and broad
functional categories similar to JKT48Connect, while maintaining an entirely
original AVONERA48 identity.

Reference websites:

JKT48Connect main website:
https://jkt48connect.com

JKT48Connect API documentation:
https://docs.jkt48connect.com

JKT48Connect feature documentation:
https://docs.jkt48connect.com/features

JKT48Connect introduction:
https://docs.jkt48connect.com/about

JKT48Connect partner documentation:
https://jkt48connect.com/partner/docs

JKT48Connect developer dashboard:
https://jkt48connect.com/dev/dashboard

Use these references to understand the general product category, types of
services, developer experience, platform structure, and relevant functionality.

Inspect the publicly accessible references before making assumptions about
the product.

If a reference page cannot be accessed, continue using available information
without inventing its contents.

Do not copy JKT48Connect's source code, branding, assets, text, or complete
visual composition.

The objective is to build a platform with a similar product purpose, not a
visual clone.

AVONERA48 should feel like a separate product created with its own design
language and engineering decisions.

============================================================
03. MANDATORY WORKING PRINCIPLES
============================================================

Before making any changes:

1. Inspect the complete repository structure.
2. Read the existing project documentation.
3. Inspect package.json and the dependency lockfile.
4. Identify the current framework and programming language.
5. Inspect the routing architecture.
6. Inspect all relevant pages and components.
7. Inspect existing styles and design tokens.
8. Inspect authentication and authorization.
9. Inspect existing backend and API integrations.
10. Inspect the database schema if present.
11. Inspect Cloudflare configuration.
12. Inspect Wrangler configuration.
13. Inspect available build, lint, and test scripts.
14. Inspect existing assets, logos, fonts, and visual resources.
15. Inspect Git status and the current branch.

Understand the existing implementation before making architectural decisions.

Do not replace a working framework simply because you prefer another one.

Do not delete working functionality to simplify the redesign.

Do not overwrite unrelated user changes.

Do not introduce unnecessary dependencies.

Do not invent missing product requirements when the repository can clarify them.

After the initial audit, create a concise implementation plan internally and
then proceed directly to implementation.

Do not stop after producing a plan.

Do not merely describe what should be built.

Implement the actual UI, components, interactions, responsive behavior, and
supporting code.

============================================================
04. DEVELOPMENT PHASE AND SCOPE
============================================================

The current phase is:

UI/UX FIRST, DUMMY DATA FIRST, API DOCUMENTATION LATER.

This distinction must guide every implementation decision.

PRIORITY A: UI AND DESIGN SYSTEM

Build the overall visual identity, typography, colors, layouts, navigation,
components, animations, responsive behavior, and interaction patterns.

PRIORITY B: PUBLIC WEBSITE

Implement the homepage, product sections, feature presentation, and navigation
to relevant platform areas.

PRIORITY C: DEVELOPER DASHBOARD

Build the dashboard interface, API key management screens, usage analytics,
request history, account settings, status information, and other relevant
developer-facing interfaces.

Use structured dummy data for these interfaces.

PRIORITY D: FUNCTIONAL INTERACTIONS

Buttons, tabs, dialogs, dropdowns, filters, search, navigation, copy actions,
and other visible controls must behave coherently.

PRIORITY E: FRONTEND ARCHITECTURE

Organize dummy data, UI components, state management, and service interfaces
so real API integration can be introduced later without rewriting the entire
application.

PRIORITY F: QUALITY

Verify responsiveness, accessibility, performance, build compatibility, and
Cloudflare Workers configuration.

DEFERRED WORK:

- Comprehensive API usage documentation.
- Complete endpoint reference documentation.
- Detailed API integration tutorials.
- Full SDK documentation.
- Production integration with every potential external data source.
- Production analytics infrastructure if it does not already exist.
- Real payment integration unless the existing product explicitly requires it.

Do not allow deferred work to distract from the current UI/UX objective.

If the existing repository already contains working API functionality, do not
remove it merely because the current UI uses dummy data.

Preserve existing functionality and separate the current presentation layer
from future production integrations.

============================================================
05. DUMMY DATA POLICY
============================================================

Use realistic and consistently structured dummy data throughout the UI.

The purpose is to create a convincing preview of the complete product before
the production API and data integrations are finalized.

Dummy data must be centralized.

Do not scatter arbitrary hardcoded values throughout individual components.

Create an organized mock-data layer appropriate to the existing architecture.

Possible organization:

- mock members.
- mock theater schedules.
- mock live streams.
- mock news.
- mock events.
- mock API keys.
- mock API requests.
- mock usage analytics.
- mock rate-limit information.
- mock account information.
- mock announcements.
- mock service status.
- mock changelog entries.

Use only categories relevant to the actual product.

Every mock dataset should have a consistent schema.

For example, a member record could contain:

- id.
- name.
- generation.
- profile image.
- birthday.
- social links.
- status.
- relevant metadata.

A theater schedule record could contain:

- id.
- show name.
- date.
- time.
- lineup.
- setlist.
- status.

An API key record could contain:

- id.
- name.
- masked key.
- created date.
- last used date.
- status.
- usage count.

A request history record could contain:

- id.
- timestamp.
- endpoint.
- HTTP method.
- status code.
- response duration.

These are examples of data structures, not claims that all fields must exist
in the production API.

Use stable identifiers and consistent relationships between datasets.

Ensure that related screens display consistent information.

For example, a member shown in a member list should have matching details
when the user opens that member's detail view.

A dashboard summary should derive from the same mock request dataset used by
the request history and analytics charts wherever appropriate.

Do not generate unrelated random values on every render.

Avoid fake statistics that change arbitrarily.

If mock data is used to simulate a chart, make it deterministic.

Use a clearly defined mock-data source and make the transition to a real API
straightforward.

IMPORTANT:

Dummy data is acceptable for the current UI phase.

However, never present dummy information as verified live production data.

Use an appropriate indicator when necessary, such as:

"Preview data"
"Demo environment"
"Sample activity"

Keep the indicator visually subtle and professional.

Do not clutter every component with disclaimers.

Never fabricate real partnerships, testimonials, official endorsements,
verified user counts, uptime guarantees, or production usage metrics.

Do not use private or sensitive real-user information as mock data.

============================================================
06. FUTURE-PROOF FRONTEND ARCHITECTURE
============================================================

The current implementation must use dummy data without becoming dependent
on dummy data throughout the component tree.

Separate presentation from data access.

If the existing architecture supports it, create a structure similar to:

src/
  components/
  features/
  layouts/
  pages/
  routes/
  hooks/
  services/
  data/
    mock/
  types/
  utils/
  styles/

This is a conceptual example.

Follow the actual repository structure rather than forcing these exact
directories onto an incompatible architecture.

Where appropriate, create:

- Typed data models.
- Mock data providers.
- Service interfaces.
- Reusable hooks.
- Loading state definitions.
- Error state definitions.
- Empty state definitions.
- Shared UI components.

For example, components should consume a well-defined data interface rather
than importing arbitrary mock arrays from unrelated files.

A future production API adapter should be able to replace the mock adapter
with minimal changes to presentation components.

Do not overengineer this abstraction.

Build only the architecture that provides a real maintainability benefit.

If TypeScript is already used, define suitable types for the mock datasets
and component props.

Avoid using any as a shortcut when meaningful types can be defined.

============================================================
07. ART DIRECTION: DIGITAL FRONTIER
============================================================

The visual identity of AVONERA48 must be built around the concept:

DIGITAL FRONTIER

This direction combines:

- 3D cyber futurism.
- Premium developer-product aesthetics.
- Experimental editorial composition.
- Metallic materials.
- Spatial geometry.
- Technical precision.
- Strong typography.
- Controlled motion.
- Deep visual hierarchy.
- Architectural negative space.

The result should feel like a sophisticated digital infrastructure platform.

It should not look like a generic AI-generated SaaS template.

Avoid the default combination of a black background, purple gradient,
rounded cards, and glowing buttons.

Futurism must come from the complete art direction.

Consider the relationship between:

- Shape.
- Scale.
- Perspective.
- Material.
- Lighting.
- Typography.
- Negative space.
- Motion.
- Interaction.
- Content hierarchy.

The design should feel intentional at every level.

Do not make every component visually complex.

Use expressive visuals for key brand moments and maintain clarity throughout
the actual product interface.

============================================================
08. COLOR SYSTEM
============================================================

Inspect the existing logo and brand assets first.

If no established palette exists, use this palette as an initial direction:

Primary background:
#08090D

Secondary background:
#0D1016

Primary surface:
#121720

Elevated surface:
#191F2A

Primary text:
#F3F5F8

Secondary text:
#A5ADBA

Muted text:
#747E8D

Metallic silver:
#C8CED8

Electric violet:
#8B5CF6

Cyan accent:
#65E7F5

Subtle border:
rgba(210, 220, 235, 0.12)

Subtle highlight:
rgba(255, 255, 255, 0.08)

Use a centralized token system.

Define:

- Colors.
- Typography.
- Spacing.
- Radius.
- Shadows.
- Borders.
- Z-index layers.
- Motion durations.
- Easing curves.
- Layout widths.
- Breakpoints.

Do not scatter arbitrary color values throughout the codebase.

Use the accent colors strategically.

Avoid excessive neon.

Do not apply gradients to every section.

Gradients may be used for specific lighting or material effects when they
improve the composition.

============================================================
09. TYPOGRAPHY
============================================================

Typography is a core component of the AVONERA48 identity.

Create a consistent hierarchy for:

- Display typography.
- Page titles.
- Section titles.
- Body text.
- Navigation.
- Technical labels.
- Metadata.
- Numerical displays.
- Code snippets.

Use strong typographic contrast without compromising readability.

Explore:

- Oversized editorial headlines.
- Asymmetric line breaks.
- Controlled letter spacing.
- Compact technical labels.
- Large numeric elements.
- Carefully balanced negative space.
- Headline compositions that interact with the 3D visual.

Avoid excessive uppercase text.

Avoid decorative fonts that make technical content difficult to read.

Ensure all fonts have appropriate licensing and fallback behavior.

Optimize font loading to avoid unnecessary layout shifts.

============================================================
10. SIGNATURE HERO: THE A48 CORE
============================================================

Create an original hero experience called:

THE A48 CORE

This is the visual signature of AVONERA48.

Do not use a generic centered heading with two buttons and a gradient
background.

Design a distinctive composition using:

- An original 3D object.
- Large editorial typography.
- Carefully placed technical metadata.
- A short product description.
- A primary CTA.
- A secondary CTA when relevant.
- Negative space.
- Controlled motion.

Explore an abstract metallic structure inspired by engineered geometry.

Potential visual elements include:

- Interlocking metal rings.
- Asymmetric geometric assemblies.
- Layered mechanical structures.
- Sculptural forms.
- Modular geometry.
- Abstract A48-inspired shapes.

Do not use generic robots, skulls, unrelated floating cubes, or random
particles as the main visual identity.

The 3D object must have a recognizable silhouette and consistent material
language.

It should appear designed specifically for the AVONERA48 brand.

Possible hero composition:

- A large 3D structure positioned off-center.
- A bold headline occupying the opposite side.
- Small technical labels framing the composition.
- Controlled perspective and depth.
- A restrained CTA area.
- A subtle transition into the next section.

Treat this as a starting point, not a rigid template.

Find the strongest composition for the actual logo, layout, and content.

The hero should communicate what the product does.

Do not use generic slogans such as:

"The Future Is Here"
"Redefining Innovation"
"Next Generation Technology"
"Beyond The Limit"

Write concise copy that explains AVONERA48's purpose.

Do not invent operational capabilities.

Ensure the hero remains readable and usable on mobile.

============================================================
11. 3D IMPLEMENTATION
============================================================

Inspect the existing stack before selecting a 3D library.

If the project uses React and needs a complex 3D scene, evaluate:

- Three.js.
- React Three Fiber.
- Drei when useful.
- Custom shaders when justified.

References:

https://threejs.org/docs/
https://r3f.docs.pmnd.rs/

Use CSS 3D, SVG, or Canvas if they provide a more appropriate solution for
simpler visual elements.

Do not add a 3D library simply for decoration.

For WebGL scenes:

- Keep the scene modular.
- Use efficient geometry.
- Limit unnecessary draw calls.
- Avoid excessive polygon counts.
- Reuse materials when appropriate.
- Limit expensive shadows.
- Avoid unnecessary post-processing.
- Optimize textures.
- Dispose GPU resources correctly.
- Clean up event listeners.
- Avoid duplicate animation loops.
- Avoid unnecessary React renders on every frame.
- Consider device pixel ratio.
- Reduce rendering cost on mobile.
- Respect reduced-motion settings.
- Pause or reduce rendering when the scene is not visible.
- Provide a fallback when WebGL is unavailable.

The 3D scene must not block access to important content.

If the scene fails, the page must remain usable.

============================================================
12. INTRO EXPERIENCE
============================================================

Create a brief initialization sequence only if it improves the overall
experience.

Target duration:
Approximately 0.8 to 1.8 seconds.

Potential sequence:

1. Reveal the primary geometry.
2. Introduce the AVONERA48 wordmark.
3. Reveal the hero headline.
4. Settle into the final composition.

Do not create fake loading percentages.

Do not simulate a system boot process that has no technical meaning.

Do not force users to wait for a decorative animation.

Do not replay the entire intro every time a user changes routes.

Do not use excessive glitching, flashing, or aggressive transitions.

Respect prefers-reduced-motion.

Ensure keyboard navigation and user interaction remain available.

============================================================
13. MOTION DESIGN SYSTEM
============================================================

Create a consistent motion system.

Define appropriate patterns for:

- Button interactions.
- Navigation.
- Dropdowns.
- Tabs.
- Dialogs.
- Content reveals.
- Hero animation.
- 3D interaction.
- Page transitions.
- Loading indicators.
- Toast notifications.
- Chart transitions.

Do not animate everything.

Motion should communicate hierarchy, feedback, or spatial relationships.

Use CSS for simple transitions.

Consider GSAP for complex timelines when justified.

Documentation:
https://gsap.com/docs/v3/

Do not introduce overlapping animation libraries without a clear reason.

Use restrained durations and easing.

Avoid animations that interfere with reading or clicking.

Avoid excessive scroll-triggered animation.

Ensure animation cleanup follows the framework lifecycle.

============================================================
14. FOOTER: THE AFTERIMAGE
============================================================

Design a distinctive footer called:

THE AFTERIMAGE

The footer must be an intentional visual conclusion rather than a standard
collection of links placed at the bottom.

Reuse or reinterpret the visual language of the hero.

Possible elements:

- Oversized AVONERA48 wordmark.
- A transformed version of the hero's 3D structure.
- Different framing or lighting.
- Strong typographic contrast.
- Technical metadata.
- Carefully organized navigation.
- Documentation links.
- Developer dashboard links.
- Service status.
- Changelog.
- Support.
- Legal information.
- Real social links when available.

Do not duplicate the hero exactly.

Do not create fake social accounts.

Do not invent statistics.

Ensure the footer remains easy to navigate.

Keep its mobile layout efficient.

If the footer contains WebGL, reduce or pause rendering when the scene is
outside the viewport.

============================================================
15. WEBSITE STRUCTURE
============================================================

Audit the existing routes before creating new pages.

Preserve existing public URLs when possible.

Do not remove working routes without a clear reason.

Create or improve the following areas where appropriate.

A. PUBLIC WEBSITE

- Homepage.
- Product overview.
- Features.
- Services.
- Platform information.
- Getting started.
- Changelog.
- Announcements.
- Service status.
- Support.
- Privacy policy.
- Terms of service.

B. DEVELOPER PORTAL

- Developer overview.
- Dashboard.
- API key management.
- API usage.
- Request history.
- Account settings.
- Service status.
- Changelog.
- Support.

C. AUTHENTICATION

If the application supports accounts:

- Login.
- Registration if appropriate.
- Logout.
- Account recovery if supported.
- Protected routes.
- Session expiration handling.
- Unauthorized and forbidden states.

D. ADMINISTRATION

If the product requires administrative tools:

- User management.
- API key administration.
- Announcement management.
- Changelog management.
- Operational overview.
- Service configuration.
- Audit logs.

Only implement areas that fit the actual product.

Do not add unnecessary pages merely to increase the page count.

Do not implement production administrative functionality using insecure
client-side checks.

============================================================
16. HOMEPAGE
============================================================

Build a polished homepage that communicates the product clearly.

Potential structure:

1. Navigation.
2. Signature 3D hero.
3. Product introduction.
4. Core capabilities.
5. JKT48 data categories.
6. API request preview.
7. Developer workflow.
8. Dashboard preview.
9. Documentation or getting-started CTA.
10. Latest announcements if available.
11. Signature footer.

The page should explain:

- What AVONERA48 is.
- What the platform offers.
- Who can use it.
- What developers can build.
- How to access the platform.

Use realistic dummy data for interface previews.

If a dashboard preview displays requests, keys, charts, or member information,
ensure the preview uses consistent datasets.

Do not invent actual user counts, real uptime, partner endorsements, or
production metrics.

Use clear labels when displaying demo-only information.

Do not make the homepage unnecessarily long.

Each section must have a clear purpose.

============================================================
17. DEVELOPER DASHBOARD
============================================================

The developer dashboard is one of the primary UI priorities.

Build a polished, functional interface using dummy data.

Potential navigation:

- Overview.
- API Keys.
- Usage Analytics.
- Request History.
- Service Status.
- Changelog.
- Account Settings.

Adapt this structure to the actual product and existing routes.

A. OVERVIEW

Display useful information such as:

- Total requests.
- Successful requests.
- Failed requests.
- Average response time.
- Active API keys.
- Recent activity.
- Usage chart.
- Service status.

All metrics must derive from deterministic mock data.

Do not use random values that change on each render.

If the metrics are demo-only, make that clear where appropriate.

B. API KEYS

Create an interface for:

- Viewing keys.
- Creating a mock key.
- Naming a key.
- Revealing or masking a mock secret.
- Copying a mock key.
- Revoking a mock key.
- Viewing creation date.
- Viewing last-used date.
- Viewing status.

These interactions may operate on local mock state during this phase.

Provide realistic confirmation dialogs and feedback.

Do not generate or persist real production credentials as part of a mock
interaction.

Clearly distinguish demo behavior from actual backend operations.

C. USAGE ANALYTICS

Create charts using deterministic mock data.

Potential visualizations:

- Requests over time.
- Success versus failure.
- Usage by endpoint.
- Response time.
- Request distribution.

Use a chart library only if it is justified by the existing architecture.

Do not make charts purely decorative.

Add useful labels, legends, and tooltips.

Ensure charts work on mobile.

D. REQUEST HISTORY

Display realistic sample records.

Include:

- Timestamp.
- HTTP method.
- Endpoint.
- Status.
- Response duration.

If filtering and pagination are implemented, ensure they actually operate
on the local dataset.

E. SETTINGS

Implement coherent frontend interactions for account preferences that are
appropriate to the current mock-data phase.

Do not claim settings have been saved to a production account when only local
state has changed.

F. SERVICE STATUS

Display a structured demo status view.

Use an appropriate visual indicator that the displayed status is sample data.

Do not present the status as real operational monitoring.

============================================================
18. MEMBER AND THEATER INTERFACES
============================================================

Because AVONERA48 belongs to the JKT48 data-platform category, evaluate
whether member and theater data should be represented in the current public
website or dashboard.

Where appropriate, create UI previews for:

- Member directory.
- Member details.
- Generations.
- Theater schedule.
- Show details.
- Live stream listings.
- News.
- Events.
- Birthdays.

Use consistent dummy data.

Do not require a real API connection during this phase.

Do not scrape external websites simply to populate the initial UI.

Do not invent actual live-stream status, theater schedules, or current member
information and present it as verified.

If an example uses recognizable public JKT48 entities, avoid presenting
fabricated personal details as factual information.

Clearly distinguish sample data from current real-world data.

The goal is to demonstrate the product's interface and data structure.

============================================================
19. API DOCUMENTATION IS DEFERRED
============================================================

API usage documentation will be created in a later development phase.

For the current phase:

DO NOT prioritize comprehensive API documentation.

DO NOT spend substantial time writing:

- Complete endpoint reference documentation.
- Long authentication tutorials.
- Full API integration guides.
- SDK usage manuals.
- Detailed production API examples.
- Extensive developer tutorials.

However, the interface may include a documentation navigation item or a
documentation page placeholder if the existing site structure requires it.

If a documentation destination does not exist yet, handle the destination
gracefully.

Do not create broken links.

Do not invent a complete API specification merely to populate a documentation
page.

If an existing API documentation page already works, preserve it.

The current priority is the website UI, dashboard, design system, interaction
quality, and frontend architecture.

Prepare the code so documentation can be implemented later without major
structural changes.

============================================================
20. INTERACTION REQUIREMENTS
============================================================

Every visible interactive element must behave coherently.

Check:

- Navigation links.
- Mobile navigation.
- Buttons.
- Tabs.
- Dropdowns.
- Dialogs.
- Search.
- Filters.
- Pagination.
- Copy actions.
- Tooltips.
- Form inputs.
- Form validation.
- Toast notifications.
- Mock key creation.
- Mock key revocation.
- Dashboard filters.
- Chart tooltips.
- Settings toggles.
- Theme controls if present.
- Back navigation.
- Route transitions.

Do not leave dead buttons.

If an action is intentionally unavailable in the current phase, either disable
it appropriately or provide a clear explanation.

Do not make every interaction display the same generic toast.

Provide contextual feedback.

Use local mock state where suitable.

Keep state consistent across components.

Prevent accidental double submission.

Do not claim a production operation succeeded if only a mock state changed.

============================================================
21. COMPONENT SYSTEM
============================================================

Build or improve a consistent component system.

Possible shared components include:

- Button.
- Icon button.
- Input.
- Textarea.
- Select.
- Checkbox.
- Switch.
- Tabs.
- Dialog.
- Drawer.
- Dropdown.
- Tooltip.
- Toast.
- Alert.
- Badge.
- Status indicator.
- Card.
- Table.
- Pagination.
- Breadcrumb.
- Skeleton.
- Empty state.
- Error state.
- Loading state.
- Copy button.
- Navigation.
- Footer.
- Chart containers.
- Code preview.

Use the existing component library if one is already installed and appropriate.

Do not install multiple libraries with overlapping responsibilities.

Define coherent states for reusable components:

- Default.
- Hover.
- Focus.
- Active.
- Disabled.
- Loading.
- Error.
- Success when applicable.

Do not overengineer simple components.

Do not create giant components that handle the entire application.

Keep components understandable and maintainable.

============================================================
22. CLOUDFARE WORKERS: NON-NEGOTIABLE
============================================================

AVONERA48 must continue to run on Cloudflare Workers.

This is a mandatory architectural requirement.

DO NOT migrate the application to:

- A conventional VPS server.
- A standalone Node.js server.
- Express hosted on a traditional server.
- Vercel as a replacement deployment platform.
- Netlify as a replacement deployment platform.
- Another hosting runtime that replaces the existing Workers deployment.

Before changing anything, inspect:

- wrangler.toml.
- wrangler.jsonc.
- package.json.
- Worker entry point.
- Build configuration.
- Existing deployment scripts.
- Runtime compatibility settings.
- Compatibility date.
- Compatibility flags.
- Environment bindings.
- Routes.
- Custom domains.
- Static asset configuration.
- Database configuration.
- R2 bindings.
- D1 bindings.
- Durable Objects.
- Existing deployment workflow.

Do not assume every listed service is in use.

Preserve the actual existing architecture.

A. WORKER COMPATIBILITY

All server-side code must be compatible with the configured Cloudflare
Workers runtime.

Do not assume traditional Node.js APIs are universally available.

Verify compatibility before introducing dependencies.

Do not introduce native modules that cannot run in the target runtime.

Do not change compatibility settings without a clear technical reason.

B. BUILD

Ensure the existing production build remains compatible with Workers.

Preserve the current build toolchain when possible.

If configuration changes are required, make the smallest justified changes.

C. BINDINGS

Preserve existing binding names and configuration.

Do not rename a production binding without updating all dependent code and
deployment configuration.

D. DATABASE

Keep the existing database architecture.

If D1 is used, preserve its binding, schema, and migration workflow.

Do not reset a production database.

Do not create unnecessary new infrastructure.

E. ENVIRONMENT VARIABLES

Never commit secrets.

Do not expose server-side credentials to the client.

Document required environment variables without revealing secret values.

F. DEPLOYMENT

Maintain the existing Cloudflare Workers deployment process.

Do not claim the application is deployed unless deployment has actually
succeeded.

If deployment requires credentials or permissions that are unavailable,
complete the safe local implementation and report the blocker precisely.

Do not deploy to an ambiguous or unrelated production target.

============================================================
23. SECURITY AND DATA BOUNDARIES
============================================================

Even though the current phase uses dummy data, preserve the separation between
public UI, private user data, and server-side operations.

Inspect existing authentication and authorization.

Do not remove existing protections.

Do not expose secrets in client code.

Do not store production credentials in mock datasets.

Do not use real private user data as dummy content.

If account or API key interfaces are mock-only, keep their behavior clearly
separate from production backend operations.

Prepare the frontend architecture for future authenticated API integration.

Do not add fake security claims.

Do not claim the application is secure merely because it uses Cloudflare.

============================================================
24. PERFORMANCE
============================================================

The visual experience must remain responsive.

Optimize:

- JavaScript bundle size.
- Route-level code splitting.
- Image loading.
- Font loading.
- React rendering.
- Hydration where applicable.
- 3D rendering.
- GPU usage.
- Memory management.
- Animation loops.
- Network requests.

Avoid unnecessary libraries.

Lazy-load expensive visual sections when appropriate.

Do not load a large 3D scene before it is needed.

Reduce rendering cost on mobile.

Respect reduced motion.

Pause decorative rendering when the scene is outside the viewport where
practical.

Do not sacrifice essential product functionality to improve a benchmark.

Do not claim measured performance results without running measurements.

============================================================
25. RESPONSIVE DESIGN
============================================================

Design for:

- Small mobile screens.
- Modern mobile devices.
- Tablets.
- Laptops.
- Desktop monitors.
- Large displays.

Do not simply shrink the desktop layout.

Create intentional mobile compositions.

Check:

- Horizontal overflow.
- Typography wrapping.
- Button sizes.
- Navigation.
- Tables.
- Dialog positioning.
- Chart dimensions.
- Footer layout.
- Hero composition.
- 3D object scale.
- Touch targets.
- Keyboard navigation.
- Safe areas where relevant.

Ensure that mobile users can access the same essential product functionality.

Do not make any essential action dependent on hover.

============================================================
26. ACCESSIBILITY
============================================================

Implement:

- Semantic HTML.
- Proper heading hierarchy.
- Keyboard navigation.
- Visible focus indicators.
- Accessible form labels.
- Clear error messages.
- Appropriate color contrast.
- Reduced-motion support.
- Accessible dialogs.
- Proper button and link semantics.
- Screen-reader-friendly status indicators.
- Meaningful alternative text.
- Appropriate table semantics.

Decorative 3D elements should not interfere with assistive technologies.

Ensure status is not communicated only through color.

Do not introduce inaccessible custom controls when native elements are
sufficient.

============================================================
27. ANTI AI-SLOP REQUIREMENTS
============================================================

Avoid the following design patterns unless there is a strong, specific
reason for using them:

- Generic purple-blue gradient backgrounds.
- Excessive glassmorphism.
- Floating random spheres.
- Decorative particle fields without purpose.
- Identical cards repeated throughout every page.
- Oversized rounded rectangles everywhere.
- Neon glow on every element.
- Generic stock 3D objects.
- Unrelated cyberpunk imagery.
- Fake dashboard metrics.
- Fake customer logos.
- Fake testimonials.
- Fake operational statistics.
- Generic marketing slogans.
- Excessive uppercase labels.
- Unnecessary scroll animations.
- Loading screens that delay content.
- Decorative elements that reduce readability.
- Overly complicated navigation.
- Visual complexity without information hierarchy.

Every significant visual element must serve at least one purpose:

- Brand identity.
- Information hierarchy.
- Navigation.
- Interaction feedback.
- Product explanation.
- Spatial composition.
- Data visualization.

Prefer a few exceptional visual decisions over dozens of unrelated effects.

The website should feel art-directed, not auto-generated.

============================================================
28. IMPLEMENTATION WORKFLOW
============================================================

PHASE 1: AUDIT

Inspect the repository, architecture, current features, Cloudflare configuration,
design assets, routes, and Git status.

PHASE 2: DESIGN FOUNDATION

Create or refine:

- Design tokens.
- Typography.
- Colors.
- Spacing.
- Components.
- Motion system.
- Responsive rules.

PHASE 3: PUBLIC WEBSITE

Implement the homepage, navigation, product sections, and signature footer.

PHASE 4: DASHBOARD

Implement dashboard layouts, navigation, overview, API key interfaces,
analytics, request history, settings, and other relevant screens using
structured dummy data.

PHASE 5: DATA ARCHITECTURE

Centralize dummy data and create appropriate typed models or interfaces.

Ensure mock data is consistent and replaceable by real API adapters later.

PHASE 6: INTERACTIONS

Implement real frontend interactions for navigation, controls, filtering,
dialogs, copying, mock key management, and other visible actions.

PHASE 7: 3D AND MOTION

Implement the hero experience, intro if appropriate, signature footer, and
motion system.

Optimize for performance and mobile behavior.

PHASE 8: QUALITY ASSURANCE

Run build, lint, type checks, tests, and visual verification as available.

Fix issues caused by the implementation.

PHASE 9: CLOUDFLARE VERIFICATION

Verify that the project remains compatible with the existing Cloudflare
Workers deployment configuration.

PHASE 10: GIT

Review all changes, commit to main if safe and authorized, and push to
origin/main if permitted.

PHASE 11: FINAL REPORT

Report what was implemented, what was tested, whether the build passed,
whether the Cloudflare configuration remains compatible, and whether the
commit and push succeeded.

Do not stop after creating a plan.

Do not stop after implementing the homepage.

Complete the highest-priority implementation across the product.

============================================================
29. GIT: MAIN BRANCH ONLY
============================================================

THIS IS A STRICT REQUIREMENT.

All work must remain on the existing main branch.

Rules:

1. Inspect git status before editing.
2. Verify the current branch.
3. Work only on main.
4. Never create a new branch.
5. Never switch to another branch.
6. Never force-push.
7. Never rewrite Git history.
8. Never use git reset --hard.
9. Never discard uncommitted user changes.
10. Never overwrite unrelated work.
11. Never commit secrets.
12. Review git diff before committing.
13. Commit only the intended changes.
14. Push to origin/main when authorized and safe.
15. Verify every Git operation.

If the repository is not currently on main, do not create a branch and do not
forcibly switch branches.

Inspect the current state and determine whether it is safe to proceed.

If safe continuation is not possible, preserve the working tree and report
the blocker.

If pre-existing changes exist, preserve them.

Do not accidentally include unrelated modifications in your commit.

Before committing:

- Review git status.
- Review git diff.
- Check for secrets.
- Check for accidental file deletion.
- Check for unrelated changes.
- Verify the intended files.

Use a descriptive commit message.

Before pushing, ensure the target is origin/main and that pushing is safe.

Never use force-push.

If the push is rejected due to branch protection, permissions, conflicts, or
other restrictions, do not attempt to bypass those protections.

Keep the local work safe and report the issue.

Do not claim the push succeeded unless the command confirms success.

============================================================
30. TESTING AND VERIFICATION
============================================================

Use the testing tools already available in the repository.

Run appropriate checks, including:

- Dependency verification.
- Lint.
- Type checking.
- Unit tests.
- Integration tests where available.
- Production build.
- Route verification.
- UI interaction verification.
- Responsive testing.
- Console error checks.
- Cloudflare Workers compatibility checks.

Verify important flows:

- Navigation between pages.
- Mobile navigation.
- Dashboard navigation.
- API key mock interactions.
- Filtering and searching.
- Copy actions.
- Dialog behavior.
- Form validation.
- Chart rendering.
- Empty states.
- Loading states.
- Error states.
- Footer links.
- Responsive layout.

Use browser automation or screenshots if available.

Inspect both desktop and mobile layouts.

Do not claim a test passed unless it was actually executed.

If a test cannot run because of missing credentials or unavailable external
services, report that limitation clearly.

Do not run destructive tests against production services.

============================================================
31. FINAL ACCEPTANCE CRITERIA
============================================================

The implementation is considered successful when the following conditions
are met to the extent supported by the repository and available environment.

PRODUCT:

- AVONERA48 has a clear identity as a JKT48 data and developer platform.
- The product direction is informed by JKT48Connect's general capabilities.
- The implementation remains original.
- The website contains the relevant public and developer-facing interfaces.
- API documentation remains deferred for the current phase.

DESIGN:

- The website has a distinctive visual system.
- The 3D cyber-futuristic direction is coherent.
- The hero has a recognizable identity.
- The footer is deliberately designed.
- Typography and spacing are consistent.
- The interface avoids generic AI-generated aesthetics.
- Desktop and mobile layouts are intentionally designed.

DUMMY DATA:

- Mock datasets are centralized.
- Related pages use consistent data.
- Dashboard metrics are deterministic.
- Mock interactions work.
- Dummy information is not falsely presented as verified production data.
- The architecture can support future real API integration.

FUNCTIONALITY:

- Navigation works.
- Interactive controls behave coherently.
- Dashboard pages are usable.
- Search and filtering work where implemented.
- Dialogs and forms behave correctly.
- Loading, empty, and error states are handled.
- No important button is left without behavior.

TECHNICAL QUALITY:

- Existing functionality is preserved.
- The code remains maintainable.
- Unnecessary dependencies are avoided.
- Responsive behavior is verified.
- Accessibility is considered.
- Performance is considered.
- Build and tests are checked.

DEPLOYMENT:

- Cloudflare Workers remains the target runtime.
- Existing working Cloudflare configuration is preserved.
- The build remains compatible with the deployment architecture.
- No migration to a conventional server or alternative hosting platform occurs.

GIT:

- No additional branch is created.
- All work remains on main.
- No force-push occurs.
- Existing user changes are preserved.
- The diff is reviewed.
- Commit and push results are reported accurately.

============================================================
32. FINAL REPORT FORMAT
============================================================

At the end of the implementation, provide a concise but informative report
in Indonesian.

Include:

1. Ringkasan perubahan.
2. Halaman yang berhasil dibuat atau diperbaiki.
3. Komponen dan sistem desain yang diimplementasikan.
4. Fitur dashboard yang menggunakan dummy data.
5. Interaksi yang sudah berfungsi.
6. Implementasi 3D dan motion.
7. Perubahan backend, jika memang dilakukan.
8. Status kompatibilitas Cloudflare Workers.
9. Hasil build.
10. Hasil lint dan type checking.
11. Hasil pengujian yang benar-benar dijalankan.
12. Daftar keterbatasan atau dependency yang masih dibutuhkan.
13. Konfirmasi branch Git.
14. Commit hash jika berhasil dibuat.
15. Status push ke origin/main.

Bedakan dengan jelas:

- Completed.
- Partially completed.
- Not implemented.
- Blocked by external requirements.

Jangan mengklaim keberhasilan yang tidak dapat diverifikasi.

Do not finish with a proposal for what you could do next.

Implement the project first, verify the results, and then report the actual
outcome.

============================================================
FINAL DIRECTIVE
============================================================

Build AVONERA48 as a complete, visually distinctive, interactive developer
platform inspired by the product category and capabilities of JKT48Connect.

For this phase, prioritize UI/UX and use centralized, consistent dummy data.

Defer comprehensive API usage documentation until a later phase.

Keep Cloudflare Workers as the deployment runtime.

Keep all Git work on the existing main branch.

Do not create additional branches.

Do not force-push.

Do not overwrite existing user work.

Do not stop after planning.

Do not produce only a visual prototype.

Implement the actual website, its navigation, dashboard, interactions,
responsive behavior, visual identity, and supporting architecture.

Preserve working functionality.

Test the implementation.

Verify the Cloudflare Workers configuration.

Review the final diff.

Commit and push to origin/main when safe, authorized, and permitted.

Be honest about anything that could not be completed or verified.

The goal is not merely to make AVONERA48 look futuristic.

The goal is to make it look distinctive, behave coherently, remain technically
sound, and be ready for the next stage of product development.
