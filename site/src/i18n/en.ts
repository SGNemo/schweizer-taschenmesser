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
    modules: "Modules",
    data: "Your data",
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
  download: {
    windows: "Download for Windows",
    android: "Download for Android",
    windowsSub: "Portable",
    androidSub: "APK",
    version: (v: string, d: string) => `Version ${v}, ${d}`,
    warn: "Windows and Android ask before the first start. For now that is normal.",
    guide: "Install step by step",
    allReleases: "All versions",
  },
  honest:
    "Nemo is built with ADHD in mind and helps with starting and keeping going. It is not a treatment and does not promise one. Every aid can be switched off on its own.",
  home: {
    h1: "One thing first.",
    lead: "Nemo is a calm app for what everyday life brings: appointments, tasks, money, lists, passwords. It shows you what to do now. The rest waits.",
    sub: "For Windows and Android. No account. Your data stays on your device.",
    now: {
      alt: "Sketch of the “Up now” card: one task, below it the button “Start, 5 min” and the ways out “Later” and “Something else”. Behind it two folded rows saying “Still waiting”. Drawn, not a picture of the app.",
      label: "Up now",
      task: "Taxes: find the receipts",
      start: "Start, 5 min",
      later: "Later",
      other: "Something else",
      waiting: "Still waiting",
    },
    day: {
      h: "One day with Nemo",
      intro: "An invented day. The features exist.",
      plan: {
        time: "07:40",
        h: "What is today?",
        p: "The overview shows what matters now and the plan for today. Nothing more.",
        alt: "Sketch of the plan for the day: three rows with time and title, 08:00 take medication, 10:00 team meeting, 13:00 hairdresser. Drawn, not a picture of the app.",
        rows: [
          ["08:00", "Take medication"],
          ["10:00", "Team meeting"],
          ["13:00", "Hairdresser"],
        ],
      },
      focus: {
        time: "10:15",
        h: "Start",
        p: "Focus mode: one task, its steps, a ring timer with a soft end. Everything else is hidden.",
        alt: "Sketch of the focus mode: a ring, two thirds full, next to it three steps, the first ticked. Drawn, not a picture of the app.",
        ring: "16:40",
        steps: ["Get the folder", "Sort the receipts", "Tick the list"],
      },
      capture: {
        time: "13:05",
        h: "Noted quickly",
        p: "You type “morgen 15 Uhr Zahnarzt” (German phrases for now). Nemo recognises the appointment and the date on your device, without the network.",
        alt: "Sketch of the quick capture: an input field with the German phrase “morgen 15 Uhr Zahnarzt”, below it the recognised entry: appointment, tomorrow, 15:00. Drawn, not a picture of the app.",
        input: "morgen 15 Uhr Zahnarzt",
        kind: "Appointment",
        what: "Zahnarzt",
        when: "tomorrow, 15:00",
      },
      money: {
        time: "18:30",
        h: "What goes out?",
        p: "Accounts, invoices, subscriptions and budgets side by side: what is there, what goes out, what is due.",
        alt: "Sketch of the budgets: three bars for housing, food and leisure, filled to different lengths. Drawn, not a picture of the app.",
        bars: ["Housing", "Food", "Leisure"],
      },
      night: {
        time: "22:00",
        h: "Quiet",
        p: "At night it stays silent. During the day at most three reminders an hour arrive. You set both yourself.",
      },
    },
    data: {
      h: "And it stays with you",
      lead: "No account, no Nemo server. What the app still sends online is listed here. None of it goes to the project. Your entries leave the device only when you trigger it yourself: through sync to your own server, or as data you give an AI question.",
      link: "Every connection, and how to check",
    },
    inside: {
      h: "You switch on what you need",
      intro: (areas: number, modules: number) => `${areas} areas, ${modules} modules. Only the essentials are on at the start.`,
      link: "See all modules",
    },
    get: { h: "Try it", p: "Free, no premium tier." },
  },
  ledger: {
    caption: "Connections the app makes",
    head: ["When", "Where to", "What", "Switch"],
    rows: [
      { short: true, when: "Update check, at most once a day", where: "GitHub", what: "The request for the version file. GitHub sees your IP address.", off: "Settings → Updates" },
      { short: true, when: "Weather, after you chose a place", where: "open-meteo.com", what: "The place name while searching, then the position rounded to about 1 km.", off: "Settings → Connections → Weather" },
      { short: true, when: "Opening the currency converter", where: "frankfurter.dev", what: "The request for the rates.", off: "Only when opened" },
      { short: false, when: "Clicking “Look up public IP”", where: "api.ipify.org", what: "The request.", off: "Only on click" },
      { short: false, when: "Loading the local AI model", where: "huggingface.co", what: "The download. The checksum is verified.", off: "Only after you confirm" },
      { short: false, when: "Feeds and calendar subscriptions", where: "The addresses you enter", what: "Fetching the address.", off: "Off until you enter one" },
      { short: false, when: "Google and Spotify", where: "Google, Spotify", what: "Google: reading calendar and email headers. Spotify: what is playing and a few controls.", off: "Off until you set up the connection" },
      { short: true, when: "AI assistant", where: "A provider you choose", what: "Your question, the date, the field names of the modules.", off: "Off until you store a key" },
      { short: true, when: "Sync", where: "Your own server", what: "Your data, end-to-end encrypted if you want.", off: "Off until you set it up" },
    ],
    never: "Never:",
    neverText: "entries, amounts, names or passwords to the project. There is no Nemo server, no account, no telemetry, no advertising.",
  },
  modules: {
    title: "Modules",
    description: "All of Nemo's modules by area: Plan, Money, Household, Knowledge, Vault and System. You switch on what you need.",
    h1: "You switch on what you need.",
    lead: (areas: number, modules: number) =>
      `${modules} modules in ${areas} areas. Only the essentials are on at the start. You fetch the rest from the module library when you need it.`,
    areas: {
      plan: "The day, the week, the people.",
      money: "Accounts, invoices, subscriptions, budgets.",
      household: "Shopping and supplies.",
      knowledge: "Read, write, remember.",
      vault: "Encrypted, only here.",
      system: "What your device is up to.",
    },
    only: {
      windows: "Windows app only",
      android: "Android app only",
      both: "Windows and Android app only",
    },
    on: "on at the start",
    library: {
      alt: "Sketch of the module library: three rows with a module name and a switch. Calendar and Finances are on, Pantry is off. Drawn, not a picture of the app.",
      title: "Module library",
      rows: [
        ["sky", "Calendar", "on"],
        ["teal", "Finances", "on"],
        ["fern", "Pantry", "off"],
      ],
    },
    note: "The list is generated from the app itself.",
  },
  dataPage: {
    title: "What goes online",
    description: "Every connection Nemo makes, with destination, content and switch. Your entries stay on your device.",
    h1: "What goes online.",
    lead: "Your entries stay on your device. Here is every connection Nemo makes, and where you switch it off.",
    schema: {
      alt: "Diagram: inside a line labelled “With you” are your PC, your phone and, dashed, your own server. Outside, under “Internet”, are update check, weather and AI, each with a note on how it is or gets switched off.",
      inside: "With you",
      pc: ["Your PC", "all data, vault encrypted"],
      phone: ["Your phone", "the same data, with sync"],
      server: ["Your own server", "only if you want"],
      sync: "Sync",
      outside: "Internet",
      lines: [
        ["Update check", "can be switched off"],
        ["Weather", "can be switched off"],
        ["AI", "off until you switch it on"],
      ],
    },
    table: { h: "Every connection", intro: "Apart from your IP address and the request itself nothing is transferred, unless the row says otherwise." },
    ai: {
      h: "The AI does not see your entries",
      p: [
        "The assistant sends your question, the date and the field names of the modules you switched on. Nothing more.",
        "Two exceptions only you can trigger. You can give a question the data of one module; the app shows exactly what goes along first. And through the local import interface you can give an AI on your PC read access to single modules.",
        "The password vault is invisible to AI, search and import.",
      ],
    },
    check: {
      h: "Check it yourself",
      intro: "You do not have to take this on trust. You can look these up yourself.",
      items: [
        ["Source code", "Open, MIT licence. Every line of the app is on GitHub."],
        ["Updates", "Signed with the project key and verified before they are applied."],
        ["Windows file", "No purchased certificate. That is why SmartScreen asks before the first start."],
      ],
      sums: "Checksums (SHA-256)",
      sumsHint: "From the GitHub release. If the sum matches your file, it is the file the project built.",
      source: "Source code on GitHub",
      docs: "Security and privacy, in full",
      site: "Privacy policy of this website",
    },
  },
  supportPage: {
    title: "Support",
    description: "Nemo stays free. If you like, give once through Ko-fi and get a badge and five colour themes as a thank-you.",
    h1: "Nemo stays free.",
    lead: "There is no premium tier and no advertising. Every feature stays open to everyone.",
    give: {
      h: "If you would like to give something",
      p: "You give once through Ko-fi. As a thank-you you get a supporter code: a “thanks” badge and five colour themes.",
      button: "Support on Ko-fi",
      note: "Ko-fi is an external provider; payment happens only there.",
    },
    themes: { h: "The five colour themes", label: "Colour themes for supporters" },
    code: {
      h: "The code",
      p: "The code is checked on your device only, without the network. It unlocks colours and the badge, no feature.",
      link: "How the supporter code works",
    },
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
