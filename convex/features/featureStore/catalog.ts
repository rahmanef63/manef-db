export type FeatureStoreSeedItem = {
    itemKey: string;
    slug: string;
    name: string;
    description?: string;
    itemType: "workspace-app" | "agent-builder" | "shared-block-set" | "template" | "external-app";
    builderMode?: "json_blocks" | "custom_code";
    scope: "workspace-local" | "workspace-shared" | "general/shared" | "tenant-shared";
    status: "draft" | "planned" | "ready";
    source: "seed";
    icon?: string;
    tags?: string[];
    config?: Record<string, unknown>;
    preview?: {
        headline?: string;
        summary?: string;
        bullets?: string[];
        accent?: string;
        previewType?: "card" | "builder" | "template";
        config?: Record<string, unknown>;
    };
};

export const FEATURE_STORE_SEED: FeatureStoreSeedItem[] = [
    {
        itemKey: "agent-builder-json-blocks",
        slug: "agent-builder-json-blocks",
        name: "Agent Builder (JSON Blocks)",
        description: "Compose workspace apps and agents from reusable block schemas.",
        itemType: "agent-builder",
        builderMode: "json_blocks",
        scope: "workspace-local",
        status: "ready",
        source: "seed",
        icon: "Blocks",
        tags: ["agent-builder", "blocks", "workspace"],
        config: {
            downstreamTarget: "superspace",
            supportsOpenClawBindings: true,
        },
        preview: {
            headline: "Compose apps from predefined blocks",
            summary: "Use existing UI blocks as SSOT and render workspace-scoped apps without hand-coding the full shell first.",
            bullets: [
                "Workspace-aware install target",
                "OpenClaw bindings can be attached later",
                "Best starting point for repeatable app generation",
            ],
            accent: "bg-emerald-500/10 text-emerald-700",
            previewType: "builder",
        },
    },
    {
        itemKey: "agent-builder-custom-code",
        slug: "agent-builder-custom-code",
        name: "Agent Builder (Custom Code)",
        description: "Advanced builder mode for custom HTML or TypeScript output.",
        itemType: "agent-builder",
        builderMode: "custom_code",
        scope: "workspace-local",
        status: "draft",
        source: "seed",
        icon: "Code2",
        tags: ["agent-builder", "custom-code", "advanced"],
        config: {
            requiresReview: true,
            downstreamTarget: "superspace",
        },
        preview: {
            headline: "Advanced mode for custom builders",
            summary: "Keep this mode behind stronger review because it can generate code outside the safe block schema.",
            bullets: [
                "HTML/TypeScript output",
                "Sandbox and review metadata required",
                "Best for advanced workspace apps",
            ],
            accent: "bg-amber-500/10 text-amber-700",
            previewType: "builder",
        },
    },
    {
        itemKey: "workspace-app-shell",
        slug: "workspace-app-shell",
        name: "Workspace App Shell",
        description: "Starter app shell for a workspace-scoped webapp with isolated agents and channels.",
        itemType: "workspace-app",
        scope: "workspace-local",
        status: "planned",
        source: "seed",
        icon: "AppWindow",
        tags: ["workspace-app", "starter", "shell"],
        config: {
            recommendedBuilder: "agent-builder-json-blocks",
        },
        preview: {
            headline: "Start from an isolated workspace shell",
            summary: "Provides the base container for future apps installed into a single workspace or sub-workspace.",
            bullets: [
                "Isolated workspace context",
                "Ready for channel and agent bindings",
                "Good target for Superspace publishing",
            ],
            accent: "bg-sky-500/10 text-sky-700",
            previewType: "card",
        },
    },
    {
        itemKey: "shared-openclaw-blocks",
        slug: "shared-openclaw-blocks",
        name: "Shared OpenClaw Blocks",
        description: "Reusable block bundle for OpenClaw-aware dashboards and controls.",
        itemType: "shared-block-set",
        scope: "general/shared",
        status: "ready",
        source: "seed",
        icon: "Package2",
        tags: ["shared", "blocks", "openclaw"],
        preview: {
            headline: "Reusable blocks for OpenClaw-aware apps",
            summary: "Use these components as the visual SSOT for JSON block prerender mode.",
            bullets: [
                "Shared across workspaces",
                "Feeds Agent Builder JSON mode",
                "Not tied to a single tenant",
            ],
            accent: "bg-violet-500/10 text-violet-700",
            previewType: "card",
        },
    },
    {
        itemKey: "workspace-template-openclaw-ops",
        slug: "workspace-template-openclaw-ops",
        name: "OpenClaw Ops Template",
        description: "Starter template for operations workspaces with logs, sessions, channels, and control panels.",
        itemType: "template",
        scope: "workspace-shared",
        status: "draft",
        source: "seed",
        icon: "LayoutTemplate",
        tags: ["template", "operations", "workspace"],
        preview: {
            headline: "Template for operational workspaces",
            summary: "Use this as a baseline for workspace apps focused on runtime operations and oversight.",
            bullets: [
                "Designed for root or child workspaces",
                "Can be shared across a tenant",
                "Good baseline before custom builder work",
            ],
            accent: "bg-orange-500/10 text-orange-700",
            previewType: "template",
        },
    },
    {
        itemKey: "superspace-publisher",
        slug: "superspace-publisher",
        name: "Superspace Publisher",
        description: "Prepare workspace apps for downstream publishing into Superspace.",
        itemType: "external-app",
        scope: "tenant-shared",
        status: "planned",
        source: "seed",
        icon: "Rocket",
        tags: ["superspace", "publish", "external"],
        config: {
            targetRepo: "rahmanef63/superspace",
        },
        preview: {
            headline: "Bridge generated apps to Superspace",
            summary: "Publish contract target for workspace apps once builder output is stable.",
            bullets: [
                "Downstream target metadata",
                "Not a runtime SSOT",
                "Used after builder output is ready",
            ],
            accent: "bg-fuchsia-500/10 text-fuchsia-700",
            previewType: "card",
        },
    },
];
