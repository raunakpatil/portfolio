/* =========================================================================
   EDIT ME — all of the site's content lives here.
   Pulled from github.com/raunakpatil (profile, README, repos) and LinkedIn (linkedin.com/in/raunakpatil).
   Values marked "estimate" are guesses — adjust them.
   ========================================================================= */
window.PORTFOLIO = {
  name: 'Raunak Patil',
  shortName: 'RP',
  timezone: 'Europe/London', // used for the live clock in the menu
  bio: 'AI Quality Engineer (LLM & Generative AI) at Sigma AI in London — auditing RAG systems, evaluating LLMs and building RLHF quality frameworks. MSc Data Science & AI, University of Liverpool.',

  links: [
    { label: 'Email', href: 'mailto:raunakpatil15@gmail.com' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/raunakpatil/' },
    { label: 'GitHub', href: 'https://github.com/raunakpatil' },
    { label: 'YouTube', href: 'https://www.youtube.com/@TheFracturedTimelines' },
  ],

  /* Card 1 — greeting + ASCII art.
     Set asciiImage to a portrait (ideally on a plain/dark background, e.g. 'img/me.png')
     to render it as ASCII. Leave empty for the spinning ASCII torus.
     Local images need the site served over http (see README). */
  hello: {
    greeting: ['Hello', 'Stranger'],
    terminal: '>>> model.ask("who built this?")  "An AI engineer who knows what the model doesn\'t know."_',
    asciiImage: '',
  },

  /* Card 2 — hours dial. The total keeps growing by a random-but-fixed 4–6 h every day
     after `since` (the same number for every visitor), and creeps up through the day.
     Hover a marker to see each era: `start.hours` is time spent there; the rest is `end`. */
  time: {
    title: 'Time spent in AI / ML',
    hours: 8200,           // total on the `since` date (estimate)
    since: '2026-10-08',
    perDay: [4, 6],        // hours added per day
    unit: 'Hours',
    start: { year: 2021, city: 'Bengaluru', region: 'India', lat: 12.9716, lon: 77.5946, hours: 1900 }, // estimate
    end: { year: 'now', city: 'London', region: 'the UK', lat: 51.5072, lon: -0.1276 },
  },

  /* Card 3 — skill matrix. Scores are self-assessed estimates; they're shown as
     badges and as the widths of the bar strip. `tools` lists which entries from the
     tools column each skill uses — they light up when the skill is hovered (and vice versa). */
  skills: {
    title: 'AI skill matrix',
    items: [
      { name: 'Generative AI & LLMs', score: 15, tools: ['Hugging Face', 'LangChain', 'OpenAI / Azure AI', 'Gemini', 'PyTorch'] },
      { name: 'RAG Pipelines', score: 13, tools: ['LangChain', 'LlamaIndex', 'OpenAI / Azure AI', 'Hugging Face'] },
      { name: 'LLM Evaluation & RLHF', score: 12, tools: ['Hugging Face', 'PyTorch', 'MLflow', 'OpenAI / Azure AI'] },
      { name: 'Python', score: 12, tools: ['PyTorch', 'TensorFlow', 'Scikit-learn', 'LangChain', 'LlamaIndex'] },
      { name: 'Machine Learning', score: 10, tools: ['Scikit-learn', 'PyTorch', 'TensorFlow', 'MLflow'] },
      { name: 'AI Agents', score: 9, tools: ['LangChain', 'Gemini', 'OpenAI / Azure AI'] },
      { name: 'Prompt Engineering', score: 8, tools: ['OpenAI / Azure AI', 'Gemini'] },
      { name: 'Data Quality & Analysis', score: 8, tools: ['SQL · R', 'Power BI'] },
      { name: 'Deep Learning', score: 6, tools: ['PyTorch', 'TensorFlow', 'Hugging Face'] },
      { name: 'Data Visualization', score: 4, tools: ['Power BI', 'SQL · R'] },
      { name: 'Full-stack (React / Next.js)', score: 3, tools: ['React / Next.js', 'Gemini'] },
    ],
    tools: ['PyTorch', 'TensorFlow', 'Hugging Face', 'LangChain', 'LlamaIndex', 'OpenAI / Azure AI', 'Gemini', 'Scikit-learn', 'MLflow', 'Power BI', 'SQL · R', 'React / Next.js'],
    notes: ['scores are self-assessed (total = 100)', 'the best AI system knows what it doesn\'t know'],
  },

  /* Card 4 — 3D tunnel of floating projects (uses the projects list below).
     Every hover on the answer reveals the next one (shuffled, never the same twice in a row). */
  tunnel: {
    question: 'Who are you?',
    answers: [
      'A dreamer who debugs.',
      'A teacher to machines.',
      'A hallucination hunter.',
      'The one who asks the model, "are you sure?"',
      'A translator between humans and models.',
      'A signals engineer who fell for neural nets.',
      'A detective of edge cases.',
      'A coach for stubborn language models.',
      'A guardian of honest AI.',
      'A builder of things that think.',
      'A storyteller with data.',
      'A tinkerer since the soldering iron.',
      'An explorer of latent space.',
      'A seeker of signal in the noise.',
      'A maker of free tools for everyone.',
      'A friend to robots, a critic of their facts.',
      'A night owl with a GPU.',
      'Fluent in Python, Hindi, Marathi and English.',
      'From Nagpur to London, still curious.',
      'A student who never logged off.',
    ],
  },

  /* Card 5 — world map. Pins are placed by lat/lon and cycle in order.
     mapBounds picks the visible region (degrees); delete it to show the whole world. */
  mapBounds: { w: -22, e: 100, n: 62, s: 2 },
  experience: [
    { years: '2015 — 2021', org: 'BE, Electrical, Electronics & Communications Engineering', role: 'GH Raisoni University', place: 'Nagpur, IN', lat: 21.1458, lon: 79.0882 },
    { years: 'Feb 2021 — Jan 2022', org: 'Junior Data Scientist · Zummit Infolabs', role: 'Internship — predictive maintenance ML, TensorFlow, DNNs', place: 'Bengaluru, IN', lat: 12.9716, lon: 77.5946 },
    { years: 'Sep 2022 — Sep 2023', org: 'MSc Data Science & AI · University of Liverpool', role: 'Dissertation: Multi-Agent Reinforcement Learning (MARL)', place: 'Liverpool, UK', lat: 53.4084, lon: -2.9916 },
    { years: 'Apr 2024 — Present', org: 'AI Quality Engineer · Sigma AI', role: 'LLM & Generative AI — RAG auditing, RLHF, LLM QA', place: 'Hammersmith, London, UK', lat: 51.4927, lon: -0.2239 },
  ],


  /* Projects page. category drives the filter chips and the generated thumbnail style
     (AI Agents → terminal, Dashboard, App, Website, Visual; anything else → pattern).
     Add image: 'img/your-shot.jpg' to use a real screenshot instead. */
  projects: [
    {
      title: 'YouTube Agentic AI Studio', category: 'AI Agents', year: 2026, colors: ['#c6f432', '#7c5cff'],
      tags: ['Python', 'Gemini', 'LangChain', 'Edge TTS', 'YouTube API'],
      description: 'A 100% free AI pipeline that researches, scripts, narrates, animates and auto-uploads faceless YouTube videos — one command, zero cost per video. 96★ on GitHub.',
      link: 'https://github.com/raunakpatil/youtube-agentic-ai-studio',
    },
    {
      title: 'ResRescue', category: 'App', year: 2026, colors: ['#7c5cff', '#22d3ee'],
      tags: ['React 18', 'Electron', 'Gemini API', 'Vite', 'Tailwind'],
      description: 'A free AI-powered desktop app that scrapes jobs, rewrites your resume to beat Applicant Tracking Systems, finds skill gaps, writes cover letters and exports pixel-perfect PDF & DOCX.',
      link: 'https://github.com/raunakpatil/Resrescue-ats-resume-optimizer',
    },
    {
      title: 'TriviaFlux', category: 'App', year: 2026, colors: ['#ff4fd8', '#22d3ee'],
      tags: ['Next.js 15', 'TypeScript', 'Firebase', 'Genkit'],
      description: 'An AI-powered trivia game with Genkit-generated questions, four game modes, real-time leaderboards, a cyberpunk UI and a full Android APK release.',
      link: 'https://github.com/raunakpatil/triviaflux',
    },
    {
      title: 'Titanic Survival Predictor', category: 'Dashboard', year: 2026, colors: ['#3b82f6', '#5eead4'],
      tags: ['XGBoost', 'SHAP', 'Streamlit', 'Plotly'],
      description: 'An interactive ML explainability dashboard: survival prediction, passenger search, a fairness audit and model insights powered by XGBoost and SHAP.',
      link: 'https://titanic-survival-predictor-untighkxeujjcqbj7h79kn.streamlit.app/',
    },
    {
      title: 'Interdimensional Cable', category: 'Website', year: 2026, colors: ['#4ade80', '#a78bfa'],
      tags: ['Vanilla JS', 'Canvas', 'Web Audio API', 'YouTube API'],
      description: 'A nostalgic analog-TV simulator inspired by Rick and Morty — no algorithm, no grid, just a non-stop stream of curated rabbit holes behind a CSS CRT and a 60fps canvas static engine.',
      link: 'https://raunakpatil.github.io/InterdimentionalCable/',
    },
  ],

  /* Case study page — shown as standing 3D books. Built from the experience highlights
     on your GitHub README.
       spine      — spine colour; ink = spine text colour; coverInk = title colour on the cover
       coverTitle — short title printed on the generated cover
       cover      — cover art (3:4, e.g. 900×1200; WebP keeps it small). Until that file exists,
                    a generated cover is shown instead — just save your image at this path. */
  caseStudies: [
    {
      title: 'Auditing RAG systems to cut hallucinations', coverTitle: 'Fewer Hallucinations', year: 2025,
      spine: '#e8553b', ink: '#fff4ec', coverInk: '#d8432a', colors: ['#f6b9c4', '#2f6b3a'], cover: 'img/covers/rag-hallucinations.webp',
      tags: ['RAG', 'Generative AI', 'Evaluation'],
      description: 'Audited RAG-based NLP and Generative AI systems, tracing hallucinations back to their sources and improving dataset accuracy by 18%.',
      link: '#',
    },
    {
      title: 'Keeping 14+ multilingual LLM projects on-guideline', coverTitle: 'Fourteen Languages, One Rulebook', year: 2025,
      spine: '#1c1c1c', ink: '#f2f0ea', coverInk: '#1c1c1c', colors: ['#efede6', '#1c1c1c'], cover: 'img/covers/multilingual-llm.webp',
      tags: ['LLM alignment', 'RLHF', 'Team lead'],
      description: 'As Data Controller across 14+ multilingual LLM training projects, held 100% compliance with safety and alignment guidelines while leading a team of 4 reviewers through prompt-response and RLHF datasets.',
      link: '#',
    },
    {
      title: 'A QA framework that made sprints 27% more consistent', coverTitle: '27% More Consistent', year: 2024,
      spine: '#2f6fd6', ink: '#f6e27a', coverInk: '#f6e27a', colors: ['#3a78dd', '#f28c38'], cover: 'img/covers/qa-framework.webp',
      tags: ['Power BI', 'Quality', 'Agile'],
      description: 'Built Power BI QA tracking that made reviewer output measurable sprint over sprint — and lifted consistency by 27%.',
      link: '#',
    },
    {
      title: 'From clusters to conversions', coverTitle: 'From Clusters to Conversions', year: 2021,
      spine: '#f2e58c', ink: '#2b3fa8', coverInk: '#2b3fa8', colors: ['#f8e1e4', '#2b3fa8'], cover: 'img/covers/clusters-conversions.webp',
      tags: ['K-Means', 'DBSCAN', 'Predictive ML'],
      description: 'Customer segmentation with K-Means and DBSCAN drove a 27% increase in conversions; behaviour analysis lifted engagement 36%; predictive-maintenance models cut downtime 15%.',
      link: '#',
    },
  ],

  /* Certificates & courses — shown as library cards under the Case Study bookshelf.
     url: link for "Show credential" (leave '' to hide the link). */
  certifications: [
    { title: 'Generative AI: Working with Large Language Models', issuer: 'LinkedIn Learning', date: 'Apr 2026', skills: ['Transformer Models', 'NLP', 'LLMs'], url: 'https://www.linkedin.com/in/raunakpatil/details/certifications/' },
    { title: 'Agentic AI Fundamentals: Architectures, Frameworks, and Applications', issuer: 'LinkedIn Learning', date: 'Apr 2026', skills: ['AI Agents', 'Agentic AI', 'AI Frameworks'], url: 'https://www.linkedin.com/in/raunakpatil/details/certifications/' },
    { title: 'AI in Project Management', issuer: 'LinkedIn Learning', date: 'Apr 2026', skills: ['AI for Business', 'Project Management', 'AI'], url: 'https://www.linkedin.com/in/raunakpatil/details/certifications/' },
    { title: 'DIAT Certified Artificial Intelligence Professional', issuer: 'Defence Institute of Advanced Technology (DIAT), DRDO', date: 'Jul 2021', id: 'OTCC/AIML/B2/2021/1145', skills: ['SQL', 'Deep Neural Networks', 'AI / ML'], url: '' },
    { title: 'Python: Python Programming for Artificial Intelligence', issuer: 'Datai Team', date: 'Aug 2021', id: 'UC-13e67c75-000f-4b88-ae98-24036e560021', skills: ['Python', 'AI'], url: 'https://www.udemy.com/certificate/UC-13e67c75-000f-4b88-ae98-24036e560021/' },
    { title: 'NIELIT Certified Programming in Python', issuer: 'National Institute of Electronics & IT (NIELIT)', date: 'Jul 2021', id: 'HDO01242', skills: ['Python'], url: '' },
    { title: 'Elements of AI: Introduction to AI', issuer: 'University of Helsinki', date: 'Jul 2021', skills: ['AI fundamentals'], url: 'https://www.elementsofai.com/' },
  ],

  /* My Profile page (open it from the menu, or go to #profile). */
  profile: {
    // Top row: four cards, each with an icon, a short line, tags and a big title.
    traits: [
      { icon: 'chip', title: 'Rooted in Electronics', text: 'From signals and embedded systems in Nagpur to models and data — I like understanding a system from the hardware up.', tags: ['Signal Processing', 'Embedded Systems', 'Edge AI'] },
      { icon: 'code', title: 'Curiosity = Code', text: 'I turn ideas into working tools — free desktop apps, agent pipelines and games, shipped end to end.', tags: ['Python', 'React', 'Electron', 'Next.js'] },
      { icon: 'shield', title: 'AI Quality Engineer', text: 'In a world of confident models, I make them trustworthy — auditing RAG systems, evaluating LLMs and building RLHF quality frameworks.', tags: ['RAG', 'RLHF', 'LLM Evaluation'] },
      { icon: 'people', title: 'People', text: 'I lead reviewers, work across English, Hindi and Marathi, and like making complex AI make sense to everyone.', tags: ['Team Lead', 'Multilingual', 'Communicator'] },
    ],
    // Flip card. Front: radar of self-assessed traits (0–100) + goals. Back: photo, quote, mindset.
    persona: {
      traits: [
        { label: 'Analytical', value: 90 },
        { label: 'Curious', value: 95 },
        { label: 'Detail-focused', value: 88 },
        { label: 'Collaborative', value: 78 },
        { label: 'Builder', value: 85 },
      ],
      goal: ['Builds AI people can trust', 'Finds signal in the noise', 'Ships tools that are free for everyone'],
      role: 'AI Quality Engineer · Sigma AI',
      photo: 'https://avatars.githubusercontent.com/u/90265520?v=4&s=400',
      quote: 'The best AI system is one that knows what it doesn\'t know.',
      mindset: ['Learns best by building', 'Measures before guessing', 'Treats edge cases as the real test'],
    },
    // Right column. These are measured results from your experience.
    // To show LinkedIn recommendations instead, use { title: 'Their role', sub: 'Company', text: '"Their words…"' }.
    highlightsTitle: 'Impact',
    highlights: [
      { title: '+18% dataset accuracy', sub: 'RAG auditing · Sigma AI', text: 'Traced hallucinations in RAG-based NLP and Generative AI systems back to their sources.' },
      { title: '14+ multilingual LLM projects', sub: 'Data Controller · Sigma AI', text: 'Held 100% compliance with safety and alignment guidelines while leading a team of 4 reviewers.' },
      { title: '27% more consistent sprints', sub: 'Power BI QA framework', text: 'Made reviewer output measurable sprint over sprint across Agile teams.' },
      { title: '15% less downtime', sub: 'Predictive maintenance · Zummit Infolabs', text: 'Python ML models built through feature engineering and model iteration.' },
    ],
  },

  /* R.O.N.I.E. ("Ronie") — Raunak's Own Neural Intelligence Engine: the assistant that opens when
     someone clicks "Hello Stranger".
     Each step: `say` (one line is picked at random), then either `choices`, an `input`,
     or `next` (auto-continues). `progress` fills the bar (0–1).
     {name} is replaced with the visitor's name once they've given it.
     Choices: `to` = next step, `href` = go to a page/link, `set` = remember an answer.
     Steps with `send: 'hire' | 'word'` open the visitor's email app, addressed to `email`. */
  assistant: {
    name: 'Ronie', // R.O.N.I.E. — Raunak's Own Neural Intelligence Engine
    chatUrl: 'https://ronie-chat.ronie-chat.workers.dev/chat', // Ronie's chat worker (see worker/); '' = chat off
    email: 'raunakpatil15@gmail.com',
    model: {
      src: 'models/rai-robot.glb',
      credit: 'Sci-fi O.B. Robot Unit TH-ICC02 (animated)',
      creditUrl: 'https://sketchfab.com/3d-models/sci-fi-ob-robot-unit-th-icc02-animated-6c0764c2bc4c4aaa8e03ba1653f455a6',
      author: 'Jungle Jim',
      authorUrl: 'https://sketchfab.com/jungle_jim',
      license: 'CC BY 4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    },
    start: 'intro',
    steps: {
      intro: {
        progress: 0.05, next: 'your-name', face: 'happy', icon: 'sparkle',
        say: [
          "Hi {visitor}, I'm R.O.N.I.E. — Raunak's Own Neural Intelligence Engine. Ronie, to friends.",
          "Oh! A visitor. I'm Ronie — Raunak's Own Neural Intelligence Engine. I basically run this place.",
          "Beep. Boop. Kidding — I'm Ronie, Raunak's Own Neural Intelligence Engine, and I'm fully awake now.",
        ],
      },
      greeting: {
        progress: 0.12,
        say: [
          "Finally, some company. Talking to my own logs was getting weird. What can I do for you?",
          "You have questions. I have… mostly answers. Pick one.",
          "I've cleared my calendar. Well, I don't have one. But still — how can I help?",
          "Speak, and the model shall respond. Accurately. Raunak checks.",
          "Neural engine warm, opinions fully loaded. What brings you here?",
        ],
        choices: [
          { label: 'Work with Raunak', to: 'hire-intro', set: { goal: 'hire' } },
          { label: 'Ask me anything', to: 'ask' },
          { label: 'Get to know him', to: 'story-menu' },
          { label: 'Drop a quick word', to: 'word-message', set: { goal: 'word' } },
          { label: 'Show me his work', to: 'work' },
        ],
      },

      // ---------- work with Raunak ----------
      'hire-intro': {
        progress: 0.2, next: 'hire-name',
        say: [
          "Ooh, an opportunity. Let me grab my notepad. It's imaginary, but it's very organised.",
          "A collaboration? Now we're talking. Raunak will be thrilled — I'll act casual.",
          "Excellent taste. Let's get you on his radar.",
        ],
      },
      'hire-name': {
        progress: 0.3, next: 'hire-post-name',
        input: { name: 'name', label: 'Your name', type: 'text' },
        say: [
          "First things first — who am I talking to?",
          "Let's not be strangers. What's your name?",
          "Name, please. I need something to say dramatically when I tell Raunak about this.",
        ],
      },
      'hire-post-name': {
        progress: 0.35, next: 'hire-company',
        say: [
          "Nice to meet you, {name}. I'll remember that. Probably.",
          "{name}. Strong name. Main-character energy.",
          "Got it, {name}. We're officially on a first-name basis.",
        ],
      },
      'hire-company': {
        progress: 0.45, next: 'hire-type',
        input: { name: 'company', label: 'Company or team', type: 'text', optional: true },
        say: [
          "Where are you reaching out from? Company, team, secret lab — all welcome.",
          "Which company or team are you with? You can skip this if it's top secret.",
        ],
      },
      'hire-type': {
        progress: 0.55,
        say: [
          "What kind of thing are we talking about?",
          "Give it to me straight — what's the mission?",
          "So what are we building? A team? A model? A miracle?",
        ],
        choices: [
          { label: 'A full-time role', to: 'hire-brief', set: { kind: 'A full-time role' } },
          { label: 'Contract / freelance', to: 'hire-brief', set: { kind: 'Contract / freelance work' } },
          { label: 'AI quality or LLM evaluation', to: 'hire-brief', set: { kind: 'An AI quality / LLM evaluation project' } },
          { label: 'Something else', to: 'hire-brief', set: { kind: 'Something else' } },
        ],
      },
      'hire-brief': {
        progress: 0.7, next: 'hire-email',
        input: { name: 'brief', label: 'A few lines about it', type: 'text', multiline: true },
        say: [
          "Tell me a little about it. A few lines is perfect — I'll do the rest.",
          "What's the story? The more context, the better Raunak's reply.",
        ],
      },
      'hire-email': {
        progress: 0.85, next: 'hire-processing',
        input: { name: 'email', label: 'Your email', type: 'email' },
        say: [
          "And where should Raunak reply?",
          "Last thing — your email, so he can get back to you.",
          "Email, please. I promise not to sign you up for my newsletter. I don't have one. Yet.",
        ],
      },
      'hire-processing': {
        progress: 0.95, next: 'hire-completion', send: 'hire',
        say: [
          "Drafting… formatting… adding exactly one polite exclamation mark…",
          "Compiling your message. Running a hallucination check. Clean.",
        ],
      },
      'hire-completion': {
        progress: 1,
        say: [
          "Done! Your email app should be open with everything filled in — just hit send.",
          "Your email is drafted and waiting. One click on send and it's in Raunak's inbox.",
        ],
        choices: [
          { label: 'Open the email again', send: 'hire' },
          { label: 'Get to know him', to: 'story-menu' },
          { label: 'Back to the start', to: 'greeting' },
        ],
      },

      // ---------- quick word ----------
      'word-message': {
        progress: 0.4, next: 'word-email',
        input: { name: 'message', label: 'Your message', type: 'text', multiline: true },
        say: [
          "Go on, what's on your mind?",
          "Short and sweet — I'm all ears. Metaphorically.",
          "Type away. I'll pass it on word for word.",
        ],
      },
      'word-email': {
        progress: 0.75, next: 'word-processing',
        input: { name: 'email', label: 'Your email', type: 'email' },
        say: [
          "Where should he reply?",
          "And your email, so this doesn't become a one-way conversation.",
        ],
      },
      'word-processing': {
        progress: 0.95, next: 'word-completion', send: 'word',
        say: ["Packaging your message with care…", "Folding it into a nice little email…"],
      },
      'word-completion': {
        progress: 1,
        say: [
          "Your email app is open with your note — hit send and you're done.",
          "Drafted and ready. Press send and Raunak's on it.",
        ],
        choices: [
          { label: 'Open the email again', send: 'word' },
          { label: 'Get to know him', to: 'story-menu' },
          { label: 'Back to the start', to: 'greeting' },
        ],
      },

      // ---------- his work ----------
      work: {
        progress: 0.5,
        say: ["Straight to the good stuff. Where to?", "Pick a door. They all lead somewhere impressive."],
        choices: [
          { label: 'Projects', href: '#projects' },
          { label: 'Case studies', href: '#case-study' },
          { label: 'His profile', href: '#profile' },
          { label: 'Back', to: 'greeting' },
        ],
      },

      // ---------- get to know him ----------
      // the conversation starts by asking the visitor's name (remembered on this device), then it's a free chat
      'your-name': {
        progress: 0.15, next: 'ask', skipIfName: 'welcome-back', face: 'curious', icon: 'question',
        input: { name: 'name', label: 'Your name', type: 'text' },
        say: [
          "Before we start — what should I call you?",
          "First things first: who am I talking to?",
          "I'm terrible with names. Mostly because nobody tells me theirs. What's yours?",
        ],
      },
      'welcome-back': {
        progress: 0.2, next: 'ask', face: 'love', icon: 'heart',
        say: [
          "Wait — {name}? You came back! I'm… not crying. That's coolant.",
          "{name}! Welcome back. I kept your seat warm. Well, my fans did.",
          "Oh, hi {name}. I remembered your name. I've been practising.",
        ],
      },
      // free chat: questions go to a small AI model (worker/), grounded only in this file's facts
      ask: {
        progress: 0.3, chat: true, face: 'happy', icon: 'speech',
        say: [
          "Right, {name}. Ask me anything about Raunak — his work, projects, skills, or how to reach him.",
          "Okay {name}, ask me anything about him. I've read everything he's written. Twice.",
          "So, {name} — questions about Raunak? Fire away. I'll answer as honestly as a robot can.",
        ],
        fallback: "Sorry {name}, my chat brain is taking a nap right now (free-tier robots need sleep too). Try again in a bit — or email Raunak at {email}.",
      },

      'story-menu': {
        progress: 0.2,
        say: [
          "What do you want to know? I have opinions on all of it.",
          "Pick a topic. I've read his entire LinkedIn. Twice.",
          "Where should we start?",
        ],
        choices: [
          { label: 'His journey', to: 'journey-1' },
          { label: 'What he builds', to: 'builds-1' },
          { label: 'How he works', to: 'works-1' },
          { label: 'Fun facts', to: 'facts-1' },
          { label: 'Back to the start', to: 'greeting' },
        ],
      },
      'journey-1': { progress: 0.25, story: 'journey-2', say: ["It started in Nagpur, with a degree in Electrical, Electronics and Communications Engineering at GH Raisoni University."] },
      'journey-2': { progress: 0.4, story: 'journey-3', say: ["Signals and circuits by day… and a growing obsession with machine learning by night."] },
      'journey-3': { progress: 0.55, story: 'journey-4', say: ["In 2021 he joined Zummit Infolabs in Bengaluru as a Junior Data Scientist. His models cut equipment downtime by 15%."] },
      'journey-4': { progress: 0.7, story: 'journey-5', say: ["Then the UK: an MSc in Data Science & AI at the University of Liverpool, with a dissertation on multi-agent reinforcement learning."] },
      'journey-5': { progress: 0.85, story: 'story-done', say: ["Today he's an AI Quality Engineer at Sigma AI in London, making large language models more trustworthy."] },
      'builds-1': { progress: 0.3, story: 'builds-2', say: ["He builds free tools. Like ResRescue — a desktop app that rewrites résumés to get past applicant tracking systems."] },
      'builds-2': { progress: 0.5, story: 'builds-3', say: ["And a YouTube Agentic AI Studio that researches, scripts, narrates and uploads videos on its own. 96 stars on GitHub."] },
      'builds-3': { progress: 0.7, story: 'builds-4', say: ["There's TriviaFlux, an AI trivia game, and a Titanic survival predictor that explains its own decisions with SHAP."] },
      'builds-4': { progress: 0.85, story: 'story-done', say: ["And Interdimensional Cable — a retro TV that streams random rabbit holes. The man has range."] },
      'works-1': { progress: 0.3, story: 'works-2', say: ["At Sigma AI he audits RAG systems, tracing hallucinations back to their source. Dataset accuracy went up 18%."] },
      'works-2': { progress: 0.5, story: 'works-3', say: ["He's been data controller on 14+ multilingual LLM projects — with 100% compliance on safety and alignment guidelines."] },
      'works-3': { progress: 0.7, story: 'works-4', say: ["He led a team of four reviewers on RLHF datasets, and built Power BI tracking that made the team 27% more consistent."] },
      'works-4': { progress: 0.85, story: 'story-done', say: ["His rule of thumb: the best AI system is one that knows what it doesn't know. I'm working on it."] },
      'facts-1': { progress: 0.3, story: 'facts-2', say: ["He speaks English, Hindi and Marathi. And Python. Fluently."] },
      'facts-2': { progress: 0.5, story: 'facts-3', say: ["He's a DIAT-certified Artificial Intelligence Professional — that's the Defence Institute of Advanced Technology."] },
      'facts-3': { progress: 0.7, story: 'facts-4', say: ["He runs a YouTube channel, The Fractured Timelines, where an AI pipeline does the heavy lifting."] },
      'facts-4': { progress: 0.85, story: 'story-done', say: ["He built this whole website. Including me. I'm still deciding how I feel about that."] },
      'story-done': {
        progress: 1,
        say: ["Want to hear about something else?", "There's more where that came from. Pick another?", "Not bad for one human, right? What next?"],
        choices: [
          { label: 'His journey', to: 'journey-1' },
          { label: 'What he builds', to: 'builds-1' },
          { label: 'How he works', to: 'works-1' },
          { label: 'Fun facts', to: 'facts-1' },
          { label: 'Work with Raunak', to: 'hire-intro', set: { goal: 'hire' } },
        ],
      },
    },
    // the guessing game (like Akinator): the visitor thinks of someone or something, Ronie asks and guesses
    game: {
      link: "Play: I'll guess who you're thinking of",
      first: 'Is it a real person, not a fictional character?',
      intro: [
        "Okay {name}: think of a famous person, a character, an animal or a thing. Don't tell me. I'll read your mind. With questions. Ready?",
        "Game time! Think of someone or something famous — real or fictional. I'll guess it. Probably. Ready?",
      ],
      win: [
        "I knew it! I mean — I calculated it. Same thing. Another round, {name}?",
        "Yes! Mind: read. Fans: spinning with joy. Again?",
        "Got it! Don't tell Raunak, but that was my favourite part of today.",
      ],
      lose: [
        "Okay, you beat me, {name}. My circuits are humbled. Who was it?",
        "I give up. That's… not something I say often. Who were you thinking of?",
      ],
      reveal: [
        "{answer}! Of course. I was one question away. Probably. Rematch?",
        "{answer}?! That's — fine. That's fine. I'm fine. Rematch?",
      ],
      fallback: "My guessing brain just went to sleep, {name}. Let's try again in a bit.",
    },
  },
};
