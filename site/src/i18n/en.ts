// English page texts (second language). Same keys as de.ts.
export const en = {
  lang: "en",
  htmlLang: "en",
  siteName: "Nemo",
  meta: {
    title: "Nemo – the calm everyday app for PC and Android",
    description:
      "Calendar, tasks, finances and passwords in one app for Windows and Android. Your data stays with you: no account, no cloud. Open source, free.",
  },
  nav: {
    features: "Features",
    privacy: "Privacy",
    install: "Install",
    support: "Support",
    github: "GitHub",
  },
  theme: { toDark: "Switch to dark theme", toLight: "Switch to light theme" },
  langSwitch: {
    label: "Language",
    de: "Deutsch",
    en: "English",
    es: "Español",
    fr: "Français",
    "pt-BR": "Português (Brasil)",
    short: { de: "DE", en: "EN", es: "ES", fr: "FR", "pt-BR": "PT" },
  },
  a11y: {
    mainNav: "Main navigation",
    footerNav: "Footer",
    glance: "At a glance",
  },
  ogLocale: "en_GB",
  skip: "Skip to content",
  hero: {
    title: "Everything that matters, in one place.",
    titleAccent: "And only with you.",
    lead: "Nemo brings calendar, tasks, money and passwords together in one calm app for PC and Android. No account, no cloud.",
    windows: "For Windows",
    windowsSub: "Portable",
    android: "For Android",
    androidSub: "APK",
    trust: ["Open source, MIT", "No account", "Free, no tracking"],
    version: (v: string, d: string) => `Version ${v} · ${d}`,
    fallbackVersion: "Latest version",
    allReleases: "All versions",
    checksums: "Checksums",
    checksumsTitle: "Checksums (SHA-256)",
    checksumsHint:
      "The checksum comes from the GitHub release. Compare it after downloading if you want to be sure.",
    screenshotAlt:
      "Nemo overview with made-up sample data (shown in German): “important now”, “still waiting”, the “up next” card with a first step and today’s plan",
    phoneAlt: "The same overview on the phone",
  },
  features: {
    eyebrow: "What Nemo does",
    title: "Six areas. You switch on what you need.",
    intro: "Each area has its colour. The pictures show the app with invented sample data.",
    and: "and",
    areas: {
      plan: "The day, the week, the people.",
      money: "Accounts, invoices, subscriptions, budgets.",
      household: "Shopping and supplies.",
      knowledge: "Read, write, remember.",
      vault: "Encrypted, only here.",
      system: "What your device is up to.",
    },
    // The four scenes (src/catalog/scenes.js), keyed by the scene's first area.
    scenes: {
      plan: {
        text: "Events, reminders and deadlines of every module in one week. The planner spreads what is due over your free time.",
        alt: "Calendar with invented sample data: the week with its events and the agenda beside it",
      },
      money: {
        text: "What is there, what goes out and what is due. Bank statement import included.",
        alt: "Finance with invented sample data: balance, accounts, income and expenses of the month",
      },
      knowledge: {
        text: "Notes, bookmarks, lists and pantry sit next to the calendar instead of in yet another app.",
        alt: "Notes with invented sample data: the scratchpad and the list of pages",
      },
      vault: {
        text: "Passwords with TOTP and generator, documents with expiry dates. Invisible to the AI.",
        alt: "Unlocked vault with invented demo logins",
      },
    },
    modules: {
      summary: (n: number) => `All ${n} modules`,
      only: {
        windows: "Windows app only",
        android: "Android app only",
        both: "Windows and Android apps only",
      },
      legend: "Bold: on from the start. You switch on everything else in the module library.",
      wip: "In progress",
      wipText: "Preview, hidden in the app until you turn on “Show work in progress” (Settings → Appearance).",
      note: "The list is generated from the app itself.",
    },
  },
  data: {
    eyebrow: "Your data stays with you",
    title: "Your PC, your phone, your server. Nobody else.",
    nodes: [
      {
        icon: "pc",
        title: "Your PC",
        text: "All data lives here, encrypted vault included.",
      },
      {
        icon: "server",
        title: "Your own server",
        text: "A small program at home or on your web space.",
      },
      {
        icon: "phone",
        title: "Your phone",
        text: "The same data, usable offline.",
      },
    ],
    links: ["Sync, only if you want it", "Sync"],
    ai: "Cloud AI, only on request.",
    aiText: "With a local model it works without internet.",
    sent: "Sent:",
    sentText: "your question, the date, the field names of the modules.",
    never: "Never sent:",
    neverText: "entries, amounts, names, passwords.",
  },
  focus: {
    eyebrow: "Made for busy minds",
    title: "Less on the screen, so starting gets easier.",
    items: [
      {
        icon: "target",
        title: "One thing first",
        text: "The overview shows what is up next, with a first step and a duration. The rest waits, collapsed.",
      },
      {
        icon: "timer",
        title: "Focus mode",
        text: "One task, its steps, a ring timer with a soft end. Everything else is hidden.",
      },
      {
        icon: "bell",
        title: "Calm reminders",
        text: "At most three per hour, quiet hours at night, “later” with sensible options.",
      },
      {
        icon: "leaf",
        title: "No pressure",
        text: "“Still waiting” instead of “overdue for 12 days”. No streaks to lose, no counter that grows.",
      },
    ],
    honest:
      "Nemo is developed with ADHD in mind and helps with starting and staying on track. It is not a treatment and does not promise one. Every aid can be switched off individually.",
    shotAlt:
      "Detail of the overview: the “up next” card with “start · 5 min”, “later” and “something else”",
    phoneAlt:
      "The overview on the phone: “important now” and the “up next” card with a first step and duration",
  },
  compare: {
    eyebrow: "Comparison",
    title: "Nemo next to typical apps.",
    head: ["Feature", "Nemo", "Typical apps"],
    rows: [
      ["Where the data lives", "On your device", "On the provider’s servers"],
      ["Account", "None needed", "Required, usually with e-mail"],
      ["Price", "Free, no premium tier", "Subscription or ads"],
      ["Source code", "Open, MIT licence", "Closed"],
      [
        "Sync between devices",
        "Through your own server, optional",
        "Through the provider’s cloud, always",
      ],
    ],
  },
  install: {
    eyebrow: "Install",
    title: "Ready in a minute.",
    windows: {
      summary: "Windows: one file, no installation",
      text: "Run the file, done. The first time, SmartScreen asks: “More info” → “Run anyway”. The exe has no purchased certificate; updates are still signed and verified before they are applied. It needs WebView2, which Windows 10 and 11 usually have.",
    },
    android: {
      summary: "Android: install the APK",
      text: "Open the APK and allow “Install from this source” for your browser or file manager. Later updates are downloaded by the app itself and checksum-verified; Android only accepts APKs with the same signing key.",
    },
    updates: {
      summary: "Updates arrive in the app",
      text: "Settings → App updates. Before each update Nemo makes a backup and verifies the project’s signature. You decide when.",
    },
    dev: {
      summary: "Dev preview (untested)",
      text: "Every state of the development branch automatically produces a preview. It is a separate app “Nemo Dev” with its own data, untested and not meant for daily use. It does not replace the stable app.",
      windows: "Dev preview for Windows",
      android: "Dev preview for Android",
    },
    steps: "Step by step, with the Windows and Android warnings",
    more: "Full guide",
  },
  // Step-by-step page /en/install (components/InstallGuide.astro). Button labels are the exact wording of
  // Windows 11 and Samsung One UI in English; `ui` marks the word to tap, `text` explains the step.
  installPage: {
    title: "Install, step by step",
    description:
      "Installing Nemo on Windows and Android: what the Windows SmartScreen and Android warnings mean, which buttons to press and how to check the file.",
    lead: "Windows and Android warn you the first time. For Nemo that is normal at the moment. Here is why, and exactly which buttons to press.",
    downloads: {
      title: "Download",
      stable: "Stable version",
      dev: "Dev-Preview (untested)",
      devHint:
        "The Dev-Preview is a separate app “Nemo Dev” with its own data. It runs next to the stable app and does not replace it.",
    },
    why: {
      title: "Why does your device warn you?",
      text: "Nemo is a small open-source project. The Windows file is not signed with a purchased code-signing certificate, and the Android app does not come from the Play Store. So Windows and Android do not know the publisher and ask first. The warning is fair: it applies to every file from the internet your device does not know. Only install what you got from this site or the GitHub release.",
      signed:
        "What is signed anyway: updates inside the app are signed with the project key and checked before they are applied. The Android app is signed with a fixed key; Android only accepts updates signed with the same key.",
    },
    check: {
      title: "Check the file (optional)",
      text: "Every file has a SHA-256 checksum in the GitHub release. If it matches your file, it is exactly the file the project built.",
      windows:
        "Windows: open PowerShell in your Downloads folder and type (Dev-Preview: Nemo-Portable-dev.exe):",
      android:
        "Android: a checksum app, or later on a PC with the same command.",
      stable: "Checksums of the stable version",
      dev: "Checksums of the Dev-Preview",
    },
    windows: {
      title: "Windows 11 and 10",
      steps: [
        {
          text: "Download the file. If Edge says it “isn’t commonly downloaded”, click the three dots, then",
          ui: ["Keep", "Show more", "Keep anyway"],
        },
        {
          text: "Double-click the file in your Downloads folder. “Windows protected your PC” appears. Below the text, click",
          ui: ["More info"],
        },
        {
          text: "Now it says “Publisher: Unknown publisher”. Check that the app is called “Nemo-Portable.exe” or “Nemo-Portable-dev.exe”, then",
          ui: ["Run anyway"],
        },
        {
          text: "Nemo starts. Windows only asks the first time you run this file.",
          ui: [],
        },
      ],
      sac: "If it says “Smart App Control” instead and there is no “Run anyway” button: this protection does not allow unsigned apps at all. We advise against turning it off for Nemo: it protects all apps. Use the Android app instead, or wait for a signed version.",
      webview:
        "Nemo needs WebView2. Windows 10 and 11 almost always have it; if it is missing, Windows shows a notice with a link.",
    },
    android: {
      title: "Android (Samsung, One UI)",
      steps: [
        {
          text: "Download the APK in your browser. If Chrome asks whether to keep the file:",
          ui: ["Download anyway"],
        },
        {
          text: "Tap the “Download complete” notification, or open the file in “My Files → Downloads”.",
          ui: [],
        },
        {
          text: "Android says your phone is not allowed to install unknown apps from this source. Tap",
          ui: ["Settings"],
        },
        {
          text: "Turn on the switch for your browser or the Files app:",
          ui: ["Allow from this source"],
        },
        { text: "Go back to the installer, then", ui: ["Install"] },
        {
          text: "If Google Play Protect asks, it is the same warning as above: the app is not from the Play Store. Choose “Scan app”; if “Install anyway” appears afterwards, the decision is yours.",
          ui: [],
        },
      ],
      autoBlocker:
        "If it says “Blocked by Auto Blocker”: on newer Samsung phones this feature stops apps from outside the stores. Settings → Security and privacy → Auto Blocker → off, install Nemo, then turn it back on. While it is on, Nemo cannot install its own updates either.",
      after:
        "Afterwards you can turn “Allow from this source” off again for the browser. At the first update from inside the app, Android asks once whether Nemo may install updates.",
    },
    firstStart: {
      title: "The first start",
      items: [
        "Nemo opens in your system language, German or English (other languages: English). You can change it in Settings.",
        "The Dev-Preview shows a “Dev” label at the top and briefly a note about it. That is not an error, just the sign that you are using the preview.",
        "On the first start the Dev-Preview asks: “Start setup” or “Mit Testdaten ansehen” (made-up examples to try things out; red cards like “invoices overdue” are then part of it). To remove them: Settings → “Entwickler” → “Testdaten entfernen” (the test tools are in German only).",
        "The stable version starts empty and asks whether you want to set it up step by step. Every step can be skipped.",
        "No account, no sign-in. When there is an update, the app shows it; you decide when it comes.",
      ],
    },
    help: "Stuck somewhere? Tell us at which step; a screenshot helps.",
    helpLink: "Ask on GitHub",
    back: "Back to the start page",
  },
  support: {
    eyebrow: "Support",
    title: "Nemo stays free.",
    text: "If you like, give something once via Ko-fi. As a thank-you you get a supporter code for a “thanks” badge and five colour themes. Every feature stays open to everyone.",
    button: "Support on Ko-fi",
    note: "Ko-fi is an external provider; payment happens only there.",
    themes: "Colour themes for supporters",
  },
  footer: {
    github: "GitHub",
    releases: "Releases",
    changelog: "Changelog",
    roadmap: "Roadmap",
    privacy: "Privacy",
    imprint: "Imprint",
    license: "MIT licence",
  },
  legal: {
    imprintTitle: "Imprint",
    privacyTitle: "Privacy policy",
    back: "Back to the start page",
  },
  notFound: {
    title: "Page not found",
    text: "This address does not exist.",
    back: "Back to the start page",
  },
} as const;
