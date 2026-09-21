export const QUESTION_BANK = {
  'How You Work': [
    "What helps you do your best work?",
    "Do you prefer figuring something out on your own or talking it through with someone? Tell us why.",
    "Tell us about a time when you felt completely in your element at work.",
    "What's something about the way you work that you'd like your teammates to understand?",
    "When you have a difficult task ahead of you, how do you usually approach it?",
    "What's one thing that can make a workday much better for you?",
    "Do you prefer having a clear plan or having room to figure things out as you go?",
    "Tell us about a work habit that helps you stay productive.",
    "What's something you need from your environment to do your best work?",
    "When you're working on something important, what helps you stay focused?",
  ],
  'What Motivates You': [
    "What makes you feel like you've had a really good day at work?",
    "What kind of work makes you lose track of time?",
    "What makes you want to do your best work?",
    "Tell us about something you've worked on that you were really proud of.",
    "What kind of recognition means the most to you?",
    "What makes you feel like your work matters?",
    "Tell us about a time someone made you feel really appreciated for your work.",
    "What's something you've always wanted to get better at?",
    "What kind of challenge gets you excited?",
    "When you're having a difficult day at work, what usually helps you keep going?",
  ],
  'Communication': [
    "When you're stuck on something, what's more helpful: someone giving you advice or helping you think it through?",
    "How do you prefer people to give you feedback?",
    "What's something teammates sometimes misunderstand about how you communicate?",
    "When you have an idea, do you prefer to think it through first or talk about it immediately?",
    "Tell us about a time when good communication helped solve a problem.",
    "What's one thing that makes it easier for you to speak up in a team?",
    "When you disagree with someone, how do you usually approach the conversation?",
    "Do you prefer quick messages or detailed explanations when someone is asking you to do something?",
    "What's something you appreciate when someone is communicating with you?",
    "Tell us about a time someone communicated something to you in a way that really helped.",
  ],
  'What You Value': [
    "What do you really value in the people you work with?",
    "What makes you feel comfortable around a new team?",
    "What's something you wish more people knew about you?",
    "What quality do you appreciate most in a teammate?",
    "What does being a good teammate mean to you?",
    "What's something you think every good team should have?",
    "What is one thing you will always make time for, even when you're busy?",
    "What's something you've learned about yourself through working with other people?",
    "What kind of environment brings out the best in you?",
    "What's one thing you think makes people feel like they belong on a team?",
  ],
  'Team Experiences': [
    "Tell us about a team you've really enjoyed being part of. What made it work?",
    "Tell us about a time a teammate really helped you.",
    "Tell us about a team experience you remember fondly.",
    "What's the best piece of advice you've received from a teammate?",
    "Tell us about a time you learned something important from someone you worked with.",
    "Tell us about a time your team overcame something difficult together.",
    "What's the funniest or most memorable thing that has happened on a team you've been part of?",
    "Tell us about someone you've worked with who taught you something valuable.",
    "What's one thing a previous team did that you'd love to bring to your current team?",
    "What's one thing you hope your teammates will remember about working with you?",
  ],
};

export const CATEGORIES = Object.keys(QUESTION_BANK);

export const AVATAR_OPTIONS = ['🦊', '🐻', '🐯', '🦁', '🐺', '🦅', '🐬', '🦋', '🐸', '🦄', '🐙', '🦜', '🐧', '🦔', '🐵', '🦩'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build n session prompts across different categories, ensuring no consecutive repeats
 */
export function buildSessionPrompts(n, customQuestions = {}) {
  let pool = [];
  CATEGORIES.forEach(cat => {
    const customList = customQuestions[cat] || [];
    const catPool = shuffle([...QUESTION_BANK[cat], ...customList]);
    catPool.forEach(text => pool.push({ text, cat }));
  });

  pool = shuffle(pool);
  const selected = [];
  const remaining = [...pool];

  while (selected.length < n && remaining.length) {
    const lastCat = selected.length ? selected[selected.length - 1].cat : null;
    let idx = remaining.findIndex(p => p.cat !== lastCat);
    if (idx === -1) idx = 0;
    selected.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  return selected;
}
