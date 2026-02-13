import fs from 'fs';
import path from 'path';

// AlsoAsked API response structure
interface AlsoAskedResult {
  question: string;
  results?: AlsoAskedResult[];
}

interface AlsoAskedQuery {
  term: string;
  results: AlsoAskedResult[];
}

interface AlsoAskedResponse {
  queries: AlsoAskedQuery[];
}

// Theme configuration
interface Theme {
  name: string;
  slug: string;
  keywords: string[];
}

const THEMES: Theme[] = [
  {
    name: 'What is Stoicism',
    slug: 'what-is-stoicism',
    keywords: [
      'what is stoicism',
      'define stoicism',
      'definition of stoicism',
      'stoicism meaning',
      'core beliefs',
      'main belief',
      'philosophy of stoicism',
      'stoic philosophy',
      'introduction to stoicism',
      'principles of stoicism',
      'rules of stoicism',
      'pillars of stoicism',
      'teachings of stoicism',
      'basics of stoicism',
      'main idea',
      'what do stoics',
      'stoic motto',
      'golden rule of stoicism',
    ],
  },
  {
    name: 'Marcus Aurelius',
    slug: 'marcus-aurelius',
    keywords: [
      'marcus aurelius',
      'marcus',
      'aurelius',
      'emperor',
      'roman emperor',
    ],
  },
  {
    name: 'Meditations',
    slug: 'meditations',
    keywords: [
      'meditations',
      'meditation book',
      'marcus aurelius book',
    ],
  },
  {
    name: 'Epictetus',
    slug: 'epictetus',
    keywords: [
      'epictetus',
      'enchiridion',
      'discourses',
      'fragments',
    ],
  },
  {
    name: 'Seneca',
    slug: 'seneca',
    keywords: [
      'seneca',
      'letters from a stoic',
      '124 letters',
    ],
  },
  {
    name: 'Stoic Practices & Exercises',
    slug: 'stoic-practices-exercises',
    keywords: [
      'practice stoicism',
      'stoic practice',
      'exercise',
      'routine',
      'daily stoic',
      'journal',
      'how to',
      'start stoicism',
      'start practicing',
      'become a stoic',
      'apply stoicism',
      'premeditatio malorum',
      'negative visualization',
      'stoic meditation',
      'train myself to be stoic',
      'how can i start',
      'spot a stoic',
      'celebrities practice',
    ],
  },
  {
    name: 'Stoic Virtues & Ethics',
    slug: 'stoic-virtues-ethics',
    keywords: [
      'virtue',
      'virtues',
      'wisdom',
      'courage',
      'justice',
      'temperance',
      'moral',
      'ethics',
      'ethical',
      'cardinal virtue',
      'stoic vices',
      'evil',
    ],
  },
  {
    name: 'Control & Acceptance',
    slug: 'control-acceptance',
    keywords: [
      'control',
      'dichotomy of control',
      'accept',
      'acceptance',
      'fate',
      'amor fati',
      'letting go',
      'surrender',
      "can't control",
      'uncontrollable',
    ],
  },
  {
    name: 'Dealing with Emotions',
    slug: 'dealing-with-emotions',
    keywords: [
      'anger',
      'anxiety',
      'anxious',
      'grief',
      'fear',
      'desire',
      'emotion',
      'emotional',
      'feelings',
      'stress',
      'worry',
      'depression',
      'sad',
      'happiness',
    ],
  },
  {
    name: 'Resilience & Adversity',
    slug: 'resilience-adversity',
    keywords: [
      'hardship',
      'suffering',
      'obstacle',
      'pain',
      'death',
      'memento mori',
      'adversity',
      'resilience',
      'challenge',
      'difficult',
      'struggle',
      'loss',
      'trauma',
      'grief',
      'mourn',
      'stay calm',
      'stoics so calm',
      'pillars of everyday resiliency',
      'resilient coping',
      'are stoics resilient',
    ],
  },
  {
    name: 'Relationships & Social Life',
    slug: 'relationships-social-life',
    keywords: [
      'love',
      'relationship',
      'friend',
      'friendship',
      'family',
      'empathy',
      'social',
      'marriage',
      'partner',
      'dating',
      'community',
      'fall in love',
      'love yourself',
      'love chakra',
      'love energy',
    ],
  },
  {
    name: 'Work & Leadership',
    slug: 'work-leadership',
    keywords: [
      'work',
      'career',
      'job',
      'leadership',
      'leader',
      'productivity',
      'discipline',
      'ambition',
      'success',
      'business',
      'professional',
    ],
  },
  {
    name: 'Stoicism vs Other Philosophies',
    slug: 'stoicism-vs-other-philosophies',
    keywords: [
      'buddhism',
      'buddhist',
      'christianity',
      'christian',
      'existentialism',
      'nihilism',
      'nihilistic',
      'religion',
      'religious',
      'god',
      'atheist',
      'atheism',
      'versus',
      'vs',
      'compared to',
      'difference between',
      'similar to',
      'jesus',
      'bible',
      'pray',
      'epicurus',
      'contradicts stoicism',
      'opposite',
    ],
  },
  {
    name: 'Modern Stoicism',
    slug: 'modern-stoicism',
    keywords: [
      'modern stoicism',
      'modern stoic',
      'contemporary',
      'today',
      'modern world',
      'relevant',
      'current',
      '21st century',
      'tim ferriss',
      'ryan holiday',
      'stoics today',
      'bill gates',
      'mark zuckerberg',
      'warren buffett',
      'matthew mcconaughey',
      'albert einstein',
      'celebrities are stoic',
      'famous stoic person',
      'why is stoicism so popular',
      'why is stoicism so attractive',
      'why is stoicism so powerful',
      'big 3 of stoicism',
      'greatest stoic of all time',
    ],
  },
  {
    name: 'Books & Resources',
    slug: 'books-resources',
    keywords: [
      'book',
      'read',
      'reading',
      'translation',
      'quote',
      'quotes',
      'resource',
      'learn',
      'study',
      'text',
    ],
  },
  {
    name: 'Mindfulness & Mental Health',
    slug: 'mindfulness-mental-health',
    keywords: [
      'mindfulness',
      'meditation',
      'mental health',
      'therapy',
      'cbt',
      'cognitive behavioral',
      'wellbeing',
      'well-being',
      'psychology',
      'psychological',
    ],
  },
  {
    name: 'Criticisms & Drawbacks',
    slug: 'criticisms-drawbacks',
    keywords: [
      'downside',
      'negative side',
      'dark side',
      'criticism',
      'unhealthy',
      'bad for',
      'narcissistic',
      'good or bad',
      'demon of stoicism',
      'what stoicism tell you to avoid',
      'biggest criticism',
      'is stoicism actually healthy',
      'is being stoic unhealthy',
      'benefits of stoicism',
      'toxic',
      'criticized',
      'rivals of stoicism',
      'nietzsche',
      'judgemental',
    ],
  },
  {
    name: 'Stoic Personality & Traits',
    slug: 'stoic-personality-traits',
    keywords: [
      'stoic personality',
      'stoic person',
      'what makes a person stoic',
      'causes a stoic personality',
      'how does a stoic',
      'can you cry',
      'are stoics loners',
      'example of a stoic person',
      'why are some people stoic',
      'adhd',
      'schizoid',
      'zodiac',
      'habits of stoic',
      'how do i tell if',
      'girls attracted to stoic',
      'stoic guys',
      'stoic men',
      'monogamous',
      'disorder makes you stoic',
      'animal is the most stoic',
    ],
  },
];

// Recursively extract all questions from nested results
function extractQuestions(result: AlsoAskedResult): string[] {
  const questions: string[] = [result.question];

  if (result.results && result.results.length > 0) {
    for (const child of result.results) {
      questions.push(...extractQuestions(child));
    }
  }

  return questions;
}

// Classify a question into a theme
function classifyQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase();

  for (const theme of THEMES) {
    for (const keyword of theme.keywords) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        return theme.slug;
      }
    }
  }

  return 'other';
}

// Main function
async function main() {
  const dataDir = path.join(process.cwd(), 'data', 'alsoasked');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== '_index.json' && !f.startsWith('_'));

  console.log(`Found ${files.length} JSON files in ${dataDir}\n`);

  const allQuestions: string[] = [];

  // Extract all questions from all files
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Check if data has queries array
    if (!data.queries || !Array.isArray(data.queries)) {
      console.log(`⚠️  Skipping ${file}: no queries array`);
      continue;
    }

    for (const query of data.queries) {
      if (!query.results || !Array.isArray(query.results)) {
        continue;
      }
      for (const result of query.results) {
        const questions = extractQuestions(result);
        allQuestions.push(...questions);
      }
    }
  }

  console.log(`Total questions extracted: ${allQuestions.length}`);

  // Deduplicate questions (case-insensitive)
  const questionMap = new Map<string, string>();
  for (const q of allQuestions) {
    const normalized = q.toLowerCase().trim();
    if (!questionMap.has(normalized)) {
      questionMap.set(normalized, q);
    }
  }

  const uniqueQuestions = Array.from(questionMap.values());
  console.log(`Unique questions: ${uniqueQuestions.length}\n`);

  // Classify questions into themes
  const themeData = new Map<string, string[]>();

  // Initialize all themes
  for (const theme of THEMES) {
    themeData.set(theme.slug, []);
  }
  themeData.set('other', []);

  for (const question of uniqueQuestions) {
    const theme = classifyQuestion(question);
    themeData.get(theme)!.push(question);
  }

  // Build output structure
  const themes = [];

  for (const theme of THEMES) {
    const questions = themeData.get(theme.slug)!;
    if (questions.length > 0) {
      themes.push({
        name: theme.name,
        slug: theme.slug,
        questionCount: questions.length,
        topQuestions: questions.slice(0, 5),
        allQuestions: questions,
      });
    }
  }

  // Add "Other" category if it has questions
  const otherQuestions = themeData.get('other')!;
  if (otherQuestions.length > 0) {
    themes.push({
      name: 'Other',
      slug: 'other',
      questionCount: otherQuestions.length,
      topQuestions: otherQuestions.slice(0, 5),
      allQuestions: otherQuestions,
    });
  }

  const output = {
    summary: {
      total: allQuestions.length,
      unique: uniqueQuestions.length,
      themes: themes.length,
    },
    themes: themes.sort((a, b) => b.questionCount - a.questionCount),
  };

  // Save to file
  const outputPath = path.join(dataDir, '_themes.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('=== SUMMARY ===');
  console.log(`Total questions: ${output.summary.total}`);
  console.log(`Unique questions: ${output.summary.unique}`);
  console.log(`Themes: ${output.summary.themes}\n`);

  console.log('=== QUESTIONS PER THEME ===');
  for (const theme of output.themes) {
    console.log(`\n${theme.name} (${theme.questionCount} questions)`);
    console.log('Top questions:');
    for (const q of theme.topQuestions) {
      console.log(`  - ${q}`);
    }
  }

  console.log(`\n✓ Results saved to ${outputPath}`);
}

main().catch(console.error);
