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

  /* Card 2 — hours counter + gauge (gauge fills hours / goal). */
  time: {
    title: 'Time spent in AI / ML',
    hours: 8200, // estimate: Zummit (1 yr) + MSc (1 yr) + Sigma AI (Apr 2024 → now) + side projects
    goal: 10000,
    unit: 'Hours',
    start: { year: 2021, city: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
    end: { year: 2026, city: 'London', lat: 51.5072, lon: -0.1276 },
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
      'A dreamer.',
      'A teacher to machines.',
      'A hallucination hunter.',
      'A translator between humans and models.',
      'A builder of thinking things.',
      'A storyteller with data.',
      'A prompt whisperer.',
      'A coach for language models.',
      'A data detective.',
      'A tinkerer at heart.',
      'A guardian of model quality.',
      'An explorer of latent space.',
      'A seeker of signal in the noise.',
      'A lifelong learner.',
      'A maker of free tools.',
      'A friend to robots.',
      'A night-owl coder.',
      'An apprentice of neural nets.',
      'A curious mind from Nagpur.',
      'An AI engineer in London.',
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
};
