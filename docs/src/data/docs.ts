// Bootstrap updates only this identity block. Content pages remain agent-owned.
const generatedIdentity = {
  name: "mycli",
  strapline: "A Go CLI shipped through npm",
  description: "Documentation for mycli, a starter Go command-line tool template with npm distribution, GitHub release automation, and an embedded ZueDocs-powered docs site.",
  repoUrl: "https://github.com/amxv/go-cli-template",
  footerText: "A starter Go CLI template with native binaries, npm installation, release automation, and docs included from day one."
} as const;

export const siteConfig = {
  name: generatedIdentity.name,
  strapline: generatedIdentity.strapline,
  description: generatedIdentity.description,
  repoUrl: generatedIdentity.repoUrl,
  accentColor: "#0369a1",
  accentColorDark: "#38bdf8",
  footerSections: [
    {
      title: generatedIdentity.name,
      text: generatedIdentity.footerText
    },
    {
      title: "What this site covers",
      text:
        "Installation, local development, command customization, release workflow, npm packaging, and docs site maintenance."
    },
    {
      title: "Repository",
      linkPrefix: "Source: ",
      linkHref: generatedIdentity.repoUrl,
      linkLabel: generatedIdentity.repoUrl.replace("https://", "")
    }
  ]
} as const;

export const docCategories = [
  "Start",
  "Development",
  "Distribution",
  "Reference"
] as const;

export const primaryNav = [
  { href: "/docs", label: "Docs" },
  { href: siteConfig.repoUrl, label: "GitHub", external: true }
];
